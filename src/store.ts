import { create } from "zustand";
import { useStore as useZustand } from "zustand";
import { persist } from "zustand/middleware";
import { temporal } from "zundo";
import type {
  ChairStyle,
  Guest,
  PathPoint,
  ProjectMeta,
  ProjectState,
  SceneObject,
  SceneObjectType,
  Settings,
  Sheet,
  TableModel,
  TableShape,
  Venue,
} from "./types";
import {
  CHAIR_OFFSET,
  CHAIR_RADIUS,
  OBJECT_PRESETS,
  SCHEMA_VERSION,
  createInitialState,
  createSheet,
  defaultSnakePath,
} from "./constants";
import {
  clampTableCenter,
  findFreeSpot,
  findWeldSnap,
  insertSnakeNode,
  normalizeSnakePath,
  tableOuterExtent,
} from "./geometry";

const STORAGE_KEY = "seating-planner:v1";

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: never[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

const clampAxis = (center: number, size: number, max: number) => {
  const lo = size / 2;
  const hi = Math.max(lo, max - size / 2);
  return Math.min(Math.max(lo, center), hi);
};

function clampCenter(center: number, size: number, max: number): number {
  const ext = size / 2 + CHAIR_OFFSET + CHAIR_RADIUS;
  const lo = ext;
  const hi = Math.max(lo, max - ext);
  return Math.min(Math.max(lo, center), hi);
}

/** The currently active hall (sheet) — single source of truth for the editor. */
export function activeSheet(s: { sheets: Sheet[]; activeSheetId: string }): Sheet {
  return s.sheets.find((sh) => sh.id === s.activeSheetId) ?? s.sheets[0];
}

function patchActive(s: EditorState, patch: Partial<Sheet>): { sheets: Sheet[] } {
  return { sheets: s.sheets.map((sh) => (sh.id === s.activeSheetId ? { ...sh, ...patch } : sh)) };
}

/** Free the seats of any guests sitting at a table that's being removed. */
function clearGuestSeats(guests: Guest[], removedTableIds: Set<string>): Guest[] {
  return guests.map((g) => (g.seat && removedTableIds.has(g.seat.tableId) ? { ...g, seat: null } : g));
}

/** Coerce any persisted/imported guest into the current shape (drops removed roles/features). */
function normalizeGuest(raw: unknown): Guest {
  const g = (raw ?? {}) as Record<string, unknown>;
  const roles = ["groom", "bride", "witness", "parent", "guest"];
  const ages = ["adult", "child", "elderly"];
  const feats = ["pregnant", "wheelchair", "hardOfHearing"];
  const seat = g.seat as { tableId?: unknown; index?: unknown } | null | undefined;
  const sexRaw = g.sex ?? g.gender; // `gender` was the old field name
  return {
    id: typeof g.id === "string" ? g.id : crypto.randomUUID(),
    name: typeof g.name === "string" ? g.name : "",
    role: (roles.includes(g.role as string) ? g.role : "guest") as Guest["role"],
    ageCategory: (ages.includes(g.ageCategory as string) ? g.ageCategory : "adult") as Guest["ageCategory"],
    sex: sexRaw === "male" || sexRaw === "female" ? sexRaw : null,
    features: (Array.isArray(g.features) ? g.features.filter((f) => feats.includes(f)) : []) as Guest["features"],
    relation: typeof g.relation === "string" ? g.relation : "",
    seat:
      seat && typeof seat.tableId === "string" && typeof seat.index === "number"
        ? { tableId: seat.tableId, index: seat.index }
        : null,
  };
}

/** A weld group needs ≥2 members; clear groupId on any that are left alone. */
function dissolveSingletonGroups(tables: TableModel[]): TableModel[] {
  const counts = new Map<string, number>();
  for (const t of tables) if (t.groupId) counts.set(t.groupId, (counts.get(t.groupId) ?? 0) + 1);
  return tables.map((t) => (t.groupId && (counts.get(t.groupId) ?? 0) < 2 ? { ...t, groupId: null } : t));
}

/** Re-centre a snake's path, refresh its footprint width, and clamp inside the walls. */
function applyNormalizedSnake(sh: Sheet, tb: TableModel, newPath: PathPoint[]): TableModel[] {
  const { path, dx, dy } = normalizeSnakePath(newPath);
  const moved: TableModel = { ...tb, path };
  const e = tableOuterExtent(moved);
  // Keep `w` in sync with the actual band footprint (used by overlap / free-spot checks).
  const pad = tb.h / 2 + CHAIR_OFFSET + CHAIR_RADIUS;
  moved.w = Math.max(0.3, Number(((e.rx - pad) * 2 + tb.h).toFixed(2)));
  const nx = Number(clampTableCenter(tb.x + dx, e.rx, sh.venue.width).toFixed(3));
  const ny = Number(clampTableCenter(tb.y + dy, e.ry, sh.venue.height).toFixed(3));
  return sh.tables.map((x) => (x.id === tb.id ? { ...moved, x: nx, y: ny } : x));
}

export interface TableConfig {
  shape: TableShape;
  w: number;
  h: number;
  seatCount: number;
  chairStyle: ChairStyle | null;
  name?: string;
}

export interface ObjectConfig {
  type: SceneObjectType;
  w: number;
  h: number;
  label?: string;
}

type TableSnapshot = Omit<TableModel, "id" | "number">;

function nextFreeNumber(tables: TableModel[]): number {
  const used = new Set(tables.map((t) => t.number));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

function snapshotOf(tbl: TableModel): TableSnapshot {
  const { id: _id, number: _number, ...rest } = tbl;
  return { ...rest, disabledSides: [...rest.disabledSides] };
}

function makeTable(config: TableConfig, number: number, existing: TableModel[], venue: Venue): TableModel {
  const spot = findFreeSpot(existing, config.w, config.h, venue);
  return {
    id: crypto.randomUUID(),
    number,
    name: config.name ?? "",
    shape: config.shape,
    x: spot.x,
    y: spot.y,
    w: config.w,
    h: config.h,
    rotation: 0,
    seatCount: config.seatCount,
    isPodium: false,
    chairStyle: config.chairStyle,
    disabledSides: [],
    locked: false,
    groupId: null,
    path: config.shape === "snake" ? defaultSnakePath() : undefined,
  };
}

export interface EditorState extends ProjectState {
  selectedIds: string[];
  clipboard: TableSnapshot[] | null;
  /** Guest whose seat is highlighted on the canvas (transient UI, not persisted/undoable). */
  highlightGuestId: string | null;

  setProjectMeta: (patch: Partial<ProjectMeta>) => void;
  setVenue: (patch: Partial<Venue>) => void;
  setSettings: (patch: Partial<Settings>) => void;

  addGuest: (data: Omit<Guest, "id" | "seat">) => void;
  updateGuest: (id: string, patch: Partial<Guest>) => void;
  removeGuest: (id: string) => void;
  assignGuestToSeat: (guestId: string, tableId: string, index: number) => void;
  unassignGuest: (guestId: string) => void;
  setHighlightGuest: (id: string | null) => void;

  addSheet: () => void;
  setActiveSheet: (id: string) => void;
  renameSheet: (id: string, name: string) => void;
  removeSheet: (id: string) => void;

  addObject: (type: SceneObjectType) => void;
  addObjectsFrom: (config: ObjectConfig, count: number) => void;
  updateObject: (id: string, patch: Partial<SceneObject>) => void;
  updateObjects: (ids: string[], patch: Partial<SceneObject>) => void;
  removeObjects: (ids: string[]) => void;
  duplicateObjects: (ids: string[]) => void;

  addTablesFrom: (config: TableConfig, count: number) => void;
  updateTable: (id: string, patch: Partial<TableModel>) => void;
  updateTables: (ids: string[], patch: Partial<TableModel>) => void;
  setPositions: (list: { id: string; x: number; y: number }[]) => void;
  removeTable: (id: string) => void;
  removeTables: (ids: string[]) => void;
  duplicateTable: (id: string) => void;
  duplicateTables: (ids: string[]) => void;

  weldTables: (idA: string, idB: string, posA: { x: number; y: number }) => void;
  weldSelected: () => void;
  unweldSelected: () => void;

  moveSnakeNode: (id: string, index: number, x: number, y: number) => void;
  commitSnakeNode: (id: string) => void;
  addSnakeNode: (id: string, x: number, y: number) => void;
  addSnakeNodeEnd: (id: string) => void;
  setSnakeNodeCount: (id: string, count: number) => void;
  removeSnakeNode: (id: string, index: number) => void;
  removeSnakeNodeEnd: (id: string) => void;

  select: (id: string, additive?: boolean) => void;
  selectMany: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  rotateSelection: (deg: number) => void;
  toggleLockSelection: () => void;

  copySelected: () => void;
  pasteClipboard: (at?: { x: number; y: number }) => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  nudgeSelected: (dx: number, dy: number, big?: boolean) => void;

  loadDocument: (doc: ProjectState) => void;
  resetProject: () => void;
  getDocument: () => ProjectState;
}

export const useStore = create<EditorState>()(
  temporal(
    persist(
      (set, get) => ({
        ...createInitialState(),
        selectedIds: [],
        clipboard: null,
        highlightGuestId: null,

        setProjectMeta: (patch) => set((s) => ({ project: { ...s.project, ...patch } })),
        setVenue: (patch) => set((s) => patchActive(s, { venue: { ...activeSheet(s).venue, ...patch } })),
        setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

        addGuest: (data) =>
          set((s) => ({ guests: [...s.guests, { id: crypto.randomUUID(), seat: null, ...data }] })),
        updateGuest: (id, patch) =>
          set((s) => ({ guests: s.guests.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
        removeGuest: (id) => set((s) => ({ guests: s.guests.filter((g) => g.id !== id) })),
        assignGuestToSeat: (guestId, tableId, index) =>
          set((s) => {
            const mover = s.guests.find((g) => g.id === guestId);
            if (!mover) return {};
            const from = mover.seat; // the mover's previous seat (may be null)
            const sitting = s.guests.find(
              (g) => g.id !== guestId && g.seat && g.seat.tableId === tableId && g.seat.index === index,
            );
            return {
              guests: s.guests.map((g) => {
                if (g.id === guestId) return { ...g, seat: { tableId, index } };
                // Whoever was there swaps into the mover's old seat (or becomes unseated).
                if (sitting && g.id === sitting.id) return { ...g, seat: from };
                return g;
              }),
            };
          }),
        unassignGuest: (guestId) =>
          set((s) => ({ guests: s.guests.map((g) => (g.id === guestId ? { ...g, seat: null } : g)) })),
        setHighlightGuest: (id) => set({ highlightGuestId: id }),

        addSheet: () =>
          set((s) => {
            const sheet = createSheet("");
            return { sheets: [...s.sheets, sheet], activeSheetId: sheet.id, selectedIds: [] };
          }),
        setActiveSheet: (id) => set({ activeSheetId: id, selectedIds: [] }),
        renameSheet: (id, name) =>
          set((s) => ({ sheets: s.sheets.map((sh) => (sh.id === id ? { ...sh, name } : sh)) })),
        removeSheet: (id) =>
          set((s) => {
            if (s.sheets.length <= 1) return {};
            const idx = s.sheets.findIndex((sh) => sh.id === id);
            const sheets = s.sheets.filter((sh) => sh.id !== id);
            const activeSheetId =
              s.activeSheetId === id ? sheets[Math.max(0, idx - 1)].id : s.activeSheetId;
            return { sheets, activeSheetId, selectedIds: [] };
          }),

        addObject: (type) =>
          set((s) => {
            const sh = activeSheet(s);
            const preset = OBJECT_PRESETS.find((p) => p.type === type) ?? OBJECT_PRESETS[0];
            const obj: SceneObject = {
              id: crypto.randomUUID(),
              type,
              x: clampAxis(sh.venue.width / 2, preset.w, sh.venue.width),
              y: clampAxis(sh.venue.height / 2, preset.h, sh.venue.height),
              w: preset.w,
              h: preset.h,
              rotation: 0,
              label: "",
              locked: false,
            };
            return { ...patchActive(s, { objects: [...sh.objects, obj] }), selectedIds: [obj.id] };
          }),

        addObjectsFrom: (config, count) =>
          set((s) => {
            const sh = activeSheet(s);
            const objects = [...sh.objects];
            const newIds: string[] = [];
            for (let i = 0; i < Math.max(1, count); i++) {
              const stagger = (i % 6) * 0.4;
              const obj: SceneObject = {
                id: crypto.randomUUID(),
                type: config.type,
                x: clampAxis(sh.venue.width / 2 + stagger, config.w, sh.venue.width),
                y: clampAxis(sh.venue.height / 2 + stagger, config.h, sh.venue.height),
                w: config.w,
                h: config.h,
                rotation: 0,
                label: config.label ?? "",
                locked: false,
              };
              objects.push(obj);
              newIds.push(obj.id);
            }
            return { ...patchActive(s, { objects }), selectedIds: newIds };
          }),

        updateObject: (id, patch) =>
          set((s) =>
            patchActive(s, { objects: activeSheet(s).objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) }),
          ),

        updateObjects: (ids, patch) =>
          set((s) =>
            patchActive(s, {
              objects: activeSheet(s).objects.map((o) => (ids.includes(o.id) ? { ...o, ...patch } : o)),
            }),
          ),

        removeObjects: (ids) =>
          set((s) => {
            const sh = activeSheet(s);
            const removed = new Set(sh.objects.filter((o) => ids.includes(o.id) && !o.locked).map((o) => o.id));
            return {
              ...patchActive(s, { objects: sh.objects.filter((o) => !removed.has(o.id)) }),
              selectedIds: s.selectedIds.filter((id) => !removed.has(id)),
            };
          }),

        duplicateObjects: (ids) =>
          set((s) => {
            const sh = activeSheet(s);
            const sel = sh.objects.filter((o) => ids.includes(o.id));
            if (!sel.length) return {};
            const objects = [...sh.objects];
            const newIds: string[] = [];
            for (const src of sel) {
              const copy: SceneObject = {
                ...src,
                id: crypto.randomUUID(),
                locked: false,
                x: clampAxis(src.x + 0.4, src.w, sh.venue.width),
                y: clampAxis(src.y + 0.4, src.h, sh.venue.height),
              };
              objects.push(copy);
              newIds.push(copy.id);
            }
            return { ...patchActive(s, { objects }), selectedIds: newIds };
          }),

        addTablesFrom: (config, count) =>
          set((s) => {
            const sh = activeSheet(s);
            const tables = [...sh.tables];
            const newIds: string[] = [];
            for (let i = 0; i < Math.max(1, count); i++) {
              const t = makeTable(config, nextFreeNumber(tables), tables, sh.venue);
              tables.push(t);
              newIds.push(t.id);
            }
            return { ...patchActive(s, { tables }), selectedIds: newIds };
          }),

        updateTable: (id, patch) =>
          set((s) =>
            patchActive(s, { tables: activeSheet(s).tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
          ),

        updateTables: (ids, patch) =>
          set((s) =>
            patchActive(s, {
              tables: activeSheet(s).tables.map((t) => (ids.includes(t.id) ? { ...t, ...patch } : t)),
            }),
          ),

        setPositions: (list) =>
          set((s) => {
            const map = new Map(list.map((p) => [p.id, p]));
            return patchActive(s, {
              tables: activeSheet(s).tables.map((t) => {
                const p = map.get(t.id);
                return p ? { ...t, x: p.x, y: p.y } : t;
              }),
            });
          }),

        removeTable: (id) =>
          set((s) => ({
            ...patchActive(s, {
              tables: dissolveSingletonGroups(activeSheet(s).tables.filter((t) => t.id !== id)),
            }),
            guests: clearGuestSeats(s.guests, new Set([id])),
            selectedIds: s.selectedIds.filter((x) => x !== id),
          })),

        duplicateTable: (id) =>
          set((s) => {
            const sh = activeSheet(s);
            const src = sh.tables.find((t) => t.id === id);
            if (!src) return {};
            const spot = findFreeSpot(sh.tables, src.w, src.h, sh.venue, { x: src.x + 0.4, y: src.y + 0.4 });
            const copy: TableModel = {
              ...src,
              id: crypto.randomUUID(),
              number: nextFreeNumber(sh.tables),
              name: "",
              x: spot.x,
              y: spot.y,
              disabledSides: [...src.disabledSides],
              locked: false,
              groupId: null,
              path: src.path?.map((p) => ({ ...p })),
            };
            return { ...patchActive(s, { tables: [...sh.tables, copy] }), selectedIds: [copy.id] };
          }),

        removeTables: (ids) =>
          set((s) => {
            const sh = activeSheet(s);
            const removed = new Set(sh.tables.filter((t) => ids.includes(t.id) && !t.locked).map((t) => t.id));
            return {
              ...patchActive(s, {
                tables: dissolveSingletonGroups(sh.tables.filter((t) => !removed.has(t.id))),
              }),
              guests: clearGuestSeats(s.guests, removed),
              selectedIds: s.selectedIds.filter((id) => !removed.has(id)),
            };
          }),

        duplicateTables: (ids) =>
          set((s) => {
            const sh = activeSheet(s);
            const sel = sh.tables.filter((t) => ids.includes(t.id));
            if (!sel.length) return {};
            const tables = [...sh.tables];
            const newIds: string[] = [];
            for (const src of sel) {
              const spot = findFreeSpot(tables, src.w, src.h, sh.venue, { x: src.x + 0.4, y: src.y + 0.4 });
              tables.push({
                ...src,
                id: crypto.randomUUID(),
                number: nextFreeNumber(tables),
                name: "",
                x: spot.x,
                y: spot.y,
                disabledSides: [...src.disabledSides],
                locked: false,
                groupId: null,
                path: src.path?.map((p) => ({ ...p })),
              });
              newIds.push(tables[tables.length - 1].id);
            }
            return { ...patchActive(s, { tables }), selectedIds: newIds };
          }),

        weldTables: (idA, idB, posA) =>
          set((s) => {
            const sh = activeSheet(s);
            const a = sh.tables.find((t) => t.id === idA);
            const b = sh.tables.find((t) => t.id === idB);
            if (!a || !b) return {};
            const oldGroups = new Set([a.groupId, b.groupId].filter(Boolean) as string[]);
            const gid = a.groupId ?? b.groupId ?? crypto.randomUUID();
            const tables = sh.tables.map((t) => {
              if (t.id === idA) return { ...t, x: posA.x, y: posA.y, groupId: gid };
              if (t.id === idB || (t.groupId && oldGroups.has(t.groupId))) return { ...t, groupId: gid };
              return t;
            });
            return { ...patchActive(s, { tables }), selectedIds: [idA] };
          }),

        weldSelected: () =>
          set((s) => {
            const sh = activeSheet(s);
            const sel = sh.tables.filter((t) => s.selectedIds.includes(t.id) && t.shape === "rect" && !t.locked);
            if (sel.length < 2) return {};
            const tblMap = new Map(sel.map((t) => [t.id, t]));
            const pos = new Map(sel.map((t) => [t.id, { x: t.x, y: t.y }]));
            const adj = new Map<string, string[]>(sel.map((t) => [t.id, []]));
            for (let i = 0; i < sel.length; i++) {
              for (let j = i + 1; j < sel.length; j++) {
                const a = sel[i];
                const b = sel[j];
                if (findWeldSnap(a, a.x, a.y, [b])) {
                  adj.get(a.id)!.push(b.id);
                  adj.get(b.id)!.push(a.id);
                }
              }
            }
            const groupOf = new Map<string, string>();
            const visited = new Set<string>();
            for (const start of sel) {
              if (visited.has(start.id)) continue;
              const comp: string[] = [];
              const queue = [start.id];
              visited.add(start.id);
              while (queue.length) {
                const cur = queue.shift()!;
                comp.push(cur);
                for (const nb of adj.get(cur)!) if (!visited.has(nb)) (visited.add(nb), queue.push(nb));
              }
              if (comp.length < 2) continue;
              const gid = comp.map((id) => tblMap.get(id)!.groupId).find(Boolean) ?? crypto.randomUUID();
              const compSet = new Set(comp);
              // Snap each member flush against an already-placed neighbour (BFS from anchor).
              const placed = new Set<string>([comp[0]]);
              const q2 = [comp[0]];
              while (q2.length) {
                const cur = q2.shift()!;
                const curT = { ...tblMap.get(cur)!, ...pos.get(cur)! };
                for (const nb of adj.get(cur)!) {
                  if (placed.has(nb) || !compSet.has(nb)) continue;
                  const nbT = { ...tblMap.get(nb)!, ...pos.get(nb)! };
                  const snap = findWeldSnap(nbT, nbT.x, nbT.y, [curT]);
                  if (snap) pos.set(nb, { x: snap.x, y: snap.y });
                  placed.add(nb);
                  q2.push(nb);
                }
              }
              for (const id of comp) groupOf.set(id, gid);
            }
            if (groupOf.size === 0) return {};
            const tables = sh.tables.map((t) =>
              groupOf.has(t.id)
                ? { ...t, groupId: groupOf.get(t.id)!, x: pos.get(t.id)!.x, y: pos.get(t.id)!.y }
                : t,
            );
            return patchActive(s, { tables });
          }),

        unweldSelected: () =>
          set((s) => {
            const sh = activeSheet(s);
            const sel = new Set(s.selectedIds);
            const touched = new Set(
              sh.tables.filter((t) => sel.has(t.id) && t.groupId).map((t) => t.groupId as string),
            );
            if (!touched.size) return {};
            let tables = sh.tables.map((t) =>
              sel.has(t.id) && t.groupId && touched.has(t.groupId) ? { ...t, groupId: null } : t,
            );
            // Dissolve any group left with fewer than two members.
            const counts = new Map<string, number>();
            tables.forEach((t) => {
              if (t.groupId) counts.set(t.groupId, (counts.get(t.groupId) ?? 0) + 1);
            });
            tables = tables.map((t) => (t.groupId && (counts.get(t.groupId) ?? 0) < 2 ? { ...t, groupId: null } : t));
            return patchActive(s, { tables });
          }),

        moveSnakeNode: (id, index, x, y) =>
          set((s) =>
            patchActive(s, {
              tables: activeSheet(s).tables.map((tb) =>
                tb.id === id && tb.path
                  ? { ...tb, path: tb.path.map((p, i) => (i === index ? { x, y } : p)) }
                  : tb,
              ),
            }),
          ),

        commitSnakeNode: (id) =>
          set((s) => {
            const sh = activeSheet(s);
            const tb = sh.tables.find((x) => x.id === id);
            if (!tb || !tb.path) return {};
            return patchActive(s, { tables: applyNormalizedSnake(sh, tb, tb.path) });
          }),

        addSnakeNode: (id, x, y) =>
          set((s) => {
            const sh = activeSheet(s);
            const tb = sh.tables.find((x) => x.id === id);
            if (!tb || !tb.path) return {};
            return patchActive(s, { tables: applyNormalizedSnake(sh, tb, insertSnakeNode(tb.path, { x, y })) });
          }),

        addSnakeNodeEnd: (id) =>
          set((s) => {
            const sh = activeSheet(s);
            const tb = sh.tables.find((x) => x.id === id);
            if (!tb || !tb.path || tb.path.length < 2) return {};
            const p = tb.path;
            const last = p[p.length - 1];
            const prev = p[p.length - 2];
            const dx = last.x - prev.x;
            const dy = last.y - prev.y;
            const len = Math.hypot(dx, dy) || 1;
            const ext = 1.2; // meters beyond the last node
            const np = [...p, { x: last.x + (dx / len) * ext, y: last.y + (dy / len) * ext }];
            return patchActive(s, { tables: applyNormalizedSnake(sh, tb, np) });
          }),

        removeSnakeNode: (id, index) =>
          set((s) => {
            const sh = activeSheet(s);
            const tb = sh.tables.find((x) => x.id === id);
            if (!tb || !tb.path || tb.path.length <= 3) return {};
            return patchActive(s, {
              tables: applyNormalizedSnake(sh, tb, tb.path.filter((_, i) => i !== index)),
            });
          }),

        removeSnakeNodeEnd: (id) =>
          set((s) => {
            const sh = activeSheet(s);
            const tb = sh.tables.find((x) => x.id === id);
            if (!tb || !tb.path || tb.path.length <= 3) return {};
            return patchActive(s, { tables: applyNormalizedSnake(sh, tb, tb.path.slice(0, -1)) });
          }),

        setSnakeNodeCount: (id, count) =>
          set((s) => {
            const sh = activeSheet(s);
            const tb = sh.tables.find((x) => x.id === id);
            if (!tb || !tb.path || !Number.isFinite(count)) return {};
            const target = Math.max(3, Math.min(20, Math.floor(count)));
            let p = tb.path.slice();
            if (p.length === target) return {};
            while (p.length > target) p = p.slice(0, -1);
            while (p.length < target) {
              const last = p[p.length - 1];
              const prev = p[p.length - 2];
              const dx = last.x - prev.x;
              const dy = last.y - prev.y;
              const len = Math.hypot(dx, dy) || 1;
              p.push({ x: last.x + (dx / len) * 1.2, y: last.y + (dy / len) * 1.2 });
            }
            return patchActive(s, { tables: applyNormalizedSnake(sh, tb, p) });
          }),

        select: (id, additive = false) =>
          set((s) => {
            if (!additive) return { selectedIds: [id] };
            const has = s.selectedIds.includes(id);
            return { selectedIds: has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id] };
          }),
        selectMany: (ids) => set({ selectedIds: ids }),
        selectAll: () =>
          set((s) => {
            const sh = activeSheet(s);
            return { selectedIds: [...sh.tables.map((t) => t.id), ...sh.objects.map((o) => o.id)] };
          }),
        clearSelection: () => set({ selectedIds: [] }),

        rotateSelection: (deg) =>
          set((s) => {
            const sh = activeSheet(s);
            const sel = new Set(s.selectedIds);
            // Weld groups with at least one selected, unlocked member rotate rigidly.
            const groups = new Set<string>();
            for (const t of sh.tables) if (sel.has(t.id) && t.groupId && !t.locked) groups.add(t.groupId);
            const centroid = new Map<string, { cx: number; cy: number }>();
            for (const gid of groups) {
              const m = sh.tables.filter((t) => t.groupId === gid);
              centroid.set(gid, {
                cx: m.reduce((a, t) => a + t.x, 0) / m.length,
                cy: m.reduce((a, t) => a + t.y, 0) / m.length,
              });
            }
            const rad = (deg * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const r3 = (v: number) => Number(v.toFixed(3));
            let tables = sh.tables.map((t) => {
              if (t.locked) return t;
              if (t.groupId && groups.has(t.groupId)) {
                const { cx, cy } = centroid.get(t.groupId)!;
                return {
                  ...t,
                  x: r3(cx + (t.x - cx) * cos - (t.y - cy) * sin),
                  y: r3(cy + (t.x - cx) * sin + (t.y - cy) * cos),
                  rotation: (t.rotation + deg + 360) % 360,
                };
              }
              if (sel.has(t.id) && t.shape !== "snake") return { ...t, rotation: (t.rotation + deg + 360) % 360 };
              return t;
            });
            // Keep each rotated group inside the walls by shifting it as a whole.
            for (const gid of groups) {
              const m = tables.filter((t) => t.groupId === gid);
              let minX = Infinity;
              let minY = Infinity;
              let maxX = -Infinity;
              let maxY = -Infinity;
              for (const t of m) {
                const e = tableOuterExtent(t);
                minX = Math.min(minX, t.x - e.rx);
                maxX = Math.max(maxX, t.x + e.rx);
                minY = Math.min(minY, t.y - e.ry);
                maxY = Math.max(maxY, t.y + e.ry);
              }
              let dx = 0;
              let dy = 0;
              if (minX < 0) dx = -minX;
              else if (maxX > sh.venue.width) dx = sh.venue.width - maxX;
              if (minY < 0) dy = -minY;
              else if (maxY > sh.venue.height) dy = sh.venue.height - maxY;
              if (dx || dy)
                tables = tables.map((t) => (t.groupId === gid ? { ...t, x: r3(t.x + dx), y: r3(t.y + dy) } : t));
            }
            const objects = sh.objects.map((o) =>
              sel.has(o.id) && !o.locked ? { ...o, rotation: (o.rotation + deg + 360) % 360 } : o,
            );
            return patchActive(s, { tables, objects });
          }),

        toggleLockSelection: () =>
          set((s) => {
            const sh = activeSheet(s);
            const sel = [
              ...sh.tables.filter((t) => s.selectedIds.includes(t.id)),
              ...sh.objects.filter((o) => s.selectedIds.includes(o.id)),
            ];
            if (!sel.length) return {};
            const allLocked = sel.every((e) => e.locked);
            return patchActive(s, {
              tables: sh.tables.map((t) => (s.selectedIds.includes(t.id) ? { ...t, locked: !allLocked } : t)),
              objects: sh.objects.map((o) => (s.selectedIds.includes(o.id) ? { ...o, locked: !allLocked } : o)),
            });
          }),

        copySelected: () =>
          set((s) => {
            const snaps = activeSheet(s).tables.filter((t) => s.selectedIds.includes(t.id)).map(snapshotOf);
            return snaps.length ? { clipboard: snaps } : {};
          }),

        pasteClipboard: (at) =>
          set((s) => {
            const clip = s.clipboard;
            if (!clip || clip.length === 0) return {};
            const sh = activeSheet(s);
            const cx = clip.reduce((sum, c) => sum + c.x, 0) / clip.length;
            const cy = clip.reduce((sum, c) => sum + c.y, 0) / clip.length;
            const ox = at ? at.x - cx : 0.4;
            const oy = at ? at.y - cy : 0.4;
            const tables = [...sh.tables];
            const newIds: string[] = [];
            for (const c of clip) {
              const spot = findFreeSpot(tables, c.w, c.h, sh.venue, { x: c.x + ox, y: c.y + oy });
              tables.push({
                ...c,
                id: crypto.randomUUID(),
                number: nextFreeNumber(tables),
                name: "",
                x: spot.x,
                y: spot.y,
                disabledSides: [...c.disabledSides],
                locked: false,
                groupId: null,
                path: c.path?.map((p) => ({ ...p })),
              });
              newIds.push(tables[tables.length - 1].id);
            }
            return { ...patchActive(s, { tables }), selectedIds: newIds };
          }),

        duplicateSelected: () =>
          set((s) => {
            const sh = activeSheet(s);
            const selT = sh.tables.filter((t) => s.selectedIds.includes(t.id));
            const selO = sh.objects.filter((o) => s.selectedIds.includes(o.id));
            if (!selT.length && !selO.length) return {};
            const tables = [...sh.tables];
            const objects = [...sh.objects];
            const newIds: string[] = [];
            for (const src of selT) {
              const spot = findFreeSpot(tables, src.w, src.h, sh.venue, { x: src.x + 0.4, y: src.y + 0.4 });
              tables.push({
                ...src,
                id: crypto.randomUUID(),
                number: nextFreeNumber(tables),
                name: "",
                x: spot.x,
                y: spot.y,
                disabledSides: [...src.disabledSides],
                locked: false,
                groupId: null,
                path: src.path?.map((p) => ({ ...p })),
              });
              newIds.push(tables[tables.length - 1].id);
            }
            for (const src of selO) {
              const copy: SceneObject = {
                ...src,
                id: crypto.randomUUID(),
                locked: false,
                x: clampAxis(src.x + 0.4, src.w, sh.venue.width),
                y: clampAxis(src.y + 0.4, src.h, sh.venue.height),
              };
              objects.push(copy);
              newIds.push(copy.id);
            }
            return { ...patchActive(s, { tables, objects }), selectedIds: newIds };
          }),

        deleteSelected: () =>
          set((s) => {
            const sh = activeSheet(s);
            const delT = new Set(sh.tables.filter((t) => s.selectedIds.includes(t.id) && !t.locked).map((t) => t.id));
            const delO = new Set(sh.objects.filter((o) => s.selectedIds.includes(o.id) && !o.locked).map((o) => o.id));
            if (!delT.size && !delO.size) return {};
            return {
              ...patchActive(s, {
                tables: dissolveSingletonGroups(sh.tables.filter((t) => !delT.has(t.id))),
                objects: sh.objects.filter((o) => !delO.has(o.id)),
              }),
              guests: clearGuestSeats(s.guests, delT),
              selectedIds: s.selectedIds.filter((id) => !delT.has(id) && !delO.has(id)),
            };
          }),

        nudgeSelected: (dx, dy, big = false) =>
          set((s) => {
            const sh = activeSheet(s);
            const step = big ? sh.venue.gridStep || 0.5 : sh.venue.snapStep || 0.1;
            return patchActive(s, {
              tables: sh.tables.map((t) =>
                s.selectedIds.includes(t.id) && !t.locked
                  ? {
                      ...t,
                      x: Number(clampCenter(t.x + dx * step, t.w, sh.venue.width).toFixed(3)),
                      y: Number(clampCenter(t.y + dy * step, t.h, sh.venue.height).toFixed(3)),
                    }
                  : t,
              ),
              objects: sh.objects.map((o) =>
                s.selectedIds.includes(o.id) && !o.locked
                  ? {
                      ...o,
                      x: clampAxis(o.x + dx * step, o.w, sh.venue.width),
                      y: clampAxis(o.y + dy * step, o.h, sh.venue.height),
                    }
                  : o,
              ),
            });
          }),

        loadDocument: (doc) => {
          const sheets =
            doc.sheets && doc.sheets.length ? doc.sheets : createInitialState().sheets;
          set({
            schemaVersion: doc.schemaVersion ?? SCHEMA_VERSION,
            project: doc.project,
            settings: doc.settings,
            sheets,
            activeSheetId: doc.activeSheetId && sheets.some((sh) => sh.id === doc.activeSheetId)
              ? doc.activeSheetId
              : sheets[0].id,
            guests: Array.isArray(doc.guests) ? doc.guests.map(normalizeGuest) : [],
            selectedIds: [],
          });
        },

        resetProject: () => set({ ...createInitialState(), selectedIds: [], clipboard: null }),

        getDocument: () => {
          const s = get();
          return {
            schemaVersion: s.schemaVersion,
            project: s.project,
            settings: s.settings,
            sheets: s.sheets,
            activeSheetId: s.activeSheetId,
            guests: s.guests,
          };
        },
      }),
      {
        name: STORAGE_KEY,
        version: 3,
        migrate: (persisted: unknown) => {
          let p = persisted as Partial<ProjectState> & {
            venue?: Venue;
            tables?: TableModel[];
            objects?: SceneObject[];
          };
          // v0: flat venue/tables/objects -> a single sheet.
          if (p && !p.sheets) {
            const sheet: Sheet = {
              id: crypto.randomUUID(),
              name: "",
              venue: p.venue ?? createSheet("").venue,
              tables: p.tables ?? [],
              objects: p.objects ?? [],
            };
            p = {
              schemaVersion: p.schemaVersion ?? SCHEMA_VERSION,
              project: p.project,
              settings: p.settings,
              sheets: [sheet],
              activeSheetId: sheet.id,
            };
          }
          // v1 -> v2: theme moved to app prefs; blank auto-generated hall names so they localize.
          if (p && Array.isArray(p.sheets)) {
            const sheets = p.sheets;
            if (p.settings && "theme" in p.settings) {
              const settings = { ...p.settings } as Record<string, unknown>;
              delete settings.theme;
              p = { ...p, settings: settings as unknown as Settings };
            }
            p = {
              ...p,
              sheets: sheets.map((sh) => ({
                ...sh,
                name: /^Hall \d+$/.test(sh.name) ? "" : sh.name,
                tables: (sh.tables ?? []).map((tb) => ({ ...tb, groupId: tb.groupId ?? null })),
              })),
            };
          }
          // v2 -> v3: guests gained gender/relation, lost childAge/vip — normalise them.
          if (p && Array.isArray(p.guests)) {
            p = { ...p, guests: p.guests.map(normalizeGuest) };
          }
          return p;
        },
        partialize: (s) => ({
          schemaVersion: s.schemaVersion,
          project: s.project,
          settings: s.settings,
          sheets: s.sheets,
          activeSheetId: s.activeSheetId,
          guests: s.guests,
        }),
      },
    ),
    {
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        project: state.project,
        settings: state.settings,
        sheets: state.sheets,
        guests: state.guests,
      }),
      limit: 100,
      handleSet: (handleSet) => debounce(handleSet, 250),
    },
  ),
);

useStore.temporal.getState().clear();

export const undo = () => useStore.temporal.getState().undo();
export const redo = () => useStore.temporal.getState().redo();
export const useCanUndo = () => useZustand(useStore.temporal, (s) => s.pastStates.length > 0);
export const useCanRedo = () => useZustand(useStore.temporal, (s) => s.futureStates.length > 0);
