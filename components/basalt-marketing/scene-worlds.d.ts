import type { SceneKind } from './products';
export type ProjectedLabel = { id: string; text: string; x: number; y: number; opacity: number };
export type CoreRenderer = {
    render: (progress: number, time: number, reduced: boolean) => ProjectedLabel[];
    dispose: (releaseContext?: boolean) => void;
};
export function createWorldRenderer(canvas: HTMLCanvasElement, kind: SceneKind, accent: string): CoreRenderer | null;
