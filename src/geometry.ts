import type { Side, TableModel } from "./types";
import { CHAIR_OFFSET, CHAIR_RADIUS } from "./constants";

/** Clearance (meters) needed between two tables' chair rings to sit down / pass. */
export const AISLE_CLEARANCE = 0.45;

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

/** Half-extent of a table including its chair ring, meters (axis-aligned approx). */
export function tableOuterExtent(table: TableModel): { rx: number; ry: number } {
  const pad = CHAIR_OFFSET + CHAIR_RADIUS;
  return { rx: table.w / 2 + pad, ry: table.h / 2 + pad };
}

/**
 * IDs of tables whose chair zones are closer than `clearance` to a neighbour —
 * i.e. there isn't enough room to sit down or walk between them.
 * Axis-aligned approximation (ignores rotation) — enough for an MVP warning.
 */
export function tooCloseTables(tables: TableModel[], clearance = AISLE_CLEARANCE): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const a = tables[i];
      const b = tables[j];
      const ea = tableOuterExtent(a);
      const eb = tableOuterExtent(b);
      if (
        Math.abs(a.x - b.x) < ea.rx + eb.rx + clearance &&
        Math.abs(a.y - b.y) < ea.ry + eb.ry + clearance
      ) {
        out.add(a.id);
        out.add(b.id);
      }
    }
  }
  return out;
}

/** Clamp a table center coordinate so the table + its chair ring stays inside the wall. */
export function clampTableCenter(center: number, halfExtent: number, venueSize: number): number {
  const lo = halfExtent;
  const hi = Math.max(lo, venueSize - halfExtent);
  return Math.min(Math.max(lo, center), hi);
}

/** Whether a table (with its chair ring) can physically fit inside a venue of w×h. */
export function tableFitsVenue(table: TableModel, w: number, h: number): boolean {
  const e = tableOuterExtent(table);
  return 2 * e.rx <= w + 1e-6 && 2 * e.ry <= h + 1e-6;
}

/** Numbers of tables that would not fit inside a venue of w×h. */
export function tablesThatDontFit(tables: TableModel[], w: number, h: number): number[] {
  return tables.filter((t) => !tableFitsVenue(t, w, h)).map((t) => t.number);
}

interface Rectish {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Do two table footprints overlap (axis-aligned, optional extra gap)? Touching edges is OK. */
export function tablesOverlap(a: Rectish, b: Rectish, gap = 0): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap - 1e-6 &&
    Math.abs(a.y - b.y) < (a.h + b.h) / 2 + gap - 1e-6
  );
}

/**
 * Find a position for a w×h table that is inside the walls and does not overlap any
 * existing table. Tries `preferred` first, then scans a grid; falls back to clamped preferred.
 */
export function findFreeSpot(
  existing: TableModel[],
  w: number,
  h: number,
  venue: { width: number; height: number },
  preferred?: { x: number; y: number },
): { x: number; y: number } {
  const ex = w / 2 + CHAIR_OFFSET + CHAIR_RADIUS;
  const ey = h / 2 + CHAIR_OFFSET + CHAIR_RADIUS;
  const round = (v: number) => Number(v.toFixed(3));
  const free = (x: number, y: number) => !existing.some((t) => tablesOverlap(t, { x, y, w, h }));

  if (preferred) {
    const px = clampTableCenter(preferred.x, ex, venue.width);
    const py = clampTableCenter(preferred.y, ey, venue.height);
    if (free(px, py)) return { x: round(px), y: round(py) };
  }
  const step = 0.5;
  for (let y = ey; y <= venue.height - ey + 1e-6; y += step) {
    for (let x = ex; x <= venue.width - ex + 1e-6; x += step) {
      if (free(x, y)) return { x: round(x), y: round(y) };
    }
  }
  return {
    x: round(clampTableCenter(preferred?.x ?? venue.width / 2, ex, venue.width)),
    y: round(clampTableCenter(preferred?.y ?? venue.height / 2, ey, venue.height)),
  };
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
