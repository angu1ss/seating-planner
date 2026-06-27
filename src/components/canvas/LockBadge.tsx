import { Group, Circle, Path } from "react-konva";
import { LOCK_BODY, LOCK_SHACKLE_CLOSED } from "../icons";

/** A small "locked" badge (white disc + lock) pinned to a shape's top-right corner. */
export function LockBadge({ x, y }: { x: number; y: number }) {
  return (
    <Group x={x} y={y} listening={false}>
      <Circle radius={8.5} fill="#fff" stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
      <Group x={-5.5} y={-5.5} scaleX={11 / 16} scaleY={11 / 16}>
        <Path data={LOCK_BODY} stroke="#1b2638" strokeWidth={1.8} lineCap="round" lineJoin="round" />
        <Path data={LOCK_SHACKLE_CLOSED} stroke="#1b2638" strokeWidth={1.8} lineCap="round" lineJoin="round" />
      </Group>
    </Group>
  );
}
