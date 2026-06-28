import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { Stage, Layer, Rect, Line } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { setExportStage } from "../../export/registry";
import type { Side, TableModel } from "../../types";
import { useStore, undo, redo, activeSheet, useCanUndo, useCanRedo } from "../../store";
import { getPalette } from "../../theme";
import { useT, useI18n } from "../../i18n";
import {
  clampWithExtents,
  computeChairs,
  computeSnakeChairs,
  findFreeSpot,
  findWeldSnap,
  objectWallExtents,
  tableWallExtents,
  tablesOverlap,
  tooCloseTables,
  weldedSidesFor,
} from "../../geometry";
import { SEX_COLOR, NEUTRAL_SEAT, initials, objectLabelKey } from "../../constants";
import { guestBadges } from "../../iconmap";
import type { Guest } from "../../types";
import { downloadJSON, slugify } from "../../utils/file";
import { Icon } from "../Icon";
import { TabBar } from "../panels/TabBar";
import { TableNode } from "./TableNode";
import { SnakeNode } from "./SnakeNode";
import { ObjectNode } from "./ObjectNode";
import { type Occupant } from "./Chair";
import { SeatPickerModal } from "../panels/SeatPickerModal";
import { ContextMenu, type CtxMenuSpec, type CtxItem } from "../panels/ContextMenu";
import type { CtxPoint } from "../../utils/useContextTrigger";

/** Pixels per meter at zoom = 1. */
const PPM = 50;
const MIN_SCALE = 0.15;
const MAX_SCALE = 8;
const ZOOM_FACTOR = 1.08;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const NO_SIDES: Side[] = [];
const GUEST_DRAG_TYPE = "application/x-guest-id";
const SEAT_DROP_RADIUS = 0.55; // meters: how close a drop must be to a chair

function occupantOf(g: Guest): Occupant {
  return {
    initials: initials(g.name),
    bg: g.sex ? SEX_COLOR[g.sex] : NEUTRAL_SEAT,
    badges: guestBadges(g),
    name: g.name,
  };
}

const NO_OCCUPANTS: Record<number, Occupant> = {};

