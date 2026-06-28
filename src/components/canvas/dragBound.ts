import type Konva from "konva";

interface Extents {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Build a Konva `dragBoundFunc` that clamps a node's centre within the venue walls.
 * Reads the stage transform live (via `getStage`) instead of closing over scale/pos, so
 * the bound function is stable across zoom/pan and doesn't force node re-renders.
 */
export function makeDragBound(
  getStage: () => Konva.Stage | null,
  extents: Extents,
  venueWidth: number,
  venueHeight: number,
  ppm: number,
) {
  return (absPos: { x: number; y: number }) => {
    const stage = getStage();
    if (!stage) return absPos;
    const sc = stage.scaleX() || 1;
    const px = stage.x();
    const py = stage.y();
    const minX = extents.left;
    const maxX = Math.max(extents.left, venueWidth - extents.right);
    const minY = extents.top;
    const maxY = Math.max(extents.top, venueHeight - extents.bottom);
    const mx = (absPos.x - px) / sc / ppm;
    const my = (absPos.y - py) / sc / ppm;
    const cx = Math.min(Math.max(minX, mx), maxX);
    const cy = Math.min(Math.max(minY, my), maxY);
    return { x: cx * ppm * sc + px, y: cy * ppm * sc + py };
  };
}
