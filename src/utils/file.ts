import type { ProjectState } from "../types";

export function downloadJSON(doc: ProjectState, filename: string) {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function readJSONFile(file: File): Promise<ProjectState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as ProjectState;
        if (!parsed || !parsed.project || !parsed.venue) {
          throw new Error("Не похоже на проект рассадки");
        }
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function slugify(name: string): string {
  return name.trim().replace(/\s+/g, "-").replace(/[^\wа-яА-ЯёЁ-]/g, "").toLowerCase() || "project";
}
