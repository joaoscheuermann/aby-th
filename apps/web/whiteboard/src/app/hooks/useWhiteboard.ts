import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { useWhiteboardStore, TransformMode } from '../store/whiteboardStore';
import { useNodeStore, WhiteboardNode } from '../store/nodeStore';
import { VideoUtils } from '../engine/VideoUtils';

export const useWhiteboard = (containerRef: React.RefObject<HTMLDivElement | null>) => {
    const appRef = useRef<PIXI.Application | null>(null);
    const contentLayerRef = useRef<PIXI.Container | null>(null);
    const uiLayerRef = useRef<PIXI.Container | null>(null);
    const transformerRef = useRef<PIXI.Container | null>(null);

    // Refs to track previous state for diffing
    const renderedNodesRef = useRef<Record<string, PIXI.Container>>({});

    const {
        selectedObject,
        setSelectedObject,
        transformState,
        updateTransformState
    } = useWhiteboardStore();

    const {
        updateNode,
        nodes // Consume nodes from node store
    } = useNodeStore();

    // Helper to access latest state in event listeners without dependency cycles
    const stateRef = useRef({ selectedObject, transformState });
    useEffect(() => {
        stateRef.current = { selectedObject, transformState };
    }, [selectedObject, transformState]);

    // Initialize App
    useEffect(() => {
        if (!containerRef.current || appRef.current) return;

        const app = new PIXI.Application();
        appRef.current = app;
        let isDestroyed = false;

        const init = async () => {
            await app.init({
                resizeTo: containerRef.current!,
                backgroundColor: 0xf0f0f0,
                antialias: true,
                autoDensity: true,
                resolution: window.devicePixelRatio || 1,
            });

            if (isDestroyed) {
                app.destroy(true, { children: true, texture: true });
                return;
            }

            if (!containerRef.current) return;
            containerRef.current.innerHTML = '';
            containerRef.current.appendChild(app.canvas);

            // Layers
            const contentLayer = new PIXI.Container();
            const uiLayer = new PIXI.Container();
            app.stage.addChild(contentLayer);
            app.stage.addChild(uiLayer);
            contentLayerRef.current = contentLayer;
            uiLayerRef.current = uiLayer;

            // Transformer Setup
            createTransformer(uiLayer);

            // Events
            app.stage.eventMode = 'static';
            app.stage.hitArea = app.screen;
            app.renderer.on('resize', () => { app.stage.hitArea = app.screen; });

            app.stage.on('pointerdown', (e) => {
                if (e.target === app.stage) {
                    setSelectedObject(null);
                }
            });

            app.stage.on('globalpointermove', onGlobalMove);
            app.stage.on('pointerup', onGlobalUp);
            app.stage.on('pointerupoutside', onGlobalUp);
        };

        init();

        return () => {
            isDestroyed = true;
            if (app.renderer) {
                try {
                    app.destroy(true, { children: true, texture: true });
                } catch (e) {
                    console.warn('Cleanup error', e);
                }
            }
            appRef.current = null;
            renderedNodesRef.current = {};
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [containerRef]);

    // =========================================
    // Store -> Canvas Sync
    // =========================================
    useEffect(() => {
        const contentLayer = contentLayerRef.current;
        if (!contentLayer || !appRef.current) return;

        const rendered = renderedNodesRef.current;
        const currentIds = new Set(Object.keys(nodes));

        // 1. Remove missing nodes
        Object.keys(rendered).forEach(id => {
            if (!currentIds.has(id)) {
                const child = rendered[id];
                contentLayer.removeChild(child);
                child.destroy();
                delete rendered[id];
                // If the removed node was selected, deselect it
                if (selectedObject === child) {
                    setSelectedObject(null);
                }
            }
        });

        // 2. Add or Update nodes
        currentIds.forEach(id => {
            const nodeData = nodes[id];
            let child = rendered[id];

            // Create if new
            if (!child) {
                createNodeSprite(nodeData).then(sprite => {
                    // Check if it was removed while loading
                    if (!useNodeStore.getState().nodes[id]) return;

                    // Assign ID to sprite for reverse lookup
                    (sprite as any).nodeId = id;
                    contentLayer.addChild(sprite);
                    renderedNodesRef.current[id] = sprite;
                    syncNodeToSprite(nodeData, sprite);
                });
            } else {
                // Update existing
                // Skip update if this object is currently being transformed by the user
                // We rely on the local interaction to drive the visual state, avoiding store round-trip lag
                const isSelected = selectedObject === child;
                const isTransforming = isSelected && transformState.mode !== TransformMode.NONE;

                if (!isTransforming) {
                    syncNodeToSprite(nodeData, child);
                }
            }
        });

    }, [nodes, selectedObject, transformState.mode]); // Re-run when nodes change

    const createNodeSprite = async (node: WhiteboardNode): Promise<PIXI.Container> => {
        let sprite: PIXI.Sprite;
        try {
            if (node.type === 'video') {
                const videoElement = VideoUtils.createVideoElement(node.url);
                const texture = await PIXI.Assets.load(videoElement);
                sprite = new PIXI.Sprite(texture);
                (sprite as any)._videoElement = videoElement;
            } else {
                const texture = await PIXI.Assets.load(node.url);
                sprite = new PIXI.Sprite(texture);
            }
        } catch (e) {
            console.error('Failed to load asset', node.url, e);
            // Fallback placeholder?
            sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        }

        sprite.anchor.set(0.5);
        setupInteractive(sprite);
        return sprite;
    };

    const syncNodeToSprite = (node: WhiteboardNode, sprite: PIXI.Container) => {
        // Only update if changed to avoid thrashing (though PIXI is smart about this mostly)
        // Simple check
        if (sprite.x !== node.x) sprite.x = node.x;
        if (sprite.y !== node.y) sprite.y = node.y;
        if (sprite.rotation !== node.rotation) sprite.rotation = node.rotation;
        if (sprite.scale.x !== node.scale.x) sprite.scale.x = node.scale.x;
        if (sprite.scale.y !== node.scale.y) sprite.scale.y = node.scale.y;
    };

    // Update Transformer Viz
    useEffect(() => {
        updateTransformer();
    });

    // =========================================
    // Transformer Logic
    // =========================================
    const createTransformer = (layer: PIXI.Container) => {
        const tr = new PIXI.Container();
        tr.visible = false;
        layer.addChild(tr);
        transformerRef.current = tr;

        const border = new PIXI.Graphics();
        border.label = 'border';
        border.eventMode = 'static';
        border.cursor = 'move';
        border.on('pointerdown', (e) => {
            e.stopPropagation();
            const sel = useWhiteboardStore.getState().selectedObject;
            if (sel) onObjectDown(e, sel);
        });
        tr.addChild(border);

        const createHandle = (name: string, cursor: string) => {
            const g = new PIXI.Graphics();
            g.rect(-6, -6, 12, 12);
            g.fill(0x00aaff);
            g.stroke({ width: 1, color: 0xffffff });
            g.eventMode = 'static';
            g.cursor = cursor;
            g.label = name;
            g.on('pointerdown', (e) => {
                e.stopPropagation();
                onHandleDown(e, name);
            });
            tr.addChild(g);
        };

        createHandle('tl', 'nwse-resize');
        createHandle('tr', 'nesw-resize');
        createHandle('br', 'nwse-resize');
        createHandle('bl', 'nesw-resize');
        createHandle('rotate', 'grab');
    };

    const updateTransformer = () => {
        const { selectedObject } = stateRef.current;
        const tr = transformerRef.current;
        if (!tr || tr.destroyed) return;

        if (!selectedObject || selectedObject.destroyed) {
            tr.visible = false;
            return;
        }

        // Ensure filters
        if (!selectedObject.filters || selectedObject.filters.length === 0) {
            const filter = new PIXI.ColorMatrixFilter();
            filter.brightness(1.2, false);
            selectedObject.filters = [filter];
        }

        tr.visible = true;
        tr.position.copyFrom(selectedObject.position);
        tr.rotation = selectedObject.rotation;

        const bounds = selectedObject.getLocalBounds();
        const w = bounds.width * selectedObject.scale.x;
        const h = bounds.height * selectedObject.scale.y;
        const hw = w / 2;
        const hh = h / 2;

        const border = tr.getChildByLabel('border') as PIXI.Graphics;
        if (border) {
            border.clear();
            border.rect(-hw, -hh, w, h);
            border.stroke({ width: 2, color: 0x00aaff });
            border.fill({ color: 0x00aaff, alpha: 0.1 });
        }

        // Handles
        const setPos = (lbl: string, x: number, y: number) => {
            const h = tr.getChildByLabel(lbl);
            if (h) h.position.set(x, y);
        }
        setPos('tl', -hw, -hh);
        setPos('tr', hw, -hh);
        setPos('br', hw, hh);
        setPos('bl', -hw, hh);
        setPos('rotate', 0, -hh - 30);

        // Connect rotate line
        if (border) {
            border.moveTo(0, -hh);
            border.lineTo(0, -hh - 30);
            border.stroke({ width: 1, color: 0x00aaff });
        }
    };

    // =========================================
    // Interaction Handlers
    // =========================================
    const onObjectDown = (e: PIXI.FederatedPointerEvent, obj: PIXI.Container) => {
        e.stopPropagation();
        setSelectedObject(obj);

        updateTransformState({
            mode: TransformMode.DRAG,
            startPos: { x: e.global.x, y: e.global.y },
            startObjectPos: { x: obj.x, y: obj.y }
        });
    };

    const onHandleDown = (e: PIXI.FederatedPointerEvent, name: string) => {
        const target = useWhiteboardStore.getState().selectedObject;
        if (!target) return;

        const startPos = { x: e.global.x, y: e.global.y };

        if (name === 'rotate') {
            const globalCenter = target.getGlobalPosition();
            const startRotation = target.rotation;
            const initialAngle = Math.atan2(e.global.y - globalCenter.y, e.global.x - globalCenter.x);

            updateTransformState({
                mode: TransformMode.ROTATE,
                startPos,
                startRotation,
                initialAngle
            });
        } else {
            const globalCenter = target.getGlobalPosition();
            const dist = Math.hypot(e.global.x - globalCenter.x, e.global.y - globalCenter.y);

            updateTransformState({
                mode: TransformMode.SCALE,
                startPos,
                startScale: { x: target.scale.x, y: target.scale.y },
                initialDist: dist
            });
        }
    };

    const onGlobalMove = (e: PIXI.FederatedPointerEvent) => {
        const { mode, startPos, startObjectPos, initialAngle, startRotation, initialDist, startScale } = useWhiteboardStore.getState().transformState;
        const target = useWhiteboardStore.getState().selectedObject;

        if (mode === TransformMode.NONE || !target) return;

        switch (mode) {
            case TransformMode.DRAG: {
                const dx = e.global.x - startPos.x;
                const dy = e.global.y - startPos.y;
                target.x = startObjectPos.x + dx;
                target.y = startObjectPos.y + dy;
                updateTransformer();
                break;
            }
            case TransformMode.ROTATE: {
                const globalCenter = target.getGlobalPosition();
                const currentAngle = Math.atan2(
                    e.global.y - globalCenter.y,
                    e.global.x - globalCenter.x
                );
                const delta = currentAngle - initialAngle;
                target.rotation = startRotation + delta;
                updateTransformer();
                break;
            }
            case TransformMode.SCALE: {
                const globalCenter = target.getGlobalPosition();
                const currentDist = Math.hypot(e.global.x - globalCenter.x, e.global.y - globalCenter.y);
                const ratio = currentDist / initialDist;
                target.scale.x = startScale.x * ratio;
                target.scale.y = startScale.y * ratio;
                updateTransformer();
                break;
            }
        }
    };

    const onGlobalUp = () => {
        // Sync final state to Store
        const { mode } = useWhiteboardStore.getState().transformState;
        const selected = useWhiteboardStore.getState().selectedObject;

        if (mode !== TransformMode.NONE && selected) {
            const id = (selected as any).nodeId;
            if (id) {
                updateNode(id, {
                    x: selected.x,
                    y: selected.y,
                    rotation: selected.rotation,
                    scale: { x: selected.scale.x, y: selected.scale.y }
                });
            }
        }

        updateTransformState({ mode: TransformMode.NONE });
    };

    // =========================================
    // Helper Methods
    // =========================================
    const setupInteractive = (obj: PIXI.Container) => {
        obj.eventMode = 'static';
        obj.cursor = 'pointer';
        obj.on('pointerdown', (e) => onObjectDown(e, obj));
    };

    // Clear selection filters when unselecting
    useEffect(() => {
        if (!selectedObject) {
            if (contentLayerRef.current) {
                contentLayerRef.current.children.forEach(c => {
                    if (c !== selectedObject) c.filters = [];
                });
            }
        }
    }, [selectedObject]);

    return {}; // No longer exposing addImage/addVideo
};
