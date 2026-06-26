import { useState } from "react";
import { useStore } from "../../store";
import { useT } from "../../i18n";
import { Icon } from "../Icon";
import { ConfirmModal } from "./ConfirmModal";

export function TabBar() {
  const t = useT();
  const sheets = useStore((s) => s.sheets);
  const activeId = useStore((s) => s.activeSheetId);
  const setActive = useStore((s) => s.setActiveSheet);
  const addSheet = useStore((s) => s.addSheet);
  const renameSheet = useStore((s) => s.renameSheet);
  const removeSheet = useStore((s) => s.removeSheet);
  const [editing, setEditing] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  return (
    <div className="tab-bar">
      {sheets.map((sh) => (
        <div
          key={sh.id}
          className={`tab ${sh.id === activeId ? "active" : ""}`}
          onClick={() => setActive(sh.id)}
          onDoubleClick={() => setEditing(sh.id)}
        >
          {editing === sh.id ? (
            <input
              autoFocus
              className="tab-input"
              value={sh.name}
              onChange={(e) => renameSheet(sh.id, e.target.value)}
              onBlur={() => setEditing(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") setEditing(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="tab-name">{sh.name}</span>
          )}
          {sheets.length > 1 && editing !== sh.id && (
            <button
              className="tab-close"
              aria-label={t("common.delete")}
              onClick={(e) => {
                e.stopPropagation();
                setPendingRemove(sh.id);
              }}
            >
              <Icon name="close" />
            </button>
          )}
        </div>
      ))}
      <button className="tab-add" onClick={addSheet} title={t("sheet.add")} aria-label={t("sheet.add")}>
        <Icon name="add" />
      </button>

      {pendingRemove && (
        <ConfirmModal
          title={t("sheet.remove")}
          message={t("sheet.removeConfirm")}
          confirmLabel={t("common.delete")}
          danger
          onConfirm={() => removeSheet(pendingRemove)}
          onClose={() => setPendingRemove(null)}
        />
      )}
    </div>
  );
}
