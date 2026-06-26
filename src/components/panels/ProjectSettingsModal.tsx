import { useEffect, useState } from "react";
import { useStore, activeSheet } from "../../store";
import { useT } from "../../i18n";
import { Icon } from "../Icon";
import { ConfirmModal } from "./ConfirmModal";

interface Props {
  onClose: () => void;
}

export function ProjectSettingsModal({ onClose }: Props) {
  const t = useT();
  const project = useStore((s) => s.project);
  const setProjectMeta = useStore((s) => s.setProjectMeta);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const venue = useStore((s) => activeSheet(s).venue);
  const setVenue = useStore((s) => s.setVenue);
  const resetProject = useStore((s) => s.resetProject);

  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmReset) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, confirmReset]);

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className="modal-head">
            <h2>{t("settings.title")}</h2>
            <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
              <Icon name="close" />
            </button>
          </div>

          <div className="modal-body">
            <label className="field">
              <span>{t("project.name")}</span>
              <input
                value={project.name}
                placeholder={t("project.untitled")}
                onChange={(e) => setProjectMeta({ name: e.target.value })}
              />
            </label>

            <label className="field">
              <span>{t("left.gridStep")}</span>
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
              <span>{t("left.snapToGrid")}</span>
            </label>
            <label className="field">
              <span>{t("left.defaultChair")}</span>
              <select
                value={settings.chairStyle}
                onChange={(e) => setSettings({ chairStyle: e.target.value as "round" | "square" })}
              >
                <option value="round">{t("chair.round")}</option>
                <option value="square">{t("chair.square")}</option>
              </select>
            </label>
            <label className="field">
              <span>{t("left.minSpacing")}</span>
              <input
                type="number"
                min={0.3}
                step={0.05}
                value={settings.minSeatSpacing}
                onChange={(e) => setSettings({ minSeatSpacing: Math.max(0.3, Number(e.target.value)) })}
              />
            </label>

            <button className="btn danger block" onClick={() => setConfirmReset(true)}>
              <Icon name="reset" /> {t("common.reset")}
            </button>
          </div>
        </div>
      </div>

      {confirmReset && (
        <ConfirmModal
          title={t("common.reset")}
          message={t("common.confirmReset")}
          confirmLabel={t("common.reset")}
          danger
          onConfirm={() => {
            resetProject();
            onClose();
          }}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </>
  );
}
