import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Line } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useStore } from "../../store";
import { getPalette } from "../../theme";
import { TableNode } from "./TableNode";

/** Pixels per meter at zoom = 1. */
const PPM = 50;
const MIN_SCALE = 0.15;
const MAX_SCALE = 8;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function FloorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const didFit = useRef(false);

  const venue = useStore((s) => s.venue);
  const tables = useStore((s) => s.tables);
  const settings = useStore((s) => s.settings);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const updateTable = useStore((s) => s.updateTable);

  const palette = getPalette(settings.theme);

  // Track container size.
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

  // Fit once when we first know the size.
  useEffect(() => {
    if (!didFit.current && size.w && size.h) {
      didFit.current = true;
      fit();
    }
  }, [size, fit]);

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = scale;
    const mousePointTo = {
      x: (pointer.x - pos.x) / oldScale,
      y: (pointer.y - pos.y) / oldScale,
    };
    const factor = 1.08;
    const newScale = clamp(e.evt.deltaY > 0 ? oldScale / factor : oldScale * factor, MIN_SCALE, MAX_SCALE);
    setScale(newScale);
    setPos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const zoomBy = (factor: number) => {
    const c = { x: size.w / 2, y: size.h / 2 };
    const oldScale = scale;
    const newScale = clamp(oldScale * factor, MIN_SCALE, MAX_SCALE);
    const mousePointTo = { x: (c.x - pos.x) / oldScale, y: (c.y - pos.y) / oldScale };
    setScale(newScale);
    setPos({ x: c.x - mousePointTo.x * newScale, y: c.y - mousePointTo.y * newScale });
  };

  const handleStageClick = (e: KonvaEventObject<Event>) => {
    if (e.target === e.target.getStage()) select(null);
  };

  const handleMove = (id: string, xm: number, ym: number) => {
    let x = xm;
    let y = ym;
    if (venue.snapToGrid) {
      const g = venue.gridStep || 0.5;
      x = Math.round(x / g) * g;
      y = Math.round(y / g) * g;
    } else {
      const s = venue.snapStep || 0.1;
      x = Math.round(x / s) * s;
      y = Math.round(y / s) * s;
    }
    updateTable(id, { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) });
  };

  // Grid lines within the venue.
  const gridLines: number[][] = [];
  const step = venue.gridStep || 0.5;
  for (let gx = 0; gx <= venue.width + 1e-6; gx += step) {
    gridLines.push([gx * PPM, 0, gx * PPM, venue.height * PPM]);
  }
  for (let gy = 0; gy <= venue.height + 1e-6; gy += step) {
    gridLines.push([0, gy * PPM, venue.width * PPM, gy * PPM]);
  }

  return (
    <div ref={containerRef} className="canvas-wrap" style={{ background: palette.bg }}>
      <Stage
        width={size.w}
        height={size.h}
        scaleX={scale}
        scaleY={scale}
        x={pos.x}
        y={pos.y}
        draggable
        onWheel={handleWheel}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) setPos({ x: e.target.x(), y: e.target.y() });
        }}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer>
          {/* Venue */}
          <Rect
            x={0}
            y={0}
            width={venue.width * PPM}
            height={venue.height * PPM}
            fill={palette.venueFill}
            stroke={palette.venueStroke}
            strokeWidth={2}
          />
          {/* Grid */}
          {gridLines.map((pts, i) => (
            <Line key={i} points={pts} stroke={palette.grid} strokeWidth={1} listening={false} />
          ))}

          {/* Tables */}
          {tables.map((t) => (
            <TableNode
              key={t.id}
              table={t}
              selected={t.id === selectedId}
              ppm={PPM}
              palette={palette}
              projectChairStyle={settings.chairStyle}
              minSpacing={settings.minSeatSpacing}
              onSelect={select}
              onMove={handleMove}
            />
          ))}
        </Layer>
      </Stage>

      <div className="zoom-controls">
        <button onClick={() => zoomBy(1.2)} title="Приблизить" aria-label="Приблизить">+</button>
        <button onClick={() => zoomBy(1 / 1.2)} title="Отдалить" aria-label="Отдалить">−</button>
        <button onClick={fit} title="Вписать" aria-label="Вписать">⤢</button>
      </div>
      <div className="zoom-readout">{Math.round(scale * 100)}%</div>
    </div>
  );
}
