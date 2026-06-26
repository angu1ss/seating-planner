import { Group, Rect, Ellipse, Circle, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { ChairStyle, TableModel } from "../../types";
import { CHAIR_RADIUS } from "../../constants";
import { computeChairs, isTight } from "../../geometry";
import type { Palette } from "../../theme";

interface Props {
  table: TableModel;
  selected: boolean;
  ppm: number;
  palette: Palette;
  projectChairStyle: ChairStyle;
  minSpacing: number;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}

export function TableNode({
  table,
  selected,
  ppm,
  palette,
  projectChairStyle,
  minSpacing,
  onSelect,
  onMove,
}: Props) {
  const tight = isTight(table, minSpacing);
  const chairStyle: ChairStyle = table.chairStyle ?? projectChairStyle;
  const chairs = computeChairs(table);

  const stroke = selected
    ? palette.tableSelected
    : tight
      ? palette.tableTight
      : table.isPodium
        ? palette.podiumStroke
        : palette.tableStroke;
  const strokeWidth = selected ? 3 : tight || table.isPodium ? 2.5 : 1.5;
  const dash = table.isPodium && !selected ? [10, 5] : undefined;

  const wpx = table.w * ppm;
  const hpx = table.h * ppm;
  const chairR = CHAIR_RADIUS * ppm;

  const handleSelect = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    onSelect(table.id);
  };

  return (
    <Group
      x={table.x * ppm}
      y={table.y * ppm}
      rotation={table.rotation}
      draggable
      onClick={handleSelect}
      onTap={handleSelect}
      onDragStart={() => onSelect(table.id)}
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
        text={`${table.name}\n${table.seatCount} мест`}
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
    </Group>
  );
}
