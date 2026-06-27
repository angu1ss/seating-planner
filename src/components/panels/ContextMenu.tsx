import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import type { UiIconName } from "../../iconmap";

export interface CtxItem {
  label: string;
  icon?: UiIconName;
  onClick: () => void;
  danger?: boolean;
}

export interface CtxMenuSpec {
  x: number;
  y: number;
  items: CtxItem[];
}

export function ContextMenu({ menu, onClose }: { menu: CtxMenuSpec; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });

  // Keep the menu inside the viewport.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    let x = menu.x;
    let y = menu.y;
    if (x + r.width > window.innerWidth - pad) x = Math.max(pad, window.innerWidth - r.width - pad);
    if (y + r.height > window.innerHeight - pad) y = Math.max(pad, window.innerHeight - r.height - pad);
    setPos({ x, y });
  }, [menu]);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Defer so the opening gesture itself doesn't immediately close it.
    const id = window.setTimeout(() => {
      window.addEventListener("pointerdown", close);
      window.addEventListener("wheel", close, { passive: true });
      window.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("wheel", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: pos.x, top: pos.y }}
      role="menu"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {menu.items.map((it, i) => (
        <button
          key={i}
          className={`ctx-item ${it.danger ? "danger" : ""}`}
          role="menuitem"
          onClick={() => {
            it.onClick();
            onClose();
          }}
        >
          {it.icon && <Icon name={it.icon} />}
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}
