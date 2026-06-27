import { useRef } from "react";
import type { KonvaEventObject } from "konva/lib/Node";

export interface CtxPoint {
  x: number;
  y: number;
}

/**
 * Konva handlers that open a context menu on right-click (desktop) or long-press
 * (touch). `stopTouchBubble` keeps a child (e.g. a chair) from also arming its
 * parent group's long-press.
 */
export function useContextTrigger(onMenu: (p: CtxPoint) => void, stopTouchBubble = false, ms = 500) {
  const timer = useRef<number | null>(null);
  // True right after the menu opened, so the consumer can swallow the click/tap that
  // would otherwise also fire (e.g. a long-press on a seat shouldn't open the picker).
  const fired = useRef(false);
  const cancel = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const handlers = {
    onContextMenu: (e: KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      e.cancelBubble = true;
      fired.current = true;
      onMenu({ x: e.evt.clientX, y: e.evt.clientY });
    },
    onTouchStart: (e: KonvaEventObject<TouchEvent>) => {
      const t = e.evt.touches[0];
      if (!t) return;
      if (stopTouchBubble) e.cancelBubble = true;
      fired.current = false;
      const p = { x: t.clientX, y: t.clientY };
      cancel();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onMenu(p);
      }, ms);
    },
    onTouchMove: cancel,
    onTouchEnd: cancel,
  };
  return { handlers, fired };
}
