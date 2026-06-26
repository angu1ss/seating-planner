import {
  faFileImport,
  faFileExport,
  faArrowRotateLeft,
  faSun,
  faMoon,
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus,
  faUpRightAndDownLeftFromCenter,
  faGear,
  faPenToSquare,
  faPlus,
  faTrash,
  faClone,
  faLanguage,
  faLock,
  faLockOpen,
  faXmark,
  faQuestion,
  faRotateLeft,
  faRotateRight,
  faMasksTheater,
  faDisplay,
  faPersonChalkboard,
  faRecordVinyl,
  faMartiniGlassCitrus,
  faDoorOpen,
  faGift,
  faCircle,
  faSquare,
} from "@fortawesome/pro-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { SceneObjectType } from "./types";

export type UiIconName =
  | "import"
  | "export"
  | "reset"
  | "light"
  | "dark"
  | "zoomIn"
  | "zoomOut"
  | "fit"
  | "add"
  | "delete"
  | "duplicate"
  | "language"
  | "lock"
  | "unlock"
  | "close"
  | "help"
  | "undo"
  | "redo"
  | "settings"
  | "edit";

export const UI_ICONS: Record<UiIconName, IconDefinition> = {
  import: faFileImport,
  export: faFileExport,
  reset: faArrowRotateLeft,
  light: faSun,
  dark: faMoon,
  zoomIn: faMagnifyingGlassPlus,
  zoomOut: faMagnifyingGlassMinus,
  fit: faUpRightAndDownLeftFromCenter,
  add: faPlus,
  delete: faTrash,
  duplicate: faClone,
  language: faLanguage,
  lock: faLock,
  unlock: faLockOpen,
  close: faXmark,
  help: faQuestion,
  undo: faRotateLeft,
  redo: faRotateRight,
  settings: faGear,
  edit: faPenToSquare,
};

export const OBJECT_ICONS: Record<SceneObjectType, IconDefinition> = {
  stage: faMasksTheater,
  screen: faDisplay,
  stageScreen: faPersonChalkboard,
  dancefloor: faRecordVinyl,
  bar: faMartiniGlassCitrus,
  entrance: faDoorOpen,
  giftTable: faGift,
  columnRound: faCircle,
  columnSquare: faSquare,
};

// Custom / role / feature icons are added here as the Guests module lands —
// the registry is the single place to plug in Font Awesome icons (incl. custom
// FA-format IconDefinitions for glyphs FA doesn't ship, e.g. a column).
