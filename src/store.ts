import { create } from "zustand";
import { useStore as useZustand } from "zustand";
import { persist } from "zustand/middleware";
import { temporal } from "zundo";

// Collapse rapid changes (drag, typing) into a single history entry.
function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: never[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}
import type {
  ChairStyle,
  ProjectMeta,
  ProjectState,
  SceneObject,
  SceneObjectType,
  Settings,
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
} from "./constants";
import { findFreeSpot } from "./geometry";

const clampAxis = (center: number, size: number, max: number) => {
  const lo = size / 2;
  const hi = Math.max(lo, max - size / 2);
  return Math.min(Math.max(lo, center), hi);
};

const STORAGE_KEY = "seating-planner:v1";

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

function clampCenter(center: number, size: number, max: number): number {
  // Keep the table AND its chair ring inside the walls.
  const ext = size / 2 + CHAIR_OFFSET + CHAIR_RADIUS;
  const lo = ext;
  const hi = Math.max(lo, max - ext);
  return Math.min(Math.max(lo, center), hi);
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
  };
}

export interface EditorState extends ProjectState {
  selectedIds: string[];
  selectedObjectId: string | null;
  clipboard: TableSnapshot[] | null;

  setProjectMeta: (patch: Partial<ProjectMeta>) => void;
  setVenue: (patch: Partial<Venue>) => void;
  setSettings: (patch: Partial<Settings>) => void;

  addObject: (type: SceneObjectType) => void;
  addObjectsFrom: (config: ObjectConfig, count: number) => void;
  updateObject: (id: string, patch: Partial<SceneObject>) => void;
  updateObjects: (ids: string[], patch: Partial<SceneObject>) => void;
  removeObject: (id: string) => void;
  removeObjects: (ids: string[]) => void;
  duplicateObjects: (ids: string[]) => void;
  selectObject: (id: string) => void;

  addTablesFrom: (config: TableConfig, count: number) => void;
  updateTable: (id: string, patch: Partial<TableModel>) => void;
  updateTables: (ids: string[], patch: Partial<TableModel>) => void;
  setPositions: (list: { id: string; x: number; y: number }[]) => void;
  removeTable: (id: string) => void;
  removeTables: (ids: string[]) => void;
  duplicateTable: (id: string) => void;
  duplicateTables: (ids: string[]) => void;

  select: (id: string, additive?: boolean) => void;
  selectMany: (ids: string[]) => void;
  selectAllTables: () => void;
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
      selectedObjectId: null,
      clipboard: null,

