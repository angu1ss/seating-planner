import { useStore } from "../../store";
import type { ChairStyle, Side, TableShape } from "../../types";
import { isTight, maxComfortableSeats, seatSpacing } from "../../geometry";

const SIDES: { key: Side; label: string }[] = [
  { key: "top", label: "Верх" },
  { key: "right", label: "Право" },
  { key: "bottom", label: "Низ" },
  { key: "left", label: "Лево" },
];

export function TablePanel() {
  const selectedId = useStore((s) => s.selectedId);
  const table = useStore((s) => s.tables.find((t) => t.id === s.selectedId) ?? null);
  const minSpacing = useStore((s) => s.settings.minSeatSpacing);
  const updateTable = useStore((s) => s.updateTable);
  const removeTable = useStore((s) => s.removeTable);
  const duplicateTable = useStore((s) => s.duplicateTable);

  if (!selectedId || !table) {
    return (
      <div className="panel">
        <div className="empty-hint">
          <p>Стол не выбран.</p>
          <p className="muted">Добавьте стол слева и кликните по нему на холсте, чтобы изменить свойства.</p>
        </div>
      </div>
    );
  }

  const tight = isTight(table, minSpacing);
  const spacing = seatSpacing(table);
  const maxSeats = maxComfortableSeats(table, minSpacing);

  const toggleSide = (side: Side, on: boolean) => {
    const set = new Set(table.disabledSides);
    if (on) set.delete(side);
    else set.add(side);
    updateTable(table.id, { disabledSides: Array.from(set) });
  };

  return (
    <div className="panel">
      <section className="panel-section">
        <h3>Стол</h3>
        <label className="field">
          <span>Название</span>
          <input value={table.name} onChange={(e) => updateTable(table.id, { name: e.target.value })} />
        </label>
        <label className="field">
          <span>Форма</span>
          <select
            value={table.shape}
            onChange={(e) => updateTable(table.id, { shape: e.target.value as TableShape })}
          >
            <option value="rect">Прямоугольный</option>
            <option value="ellipse">Эллипс / круг</option>
          </select>
        </label>
        <div className="field-2col">
          <label className="field">
            <span>{table.shape === "ellipse" ? "Ось X, м" : "Ширина, м"}</span>
            <input
              type="number"
              min={0.3}
              step={0.1}
              value={table.w}
              onChange={(e) => updateTable(table.id, { w: Math.max(0.3, Number(e.target.value)) })}
            />
          </label>
          <label className="field">
            <span>{table.shape === "ellipse" ? "Ось Y, м" : "Длина, м"}</span>
            <input
              type="number"
              min={0.3}
              step={0.1}
              value={table.h}
              onChange={(e) => updateTable(table.id, { h: Math.max(0.3, Number(e.target.value)) })}
            />
          </label>
        </div>
        <label className="field">
          <span>Поворот, °</span>
          <input
            type="number"
            step={5}
            value={table.rotation}
            onChange={(e) => updateTable(table.id, { rotation: Number(e.target.value) % 360 })}
          />
        </label>
      </section>

      <section className="panel-section">
        <h3>Места</h3>
        <div className="stepper">
          <button onClick={() => updateTable(table.id, { seatCount: Math.max(0, table.seatCount - 1) })}>−</button>
          <span className="stepper-val">{table.seatCount}</span>
          <button onClick={() => updateTable(table.id, { seatCount: table.seatCount + 1 })}>+</button>
        </div>
        <p className={tight ? "warn" : "muted"}>
          Шаг места: {spacing.toFixed(2)} м · комфортно до {maxSeats} мест
          {tight ? " · тесно!" : ""}
        </p>
        <label className="field">
          <span>Стул</span>
          <select
            value={table.chairStyle ?? "inherit"}
            onChange={(e) =>
              updateTable(table.id, {
                chairStyle: e.target.value === "inherit" ? null : (e.target.value as ChairStyle),
              })
            }
          >
            <option value="inherit">Как в проекте</option>
            <option value="round">Круглый</option>
            <option value="square">Квадратный</option>
          </select>
        </label>

        {table.shape === "rect" && (
          <div className="sides">
            <span className="field-caption">Активные стороны</span>
            <div className="sides-grid">
              {SIDES.map((s) => (
                <label key={s.key} className="field-inline">
                  <input
                    type="checkbox"
                    checked={!table.disabledSides.includes(s.key)}
                    onChange={(e) => toggleSide(s.key, e.target.checked)}
                  />
                  <span>{s.label}</span>
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
            checked={table.isPodium}
            onChange={(e) => updateTable(table.id, { isPodium: e.target.checked })}
          />
          <span>Подиум (выше уровня пола)</span>
        </label>
      </section>

      <section className="panel-section row-actions">
        <button className="btn" onClick={() => duplicateTable(table.id)}>Дублировать</button>
        <button className="btn danger" onClick={() => removeTable(table.id)}>Удалить</button>
      </section>
    </div>
  );
}
