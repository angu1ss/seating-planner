import { useRef } from "react";
import { useStore } from "../../store";
import { useI18n, useT, type Lang } from "../../i18n";
import { downloadJSON, readJSONFile, slugify } from "../../utils/file";
import { FLAGS, supportsFlagEmoji } from "../../utils/emoji";
import { Icon } from "../Icon";

/** Language / theme / import / export — rendered either inline on the toolbar or as menu items. */
export function AppActions({ layout, onAfter }: { layout: "bar" | "menu"; onAfter?: () => void }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  const theme = useI18n((s) => s.theme);
  const setTheme = useI18n((s) => s.setTheme);
  const project = useStore((s) => s.project);
  const getDocument = useStore((s) => s.getDocument);
  const loadDocument = useStore((s) => s.loadDocument);

  const fileRef = useRef<HTMLInputElement>(null);
  const flags = supportsFlagEmoji();
  const langs: Lang[] = ["en", "ru"];

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const doExport = () => {
    downloadJSON(getDocument(), `${slugify(project.name)}.json`);
    onAfter?.();
  };
  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      loadDocument(await readJSONFile(file));
    } catch (err) {
      alert(`${t("common.importError")}${(err as Error).message}`);
    } finally {
      e.target.value = "";
      onAfter?.();
    }
  };

  const langSwitch = (
    <div className="lang-switch" role="group" aria-label={t("lang.label")}>
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
  );

  const fileInput = (
    <input ref={fileRef} type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
  );

  if (layout === "menu") {
    return (
      <>
        <div className="menu-row">
          <span>{t("lang.label")}</span>
          {langSwitch}
        </div>
        <button className="menu-item" onClick={toggleTheme}>
          <Icon name={theme === "dark" ? "light" : "dark"} />
          <span>{theme === "dark" ? t("common.theme.light") : t("common.theme.dark")}</span>
        </button>
        <div className="menu-sep" />
        <button className="menu-item" onClick={() => fileRef.current?.click()}>
          <Icon name="import" />
          <span>{t("common.open")}</span>
        </button>
        <button className="menu-item" onClick={doExport}>
          <Icon name="export" />
          <span>{t("common.save")}</span>
        </button>
        {fileInput}
      </>
    );
  }

  return (
    <div className="bar-actions">
      {langSwitch}
      <button className="btn" onClick={toggleTheme} title={theme === "dark" ? t("common.theme.light") : t("common.theme.dark")}>
        <Icon name={theme === "dark" ? "light" : "dark"} />
        <span className="label">{theme === "dark" ? t("common.theme.light") : t("common.theme.dark")}</span>
      </button>
      <button className="btn" onClick={() => fileRef.current?.click()} title={t("common.open")}>
        <Icon name="import" />
        <span className="label">{t("common.open")}</span>
      </button>
      <button className="btn" onClick={doExport} title={t("common.save")}>
        <Icon name="export" />
        <span className="label">{t("common.save")}</span>
      </button>
      {fileInput}
    </div>
  );
}
