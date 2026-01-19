import { create } from 'zustand';

export interface WhiteboardNode {
    id: string;
    type: 'image' | 'video';
    url: string;
    x: number;
    y: number;
    rotation: number;
    scale: { x: number; y: number };
}

interface NodeState {
    nodes: Record<string, WhiteboardNode>;
    nodeOrder: string[];

    addNode: (node: WhiteboardNode) => void;
    updateNode: (id: string, updates: Partial<WhiteboardNode>) => void;
    removeNode: (id: string) => void;
}

export const useNodeStore = create<NodeState>((set) => ({
    nodes: {},
    nodeOrder: [],

    addNode: (node) => set((state) => ({
        nodes: { ...state.nodes, [node.id]: node },
        nodeOrder: [...state.nodeOrder, node.id]
    })),
    updateNode: (id, updates) => set((state) => {
        const existing = state.nodes[id];
        if (!existing) return state;
        return {
            nodes: { ...state.nodes, [id]: { ...existing, ...updates } }
        };
    }),
    removeNode: (id) => set((state) => {
        const { [id]: _, ...rest } = state.nodes;
        return {
            nodes: rest,
            nodeOrder: state.nodeOrder.filter(nid => nid !== id)
        };
    })
}));
