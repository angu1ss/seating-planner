import { memo, useEffect, useMemo, useRef } from "react";
import { Group, Rect, Ellipse, Text, Shape, Transformer } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { SceneObject } from "../../types";
import type { Palette } from "../../theme";
import { ROUND_OBJECT_TYPES } from "../../constants";
import { objectWallExtents, readableAngle } from "../../geometry";
import { LockBadge } from "./LockBadge";
import { makeDragBound } from "./dragBound";
import { useContextTrigger, type CtxPoint } from "../../utils/useContextTrigger";

interface TransformPatch {
  w?: number;
  h?: number;
  x?: number;
  y?: number;
  rotation?: number;
}

interface Props {
  obj: SceneObject;
  selected: boolean;
  soleSelected: boolean;
  panLocked: boolean;
  ppm: number;
  palette: Palette;
  label: string;
  onSelect: (id: string, additive: boolean) => void;
  onMove: (id: string, x: number, y: number) => void;
  onTransform: (id: string, patch: TransformPatch) => void;
  onContextMenu: (id: string, p: CtxPoint) => void;
  venueWidth: number;
  venueHeight: number;
}

export const ObjectNode = memo(function ObjectNode({
  obj,
  selected,
  soleSelected,
  panLocked,
  ppm,
  palette,
  label,
  onSelect,
  onMove,
  onTransform,
  onContextMenu,
  venueWidth,
  venueHeight,
}: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const { handlers: ctx } = useContextTrigger((p) => onContextMenu(obj.id, p));
  const dragBound = useMemo(
    () => makeDragBound(() => groupRef.current?.getStage() ?? null, objectWallExtents(obj), venueWidth, venueHeight, ppm),
    [obj, venueWidth, venueHeight, ppm],
  );
  const trRef = useRef<Konva.Transformer>(null);
  const editable = soleSelected && !obj.locked;

  useEffect(() => {
    if (editable && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [editable, obj.w, obj.h, obj.type]);

  const wpx = obj.w * ppm;
  const hpx = obj.h * ppm;
  const isRound = ROUND_OBJECT_TYPES.includes(obj.type);
  // Lock badge pinned to the top-right of the rotated footprint, upright.
  const aabb = objectWallExtents(obj);
  const badgeK = isRound ? Math.SQRT1_2 : 1;
  const badgeX = aabb.right * ppm * badgeK;
  const badgeY = -aabb.top * ppm * badgeK;
  const isDoor = obj.type === "entrance";
  const isColumn = obj.type === "columnRound" || obj.type === "columnSquare";
  const dashed = obj.type === "dancefloor";
  const stroke = selected ? palette.tableSelected : palette.objectStroke;
  const strokeWidth = selected ? 3 : 1.5;

  const handleSelect = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    onSelect(obj.id, Boolean((e.evt as MouseEvent | undefined)?.shiftKey));
  };

  const handleTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onTransform(obj.id, {
      w: Math.max(0.2, obj.w * sx),
      h: Math.max(0.2, obj.h * sy),
      x: node.x() / ppm,
      y: node.y() / ppm,
      rotation: node.rotation(),
    });
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={obj.x * ppm}
        y={obj.y * ppm}
        rotation={obj.rotation}
        draggable={!panLocked && !obj.locked}
        dragBoundFunc={dragBound}
        opacity={obj.locked ? 0.85 : 1}
        onClick={handleSelect}
        onTap={handleSelect}
        onDragEnd={(e) => onMove(obj.id, e.target.x() / ppm, e.target.y() / ppm)}
        onTransformEnd={handleTransformEnd}
        {...ctx}
      >
        {isRound ? (
          <Ellipse
            radiusX={wpx / 2}
            radiusY={hpx / 2}
            fill={palette.objectFill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        ) : isDoor ? (
          <>
            <Rect
              x={-wpx / 2}
              y={-hpx / 2}
              width={wpx}
              height={hpx}
              cornerRadius={3}
              fill={palette.objectFill}
              opacity={0.25}
              stroke={selected ? palette.tableSelected : "transparent"}
              strokeWidth={selected ? 3 : 0}
              perfectDrawEnabled={false}
            />
            <Shape
              stroke={selected ? palette.tableSelected : palette.objectText}
              strokeWidth={2}
              listening={false}
              sceneFunc={(ctx, shape) => {
                const s = Math.min(wpx, hpx) * 0.92;
                const hx = -s / 2;
                const hy = s / 2;
                ctx.beginPath();
                ctx.moveTo(hx, hy);
                ctx.lineTo(hx, hy - s);
                ctx.moveTo(hx, hy - s);
                ctx.arc(hx, hy, s, -Math.PI / 2, 0, false);
                ctx.strokeShape(shape);
              }}
            />
          </>
        ) : (
          <Rect
            x={-wpx / 2}
            y={-hpx / 2}
            width={wpx}
            height={hpx}
            cornerRadius={4}
            fill={palette.objectFill}
            opacity={obj.type === "dancefloor" ? 0.6 : 1}
            stroke={stroke}
            strokeWidth={strokeWidth}
            dash={dashed && !selected ? [8, 5] : undefined}
            perfectDrawEnabled={false}
          />
        )}

        {!isColumn && (
          <Text
            text={label}
            width={Math.max(wpx, 60)}
            height={hpx}
            offsetX={Math.max(wpx, 60) / 2}
            offsetY={hpx / 2}
            rotation={readableAngle(obj.rotation) - obj.rotation}
            align="center"
            verticalAlign="middle"
            fontSize={12}
            fill={palette.objectText}
            listening={false}
          />
        )}

      </Group>
      {obj.locked && (
        <Group x={obj.x * ppm} y={obj.y * ppm} listening={false}>
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
});
