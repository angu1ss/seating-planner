import { useEffect, useState } from "react";
import { useStore, activeSheet } from "./store";
import { useT, useI18n } from "./i18n";
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
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const name = projectName.trim() || t("project.untitled");
    document.title = `${name} — ${t("app.fullName")}`;
  }, [projectName, t]);

  // On phones, reveal the side panel as soon as something is selected.
  useEffect(() => {
    if (selectedIds.length > 0 && window.matchMedia("(max-width: 720px)").matches) {
      setLeftOpen(true);
    }
  }, [selectedIds.length]);

  const tableSet = new Set(tables.map((t) => t.id));
  const selObjectCount = selectedIds.filter((id) => !tableSet.has(id)).length;
  let propsPanel;
  if (selectedIds.length === 0) propsPanel = <EmptyPanel />;
  else if (selObjectCount === 0) propsPanel = <TablePanel />;
  else if (selectedIds.length === 1) propsPanel = <ObjectPanel />;
  else propsPanel = <BulkPanel />;

  return (
    <div className="app">
      <Toolbar onToggleLeft={() => setLeftOpen((v) => !v)} onSettings={() => setSettingsOpen(true)} />
      <div className="body">
        <aside className={`side left ${leftOpen ? "open" : ""}`}>
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
          <FloorCanvas onHelp={() => setHelpOpen(true)} />
        </main>
        {leftOpen && <div className="scrim only-mobile" onClick={() => setLeftOpen(false)} />}
      </div>
      {addOpen && <AddTableModal onClose={() => setAddOpen(false)} />}
      {addObjOpen && <AddObjectModal onClose={() => setAddObjOpen(false)} />}
      {helpOpen && <ShortcutsModal onClose={() => setHelpOpen(false)} />}
      {settingsOpen && <ProjectSettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
