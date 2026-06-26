import { useState } from "react";
import { useStore } from "../../store";
import { useT } from "../../i18n";
import { objectLabelKey } from "../../constants";
import { Icon } from "../Icon";
import { OBJECT_ICONS } from "../../iconmap";

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
            <Icon icon={OBJECT_ICONS[o.type]} />
            <button className="obj-list-label" onClick={() => selectObject(o.id)}>
              {o.label.trim() || t(objectLabelKey(o.type))}
            </button>
            {o.locked && (
              <span className="lock-ico" title={t("obj.locked")}>
                <Icon name="lock" />
              </span>
            )}
          </div>
        ))}
      </div>

      {checked.length > 0 && (
        <div className="obj-list-actions">
          <button className="btn" onClick={() => duplicateObjects(checked)}>
            <Icon name="duplicate" /> {t("common.duplicate")}
          </button>
          <button className="btn icon-only" title={t("obj.lock")} onClick={() => updateObjects(checked, { locked: true })}>
            <Icon name="lock" />
          </button>
          <button className="btn icon-only" title={t("obj.unlock")} onClick={() => updateObjects(checked, { locked: false })}>
            <Icon name="unlock" />
          </button>
          <button
            className="btn danger"
            onClick={() => {
              removeObjects(checked);
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
