import type { PathPoint, Side, TableModel } from "./types";
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

/** Sides available for seating: not user-disabled and not blocked by a welded neighbour. */
function activeSides(table: TableModel, extra: Side[] = []): Side[] {
  return RECT_SIDES.filter((s) => !table.disabledSides.includes(s) && !extra.includes(s));
}

/** Active perimeter available for seating, in meters. `extra` = sides blocked by a weld. */
export function activePerimeter(table: TableModel, extra: Side[] = []): number {
  if (table.shape === "ellipse") {
    const a = table.w / 2;
    const b = table.h / 2;
    // Ramanujan approximation of ellipse perimeter.
    return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  }
  return activeSides(table, extra).reduce((sum, s) => sum + sideLength(table, s), 0);
}

/** Actual spacing between adjacent guests, meters. */
export function seatSpacing(table: TableModel, extra: Side[] = []): number {
  const n = Math.max(table.seatCount, 1);
  return activePerimeter(table, extra) / n;
}

export function isTight(table: TableModel, minSpacing: number, extra: Side[] = []): boolean {
  if (table.seatCount <= 0) return false;
  return seatSpacing(table, extra) < minSpacing - 1e-9;
}

export function maxComfortableSeats(table: TableModel, minSpacing: number, extra: Side[] = []): number {
  if (minSpacing <= 0) return table.seatCount;
  return Math.max(0, Math.floor(activePerimeter(table, extra) / minSpacing));
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
  if (table.shape === "snake" && table.path && table.path.length >= 2) {
    const dense = snakeCenterline(table.path);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of dense) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const pad = table.h / 2 + CHAIR_OFFSET + CHAIR_RADIUS;
    return { rx: Math.max(maxX, -minX) + pad, ry: Math.max(maxY, -minY) + pad };
  }
  const pad = CHAIR_OFFSET + CHAIR_RADIUS;
  return { rx: table.w / 2 + pad, ry: table.h / 2 + pad };
}

