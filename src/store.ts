import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ProjectMeta,
  ProjectState,
  Settings,
  TableModel,
  Venue,
} from "./types";
import { SCHEMA_VERSION, TABLE_PRESETS, createInitialState, type TablePreset } from "./constants";

const STORAGE_KEY = "seating-planner:v1";

export interface EditorState extends ProjectState {
  selectedId: string | null;

  setProjectMeta: (patch: Partial<ProjectMeta>) => void;
  setVenue: (patch: Partial<Venue>) => void;
  setSettings: (patch: Partial<Settings>) => void;

  addTable: (preset?: TablePreset) => void;
  updateTable: (id: string, patch: Partial<TableModel>) => void;
  removeTable: (id: string) => void;
  duplicateTable: (id: string) => void;
  select: (id: string | null) => void;

  loadDocument: (doc: ProjectState) => void;
  resetProject: () => void;
  getDocument: () => ProjectState;
}

function makeTable(preset: TablePreset | undefined, index: number, venue: Venue): TableModel {
  const p = preset ?? TABLE_PRESETS[0];
  const stagger = (index % 5) * 0.4;
  return {
    id: crypto.randomUUID(),
    name: `Стол ${index + 1}`,
    shape: p.shape,
    x: Math.min(venue.width - p.w / 2 - 0.2, venue.width / 2 + stagger),
    y: Math.min(venue.height - p.h / 2 - 0.2, venue.height / 2 + stagger),
    w: p.w,
    h: p.h,
    rotation: 0,
    seatCount: p.seatCount,
    isPodium: false,
    chairStyle: null,
    disabledSides: [],
  };
}

export const useStore = create<EditorState>()(
  persist(
    (set, get) => ({
      ...createInitialState(),
      selectedId: null,

      setProjectMeta: (patch) =>
        set((s) => ({ project: { ...s.project, ...patch } })),

      setVenue: (patch) => set((s) => ({ venue: { ...s.venue, ...patch } })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addTable: (preset) =>
        set((s) => {
          const t = makeTable(preset, s.tables.length, s.venue);
          return { tables: [...s.tables, t], selectedId: t.id };
        }),

      updateTable: (id, patch) =>
        set((s) => ({
          tables: s.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      removeTable: (id) =>
        set((s) => ({
          tables: s.tables.filter((t) => t.id !== id),
          selectedId: s.selectedId === id ? null : s.selectedId,
        })),

      duplicateTable: (id) =>
        set((s) => {
          const src = s.tables.find((t) => t.id === id);
          if (!src) return {};
          const copy: TableModel = {
            ...src,
            id: crypto.randomUUID(),
            name: `${src.name} (копия)`,
            x: src.x + 0.5,
            y: src.y + 0.5,
            disabledSides: [...src.disabledSides],
          };
          return { tables: [...s.tables, copy], selectedId: copy.id };
        }),

      select: (id) => set({ selectedId: id }),

      loadDocument: (doc) =>
        set({
          schemaVersion: doc.schemaVersion ?? SCHEMA_VERSION,
          project: doc.project,
          venue: doc.venue,
          settings: doc.settings,
          tables: doc.tables ?? [],
          selectedId: null,
        }),

      resetProject: () => set({ ...createInitialState(), selectedId: null }),

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
