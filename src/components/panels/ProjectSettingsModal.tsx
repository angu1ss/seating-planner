import { useState } from "react";
import { useStore, activeSheet } from "../../store";
import type { EventType } from "../../types";
import { useT, useI18n } from "../../i18n";
import { useEscClose } from "../../utils/useEscClose";
import { CHAIR_ICONS } from "../../iconmap";
import { Icon } from "../Icon";
import { IconSelect } from "./IconSelect";
import { ConfirmModal } from "./ConfirmModal";
import {
  usePwaUpdateReady,
  usePwaCanInstall,
  applyPwaUpdate,
  checkForPwaUpdate,
  promptInstall,
  isPwaStandalone,
} from "../../pwa";

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
  const setOnboarded = useI18n((s) => s.setOnboarded);

  const updateReady = usePwaUpdateReady();
  const canInstall = usePwaCanInstall();
  const [confirmReset, setConfirmReset] = useState(false);
  const [checking, setChecking] = useState(false);
  useEscClose(onClose, !confirmReset);

  const onCheckUpdate = async () => {
    setChecking(true);
    try {
      await checkForPwaUpdate();
    } finally {
      setChecking(false);
    }
  };

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
            <div className="field-2col">
              <div className="field">
                <span>{t("event.type")}</span>
                <IconSelect
                  ariaLabel={t("event.type")}
                  value={project.eventType}
                  onChange={(v) => setProjectMeta({ eventType: v as EventType })}
                  options={[{ value: "wedding", label: t("event.wedding") }]}
                />
              </div>
              <label className="field">
                <span>{t("project.date")}</span>
                <input
                  type="date"
                  value={project.date}
                  onChange={(e) => setProjectMeta({ date: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span>{t("project.note")}</span>
              <textarea
                rows={2}
                value={project.note}
                placeholder={t("project.notePlaceholder")}
                onChange={(e) => setProjectMeta({ note: e.target.value })}
              />
            </label>

            <div className="field">
              <span>{t("left.gridStep")}</span>
              <IconSelect
                ariaLabel={t("left.gridStep")}
                value={String(venue.gridStep)}
                onChange={(v) => setVenue({ gridStep: Number(v) })}
                options={[
                  { value: "0.1", label: "0.1" },
                  { value: "0.25", label: "0.25" },
                  { value: "0.5", label: "0.5" },
                  { value: "1", label: "1.0" },
                ]}
              />
            </div>
            <label className="field-inline">
              <input
                type="checkbox"
                checked={venue.snapToGrid}
                onChange={(e) => setVenue({ snapToGrid: e.target.checked })}
              />
              <span>{t("left.snapToGrid")}</span>
            </label>
            <div className="field">
              <span>{t("left.defaultChair")}</span>
              <IconSelect
                ariaLabel={t("left.defaultChair")}
                value={settings.chairStyle}
                onChange={(v) => setSettings({ chairStyle: v as "round" | "square" })}
                options={[
                  { value: "round", label: t("chair.round"), icon: CHAIR_ICONS.round },
                  { value: "square", label: t("chair.square"), icon: CHAIR_ICONS.square },
                ]}
              />
            </div>
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

            {(isPwaStandalone || canInstall) && (
              <div className="pwa-section">
                <span className="field-caption">{t("pwa.section")}</span>
                {isPwaStandalone ? (
                  <>
                    <div className="pwa-row">
                      <span className="muted">
                        {t("pwa.version")} {__APP_VERSION__}
                      </span>
                      {updateReady ? (
                        <button className="btn primary" onClick={applyPwaUpdate}>
                          <Icon name="import" /> {t("pwa.update")}
                        </button>
                      ) : (
                        <button className="btn" onClick={onCheckUpdate} disabled={checking}>
                          <Icon name="redo" /> {checking ? t("pwa.checking") : t("pwa.check")}
                        </button>
                      )}
                    </div>
                    {updateReady && <p className="muted pwa-hint">{t("pwa.updateAvailable")}</p>}
                  </>
                ) : (
                  <div className="pwa-row">
                    <span className="muted">{t("pwa.installHint")}</span>
                    <button className="btn primary" onClick={promptInstall}>
                      <Icon name="import" /> {t("pwa.install")}
                    </button>
                  </div>
                )}
              </div>
            )}

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
            setOnboarded(false);
            onClose();
          }}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </>
  );
}
