import type { jsPDF as JsPDF } from "jspdf";

/* ----------------------------- shared data ----------------------------- */

export interface ExportGuest {
  name: string;
  roleLabel: string;
  featureLabels: string[];
  seat: { tableId: string; index: number } | null;
}

export interface ExportTable {
  id: string;
  label: string;
  number: number;
  seatCount: number;
}

export interface ExportHall {
  name: string;
  tables: ExportTable[];
}

export interface ExportContext {
  title: string;
  subtitle: string;
  fileBase: string;
  t: (key: string) => string;
  multiHall: boolean;
  halls: ExportHall[];
  tableLabel: Map<string, string>;
  guests: ExportGuest[];
}

/* ----------------------------- font loading ---------------------------- */

let fontCache: { regular: string; bold: string } | null = null;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchFont(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font ${url}: ${res.status}`);
  return toBase64(await res.arrayBuffer());
}

async function registerFonts(doc: JsPDF): Promise<void> {
  if (!fontCache) {
    const base = import.meta.env.BASE_URL;
    const [regular, bold] = await Promise.all([
      fetchFont(`${base}fonts/DejaVuSans.ttf`),
      fetchFont(`${base}fonts/DejaVuSans-Bold.ttf`),
    ]);
    fontCache = { regular, bold };
  }
  doc.addFileToVFS("DejaVuSans.ttf", fontCache.regular);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", fontCache.bold);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
  doc.setFont("DejaVu", "normal");
}

async function newDoc(orientation: "p" | "l"): Promise<JsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  await registerFonts(doc);
  return doc;
}

/* ------------------------------- helpers ------------------------------- */

const MARGIN = 14;

function pageSize(doc: JsPDF) {
  return { w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight() };
}

/** Draw the document title block; returns the y just below it. */
function header(doc: JsPDF, ctx: ExportContext, heading: string): number {
  const { w } = pageSize(doc);
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 25, 40);
  doc.text(ctx.title, MARGIN, MARGIN + 4);
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 125, 135);
  const right = [heading, ctx.subtitle].filter(Boolean).join("   ·   ");
  doc.text(right, w - MARGIN, MARGIN + 4, { align: "right" });
  doc.setDrawColor(220, 222, 228);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, MARGIN + 8, w - MARGIN, MARGIN + 8);
  doc.setTextColor(20, 25, 40);
  return MARGIN + 16;
}

/* ----------------------------- guest list ------------------------------ */

function guestLine(g: ExportGuest): string {
  const extras = [g.roleLabel, ...g.featureLabels].filter(Boolean).join(", ");
  return extras ? `${g.name} — ${extras}` : g.name;
}

export async function exportGuestListPdf(ctx: ExportContext): Promise<void> {
  const doc = await newDoc("p");
  const { w, h } = pageSize(doc);
  const bottom = h - MARGIN;
  let y = header(doc, ctx, ctx.t("export.guestList"));

  const ensure = (need: number) => {
    if (y + need > bottom) {
      doc.addPage();
      y = MARGIN + 4;
    }
  };

  // ---- Section 1: by table ----
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(13);
  doc.text(ctx.t("export.byTable"), MARGIN, y);
  y += 7;

  const seatedByTable = new Map<string, ExportGuest[]>();
  for (const g of ctx.guests) {
    if (!g.seat) continue;
    const arr = seatedByTable.get(g.seat.tableId) ?? [];
    arr.push(g);
    seatedByTable.set(g.seat.tableId, arr);
  }

  for (const hall of ctx.halls) {
    if (ctx.multiHall) {
      ensure(10);
      doc.setFont("DejaVu", "bold");
      doc.setFontSize(11);
      doc.setTextColor(59, 130, 246);
      doc.text(hall.name, MARGIN, y);
      doc.setTextColor(20, 25, 40);
      y += 6;
    }
    for (const tb of hall.tables) {
      const list = (seatedByTable.get(tb.id) ?? []).sort(
        (a, b) => (a.seat?.index ?? 0) - (b.seat?.index ?? 0),
      );
      ensure(8 + list.length * 5.5 + 2);
      doc.setFont("DejaVu", "bold");
      doc.setFontSize(11);
      doc.text(`${tb.label}  (${list.length}/${tb.seatCount})`, MARGIN, y);
      y += 5.5;
      doc.setFont("DejaVu", "normal");
      doc.setFontSize(10);
      if (list.length === 0) {
        doc.setTextColor(150, 154, 162);
        doc.text(`— ${ctx.t("export.empty")}`, MARGIN + 4, y);
        doc.setTextColor(20, 25, 40);
        y += 5.5;
      } else {
        for (const g of list) {
          ensure(5.5);
          for (const line of doc.splitTextToSize(`•  ${guestLine(g)}`, w - 2 * MARGIN - 4)) {
            doc.text(line, MARGIN + 4, y);
            y += 5;
          }
          y += 0.5;
        }
      }
      y += 2;
    }
  }

  // ---- Unseated ----
  const unseated = ctx.guests.filter((g) => !g.seat).sort((a, b) => a.name.localeCompare(b.name));
  if (unseated.length) {
    ensure(10);
    doc.setFont("DejaVu", "bold");
    doc.setFontSize(11);
    doc.text(`${ctx.t("guests.unseated")}  (${unseated.length})`, MARGIN, y);
    y += 5.5;
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(10);
    for (const g of unseated) {
      ensure(5.5);
      doc.text(`•  ${guestLine(g)}`, MARGIN + 4, y);
      y += 5;
    }
  }

  // ---- Section 2: alphabetical (new page) ----
  doc.addPage();
  y = header(doc, ctx, ctx.t("export.guestList"));
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(13);
  doc.text(ctx.t("export.alphabetical"), MARGIN, y);
  y += 7;

  const all = [...ctx.guests].sort((a, b) => a.name.localeCompare(b.name));
  const tableCol = w - MARGIN;
  doc.setFontSize(10);
  for (const g of all) {
    ensure(5.5);
    doc.setFont("DejaVu", "normal");
    doc.text(g.name, MARGIN, y);
    const where = g.seat ? (ctx.tableLabel.get(g.seat.tableId) ?? "") : ctx.t("guests.unseated");
    doc.setTextColor(120, 125, 135);
    doc.text(where, tableCol, y, { align: "right" });
    doc.setTextColor(20, 25, 40);
    y += 5.5;
  }

  doc.save(`${ctx.fileBase}-guests.pdf`);
}

/* ------------------------------- cards --------------------------------- */

function seatedSortedByName(ctx: ExportContext): ExportGuest[] {
  return ctx.guests.filter((g) => g.seat).sort((a, b) => a.name.localeCompare(b.name));
}

/** Escort cards: name + which table. Alphabetical, a grid of flat cards. */
export async function exportEscortCardsPdf(ctx: ExportContext): Promise<void> {
  const guests = seatedSortedByName(ctx);
  if (!guests.length) {
    alert(ctx.t("export.noSeated"));
    return;
  }
  const doc = await newDoc("p");
  const { w, h } = pageSize(doc);
  const cols = 2;
  const rows = 5;
  const cw = (w - 2 * MARGIN) / cols;
  const ch = (h - 2 * MARGIN) / rows;

  guests.forEach((g, i) => {
    const slot = i % (cols * rows);
    if (i > 0 && slot === 0) doc.addPage();
    const r = Math.floor(slot / cols);
    const c = slot % cols;
    const x = MARGIN + c * cw;
    const yy = MARGIN + r * ch;

    doc.setDrawColor(210, 214, 222);
    doc.setLineWidth(0.2);
    doc.rect(x + 2, yy + 2, cw - 4, ch - 4);

    const cx = x + cw / 2;
    const lineH = 6.4; // mm between wrapped name lines at 15pt
    const GAP = 9; // guaranteed mm between the name block and the table label

    // Name: top-aligned so long / wrapped names start near the top border (never
    // above it) and always keep the gap above the table label.
    doc.setFont("DejaVu", "bold");
    doc.setFontSize(15);
    doc.setTextColor(20, 25, 40);
    const nameLines = doc.splitTextToSize(g.name, cw - 12).slice(0, 2);
    const nameTop = yy + 11;
    doc.text(nameLines, cx, nameTop, { align: "center" });

    const where = g.seat ? (ctx.tableLabel.get(g.seat.tableId) ?? "") : "";
    if (where) {
      const nameBottom = nameTop + (nameLines.length - 1) * lineH;
      const tableY = Math.min(nameBottom + GAP, yy + ch - 7);
      doc.setFont("DejaVu", "normal");
      doc.setFontSize(10);
      doc.setTextColor(110, 115, 125);
      doc.text(where, cx, tableY, { align: "center" });
    }
  });

  doc.save(`${ctx.fileBase}-escort-cards.pdf`);
}
