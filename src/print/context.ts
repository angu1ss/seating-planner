import { useStore } from "../store";
import { slugify } from "../utils/file";

export interface PrintGuest {
  name: string;
  roleLabel: string;
  featureLabels: string[];
  seat: { tableId: string; index: number } | null;
}

export interface PrintTable {
  id: string;
  label: string;
  number: number;
  seatCount: number;
}

export interface PrintHall {
  name: string;
  tables: PrintTable[];
}

export interface PrintContext {
  title: string;
  subtitle: string;
  fileBase: string;
  t: (key: string) => string;
  multiHall: boolean;
  halls: PrintHall[];
  tableLabel: Map<string, string>;
  guests: PrintGuest[];
}

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Snapshot the store into a render-independent context for the print views. */
export function buildPrintContext(t: (k: string) => string, lang: string): PrintContext {
  const s = useStore.getState();
  const { project } = s;
  const multiHall = s.sheets.length > 1;
  const hallName = (sh: { name: string }, i: number) => sh.name.trim() || `${t("left.hall")} ${i + 1}`;
  const labelOf = (tb: { name: string; number: number }) =>
    tb.name.trim() || `${t("table.word")} ${tb.number}`;

  const halls: PrintHall[] = s.sheets.map((sh, i) => ({
    name: hallName(sh, i),
    tables: sh.tables
      .map((tb) => ({ id: tb.id, label: labelOf(tb), number: tb.number, seatCount: tb.seatCount }))
      .sort((a, b) => a.number - b.number),
  }));

  const tableLabel = new Map<string, string>();
  s.sheets.forEach((sh, i) => {
    sh.tables.forEach((tb) => {
      tableLabel.set(tb.id, multiHall ? `${hallName(sh, i)} · ${labelOf(tb)}` : labelOf(tb));
    });
  });

  const guests: PrintGuest[] = s.guests.map((g) => ({
    name: g.name,
    roleLabel: t(`role.${g.role}`),
    featureLabels: g.features.map((f) => t(`feature.${f}`)),
    seat: g.seat,
  }));

  const subtitle = [project.date ? formatDate(project.date, lang) : "", t(`event.${project.eventType}`)]
    .filter(Boolean)
    .join("  ·  ");

  return {
    title: project.name.trim() || t("project.untitled"),
    subtitle,
    fileBase: slugify(project.name),
    t,
    multiHall,
    halls,
    tableLabel,
    guests,
  };
}
