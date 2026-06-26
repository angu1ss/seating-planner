// Data model for the seating planner.
// All spatial values are in METERS. The canvas multiplies by scale (px per meter).

export type TableShape = "rect" | "ellipse";
export type ChairStyle = "round" | "square";
export type Theme = "light" | "dark";
export type Side = "top" | "right" | "bottom" | "left";

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
  /** Sides with seating disabled (rect only, for now). */
  disabledSides: Side[];
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
  theme: Theme;
}

export interface ProjectMeta {
  id: string;
  name: string;
  eventType: string;
  date: string;
  note: string;
}

export interface ProjectState {
  schemaVersion: number;
  project: ProjectMeta;
  venue: Venue;
  settings: Settings;
  tables: TableModel[];
}
