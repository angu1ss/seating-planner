import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { useT, useI18n } from "../../i18n";
import { useEscClose } from "../../utils/useEscClose";
import { Icon } from "../Icon";

const GITHUB_URL = "https://github.com/angu1ss/seating-planner";

/** "About this app" — author, version, build, GitHub. Opened from the version line or
 * the toolbar logo. */
export function AboutModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  useEscClose(onClose);

  const buildDate = (() => {
    try {
      return new Date(__BUILD_DATE__).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return __BUILD_DATE__;
    }
  })();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal about-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{t("about.title")}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body about-body">
          <img className="about-logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={76} height={76} />
          <h3 className="about-name">{t("app.fullName")}</h3>
          <p className="about-desc muted">{t("about.description")}</p>
          <dl className="about-grid">
            <dt>{t("about.version")}</dt>
            <dd>{__APP_VERSION__}</dd>
            <dt>{t("about.build")}</dt>
            <dd>{buildDate}</dd>
            <dt>{t("about.author")}</dt>
            <dd>{t("about.authorName")}</dd>
            <dt>{t("about.license")}</dt>
            <dd>MIT</dd>
          </dl>
          <a className="btn about-gh" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <Icon icon={faGithub} /> {t("about.github")}
          </a>
        </div>
      </div>
    </div>
  );
}
