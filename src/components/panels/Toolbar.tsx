import { useRef } from "react";
import { useStore } from "../../store";
import { downloadJSON, readJSONFile, slugify } from "../../utils/file";

interface Props {
  onToggleLeft: () => void;
  onToggleRight: () => void;
}

export function Toolbar({ onToggleLeft, onToggleRight }: Props) {
  const project = useStore((s) => s.project);
  const setProjectMeta = useStore((s) => s.setProjectMeta);
  const theme = useStore((s) => s.settings.theme);
  const setSettings = useStore((s) => s.setSettings);
  const getDocument = useStore((s) => s.getDocument);
  const loadDocument = useStore((s) => s.loadDocument);
  const resetProject = useStore((s) => s.resetProject);

  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    downloadJSON(getDocument(), `${slugify(project.name)}.json`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const doc = await readJSONFile(file);
      loadDocument(doc);
    } catch (err) {
      alert(`Не удалось открыть файл: ${(err as Error).message}`);
    } finally {
      e.target.value = "";
    }
  };

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button className="icon-btn only-mobile" onClick={onToggleLeft} aria-label="Инструменты">☰</button>
        <span className="app-title">Рассадка</span>
        <input
          className="project-name"
          value={project.name}
          onChange={(e) => setProjectMeta({ name: e.target.value })}
          aria-label="Название проекта"
        />
      </div>

      <div className="toolbar-group">
        <button
          className="btn"
          onClick={() => setSettings({ theme: theme === "dark" ? "light" : "dark" })}
          title="Сменить тему"
        >
          {theme === "dark" ? "☀️ Светлая" : "🌙 Тёмная"}
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>Открыть</button>
        <button className="btn" onClick={handleExport}>Сохранить</button>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm("Очистить проект? Несохранённые данные пропадут.")) resetProject();
          }}
        >
          Сброс
        </button>
        <button className="icon-btn only-mobile" onClick={onToggleRight} aria-label="Свойства">⚙</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
          style={{ display: "none" }}
        />
      </div>
    </header>
  );
}
