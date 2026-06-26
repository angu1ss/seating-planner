import { useStore } from "../../store";
import { useT } from "../../i18n";
import { objectLabelKey } from "../../constants";
import { Icon } from "../Icon";

export function ObjectPanel() {
  const t = useT();
  const obj = useStore((s) => s.objects.find((o) => o.id === s.selectedObjectId) ?? null);
  const updateObject = useStore((s) => s.updateObject);
  const removeObject = useStore((s) => s.removeObject);

  if (!obj) return null;
  const locked = obj.locked;

  return (
    <div className="panel">
      <section className="panel-section">
        <div className="panel-head-row">
          <h3>{t("obj.object")}</h3>
          <button
            className={`btn lock-btn ${locked ? "primary" : ""}`}
            onClick={() => updateObject(obj.id, { locked: !locked })}
          >
            <Icon name={locked ? "unlock" : "lock"} /> {locked ? t("obj.unlock") : t("obj.lock")}
          </button>
        </div>
        {locked && (
          <p className="muted lock-row">
            <Icon name="lock" /> {t("obj.locked")}
          </p>
        )}

        <div className="field">
          <span>{t("obj.type")}</span>
          <div className="static-field">{t(objectLabelKey(obj.type))}</div>
        </div>
        <label className="field">
          <span>{t("obj.label")}</span>
          <input
            value={obj.label}
            disabled={locked}
            placeholder={t(objectLabelKey(obj.type))}
            onChange={(e) => updateObject(obj.id, { label: e.target.value })}
          />
        </label>
        <div className="field-2col">
          <label className="field">
            <span>{t("left.width")}</span>
            <input
              type="number"
              min={0.2}
              step={0.1}
              disabled={locked}
              value={obj.w}
              onChange={(e) => updateObject(obj.id, { w: Math.max(0.2, Number(e.target.value)) })}
            />
          </label>
          <label className="field">
            <span>{t("left.length")}</span>
            <input
              type="number"
              min={0.2}
              step={0.1}
              disabled={locked}
              value={obj.h}
              onChange={(e) => updateObject(obj.id, { h: Math.max(0.2, Number(e.target.value)) })}
            />
          </label>
        </div>
        <label className="field">
          <span>{t("table.rotation")}</span>
          <input
            type="number"
            step={5}
            disabled={locked}
            value={obj.rotation}
            onChange={(e) => updateObject(obj.id, { rotation: Number(e.target.value) % 360 })}
          />
        </label>
      </section>

      <section className="panel-section row-actions">
        <button className="btn danger" disabled={locked} onClick={() => removeObject(obj.id)}>
          <Icon name="delete" /> {t("common.delete")}
        </button>
      </section>
    </div>
  );
}
