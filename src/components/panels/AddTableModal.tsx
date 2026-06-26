import { useState } from "react";
import { useStore } from "../../store";
import { useT } from "../../i18n";
import { useEscClose } from "../../utils/useEscClose";
import { useDraggablePanel } from "../../utils/useDraggablePanel";
import { TABLE_PRESETS, presetLabel } from "../../constants";
import type { ChairStyle, TableShape } from "../../types";
import { Icon } from "../Icon";

interface Props {
  onClose: () => void;
}

export function AddTableModal({ onClose }: Props) {
  const t = useT();
  const addTablesFrom = useStore((s) => s.addTablesFrom);

  const first = TABLE_PRESETS[0];
  const [shape, setShape] = useState<TableShape>(first.shape);
  const [w, setW] = useState(first.w);
  const [h, setH] = useState(first.h);
  const [seatCount, setSeatCount] = useState(first.seatCount);
  const [chairStyle, setChairStyle] = useState<"inherit" | ChairStyle>("inherit");
  const [name, setName] = useState("");
  const [count, setCount] = useState(1);
  const [activePreset, setActivePreset] = useState(first.id);

  const { pos: panelPos, onHeaderPointerDown } = useDraggablePanel({ x: 24, y: 72 });
  useEscClose(onClose);

  const applyPreset = (id: string) => {
    const p = TABLE_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setActivePreset(id);
    setShape(p.shape);
    setW(p.w);
    setH(p.h);
    setSeatCount(p.seatCount);
  };

  const submit = () => {
    addTablesFrom(
      {
        shape,
        w: Math.max(0.3, w),
        h: Math.max(0.3, h),
        seatCount: Math.max(0, seatCount),
        chairStyle: chairStyle === "inherit" ? null : chairStyle,
        name: name.trim() || undefined,
      },
      Math.max(1, count),
    );
    // Keep the panel open so tables can be added while watching the canvas.
  };

  const m = t("unit.m");

  return (
    <div className="float-panel" style={{ left: panelPos.x, top: panelPos.y }} role="dialog" aria-label={t("modal.title")}>
      <div className="float-head" onPointerDown={onHeaderPointerDown}>
        <h2>{t("modal.title")}</h2>
        <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}><Icon name="close" /></button>
      </div>

      <div className="float-body">
        <h3>{t("modal.templates")}</h3>
        <div className="preset-grid">
          {TABLE_PRESETS.map((p) => (
            <button
              key={p.id}
              className={`preset-btn ${activePreset === p.id ? "active" : ""}`}
              onClick={() => applyPreset(p.id)}
            >
              <span className={p.shape === "ellipse" ? "preset-ico round" : "preset-ico rect"} />
              <span className="preset-label">{presetLabel(p, t)}</span>
            </button>
          ))}
        </div>

        <h3>{t("modal.custom")}</h3>
        <label className="field">
          <span>{t("table.name")}</span>
          <input value={name} placeholder={t("table.word")} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>{t("table.shape")}</span>
          <select value={shape} onChange={(e) => setShape(e.target.value as TableShape)}>
            <option value="rect">{t("shape.rect")}</option>
            <option value="ellipse">{t("shape.round")}</option>
            <option value="snake">{t("shape.snake")}</option>
          </select>
        </label>
        <div className="field-2col">
          <label className="field">
            <span>{shape === "ellipse" ? t("table.axisX") : t("left.width")}</span>
            <input type="number" min={0.3} step={0.1} value={w} onChange={(e) => setW(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>{shape === "ellipse" ? t("table.axisY") : t("left.length")}</span>
            <input type="number" min={0.3} step={0.1} value={h} onChange={(e) => setH(Number(e.target.value))} />
          </label>
        </div>
        <div className="field-2col">
          <label className="field">
            <span>{t("table.seats")}</span>
            <input type="number" min={0} value={seatCount} onChange={(e) => setSeatCount(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>{t("table.chair")}</span>
            <select value={chairStyle} onChange={(e) => setChairStyle(e.target.value as "inherit" | ChairStyle)}>
              <option value="inherit">{t("chair.inherit")}</option>
              <option value="round">{t("chair.round")}</option>
              <option value="square">{t("chair.square")}</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>{t("modal.quantity")}</span>
          <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
        <p className="muted">
          {w}×{h} {m} · {seatCount} {t("table.seatsShort")} · ×{Math.max(1, count)}
        </p>
      </div>

      <div className="float-foot">
        <button className="btn" onClick={onClose}>{t("common.close")}</button>
        <button className="btn primary" onClick={submit}><Icon name="add" /> {t("common.add")}</button>
      </div>
    </div>
  );
}
