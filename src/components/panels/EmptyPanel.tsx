import { useT } from "../../i18n";
import { ElementsList } from "./ElementsList";

export function EmptyPanel() {
  const t = useT();
  return (
    <div className="panel">
      <div className="empty-hint">
        <p>{t("table.noSelection")}</p>
        <p className="muted">{t("table.noSelectionHint")}</p>
      </div>
      <section className="panel-section">
        <h3>{t("elements.title")}</h3>
        <ElementsList />
      </section>
    </div>
  );
}
