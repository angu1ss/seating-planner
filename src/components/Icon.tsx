import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { UI_ICONS, type UiIconName } from "../iconmap";

interface Props {
  name?: UiIconName;
  icon?: IconDefinition;
  size?: number;
}

export function Icon({ name, icon, size }: Props) {
  const def = icon ?? (name ? UI_ICONS[name] : undefined);
  if (!def) return null;
  return (
    <FontAwesomeIcon
      icon={def}
      style={size ? { fontSize: size, width: "1em", height: "1em" } : undefined}
    />
  );
}
