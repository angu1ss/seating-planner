let cached: boolean | null = null;

/**
 * Detects whether the client renders regional-indicator flag emoji (🇺🇸) as a
 * real colored flag. On platforms that fall back to two monospace letters
 * (e.g. Windows) the glyph is monochrome — we detect the absence of color.
 */
export function supportsFlagEmoji(): boolean {
  if (cached !== null) return cached;
  try {
    const size = 16;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      cached = false;
      return cached;
    }
    ctx.textBaseline = "top";
    ctx.font = `${size}px sans-serif`;
    ctx.fillText("🇺🇸", 0, 0);
    const { data } = ctx.getImageData(0, 0, size, size);
    let colored = false;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > 0 && Math.max(r, g, b) - Math.min(r, g, b) > 24) {
        colored = true;
        break;
      }
    }
    cached = colored;
  } catch {
    cached = false;
  }
  return cached;
}

export const FLAGS: Record<"en" | "ru", string> = {
  en: "🇺🇸",
  ru: "🇷🇺",
};
