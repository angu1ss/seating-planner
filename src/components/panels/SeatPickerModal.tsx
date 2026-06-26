import { useState } from "react";
import { useStore, activeSheet } from "../../store";
import { useT } from "../../i18n";
import { useEscClose } from "../../utils/useEscClose";
import { Icon } from "../Icon";
import { GuestAvatar } from "./GuestAvatar";

interface Props {
  tableId: string;
  index: number;
  onClose: () => void;
}

export function SeatPickerModal({ tableId, index, onClose }: Props) {
  const t = useT();
  const guests = useStore((s) => s.guests);
  const sheets = useStore((s) => s.sheets);
  const tables = useStore((s) => activeSheet(s).tables);
  const assign = useStore((s) => s.assignGuestToSeat);
  const unassign = useStore((s) => s.unassignGuest);
  useEscClose(onClose);

  const [tab, setTab] = useState<"unseated" | "all">("unseated");

  const table = tables.find((x) => x.id === tableId);
  const tableLabel = table ? table.name.trim() || `${t("table.word")} ${table.number}` : "";

  const allTables = sheets.flatMap((sh) => sh.tables);
  const labelOf = (id: string) => {
    const tb = allTables.find((x) => x.id === id);
    return tb ? tb.name.trim() || `${t("table.word")} ${tb.number}` : "?";
  };

  const occupant = guests.find((g) => g.seat?.tableId === tableId && g.seat.index === index);
  const others = guests.filter((g) => g.id !== occupant?.id);
  const list = tab === "unseated" ? others.filter((g) => !g.seat) : others;

  const pick = (id: string) => {
    assign(id, tableId, index);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{t("seat.title")}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <p className="muted">{`${tableLabel} · ${t("seat.place").replace("{n}", String(index + 1))}`}</p>

          {occupant && (
            <div className="guest-row">
              <div className="guest-info">
                <GuestAvatar guest={occupant} />
                <div className="guest-text">
                  <span className="guest-name">{occupant.name}</span>
                  {occupant.relation && <span className="muted">{occupant.relation}</span>}
                </div>
              </div>
              <button className="btn danger" onClick={() => unassign(occupant.id)}>
                <Icon name="unweld" /> {t("seat.free")}
              </button>
            </div>
          )}

          <div className="tab-row">
            <button className={`pill ${tab === "unseated" ? "active" : ""}`} onClick={() => setTab("unseated")}>
              {t("seat.tabUnseated")}
            </button>
            <button className={`pill ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>
              {t("seat.tabAll")}
            </button>
          </div>

          {list.length === 0 ? (
            <p className="muted">{t("seat.empty")}</p>
          ) : (
            <ul className="guest-list seat-pick-list">
              {list.map((g) => (
                <li key={g.id} className="guest-row clickable" onClick={() => pick(g.id)}>
                  <div className="guest-info">
                    <GuestAvatar guest={g} />
                    <div className="guest-text">
                      <span className="guest-name">{g.name}</span>
                      <span className={`tag seat ${g.seat ? "on" : ""}`}>
                        {g.seat ? labelOf(g.seat.tableId) : t("guests.unseated")}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
