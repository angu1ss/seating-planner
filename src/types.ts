// Data model for the seating planner.
// All spatial values are in METERS. The canvas multiplies by scale (px per meter).

export type TableShape = "rect" | "ellipse" | "snake";
export type ChairStyle = "round" | "square";
export type Theme = "light" | "dark";
export type Side = "top" | "right" | "bottom" | "left";

/** A node on a snake table's centreline, in meters relative to the table centre. */
export interface PathPoint {
  x: number;
  y: number;
}

export interface Seat {
  id: string;
  /** For rect tables: which side the seat sits on. For ellipse: always "top" (unused). */
  side: Side;
  /** Position along the seat ordering, 0..1 (kept for future stable numbering). */
  pos: number;
  enabled: boolean;
  guestId: string | null;
}

export interface TableModel {
  id: string;
  /** Auto-assigned table number (smallest free positive integer). */
  number: number;
  name: string;
  shape: TableShape;
  /** Center position in meters. */
  x: number;
  y: number;
  /** Width / height in meters (for ellipse — the two axes). */
  w: number;
  h: number;
  /** Rotation in degrees. */
  rotation: number;
  /** Number of seats (chairs auto-placed around the perimeter). */
  seatCount: number;
  isPodium: boolean;
  /** null = inherit project chair style; otherwise override. */
  chairStyle: ChairStyle | null;
  /**
   * Rect: sides with seating disabled. Snake: which of the two long sides are off
   * ("left" / "right" relative to the path direction).
   */
  disabledSides: Side[];
  /** When locked, the table can't be moved/edited/deleted — only selected to unlock. */
  locked: boolean;
  /** Weld group: tables sharing a non-null id are joined and move/rotate together. */
  groupId: string | null;
  /** Snake tables only: centreline nodes (meters, relative to centre, bbox-centred). `h` = band width. */
  path?: PathPoint[];
}

export type SceneObjectType =
  | "stage"
  | "screen"
  | "stageScreen"
  | "dancefloor"
  | "bar"
  | "entrance"
  | "giftTable"
  | "columnRound"
  | "columnSquare";

export interface SceneObject {
  id: string;
  type: SceneObjectType;
  /** Center position in meters. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  /** Custom label; empty string = use the localized default for the type. */
  label: string;
  /** When locked, the object can't be moved/edited/deleted — only selected to unlock. */
  locked: boolean;
}

export interface Venue {
  width: number;
  height: number;
  /** Visible grid step, meters. */
  gridStep: number;
  /** Snap precision, meters. */
  snapStep: number;
  snapToGrid: boolean;
}

export interface Settings {
  /** Comfortable minimum spacing between guests, meters. Below this => "tight" warning. */
  minSeatSpacing: number;
  chairStyle: ChairStyle;
}

/** Event type drives the available guest roles. Only "wedding" exists for now. */
export type EventType = "wedding";

export type Sex = "male" | "female";
export type GuestRole = "groom" | "bride" | "witness" | "parent" | "guest";
export type AgeCategory = "adult" | "child" | "elderly";
export type GuestFeature = "pregnant" | "wheelchair" | "hardOfHearing";

export interface Guest {
  id: string;
  name: string;
  role: GuestRole;
  ageCategory: AgeCategory;
  /** Biological sex; tints the chair (blue / pink). null = not chosen yet (neutral). */
  sex: Sex | null;
  features: GuestFeature[];
  /** Free-text note shown only while editing / on hover — e.g. "bride's coworker". */
  relation: string;
  /** Assigned chair (by table + perimeter index, any hall), or null if unseated. */
  seat: { tableId: string; index: number } | null;
}

export interface ProjectMeta {
  id: string;
  name: string;
  eventType: EventType;
  date: string;
  note: string;
}

/** One hall / floor (Excel-like sheet) with its own venue, tables and interior elements. */
export interface Sheet {
  id: string;
  name: string;
  venue: Venue;
  tables: TableModel[];
  objects: SceneObject[];
}

export interface ProjectState {
  schemaVersion: number;
  project: ProjectMeta;
  settings: Settings;
  sheets: Sheet[];
  activeSheetId: string;
  guests: Guest[];
}
