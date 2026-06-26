import { useRef } from "react";
import { useStore } from "../../store";
import { useI18n, useT, type Lang } from "../../i18n";
import { downloadJSON, readJSONFile, slugify } from "../../utils/file";
import { FLAGS, supportsFlagEmoji } from "../../utils/emoji";

interface Props {
  onToggleLeft: () => void;
  onToggleRight: () => void;
}

export function Toolbar({ onToggleLeft, onToggleRight }: Props) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);

  const project = useStore((s) => s.project);
  const setProjectMeta = useStore((s) => s.setProjectMeta);
  const theme = useStore((s) => s.settings.theme);
  const setSettings = useStore((s) => s.setSettings);
  const getDocument = useStore((s) => s.getDocument);
  const loadDocument = useStore((s) => s.loadDocument);
  const resetProject = useStore((s) => s.resetProject);

  const fileRef = useRef<HTMLInputElement>(null);
  const flags = supportsFlagEmoji();
  const langs: Lang[] = ["en", "ru"];

  const handleExport = () => downloadJSON(getDocument(), `${slugify(project.name)}.json`);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const doc = await readJSONFile(file);
      loadDocument(doc);
    } catch (err) {
      alert(`${t("common.importError")}${(err as Error).message}`);
    } finally {
      e.target.value = "";
    }
  };

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button className="icon-btn only-mobile" onClick={onToggleLeft} aria-label="menu">☰</button>
        <span className="app-title">{t("app.name")}</span>
        <input
          className="project-name"
          value={project.name}
          placeholder={t("project.untitled")}
          onChange={(e) => setProjectMeta({ name: e.target.value })}
          aria-label="project name"
        />
      </div>

      <div className="toolbar-group">
        <div className="lang-switch" role="group" aria-label={t("lang.label")}>
          {langs.map((l) => (
            <button
              key={l}
              className={`lang-btn ${lang === l ? "active" : ""}`}
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              title={l.toUpperCase()}
            >
              {flags ? FLAGS[l] : l.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          className="btn"
          onClick={() => setSettings({ theme: theme === "dark" ? "light" : "dark" })}
        >
          {theme === "dark" ? `☀️ ${t("common.theme.light")}` : `🌙 ${t("common.theme.dark")}`}
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>{t("common.open")}</button>
        <button className="btn" onClick={handleExport}>{t("common.save")}</button>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm(t("common.confirmReset"))) resetProject();
          }}
        >
          {t("common.reset")}
        </button>
        <button className="icon-btn only-mobile" onClick={onToggleRight} aria-label="properties">⚙</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
          style={{ display: "none" }}
        />
      </div>
    </header>
  );
}
