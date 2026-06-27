import type Konva from "konva";

/**
 * The live Konva stage of the floor canvas, registered by FloorCanvas so the PDF
 * exporters can snapshot the current hall without prop-drilling a ref everywhere.
 */
let stage: Konva.Stage | null = null;

export function setExportStage(s: Konva.Stage | null) {
  stage = s;
}

export function getExportStage(): Konva.Stage | null {
  return stage;
}
