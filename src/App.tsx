import { lazy, Suspense, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
import { WelcomeModal } from "./components/panels/WelcomeModal";
import { ExportModal } from "./components/panels/ExportModal";
import { ShareModal } from "./components/panels/ShareModal";
import { AboutModal } from "./components/panels/AboutModal";
import { ShareLoadModal, type ShareLoadKind } from "./components/panels/ShareLoadModal";
import { readShareLink, isShareHash, hashDocument, isEmptyDocument } from "./utils/share";
import { downloadJSON, slugify } from "./utils/file";
import type { ProjectState } from "./types";
import { preparePlanPages, type PlanPage } from "./export/plan";
import { buildPrintContext, type PrintContext } from "./print/context";
import { PrintGuestList } from "./print/PrintGuestList";
import { PrintEscortCards } from "./print/PrintEscortCards";

type PrintJob =
  | { kind: "plan"; pages: PlanPage[] }
  | { kind: "guests"; ctx: PrintContext }
  | { kind: "cards"; ctx: PrintContext };
import { GuestsPanel } from "./components/panels/GuestsPanel";
import { LegendModal } from "./components/panels/LegendModal";

// The Konva canvas (react-konva + konva) is the heaviest dependency — load it as its
// own chunk so the toolbar/panels shell can paint first.
const FloorCanvas = lazy(() =>
  import("./components/canvas/FloorCanvas").then((m) => ({ default: m.FloorCanvas })),
);

export default function App() {
  const t = useT();
  const theme = useI18n((s) => s.theme);
  const lang = useI18n((s) => s.lang);
  const onboarded = useI18n((s) => s.onboarded);
  const setOnboarded = useI18n((s) => s.setOnboarded);
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
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [shareLoad, setShareLoad] = useState<{ kind: ShareLoadKind; doc?: ProjectState; linkNewer?: boolean } | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const printing = useRef(false);

  const runPlanPrint = async () => {
    if (printing.current) return;
    printing.current = true;
    try {
      const pages = await preparePlanPages((i) => `${t("left.hall")} ${i + 1}`);
      if (pages.length) setPrintJob({ kind: "plan", pages });
      else printing.current = false;
    } catch {
      printing.current = false;
    }
  };
  const printGuests = () => {
    if (printing.current) return;
    printing.current = true;
    setPrintJob({ kind: "guests", ctx: buildPrintContext(t, lang) });
  };
  const printCards = () => {
    const ctx = buildPrintContext(t, lang);
    if (!ctx.guests.some((g) => g.seat)) {
      alert(t("export.noSeated"));
      return;
    }
    if (printing.current) return;
    printing.current = true;
    setPrintJob({ kind: "cards", ctx });
  };
  const planPrintRef = useRef(runPlanPrint);
  planPrintRef.current = runPlanPrint;

  const isDesktop = useMediaQuery("(min-width: 721px)");
  const [guestsWidth, setGuestsWidth] = useState(() => {
    try {
      const v = Number(localStorage.getItem("seating:guestsWidth"));
      return v >= 280 ? v : 320;
    } catch {
      return 320; // storage blocked (private mode / sandboxed iframe)
    }
  });
  // When the guests panel is widened, fold the left panel into a drawer (like mobile).
  const leftDrawer = isDesktop && guestsWidth > 360;
  const resizing = useRef<{ x: number; w: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("seating:guestsWidth", String(guestsWidth));
    } catch {
      /* storage blocked — ignore */
    }
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

  // A shared project arrives in the URL fragment (#p=...). On open, decode it, ask before
  // replacing the current project, then strip the hash so a refresh doesn't re-prompt.
  useEffect(() => {
    if (!isShareHash(window.location.hash)) return;
    let alive = true;
    void (async () => {
      const doc = await readShareLink(window.location.hash);
      // Strip the hash up front so a refresh doesn't re-prompt.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      if (!alive) return;
      if (!doc) {
        setShareLoad({ kind: "invalid" });
        return;
      }
      const current = useStore.getState().getDocument();
      // Identical content → nothing to do (no prompt).
      if (hashDocument(doc) === hashDocument(current)) return;
      // Empty/default current project → just load it, no prompt.
      if (isEmptyDocument(current)) {
        useStore.getState().loadDocument(doc);
        setOnboarded(true);
        return;
      }
      // Otherwise confirm: same project (different version) vs a different project.
      const sameProject = Boolean(doc.project?.id) && doc.project.id === current.project?.id;
      setShareLoad({
        kind: sameProject ? "update" : "different",
        doc,
        linkNewer: (doc.updatedAt ?? 0) >= (current.updatedAt ?? 0),
      });
    })();
    return () => {
      alive = false;
    };
  }, [setOnboarded]);

  // Show the welcome flow whenever the app isn't onboarded — first run, or after a full
  // reset (which clears the flag). Existing non-empty projects are marked onboarded silently.
  useEffect(() => {
    // Don't pop the welcome flow when arriving via a share link — that flow handles itself.
    if (isShareHash(window.location.hash)) return;
    if (onboarded) {
      setWelcomeOpen(false);
      return;
    }
    const s = useStore.getState();
    const isEmpty =
      !s.project.name.trim() &&
      s.guests.length === 0 &&
      s.sheets.every((sh) => sh.tables.length === 0 && sh.objects.length === 0);
    if (isEmpty) setWelcomeOpen(true);
    else setOnboarded(true);
  }, [onboarded, setOnboarded]);

  const closeWelcome = () => {
    setOnboarded(true);
    setWelcomeOpen(false);
  };

  // Ctrl/Cmd+P prints the floor plan (one hall per page) instead of the raw page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "p") return;
      e.preventDefault();
      void planPrintRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Once a print job renders, open the browser print dialog, then clean up.
  useEffect(() => {
    if (!printJob) return;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      setPrintJob(null);
      printing.current = false;
    };
    window.addEventListener("afterprint", done, { once: true });
    // Fallback: some browsers don't fire `afterprint` when the dialog is cancelled —
    // the window regains focus instead. Without this the busy lock could stick forever.
    const onFocus = () => window.setTimeout(done, 300);
    window.addEventListener("focus", onFocus, { once: true });
    const id = window.setTimeout(() => window.print(), 80);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("afterprint", done);
      window.removeEventListener("focus", onFocus);
      printing.current = false;
    };
  }, [printJob]);

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
    <>
    <div className="app">
      <Toolbar
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleGuests={() => setGuestsOpen((v) => !v)}
        onSettings={() => setSettingsOpen(true)}
        onExport={() => setExportOpen(true)}
        onShare={() => setShareOpen(true)}
        onAbout={() => setAboutOpen(true)}
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
          <Suspense fallback={<div className="canvas-loading" />}>
            <FloorCanvas onHelp={() => setHelpOpen(true)} onLegend={() => setLegendOpen(true)} />
          </Suspense>
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
      {settingsOpen && (
        <ProjectSettingsModal onClose={() => setSettingsOpen(false)} onAbout={() => setAboutOpen(true)} />
      )}
      {exportOpen && (
        <ExportModal
          onClose={() => setExportOpen(false)}
          onPrintPlan={runPlanPrint}
          onPrintGuests={printGuests}
          onPrintCards={printCards}
        />
      )}
      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      {shareLoad && (
        <ShareLoadModal
          kind={shareLoad.kind}
          linkNewer={shareLoad.linkNewer}
          onSave={
            shareLoad.doc
              ? () => downloadJSON(useStore.getState().getDocument(), `${slugify(projectName)}.json`)
              : undefined
          }
          onConfirm={
            shareLoad.doc
              ? () => {
                  useStore.getState().loadDocument(shareLoad.doc!);
                  setOnboarded(true);
                  setShareLoad(null);
                }
              : undefined
          }
          onClose={() => setShareLoad(null)}
        />
      )}
      {welcomeOpen && <WelcomeModal onClose={closeWelcome} />}
    </div>
    {printJob && (
      <div className="print-root" aria-hidden="true">
        <style>
          {printJob.kind === "plan"
            ? "@page{size:A4 landscape;margin:10mm}"
            : "@page{size:A4 portrait;margin:12mm}"}
        </style>
        {printJob.kind === "plan" &&
          printJob.pages.map((p, i) => (
            <section className="print-page" key={i}>
              <h2 className="print-title">{p.name}</h2>
              <img src={p.dataUrl} alt="" />
            </section>
          ))}
        {printJob.kind === "guests" && <PrintGuestList ctx={printJob.ctx} />}
        {printJob.kind === "cards" && <PrintEscortCards ctx={printJob.ctx} />}
      </div>
    )}
    </>
  );
}
