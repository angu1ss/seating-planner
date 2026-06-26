import { useState } from "react";
import { useStore } from "../../store";
import { useT } from "../../i18n";
import { useMediaQuery } from "../../utils/useMediaQuery";
import { Icon } from "../Icon";
import { SettingsMenu } from "./SettingsMenu";
import { AppActions } from "./AppActions";

interface Props {
  onToggleLeft: () => void;
  onSettings: () => void;
}

export function Toolbar({ onToggleLeft, onSettings }: Props) {
  const t = useT();
  const project = useStore((s) => s.project);
  const setProjectMeta = useStore((s) => s.setProjectMeta);
  const [editing, setEditing] = useState(false);
  // Wide enough to keep the actions on the bar; otherwise collapse into the gear menu.
  const wide = useMediaQuery("(min-width: 980px)");

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button className="icon-btn only-mobile" onClick={onToggleLeft} aria-label="menu">☰</button>
        <span className="app-title">{t("app.name")}</span>
        <div className="project-name-display only-desktop">
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
        {wide ? (
          <>
            <AppActions layout="bar" />
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
          <SettingsMenu onProjectSettings={onSettings} />
        )}
      </div>
    </header>
  );
}
