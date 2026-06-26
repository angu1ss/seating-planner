import { Group, Circle, Rect, Text, Path } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { ChairStyle } from "../../types";
import type { ChairPos } from "../../geometry";
import { CHAIR_RADIUS } from "../../constants";
import type { CornerBadges } from "../../iconmap";
import type { Palette } from "../../theme";

export interface Occupant {
  initials: string;
  bg: string;
  badges: CornerBadges;
}

interface Props {
  c: ChairPos;
  ppm: number;
  chairStyle: ChairStyle;
  palette: Palette;
  occupant: Occupant | null;
  highlighted?: boolean;
  onClick: () => void;
}

/** A small FA icon on a white disc — used for the corner role/age/feature badges. */
function Badge({ def, cx, cy, r }: { def: IconDefinition; cx: number; cy: number; r: number }) {
  const [w, h, , , path] = def.icon;
  const d = Array.isArray(path) ? path.join(" ") : path;
  const s = (r * 1.25) / Math.max(w, h);
  return (
    <>
      <Circle x={cx} y={cy} radius={r} fill="#fff" stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} listening={false} />
      <Path data={d} fill="#1b2638" x={cx} y={cy} scaleX={s} scaleY={s} offsetX={w / 2} offsetY={h / 2} listening={false} />
    </>
  );
}

/** One seat: a chair shape that's a click/tap target; when taken it shows the guest's
 * initials on a gender-tinted fill, with role/age/feature icons in the corners. */
export function Chair({ c, ppm, chairStyle, palette, occupant, highlighted, onClick }: Props) {
  const r = CHAIR_RADIUS * ppm;
  const fill = occupant ? occupant.bg : palette.chairFill;
  const handle = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    onClick();
  };
  const br = r * 0.44; // badge radius
  const off = r * 0.8; // corner offset
  // Shrink the initials so up to 4 letters fit inside the chair.
  const initFont = occupant ? Math.min(r * 1.25, (1.75 * r) / Math.max(1, occupant.initials.length * 0.62)) : r;

  return (
    <Group x={c.x * ppm} y={c.y * ppm} onClick={handle} onTap={handle}>
      {highlighted && (
        <Circle radius={r * 1.55} stroke={palette.tableSelected} strokeWidth={2.5} listening={false} />
      )}
      {chairStyle === "round" ? (
        <Circle radius={r} fill={fill} stroke={palette.chairStroke} strokeWidth={1} />
      ) : (
        <Rect
          width={r * 2}
          height={r * 2}
          offsetX={r}
          offsetY={r}
          rotation={c.rotation}
          cornerRadius={r * 0.35}
          fill={fill}
          stroke={palette.chairStroke}
          strokeWidth={1}
        />
      )}

      {occupant && (
        <>
          <Text
            text={occupant.initials}
            width={r * 2}
            offsetX={r}
            offsetY={initFont * 0.55}
            align="center"
            fontSize={initFont}
            fontStyle="700"
            fill="#16243a"
            listening={false}
          />
          {occupant.badges.tl && <Badge def={occupant.badges.tl} cx={-off} cy={-off} r={br} />}
          {occupant.badges.tr && <Badge def={occupant.badges.tr} cx={off} cy={-off} r={br} />}
          {occupant.badges.br && <Badge def={occupant.badges.br} cx={off} cy={off} r={br} />}
          {occupant.badges.bl && <Badge def={occupant.badges.bl} cx={-off} cy={off} r={br} />}
        </>
      )}
    </Group>
  );
}
