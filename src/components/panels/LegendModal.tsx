import { useT } from "../../i18n";
import { useEscClose } from "../../utils/useEscClose";
import { Icon } from "../Icon";
import {
  GUEST_ROLES,
  AGE_CATEGORIES,
  GUEST_FEATURES,
  SEXES,
  guestRoleLabelKey,
  ageLabelKey,
  guestFeatureLabelKey,
  sexLabelKey,
  SEX_COLOR,
  NEUTRAL_SEAT,
} from "../../constants";
import { ROLE_ICONS, AGE_ICONS, FEATURE_ICONS } from "../../iconmap";

export function LegendModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  useEscClose(onClose);

  const roleItems = GUEST_ROLES.filter((r) => ROLE_ICONS[r]);
  const ageItems = AGE_CATEGORIES.filter((a) => AGE_ICONS[a]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{t("legend.title")}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body legend-body">
          <h3>{t("guests.role")}</h3>
          <div className="legend-grid">
            {roleItems.map((r) => (
              <div key={r} className="legend-item">
                <Icon icon={ROLE_ICONS[r]!} />
                <span>{t(guestRoleLabelKey(r))}</span>
              </div>
            ))}
          </div>

          <h3>{t("guests.age")}</h3>
          <div className="legend-grid">
            {ageItems.map((a) => (
              <div key={a} className="legend-item">
                <Icon icon={AGE_ICONS[a]!} />
                <span>{t(ageLabelKey(a))}</span>
              </div>
            ))}
          </div>

          <h3>{t("guests.features")}</h3>
          <div className="legend-grid">
            {GUEST_FEATURES.map((f) => (
              <div key={f} className="legend-item">
                <Icon icon={FEATURE_ICONS[f]} />
                <span>{t(guestFeatureLabelKey(f))}</span>
              </div>
            ))}
          </div>

          <h3>{t("guests.sex")}</h3>
          <div className="legend-grid">
            {SEXES.map((sx) => (
              <div key={sx} className="legend-item">
                <span className="legend-swatch" style={{ background: SEX_COLOR[sx] }} />
                <span>{t(sexLabelKey(sx))}</span>
              </div>
            ))}
            <div className="legend-item">
              <span className="legend-swatch" style={{ background: NEUTRAL_SEAT }} />
              <span>{t("sex.unspecified")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
