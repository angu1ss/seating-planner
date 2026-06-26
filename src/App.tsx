import { useEffect, useState } from "react";
import { useStore } from "./store";
import { Toolbar } from "./components/panels/Toolbar";
import { LeftPanel } from "./components/panels/LeftPanel";
import { TablePanel } from "./components/panels/TablePanel";
import { FloorCanvas } from "./components/canvas/FloorCanvas";

export default function App() {
  const theme = useStore((s) => s.settings.theme);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="app">
      <Toolbar onToggleLeft={() => setLeftOpen((v) => !v)} onToggleRight={() => setRightOpen((v) => !v)} />
      <div className="body">
        <aside className={`side left ${leftOpen ? "open" : ""}`}>
          <LeftPanel />
        </aside>
        <main className="canvas-area">
          <FloorCanvas />
        </main>
        <aside className={`side right ${rightOpen ? "open" : ""}`}>
          <TablePanel />
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
    </div>
  );
}
