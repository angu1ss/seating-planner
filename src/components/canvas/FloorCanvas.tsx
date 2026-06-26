import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Line } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { TableModel } from "../../types";
import { useStore } from "../../store";
import { getPalette } from "../../theme";
import { useT } from "../../i18n";
import { clampTableCenter, findFreeSpot, tableOuterExtent, tablesOverlap, tooCloseTables } from "../../geometry";
import { objectLabelKey } from "../../constants";
import { TableNode } from "./TableNode";
import { ObjectNode } from "./ObjectNode";

/** Pixels per meter at zoom = 1. */
const PPM = 50;
const MIN_SCALE = 0.15;
const MAX_SCALE = 8;
const ZOOM_FACTOR = 1.08;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface KbActions {
  copySelected: () => void;
  pasteClipboard: () => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
  zoomBy: (factor: number) => void;
}

interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  return (
    node.tagName === "INPUT" ||
    node.tagName === "SELECT" ||
    node.tagName === "TEXTAREA" ||
    node.isContentEditable
  );
}

export function FloorCanvas() {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [draggingStage, setDraggingStage] = useState(false);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const didFit = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const groupDrag = useRef<{
    draggedId: string;
    starts: Record<string, { x: number; y: number }>;
    draggedStart: { x: number; y: number };
  } | null>(null);

  const [coarse] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches,
  );

  const venue = useStore((s) => s.venue);
  const tables = useStore((s) => s.tables);
  const objects = useStore((s) => s.objects);
  const settings = useStore((s) => s.settings);
  const selectedIds = useStore((s) => s.selectedIds);
  const selectedObjectId = useStore((s) => s.selectedObjectId);
  const select = useStore((s) => s.select);
  const selectObject = useStore((s) => s.selectObject);
  const updateObject = useStore((s) => s.updateObject);
  const selectMany = useStore((s) => s.selectMany);
  const clearSelection = useStore((s) => s.clearSelection);
  const updateTable = useStore((s) => s.updateTable);
  const setPositions = useStore((s) => s.setPositions);
  const copySelected = useStore((s) => s.copySelected);
  const pasteClipboard = useStore((s) => s.pasteClipboard);
  const duplicateSelected = useStore((s) => s.duplicateSelected);
  const deleteSelected = useStore((s) => s.deleteSelected);
  const nudgeSelected = useStore((s) => s.nudgeSelected);

  const palette = getPalette(settings.theme);
  const panMode = spaceDown || coarse;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    if (!size.w || !size.h) return;
    const pad = 48;
    const vw = venue.width * PPM;
    const vh = venue.height * PPM;
    const s = clamp(Math.min((size.w - pad * 2) / vw, (size.h - pad * 2) / vh), MIN_SCALE, MAX_SCALE);
    setScale(s);
    setPos({ x: (size.w - vw * s) / 2, y: (size.h - vh * s) / 2 });
  }, [size, venue.width, venue.height]);

  useEffect(() => {
    if (!didFit.current && size.w && size.h) {
      didFit.current = true;
      fit();
    }
  }, [size, fit]);

  const screenToMeters = (p: { x: number; y: number }) => ({
    x: (p.x - pos.x) / scale / PPM,
    y: (p.y - pos.y) / scale / PPM,
  });

  const zoomAtPointer = (delta: number, pointer: { x: number; y: number }) => {
    const oldScale = scale;
    const newScale = clamp(delta > 0 ? oldScale / ZOOM_FACTOR : oldScale * ZOOM_FACTOR, MIN_SCALE, MAX_SCALE);
    const pointTo = { x: (pointer.x - pos.x) / oldScale, y: (pointer.y - pos.y) / oldScale };
    setScale(newScale);
    setPos({ x: pointer.x - pointTo.x * newScale, y: pointer.y - pointTo.y * newScale });
  };

  const zoomBy = (factor: number) => {
    const c = { x: size.w / 2, y: size.h / 2 };
    const oldScale = scale;
    const newScale = clamp(oldScale * factor, MIN_SCALE, MAX_SCALE);
    const pointTo = { x: (c.x - pos.x) / oldScale, y: (c.y - pos.y) / oldScale };
    setScale(newScale);
    setPos({ x: c.x - pointTo.x * newScale, y: c.y - pointTo.y * newScale });
  };

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const dx = e.evt.deltaX;
    const dy = e.evt.deltaY;
    if (e.evt.ctrlKey) {
      zoomAtPointer(dy, pointer);
    } else if (Math.abs(dx) > Math.abs(dy)) {
      setPos((p) => ({ x: p.x - dx, y: p.y - dy }));
    } else {
      zoomAtPointer(dy, pointer);
    }
  };

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (panMode || e.target !== stage) return; // panning or clicked a shape
    const p = stage.getPointerPosition();
    if (!p) return;
    const m = screenToMeters(p);
    setMarquee({ x0: m.x, y0: m.y, x1: m.x, y1: m.y });
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    const p = stage?.getPointerPosition();
    if (!p) return;
    lastPointer.current = screenToMeters(p);
    if (marquee) {
      const m = screenToMeters(p);
      setMarquee((prev) => (prev ? { ...prev, x1: m.x, y1: m.y } : prev));
    }
  };

  const finishMarquee = () => {
    if (!marquee) return;
    const minx = Math.min(marquee.x0, marquee.x1);
    const maxx = Math.max(marquee.x0, marquee.x1);
    const miny = Math.min(marquee.y0, marquee.y1);
    const maxy = Math.max(marquee.y0, marquee.y1);
    if ((maxx - minx) * (maxy - miny) < 0.02) {
      clearSelection(); // treated as a click on empty space
    } else {
      const ids = tables
        .filter(
          (tb) =>
            tb.x + tb.w / 2 >= minx &&
            tb.x - tb.w / 2 <= maxx &&
            tb.y + tb.h / 2 >= miny &&
            tb.y - tb.h / 2 <= maxy,
        )
        .map((tb) => tb.id);
      selectMany(ids);
    }
    setMarquee(null);
  };

  const handleTap = (e: KonvaEventObject<Event>) => {
    if (e.target === e.target.getStage()) clearSelection();
  };

  const snapV = (v: number) => {
    const st = venue.snapToGrid ? venue.gridStep || 0.5 : venue.snapStep || 0.1;
    return Number((Math.round(v / st) * st).toFixed(3));
  };

  const handleDragStart = (id: string) => {
    const sel = selectedIds.includes(id) ? selectedIds : [id];
    const byId = new Map(tables.map((tb) => [tb.id, tb]));
    const starts: Record<string, { x: number; y: number }> = {};
    for (const sid of sel) {
      const tt = byId.get(sid);
      if (tt && !tt.locked) starts[sid] = { x: tt.x, y: tt.y };
    }
    const dragged = byId.get(id);
    groupDrag.current = {
      draggedId: id,
      starts,
      draggedStart: dragged ? { x: dragged.x, y: dragged.y } : { x: 0, y: 0 },
    };
  };

  const clampOnly = (tbl: TableModel, nx: number, ny: number) => {
    const e = tableOuterExtent(tbl);
    return { x: clampTableCenter(nx, e.rx, venue.width), y: clampTableCenter(ny, e.ry, venue.height) };
  };

  const placeInside = (tbl: TableModel, nx: number, ny: number) => {
    const e = tableOuterExtent(tbl);
    return {
      x: Number(clampTableCenter(snapV(nx), e.rx, venue.width).toFixed(3)),
      y: Number(clampTableCenter(snapV(ny), e.ry, venue.height).toFixed(3)),
    };
  };

  const handleDragMove = (id: string, x: number, y: number) => {
    const gd = groupDrag.current;
    if (!gd || gd.draggedId !== id) return;
    const ids = Object.keys(gd.starts);
    if (ids.length < 2) return; // single table is bounded live by dragBoundFunc
    const byId = new Map(tables.map((tb) => [tb.id, tb]));
    const dx = x - gd.draggedStart.x;
    const dy = y - gd.draggedStart.y;
    setPositions(
      ids.map((sid) => {
        const tbl = byId.get(sid)!;
        const nx = sid === id ? x : gd.starts[sid].x + dx;
        const ny = sid === id ? y : gd.starts[sid].y + dy;
        return { id: sid, ...clampOnly(tbl, nx, ny) };
      }),
    );
  };

  const handleDragEnd = (id: string, x: number, y: number) => {
    const gd = groupDrag.current;
    groupDrag.current = null;
    const byId = new Map(tables.map((tb) => [tb.id, tb]));
    const movedIds = gd ? Object.keys(gd.starts) : [id];
    const movedSet = new Set(movedIds);
    const others = tables.filter((tb) => !movedSet.has(tb.id));

    if (gd && movedIds.length > 1) {
      const dx = x - gd.draggedStart.x;
      const dy = y - gd.draggedStart.y;
      const proposed = movedIds.map((sid) => {
        const tbl = byId.get(sid)!;
        const nx = sid === id ? x : gd.starts[sid].x + dx;
        const ny = sid === id ? y : gd.starts[sid].y + dy;
        const p = placeInside(tbl, nx, ny);
        return { id: sid, w: tbl.w, h: tbl.h, x: p.x, y: p.y };
      });
      const collision = proposed.some((p) =>
        others.some((o) => tablesOverlap({ x: p.x, y: p.y, w: p.w, h: p.h }, o)),
      );
      if (collision) {
        setPositions(movedIds.map((sid) => ({ id: sid, x: gd.starts[sid].x, y: gd.starts[sid].y })));
      } else {
        setPositions(proposed.map((p) => ({ id: p.id, x: p.x, y: p.y })));
      }
    } else {
      const tbl = byId.get(id);
      if (!tbl) return;
      const p = placeInside(tbl, x, y);
      const overlaps = others.some((o) => tablesOverlap({ x: p.x, y: p.y, w: tbl.w, h: tbl.h }, o));
      updateTable(id, overlaps ? findFreeSpot(others, tbl.w, tbl.h, venue, p) : p);
    }
  };

  const makeDragBound = (table: TableModel) => (absPos: { x: number; y: number }) => {
    const e = tableOuterExtent(table);
    const minX = e.rx;
    const maxX = Math.max(e.rx, venue.width - e.rx);
    const minY = e.ry;
    const maxY = Math.max(e.ry, venue.height - e.ry);
    const mx = (absPos.x - pos.x) / scale / PPM;
    const my = (absPos.y - pos.y) / scale / PPM;
    const cx = Math.min(Math.max(minX, mx), maxX);
    const cy = Math.min(Math.max(minY, my), maxY);
    return { x: cx * PPM * scale + pos.x, y: cy * PPM * scale + pos.y };
  };

  const clampAxis = (c: number, size: number, max: number) => {
    const lo = size / 2;
    const hi = Math.max(lo, max - size / 2);
    return Number(Math.min(Math.max(lo, c), hi).toFixed(3));
  };

  const handleObjectMove = (id: string, x: number, y: number) => {
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    updateObject(id, { x: clampAxis(snapV(x), obj.w, venue.width), y: clampAxis(snapV(y), obj.h, venue.height) });
  };

  const makeObjectDragBound =
    (obj: { w: number; h: number }) => (absPos: { x: number; y: number }) => {
      const minX = obj.w / 2;
      const maxX = Math.max(obj.w / 2, venue.width - obj.w / 2);
      const minY = obj.h / 2;
      const maxY = Math.max(obj.h / 2, venue.height - obj.h / 2);
      const mx = (absPos.x - pos.x) / scale / PPM;
      const my = (absPos.y - pos.y) / scale / PPM;
      const cx = Math.min(Math.max(minX, mx), maxX);
      const cy = Math.min(Math.max(minY, my), maxY);
      return { x: cx * PPM * scale + pos.x, y: cy * PPM * scale + pos.y };
    };

  // Space-to-pan toggle.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTypingTarget(e.target)) {
        setSpaceDown(true);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Other shortcuts (bound once, kept fresh via ref).
  const kb = useRef<KbActions>({
    copySelected,
    pasteClipboard: () => pasteClipboard(lastPointer.current ?? undefined),
    duplicateSelected,
    deleteSelected,
    nudgeSelected,
    zoomBy,
  });
  kb.current = {
    copySelected,
    pasteClipboard: () => pasteClipboard(lastPointer.current ?? undefined),
    duplicateSelected,
    deleteSelected,
    nudgeSelected,
    zoomBy,
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      const a = kb.current;
      const k = e.key.toLowerCase();
      if (meta && k === "c") {
        a.copySelected();
        e.preventDefault();
      } else if (meta && k === "v") {
        a.pasteClipboard();
        e.preventDefault();
      } else if (meta && k === "d") {
        a.duplicateSelected();
        e.preventDefault();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        a.deleteSelected();
        e.preventDefault();
      } else if (e.key === "PageUp") {
        a.zoomBy(1.2);
        e.preventDefault();
      } else if (e.key === "PageDown") {
        a.zoomBy(1 / 1.2);
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        a.nudgeSelected(0, -1);
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        a.nudgeSelected(0, 1);
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        a.nudgeSelected(-1, 0);
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        a.nudgeSelected(1, 0);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tooCloseSet = tooCloseTables(tables);

  // Grid lines within the venue.
  const gridLines: number[][] = [];
  const step = venue.gridStep || 0.5;
  for (let gx = 0; gx <= venue.width + 1e-6; gx += step) {
    gridLines.push([gx * PPM, 0, gx * PPM, venue.height * PPM]);
  }
  for (let gy = 0; gy <= venue.height + 1e-6; gy += step) {
    gridLines.push([0, gy * PPM, venue.width * PPM, gy * PPM]);
  }

  const cursor = spaceDown ? (draggingStage ? "grabbing" : "grab") : undefined;

  return (
    <div ref={containerRef} className="canvas-wrap" style={{ background: palette.bg, cursor }}>
      {size.w > 0 && size.h > 0 && (
      <Stage
        width={size.w}
        height={size.h}
        scaleX={scale}
        scaleY={scale}
        x={pos.x}
        y={pos.y}
        draggable={panMode}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={finishMarquee}
        onDragStart={(e) => {
          if (e.target === e.target.getStage()) setDraggingStage(true);
        }}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setDraggingStage(false);
            setPos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onTap={handleTap}
      >
        <Layer>
          <Rect
            x={0}
            y={0}
            width={venue.width * PPM}
            height={venue.height * PPM}
            fill={palette.venueFill}
            stroke={palette.venueStroke}
            strokeWidth={2}
            listening={false}
          />
          {gridLines.map((pts, i) => (
            <Line key={i} points={pts} stroke={palette.grid} strokeWidth={1} listening={false} />
          ))}
          {objects.map((o) => (
            <ObjectNode
              key={o.id}
              obj={o}
              selected={o.id === selectedObjectId}
              panLocked={spaceDown}
              ppm={PPM}
              palette={palette}
              label={o.label.trim() || t(objectLabelKey(o.type))}
              onSelect={selectObject}
              onMove={handleObjectMove}
              dragBound={makeObjectDragBound(o)}
            />
          ))}
          {tables.map((tbl) => (
            <TableNode
              key={tbl.id}
              table={tbl}
              selected={selectedIds.includes(tbl.id)}
              tooClose={tooCloseSet.has(tbl.id)}
              panLocked={spaceDown}
              ppm={PPM}
              palette={palette}
              projectChairStyle={settings.chairStyle}
              minSpacing={settings.minSeatSpacing}
              onSelect={select}
              onDragStartTable={handleDragStart}
              onDragMove={handleDragMove}
              onMove={handleDragEnd}
              dragBound={makeDragBound(tbl)}
            />
          ))}
          {marquee && (
            <Rect
              x={Math.min(marquee.x0, marquee.x1) * PPM}
              y={Math.min(marquee.y0, marquee.y1) * PPM}
              width={Math.abs(marquee.x1 - marquee.x0) * PPM}
              height={Math.abs(marquee.y1 - marquee.y0) * PPM}
              fill={palette.tableSelected}
              opacity={0.15}
              stroke={palette.tableSelected}
              strokeWidth={1}
              listening={false}
              perfectDrawEnabled={false}
            />
          )}
        </Layer>
      </Stage>
      )}

      <div className="zoom-controls">
        <button onClick={() => zoomBy(1.2)} title={t("zoom.in")} aria-label={t("zoom.in")}>+</button>
        <button onClick={() => zoomBy(1 / 1.2)} title={t("zoom.out")} aria-label={t("zoom.out")}>−</button>
        <button onClick={fit} title={t("zoom.fit")} aria-label={t("zoom.fit")}>⤢</button>
      </div>
      <div className="zoom-readout">{Math.round(scale * 100)}%</div>
    </div>
  );
}
