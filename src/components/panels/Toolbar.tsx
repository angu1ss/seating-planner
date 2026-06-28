import { useState } from "react";
import { useStore } from "../../store";
import { useT } from "../../i18n";
import { useMediaQuery } from "../../utils/useMediaQuery";
import { Icon } from "../Icon";
import { EVENT_ICONS } from "../../iconmap";
import { SettingsMenu } from "./SettingsMenu";
import { AppActions } from "./AppActions";

interface Props {
  onToggleLeft: () => void;
  onToggleGuests: () => void;
  onSettings: () => void;
  onExport: () => void;
  onShare: () => void;
  onAbout: () => void;
  showLeftToggle?: boolean;
}

export function Toolbar({ onToggleLeft, onToggleGuests, onSettings, onExport, onShare, onAbout, showLeftToggle }: Props) {
  const t = useT();
  const project = useStore((s) => s.project);
  const setProjectMeta = useStore((s) => s.setProjectMeta);
  const [editing, setEditing] = useState(false);
  // Wide enough to keep the actions on the bar; otherwise collapse into the gear menu.
  const wide = useMediaQuery("(min-width: 980px)");

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button className={`icon-btn ${showLeftToggle ? "" : "only-mobile"}`} onClick={onToggleLeft} aria-label="menu">
          ☰
        </button>
        <button
          className="app-logo-btn only-desktop"
          onClick={onAbout}
          title={t("about.title")}
          aria-label={t("about.title")}
        >
          <img
            className="app-logo"
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt=""
            width={26}
            height={26}
          />
        </button>
        <span className="app-title">{t("app.fullName")}</span>
        <div className="project-name-display only-desktop">
          <Icon icon={EVENT_ICONS[project.eventType]} size={15} />
          {editing ? (
            <input
              autoFocus
              className="project-name"
              value={project.name}
              placeholder={t("project.untitled")}
              onChange={(e) => setProjectMeta({ name: e.target.value })}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") setEditing(false);
              }}
            />
          ) : (
            <button className="name-btn" onClick={() => setEditing(true)}>
              <span>{project.name.trim() || t("project.untitled")}</span>
              <Icon name="edit" size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="toolbar-group">
        <button
          className="icon-btn only-mobile"
          onClick={onToggleGuests}
          title={t("guests.title")}
          aria-label={t("guests.title")}
        >
          <Icon name="guests" />
        </button>
        {wide ? (
          <>
            <AppActions layout="bar" />
            <button className="btn" onClick={onExport} title={t("export.title")} aria-label={t("export.title")}>
              <Icon name="export" />
              <span className="label">{t("export.title")}</span>
            </button>
            <button className="btn" onClick={onShare} title={t("share.title")} aria-label={t("share.title")}>
              <Icon name="share" />
              <span className="label">{t("share.title")}</span>
            </button>
            <button
              className="icon-btn"
              onClick={onSettings}
              title={t("settings.gear")}
              aria-label={t("settings.gear")}
            >
              <Icon name="settings" />
            </button>
          </>
        ) : (
          <SettingsMenu onProjectSettings={onSettings} onExport={onExport} onShare={onShare} />
        )}
      </div>
    </header>
  );
}
