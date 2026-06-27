import { useState } from "react";
import { useStore } from "../../store";
import { useT } from "../../i18n";
import { useEscClose } from "../../utils/useEscClose";
import { useDraggablePanel } from "../../utils/useDraggablePanel";
import { OBJECT_PRESETS, objectLabelKey } from "../../constants";
import type { SceneObjectType } from "../../types";
import { Icon } from "../Icon";
import { OBJECT_ICONS } from "../../iconmap";

interface Props {
  onClose: () => void;
}

export function AddObjectModal({ onClose }: Props) {
  const t = useT();
  const addObjectsFrom = useStore((s) => s.addObjectsFrom);

  const first = OBJECT_PRESETS[0];
  const [type, setType] = useState<SceneObjectType>(first.type);
  const [w, setW] = useState(first.w);
  const [h, setH] = useState(first.h);
  const [label, setLabel] = useState("");
  const [count, setCount] = useState(1);

  const { pos: panelPos, onHeaderPointerDown } = useDraggablePanel({ x: 24, y: 120 });
  useEscClose(onClose);

  const applyType = (tp: SceneObjectType) => {
    const p = OBJECT_PRESETS.find((x) => x.type === tp);
    if (!p) return;
    setType(tp);
    setW(p.w);
    setH(p.h);
  };

  const submit = () => {
    addObjectsFrom(
      { type, w: Math.max(0.2, w), h: Math.max(0.2, h), label: label.trim() || undefined },
      Math.max(1, count),
    );
    onClose();
  };

  const m = t("unit.m");

  return (
    <div className="float-panel" style={{ left: panelPos.x, top: panelPos.y }} role="dialog" aria-label={t("obj.add")}>
      <div className="float-head" onPointerDown={onHeaderPointerDown}>
        <h2>{t("obj.add")}</h2>
        <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}><Icon name="close" /></button>
      </div>

      <div className="float-body">
        <h3>{t("modal.templates")}</h3>
        <div className="preset-grid">
          {OBJECT_PRESETS.map((p) => (
            <button
              key={p.type}
              className={`preset-btn ${type === p.type ? "active" : ""}`}
              onClick={() => applyType(p.type)}
            >
              <Icon icon={OBJECT_ICONS[p.type]} size={22} />
              <span className="preset-label">{t(objectLabelKey(p.type))}</span>
            </button>
          ))}
        </div>

        <h3>{t("modal.custom")}</h3>
        <label className="field">
          <span>{t("obj.label")}</span>
          <input value={label} placeholder={t(objectLabelKey(type))} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <div className="field-2col">
          <label className="field">
            <span>{t("left.width")}</span>
            <input type="number" min={0.2} step={0.1} value={w} onChange={(e) => setW(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>{t("left.length")}</span>
            <input type="number" min={0.2} step={0.1} value={h} onChange={(e) => setH(Number(e.target.value))} />
          </label>
        </div>
        <label className="field">
          <span>{t("modal.quantity")}</span>
          <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
        <p className="muted">
          {t(objectLabelKey(type))} · {w}×{h} {m} · ×{Math.max(1, count)}
        </p>
      </div>

      <div className="float-foot">
        <button className="btn" onClick={onClose}>{t("common.close")}</button>
        <button className="btn primary" onClick={submit}><Icon name="add" /> {t("common.add")}</button>
      </div>
    </div>
  );
}
