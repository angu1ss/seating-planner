import type { ProjectState, TableShape } from "./types";

export const SCHEMA_VERSION = 1;

/** How far a chair sits outside the table edge, meters. */
export const CHAIR_OFFSET = 0.32;
/** Visual chair radius, meters. */
export const CHAIR_RADIUS = 0.22;

export interface TablePreset {
  id: string;
  label: string;
  shape: TableShape;
  w: number;
  h: number;
  seatCount: number;
}

export const TABLE_PRESETS: TablePreset[] = [
  { id: "round-150", label: "Круглый Ø150", shape: "ellipse", w: 1.5, h: 1.5, seatCount: 8 },
  { id: "round-180", label: "Круглый Ø180", shape: "ellipse", w: 1.8, h: 1.8, seatCount: 10 },
  { id: "rect-120x80", label: "Прямоуг. 120×80", shape: "rect", w: 1.2, h: 0.8, seatCount: 4 },
  { id: "rect-180x80", label: "Прямоуг. 180×80", shape: "rect", w: 1.8, h: 0.8, seatCount: 6 },
  { id: "rect-240x90", label: "Прямоуг. 240×90", shape: "rect", w: 2.4, h: 0.9, seatCount: 8 },
  { id: "emperor-600x120", label: "Императорский 600×120", shape: "rect", w: 6.0, h: 1.2, seatCount: 18 },
];

export const VENUE_PRESETS = [
  { id: "small", label: "Маленький 8×6", width: 8, height: 6 },
  { id: "medium", label: "Средний 12×8", width: 12, height: 8 },
  { id: "large", label: "Большой 18×12", width: 18, height: 12 },
];

export function createInitialState(): ProjectState {
  return {
    schemaVersion: SCHEMA_VERSION,
    project: {
      id: crypto.randomUUID(),
      name: "Новый проект",
      eventType: "wedding",
      date: "",
      note: "",
    },
    venue: {
      width: 12,
      height: 8,
      gridStep: 0.5,
      snapStep: 0.1,
      snapToGrid: true,
    },
    settings: {
      minSeatSpacing: 0.65,
      chairStyle: "round",
      theme: "light",
    },
    tables: [],
  };
}
