import type { Side, TableModel } from "./types";
import { CHAIR_OFFSET } from "./constants";

export interface ChairPos {
  /** Local coords in meters, relative to table center, BEFORE table rotation. */
  x: number;
  y: number;
  /** Chair rotation in degrees (so a square chair faces the table). */
  rotation: number;
}

const RECT_SIDES: Side[] = ["top", "right", "bottom", "left"];

/** Side lengths (meters) for a rect table, keyed by side. */
function sideLength(table: TableModel, side: Side): number {
  return side === "top" || side === "bottom" ? table.w : table.h;
}

function activeSides(table: TableModel): Side[] {
  return RECT_SIDES.filter((s) => !table.disabledSides.includes(s));
}

/** Active perimeter available for seating, in meters. */
export function activePerimeter(table: TableModel): number {
  if (table.shape === "ellipse") {
    const a = table.w / 2;
    const b = table.h / 2;
    // Ramanujan approximation of ellipse perimeter.
    return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  }
  return activeSides(table).reduce((sum, s) => sum + sideLength(table, s), 0);
}

/** Actual spacing between adjacent guests, meters. */
export function seatSpacing(table: TableModel): number {
  const n = Math.max(table.seatCount, 1);
  return activePerimeter(table) / n;
}

export function isTight(table: TableModel, minSpacing: number): boolean {
  if (table.seatCount <= 0) return false;
  return seatSpacing(table) < minSpacing - 1e-9;
}

export function maxComfortableSeats(table: TableModel, minSpacing: number): number {
  if (minSpacing <= 0) return table.seatCount;
  return Math.max(0, Math.floor(activePerimeter(table) / minSpacing));
}

/** Largest-remainder apportionment of `total` across positive `weights`. */
function apportion(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (w / sum) * total);
  const floors = raw.map((r) => Math.floor(r));
  let remaining = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((p, q) => q.frac - p.frac);
  for (let k = 0; k < order.length && remaining > 0; k++) {
    floors[order[k].i] += 1;
    remaining -= 1;
  }
  return floors;
}

const SIDE_ROTATION: Record<Side, number> = { top: 0, right: 90, bottom: 180, left: 270 };

/** Compute chair positions (local, unrotated) for a table. */
export function computeChairs(table: TableModel): ChairPos[] {
  const n = Math.max(0, Math.floor(table.seatCount));
  if (n === 0) return [];

  if (table.shape === "ellipse") {
    const rx = table.w / 2 + CHAIR_OFFSET;
    const ry = table.h / 2 + CHAIR_OFFSET;
    const chairs: ChairPos[] = [];
    for (let i = 0; i < n; i++) {
      // Start at top (−90°) and go clockwise.
      const theta = -Math.PI / 2 + (i / n) * 2 * Math.PI;
      chairs.push({
        x: rx * Math.cos(theta),
        y: ry * Math.sin(theta),
        rotation: (theta * 180) / Math.PI + 90,
      });
    }
    return chairs;
  }

  // Rectangle: spread seats across active sides proportional to side length.
  const sides = activeSides(table);
  if (sides.length === 0) return [];
  const counts = apportion(n, sides.map((s) => sideLength(table, s)));
  const hw = table.w / 2;
  const hh = table.h / 2;
  const chairs: ChairPos[] = [];

  sides.forEach((side, si) => {
    const k = counts[si];
    for (let i = 0; i < k; i++) {
      const frac = (i + 0.5) / k;
      let x = 0;
      let y = 0;
      switch (side) {
        case "top":
          x = -hw + frac * table.w;
          y = -hh - CHAIR_OFFSET;
          break;
        case "bottom":
          x = hw - frac * table.w;
          y = hh + CHAIR_OFFSET;
          break;
        case "left":
          x = -hw - CHAIR_OFFSET;
          y = hh - frac * table.h;
          break;
        case "right":
          x = hw + CHAIR_OFFSET;
          y = -hh + frac * table.h;
          break;
      }
      chairs.push({ x, y, rotation: SIDE_ROTATION[side] });
    }
  });

  return chairs;
}