/** Snake centreline sampled in world coords (honours position + rotation). */
function snakeWorldPoints(table: TableModel): { x: number; y: number }[] {
  if (table.shape !== "snake" || !table.path || table.path.length < 2) return [{ x: table.x, y: table.y }];
  const rad = (table.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return snakeCenterline(table.path).map((p) => ({
    x: table.x + p.x * cos - p.y * sin,
    y: table.y + p.x * sin + p.y * cos,
  }));
}

/** Distance from a point to a box with per-side extents (left/right/top/bottom). */
function distToBox(px: number, py: number, cx: number, cy: number, w: WallExtents): number {
  const dx = px < cx ? Math.max(cx - w.left - px, 0) : Math.max(px - (cx + w.right), 0);
  const dy = py < cy ? Math.max(cy - w.top - py, 0) : Math.max(py - (cy + w.bottom), 0);
  return Math.hypot(dx, dy);
}

/** A snake band's perpendicular seating reach (band half + chair ring), meters. */
function snakeReach(table: TableModel): number {
  return table.h / 2 + CHAIR_OFFSET + CHAIR_RADIUS;
}

/**
 * Gap between two tables' seating zones, meters. Measured from the chairs — but where
 * a facing side is disabled, `tableWallExtents` reserves no chair pad there, so the
 * gap is measured from the bare table edge instead. Band-aware for snakes.
 */
function tableGap(a: TableModel, b: TableModel): number {
  if (a.shape === "snake" && b.shape === "snake") {
    const ap = snakeWorldPoints(a);
    const bp = snakeWorldPoints(b);
    let min = Infinity;
    for (const p of ap) for (const q of bp) min = Math.min(min, Math.hypot(p.x - q.x, p.y - q.y));
    return min - snakeReach(a) - snakeReach(b);
  }
  if (a.shape === "snake" || b.shape === "snake") {
    const snake = a.shape === "snake" ? a : b;
    const other = a.shape === "snake" ? b : a;
    const w = tableWallExtents(other); // per-side chair reach (none on disabled sides)
    let min = Infinity;
    for (const p of snakeWorldPoints(snake)) min = Math.min(min, distToBox(p.x, p.y, other.x, other.y, w));
    return min - snakeReach(snake);
  }
  // Rect/ellipse pair: directional chair-box gap (honours disabled sides + rotation).
  const wa = tableWallExtents(a);
  const wb = tableWallExtents(b);
  const ax = a.x < b.x ? wa.right : wa.left;
  const bx = a.x < b.x ? wb.left : wb.right;
  const ay = a.y < b.y ? wa.bottom : wa.top;
  const by = a.y < b.y ? wb.top : wb.bottom;
  return Math.max(Math.abs(a.x - b.x) - ax - bx, Math.abs(a.y - b.y) - ay - by);
}

/**
 * IDs of tables whose chair zones are closer than `clearance` to a neighbour —
 * i.e. there isn't enough room to sit down or walk between them. Band-aware for
 * snakes (measured from the centreline), axis-aligned heuristic for rect/ellipse.
 */
export function tooCloseTables(tables: TableModel[], clearance = AISLE_CLEARANCE): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const a = tables[i];
      const b = tables[j];
      if (a.groupId && a.groupId === b.groupId) continue; // welded — meant to touch
      if (tableGap(a, b) < clearance) {
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

/** Directional footprint extents from the center, in world axes. */
export interface WallExtents {
  left: number; // toward −x
  right: number; // toward +x
  top: number; // toward −y
  bottom: number; // toward +y
}

/** Extents of a w×h box (half-sizes hw/hh) with per-side margins, rotated by `deg`. */
function rotatedExtents(
  hw: number,
  hh: number,
  ml: number,
  mr: number,
  mt: number,
  mb: number,
  deg: number,
): WallExtents {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const corners: Array<[number, number]> = [
    [-(hw + ml), -(hh + mt)],
    [hw + mr, -(hh + mt)],
    [hw + mr, hh + mb],
    [-(hw + ml), hh + mb],
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of corners) {
    const wx = x * cos - y * sin;
    const wy = x * sin + y * cos;
    minX = Math.min(minX, wx);
    maxX = Math.max(maxX, wx);
    minY = Math.min(minY, wy);
    maxY = Math.max(maxY, wy);
  }
  return { left: -minX, right: maxX, top: -minY, bottom: maxY };
}

/**
 * Footprint extents (incl. the chair ring) of a table for wall clamping. Unlike the
 * symmetric `tableOuterExtent`, this honours the table's rotation AND only reserves
 * chair space on sides that actually have seats — so a chairless side can touch the wall.
 */
export function tableWallExtents(table: TableModel): WallExtents {
  const pad = CHAIR_OFFSET + CHAIR_RADIUS;
  if (table.shape === "snake") {
    const e = tableOuterExtent(table); // path-based, already padded
    return { left: e.rx, right: e.rx, top: e.ry, bottom: e.ry };
  }
  if (table.shape === "ellipse") {
    return rotatedExtents(table.w / 2, table.h / 2, pad, pad, pad, pad, table.rotation);
  }
  const m = (side: Side) => (table.disabledSides.includes(side) ? 0 : pad);
  return rotatedExtents(table.w / 2, table.h / 2, m("left"), m("right"), m("top"), m("bottom"), table.rotation);
}

/** Footprint extents of a (chairless) scene object, honouring its rotation. */
export function objectWallExtents(obj: { w: number; h: number; rotation: number }): WallExtents {
  return rotatedExtents(obj.w / 2, obj.h / 2, 0, 0, 0, 0, obj.rotation);
}

/**
 * Reduce an angle (deg) to the readable range [-90, 90) in 180° steps — used to keep
 * labels upright on rotated shapes (e.g. 90° → -90°, 180° / -180° → 0°).
 */
export function readableAngle(deg: number): number {
  const r = ((((deg + 90) % 180) + 180) % 180) - 90;
  return r;
}

/** Clamp a center so a footprint spanning [loExtent, hiExtent] stays inside [0, size]. */
export function clampWithExtents(center: number, loExtent: number, hiExtent: number, size: number): number {
  const lo = loExtent;
  const hi = Math.max(lo, size - hiExtent);
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

/** Compute chair positions (local, unrotated) for a table. `extra` = sides blocked by a weld. */
export function computeChairs(table: TableModel, extra: Side[] = []): ChairPos[] {
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
  const sides = activeSides(table, extra);
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

// ─── Welding (joining tables edge-to-edge) ───────────────────────────────────

/** Max perpendicular gap (m) at which a dragged table snaps/welds to a neighbour. */
export const WELD_SNAP = 0.3;
/** Tolerance (m) for treating an existing edge pair as "welded" (seats hidden there). */
const WELD_TOL = 0.18;
/** Minimum along-edge overlap (m) for two edges to count as joined. */
const WELD_MIN_OVERLAP = 0.2;

const norm360 = (deg: number) => ((deg % 360) + 360) % 360;

/** Rotate a vector by `deg` degrees. */
function rot(x: number, y: number, deg: number): { x: number; y: number } {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: x * c - y * s, y: x * s + y * c };
}

/** True when `deg` is a multiple of 90° (so two rect edges stay axis-aligned in each other's frame). */
function isQuarterTurn(deg: number): boolean {
  const d = norm360(deg);
  return d < 1 || Math.abs(d - 90) < 1 || Math.abs(d - 180) < 1 || Math.abs(d - 270) < 1;
}

/** Rect tables can weld when their orientations differ by a multiple of 90° (parallel or perpendicular). */
export function canWeld(a: TableModel, b: TableModel): boolean {
  return a.shape === "rect" && b.shape === "rect" && isQuarterTurn(a.rotation - b.rotation);
}

/** Half-extents along x/y of a rect table seen from a frame rotated by `relDeg` (0/90/180/270). */
function halfExtents(table: TableModel, relDeg: number): { hw: number; hh: number } {
  const d = norm360(relDeg);
  const perpendicular = Math.abs(d - 90) < 1 || Math.abs(d - 270) < 1;
  return perpendicular ? { hw: table.h / 2, hh: table.w / 2 } : { hw: table.w / 2, hh: table.h / 2 };
}

/**
 * Sides of `table` that are joined to a same-group neighbour (so they should carry no chairs).
 * `group` is the list of weld-group members (may include `table` itself).
 */
export function weldedSidesFor(table: TableModel, group: TableModel[]): Side[] {
  const out = new Set<Side>();
  for (const n of group) {
    if (n.id === table.id || !canWeld(table, n)) continue;
    // Neighbour centre in `table`'s local (unrotated) frame.
    const d = rot(n.x - table.x, n.y - table.y, -table.rotation);
    const { hw: nhw, hh: nhh } = halfExtents(n, n.rotation - table.rotation);
    const sumX = table.w / 2 + nhw;
    const sumY = table.h / 2 + nhh;
    const overlapAlongY = Math.abs(d.y) < sumY - WELD_MIN_OVERLAP; // for left/right edges
    const overlapAlongX = Math.abs(d.x) < sumX - WELD_MIN_OVERLAP; // for top/bottom edges
    if (Math.abs(d.x - sumX) <= WELD_TOL && overlapAlongY) out.add("right");
    else if (Math.abs(d.x + sumX) <= WELD_TOL && overlapAlongY) out.add("left");
    else if (Math.abs(d.y - sumY) <= WELD_TOL && overlapAlongX) out.add("bottom");
    else if (Math.abs(d.y + sumY) <= WELD_TOL && overlapAlongX) out.add("top");
  }
  return [...out];
}

export interface WeldSnap {
  neighborId: string;
  x: number;
  y: number;
}

/**
 * Find the best edge of a candidate neighbour to snap a dragged rect table flush against.
 * Returns the snapped centre (meters) + neighbour id, or null if nothing is close enough.
 */
export function findWeldSnap(
  dragged: TableModel,
  x: number,
  y: number,
  candidates: TableModel[],
): WeldSnap | null {
  if (dragged.shape !== "rect") return null;
  let best: (WeldSnap & { dist: number }) | null = null;
  for (const n of candidates) {
    if (n.id === dragged.id || !canWeld(dragged, n)) continue;
    // Dragged centre in neighbour's local frame.
    const d = rot(x - n.x, y - n.y, -n.rotation);
    const { hw: dhw, hh: dhh } = halfExtents(dragged, dragged.rotation - n.rotation);
    const sumX = n.w / 2 + dhw;
    const sumY = n.h / 2 + dhh;
    const options = [
      { lx: sumX, ly: d.y, perp: Math.abs(d.x - sumX), overlap: Math.abs(d.y) < sumY - WELD_MIN_OVERLAP },
      { lx: -sumX, ly: d.y, perp: Math.abs(d.x + sumX), overlap: Math.abs(d.y) < sumY - WELD_MIN_OVERLAP },
      { lx: d.x, ly: sumY, perp: Math.abs(d.y - sumY), overlap: Math.abs(d.x) < sumX - WELD_MIN_OVERLAP },
      { lx: d.x, ly: -sumY, perp: Math.abs(d.y + sumY), overlap: Math.abs(d.x) < sumX - WELD_MIN_OVERLAP },
    ];
    for (const o of options) {
      if (!o.overlap || o.perp > WELD_SNAP) continue;
      const w = rot(o.lx, o.ly, n.rotation); // back to world
      const snap = {
        neighborId: n.id,
        x: Number((n.x + w.x).toFixed(3)),
        y: Number((n.y + w.y).toFixed(3)),
        dist: o.perp,
      };
      if (!best || snap.dist < best.dist) best = snap;
    }
  }
  return best ? { neighborId: best.neighborId, x: best.x, y: best.y } : null;
}

// ─── Snake table (serpentine, spline through nodes) ──────────────────────────

/** Samples per segment for the Catmull-Rom centreline. */
const SNAKE_SAMPLES = 18;

function catmull(p0: PathPoint, p1: PathPoint, p2: PathPoint, p3: PathPoint, t: number): PathPoint {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/** Dense polyline along the Catmull-Rom spline through `path` (local meters). */
export function snakeCenterline(path: PathPoint[], perSeg = SNAKE_SAMPLES): PathPoint[] {
  if (path.length < 2) return path.slice();
  const out: PathPoint[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[i - 1] ?? path[i];
    const p1 = path[i];
    const p2 = path[i + 1];
    const p3 = path[i + 2] ?? path[i + 1];
    for (let s = 0; s < perSeg; s++) out.push(catmull(p0, p1, p2, p3, s / perSeg));
  }
  out.push(path[path.length - 1]);
  return out;
}

function cumulative(dense: PathPoint[]): number[] {
  const cum = [0];
  for (let i = 1; i < dense.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
  }
  return cum;
}

/** Total centreline length (meters). */
export function snakeLength(path: PathPoint[]): number {
  if (path.length < 2) return 0;
  const cum = cumulative(snakeCenterline(path));
  return cum[cum.length - 1];
}

/** Re-centre the path on its bounding box; returns the centred path + the centre shift (meters). */
export function normalizeSnakePath(path: PathPoint[]): { path: PathPoint[]; dx: number; dy: number } {
  if (path.length < 2) return { path, dx: 0, dy: 0 };
  const dense = snakeCenterline(path);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of dense) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { path: path.map((p) => ({ x: p.x - cx, y: p.y - cy })), dx: cx, dy: cy };
}

/** Insert a node on the segment nearest to `at` (local meters). */
export function insertSnakeNode(path: PathPoint[], at: PathPoint): PathPoint[] {
  if (path.length < 2) return [...path, at];
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = pointSegDist(at, path[i], path[i + 1]);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  const np = path.slice();
  np.splice(bestI + 1, 0, at);
  return np;
}

function pointSegDist(p: PathPoint, a: PathPoint, b: PathPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1e-9;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** World position of every chair across `tables` (handles rect, ellipse, snake, welds). */
export function seatWorldPositions(tables: TableModel[]): { tableId: string; index: number; x: number; y: number }[] {
  const groups = new Map<string, TableModel[]>();
  for (const t of tables) {
    if (!t.groupId) continue;
    const arr = groups.get(t.groupId);
    if (arr) arr.push(t);
    else groups.set(t.groupId, [t]);
  }
  const out: { tableId: string; index: number; x: number; y: number }[] = [];
  for (const t of tables) {
    const welded = t.groupId ? weldedSidesFor(t, groups.get(t.groupId)!) : [];
    const local = t.shape === "snake" ? computeSnakeChairs(t) : computeChairs(t, welded);
    const rad = (t.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    for (let i = 0; i < local.length; i++) {
      out.push({
        tableId: t.id,
        index: i,
        x: t.x + local[i].x * cos - local[i].y * sin,
        y: t.y + local[i].x * sin + local[i].y * cos,
      });
    }
  }
  return out;
}

/**
 * Chairs for a snake table (local coords, relative to table centre).
 *
 * Each enabled side is treated as its own offset curve. Seats are spread evenly along
 * the *seatable* part of that curve (the inner corner of a tight bend is excluded), and
 * the total seat count is split between the two sides in proportion to their seatable
 * length — so the longer (outer) side of a bend gets more seats and nothing bunches up.
 */
export function computeSnakeChairs(table: TableModel): ChairPos[] {
  const path = table.path;
  if (!path || path.length < 2) return [];
  const total = Math.max(0, Math.floor(table.seatCount));
  if (total === 0) return [];
  const dense = snakeCenterline(path);
  const M = dense.length;
  if (M < 2) return [];
  const off = table.h / 2 + CHAIR_OFFSET;
  const innerLimit = off + 2 * CHAIR_RADIUS;

  // Unit tangent at each dense point.
  const tang = dense.map((_, i) => {
    const a = dense[Math.max(0, i - 1)];
    const b = dense[Math.min(M - 1, i + 1)];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    return { tx: tx / len, ty: ty / len };
  });
  // Local turn direction & radius of curvature at each point.
  const W = 4;
  const curv = dense.map((_, i) => {
    const a = tang[Math.max(0, i - W)];
    const b = tang[Math.min(M - 1, i + W)];
    const dth = Math.atan2(a.tx * b.ty - a.ty * b.tx, a.tx * b.tx + a.ty * b.ty);
    let ds = 0;
    for (let j = Math.max(0, i - W); j < Math.min(M - 1, i + W); j++) {
      ds += Math.hypot(dense[j + 1].x - dense[j].x, dense[j + 1].y - dense[j].y);
    }
    const radius = Math.abs(dth) > 1e-4 ? ds / Math.abs(dth) : Infinity;
    return { turn: Math.sign(dth), radius };
  });

  // Seat around the WHOLE band outline like a round table: walk one long side forward,
  // round the end cap, back along the other long side, round the start cap — a closed
  // loop — then drop seats at even arc-length spacing along the seatable parts. Inner
  // corner folds stay unseatable (our snake-specific quirk).
  interface CPt {
    x: number;
    y: number;
    rot: number;
    valid: boolean;
  }
  const contour: CPt[] = [];

  const pushSide = (i: number, sign: number) => {
    const nx = tang[i].ty * sign;
    const ny = -tang[i].tx * sign;
    const concave = sign * curv[i].turn < 0;
    const valid = !(concave && curv[i].radius < innerLimit); // inner-corner fold → unseatable
    contour.push({
      x: dense[i].x + nx * off,
      y: dense[i].y + ny * off,
      rot: (Math.atan2(ny, nx) * 180) / Math.PI + 90,
      valid,
    });
  };

  // Half-circle cap around dense[idx] sweeping +π from a0; endpoints skipped (the
  // adjacent long sides already supply them).
  const pushCap = (idx: number, a0: number) => {
    const STEPS = 8;
    for (let s = 1; s < STEPS; s++) {
      const th = a0 + (Math.PI * s) / STEPS;
      contour.push({
        x: dense[idx].x + Math.cos(th) * off,
        y: dense[idx].y + Math.sin(th) * off,
        rot: (th * 180) / Math.PI + 90,
        valid: true,
      });
    }
  };

  const normAngle = (i: number, sign: number) => Math.atan2(-tang[i].tx * sign, tang[i].ty * sign);

  for (let i = 0; i < M; i++) pushSide(i, 1); // one long side, forward
  pushCap(M - 1, normAngle(M - 1, 1)); // end cap
  for (let i = M - 1; i >= 0; i--) pushSide(i, -1); // other long side, back
  pushCap(0, normAngle(0, -1)); // start cap

  // Seatable segments around the closed loop (wrapping last → first).
  interface Seg {
    i0: number;
    i1: number;
    startArc: number;
    len: number;
  }
  const N = contour.length;
  const seg: Seg[] = [];
  let validLen = 0;
  for (let i = 0; i < N; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % N];
    if (a.valid && b.valid) {
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      seg.push({ i0: i, i1: (i + 1) % N, startArc: validLen, len });
      validLen += len;
    }
  }
  if (validLen <= 0 || seg.length === 0) return [];

  const chairs: ChairPos[] = [];
  for (let i = 0; i < total; i++) {
    const target = ((i + 0.5) / total) * validLen;
    let s = seg[seg.length - 1];
    for (const cand of seg) {
      if (target <= cand.startArc + cand.len) {
        s = cand;
        break;
      }
    }
    const f = s.len > 1e-9 ? (target - s.startArc) / s.len : 0;
    const a = contour[s.i0];
    const b = contour[s.i1];
    chairs.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, rotation: a.rot });
  }
  return chairs;
}
