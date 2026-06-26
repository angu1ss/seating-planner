import { useStore, activeSheet } from "../../store";
import { useT } from "../../i18n";
import { Icon } from "../Icon";
import type { ChairStyle, Side, TableModel, TableShape } from "../../types";
import { isTight, maxComfortableSeats, seatSpacing, snakeLength, weldedSidesFor } from "../../geometry";
import { defaultSnakePath } from "../../constants";
import { CHAIR_ICONS, SHAPE_ICONS } from "../../iconmap";
import { IconSelect } from "./IconSelect";

const SNAKE_SIDES: { key: Side; labelKey: string }[] = [
  { key: "right", labelKey: "snake.sideA" },
  { key: "left", labelKey: "snake.sideB" },
];

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
  const tables = useStore((s) => activeSheet(s).tables);
  const minSpacing = useStore((s) => s.settings.minSeatSpacing);
  const updateTable = useStore((s) => s.updateTable);
  const updateTables = useStore((s) => s.updateTables);
  const removeTable = useStore((s) => s.removeTable);
  const duplicateTable = useStore((s) => s.duplicateTable);
  const duplicateSelected = useStore((s) => s.duplicateSelected);
  const deleteSelected = useStore((s) => s.deleteSelected);
  const weldSelected = useStore((s) => s.weldSelected);
  const unweldSelected = useStore((s) => s.unweldSelected);
  const addSnakeNodeEnd = useStore((s) => s.addSnakeNodeEnd);
  const removeSnakeNodeEnd = useStore((s) => s.removeSnakeNodeEnd);
  const setSnakeNodeCount = useStore((s) => s.setSnakeNodeCount);

  const selected = tables.filter((tb) => selectedIds.includes(tb.id));

  if (selected.length === 0) return null;

  if (selected.length > 1) {
    return <MultiEditor tables={selected} />;
  }

  const table = selected[0];
  const locked = table.locked;
  const isSnake = table.shape === "snake";
  // Sides joined to a welded neighbour: shown unchecked & locked (seats hidden there).
  const welded =
    table.shape === "rect" && table.groupId
      ? weldedSidesFor(table, tables.filter((tb) => tb.groupId === table.groupId))
      : [];

  let tight: boolean;
  let spacing: number;
  let maxSeats: number;
  if (isSnake) {
    const length = snakeLength(table.path ?? []);
    const sidesOn = (table.disabledSides.includes("right") ? 0 : 1) + (table.disabledSides.includes("left") ? 0 : 1);
    spacing = sidesOn > 0 && table.seatCount > 0 ? (length * sidesOn) / table.seatCount : Infinity;
    maxSeats = minSpacing > 0 && sidesOn > 0 ? Math.floor((length * sidesOn) / minSpacing) : table.seatCount;
    tight = table.seatCount > 0 && spacing < minSpacing - 1e-9;
  } else {
    tight = isTight(table, minSpacing, welded);
    spacing = seatSpacing(table, welded);
    maxSeats = maxComfortableSeats(table, minSpacing, welded);
  }
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
        <div className="field">
          <span>{t("table.shape")}</span>
          <IconSelect
            ariaLabel={t("table.shape")}
            disabled={locked}
            value={table.shape}
            onChange={(v) => {
              const shape = v as TableShape;
              updateTable(
                table.id,
                shape === "snake" && !table.path ? { shape, path: defaultSnakePath() } : { shape },
              );
            }}
            options={[
              { value: "rect", label: t("shape.rect"), icon: SHAPE_ICONS.rect },
              { value: "ellipse", label: t("shape.round"), icon: SHAPE_ICONS.ellipse },
              { value: "snake", label: t("shape.snake"), icon: SHAPE_ICONS.snake },
            ]}
          />
        </div>
        {isSnake ? (
          <label className="field">
            <span>{t("snake.band")}</span>
            <input
              type="number"
              min={0.3}
              step={0.1}
              disabled={locked}
              value={table.h}
              onChange={(e) => updateTable(table.id, { h: Math.max(0.3, Number(e.target.value)) })}
            />
          </label>
        ) : (
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
        )}
        {!isSnake && (
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
        )}
      </section>

      <section className="panel-section">
        <h3>{t("table.seats")}</h3>
        <div className="stepper">
          <button disabled={locked} onClick={() => updateTable(table.id, { seatCount: Math.max(0, table.seatCount - 1) })}>−</button>
          <span className="stepper-val">{table.seatCount}</span>
          <button disabled={locked} onClick={() => updateTable(table.id, { seatCount: table.seatCount + 1 })}>+</button>
        </div>
        <p className={tight ? "warn" : "muted"}>
          {t("table.seatStep")}: {Number.isFinite(spacing) ? spacing.toFixed(2) : "—"} {m} ·{" "}
          {t("table.comfortUpTo")} {maxSeats} {t("table.seatsShort")}
          {tight ? ` · ${t("table.tight")}` : ""}
        </p>
        <div className="field">
          <span>{t("table.chair")}</span>
          <IconSelect
            ariaLabel={t("table.chair")}
            disabled={locked}
            value={table.chairStyle ?? "inherit"}
            onChange={(v) =>
              updateTable(table.id, { chairStyle: v === "inherit" ? null : (v as ChairStyle) })
            }
            options={[
              { value: "inherit", label: t("chair.inherit") },
              { value: "round", label: t("chair.round"), icon: CHAIR_ICONS.round },
              { value: "square", label: t("chair.square"), icon: CHAIR_ICONS.square },
            ]}
          />
        </div>

        {table.shape === "rect" && (
          <div className="sides">
            <span className="field-caption">{t("table.activeSides")}</span>
            <div className="sides-grid">
              {SIDES.map((s) => {
                const weldedSide = welded.includes(s.key);
                return (
                  <label key={s.key} className="field-inline">
                    <input
                      type="checkbox"
                      disabled={locked || weldedSide}
                      checked={!table.disabledSides.includes(s.key) && !weldedSide}
                      onChange={(e) => toggleSide(s.key, e.target.checked)}
                    />
                    <span>{t(s.labelKey)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {isSnake && (
          <div className="sides">
            <span className="field-caption">{t("table.activeSides")}</span>
            <div className="sides-grid">
              {SNAKE_SIDES.map((s) => (
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

        {isSnake && (
          <label className="field">
            <span>{t("snake.nodes")}</span>
            <div className="stepper">
              <button
                disabled={locked || (table.path?.length ?? 0) >= 20}
                onClick={() => addSnakeNodeEnd(table.id)}
              >
                +
              </button>
              <input
                className="stepper-input"
                type="number"
                min={3}
                max={20}
                disabled={locked}
                value={table.path?.length ?? 0}
                onChange={(e) => setSnakeNodeCount(table.id, Number(e.target.value))}
              />
              <button
                disabled={locked || (table.path?.length ?? 0) <= 3}
                onClick={() => removeSnakeNodeEnd(table.id)}
              >
                −
              </button>
            </div>
          </label>
        )}
        {isSnake && <p className="muted">{t("snake.editHint")}</p>}
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

      <section className="panel-section actions-col">
        <button className="btn block" onClick={() => duplicateTable(table.id)}><Icon name="duplicate" /> {t("common.duplicate")}</button>
        <div className="row-actions">
          {table.groupId && (
            <button className="btn" onClick={() => unweldSelected()}><Icon name="unweld" /> {t("table.unweld")}</button>
          )}
          <button className="btn danger" disabled={locked} onClick={() => removeTable(table.id)}><Icon name="delete" /> {t("common.delete")}</button>
        </div>
      </section>
    </div>
  );

  function MultiEditor({ tables: sel }: { tables: TableModel[] }) {
    const ids = sel.map((tb) => tb.id);
    const rectCount = sel.filter((tb) => tb.shape === "rect").length;
    const anyGrouped = sel.some((tb) => tb.groupId);
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
          <div className="field">
            <span>{t("table.shape")}</span>
            <IconSelect
              ariaLabel={t("table.shape")}
              disabled={cShape === MIXED}
              value={cShape === MIXED ? "" : cShape}
              onChange={(v) => v && updateTables(ids, { shape: v as TableShape })}
              options={[
                ...(cShape === MIXED ? [{ value: "", label: mix }] : []),
                { value: "rect", label: t("shape.rect"), icon: SHAPE_ICONS.rect },
                { value: "ellipse", label: t("shape.round"), icon: SHAPE_ICONS.ellipse },
              ]}
            />
          </div>
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
          <div className="field">
            <span>{t("table.chair")}</span>
            <IconSelect
              ariaLabel={t("table.chair")}
              disabled={cChair === MIXED}
              value={cChair === MIXED ? "" : cChair === null ? "inherit" : cChair}
              onChange={(v) => {
                if (cChair === MIXED && v === "") return;
                updateTables(ids, { chairStyle: v === "inherit" ? null : (v as ChairStyle) });
              }}
              options={[
                ...(cChair === MIXED ? [{ value: "", label: mix }] : []),
                { value: "inherit", label: t("chair.inherit") },
                { value: "round", label: t("chair.round"), icon: CHAIR_ICONS.round },
                { value: "square", label: t("chair.square"), icon: CHAIR_ICONS.square },
              ]}
            />
          </div>
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

        {(rectCount >= 2 || anyGrouped) && (
          <section className="panel-section row-actions">
            {rectCount >= 2 && (
              <button className="btn" onClick={() => weldSelected()} title={t("table.weldHint")}>
                <Icon name="weld" /> {t("table.weld")}
              </button>
            )}
            {anyGrouped && (
              <button className="btn" onClick={() => unweldSelected()}>
                <Icon name="unweld" /> {t("table.unweld")}
              </button>
            )}
          </section>
        )}

        <section className="panel-section actions-col">
          <button className="btn block" onClick={() => duplicateSelected()}><Icon name="duplicate" /> {t("common.duplicate")}</button>
          <div className="row-actions">
            <button className="btn icon-only" title={t("table.lock")} onClick={() => updateTables(ids, { locked: true })}>
              <Icon name="lock" />
            </button>
            <button className="btn icon-only" title={t("table.unlock")} onClick={() => updateTables(ids, { locked: false })}>
              <Icon name="unlock" />
            </button>
            <button className="btn danger" onClick={() => deleteSelected()}><Icon name="delete" /> {t("common.delete")}</button>
          </div>
        </section>
      </div>
    );
  }
}