interface KbActions {
  copySelected: () => void;
  pasteClipboard: () => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  nudgeSelected: (dx: number, dy: number, big?: boolean) => void;
  zoomBy: (factor: number) => void;
  selectAll: () => void;
  clearSel: () => void;
  rotate: (deg: number) => void;
  toggleLock: () => void;
  fit: () => void;
  exportDoc: () => void;
  undo: () => void;
  redo: () => void;
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

export function FloorCanvas({ onHelp, onLegend }: { onHelp: () => void; onLegend: () => void }) {
  const t = useT();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [draggingStage, setDraggingStage] = useState(false);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [pickSeat, setPickSeat] = useState<{ tableId: string; index: number } | null>(null);
  const [menu, setMenu] = useState<CtxMenuSpec | null>(null);
  const [seatTip, setSeatTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const middlePan = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const didFit = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const pinchDist = useRef<number | null>(null);
  const groupDrag = useRef<{
    draggedId: string;
    starts: Record<string, { x: number; y: number }>;
    draggedStart: { x: number; y: number };
  } | null>(null);

  const [coarse] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches,
  );

  // Desktop-only chair tooltip (skip on touch). Stable callbacks so memoised nodes hold.
  const onSeatHover = useCallback(
    (text: string, x: number, y: number) => setSeatTip({ text, x, y }),
    [],
  );
  const onSeatHoverEnd = useCallback(() => setSeatTip(null), []);

  const venue = useStore((s) => activeSheet(s).venue);
  const tables = useStore((s) => activeSheet(s).tables);
  const objects = useStore((s) => activeSheet(s).objects);
  const settings = useStore((s) => s.settings);
  const selectedIds = useStore((s) => s.selectedIds);
  const select = useStore((s) => s.select);
  const updateObject = useStore((s) => s.updateObject);
  const selectMany = useStore((s) => s.selectMany);
  const clearSelection = useStore((s) => s.clearSelection);
  const updateTable = useStore((s) => s.updateTable);
  const setPositions = useStore((s) => s.setPositions);
  const weldTables = useStore((s) => s.weldTables);
  const moveSnakeNode = useStore((s) => s.moveSnakeNode);
  const commitSnakeNode = useStore((s) => s.commitSnakeNode);
  const addSnakeNode = useStore((s) => s.addSnakeNode);
  const removeSnakeNode = useStore((s) => s.removeSnakeNode);
  const guests = useStore((s) => s.guests);
  const assignGuestToSeat = useStore((s) => s.assignGuestToSeat);
  const highlightGuestId = useStore((s) => s.highlightGuestId);
  const copySelected = useStore((s) => s.copySelected);
  const pasteClipboard = useStore((s) => s.pasteClipboard);
  const duplicateSelected = useStore((s) => s.duplicateSelected);
  const deleteSelected = useStore((s) => s.deleteSelected);
  const nudgeSelected = useStore((s) => s.nudgeSelected);
  const selectAll = useStore((s) => s.selectAll);
  const rotateSelection = useStore((s) => s.rotateSelection);
  const toggleLockSelection = useStore((s) => s.toggleLockSelection);
  const getDocument = useStore((s) => s.getDocument);
  const projectName = useStore((s) => s.project.name);
  const duplicateTable = useStore((s) => s.duplicateTable);
  const removeTable = useStore((s) => s.removeTable);
  const addSnakeNodeEnd = useStore((s) => s.addSnakeNodeEnd);
  const duplicateObjects = useStore((s) => s.duplicateObjects);
  const removeObjects = useStore((s) => s.removeObjects);
  const unassignGuest = useStore((s) => s.unassignGuest);
  const removeSeatAt = useStore((s) => s.removeSeatAt);

  const theme = useI18n((s) => s.theme);
  const palette = getPalette(theme);
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
    if (e.evt.altKey) {
      rotateSelection(e.evt.deltaY > 0 ? 15 : -15);
      return;
    }
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

  // Two-finger pinch-to-zoom on touch devices.
  const handleTouchMove = (e: KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    if (touches.length !== 2) return;
    e.evt.preventDefault();
    e.target.getStage()?.stopDrag();
    const a = touches[0];
    const b = touches[1];
    const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = (a.clientX + b.clientX) / 2 - (rect?.left ?? 0);
    const cy = (a.clientY + b.clientY) / 2 - (rect?.top ?? 0);
    if (pinchDist.current && pinchDist.current > 0) {
      const oldScale = scale;
      const newScale = clamp((oldScale * dist) / pinchDist.current, MIN_SCALE, MAX_SCALE);
      const pointTo = { x: (cx - pos.x) / oldScale, y: (cy - pos.y) / oldScale };
      setScale(newScale);
      setPos({ x: cx - pointTo.x * newScale, y: cy - pointTo.y * newScale });
    }
    pinchDist.current = dist;
  };
  const handleTouchEnd = () => {
    pinchDist.current = null;
  };

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    // Middle mouse button pans the canvas (like holding Space), from anywhere.
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      middlePan.current = { sx: e.evt.clientX, sy: e.evt.clientY, px: pos.x, py: pos.y };
      setDraggingStage(true);
      return;
    }
    const stage = e.target.getStage();
    if (panMode || e.target !== stage) return; // panning or clicked a shape
    const p = stage.getPointerPosition();
    if (!p) return;
    const m = screenToMeters(p);
    setMarquee({ x0: m.x, y0: m.y, x1: m.x, y1: m.y });
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (middlePan.current) {
      const mp = middlePan.current;
      setPos({ x: mp.px + (e.evt.clientX - mp.sx), y: mp.py + (e.evt.clientY - mp.sy) });
      return;
    }
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
    if (middlePan.current) {
      middlePan.current = null;
      setDraggingStage(false);
      return;
    }
    if (!marquee) return;
    const minx = Math.min(marquee.x0, marquee.x1);
    const maxx = Math.max(marquee.x0, marquee.x1);
    const miny = Math.min(marquee.y0, marquee.y1);
    const maxy = Math.max(marquee.y0, marquee.y1);
    if ((maxx - minx) * (maxy - miny) < 0.02) {
      clearSelection(); // treated as a click on empty space
    } else {
      const inside = (el: { x: number; y: number; w: number; h: number }) =>
        el.x + el.w / 2 >= minx && el.x - el.w / 2 <= maxx && el.y + el.h / 2 >= miny && el.y - el.h / 2 <= maxy;
      const ids = [
        ...tables.filter(inside).map((t) => t.id),
        ...objects.filter(inside).map((o) => o.id),
      ];
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
    const byId = new Map(tables.map((tb) => [tb.id, tb]));
    const base = selectedIds.includes(id) ? selectedIds : [id];
    // Expand the moved set so whole weld groups travel together.
    const set = new Set<string>();
    const addGroup = (tb: TableModel) => {
      if (tb.groupId) tables.forEach((m) => m.groupId === tb.groupId && set.add(m.id));
      else set.add(tb.id);
    };
    for (const sid of base) {
      const tb = byId.get(sid);
      if (tb) addGroup(tb);
    }
    const d0 = byId.get(id);
    if (d0) addGroup(d0);
    const starts: Record<string, { x: number; y: number }> = {};
    for (const sid of set) {
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
    const e = tableWallExtents(tbl);
    return {
      x: clampWithExtents(nx, e.left, e.right, venue.width),
      y: clampWithExtents(ny, e.top, e.bottom, venue.height),
    };
  };

  const placeInside = (tbl: TableModel, nx: number, ny: number) => {
    const e = tableWallExtents(tbl);
    return {
      x: Number(clampWithExtents(snapV(nx), e.left, e.right, venue.width).toFixed(3)),
      y: Number(clampWithExtents(snapV(ny), e.top, e.bottom, venue.height).toFixed(3)),
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
      // Move the whole set by ONE shared delta (snapped via the dragged table) so welded
      // tables keep their exact relative positions instead of each snapping independently.
      const draggedTbl = byId.get(id)!;
      const snapped = placeInside(draggedTbl, x, y);
      let dx = snapped.x - gd.draggedStart.x;
      let dy = snapped.y - gd.draggedStart.y;
      // Shift the delta so the group's bounding box stays within the walls.
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const sid of movedIds) {
        const tbl = byId.get(sid)!;
        const e = tableWallExtents(tbl);
        minX = Math.min(minX, gd.starts[sid].x + dx - e.left);
        maxX = Math.max(maxX, gd.starts[sid].x + dx + e.right);
        minY = Math.min(minY, gd.starts[sid].y + dy - e.top);
        maxY = Math.max(maxY, gd.starts[sid].y + dy + e.bottom);
      }
      if (minX < 0) dx += -minX;
      else if (maxX > venue.width) dx += venue.width - maxX;
      if (minY < 0) dy += -minY;
      else if (maxY > venue.height) dy += venue.height - maxY;
      const proposed = movedIds.map((sid) => {
        const tbl = byId.get(sid)!;
        return {
          id: sid,
          w: tbl.w,
          h: tbl.h,
          x: Number((gd.starts[sid].x + dx).toFixed(3)),
          y: Number((gd.starts[sid].y + dy).toFixed(3)),
        };
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
      // Magnetic weld: snap flush to a compatible neighbour edge and join the group.
      const snap = findWeldSnap(tbl, x, y, others);
      if (snap) {
        const e = tableWallExtents(tbl);
        const sx = clampWithExtents(snap.x, e.left, e.right, venue.width);
        const sy = clampWithExtents(snap.y, e.top, e.bottom, venue.height);
        const stillFlush = Math.abs(sx - snap.x) < 1e-6 && Math.abs(sy - snap.y) < 1e-6;
        const blocked = others.some(
          (o) => o.id !== snap.neighborId && tablesOverlap({ x: sx, y: sy, w: tbl.w, h: tbl.h }, o),
        );
        if (stillFlush && !blocked) {
          weldTables(id, snap.neighborId, { x: sx, y: sy });
          return;
        }
      }
      const p = placeInside(tbl, x, y);
      const overlaps = others.some((o) => tablesOverlap({ x: p.x, y: p.y, w: tbl.w, h: tbl.h }, o));
      updateTable(id, overlaps ? findFreeSpot(others, tbl.w, tbl.h, venue, p) : p);
    }
  };

  const makeDragBound = (table: TableModel) => (absPos: { x: number; y: number }) => {
    const e = tableWallExtents(table);
    const minX = e.left;
    const maxX = Math.max(e.left, venue.width - e.right);
    const minY = e.top;
    const maxY = Math.max(e.top, venue.height - e.bottom);
    const mx = (absPos.x - pos.x) / scale / PPM;
    const my = (absPos.y - pos.y) / scale / PPM;
    const cx = Math.min(Math.max(minX, mx), maxX);
    const cy = Math.min(Math.max(minY, my), maxY);
    return { x: cx * PPM * scale + pos.x, y: cy * PPM * scale + pos.y };
  };

  const clampAxisLo = (c: number, lo: number, hi: number) =>
    Number(Math.min(Math.max(lo, c), Math.max(lo, hi)).toFixed(3));

  const handleObjectMove = (id: string, x: number, y: number) => {
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    const e = objectWallExtents(obj);
    updateObject(id, {
      x: clampAxisLo(snapV(x), e.left, venue.width - e.right),
      y: clampAxisLo(snapV(y), e.top, venue.height - e.bottom),
    });
  };

  const handleObjectTransform = (
    id: string,
    patch: { w?: number; h?: number; x?: number; y?: number; rotation?: number },
  ) => {
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    const w = patch.w ?? obj.w;
    const h = patch.h ?? obj.h;
    const rotation = Math.round(patch.rotation ?? obj.rotation);
    const e = objectWallExtents({ w, h, rotation });
    updateObject(id, {
      w: Number(w.toFixed(2)),
      h: Number(h.toFixed(2)),
      x: clampAxisLo(patch.x ?? obj.x, e.left, venue.width - e.right),
      y: clampAxisLo(patch.y ?? obj.y, e.top, venue.height - e.bottom),
      rotation,
    });
  };

  const handleTableTransform = (
    id: string,
    patch: { w?: number; h?: number; x?: number; y?: number; rotation?: number },
  ) => {
    const tbl = tables.find((t) => t.id === id);
    if (!tbl) return;
    const w = Math.max(0.3, patch.w ?? tbl.w);
    const h = Math.max(0.3, patch.h ?? tbl.h);
    const rotation = Math.round(patch.rotation ?? tbl.rotation);
    const e = tableWallExtents({ ...tbl, w, h, rotation });
    updateTable(id, {
      w: Number(w.toFixed(2)),
      h: Number(h.toFixed(2)),
      x: Number(clampWithExtents(patch.x ?? tbl.x, e.left, e.right, venue.width).toFixed(3)),
      y: Number(clampWithExtents(patch.y ?? tbl.y, e.top, e.bottom, venue.height).toFixed(3)),
      rotation,
    });
  };

  const makeObjectDragBound =
    (obj: { w: number; h: number; rotation: number }) => (absPos: { x: number; y: number }) => {
      const e = objectWallExtents(obj);
      const minX = e.left;
      const maxX = Math.max(e.left, venue.width - e.right);
      const minY = e.top;
      const maxY = Math.max(e.top, venue.height - e.bottom);
      const mx = (absPos.x - pos.x) / scale / PPM;
      const my = (absPos.y - pos.y) / scale / PPM;
      const cx = Math.min(Math.max(minX, mx), maxX);
      const cy = Math.min(Math.max(minY, my), maxY);
      return { x: cx * PPM * scale + pos.x, y: cy * PPM * scale + pos.y };
    };

  const isSole = (id: string) => selectedIds.length === 1 && selectedIds[0] === id;

  const openTableMenu = (id: string, p: CtxPoint) => {
    const tbl = tables.find((x) => x.id === id);
    if (!tbl) return;
    const items: CtxItem[] = [];
    // "Edit" just selects to reveal the side panel — drop it if it's already shown.
    if (!isSole(id)) items.push({ label: t("common.edit"), icon: "edit", onClick: () => select(id, false) });
    items.push({ label: t("common.duplicate"), icon: "duplicate", onClick: () => duplicateTable(id) });
    if (tbl.shape === "snake") {
      items.push({ label: t("ctx.addNode"), icon: "add", onClick: () => addSnakeNodeEnd(id) });
    }
    items.push(
      {
        label: tbl.locked ? t("ctx.unlock") : t("ctx.lock"),
        icon: tbl.locked ? "unlock" : "lock",
        onClick: () => updateTable(id, { locked: !tbl.locked }),
      },
      { label: t("common.delete"), icon: "delete", danger: true, onClick: () => removeTable(id) },
    );
    setMenu({ x: p.x, y: p.y, items });
  };

  const openObjectMenu = (id: string, p: CtxPoint) => {
    const o = objects.find((x) => x.id === id);
    if (!o) return;
    const items: CtxItem[] = [];
    if (!isSole(id)) items.push({ label: t("common.edit"), icon: "edit", onClick: () => select(id, false) });
    items.push(
      { label: t("common.duplicate"), icon: "duplicate", onClick: () => duplicateObjects([id]) },
      {
        label: o.locked ? t("ctx.unlock") : t("ctx.lock"),
        icon: o.locked ? "unlock" : "lock",
        onClick: () => updateObject(id, { locked: !o.locked }),
      },
      { label: t("common.delete"), icon: "delete", danger: true, onClick: () => removeObjects([id]) },
    );
    setMenu({ x: p.x, y: p.y, items });
  };

  const openSeatMenu = (tableId: string, index: number, p: CtxPoint) => {
    const tbl = tables.find((x) => x.id === tableId);
    const g = guests.find((x) => x.seat?.tableId === tableId && x.seat.index === index);
    const items: CtxItem[] = [
      { label: t("ctx.pickGuest"), icon: "guests", onClick: () => setPickSeat({ tableId, index }) },
    ];
    if (g) items.push({ label: t("seat.free"), icon: "unweld", onClick: () => unassignGuest(g.id) });
    items.push({
      label: t("ctx.seatPlus"),
      icon: "add",
      onClick: () => tbl && updateTable(tableId, { seatCount: tbl.seatCount + 1 }),
    });
    items.push({
      label: t("ctx.seatMinus"),
      icon: "delete",
      danger: true,
      onClick: () => removeSeatAt(tableId, index),
    });
    setMenu({ x: p.x, y: p.y, items });
  };

  const openSnakeNodeMenu = (tableId: string, index: number, p: CtxPoint) => {
    setMenu({
      x: p.x,
      y: p.y,
      items: [
        { label: t("ctx.addNode"), icon: "add", onClick: () => addSnakeNodeEnd(tableId) },
        { label: t("ctx.removeNode"), icon: "delete", danger: true, onClick: () => removeSnakeNode(tableId, index) },
      ],
    });
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
  const buildKb = (): KbActions => ({
    copySelected,
    pasteClipboard: () => pasteClipboard(lastPointer.current ?? undefined),
    duplicateSelected,
    deleteSelected,
    nudgeSelected,
    zoomBy,
    selectAll,
    clearSel: clearSelection,
    rotate: rotateSelection,
    toggleLock: toggleLockSelection,
    fit,
    exportDoc: () => downloadJSON(getDocument(), `${slugify(projectName)}.json`),
    undo,
    redo,
  });
  const kb = useRef<KbActions>(buildKb());
  kb.current = buildKb();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const a = kb.current;
      // Use physical key codes so shortcuts are layout-independent (RU/EN etc.) —
      // e.key returns Cyrillic letters / remapped brackets on a non-Latin layout.
      const code = e.code;
      const meta = e.metaKey || e.ctrlKey;

      if (e.key === "Escape") {
        a.clearSel();
        return;
      }
      if (meta) {
        if (code === "KeyA") {
          if (e.shiftKey) a.clearSel();
          else a.selectAll();
          e.preventDefault();
        } else if (code === "KeyS") {
          a.exportDoc();
          e.preventDefault();
        } else if (code === "KeyC") {
          a.copySelected();
          e.preventDefault();
        } else if (code === "KeyV") {
          a.pasteClipboard();
          e.preventDefault();
        } else if (code === "KeyD") {
          a.duplicateSelected();
          e.preventDefault();
        } else if (code === "KeyZ") {
          if (e.shiftKey) a.redo();
          else a.undo();
          e.preventDefault();
        } else if (code === "KeyY") {
          a.redo();
          e.preventDefault();
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        a.deleteSelected();
        e.preventDefault();
      } else if (code === "BracketLeft") {
        a.rotate(e.shiftKey ? -90 : -15);
        e.preventDefault();
      } else if (code === "BracketRight") {
        a.rotate(e.shiftKey ? 90 : 15);
        e.preventDefault();
      } else if (code === "KeyL") {
        a.toggleLock();
        e.preventDefault();
      } else if (code === "Digit0" || code === "Numpad0") {
        a.fit();
        e.preventDefault();
      } else if (code === "Equal" || code === "NumpadAdd" || e.key === "PageUp") {
        a.zoomBy(1.2);
        e.preventDefault();
      } else if (code === "Minus" || code === "NumpadSubtract" || e.key === "PageDown") {
        a.zoomBy(1 / 1.2);
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        a.nudgeSelected(0, -1, e.shiftKey);
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        a.nudgeSelected(0, 1, e.shiftKey);
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        a.nudgeSelected(-1, 0, e.shiftKey);
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        a.nudgeSelected(1, 0, e.shiftKey);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // O(n²) proximity sweep — only depends on the tables, so don't recompute on
  // zoom/pan/marquee/selection changes.
  const tooCloseSet = useMemo(() => tooCloseTables(tables), [tables]);

  // Sides of each welded table that touch a group neighbour (no chairs drawn there).
  const weldedSidesByTable = useMemo(() => {
    const groupMembers = new Map<string, TableModel[]>();
    for (const tb of tables) {
      if (!tb.groupId) continue;
      const arr = groupMembers.get(tb.groupId);
      if (arr) arr.push(tb);
      else groupMembers.set(tb.groupId, [tb]);
    }
    const byTable: Record<string, Side[]> = {};
    for (const tb of tables) {
      if (tb.groupId) byTable[tb.id] = weldedSidesFor(tb, groupMembers.get(tb.groupId)!);
    }
    return byTable;
  }, [tables]);

  // Which guest sits at each chair (by table id → seat index → occupant), for the active hall.
  const occupantsByTable = useMemo(() => {
    const map = new Map<string, Record<number, Occupant>>();
    for (const g of guests) {
      if (!g.seat) continue;
      let rec = map.get(g.seat.tableId);
      if (!rec) {
        rec = {};
        map.set(g.seat.tableId, rec);
      }
      rec[g.seat.index] = occupantOf(g);
    }
    return map;
  }, [guests]);

  const hlGuest = highlightGuestId ? guests.find((g) => g.id === highlightGuestId) : null;
  const highlightSeat = hlGuest?.seat ?? null;

  const findNearestSeat = (mx: number, my: number): { tableId: string; index: number } | null => {
    let best: { tableId: string; index: number } | null = null;
    let bestD = SEAT_DROP_RADIUS;
    for (const tbl of tables) {
      const local =
        tbl.shape === "snake" ? computeSnakeChairs(tbl) : computeChairs(tbl, weldedSidesByTable[tbl.id] ?? NO_SIDES);
      // Snake chairs are computed in local (unrotated) coords like rect/ellipse, so apply
      // the table rotation for every shape — otherwise drops onto a rotated snake miss.
      const rad = (tbl.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      for (let i = 0; i < local.length; i++) {
        const wx = tbl.x + local[i].x * cos - local[i].y * sin;
        const wy = tbl.y + local[i].x * sin + local[i].y * cos;
        const d = Math.hypot(wx - mx, wy - my);
        if (d < bestD) {
          bestD = d;
          best = { tableId: tbl.id, index: i };
        }
      }
    }
    return best;
  };

  const onCanvasDragOver = (e: ReactDragEvent) => {
    if (e.dataTransfer.types.includes(GUEST_DRAG_TYPE)) e.preventDefault();
  };
  const onCanvasDrop = (e: ReactDragEvent) => {
    const guestId = e.dataTransfer.getData(GUEST_DRAG_TYPE);
    if (!guestId) return;
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const m = screenToMeters({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    const hit = findNearestSeat(m.x, m.y);
    if (hit) assignGuestToSeat(guestId, hit.tableId, hit.index);
  };

  // Grid lines within the venue — depend only on venue size + step.
  const gridLines = useMemo(() => {
    const lines: number[][] = [];
    const step = venue.gridStep || 0.5;
    for (let gx = 0; gx <= venue.width + 1e-6; gx += step) {
      lines.push([gx * PPM, 0, gx * PPM, venue.height * PPM]);
    }
    for (let gy = 0; gy <= venue.height + 1e-6; gy += step) {
      lines.push([0, gy * PPM, venue.width * PPM, gy * PPM]);
    }
    return lines;
  }, [venue.width, venue.height, venue.gridStep]);

  const cursor = draggingStage ? "grabbing" : spaceDown ? "grab" : undefined;

  return (
    <div
      ref={containerRef}
      className="canvas-wrap"
      style={{ background: palette.bg, cursor }}
      onDragOver={onCanvasDragOver}
      onDrop={onCanvasDrop}
    >
      {size.w > 0 && size.h > 0 && (
      <Stage
        ref={(node: Konva.Stage | null) => setExportStage(node)}
        width={size.w}
        height={size.h}
        scaleX={scale}
        scaleY={scale}
        x={pos.x}
        y={pos.y}
        draggable={panMode}
        onWheel={handleWheel}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={finishMarquee}
        onMouseLeave={finishMarquee}
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
              selected={selectedIds.includes(o.id)}
              soleSelected={selectedIds.length === 1 && selectedIds[0] === o.id}
              panLocked={spaceDown}
              ppm={PPM}
              palette={palette}
              label={o.label.trim() || t(objectLabelKey(o.type))}
              onSelect={select}
              onMove={handleObjectMove}
              onTransform={handleObjectTransform}
              onContextMenu={(p) => openObjectMenu(o.id, p)}
              dragBound={makeObjectDragBound(o)}
            />
          ))}
          {tables.map((tbl) =>
            tbl.shape === "snake" ? (
              <SnakeNode
                key={tbl.id}
                table={tbl}
                selected={selectedIds.includes(tbl.id)}
                soleSelected={selectedIds.length === 1 && selectedIds[0] === tbl.id}
                tooClose={tooCloseSet.has(tbl.id)}
                panLocked={spaceDown}
                ppm={PPM}
                palette={palette}
                projectChairStyle={settings.chairStyle}
                minSpacing={settings.minSeatSpacing}
                occupants={occupantsByTable.get(tbl.id) ?? NO_OCCUPANTS}
                highlightIndex={highlightSeat && highlightSeat.tableId === tbl.id ? highlightSeat.index : null}
                onSeatClick={(tableId, index) => setPickSeat({ tableId, index })}
                onSeatContextMenu={(index, p) => openSeatMenu(tbl.id, index, p)}
                onSeatHover={coarse ? undefined : onSeatHover}
                onSeatHoverEnd={coarse ? undefined : onSeatHoverEnd}
                onSelect={select}
                onDragStartTable={handleDragStart}
                onDragMove={handleDragMove}
                onMove={handleDragEnd}
                onNodeDrag={moveSnakeNode}
                onNodeCommit={commitSnakeNode}
                onAddNode={addSnakeNode}
                onRemoveNode={removeSnakeNode}
                onContextMenu={(p) => openTableMenu(tbl.id, p)}
                onNodeContextMenu={(index, p) => openSnakeNodeMenu(tbl.id, index, p)}
                dragBound={makeDragBound(tbl)}
              />
            ) : (
              <TableNode
                key={tbl.id}
                table={tbl}
                selected={selectedIds.includes(tbl.id)}
                soleSelected={selectedIds.length === 1 && selectedIds[0] === tbl.id}
                tooClose={tooCloseSet.has(tbl.id)}
                panLocked={spaceDown}
                ppm={PPM}
                palette={palette}
                projectChairStyle={settings.chairStyle}
                minSpacing={settings.minSeatSpacing}
                weldedSides={weldedSidesByTable[tbl.id] ?? NO_SIDES}
                occupants={occupantsByTable.get(tbl.id) ?? NO_OCCUPANTS}
                highlightIndex={highlightSeat && highlightSeat.tableId === tbl.id ? highlightSeat.index : null}
                onSeatClick={(tableId, index) => setPickSeat({ tableId, index })}
                onSeatContextMenu={(index, p) => openSeatMenu(tbl.id, index, p)}
                onSeatHover={coarse ? undefined : onSeatHover}
                onSeatHoverEnd={coarse ? undefined : onSeatHoverEnd}
                onSelect={select}
                onDragStartTable={handleDragStart}
                onDragMove={handleDragMove}
                onMove={handleDragEnd}
                onTransform={handleTableTransform}
                onContextMenu={(p) => openTableMenu(tbl.id, p)}
                dragBound={makeDragBound(tbl)}
              />
            ),
          )}
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

      <TabBar />

      <div className="editor-corner editor-help">
        <button onClick={onHelp} title={t("help.title")} aria-label={t("help.title")}>
          <Icon name="keyboard" />
        </button>
        <button onClick={onLegend} title={t("legend.title")} aria-label={t("legend.title")}>
          <Icon name="help" />
        </button>
      </div>

      <div className="editor-corner editor-undo">
        <button onClick={undo} disabled={!canUndo} title={t("common.undo")} aria-label={t("common.undo")}>
          <Icon name="undo" />
        </button>
        <button onClick={redo} disabled={!canRedo} title={t("common.redo")} aria-label={t("common.redo")}>
          <Icon name="redo" />
        </button>
      </div>

      <div className="zoom-controls">
        <span className="zoom-readout">{Math.round(scale * 100)}%</span>
        <button onClick={() => zoomBy(1.2)} title={t("zoom.in")} aria-label={t("zoom.in")}>
          <Icon name="zoomIn" />
        </button>
        <button onClick={() => zoomBy(1 / 1.2)} title={t("zoom.out")} aria-label={t("zoom.out")}>
          <Icon name="zoomOut" />
        </button>
        <button onClick={fit} title={t("zoom.fit")} aria-label={t("zoom.fit")}>
          <Icon name="fit" />
        </button>
      </div>

      {pickSeat && (
        <SeatPickerModal tableId={pickSeat.tableId} index={pickSeat.index} onClose={() => setPickSeat(null)} />
      )}
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
      {seatTip && (
        <div className="chair-tip" style={{ left: seatTip.x, top: seatTip.y }}>
          {seatTip.text}
        </div>
      )}
    </div>
  );
}
