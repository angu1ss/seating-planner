import { useState } from "react";
import { useStore, activeSheet } from "../../store";
import { useT } from "../../i18n";
import { objectLabelKey } from "../../constants";
import { Icon } from "../Icon";
import { OBJECT_ICONS } from "../../iconmap";

export function ElementsList() {
  const t = useT();
  const tables = useStore((s) => activeSheet(s).tables);
  const objects = useStore((s) => activeSheet(s).objects);
  const select = useStore((s) => s.select);
  const updateTables = useStore((s) => s.updateTables);
  const updateObjects = useStore((s) => s.updateObjects);
  const removeTables = useStore((s) => s.removeTables);
  const removeObjects = useStore((s) => s.removeObjects);
  const duplicateTables = useStore((s) => s.duplicateTables);
  const duplicateObjects = useStore((s) => s.duplicateObjects);
  const [checked, setChecked] = useState<string[]>([]);

  const items = [
    ...tables.map((tb) => ({
      id: tb.id,
      label: tb.name.trim() || `${t("table.word")} ${tb.number}`,
      locked: tb.locked,
      icon: OBJECT_ICONS[tb.shape === "ellipse" ? "columnRound" : "columnSquare"],
    })),
    ...objects.map((o) => ({
      id: o.id,
      label: o.label.trim() || t(objectLabelKey(o.type)),
      locked: o.locked,
      icon: OBJECT_ICONS[o.type],
    })),
  ];

  if (items.length === 0) return <p className="muted">{t("elements.empty")}</p>;

  const tableSet = new Set(tables.map((tb) => tb.id));
  const allChecked = checked.length === items.length;
  const toggle = (id: string) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const toggleAll = () => setChecked(allChecked ? [] : items.map((i) => i.id));

  const split = (ids: string[]) => ({
    tIds: ids.filter((id) => tableSet.has(id)),
    oIds: ids.filter((id) => !tableSet.has(id)),
  });
  const doDuplicate = () => {
    const { tIds, oIds } = split(checked);
    if (tIds.length) duplicateTables(tIds);
    if (oIds.length) duplicateObjects(oIds);
  };
  const setLocked = (locked: boolean) => {
    const { tIds, oIds } = split(checked);
    if (tIds.length) updateTables(tIds, { locked });
    if (oIds.length) updateObjects(oIds, { locked });
  };
  const doDelete = () => {
    const { tIds, oIds } = split(checked);
    if (tIds.length) removeTables(tIds);
    if (oIds.length) removeObjects(oIds);
    setChecked([]);
  };

  return (
    <>
      <label className="field-inline select-all">
        <input type="checkbox" checked={allChecked} onChange={toggleAll} />
        <span>{t("common.selectAll")}</span>
      </label>
      <div className="obj-list">
        {items.map((it) => (
          <div key={it.id} className={`obj-list-item ${checked.includes(it.id) ? "checked" : ""}`}>
            <input type="checkbox" checked={checked.includes(it.id)} onChange={() => toggle(it.id)} />
            <Icon icon={it.icon} />
            <button className="obj-list-label" onClick={() => select(it.id)}>{it.label}</button>
            {it.locked && (
              <span className="lock-ico" title={t("obj.locked")}>
                <Icon name="lock" />
              </span>
            )}
          </div>
        ))}
      </div>

      {checked.length > 0 && (
        <div className="obj-list-actions">
          <button className="btn" onClick={doDuplicate}>
            <Icon name="duplicate" /> {t("common.duplicate")}
          </button>
          <button className="btn icon-only" title={t("obj.lock")} onClick={() => setLocked(true)}>
            <Icon name="lock" />
          </button>
          <button className="btn icon-only" title={t("obj.unlock")} onClick={() => setLocked(false)}>
            <Icon name="unlock" />
          </button>
          <button className="btn danger" onClick={doDelete}>
            <Icon name="delete" /> {t("common.delete")}
          </button>
        </div>
      )}
    </>
  );
}
