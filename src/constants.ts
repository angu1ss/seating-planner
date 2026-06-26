import type {
  AgeCategory,
  Sex,
  GuestFeature,
  GuestRole,
  PathPoint,
  ProjectState,
  SceneObjectType,
  Sheet,
  TableShape,
} from "./types";

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
  { id: "snake", shape: "snake", w: 4.8, h: 0.9, seatCount: 14, nameKey: "shape.snake" },
];

/** Default centreline (gentle S-curve) for a freshly added snake table — bbox-centred, meters. */
export function defaultSnakePath(): PathPoint[] {
  return [
    { x: -2.4, y: -0.15 },
    { x: -0.8, y: 0.15 },
    { x: 0.8, y: -0.15 },
    { x: 2.4, y: 0.15 },
  ];
}

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
  if (p.shape === "snake") return t(p.nameKey ?? "shape.snake");
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

export function createSheet(name: string): Sheet {
  return {
    id: crypto.randomUUID(),
    name,
    venue: { width: 12, height: 8, gridStep: 0.5, snapStep: 0.1, snapToGrid: true },
    tables: [],
    objects: [],
  };
}

/** Guest roles available for a wedding (the only event type for now). */
export const GUEST_ROLES: GuestRole[] = ["guest", "groom", "bride", "witness", "parent"];
/** Roles that mark the newlyweds — used by the auto-seating rules. */
export const NEWLYWED_ROLES: GuestRole[] = ["groom", "bride"];
export const GUEST_FEATURES: GuestFeature[] = ["pregnant", "wheelchair", "hardOfHearing"];
export const AGE_CATEGORIES: AgeCategory[] = ["adult", "child", "elderly"];
export const SEXES: Sex[] = ["male", "female"];

export const guestRoleLabelKey = (r: GuestRole): string => `role.${r}`;
export const guestFeatureLabelKey = (f: GuestFeature): string => `feature.${f}`;
export const ageLabelKey = (a: AgeCategory): string => `age.${a}`;
export const sexLabelKey = (s: Sex): string => `sex.${s}`;

/** Chair tint by sex; null → neutral. */
export const SEX_COLOR: Record<Sex, string> = { male: "#6aa8e0", female: "#e79fc0" };
export const NEUTRAL_SEAT = "#9aa6b4";

/** Initials — first letters of up to four name words (split on spaces and hyphens). */
export function initials(name: string): string {
  const parts = name.trim().split(/[\s-]+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 4).map((p) => p[0]!.toUpperCase()).join("");
}

export function createInitialState(): ProjectState {
  const sheet = createSheet("");
  return {
    schemaVersion: SCHEMA_VERSION,
    project: { id: crypto.randomUUID(), name: "", eventType: "wedding", date: "", note: "" },
    settings: { minSeatSpacing: 0.65, chairStyle: "round" },
    sheets: [sheet],
    activeSheetId: sheet.id,
    guests: [],
  };
}
