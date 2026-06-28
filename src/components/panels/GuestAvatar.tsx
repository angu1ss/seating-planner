import { useStore } from "../../store";
import { useT } from "../../i18n";
import { Icon } from "../Icon";
import { guestBadges, iconLabelKey } from "../../iconmap";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { SEX_COLOR, NEUTRAL_SEAT, initials } from "../../constants";
import type { Guest } from "../../types";

/** A small HTML version of the on-chair avatar: initials on a sex tint, with the same
 * corner role / age / feature badges and the project's default chair shape. */
export function GuestAvatar({ guest, size = 38 }: { guest: Guest; size?: number }) {
  const chairStyle = useStore((s) => s.settings.chairStyle);
  const t = useT();
  const badgeTitle = (def: IconDefinition) => {
    const key = iconLabelKey(def);
    return key ? t(key) : undefined;
  };
  const bg = guest.sex ? SEX_COLOR[guest.sex] : NEUTRAL_SEAT;
  const ini = initials(guest.name);
  const fs = size * (ini.length >= 4 ? 0.24 : ini.length === 3 ? 0.3 : 0.4);
  const badges = guestBadges(guest);
  const borderRadius = chairStyle === "square" ? "24%" : "50%";

  return (
    <span className="guest-avatar" title={guest.name} style={{ width: size, height: size, background: bg, borderRadius }}>
      <span className="ga-initials" style={{ fontSize: fs }}>
        {ini}
      </span>
      {badges.tl && (
        <span className="ga-badge tl" title={badgeTitle(badges.tl)}>
          <Icon icon={badges.tl} />
        </span>
      )}
      {badges.tr && (
        <span className="ga-badge tr" title={badgeTitle(badges.tr)}>
          <Icon icon={badges.tr} />
        </span>
      )}
      {badges.br && (
        <span className="ga-badge br" title={badgeTitle(badges.br)}>
          <Icon icon={badges.br} />
        </span>
      )}
      {badges.bl && (
        <span className="ga-badge bl" title={badgeTitle(badges.bl)}>
          <Icon icon={badges.bl} />
        </span>
      )}
    </span>
  );
}
