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
  faLink,
  faLinkSlash,
  faUsers,
  faMasksTheater,
  faDisplay,
  faPersonChalkboard,
  faRecordVinyl,
  faMartiniGlassCitrus,
  faDoorOpen,
  faGift,
  faCircle,
  faSquare,
  faPerson,
  faPersonDress,
  faUserCheck,
  faPeopleRoof,
  faChild,
  faPersonCane,
  faPersonPregnant,
  faWheelchair,
  faEarDeaf,
  faMars,
  faVenus,
  faChevronDown,
  faKeyboard,
  faBezierCurve,
} from "@fortawesome/pro-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type {
  AgeCategory,
  ChairStyle,
  Guest,
  GuestFeature,
  GuestRole,
  SceneObjectType,
  Sex,
  TableShape,
} from "./types";

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
  | "edit"
  | "weld"
  | "unweld"
  | "guests"
  | "chevron"
  | "keyboard";

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
  weld: faLink,
  unweld: faLinkSlash,
  guests: faUsers,
  chevron: faChevronDown,
  keyboard: faKeyboard,
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

/** Role icons (the default "guest" has none). */
export const ROLE_ICONS: Partial<Record<GuestRole, IconDefinition>> = {
  groom: faPerson,
  bride: faPersonDress,
  witness: faUserCheck,
  parent: faPeopleRoof,
};

/** Age-category icons (the default "adult" has none). */
export const AGE_ICONS: Partial<Record<AgeCategory, IconDefinition>> = {
  child: faChild,
  elderly: faPersonCane,
};

export const FEATURE_ICONS: Record<GuestFeature, IconDefinition> = {
  pregnant: faPersonPregnant,
  wheelchair: faWheelchair,
  hardOfHearing: faEarDeaf,
};

export const SEX_ICONS: Record<Sex, IconDefinition> = {
  male: faMars,
  female: faVenus,
};

export const CHAIR_ICONS: Record<ChairStyle, IconDefinition> = {
  round: faCircle,
  square: faSquare,
};

export const SHAPE_ICONS: Record<TableShape, IconDefinition> = {
  rect: faSquare,
  ellipse: faCircle,
  snake: faBezierCurve,
};

export interface CornerBadges {
  tl?: IconDefinition;
  tr?: IconDefinition;
  br?: IconDefinition;
  bl?: IconDefinition;
}

/**
 * Up to four corner badges for a guest: role → top-right, age → bottom-right,
 * features → top-left then bottom-left then any free corner. Anything that
 * doesn't fit in the four corners is dropped.
 */
export function guestBadges(guest: Guest): CornerBadges {
  const corners: CornerBadges = {};
  const role = ROLE_ICONS[guest.role];
  const age = AGE_ICONS[guest.ageCategory];
  if (role) corners.tr = role;
  if (age) corners.br = age;
  const order: (keyof CornerBadges)[] = ["tl", "bl", "tr", "br"];
  for (const f of guest.features) {
    const slot = order.find((k) => corners[k] == null);
    if (!slot) break;
    corners[slot] = FEATURE_ICONS[f];
  }
  return corners;
}

// Custom / role / feature icons are added here as the Guests module lands —
// the registry is the single place to plug in Font Awesome icons (incl. custom
// FA-format IconDefinitions for glyphs FA doesn't ship, e.g. a column).
