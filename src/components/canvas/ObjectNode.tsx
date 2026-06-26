import { Group, Rect, Ellipse, Text, Shape, Path } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { SceneObject } from "../../types";
import type { Palette } from "../../theme";
import { ROUND_OBJECT_TYPES } from "../../constants";
import { LOCK_BODY, LOCK_SHACKLE_CLOSED } from "../icons";

const LOCK_ICON = 14;

interface Props {
  obj: SceneObject;
  selected: boolean;
  panLocked: boolean;
  ppm: number;
  palette: Palette;
  label: string;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  dragBound: (pos: { x: number; y: number }) => { x: number; y: number };
}

export function ObjectNode({ obj, selected, panLocked, ppm, palette, label, onSelect, onMove, dragBound }: Props) {
  const wpx = obj.w * ppm;
  const hpx = obj.h * ppm;
  const isRound = ROUND_OBJECT_TYPES.includes(obj.type);
  const isDoor = obj.type === "entrance";
  const isColumn = obj.type === "columnRound" || obj.type === "columnSquare";
  const dashed = obj.type === "dancefloor";
  const stroke = selected ? palette.tableSelected : palette.objectStroke;
  const strokeWidth = selected ? 3 : 1.5;

  const handleSelect = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    onSelect(obj.id);
  };

  return (
    <Group
      x={obj.x * ppm}
      y={obj.y * ppm}
      rotation={obj.rotation}
      draggable={!panLocked && !obj.locked}
      dragBoundFunc={dragBound}
      opacity={obj.locked ? 0.85 : 1}
      onClick={handleSelect}
      onTap={handleSelect}
      onDragEnd={(e) => onMove(obj.id, e.target.x() / ppm, e.target.y() / ppm)}
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
              ctx.lineTo(hx, hy - s); // door leaf
              ctx.moveTo(hx, hy - s);
              ctx.arc(hx, hy, s, -Math.PI / 2, 0, false); // swing arc
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
          align="center"
          verticalAlign="middle"
          fontSize={12}
          fill={palette.objectText}
          listening={false}
        />
      )}

      {obj.locked && (
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
