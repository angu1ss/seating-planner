import { getExportStage } from "./registry";
import { useStore } from "../store";

/** Pixels per meter at zoom 1 — must match FloorCanvas PPM. */
const PPM = 50;

export interface PlanPage {
  name: string;
  dataUrl: string;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Snapshot the live stage (current hall) as a PNG, independent of pan/zoom. */
function captureActive(venue: { width: number; height: number }): string | null {
  const stage = getExportStage();
  if (!stage || venue.width <= 0 || venue.height <= 0) return null;
  const W = venue.width * PPM;
  const H = venue.height * PPM;
  const saved = {
    sx: stage.scaleX(),
    sy: stage.scaleY(),
    x: stage.x(),
    y: stage.y(),
    w: stage.width(),
    h: stage.height(),
  };
  try {
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.size({ width: W, height: H });
    stage.draw();
    const pixelRatio = Math.min(4, Math.max(1, 2400 / W));
    return stage.toDataURL({ x: 0, y: 0, width: W, height: H, pixelRatio, mimeType: "image/png" });
  } finally {
    stage.size({ width: saved.w, height: saved.h });
    stage.scale({ x: saved.sx, y: saved.sy });
    stage.position({ x: saved.x, y: saved.y });
    stage.draw();
  }
}

/**
 * Snapshot every hall as its own page image. The live canvas only renders the
 * active hall, so we briefly switch the active sheet to each one, let it paint,
 * capture, then restore. activeSheetId isn't part of undo history, so this is safe.
 */
export async function preparePlanPages(fallbackHall: (index: number) => string): Promise<PlanPage[]> {
  const sheets = useStore.getState().sheets;
  const original = useStore.getState().activeSheetId;
  const pages: PlanPage[] = [];
  try {
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      useStore.getState().setActiveSheet(sheet.id);
      await nextFrame();
      await nextFrame();
      const dataUrl = captureActive({ width: sheet.venue.width, height: sheet.venue.height });
      if (dataUrl) pages.push({ name: sheet.name.trim() || fallbackHall(i), dataUrl });
    }
  } finally {
    // Always return to the hall the user was on, even if a capture throws.
    useStore.getState().setActiveSheet(original);
    await nextFrame();
  }
  return pages;
}
