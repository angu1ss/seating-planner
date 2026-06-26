import { Group, Rect, Ellipse, Circle, Text, Path } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { ChairStyle, TableModel } from "../../types";
import { CHAIR_RADIUS } from "../../constants";
import { computeChairs, isTight } from "../../geometry";
import type { Palette } from "../../theme";
import { useT } from "../../i18n";
import { LOCK_BODY, LOCK_SHACKLE_CLOSED } from "../icons";

const LOCK_ICON = 14;

interface Props {
  table: TableModel;
  selected: boolean;
  tooClose: boolean;
  panLocked: boolean;
  ppm: number;
  palette: Palette;
  projectChairStyle: ChairStyle;
  minSpacing: number;
  onSelect: (id: string, additive: boolean) => void;
  onDragStartTable: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onMove: (id: string, x: number, y: number) => void;
  dragBound: (pos: { x: number; y: number }) => { x: number; y: number };
}

const PODIUM_HALO = 0.14; // meters

export function TableNode({
  table,
  selected,
  tooClose,
  panLocked,
  ppm,
  palette,
  projectChairStyle,
  minSpacing,
  onSelect,
  onDragStartTable,
  onDragMove,
  onMove,
  dragBound,
}: Props) {
  const t = useT();
  const tight = isTight(table, minSpacing);
  const chairStyle: ChairStyle = table.chairStyle ?? projectChairStyle;
  const chairs = computeChairs(table);
  const label = table.name.trim() || `${t("table.word")} ${table.number}`;

  const stroke = selected
    ? palette.tableSelected
    : tooClose
      ? palette.tableClose
      : tight
        ? palette.tableTight
        : table.isPodium
          ? palette.podiumStroke
          : palette.tableStroke;
  const strokeWidth = selected ? 3 : tooClose || tight || table.isPodium ? 2.5 : 1.5;
  const dash = !selected && table.isPodium ? [10, 5] : !selected && tooClose ? [6, 4] : undefined;

  const wpx = table.w * ppm;
  const hpx = table.h * ppm;
  const chairR = CHAIR_RADIUS * ppm;
  const haloPx = PODIUM_HALO * ppm;

  const handleSelect = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    const additive = Boolean((e.evt as MouseEvent | undefined)?.shiftKey);
    onSelect(table.id, additive);
  };

  return (
    <Group
      x={table.x * ppm}
      y={table.y * ppm}
      rotation={table.rotation}
      draggable={!panLocked && !table.locked}
      dragBoundFunc={dragBound}
      onClick={handleSelect}
      onTap={handleSelect}
      onDragStart={() => {
        if (!selected) onSelect(table.id, false);
        onDragStartTable(table.id);
      }}
      onDragMove={(e) => onDragMove(table.id, e.target.x() / ppm, e.target.y() / ppm)}
      onDragEnd={(e) => onMove(table.id, e.target.x() / ppm, e.target.y() / ppm)}
    >
      {/* Chairs (drawn first, behind the table top) */}
      {chairs.map((c, i) =>
        chairStyle === "round" ? (
          <Circle
            key={i}
            x={c.x * ppm}
            y={c.y * ppm}
            radius={chairR}
            fill={palette.chairFill}
            stroke={palette.chairStroke}
            strokeWidth={1}
            listening={false}
          />
        ) : (
          <Rect
            key={i}
            x={c.x * ppm}
            y={c.y * ppm}
            width={chairR * 2}
            height={chairR * 2}
            offsetX={chairR}
            offsetY={chairR}
            rotation={c.rotation}
            cornerRadius={chairR * 0.35}
            fill={palette.chairFill}
            stroke={palette.chairStroke}
            strokeWidth={1}
            listening={false}
          />
        ),
      )}

      {/* Podium halo ring */}
      {table.isPodium &&
        (table.shape === "ellipse" ? (
          <Ellipse
            radiusX={wpx / 2 + haloPx}
            radiusY={hpx / 2 + haloPx}
            stroke={palette.podiumHalo}
            strokeWidth={2}
            dash={[3, 4]}
            listening={false}
          />
        ) : (
          <Rect
            x={-wpx / 2 - haloPx}
            y={-hpx / 2 - haloPx}
            width={wpx + haloPx * 2}
            height={hpx + haloPx * 2}
            cornerRadius={Math.min(wpx, hpx) * 0.06 + haloPx}
            stroke={palette.podiumHalo}
            strokeWidth={2}
            dash={[3, 4]}
            listening={false}
          />
        ))}

      {/* Table top */}
      {table.shape === "ellipse" ? (
        <Ellipse
          radiusX={wpx / 2}
          radiusY={hpx / 2}
          fill={palette.tableFill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
        />
      ) : (
        <Rect
          x={-wpx / 2}
          y={-hpx / 2}
          width={wpx}
          height={hpx}
          cornerRadius={Math.min(wpx, hpx) * 0.06}
          fill={palette.tableFill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
        />
      )}

      {/* Label */}
      <Text
        text={`${label}\n${table.seatCount} ${t("table.seatsShort")}`}
        width={Math.max(wpx, 60)}
        height={hpx}
        offsetX={Math.max(wpx, 60) / 2}
        offsetY={hpx / 2}
        align="center"
        verticalAlign="middle"
        fontSize={12}
        lineHeight={1.25}
        fill={palette.labelText}
        listening={false}
      />

      {table.locked && (
        <Group
          x={wpx / 2 - LOCK_ICON - 3}
          y={-hpx / 2 + 3}
          scaleX={LOCK_ICON / 16}
          scaleY={LOCK_ICON / 16}
          listening={false}
        >
          <Path data={LOCK_BODY} stroke={palette.labelText} strokeWidth={1.8} lineCap="round" lineJoin="round" />
          <Path
            data={LOCK_SHACKLE_CLOSED}
            stroke={palette.labelText}
            strokeWidth={1.8}
            lineCap="round"
            lineJoin="round"
          />
        </Group>
      )}
    </Group>
  );
}
