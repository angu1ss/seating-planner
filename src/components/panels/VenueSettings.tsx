import { useEffect, useState } from "react";
import { useStore, activeSheet } from "../../store";
import { useT } from "../../i18n";
import { VENUE_PRESETS, venuePresetLabel } from "../../constants";
import { clampTableCenter, tableOuterExtent, tablesThatDontFit } from "../../geometry";

export function VenueSettings() {
  const t = useT();
  const venue = useStore((s) => activeSheet(s).venue);
  const setVenue = useStore((s) => s.setVenue);
  const tables = useStore((s) => activeSheet(s).tables);
  const setPositions = useStore((s) => s.setPositions);

  const [draft, setDraft] = useState({ width: venue.width, height: venue.height });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft({ width: venue.width, height: venue.height });
    setError(null);
  }, [venue.width, venue.height]);

  const dirty = draft.width !== venue.width || draft.height !== venue.height;

  const applySize = () => {
    const offenders = tablesThatDontFit(tables, draft.width, draft.height);
    if (offenders.length) {
      setError(offenders.join(", "));
      return;
    }
    setPositions(
      tables.map((tb) => {
        const e = tableOuterExtent(tb);
        return {
          id: tb.id,
          x: clampTableCenter(tb.x, e.rx, draft.width),
          y: clampTableCenter(tb.y, e.ry, draft.height),
        };
      }),
    );
    setVenue({ width: draft.width, height: draft.height });
    setError(null);
  };

  return (
    <>
      <div className="preset-row">
        {VENUE_PRESETS.map((v) => (
          <button
            key={v.id}
            className={`chip ${draft.width === v.width && draft.height === v.height ? "active" : ""}`}
            onClick={() => {
              setDraft({ width: v.width, height: v.height });
              setError(null);
            }}
          >
            {venuePresetLabel(v, t)}
          </button>
        ))}
      </div>
      <div className="field-2col">
        <label className="field">
          <span>{t("left.width")}</span>
          <input
            type="number"
            min={1}
            step={0.1}
            value={draft.width}
            onChange={(e) => setDraft((d) => ({ ...d, width: Math.max(1, Number(e.target.value)) }))}
          />
        </label>
        <label className="field">
          <span>{t("left.length")}</span>
          <input
            type="number"
            min={1}
            step={0.1}
            value={draft.height}
            onChange={(e) => setDraft((d) => ({ ...d, height: Math.max(1, Number(e.target.value)) }))}
          />
        </label>
      </div>
      {error && <p className="warn">{t("left.tablesDontFit").replace("{n}", error)}</p>}
      <button className="btn primary block" disabled={!dirty} onClick={applySize}>
        {t("left.apply")}
      </button>
    </>
  );
}
