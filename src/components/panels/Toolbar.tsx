import { useRef } from "react";
import { useStore, undo, redo, useCanUndo, useCanRedo } from "../../store";
import { useI18n, useT, type Lang } from "../../i18n";
import { downloadJSON, readJSONFile, slugify } from "../../utils/file";
import { FLAGS, supportsFlagEmoji } from "../../utils/emoji";
import { Icon } from "../Icon";

interface Props {
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onHelp: () => void;
}

export function Toolbar({ onToggleLeft, onToggleRight, onHelp }: Props) {
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
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

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
        <button className="icon-btn" onClick={undo} disabled={!canUndo} title={t("common.undo")} aria-label={t("common.undo")}>
          <Icon name="undo" />
        </button>
        <button className="icon-btn" onClick={redo} disabled={!canRedo} title={t("common.redo")} aria-label={t("common.redo")}>
          <Icon name="redo" />
        </button>
        <button className="icon-btn" onClick={onHelp} title={t("help.title")} aria-label={t("help.title")}>
          <Icon name="help" />
        </button>
        <button
          className="btn"
          onClick={() => setSettings({ theme: theme === "dark" ? "light" : "dark" })}
        >
          <Icon name={theme === "dark" ? "light" : "dark"} /> {theme === "dark" ? t("common.theme.light") : t("common.theme.dark")}
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <Icon name="import" /> {t("common.open")}
        </button>
        <button className="btn" onClick={handleExport}>
          <Icon name="export" /> {t("common.save")}
        </button>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm(t("common.confirmReset"))) resetProject();
          }}
        >
          <Icon name="reset" /> {t("common.reset")}
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
