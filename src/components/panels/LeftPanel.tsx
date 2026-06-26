import { useEffect, useState } from "react";
import { useStore } from "../../store";
import { useT } from "../../i18n";
import { VENUE_PRESETS, venuePresetLabel } from "../../constants";
import { clampTableCenter, tableOuterExtent, tablesThatDontFit } from "../../geometry";

interface Props {
  onAddTable: () => void;
}

export function LeftPanel({ onAddTable }: Props) {
  const t = useT();
  const venue = useStore((s) => s.venue);
  const setVenue = useStore((s) => s.setVenue);
  const tables = useStore((s) => s.tables);
  const setPositions = useStore((s) => s.setPositions);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);

  // Venue size is edited as a draft and committed via "Apply".
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
    // Pull any out-of-bounds tables back inside the new walls.
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
    <div className="panel">
      <section className="panel-section">
        <button className="btn primary block" onClick={onAddTable}>＋ {t("left.addTable")}</button>
      </section>

      <section className="panel-section">
        <h3>{t("left.hall")}</h3>
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
        {error && <p className="warn">{t("left.tablesDontFit").replace("{n}", error)}</p>}
        <button className="btn primary block" disabled={!dirty} onClick={applySize}>
          {t("left.apply")}
        </button>
      </section>

      <section className="panel-section">
        <h3>{t("left.parameters")}</h3>
        <label className="field">
          <span>{t("left.gridStep")}</span>
          <select value={venue.gridStep} onChange={(e) => setVenue({ gridStep: Number(e.target.value) })}>
            <option value={0.1}>0.1</option>
            <option value={0.25}>0.25</option>
            <option value={0.5}>0.5</option>
            <option value={1}>1.0</option>
          </select>
        </label>
        <label className="field-inline">
          <input
            type="checkbox"
            checked={venue.snapToGrid}
            onChange={(e) => setVenue({ snapToGrid: e.target.checked })}
          />
          <span>{t("left.snapToGrid")}</span>
        </label>
        <label className="field">
          <span>{t("left.defaultChair")}</span>
          <select
            value={settings.chairStyle}
            onChange={(e) => setSettings({ chairStyle: e.target.value as "round" | "square" })}
          >
            <option value="round">{t("chair.round")}</option>
            <option value="square">{t("chair.square")}</option>
          </select>
        </label>
        <label className="field">
          <span>{t("left.minSpacing")}</span>
          <input
            type="number"
            min={0.3}
            step={0.05}
            value={settings.minSeatSpacing}
            onChange={(e) => setSettings({ minSeatSpacing: Math.max(0.3, Number(e.target.value)) })}
          />
        </label>
      </section>
    </div>
  );
}
