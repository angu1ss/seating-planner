import { useEffect, useRef } from "react";
import { Group, Rect, Ellipse, Text, Transformer } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { ChairStyle, Side, TableModel } from "../../types";
import { computeChairs, isTight, objectWallExtents, readableAngle } from "../../geometry";
import type { Palette } from "../../theme";
import { useT } from "../../i18n";
import { Chair, type Occupant } from "./Chair";
import { LockBadge } from "./LockBadge";
import { useContextTrigger, type CtxPoint } from "../../utils/useContextTrigger";

interface TransformPatch {
  w?: number;
  h?: number;
  x?: number;
  y?: number;
  rotation?: number;
}

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
  weldedSides: Side[];
  occupants: Record<number, Occupant>;
  highlightIndex: number | null;
  onSeatClick: (tableId: string, index: number) => void;
  onSeatContextMenu: (index: number, p: CtxPoint) => void;
  onSeatHover?: (tip: string, clientX: number, clientY: number) => void;
  onSeatHoverEnd?: () => void;
  onSelect: (id: string, additive: boolean) => void;
  onDragStartTable: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onMove: (id: string, x: number, y: number) => void;
  onTransform: (id: string, patch: TransformPatch) => void;
  onContextMenu: (p: CtxPoint) => void;
  dragBound: (pos: { x: number; y: number }) => { x: number; y: number };
}

const PODIUM_HALO = 0.14; // meters

export function TableNode({
  table,
  selected,
  soleSelected,
  tooClose,
  panLocked,
  ppm,
  palette,
  projectChairStyle,
  minSpacing,
  weldedSides,
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
  onTransform,
  onContextMenu,
  dragBound,
}: Props) {
  const t = useT();
  const { handlers: ctx } = useContextTrigger(onContextMenu);
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const editable = soleSelected && !table.locked;

  useEffect(() => {
    if (editable && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [editable, table.w, table.h, table.shape]);

  const handleTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onTransform(table.id, {
      w: Math.max(0.3, table.w * sx),
      h: Math.max(0.3, table.h * sy),
      x: node.x() / ppm,
      y: node.y() / ppm,
      rotation: node.rotation(),
    });
  };
  const tight = isTight(table, minSpacing, weldedSides);
  const chairStyle: ChairStyle = table.chairStyle ?? projectChairStyle;
  const chairs = computeChairs(table, weldedSides);
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
  const haloPx = PODIUM_HALO * ppm;

  // Lock badge: pinned to the top-right of the (rotated) footprint, upright — same
  // spot for every shape regardless of rotation. Round/oval sit on the rim (×√½).
  const aabb = objectWallExtents({ w: table.w, h: table.h, rotation: table.rotation });
  const badgeK = table.shape === "ellipse" ? Math.SQRT1_2 : 1;
  const badgeX = aabb.right * ppm * badgeK;
  const badgeY = -aabb.top * ppm * badgeK;

  const handleSelect = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    const additive = Boolean((e.evt as MouseEvent | undefined)?.shiftKey);
    onSelect(table.id, additive);
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
      onTransformEnd={handleTransformEnd}
      onDragStart={() => {
        if (!selected) onSelect(table.id, false);
        onDragStartTable(table.id);
      }}
      onDragMove={(e) => onDragMove(table.id, e.target.x() / ppm, e.target.y() / ppm)}
      onDragEnd={(e) => onMove(table.id, e.target.x() / ppm, e.target.y() / ppm)}
      {...ctx}
    >
      {/* Chairs (drawn first, behind the table top) */}
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
          onContextMenu={(p) => onSeatContextMenu(i, p)}
          onHover={onSeatHover}
          onHoverEnd={onSeatHoverEnd}
        />
      ))}

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
          shadowForStrokeEnabled={false}
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
          shadowForStrokeEnabled={false}
        />
      )}

      {/* Label — round/oval tables read fully horizontal (screen-aligned) regardless of
          rotation, like the chair initials; rectangles follow the table but stay upright. */}
      <Text
        text={`${label}\n${table.seatCount} ${t("table.seatsShort")}`}
        width={Math.max(wpx, 60)}
        height={hpx}
        offsetX={Math.max(wpx, 60) / 2}
        offsetY={hpx / 2}
        rotation={table.shape === "ellipse" ? -table.rotation : readableAngle(table.rotation) - table.rotation}
        align="center"
        verticalAlign="middle"
        fontSize={12}
        lineHeight={1.25}
        fill={palette.labelText}
        listening={false}
      />

    </Group>
    {table.locked && (
      <Group x={table.x * ppm} y={table.y * ppm} listening={false}>
        <LockBadge x={badgeX} y={badgeY} />
      </Group>
    )}
      {editable && (
        <Transformer
          ref={trRef}
          keepRatio
          flipEnabled={false}
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          anchorStroke={palette.tableSelected}
          borderStroke={palette.tableSelected}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 12 || newBox.height < 12 ? oldBox : newBox)}
        />
      )}
    </>
  );
}
