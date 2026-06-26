import { useT } from "../../i18n";
import { useEscClose } from "../../utils/useEscClose";
import { Icon } from "../Icon";

const ROWS: { keys: string; k: string }[] = [
  { keys: "Esc", k: "help.deselect" },
  { keys: "Ctrl/⌘ + A", k: "help.selectAll" },
  { keys: "Ctrl/⌘ + C / V", k: "help.copyPaste" },
  { keys: "Ctrl/⌘ + D", k: "help.duplicate" },
  { keys: "Ctrl/⌘ + S", k: "help.export" },
  { keys: "Delete / Backspace", k: "help.delete" },
  { keys: "↑ ↓ ← →", k: "help.move" },
  { keys: "[ / ]", k: "help.rotate" },
  { keys: "L", k: "help.lock" },
  { keys: "+ / − / PageUp / PageDown / 0", k: "help.zoom" },
  { keys: "Space + drag", k: "help.pan" },
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  useEscClose(onClose);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{t("help.title")}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <table className="shortcuts">
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.k}>
                  <td className="keys">{r.keys}</td>
                  <td>{t(r.k)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
