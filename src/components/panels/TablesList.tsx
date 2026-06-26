import { useState } from "react";
import { useStore } from "../../store";
import { useT } from "../../i18n";
import { Icon } from "../Icon";

export function TablesList() {
  const t = useT();
  const tables = useStore((s) => s.tables);
  const select = useStore((s) => s.select);
  const removeTables = useStore((s) => s.removeTables);
  const duplicateTables = useStore((s) => s.duplicateTables);
  const updateTables = useStore((s) => s.updateTables);
  const [checked, setChecked] = useState<string[]>([]);

  if (tables.length === 0) return <p className="muted">{t("table.listEmpty")}</p>;

  const toggle = (id: string) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const clear = () => setChecked([]);

  return (
    <>
      <div className="obj-list">
        {tables.map((tb) => (
          <div key={tb.id} className={`obj-list-item ${checked.includes(tb.id) ? "checked" : ""}`}>
            <input type="checkbox" checked={checked.includes(tb.id)} onChange={() => toggle(tb.id)} />
            <button className="obj-list-label" onClick={() => select(tb.id)}>
              {tb.name.trim() || `${t("table.word")} ${tb.number}`}
            </button>
            {tb.locked && (
              <span className="lock-ico" title={t("table.lock")}>
                <Icon name="lock" />
              </span>
            )}
          </div>
        ))}
      </div>

      {checked.length > 0 && (
        <div className="obj-list-actions">
          <button className="btn" onClick={() => duplicateTables(checked)}>
            <Icon name="duplicate" /> {t("common.duplicate")}
          </button>
          <button className="btn icon-only" title={t("table.lock")} onClick={() => updateTables(checked, { locked: true })}>
            <Icon name="lock" />
          </button>
          <button className="btn icon-only" title={t("table.unlock")} onClick={() => updateTables(checked, { locked: false })}>
            <Icon name="unlock" />
          </button>
          <button
            className="btn danger"
            onClick={() => {
              removeTables(checked);
              clear();
            }}
          >
            <Icon name="delete" /> {t("common.delete")}
          </button>
        </div>
      )}
    </>
  );
}
