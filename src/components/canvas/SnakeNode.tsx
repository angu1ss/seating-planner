import { memo, useMemo, useRef } from "react";
import { Group, Circle, Line, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { ChairStyle, TableModel } from "../../types";
import { computeSnakeChairs, readableAngle, snakeCenterline, snakeLength, tableWallExtents } from "../../geometry";
import type { Palette } from "../../theme";
import { useT } from "../../i18n";
import { Chair, type Occupant } from "./Chair";
import { LockBadge } from "./LockBadge";
import { makeDragBound } from "./dragBound";
import { useContextTrigger, type CtxPoint } from "../../utils/useContextTrigger";

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
  onSeatContextMenu: (tableId: string, index: number, p: CtxPoint) => void;
  onSeatHover?: (tip: string, clientX: number, clientY: number) => void;
  onSeatHoverEnd?: () => void;
  onSelect: (id: string, additive: boolean) => void;
  onDragStartTable: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onMove: (id: string, x: number, y: number) => void;
  onNodeDrag: (id: string, index: number, x: number, y: number) => void;
  onNodeCommit: (id: string) => void;
  onAddNode: (id: string, x: number, y: number) => void;
  onRemoveNode: (id: string, index: number) => void;
  onContextMenu: (id: string, p: CtxPoint) => void;
  onNodeContextMenu: (id: string, index: number, p: CtxPoint) => void;
  venueWidth: number;
  venueHeight: number;
}

export const SnakeNode = memo(function SnakeNode({
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
  onSeatContextMenu,
  onSeatHover,
  onSeatHoverEnd,
  onSelect,
  onDragStartTable,
  onDragMove,
  onMove,
  onNodeDrag,
  onNodeCommit,
  onAddNode,
  onRemoveNode,
  onContextMenu,
  onNodeContextMenu,
  venueWidth,
  venueHeight,
}: Props) {
  const t = useT();
  const groupRef = useRef<Konva.Group>(null);
  const { handlers: ctx } = useContextTrigger((p) => onContextMenu(table.id, p));
  const dragBound = useMemo(
    () => makeDragBound(() => groupRef.current?.getStage() ?? null, tableWallExtents(table), venueWidth, venueHeight, ppm),
    [table, venueWidth, venueHeight, ppm],
  );
  const nodeLp = useRef<number | null>(null);
  const cancelNodeLp = () => {
    if (nodeLp.current !== null) {
      window.clearTimeout(nodeLp.current);
      nodeLp.current = null;
    }
  };
  const path = table.path ?? [];
  const editable = soleSelected && !table.locked;

  const dense = snakeCenterline(path);
  const linePoints = dense.flatMap((p) => [p.x * ppm, p.y * ppm]);
  const chairs = computeSnakeChairs(table);
  const chairStyle: ChairStyle = table.chairStyle ?? projectChairStyle;

  // Comfort: seats run around the whole band ≈ both long sides.
  const spacing = table.seatCount > 0 ? (2 * snakeLength(path)) / table.seatCount : Infinity;
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

  // Lock badge ON the band (its centerline end-tip) so it stays inside the table and
  // doesn't overlap the guests' chairs/icons sitting outside the band.
  const tip = dense[dense.length - 1] ?? { x: 0, y: 0 };
  const brad = (table.rotation * Math.PI) / 180;
  const badgeX = (tip.x * Math.cos(brad) - tip.y * Math.sin(brad)) * ppm;
  const badgeY = (tip.x * Math.sin(brad) + tip.y * Math.cos(brad)) * ppm;

  // Label sits ON the band at the centreline's arc-length midpoint, oriented along the
  // band — so it's always inside the table (it tilts to follow the band if needed).
  let arc = 0;
  const cum: number[] = [0];
  for (let i = 1; i < dense.length; i++) {
    arc += Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y);
    cum.push(arc);
  }
  let mi = 0;
  while (mi < dense.length - 2 && cum[mi + 1] < arc / 2) mi++;
  const segLen = cum[mi + 1] - cum[mi] || 1;
  const mf = (arc / 2 - cum[mi]) / segLen;
  const labelX = (dense[mi].x + (dense[mi + 1].x - dense[mi].x) * mf) * ppm;
  const labelY = (dense[mi].y + (dense[mi + 1].y - dense[mi].y) * mf) * ppm;
  const tAng = (Math.atan2(dense[mi + 1].y - dense[mi].y, dense[mi + 1].x - dense[mi].x) * 180) / Math.PI;
  const labelRot = readableAngle(table.rotation + tAng) - table.rotation;

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
    <>
    <Group
      ref={groupRef}
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
      {...ctx}
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
          tableRotation={table.rotation}
          onClick={() => onSeatClick(table.id, i)}
          onContextMenu={(p) => onSeatContextMenu(table.id, i, p)}
          onHover={onSeatHover}
          onHoverEnd={onSeatHoverEnd}
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
        x={labelX}
        y={labelY}
        width={80}
        offsetX={40}
        offsetY={14}
        rotation={labelRot}
        align="center"
        fontSize={12}
        lineHeight={1.25}
        fill={palette.labelText}
        listening={false}
      />

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
            onContextMenu={(e) => {
              e.evt.preventDefault();
              e.cancelBubble = true;
              onNodeContextMenu(table.id, i, { x: e.evt.clientX, y: e.evt.clientY });
            }}
            onTouchStart={(e) => {
              e.cancelBubble = true;
              const tp = e.evt.touches[0];
              if (!tp) return;
              const pt = { x: tp.clientX, y: tp.clientY };
              cancelNodeLp();
              nodeLp.current = window.setTimeout(() => onNodeContextMenu(table.id, i, pt), 500);
            }}
            onTouchMove={cancelNodeLp}
            onTouchEnd={cancelNodeLp}
          />
        ))}
    </Group>
    {table.locked && (
      <Group x={table.x * ppm} y={table.y * ppm} listening={false}>
        <LockBadge x={badgeX} y={badgeY} />
      </Group>
    )}
    </>
  );
});
