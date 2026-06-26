import { test } from "node:test";
import assert from "node:assert/strict";
import type { PathPoint, TableModel } from "./types";
import {
  canWeld,
  findWeldSnap,
  weldedSidesFor,
  snakeLength,
  normalizeSnakePath,
  insertSnakeNode,
  computeSnakeChairs,
  tableOuterExtent,
} from "./geometry";

function rect(over: Partial<TableModel> = {}): TableModel {
  return {
    id: "t",
    number: 1,
    name: "",
    shape: "rect",
    x: 0,
    y: 0,
    w: 1.8,
    h: 0.8,
    rotation: 0,
    seatCount: 0,
    isPodium: false,
    chairStyle: null,
    disabledSides: [],
    locked: false,
    groupId: null,
    ...over,
  };
}

// ─── Welding ──────────────────────────────────────────────────────────────

test("canWeld: same orientation rect pair", () => {
  assert.equal(canWeld(rect(), rect()), true);
});

test("canWeld: perpendicular (90°) is allowed", () => {
  assert.equal(canWeld(rect(), rect({ rotation: 90 })), true);
});

test("canWeld: arbitrary angle (45°) is rejected", () => {
  assert.equal(canWeld(rect(), rect({ rotation: 45 })), false);
});

test("canWeld: non-rectangular is rejected", () => {
  assert.equal(canWeld(rect(), rect({ shape: "ellipse" })), false);
});

test("findWeldSnap: snaps flush to a same-orientation neighbour edge", () => {
  const n = rect({ id: "n", x: 2, y: 2 });
  const d = rect({ id: "d", x: 3.7, y: 2.05 });
  const s = findWeldSnap(d, d.x, d.y, [n]);
  assert.ok(s, "expected a snap");
  assert.equal(s.neighborId, "n");
  assert.ok(Math.abs(s.x - 3.8) < 0.02, `x=${s.x} (expected ~3.8)`); // 2 + (0.9 + 0.9)
  assert.ok(Math.abs(s.y - 2.05) < 0.02, `y=${s.y}`);
});

test("findWeldSnap: perpendicular long-edge ↔ short-edge", () => {
  const n = rect({ id: "n", x: 2, y: 2 });
  const d = rect({ id: "d", rotation: 90, x: 3.2, y: 2.1 });
  const s = findWeldSnap(d, d.x, d.y, [n]);
  assert.ok(s, "a 90°-rotated table should weld to a long edge");
  assert.ok(Math.abs(s.x - 3.3) < 0.02, `x=${s.x} (expected ~3.3)`); // 2 + (0.9 + 0.4)
});

test("findWeldSnap: too far → null", () => {
  const n = rect({ id: "n", x: 2, y: 2 });
  const d = rect({ id: "d", x: 4.6, y: 2 });
  assert.equal(findWeldSnap(d, d.x, d.y, [n]), null);
});

test("findWeldSnap: arbitrary angle → null", () => {
  const n = rect({ id: "n", x: 2, y: 2 });
  const d = rect({ id: "d", rotation: 45, x: 3.3, y: 2 });
  assert.equal(findWeldSnap(d, d.x, d.y, [n]), null);
});

test("weldedSidesFor: flush neighbour blocks the touching side only", () => {
  const a = rect({ id: "a", x: 2, y: 2, groupId: "g" });
  const b = rect({ id: "b", x: 3.8, y: 2, groupId: "g" }); // flush to a's right edge
  assert.deepEqual(weldedSidesFor(a, [a, b]), ["right"]);
  assert.deepEqual(weldedSidesFor(b, [a, b]), ["left"]);
});

// ─── Snake ────────────────────────────────────────────────────────────────

const S: PathPoint[] = [
  { x: -2.4, y: -0.15 },
  { x: -0.8, y: 0.15 },
  { x: 0.8, y: -0.15 },
  { x: 2.4, y: 0.15 },
];

function snake(over: Partial<TableModel> = {}): TableModel {
  return rect({ shape: "snake", h: 0.9, seatCount: 14, path: S.map((p) => ({ ...p })), ...over });
}

function minChairGap(chairs: { x: number; y: number }[]): number {
  let min = Infinity;
  for (let i = 1; i < chairs.length; i++) {
    const g = Math.hypot(chairs[i].x - chairs[i - 1].x, chairs[i].y - chairs[i - 1].y);
    if (g > 0.05) min = Math.min(min, g); // skip the right→left side jump
  }
  return min;
}

test("snakeLength: positive for a real path", () => {
  assert.ok(snakeLength(S) > 4, `length=${snakeLength(S)}`);
});

test("normalizeSnakePath: reports the centre shift and is idempotent", () => {
  const moved = S.map((p) => ({ x: p.x + 1.5, y: p.y - 0.7 }));
  const { dx, dy, path } = normalizeSnakePath(moved);
  assert.ok(Math.abs(dx - 1.5) < 0.05 && Math.abs(dy + 0.7) < 0.05, `dx=${dx} dy=${dy}`);
  const again = normalizeSnakePath(path);
  assert.ok(Math.abs(again.dx) < 1e-6 && Math.abs(again.dy) < 1e-6, "re-normalising is a no-op");
});

test("insertSnakeNode: adds exactly one node", () => {
  assert.equal(insertSnakeNode(S, { x: 0, y: 0 }).length, S.length + 1);
});

test("computeSnakeChairs: gentle S seats ~ requested count on both sides", () => {
  const ch = computeSnakeChairs(snake({ seatCount: 14 }));
  assert.ok(ch.length >= 13 && ch.length <= 14, `got ${ch.length}`);
});

test("computeSnakeChairs: both sides disabled → no seats", () => {
  assert.equal(computeSnakeChairs(snake({ disabledSides: ["left", "right"] })).length, 0);
});

test("computeSnakeChairs: zero seatCount → no seats", () => {
  assert.equal(computeSnakeChairs(snake({ seatCount: 0 })).length, 0);
});

test("computeSnakeChairs: spacing stays comfortable even on a sharp bend", () => {
  const sharp: PathPoint[] = [
    { x: -2, y: 1.0 },
    { x: 0, y: -0.6 },
    { x: 2, y: 1.0 },
  ];
  const ch = computeSnakeChairs(snake({ path: sharp, seatCount: 14 }));
  assert.equal(ch.length, 14, "all seats placed (redistributed, not dropped)");
  assert.ok(minChairGap(ch) > 0.4, `bunched: minGap=${minChairGap(ch)}`);
});

test("tableOuterExtent: snake extent covers the whole band", () => {
  const e = tableOuterExtent(snake());
  assert.ok(e.rx > 3 && e.rx < 4.5, `rx=${e.rx}`);
  assert.ok(e.ry > 0.9, `ry=${e.ry}`);
});
