import type { Theme } from "./types";

export interface Palette {
  bg: string;
  grid: string;
  gridStrong: string;
  venueFill: string;
  venueStroke: string;
  tableFill: string;
  tableStroke: string;
  tableSelected: string;
  tableTight: string;
  podiumStroke: string;
  chairFill: string;
  chairStroke: string;
  labelText: string;
}

const light: Palette = {
  bg: "#eef1f5",
  grid: "#dde3ea",
  gridStrong: "#c4ccd6",
  venueFill: "#ffffff",
  venueStroke: "#9aa6b2",
  tableFill: "#cdb4f0",
  tableStroke: "#7c5fb0",
  tableSelected: "#3b82f6",
  tableTight: "#e0a100",
  podiumStroke: "#b8860b",
  chairFill: "#f4f6f9",
  chairStroke: "#8a97a5",
  labelText: "#26303a",
};

const dark: Palette = {
  bg: "#0f141a",
  grid: "#1c2630",
  gridStrong: "#2a3744",
  venueFill: "#161d25",
  venueStroke: "#3a4754",
  tableFill: "#5b4b86",
  tableStroke: "#9d86d6",
  tableSelected: "#60a5fa",
  tableTight: "#f0b429",
  podiumStroke: "#d9a441",
  chairFill: "#222c36",
  chairStroke: "#566472",
  labelText: "#e6edf3",
};

export function getPalette(theme: Theme): Palette {
  return theme === "dark" ? dark : light;
}
