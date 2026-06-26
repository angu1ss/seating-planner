import { Group, Circle, Line, Text, Path } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { ChairStyle, TableModel } from "../../types";
import { computeSnakeChairs, snakeCenterline, snakeLength } from "../../geometry";
import type { Palette } from "../../theme";
import { useT } from "../../i18n";
import { LOCK_BODY, LOCK_SHACKLE_CLOSED } from "../icons";
import { Chair, type Occupant } from "./Chair";

const LOCK_ICON = 14;

interface Props {
  table: TableModel;
  selected: boolean;
  soleSelected: boolean;
  tooClose: boolean;
  panLocked: boolean;
  ppm: number;
  palette: Palette;
  projectChairStyle: ChairStyle;
  minSpacing: number;
  occupants: Record<number, Occupant>;
  highlightIndex: number | null;
  onSeatClick: (tableId: string, index: number) => void;
  onSelect: (id: string, additive: boolean) => void;
  onDragStartTable: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onMove: (id: string, x: number, y: number) => void;
  onNodeDrag: (id: string, index: number, x: number, y: number) => void;
  onNodeCommit: (id: string) => void;
  onAddNode: (id: string, x: number, y: number) => void;
  onRemoveNode: (id: string, index: number) => void;
  dragBound: (pos: { x: number; y: number }) => { x: number; y: number };
}

export function SnakeNode({
  table,
  selected,
  soleSelected,
  tooClose,
  panLocked,
  ppm,
  palette,
  projectChairStyle,
  minSpacing,
  occupants,
  highlightIndex,
  onSeatClick,
  onSelect,
  onDragStartTable,
  onDragMove,
  onMove,
  onNodeDrag,
  onNodeCommit,
  onAddNode,
  onRemoveNode,
  dragBound,
}: Props) {
  const t = useT();
  const path = table.path ?? [];
  const editable = soleSelected && !table.locked;

  const dense = snakeCenterline(path);
  const linePoints = dense.flatMap((p) => [p.x * ppm, p.y * ppm]);
  const chairs = computeSnakeChairs(table);
  const chairStyle: ChairStyle = table.chairStyle ?? projectChairStyle;

  // Comfort: spacing = total length × enabled sides ÷ seats.
  const sidesOn = (table.disabledSides.includes("right") ? 0 : 1) + (table.disabledSides.includes("left") ? 0 : 1);
  const spacing = sidesOn > 0 && table.seatCount > 0 ? (snakeLength(path) * sidesOn) / table.seatCount : Infinity;
  const tight = table.seatCount > 0 && spacing < minSpacing - 1e-9;

  const stroke = selected
    ? palette.tableSelected
    : tooClose
      ? palette.tableClose
      : tight
        ? palette.tableTight
        : table.isPodium
          ? palette.podiumStroke
          : palette.tableStroke;
  const bandPx = Math.max(6, table.h * ppm);
  const borderPx = selected ? 3 : tooClose || tight ? 2.5 : 1.5;
  const haloPx = 0.14 * ppm; // podium ring width, meters → px
  const label = table.name.trim() || `${t("table.word")} ${table.number}`;

  const handleSelect = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    const additive = Boolean((e.evt as MouseEvent | undefined)?.shiftKey);
    onSelect(table.id, additive);
  };

  const addNodeAtPointer = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    if (!editable) return;
    const grp = e.target.getParent();
    const lp = grp?.getRelativePointerPosition();
    if (lp) onAddNode(table.id, lp.x / ppm, lp.y / ppm);
  };

  return (
    <Group
      x={table.x * ppm}
      y={table.y * ppm}
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
      {/* Chairs (behind the band) */}
      {chairs.map((c, i) => (
        <Chair
          key={i}
          c={c}
          ppm={ppm}
          chairStyle={chairStyle}
          palette={palette}
          occupant={occupants[i] ?? null}
          highlighted={i === highlightIndex}
          onClick={() => onSeatClick(table.id, i)}
        />
      ))}

      {/* Podium halo ring (behind the band) */}
      {table.isPodium && (
        <Line
          points={linePoints}
          stroke={palette.podiumHalo}
          strokeWidth={bandPx + haloPx * 2}
          lineCap="round"
          lineJoin="round"
          dash={[3, 4]}
          listening={false}
        />
      )}

      {/* Band: outer border line + inner fill line, both rounded. */}
      <Line
        points={linePoints}
        stroke={stroke}
        strokeWidth={bandPx}
        lineCap="round"
        lineJoin="round"
        dash={!selected && table.isPodium ? [10, 5] : undefined}
        onDblClick={addNodeAtPointer}
        onDblTap={addNodeAtPointer}
      />
      <Line
        points={linePoints}
        stroke={palette.tableFill}
        strokeWidth={Math.max(1, bandPx - borderPx * 2)}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />

      <Text
        text={`${label}\n${table.seatCount} ${t("table.seatsShort")}`}
        x={-40}
        y={-12}
        width={80}
        align="center"
        fontSize={12}
        lineHeight={1.25}
        fill={palette.labelText}
        listening={false}
      />

      {table.locked && (
        <Group scaleX={LOCK_ICON / 16} scaleY={LOCK_ICON / 16} listening={false}>
          <Path data={LOCK_BODY} stroke={palette.labelText} strokeWidth={1.8} lineCap="round" lineJoin="round" />
          <Path data={LOCK_SHACKLE_CLOSED} stroke={palette.labelText} strokeWidth={1.8} lineCap="round" lineJoin="round" />
        </Group>
      )}

      {/* Editable node handles */}
      {editable &&
        path.map((p, i) => (
          <Circle
            key={`h${i}`}
            x={p.x * ppm}
            y={p.y * ppm}
            radius={7}
            fill={palette.tableFill}
            stroke={palette.tableSelected}
            strokeWidth={2}
            draggable={!panLocked}
            onDragStart={(e) => {
              e.cancelBubble = true;
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              onNodeDrag(table.id, i, e.target.x() / ppm, e.target.y() / ppm);
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              onNodeCommit(table.id);
            }}
            onDblClick={(e) => {
              e.cancelBubble = true;
              onRemoveNode(table.id, i);
            }}
            onDblTap={(e) => {
              e.cancelBubble = true;
              onRemoveNode(table.id, i);
            }}
          />
        ))}
    </Group>
  );
}
