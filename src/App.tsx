import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useStore, activeSheet } from "./store";
import { useT, useI18n } from "./i18n";
import { useMediaQuery } from "./utils/useMediaQuery";
import { Toolbar } from "./components/panels/Toolbar";
import { LeftPanel } from "./components/panels/LeftPanel";
import { TablePanel } from "./components/panels/TablePanel";
import { ObjectPanel } from "./components/panels/ObjectPanel";
import { BulkPanel } from "./components/panels/BulkPanel";
import { EmptyPanel } from "./components/panels/EmptyPanel";
import { AddTableModal } from "./components/panels/AddTableModal";
import { AddObjectModal } from "./components/panels/AddObjectModal";
import { ShortcutsModal } from "./components/panels/ShortcutsModal";
import { ProjectSettingsModal } from "./components/panels/ProjectSettingsModal";
import { GuestsPanel } from "./components/panels/GuestsPanel";
import { LegendModal } from "./components/panels/LegendModal";
import { FloorCanvas } from "./components/canvas/FloorCanvas";

export default function App() {
  const t = useT();
  const theme = useI18n((s) => s.theme);
  const projectName = useStore((s) => s.project.name);
  const selectedIds = useStore((s) => s.selectedIds);
  const tables = useStore((s) => activeSheet(s).tables);
  const [leftOpen, setLeftOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addObjOpen, setAddObjOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);

  const isDesktop = useMediaQuery("(min-width: 721px)");
  const [guestsWidth, setGuestsWidth] = useState(() => {
    const v = Number(localStorage.getItem("seating:guestsWidth"));
    return v >= 280 ? v : 320;
  });
  // When the guests panel is widened, fold the left panel into a drawer (like mobile).
  const leftDrawer = isDesktop && guestsWidth > 360;
  const resizing = useRef<{ x: number; w: number } | null>(null);

  useEffect(() => {
    localStorage.setItem("seating:guestsWidth", String(guestsWidth));
  }, [guestsWidth]);

  const onResizeDown = (e: ReactPointerEvent) => {
    resizing.current = { x: e.clientX, w: guestsWidth };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: ReactPointerEvent) => {
    if (!resizing.current) return;
    const next = resizing.current.w + (resizing.current.x - e.clientX);
    const max = Math.round(window.innerWidth * 0.3);
    setGuestsWidth(Math.max(290, Math.min(max, next)));
  };
  const onResizeUp = (e: ReactPointerEvent) => {
    resizing.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const name = projectName.trim() || t("project.untitled");
    document.title = `${name} — ${t("app.fullName")}`;
  }, [projectName, t]);

  // Reveal the left panel (drawer) as soon as something is selected.
  useEffect(() => {
    if (selectedIds.length > 0 && (leftDrawer || window.matchMedia("(max-width: 720px)").matches)) {
      setLeftOpen(true);
    }
  }, [selectedIds.length, leftDrawer]);

  const tableSet = new Set(tables.map((t) => t.id));
  const selObjectCount = selectedIds.filter((id) => !tableSet.has(id)).length;
  let propsPanel;
  if (selectedIds.length === 0) propsPanel = <EmptyPanel />;
  else if (selObjectCount === 0) propsPanel = <TablePanel />;
  else if (selectedIds.length === 1) propsPanel = <ObjectPanel />;
  else propsPanel = <BulkPanel />;

  return (
    <div className="app">
      <Toolbar
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleGuests={() => setGuestsOpen((v) => !v)}
        onSettings={() => setSettingsOpen(true)}
        showLeftToggle={leftDrawer}
      />
      <div className="body">
        <aside className={`side left ${leftOpen ? "open" : ""} ${leftDrawer ? "as-drawer" : ""}`}>
          <LeftPanel
            onAddTable={() => {
              setAddOpen(true);
              setLeftOpen(false);
            }}
            onAddObject={() => {
              setAddObjOpen(true);
              setLeftOpen(false);
            }}
          />
          {propsPanel}
        </aside>
        <main className="canvas-area">
          <FloorCanvas onHelp={() => setHelpOpen(true)} onLegend={() => setLegendOpen(true)} />
        </main>
        {isDesktop && (
          <div
            className="resize-handle"
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            role="separator"
            aria-orientation="vertical"
          />
        )}
        <aside
          className={`side right ${guestsOpen ? "open" : ""}`}
          style={isDesktop ? { width: guestsWidth } : undefined}
        >
          <GuestsPanel onClose={() => setGuestsOpen(false)} />
        </aside>
        {leftOpen && (
          <div className={`scrim ${leftDrawer ? "" : "only-mobile"}`} onClick={() => setLeftOpen(false)} />
        )}
        {guestsOpen && <div className="scrim only-mobile" onClick={() => setGuestsOpen(false)} />}
      </div>
      {addOpen && <AddTableModal onClose={() => setAddOpen(false)} />}
      {addObjOpen && <AddObjectModal onClose={() => setAddObjOpen(false)} />}
      {helpOpen && <ShortcutsModal onClose={() => setHelpOpen(false)} />}
      {legendOpen && <LegendModal onClose={() => setLegendOpen(false)} />}
      {settingsOpen && <ProjectSettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
