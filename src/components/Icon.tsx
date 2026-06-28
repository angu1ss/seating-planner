import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { UI_ICONS, type UiIconName } from "../iconmap";

interface Props {
  name?: UiIconName;
  icon?: IconDefinition;
  size?: number;
}

// FontAwesome 7.3: `fa-canvas-square` renders the icon in a 20×20 square canvas, centred
// on both axes (vs the default 20×16 fixed-width), so different-width glyphs sit centred
// in discs/buttons. (`fixedWidth`/`title` props are deprecated in v7 — for hover tooltips
// put a native HTML `title` on the wrapping element instead.)
export function Icon({ name, icon, size }: Props) {
  const def = icon ?? (name ? UI_ICONS[name] : undefined);
  if (!def) return null;
  return (
    <FontAwesomeIcon
      icon={def}
      className="fa-canvas-square"
      style={size ? { fontSize: size } : undefined}
    />
  );
}
