import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store";
import { useT } from "../../i18n";
import { useEscClose } from "../../utils/useEscClose";
import { buildShareLink } from "../../utils/share";
import { Icon } from "../Icon";

/**
 * Share the current project as a self-contained long link (no backend). The link is a
 * snapshot of the project at the moment this modal opens — re-open after edits for a
 * fresh one. Auto-copies on open; the read-only field is auto-selected as a fallback.
 */
export function ShareModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const getDocument = useStore((s) => s.getDocument);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEscClose(onClose);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const url = await buildShareLink(getDocument());
        if (!alive) return;
        setLink(url);
        try {
          await navigator.clipboard.writeText(url);
          if (alive) setCopied(true);
        } catch {
          /* clipboard blocked without a gesture — the Copy button / manual copy works */
        }
        requestAnimationFrame(() => inputRef.current?.select());
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [getDocument]);

  const copy = async () => {
    if (!link) return;
    inputRef.current?.select();
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* selection is active — let the user press Cmd/Ctrl+C */
    }
    setCopied(true);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{t("share.title")}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <p className="muted">{t("share.warning")}</p>
          {failed ? (
            <p className="muted">{t("share.error")}</p>
          ) : (
            <>
              <div className="share-row">
                <input
                  ref={inputRef}
                  className="share-link"
                  type="text"
                  readOnly
                  value={link}
                  placeholder="…"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button className="btn" onClick={copy} disabled={!link}>
                  <Icon name={copied ? "check" : "copy"} />
                  <span>{copied ? t("share.copied") : t("share.copy")}</span>
                </button>
              </div>
              <p className="muted share-hint">{t("share.hint")}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
