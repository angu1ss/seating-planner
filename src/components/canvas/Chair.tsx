import { Group, Circle, Rect, Text, Path } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { ChairStyle } from "../../types";
import type { ChairPos } from "../../geometry";
import { CHAIR_RADIUS } from "../../constants";
import type { CornerBadges } from "../../iconmap";
import type { Palette } from "../../theme";
import { useContextTrigger, type CtxPoint } from "../../utils/useContextTrigger";

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
  /** Table rotation (deg) — chair contents counter-rotate so they stay upright. */
  tableRotation: number;
  onClick: () => void;
  onContextMenu?: (p: CtxPoint) => void;
}

/** A small FA icon on a white disc. `rot` keeps the icon upright while it sits at a
 * (possibly rotated) corner. */
function Badge({ def, x, y, r, rot }: { def: IconDefinition; x: number; y: number; r: number; rot: number }) {
  const [w, h, , , path] = def.icon;
  const d = Array.isArray(path) ? path.join(" ") : path;
  const s = (r * 1.25) / Math.max(w, h);
  return (
    <Group x={x} y={y} rotation={rot} listening={false}>
      <Circle radius={r} fill="#fff" stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
      <Path data={d} fill="#1b2638" scaleX={s} scaleY={s} offsetX={w / 2} offsetY={h / 2} />
    </Group>
  );
}

/** One seat: a chair shape that's a click/tap target; when taken it shows the guest's
 * initials on a gender-tinted fill, with role/age/feature icons in the corners. */
export function Chair({
  c,
  ppm,
  chairStyle,
  palette,
  occupant,
  highlighted,
  tableRotation,
  onClick,
  onContextMenu,
}: Props) {
  const r = CHAIR_RADIUS * ppm;
  const fill = occupant ? occupant.bg : palette.chairFill;
  const { handlers: ctx, fired } = useContextTrigger(onContextMenu ?? (() => {}), true);
  const handle = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    // Swallow the tap/click that follows a long-press (which already opened the menu).
    if (fired.current) {
      fired.current = false;
      return;
    }
    onClick();
  };
  const br = r * 0.44; // badge radius
  const off = r * 0.8; // corner offset
  // Shrink the initials so up to 4 letters fit inside the chair.
  const initFont = occupant ? Math.min(r * 1.25, (1.75 * r) / Math.max(1, occupant.initials.length * 0.62)) : r;

  // Letters & icons always read parallel to the screen (counter the table's rotation).
  // Square shape itself keeps tilting with the table; its corner badges follow the
  // square (rotate by the chair's own angle), round badges stay at the screen corners.
  const counter = -tableRotation;
  const cornerRot = chairStyle === "square" ? c.rotation : counter;
  const crad = (cornerRot * Math.PI) / 180;
  const ccos = Math.cos(crad);
  const csin = Math.sin(crad);
  const corner = (dx: number, dy: number) => ({ x: dx * ccos - dy * csin, y: dx * csin + dy * ccos });
  const cTL = corner(-off, -off);
  const cTR = corner(off, -off);
  const cBR = corner(off, off);
  const cBL = corner(-off, off);

  return (
    <Group x={c.x * ppm} y={c.y * ppm} onClick={handle} onTap={handle} {...(onContextMenu ? ctx : {})}>
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
            rotation={counter}
            align="center"
            fontSize={initFont}
            fontStyle="700"
            fill="#16243a"
            listening={false}
          />
          {occupant.badges.tl && <Badge def={occupant.badges.tl} x={cTL.x} y={cTL.y} r={br} rot={counter} />}
          {occupant.badges.tr && <Badge def={occupant.badges.tr} x={cTR.x} y={cTR.y} r={br} rot={counter} />}
          {occupant.badges.br && <Badge def={occupant.badges.br} x={cBR.x} y={cBR.y} r={br} rot={counter} />}
          {occupant.badges.bl && <Badge def={occupant.badges.bl} x={cBL.x} y={cBL.y} r={br} rot={counter} />}
        </>
      )}
    </Group>
  );
}