      setProjectMeta: (patch) => set((s) => ({ project: { ...s.project, ...patch } })),
      setVenue: (patch) => set((s) => ({ venue: { ...s.venue, ...patch } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addObject: (type) =>
        set((s) => {
          const preset = OBJECT_PRESETS.find((p) => p.type === type) ?? OBJECT_PRESETS[0];
          const obj: SceneObject = {
            id: crypto.randomUUID(),
            type,
            x: clampAxis(s.venue.width / 2, preset.w, s.venue.width),
            y: clampAxis(s.venue.height / 2, preset.h, s.venue.height),
            w: preset.w,
            h: preset.h,
            rotation: 0,
            label: "",
            locked: false,
          };
          return { objects: [...s.objects, obj], selectedObjectId: obj.id, selectedIds: [] };
        }),

      addObjectsFrom: (config, count) =>
        set((s) => {
          const objects = [...s.objects];
          let lastId: string | null = s.selectedObjectId;
          for (let i = 0; i < Math.max(1, count); i++) {
            const stagger = (i % 6) * 0.4;
            const obj: SceneObject = {
              id: crypto.randomUUID(),
              type: config.type,
              x: clampAxis(s.venue.width / 2 + stagger, config.w, s.venue.width),
              y: clampAxis(s.venue.height / 2 + stagger, config.h, s.venue.height),
              w: config.w,
              h: config.h,
              rotation: 0,
              label: config.label ?? "",
              locked: false,
            };
            objects.push(obj);
            lastId = obj.id;
          }
          return { objects, selectedObjectId: lastId, selectedIds: [] };
        }),

      updateObject: (id, patch) =>
        set((s) => ({ objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) })),

      updateObjects: (ids, patch) =>
        set((s) => ({ objects: s.objects.map((o) => (ids.includes(o.id) ? { ...o, ...patch } : o)) })),

      removeObject: (id) =>
        set((s) => ({
          objects: s.objects.filter((o) => o.id !== id),
          selectedObjectId: s.selectedObjectId === id ? null : s.selectedObjectId,
        })),

      removeObjects: (ids) =>
        set((s) => {
          const removable = new Set(
            s.objects.filter((o) => ids.includes(o.id) && !o.locked).map((o) => o.id),
          );
          return {
            objects: s.objects.filter((o) => !removable.has(o.id)),
            selectedObjectId:
              s.selectedObjectId && removable.has(s.selectedObjectId) ? null : s.selectedObjectId,
          };
        }),

      duplicateObjects: (ids) =>
        set((s) => {
          const sel = s.objects.filter((o) => ids.includes(o.id));
          if (!sel.length) return {};
          const objects = [...s.objects];
          for (const src of sel) {
            objects.push({
              ...src,
              id: crypto.randomUUID(),
              locked: false,
              x: clampAxis(src.x + 0.4, src.w, s.venue.width),
              y: clampAxis(src.y + 0.4, src.h, s.venue.height),
            });
          }
          return { objects };
        }),

      selectObject: (id) => set({ selectedObjectId: id, selectedIds: [] }),

      addTablesFrom: (config, count) =>
        set((s) => {
          const tables = [...s.tables];
          const newIds: string[] = [];
          for (let i = 0; i < Math.max(1, count); i++) {
            const t = makeTable(config, nextFreeNumber(tables), tables, s.venue);
            tables.push(t);
            newIds.push(t.id);
          }
          return { tables, selectedIds: newIds };
        }),

      updateTable: (id, patch) =>
        set((s) => ({ tables: s.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      updateTables: (ids, patch) =>
        set((s) => ({
          tables: s.tables.map((t) => (ids.includes(t.id) ? { ...t, ...patch } : t)),
        })),

      setPositions: (list) =>
        set((s) => {
          const map = new Map(list.map((p) => [p.id, p]));
          return {
            tables: s.tables.map((t) => {
              const p = map.get(t.id);
              return p ? { ...t, x: p.x, y: p.y } : t;
            }),
          };
        }),

      removeTable: (id) =>
        set((s) => ({
          tables: s.tables.filter((t) => t.id !== id),
          selectedIds: s.selectedIds.filter((x) => x !== id),
        })),

      duplicateTable: (id) =>
        set((s) => {
          const src = s.tables.find((t) => t.id === id);
          if (!src) return {};
          const spot = findFreeSpot(s.tables, src.w, src.h, s.venue, { x: src.x + 0.4, y: src.y + 0.4 });
          const copy: TableModel = {
            ...src,
            id: crypto.randomUUID(),
            number: nextFreeNumber(s.tables),
            name: "",
            x: spot.x,
            y: spot.y,
            disabledSides: [...src.disabledSides],
            locked: false,
          };
          return { tables: [...s.tables, copy], selectedIds: [copy.id] };
        }),

      removeTables: (ids) =>
        set((s) => {
          const removed = new Set(
            s.tables.filter((t) => ids.includes(t.id) && !t.locked).map((t) => t.id),
          );
          return {
            tables: s.tables.filter((t) => !removed.has(t.id)),
            selectedIds: s.selectedIds.filter((id) => !removed.has(id)),
          };
        }),

      duplicateTables: (ids) =>
        set((s) => {
          const sel = s.tables.filter((t) => ids.includes(t.id));
          if (!sel.length) return {};
          const tables = [...s.tables];
          const newIds: string[] = [];
          for (const src of sel) {
            const spot = findFreeSpot(tables, src.w, src.h, s.venue, { x: src.x + 0.4, y: src.y + 0.4 });
            tables.push({
              ...src,
              id: crypto.randomUUID(),
              number: nextFreeNumber(tables),
              name: "",
              x: spot.x,
              y: spot.y,
              disabledSides: [...src.disabledSides],
              locked: false,
            });
            newIds.push(tables[tables.length - 1].id);
          }
          return { tables, selectedIds: newIds };
        }),

      select: (id, additive = false) =>
        set((s) => {
          if (!additive) return { selectedIds: [id], selectedObjectId: null };
          const has = s.selectedIds.includes(id);
          return {
            selectedIds: has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
            selectedObjectId: null,
          };
        }),
      selectMany: (ids) => set({ selectedIds: ids, selectedObjectId: null }),
      selectAllTables: () => set((s) => ({ selectedIds: s.tables.map((t) => t.id), selectedObjectId: null })),
      clearSelection: () => set({ selectedIds: [], selectedObjectId: null }),

      rotateSelection: (deg) =>
        set((s) => {
          if (s.selectedObjectId) {
            return {
              objects: s.objects.map((o) =>
                o.id === s.selectedObjectId && !o.locked
                  ? { ...o, rotation: (o.rotation + deg + 360) % 360 }
                  : o,
              ),
            };
          }
          return {
            tables: s.tables.map((t) =>
              s.selectedIds.includes(t.id) && !t.locked
                ? { ...t, rotation: (t.rotation + deg + 360) % 360 }
                : t,
            ),
          };
        }),

      toggleLockSelection: () =>
        set((s) => {
          if (s.selectedObjectId) {
            return {
              objects: s.objects.map((o) =>
                o.id === s.selectedObjectId ? { ...o, locked: !o.locked } : o,
              ),
            };
          }
          if (!s.selectedIds.length) return {};
          const allLocked = s.tables
            .filter((t) => s.selectedIds.includes(t.id))
            .every((t) => t.locked);
          return {
            tables: s.tables.map((t) =>
              s.selectedIds.includes(t.id) ? { ...t, locked: !allLocked } : t,
            ),
          };
        }),

      copySelected: () =>
        set((s) => {
          const snaps = s.tables.filter((t) => s.selectedIds.includes(t.id)).map(snapshotOf);
          return snaps.length ? { clipboard: snaps } : {};
        }),

      pasteClipboard: (at) =>
        set((s) => {
          const clip = s.clipboard;
          if (!clip || clip.length === 0) return {};
          const cx = clip.reduce((sum, c) => sum + c.x, 0) / clip.length;
          const cy = clip.reduce((sum, c) => sum + c.y, 0) / clip.length;
          const ox = at ? at.x - cx : 0.4;
          const oy = at ? at.y - cy : 0.4;
          const tables = [...s.tables];
          const newIds: string[] = [];
          for (const c of clip) {
            const spot = findFreeSpot(tables, c.w, c.h, s.venue, { x: c.x + ox, y: c.y + oy });
            const t: TableModel = {
              ...c,
              id: crypto.randomUUID(),
              number: nextFreeNumber(tables),
              name: "",
              x: spot.x,
              y: spot.y,
              disabledSides: [...c.disabledSides],
              locked: false,
            };
            tables.push(t);
            newIds.push(t.id);
          }
          return { tables, selectedIds: newIds };
        }),

      duplicateSelected: () =>
        set((s) => {
          const sel = s.tables.filter((t) => s.selectedIds.includes(t.id));
          if (!sel.length) return {};
          const tables = [...s.tables];
          const newIds: string[] = [];
          for (const src of sel) {
            const spot = findFreeSpot(tables, src.w, src.h, s.venue, { x: src.x + 0.4, y: src.y + 0.4 });
            const copy: TableModel = {
              ...src,
              id: crypto.randomUUID(),
              number: nextFreeNumber(tables),
              name: "",
              x: spot.x,
              y: spot.y,
              disabledSides: [...src.disabledSides],
              locked: false,
            };
            tables.push(copy);
            newIds.push(copy.id);
          }
          return { tables, selectedIds: newIds };
        }),

      deleteSelected: () =>
        set((s) => {
          if (s.selectedObjectId) {
            const obj = s.objects.find((o) => o.id === s.selectedObjectId);
            if (obj?.locked) return {};
            return {
              objects: s.objects.filter((o) => o.id !== s.selectedObjectId),
              selectedObjectId: null,
            };
          }
          return {
            tables: s.tables.filter((t) => !(s.selectedIds.includes(t.id) && !t.locked)),
            selectedIds: [],
          };
        }),

      nudgeSelected: (dx, dy, big = false) =>
        set((s) => {
          const step = big ? s.venue.gridStep || 0.5 : s.venue.snapStep || 0.1;
          if (s.selectedObjectId) {
            return {
              objects: s.objects.map((o) =>
                o.id === s.selectedObjectId && !o.locked
                  ? {
                      ...o,
                      x: clampAxis(o.x + dx * step, o.w, s.venue.width),
                      y: clampAxis(o.y + dy * step, o.h, s.venue.height),
                    }
                  : o,
              ),
            };
          }
          if (!s.selectedIds.length) return {};
          return {
            tables: s.tables.map((t) =>
              s.selectedIds.includes(t.id) && !t.locked
                ? {
                    ...t,
                    x: Number(clampCenter(t.x + dx * step, t.w, s.venue.width).toFixed(3)),
                    y: Number(clampCenter(t.y + dy * step, t.h, s.venue.height).toFixed(3)),
                  }
                : t,
            ),
          };
        }),

      loadDocument: (doc) =>
        set({
          schemaVersion: doc.schemaVersion ?? SCHEMA_VERSION,
          project: doc.project,
          venue: doc.venue,
          settings: doc.settings,
          tables: (doc.tables ?? []).map((t, i) => ({
            ...t,
            number: t.number ?? i + 1,
            locked: t.locked ?? false,
          })),
          objects: (doc.objects ?? []).map((o) => ({ ...o, locked: o.locked ?? false })),
          selectedIds: [],
          selectedObjectId: null,
        }),

      resetProject: () =>
        set({ ...createInitialState(), selectedIds: [], selectedObjectId: null, clipboard: null }),

      getDocument: () => {
        const s = get();
        return {
          schemaVersion: s.schemaVersion,
          project: s.project,
          venue: s.venue,
          settings: s.settings,
          tables: s.tables,
          objects: s.objects,
        };
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (s) => ({
        schemaVersion: s.schemaVersion,
        project: s.project,
        venue: s.venue,
        settings: s.settings,
        tables: s.tables,
        objects: s.objects,
      }),
    },
  ),
  {
    partialize: (state) => ({
      schemaVersion: state.schemaVersion,
      project: state.project,
      venue: state.venue,
      settings: state.settings,
      tables: state.tables,
      objects: state.objects,
    }),
    limit: 100,
    handleSet: (handleSet) => debounce(handleSet, 250),
  },
  ),
);

// Start with a clean history (ignore the initial hydration).
useStore.temporal.getState().clear();

export const undo = () => useStore.temporal.getState().undo();
export const redo = () => useStore.temporal.getState().redo();
export const useCanUndo = () => useZustand(useStore.temporal, (s) => s.pastStates.length > 0);
export const useCanRedo = () => useZustand(useStore.temporal, (s) => s.futureStates.length > 0);
