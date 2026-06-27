import { useStore } from "../../store";
import { useT } from "../../i18n";
import { useEscClose } from "../../utils/useEscClose";
import { downloadJSON, slugify } from "../../utils/file";
import { Icon } from "../Icon";
import type { UiIconName } from "../../iconmap";

interface Props {
  onClose: () => void;
  onPrintPlan: () => void;
  onPrintGuests: () => void;
  onPrintCards: () => void;
}

export function ExportModal({ onClose, onPrintPlan, onPrintGuests, onPrintCards }: Props) {
  const t = useT();
  const project = useStore((s) => s.project);
  const getDocument = useStore((s) => s.getDocument);

  useEscClose(onClose);

  const exportJson = () => downloadJSON(getDocument(), `${slugify(project.name)}.json`);
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const items: { key: string; label: string; hint: string; icon: UiIconName; onClick: () => void }[] = [
    { key: "plan", label: t("export.plan"), hint: t("export.planHint"), icon: "pdf", onClick: act(onPrintPlan) },
    { key: "guests", label: t("export.guestList"), hint: t("export.guestListHint"), icon: "pdf", onClick: act(onPrintGuests) },
    { key: "escort", label: t("export.escortCards"), hint: t("export.escortHint"), icon: "pdf", onClick: act(onPrintCards) },
    { key: "json", label: t("export.project"), hint: t("export.projectHint"), icon: "code", onClick: act(exportJson) },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal export-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{t("export.title")}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <p className="muted export-hint">{t("export.hint")}</p>
          <div className="export-grid">
            {items.map((it) => (
              <button key={it.key} className="export-card" onClick={it.onClick}>
                <Icon name={it.icon} />
                <span className="export-card-label">{it.label}</span>
                <span className="export-card-hint">{it.hint}</span>
              </button>
            ))}
          </div>
          <p className="muted export-print-note">
            <Icon name="pdf" /> {t("export.planPrint")}
          </p>
        </div>
      </div>
    </div>
  );
}
