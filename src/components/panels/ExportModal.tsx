import { useState } from "react";
import { useStore } from "../../store";
import { useT, useI18n } from "../../i18n";
import { useEscClose } from "../../utils/useEscClose";
import { slugify } from "../../utils/file";
import { Icon } from "../Icon";
import {
  exportGuestListPdf,
  exportEscortCardsPdf,
  type ExportContext,
  type ExportGuest,
  type ExportHall,
} from "../../export/pdf";

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Snapshot the store into a plain, render-independent context for the exporters. */
function buildContext(t: (k: string) => string, lang: string): ExportContext {
  const s = useStore.getState();
  const { project } = s;
  const multiHall = s.sheets.length > 1;
  const hallName = (sh: { name: string }, i: number) => sh.name.trim() || `${t("left.hall")} ${i + 1}`;
  const labelOf = (tb: { name: string; number: number }) =>
    tb.name.trim() || `${t("table.word")} ${tb.number}`;

  const halls: ExportHall[] = s.sheets.map((sh, i) => ({
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

  const guests: ExportGuest[] = s.guests.map((g) => ({
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

export function ExportModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const [busy, setBusy] = useState<string | null>(null);
  useEscClose(onClose, busy === null);

  const run = (key: string, fn: (ctx: ExportContext) => Promise<void>) => async () => {
    if (busy) return;
    setBusy(key);
    try {
      await fn(buildContext(t, lang));
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const items = [
    { key: "guests", label: t("export.guestList"), hint: t("export.guestListHint"), fn: exportGuestListPdf },
    { key: "escort", label: t("export.escortCards"), hint: t("export.escortHint"), fn: exportEscortCardsPdf },
  ];

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal export-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{t("export.title")}</h2>
          <button className="icon-btn" onClick={onClose} disabled={!!busy} aria-label={t("common.close")}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <p className="muted export-hint">{t("export.hint")}</p>
          <div className="export-grid">
            {items.map((it) => (
              <button
                key={it.key}
                className="export-card"
                onClick={run(it.key, it.fn)}
                disabled={!!busy}
              >
                <Icon name="pdf" />
                <span className="export-card-label">{it.label}</span>
                <span className="export-card-hint">
                  {busy === it.key ? t("export.generating") : it.hint}
                </span>
              </button>
            ))}
          </div>
          <p className="muted export-print-note">
            <Icon name="pdf" /> {t("export.planPrint")}
          </p>
        </div>
      </div>
    </div>
  );
}
