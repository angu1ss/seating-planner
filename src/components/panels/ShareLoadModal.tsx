import { useT } from "../../i18n";
import { useEscClose } from "../../utils/useEscClose";
import { Icon } from "../Icon";

export type ShareLoadKind = "different" | "update" | "invalid";

/**
 * Shown when opening a share link that would change the current (non-empty, non-identical)
 * project. Offers to save the current project first, then open/update from the link.
 * "invalid" = the link couldn't be decoded.
 */
export function ShareLoadModal({
  kind,
  linkNewer,
  onSave,
  onConfirm,
  onClose,
}: {
  kind: ShareLoadKind;
  linkNewer?: boolean;
  onSave?: () => void;
  onConfirm?: () => void;
  onClose: () => void;
}) {
  const t = useT();
  useEscClose(onClose);

  const title =
    kind === "invalid"
      ? t("shareLoad.invalidTitle")
      : kind === "update"
        ? t("shareLoad.updateTitle")
        : t("shareLoad.differentTitle");

  const body =
    kind === "invalid"
      ? t("shareLoad.invalid")
      : kind === "update"
        ? `${t("shareLoad.update")} ${linkNewer ? t("shareLoad.updateNewer") : t("shareLoad.updateOlder")}`
        : t("shareLoad.different");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-load-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <p className="muted">{body}</p>
          {kind === "invalid" ? (
            <div className="row-actions">
              <button className="btn" onClick={onClose}>
                {t("common.close")}
              </button>
            </div>
          ) : (
            <div className="row-actions">
              {onSave && (
                <button className="btn" onClick={onSave}>
                  <Icon name="export" /> {t("shareLoad.saveCurrent")}
                </button>
              )}
              <button className="btn primary" onClick={onConfirm}>
                {kind === "update" ? t("shareLoad.updateBtn") : t("shareLoad.openBtn")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
