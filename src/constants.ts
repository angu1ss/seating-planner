import type { ProjectState, SceneObjectType, TableShape } from "./types";

export const SCHEMA_VERSION = 1;

/** How far a chair sits outside the table edge, meters. */
export const CHAIR_OFFSET = 0.32;
/** Visual chair radius, meters. */
export const CHAIR_RADIUS = 0.22;

export interface TablePreset {
  id: string;
  shape: TableShape;
  w: number;
  h: number;
  seatCount: number;
  /** Optional special name key (e.g. emperor); otherwise label is derived. */
  nameKey?: string;
}

export const TABLE_PRESETS: TablePreset[] = [
  { id: "round-150", shape: "ellipse", w: 1.5, h: 1.5, seatCount: 8 },
  { id: "round-180", shape: "ellipse", w: 1.8, h: 1.8, seatCount: 10 },
  { id: "rect-120x80", shape: "rect", w: 1.2, h: 0.8, seatCount: 4 },
  { id: "rect-180x80", shape: "rect", w: 1.8, h: 0.8, seatCount: 6 },
  { id: "rect-240x90", shape: "rect", w: 2.4, h: 0.9, seatCount: 8 },
  { id: "emperor-600x120", shape: "rect", w: 6.0, h: 1.2, seatCount: 18, nameKey: "shape.emperor" },
];

export interface VenuePreset {
  id: string;
  sizeKey: string;
  width: number;
  height: number;
}

export const VENUE_PRESETS: VenuePreset[] = [
  { id: "small", sizeKey: "size.small", width: 8, height: 6 },
  { id: "medium", sizeKey: "size.medium", width: 12, height: 8 },
  { id: "large", sizeKey: "size.large", width: 18, height: 12 },
];

const cm = (m: number) => Math.round(m * 100);

/** Localized, human-readable label for a table preset. */
export function presetLabel(p: TablePreset, t: (k: string) => string): string {
  if (p.nameKey) return `${t(p.nameKey)} ${cm(p.w)}×${cm(p.h)}`;
  if (p.shape === "ellipse") {
    return p.w === p.h ? `${t("shape.round")} Ø${cm(p.w)}` : `${t("shape.ellipse")} ${cm(p.w)}×${cm(p.h)}`;
  }
  return `${t("shape.rect")} ${cm(p.w)}×${cm(p.h)}`;
}

export function venuePresetLabel(v: VenuePreset, t: (k: string) => string): string {
  return `${t(v.sizeKey)} ${v.width}×${v.height}`;
}

export interface ObjectPreset {
  type: SceneObjectType;
  w: number;
  h: number;
}

export const OBJECT_PRESETS: ObjectPreset[] = [
  { type: "stage", w: 4, h: 1.5 },
  { type: "screen", w: 3, h: 0.25 },
  { type: "stageScreen", w: 4, h: 1.8 },
  { type: "dancefloor", w: 4, h: 4 },
  { type: "bar", w: 3, h: 0.8 },
  { type: "entrance", w: 0.9, h: 0.9 },
  { type: "giftTable", w: 1.2, h: 0.6 },
  { type: "columnRound", w: 0.4, h: 0.4 },
  { type: "columnSquare", w: 0.4, h: 0.4 },
];

/** Object types rendered as an ellipse rather than a rectangle. */
export const ROUND_OBJECT_TYPES: SceneObjectType[] = ["columnRound"];

export function objectLabelKey(type: SceneObjectType): string {
  return `obj.${type}`;
}

export function createInitialState(): ProjectState {
  return {
    schemaVersion: SCHEMA_VERSION,
    project: {
      id: crypto.randomUUID(),
      name: "",
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
    objects: [],
  };
}
