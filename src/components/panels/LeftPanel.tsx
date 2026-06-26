import { useStore } from "../../store";
import { TABLE_PRESETS, VENUE_PRESETS } from "../../constants";

export function LeftPanel() {
  const venue = useStore((s) => s.venue);
  const setVenue = useStore((s) => s.setVenue);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const addTable = useStore((s) => s.addTable);

  return (
    <div className="panel">
      <section className="panel-section">
        <h3>Добавить стол</h3>
        <div className="preset-grid">
          {TABLE_PRESETS.map((p) => (
            <button key={p.id} className="preset-btn" onClick={() => addTable(p)} title={p.label}>
              <span className={p.shape === "ellipse" ? "preset-ico round" : "preset-ico rect"} />
              <span className="preset-label">{p.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <h3>Зал</h3>
        <div className="preset-row">
          {VENUE_PRESETS.map((v) => (
            <button
              key={v.id}
              className="chip"
              onClick={() => setVenue({ width: v.width, height: v.height })}
            >
              {v.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Ширина, м</span>
          <input
            type="number"
            min={1}
            step={0.1}
            value={venue.width}
            onChange={(e) => setVenue({ width: Math.max(1, Number(e.target.value)) })}
          />
        </label>
        <label className="field">
          <span>Длина, м</span>
          <input
            type="number"
            min={1}
            step={0.1}
            value={venue.height}
            onChange={(e) => setVenue({ height: Math.max(1, Number(e.target.value)) })}
          />
        </label>
        <label className="field">
          <span>Шаг сетки, м</span>
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
          <span>Привязка к сетке</span>
        </label>
      </section>

      <section className="panel-section">
        <h3>Параметры</h3>
        <label className="field">
          <span>Стул по умолчанию</span>
          <select
            value={settings.chairStyle}
            onChange={(e) => setSettings({ chairStyle: e.target.value as "round" | "square" })}
          >
            <option value="round">Круглый</option>
            <option value="square">Квадратный</option>
          </select>
        </label>
        <label className="field">
          <span>Мин. место на гостя, м</span>
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
