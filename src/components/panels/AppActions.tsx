import { useI18n, useT, type Lang } from "../../i18n";
import { FLAGS, supportsFlagEmoji } from "../../utils/emoji";
import { Icon } from "../Icon";

/** Language + theme — rendered either inline on the toolbar or as menu items. */
export function AppActions({ layout }: { layout: "bar" | "menu" }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  const theme = useI18n((s) => s.theme);
  const setTheme = useI18n((s) => s.setTheme);

  const flags = supportsFlagEmoji();
  const langs: Lang[] = ["en", "ru"];
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

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
      </>
    );
  }

  return (
    <div className="bar-actions">
      {langSwitch}
      <button
        className="btn"
        onClick={toggleTheme}
        title={theme === "dark" ? t("common.theme.light") : t("common.theme.dark")}
      >
        <Icon name={theme === "dark" ? "light" : "dark"} />
        <span className="label">{theme === "dark" ? t("common.theme.light") : t("common.theme.dark")}</span>
      </button>
    </div>
  );
}
