import { create } from 'zustand';
import * as PIXI from 'pixi.js';

export enum TransformMode {
    NONE = 'none',
    DRAG = 'drag',
    SCALE = 'scale',
    ROTATE = 'rotate',
}

export interface TransformState {
    mode: TransformMode;
    startPos: { x: number; y: number };
    startScale: { x: number; y: number };
    startRotation: number;
    initialDist: number;
    initialAngle: number;
    startObjectPos: { x: number; y: number };
}

interface WhiteboardState {
    // Current Selection & Interaction State
    selectedObject: PIXI.Container | null;
    transformState: TransformState;

    // Actions
    setSelectedObject: (obj: PIXI.Container | null) => void;
    setTransformMode: (mode: TransformMode) => void;
    updateTransformState: (updates: Partial<TransformState>) => void;
}

export const useWhiteboardStore = create<WhiteboardState>((set) => ({
    selectedObject: null,
    transformState: {
        mode: TransformMode.NONE,
        startPos: { x: 0, y: 0 },
        startScale: { x: 1, y: 1 },
        startRotation: 0,
        initialDist: 0,
        initialAngle: 0,
        startObjectPos: { x: 0, y: 0 },
    },

    setSelectedObject: (obj) => set({ selectedObject: obj }),
    setTransformMode: (mode) => set((state) => ({
        transformState: { ...state.transformState, mode }
    })),
    updateTransformState: (updates) => set((state) => ({
        transformState: { ...state.transformState, ...updates }
    })),
}));
