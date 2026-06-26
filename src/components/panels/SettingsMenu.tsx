import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store";
import { useI18n, useT, type Lang } from "../../i18n";
import { downloadJSON, readJSONFile, slugify } from "../../utils/file";
import { FLAGS, supportsFlagEmoji } from "../../utils/emoji";
import { Icon } from "../Icon";

export function SettingsMenu({ onProjectSettings }: { onProjectSettings: () => void }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  const theme = useStore((s) => s.settings.theme);
  const setSettings = useStore((s) => s.setSettings);
  const project = useStore((s) => s.project);
  const getDocument = useStore((s) => s.getDocument);
  const loadDocument = useStore((s) => s.loadDocument);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const flags = supportsFlagEmoji();
  const langs: Lang[] = ["en", "ru"];

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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      loadDocument(await readJSONFile(file));
    } catch (err) {
      alert(`${t("common.importError")}${(err as Error).message}`);
    } finally {
      e.target.value = "";
      setOpen(false);
    }
  };

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
          <div className="menu-row">
            <span>{t("lang.label")}</span>
            <div className="lang-switch">
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
          </div>

          <button
            className="menu-item"
            onClick={() => setSettings({ theme: theme === "dark" ? "light" : "dark" })}
          >
            <Icon name={theme === "dark" ? "light" : "dark"} />
            <span>{theme === "dark" ? t("common.theme.light") : t("common.theme.dark")}</span>
          </button>

          <div className="menu-sep" />

          <button className="menu-item" onClick={() => fileRef.current?.click()}>
            <Icon name="import" />
            <span>{t("common.open")}</span>
          </button>
          <button
            className="menu-item"
            onClick={() => {
              downloadJSON(getDocument(), `${slugify(project.name)}.json`);
              setOpen(false);
            }}
          >
            <Icon name="export" />
            <span>{t("common.save")}</span>
          </button>

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

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
            style={{ display: "none" }}
          />
        </div>
      )}
    </div>
  );
}
