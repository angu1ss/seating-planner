import { useState } from "react";
import { useStore } from "../../store";
import { useT } from "../../i18n";
import { objectLabelKey } from "../../constants";
import { LockIcon } from "../icons";

export function ObjectsList() {
  const t = useT();
  const objects = useStore((s) => s.objects);
  const selectObject = useStore((s) => s.selectObject);
  const removeObjects = useStore((s) => s.removeObjects);
  const duplicateObjects = useStore((s) => s.duplicateObjects);
  const updateObjects = useStore((s) => s.updateObjects);
  const [checked, setChecked] = useState<string[]>([]);

  if (objects.length === 0) return <p className="muted">{t("obj.listEmpty")}</p>;

  const toggle = (id: string) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const clear = () => setChecked([]);

  return (
    <>
      <div className="obj-list">
        {objects.map((o) => (
          <div key={o.id} className={`obj-list-item ${checked.includes(o.id) ? "checked" : ""}`}>
            <input type="checkbox" checked={checked.includes(o.id)} onChange={() => toggle(o.id)} />
            <button className="obj-list-label" onClick={() => selectObject(o.id)}>
              {o.label.trim() || t(objectLabelKey(o.type))}
            </button>
            {o.locked && (
              <span className="lock-ico" title={t("obj.locked")}>
                <LockIcon size={14} />
              </span>
            )}
          </div>
        ))}
      </div>

      {checked.length > 0 && (
        <div className="obj-list-actions">
          <button className="btn" onClick={() => duplicateObjects(checked)}>{t("common.duplicate")}</button>
          <button className="btn icon-only" title={t("obj.lock")} onClick={() => updateObjects(checked, { locked: true })}>
            <LockIcon size={15} />
          </button>
          <button className="btn icon-only" title={t("obj.unlock")} onClick={() => updateObjects(checked, { locked: false })}>
            <LockIcon size={15} open />
          </button>
          <button
            className="btn danger"
            onClick={() => {
              removeObjects(checked);
              clear();
            }}
          >
            {t("common.delete")}
          </button>
        </div>
      )}
    </>
  );
}
