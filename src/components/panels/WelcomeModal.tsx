import { useRef, useState } from "react";
import { useStore, activeSheet } from "../../store";
import type { EventType } from "../../types";
import { useT, useI18n, type Lang } from "../../i18n";
import { useEscClose } from "../../utils/useEscClose";
import { readJSONFile } from "../../utils/file";
import { FLAGS, supportsFlagEmoji } from "../../utils/emoji";
import { CHAIR_ICONS, EVENT_ICONS } from "../../iconmap";
import { Icon } from "../Icon";
import { IconSelect } from "./IconSelect";

interface Props {
  onClose: () => void;
}

/**
 * First-run setup. Project meta is written straight to the store as the user types,
 * so closing (Create / Skip / Esc / overlay) all simply dismiss and keep what's there.
 */
export function WelcomeModal({ onClose }: Props) {
  const t = useT();
  const project = useStore((s) => s.project);
  const setProjectMeta = useStore((s) => s.setProjectMeta);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const venue = useStore((s) => activeSheet(s).venue);
  const setVenue = useStore((s) => s.setVenue);
  const loadDocument = useStore((s) => s.loadDocument);

  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  const flags = supportsFlagEmoji();
  const langs: Lang[] = ["en", "ru"];

  const [advanced, setAdvanced] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEscClose(onClose);

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      loadDocument(await readJSONFile(file));
      onClose();
    } catch (err) {
      alert(`${t("common.importError")}${(err as Error).message}`);
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal welcome-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
      >
        <div className="welcome-hero">
          <div className="lang-switch welcome-lang" role="group" aria-label={t("lang.label")}>
            {langs.map((l) => (
              <button
                key={l}
                className={`lang-btn ${lang === l ? "active" : ""}`}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
              >
                {flags ? FLAGS[l] : l.toUpperCase()}
              </button>
            ))}
          </div>
          <img
            className="welcome-logo"
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt=""
            width={56}
            height={56}
          />
          <h2 id="welcome-title">{t("welcome.title")}</h2>
          <p>{t("welcome.subtitle")}</p>
        </div>

        <div className="modal-body">
          <label className="field">
            <span>{t("project.name")}</span>
            <input
              autoFocus
              value={project.name}
              placeholder={t("project.namePlaceholder")}
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
                options={[{ value: "wedding", label: t("event.wedding"), icon: EVENT_ICONS.wedding }]}
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

          <button
            type="button"
            className="welcome-adv-toggle"
            aria-expanded={advanced}
            onClick={() => setAdvanced((v) => !v)}
          >
            <Icon name="settings" />
            <span>{t("welcome.advanced")}</span>
            <span className={`chev ${advanced ? "open" : ""}`}>
              <Icon name="chevron" />
            </span>
          </button>

          {advanced && (
            <div className="welcome-adv">
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
              <button className="btn block" onClick={() => fileRef.current?.click()}>
                <Icon name="import" /> {t("welcome.import")}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                onChange={onImport}
                className="hidden"
              />
            </div>
          )}
        </div>

        <div className="modal-foot welcome-foot">
          <button className="btn" onClick={onClose}>
            {t("welcome.skip")}
          </button>
          <button className="btn primary" onClick={onClose}>
            {t("welcome.start")}
          </button>
        </div>
      </div>
    </div>
  );
}
