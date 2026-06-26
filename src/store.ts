import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ChairStyle,
  ProjectMeta,
  ProjectState,
  Settings,
  TableModel,
  TableShape,
  Venue,
} from "./types";
import { CHAIR_OFFSET, CHAIR_RADIUS, SCHEMA_VERSION, createInitialState } from "./constants";
import { findFreeSpot } from "./geometry";

const STORAGE_KEY = "seating-planner:v1";

export interface TableConfig {
  shape: TableShape;
  w: number;
  h: number;
  seatCount: number;
  chairStyle: ChairStyle | null;
  name?: string;
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
  };
}

export interface EditorState extends ProjectState {
  selectedIds: string[];
  clipboard: TableSnapshot[] | null;

  setProjectMeta: (patch: Partial<ProjectMeta>) => void;
  setVenue: (patch: Partial<Venue>) => void;
  setSettings: (patch: Partial<Settings>) => void;

  addTablesFrom: (config: TableConfig, count: number) => void;
  updateTable: (id: string, patch: Partial<TableModel>) => void;
  updateTables: (ids: string[], patch: Partial<TableModel>) => void;
  setPositions: (list: { id: string; x: number; y: number }[]) => void;
  removeTable: (id: string) => void;
  duplicateTable: (id: string) => void;

  select: (id: string, additive?: boolean) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;

  copySelected: () => void;
  pasteClipboard: (at?: { x: number; y: number }) => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  nudgeSelected: (dx: number, dy: number) => void;

  loadDocument: (doc: ProjectState) => void;
  resetProject: () => void;
  getDocument: () => ProjectState;
}

export const useStore = create<EditorState>()(
  persist(
    (set, get) => ({
      ...createInitialState(),
      selectedIds: [],
      clipboard: null,

      setProjectMeta: (patch) => set((s) => ({ project: { ...s.project, ...patch } })),
      setVenue: (patch) => set((s) => ({ venue: { ...s.venue, ...patch } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

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
          };
          return { tables: [...s.tables, copy], selectedIds: [copy.id] };
        }),

      select: (id, additive = false) =>
        set((s) => {
          if (!additive) return { selectedIds: [id] };
          const has = s.selectedIds.includes(id);
          return { selectedIds: has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id] };
        }),
      selectMany: (ids) => set({ selectedIds: ids }),
      clearSelection: () => set({ selectedIds: [] }),

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
            };
            tables.push(copy);
            newIds.push(copy.id);
          }
          return { tables, selectedIds: newIds };
        }),

      deleteSelected: () =>
        set((s) => ({
          tables: s.tables.filter((t) => !s.selectedIds.includes(t.id)),
          selectedIds: [],
        })),

      nudgeSelected: (dx, dy) =>
        set((s) => {
          if (!s.selectedIds.length) return {};
          const step = s.venue.snapToGrid ? s.venue.gridStep || 0.5 : s.venue.snapStep || 0.1;
          return {
            tables: s.tables.map((t) =>
              s.selectedIds.includes(t.id)
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
          tables: (doc.tables ?? []).map((t, i) => ({ ...t, number: t.number ?? i + 1 })),
          selectedIds: [],
        }),

      resetProject: () => set({ ...createInitialState(), selectedIds: [], clipboard: null }),

      getDocument: () => {
        const s = get();
        return {
          schemaVersion: s.schemaVersion,
          project: s.project,
          venue: s.venue,
          settings: s.settings,
          tables: s.tables,
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
      }),
    },
  ),
);
