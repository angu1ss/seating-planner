import { useT } from "../../i18n";
import { ElementsList } from "./ElementsList";
import { VenueSettings } from "./VenueSettings";

export function EmptyPanel() {
  const t = useT();
  return (
    <div className="panel">
      <section className="panel-section">
        <h3>{t("left.hall")}</h3>
        <VenueSettings />
      </section>
      <section className="panel-section">
        <h3>{t("elements.title")}</h3>
        <ElementsList />
      </section>
    </div>
  );
}
