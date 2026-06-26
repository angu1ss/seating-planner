import { useStore } from "../../store";
import { useT } from "../../i18n";
import { Icon } from "../Icon";
import type { ChairStyle, Side, TableModel, TableShape } from "../../types";
import { isTight, maxComfortableSeats, seatSpacing } from "../../geometry";

const SIDES: { key: Side; labelKey: string }[] = [
  { key: "top", labelKey: "side.top" },
  { key: "right", labelKey: "side.right" },
  { key: "bottom", labelKey: "side.bottom" },
  { key: "left", labelKey: "side.left" },
];

const MIXED = "__mixed__" as const;
type Maybe<T> = T | typeof MIXED;

function common<T>(vals: T[]): Maybe<T> {
  return vals.every((v) => v === vals[0]) ? vals[0] : MIXED;
}

export function TablePanel() {
  const t = useT();
  const selectedIds = useStore((s) => s.selectedIds);
  const tables = useStore((s) => s.tables);
  const minSpacing = useStore((s) => s.settings.minSeatSpacing);
  const updateTable = useStore((s) => s.updateTable);
  const updateTables = useStore((s) => s.updateTables);
  const removeTable = useStore((s) => s.removeTable);
  const duplicateTable = useStore((s) => s.duplicateTable);
  const duplicateSelected = useStore((s) => s.duplicateSelected);
  const deleteSelected = useStore((s) => s.deleteSelected);

  const selected = tables.filter((tb) => selectedIds.includes(tb.id));

  if (selected.length === 0) return null;

  if (selected.length > 1) {
    return <MultiEditor tables={selected} />;
  }

  const table = selected[0];
  const locked = table.locked;
  const tight = isTight(table, minSpacing);
  const spacing = seatSpacing(table);
  const maxSeats = maxComfortableSeats(table, minSpacing);
  const m = t("unit.m");

  const toggleSide = (side: Side, on: boolean) => {
    const set = new Set(table.disabledSides);
    if (on) set.delete(side);
    else set.add(side);
    updateTable(table.id, { disabledSides: Array.from(set) });
  };

  return (
    <div className="panel">
      <section className="panel-section">
        <div className="panel-head-row">
          <h3>{`${t("table.word")} ${table.number}`}</h3>
          <button
            className={`btn lock-btn ${locked ? "primary" : ""}`}
            onClick={() => updateTable(table.id, { locked: !locked })}
          >
            <Icon name={locked ? "unlock" : "lock"} /> {locked ? t("table.unlock") : t("table.lock")}
          </button>
        </div>
        <label className="field">
          <span>{t("table.name")}</span>
          <input
            value={table.name}
            disabled={locked}
            placeholder={`${t("table.word")} ${table.number}`}
            onChange={(e) => updateTable(table.id, { name: e.target.value })}
          />
        </label>
        <label className="field">
          <span>{t("table.shape")}</span>
          <select
            value={table.shape}
            disabled={locked}
            onChange={(e) => updateTable(table.id, { shape: e.target.value as TableShape })}
          >
            <option value="rect">{t("shape.rect")}</option>
            <option value="ellipse">{t("shape.round")}</option>
          </select>
        </label>
        <div className="field-2col">
          <label className="field">
            <span>{table.shape === "ellipse" ? t("table.axisX") : t("left.width")}</span>
            <input
              type="number"
              min={0.3}
              step={0.1}
              disabled={locked}
              value={table.w}
              onChange={(e) => updateTable(table.id, { w: Math.max(0.3, Number(e.target.value)) })}
            />
          </label>
          <label className="field">
            <span>{table.shape === "ellipse" ? t("table.axisY") : t("left.length")}</span>
            <input
              type="number"
              min={0.3}
              step={0.1}
              disabled={locked}
              value={table.h}
              onChange={(e) => updateTable(table.id, { h: Math.max(0.3, Number(e.target.value)) })}
            />
          </label>
        </div>
        <label className="field">
          <span>{t("table.rotation")}</span>
          <input
            type="number"
            step={5}
            disabled={locked}
            value={table.rotation}
            onChange={(e) => updateTable(table.id, { rotation: Number(e.target.value) % 360 })}
          />
        </label>
      </section>

      <section className="panel-section">
        <h3>{t("table.seats")}</h3>
        <div className="stepper">
          <button disabled={locked} onClick={() => updateTable(table.id, { seatCount: Math.max(0, table.seatCount - 1) })}>−</button>
          <span className="stepper-val">{table.seatCount}</span>
          <button disabled={locked} onClick={() => updateTable(table.id, { seatCount: table.seatCount + 1 })}>+</button>
        </div>
        <p className={tight ? "warn" : "muted"}>
          {t("table.seatStep")}: {spacing.toFixed(2)} {m} · {t("table.comfortUpTo")} {maxSeats}{" "}
          {t("table.seatsShort")}
          {tight ? ` · ${t("table.tight")}` : ""}
        </p>
        <label className="field">
          <span>{t("table.chair")}</span>
          <select
            value={table.chairStyle ?? "inherit"}
            disabled={locked}
            onChange={(e) =>
              updateTable(table.id, {
                chairStyle: e.target.value === "inherit" ? null : (e.target.value as ChairStyle),
              })
            }
          >
            <option value="inherit">{t("chair.inherit")}</option>
            <option value="round">{t("chair.round")}</option>
            <option value="square">{t("chair.square")}</option>
          </select>
        </label>

        {table.shape === "rect" && (
          <div className="sides">
            <span className="field-caption">{t("table.activeSides")}</span>
            <div className="sides-grid">
              {SIDES.map((s) => (
                <label key={s.key} className="field-inline">
                  <input
                    type="checkbox"
                    disabled={locked}
                    checked={!table.disabledSides.includes(s.key)}
                    onChange={(e) => toggleSide(s.key, e.target.checked)}
                  />
                  <span>{t(s.labelKey)}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel-section">
        <label className="field-inline">
          <input
            type="checkbox"
            disabled={locked}
            checked={table.isPodium}
            onChange={(e) => updateTable(table.id, { isPodium: e.target.checked })}
          />
          <span>{t("table.podium")}</span>
        </label>
      </section>

      <section className="panel-section row-actions">
        <button className="btn" onClick={() => duplicateTable(table.id)}><Icon name="duplicate" /> {t("common.duplicate")}</button>
        <button className="btn danger" disabled={locked} onClick={() => removeTable(table.id)}><Icon name="delete" /> {t("common.delete")}</button>
      </section>
    </div>
  );

  function MultiEditor({ tables: sel }: { tables: TableModel[] }) {
    const ids = sel.map((tb) => tb.id);
    const cShape = common(sel.map((tb) => tb.shape));
    const cW = common(sel.map((tb) => tb.w));
    const cH = common(sel.map((tb) => tb.h));
    const cRot = common(sel.map((tb) => tb.rotation));
    const cSeat = common(sel.map((tb) => tb.seatCount));
    const cChair = common(sel.map((tb) => tb.chairStyle));
    const cPodium = common(sel.map((tb) => tb.isPodium));
    const mix = t("table.mixed");
    const m = t("unit.m");

    const isEllipse = cShape === "ellipse";
    const hintTable =
      cShape !== MIXED && cW !== MIXED && cH !== MIXED && cSeat !== MIXED
        ? { ...sel[0], shape: cShape, w: cW, h: cH, seatCount: cSeat }
        : null;

    return (
      <div className="panel">
        <section className="panel-section">
          <h3>{`${t("table.selected")}: ${sel.length}`}</h3>
          <p className="muted">{t("table.bulkHint")}</p>
          <label className="field">
            <span>{t("table.shape")}</span>
            <select
              value={cShape === MIXED ? "" : cShape}
              disabled={cShape === MIXED}
              onChange={(e) => updateTables(ids, { shape: e.target.value as TableShape })}
            >
              {cShape === MIXED && <option value="">{mix}</option>}
              <option value="rect">{t("shape.rect")}</option>
              <option value="ellipse">{t("shape.round")}</option>
            </select>
          </label>
          <div className="field-2col">
            <label className="field">
              <span>{isEllipse ? t("table.axisX") : t("left.width")}</span>
              <input
                type="number"
                min={0.3}
                step={0.1}
                disabled={cW === MIXED}
                value={cW === MIXED ? "" : cW}
                placeholder={mix}
                onChange={(e) => updateTables(ids, { w: Math.max(0.3, Number(e.target.value)) })}
              />
            </label>
            <label className="field">
              <span>{isEllipse ? t("table.axisY") : t("left.length")}</span>
              <input
                type="number"
                min={0.3}
                step={0.1}
                disabled={cH === MIXED}
                value={cH === MIXED ? "" : cH}
                placeholder={mix}
                onChange={(e) => updateTables(ids, { h: Math.max(0.3, Number(e.target.value)) })}
              />
            </label>
          </div>
          <label className="field">
            <span>{t("table.rotation")}</span>
            <input
              type="number"
              step={5}
              disabled={cRot === MIXED}
              value={cRot === MIXED ? "" : cRot}
              placeholder={mix}
              onChange={(e) => updateTables(ids, { rotation: Number(e.target.value) % 360 })}
            />
          </label>
        </section>

        <section className="panel-section">
          <h3>{t("table.seats")}</h3>
          <div className="stepper">
            <button
              disabled={cSeat === MIXED}
              onClick={() => typeof cSeat === "number" && updateTables(ids, { seatCount: Math.max(0, cSeat - 1) })}
            >
              −
            </button>
            <span className="stepper-val">{cSeat === MIXED ? mix : cSeat}</span>
            <button
              disabled={cSeat === MIXED}
              onClick={() => typeof cSeat === "number" && updateTables(ids, { seatCount: cSeat + 1 })}
            >
              +
            </button>
          </div>
          {hintTable && (
            <p className={isTight(hintTable, minSpacing) ? "warn" : "muted"}>
              {t("table.seatStep")}: {seatSpacing(hintTable).toFixed(2)} {m} · {t("table.comfortUpTo")}{" "}
              {maxComfortableSeats(hintTable, minSpacing)} {t("table.seatsShort")}
              {isTight(hintTable, minSpacing) ? ` · ${t("table.tight")}` : ""}
            </p>
          )}
          <label className="field">
            <span>{t("table.chair")}</span>
            <select
              disabled={cChair === MIXED}
              value={cChair === MIXED ? "" : cChair === null ? "inherit" : cChair}
              onChange={(e) =>
                updateTables(ids, {
                  chairStyle: e.target.value === "inherit" ? null : (e.target.value as ChairStyle),
                })
              }
            >
              {cChair === MIXED && <option value="">{mix}</option>}
              <option value="inherit">{t("chair.inherit")}</option>
              <option value="round">{t("chair.round")}</option>
              <option value="square">{t("chair.square")}</option>
            </select>
          </label>
        </section>

        <section className="panel-section">
          <label className="field-inline">
            <input
              type="checkbox"
              disabled={cPodium === MIXED}
              checked={cPodium === true}
              onChange={(e) => updateTables(ids, { isPodium: e.target.checked })}
            />
            <span>{t("table.podium")}</span>
          </label>
        </section>

        <section className="panel-section row-actions">
          <button className="btn" onClick={() => duplicateSelected()}><Icon name="duplicate" /> {t("common.duplicate")}</button>
          <button className="btn icon-only" title={t("table.lock")} onClick={() => updateTables(ids, { locked: true })}>
            <Icon name="lock" />
          </button>
          <button className="btn icon-only" title={t("table.unlock")} onClick={() => updateTables(ids, { locked: false })}>
            <Icon name="unlock" />
          </button>
          <button className="btn danger" onClick={() => deleteSelected()}><Icon name="delete" /> {t("common.delete")}</button>
        </section>
      </div>
    );
  }
}
