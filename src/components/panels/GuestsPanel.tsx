import { useState } from "react";
import { useStore } from "../../store";
import { useT } from "../../i18n";
import {
  GUEST_ROLES,
  GUEST_FEATURES,
  AGE_CATEGORIES,
  SEXES,
  guestRoleLabelKey,
  guestFeatureLabelKey,
  ageLabelKey,
  sexLabelKey,
  SEX_COLOR,
  NEUTRAL_SEAT,
  NEWLYWED_ROLES,
  initials,
} from "../../constants";
import { ROLE_ICONS, AGE_ICONS, FEATURE_ICONS, SEX_ICONS } from "../../iconmap";
import type { AgeCategory, Sex, GuestFeature, GuestRole } from "../../types";
import { Icon } from "../Icon";
import { GuestAvatar } from "./GuestAvatar";
import { IconSelect } from "./IconSelect";

const GUEST_DRAG_TYPE = "application/x-guest-id";

interface Form {
  name: string;
  role: GuestRole;
  ageCategory: AgeCategory;
  sex: Sex | "";
  features: GuestFeature[];
  relation: string;
}

const EMPTY: Form = { name: "", role: "guest", ageCategory: "adult", sex: "", features: [], relation: "" };

export function GuestsPanel({ onClose }: { onClose?: () => void }) {
  const t = useT();
  const guests = useStore((s) => s.guests);
  const sheets = useStore((s) => s.sheets);
  const addGuest = useStore((s) => s.addGuest);
  const updateGuest = useStore((s) => s.updateGuest);
  const removeGuest = useStore((s) => s.removeGuest);
  const unassign = useStore((s) => s.unassignGuest);
  const seatNearNewlyweds = useStore((s) => s.seatNearNewlyweds);
  const highlightGuestId = useStore((s) => s.highlightGuestId);
  const setHighlight = useStore((s) => s.setHighlightGuest);
  const chairStyle = useStore((s) => s.settings.chairStyle);

  const newlywedsSeated = guests.some((g) => NEWLYWED_ROLES.includes(g.role) && g.seat);

  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const showForm = adding || editingId !== null;

  const allTables = sheets.flatMap((sh) => sh.tables);
  const seatLabel = (tableId: string) => {
    const tb = allTables.find((x) => x.id === tableId);
    return tb ? tb.name.trim() || `${t("table.word")} ${tb.number}` : "?";
  };

  const toggleFeature = (f: GuestFeature) =>
    setForm((s) => ({
      ...s,
      features: s.features.includes(f) ? s.features.filter((x) => x !== f) : [...s.features, f],
    }));

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
    setAdding(false);
    setHighlight(null);
  };

  const startAdd = () => {
    setForm(EMPTY);
    setEditingId(null);
    setAdding(true);
  };

  const startEdit = (id: string) => {
    const g = guests.find((x) => x.id === id);
    if (!g) return;
    setForm({
      name: g.name,
      role: g.role,
      ageCategory: g.ageCategory,
      sex: g.sex ?? "",
      features: [...g.features],
      relation: g.relation,
    });
    setEditingId(id);
    setAdding(false);
    setHighlight(id);
  };

  const submit = () => {
    const name = form.name.trim();
    if (!name) return;
    const data = {
      name,
      role: form.role,
      ageCategory: form.ageCategory,
      sex: form.sex || null,
      features: form.features,
      relation: form.relation.trim(),
    };
    if (editingId) updateGuest(editingId, data);
    else addGuest(data);
    reset();
  };

  return (
    <div className="panel guests-panel">
      <section className="panel-section">
        <div className="panel-head-row">
          <h3>{`${t("guests.title")} · ${guests.length}`}</h3>
          {onClose && (
            <button className="icon-btn only-mobile" onClick={onClose} aria-label={t("common.close")}>
              <Icon name="close" />
            </button>
          )}
        </div>

        {!showForm ? (
          <button className="btn block primary" onClick={startAdd}>
            <Icon name="add" /> {t("guests.add")}
          </button>
        ) : (
          <>
            <label className="field">
              <span>{t("guests.name")}</span>
              <input
                autoFocus
                value={form.name}
                placeholder={t("guests.namePlaceholder")}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
            </label>
            <div className="field-2col">
              <div className="field">
                <span>{t("guests.role")}</span>
                <IconSelect
                  ariaLabel={t("guests.role")}
                  value={form.role}
                  onChange={(v) => setForm({ ...form, role: v as GuestRole })}
                  options={GUEST_ROLES.map((r) => ({ value: r, label: t(guestRoleLabelKey(r)), icon: ROLE_ICONS[r] }))}
                />
              </div>
              <div className="field">
                <span>{t("guests.age")}</span>
                <IconSelect
                  ariaLabel={t("guests.age")}
                  value={form.ageCategory}
                  onChange={(v) => setForm({ ...form, ageCategory: v as AgeCategory })}
                  options={AGE_CATEGORIES.map((a) => ({ value: a, label: t(ageLabelKey(a)), icon: AGE_ICONS[a] }))}
                />
              </div>
            </div>
            <div className="field">
              <span className="field-caption">{t("guests.sex")}</span>
              <div className="seg sex-seg">
                {SEXES.map((sx) => (
                  <button
                    key={sx}
                    type="button"
                    className={`seg-btn ${form.sex === sx ? "active" : ""}`}
                    onClick={() => setForm({ ...form, sex: sx })}
                    aria-pressed={form.sex === sx}
                    title={t(sexLabelKey(sx))}
                  >
                    <Icon icon={SEX_ICONS[sx]} /> {t(sexLabelKey(sx)).charAt(0)}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field-caption">{t("guests.features")}</span>
              <div className="features-grid">
                {GUEST_FEATURES.map((f) => (
                  <label key={f} className="field-inline">
                    <input type="checkbox" checked={form.features.includes(f)} onChange={() => toggleFeature(f)} />
                    <Icon icon={FEATURE_ICONS[f]} />
                    <span>{t(guestFeatureLabelKey(f))}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="field">
              <span>{t("guests.relation")}</span>
              <input
                value={form.relation}
                placeholder={t("guests.relationPlaceholder")}
                onChange={(e) => setForm({ ...form, relation: e.target.value })}
              />
            </label>
            <div className="row-actions">
              <button className="btn primary" onClick={submit}>
                <Icon name={editingId ? "edit" : "add"} /> {editingId ? t("guests.save") : t("common.add")}
              </button>
              <button className="btn" onClick={reset}>
                {t("common.cancel")}
              </button>
              {editingId && (
                <button
                  className="btn danger icon-only"
                  title={t("common.delete")}
                  onClick={() => {
                    removeGuest(editingId);
                    reset();
                  }}
                >
                  <Icon name="delete" />
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <section className="panel-section">
        <span className="field-caption">{t("rules.title")}</span>
        {newlywedsSeated ? (
          <div className="row-actions rule-buttons">
            <button className="btn" onClick={() => seatNearNewlyweds(["witness"])}>
              {t("rules.witnesses")}
            </button>
            <button className="btn" onClick={() => seatNearNewlyweds(["parent"])}>
              {t("rules.parents")}
            </button>
            <button className="btn" onClick={() => seatNearNewlyweds(["witness", "parent"])}>
              {t("rules.both")}
            </button>
          </div>
        ) : (
          <p className="muted">{t("rules.needNewlyweds")}</p>
        )}
      </section>

      <section className="panel-section">
        {guests.length === 0 ? (
          <p className="muted">{t("guests.empty")}</p>
        ) : (
          <ul className="guest-list">
            {guests.map((g) => (
              <li
                key={g.id}
                className={`guest-row clickable ${editingId === g.id ? "active" : ""} ${highlightGuestId === g.id ? "highlighted" : ""}`}
                draggable
                title={g.relation || undefined}
                onClick={() => startEdit(g.id)}
                onDragStart={(e) => {
                  e.dataTransfer.setData(GUEST_DRAG_TYPE, g.id);
                  e.dataTransfer.effectAllowed = "copyMove";
                  // Build a clean circular/square ghost (no square backdrop, no badges).
                  const ghost = document.createElement("div");
                  ghost.textContent = initials(g.name);
                  Object.assign(ghost.style, {
                    position: "fixed",
                    top: "-200px",
                    left: "-200px",
                    width: "38px",
                    height: "38px",
                    borderRadius: chairStyle === "square" ? "24%" : "50%",
                    background: g.sex ? SEX_COLOR[g.sex] : NEUTRAL_SEAT,
                    color: "#16243a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "700",
                    fontSize: "14px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                  });
                  document.body.appendChild(ghost);
                  e.dataTransfer.setDragImage(ghost, 19, 19);
                  setTimeout(() => ghost.remove(), 0);
                }}
              >
                <div className="guest-info">
                  <GuestAvatar guest={g} />
                  <div className="guest-text">
                    <span className="guest-name">{g.name}</span>
                    <span className={`tag seat ${g.seat ? "on" : ""}`}>
                      {g.seat ? seatLabel(g.seat.tableId) : t("guests.unseated")}
                    </span>
                  </div>
                </div>
                {g.seat && (
                  <div className="guest-actions">
                    <button
                      className="icon-btn small"
                      onClick={(e) => {
                        e.stopPropagation();
                        unassign(g.id);
                      }}
                      title={t("seat.free")}
                      aria-label={t("seat.free")}
                    >
                      <Icon name="unweld" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
