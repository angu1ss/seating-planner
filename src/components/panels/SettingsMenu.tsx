import { useEffect, useRef, useState } from "react";
import { useT } from "../../i18n";
import { Icon } from "../Icon";
import { AppActions } from "./AppActions";

export function SettingsMenu({ onProjectSettings }: { onProjectSettings: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="settings-menu" ref={wrapRef}>
      <button
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        title={t("settings.gear")}
        aria-label={t("settings.gear")}
        aria-expanded={open}
      >
        <Icon name="settings" />
      </button>

      {open && (
        <div className="menu" role="menu">
          <AppActions layout="menu" onAfter={() => setOpen(false)} />
          <div className="menu-sep" />
          <button
            className="menu-item"
            onClick={() => {
              setOpen(false);
              onProjectSettings();
            }}
          >
            <Icon name="settings" />
            <span>{t("settings.title")}…</span>
          </button>
        </div>
      )}
    </div>
  );
}
