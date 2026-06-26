import { create } from "zustand";
import { useStore as useZustand } from "zustand";
import { persist } from "zustand/middleware";
import { temporal } from "zundo";
import type {
  ChairStyle,
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
} from "./constants";
import { findFreeSpot } from "./geometry";

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
  };
}

export interface EditorState extends ProjectState {
  selectedIds: string[];
  clipboard: TableSnapshot[] | null;

  setProjectMeta: (patch: Partial<ProjectMeta>) => void;
  setVenue: (patch: Partial<Venue>) => void;
  setSettings: (patch: Partial<Settings>) => void;

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

        setProjectMeta: (patch) => set((s) => ({ project: { ...s.project, ...patch } })),
        setVenue: (patch) => set((s) => patchActive(s, { venue: { ...activeSheet(s).venue, ...patch } })),
        setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

        addSheet: () =>
          set((s) => {
            const sheet = createSheet(`Hall ${s.sheets.length + 1}`);
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
            ...patchActive(s, { tables: activeSheet(s).tables.filter((t) => t.id !== id) }),
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
            };
            return { ...patchActive(s, { tables: [...sh.tables, copy] }), selectedIds: [copy.id] };
          }),

        removeTables: (ids) =>
          set((s) => {
            const sh = activeSheet(s);
            const removed = new Set(sh.tables.filter((t) => ids.includes(t.id) && !t.locked).map((t) => t.id));
            return {
              ...patchActive(s, { tables: sh.tables.filter((t) => !removed.has(t.id)) }),
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
              });
              newIds.push(tables[tables.length - 1].id);
            }
            return { ...patchActive(s, { tables }), selectedIds: newIds };
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
            return patchActive(s, {
              tables: sh.tables.map((t) =>
                s.selectedIds.includes(t.id) && !t.locked ? { ...t, rotation: (t.rotation + deg + 360) % 360 } : t,
              ),
              objects: sh.objects.map((o) =>
                s.selectedIds.includes(o.id) && !o.locked ? { ...o, rotation: (o.rotation + deg + 360) % 360 } : o,
              ),
            });
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
                tables: sh.tables.filter((t) => !delT.has(t.id)),
                objects: sh.objects.filter((o) => !delO.has(o.id)),
              }),
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
          };
        },
      }),
      {
        name: STORAGE_KEY,
        version: 1,
        // Migrate the pre-sheets layout (flat venue/tables/objects) into one sheet.
        migrate: (persisted: unknown) => {
          const p = persisted as Partial<ProjectState> & {
            venue?: Venue;
            tables?: TableModel[];
            objects?: SceneObject[];
          };
          if (p && !p.sheets) {
            const sheet: Sheet = {
              id: crypto.randomUUID(),
              name: "Hall 1",
              venue: p.venue ?? createSheet("Hall 1").venue,
              tables: p.tables ?? [],
              objects: p.objects ?? [],
            };
            return {
              schemaVersion: p.schemaVersion ?? SCHEMA_VERSION,
              project: p.project,
              settings: p.settings,
              sheets: [sheet],
              activeSheetId: sheet.id,
            };
          }
          return p;
        },
        partialize: (s) => ({
          schemaVersion: s.schemaVersion,
          project: s.project,
          settings: s.settings,
          sheets: s.sheets,
          activeSheetId: s.activeSheetId,
        }),
      },
    ),
    {
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        project: state.project,
        settings: state.settings,
        sheets: state.sheets,
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
