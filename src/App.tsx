import { useEffect, useState } from "react";
import { useStore } from "./store";
import { Toolbar } from "./components/panels/Toolbar";
import { LeftPanel } from "./components/panels/LeftPanel";
import { TablePanel } from "./components/panels/TablePanel";
import { ObjectPanel } from "./components/panels/ObjectPanel";
import { AddTableModal } from "./components/panels/AddTableModal";
import { AddObjectModal } from "./components/panels/AddObjectModal";
import { ShortcutsModal } from "./components/panels/ShortcutsModal";
import { FloorCanvas } from "./components/canvas/FloorCanvas";

export default function App() {
  const theme = useStore((s) => s.settings.theme);
  const selectedObjectId = useStore((s) => s.selectedObjectId);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addObjOpen, setAddObjOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="app">
      <Toolbar
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
        onHelp={() => setHelpOpen(true)}
      />
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
        </aside>
        <main className="canvas-area">
          <FloorCanvas />
        </main>
        <aside className={`side right ${rightOpen ? "open" : ""}`}>
          {selectedObjectId ? <ObjectPanel /> : <TablePanel />}
        </aside>
        {(leftOpen || rightOpen) && (
          <div
            className="scrim only-mobile"
            onClick={() => {
              setLeftOpen(false);
              setRightOpen(false);
            }}
          />
        )}
      </div>
      {addOpen && <AddTableModal onClose={() => setAddOpen(false)} />}
      {addObjOpen && <AddObjectModal onClose={() => setAddObjOpen(false)} />}
      {helpOpen && <ShortcutsModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
