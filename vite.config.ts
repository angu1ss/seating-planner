import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8"),
) as { version: string };

// Public assets (not content-hashed) that make up the offline shell.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./logo.svg",
  "./favicon.ico",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png",
];

/**
 * Generates `dist/sw.js` from pwa/sw.js, injecting a per-build id and the list of
 * emitted (hashed) JS/CSS to precache. The changing bytes are what let the browser
 * detect a new version. Build-only — there is no service worker during `vite dev`.
 */
function pwaServiceWorker(): Plugin {
  return {
    name: "pwa-service-worker",
    apply: "build",
    generateBundle(_options, bundle) {
      const hashed = Object.keys(bundle)
        .filter((f) => /\.(js|css)$/.test(f))
        .map((f) => "./" + f);
      const precache = [...SHELL_ASSETS, ...hashed];
      const buildId = Date.now().toString(36);
      const template = readFileSync(
        fileURLToPath(new URL("./pwa/sw.js", import.meta.url)),
        "utf8",
      );
      const source = template
        .replaceAll("__BUILD_ID__", buildId)
        .replaceAll("__PRECACHE__", JSON.stringify(precache));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), pwaServiceWorker()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  // Relative base so the build works both on a static host and on GitHub Pages
  // (project subpath), and when served by nginx.
  base: "./",
  server: {
    // Listen on 0.0.0.0 so the dev server is reachable from outside the container.
    host: true,
    port: 5173,
    // Poll the filesystem — bind-mounted volumes on macOS/Windows Docker don't
    // emit native FS events reliably, so HMR needs polling.
    watch: { usePolling: true },
  },
  preview: {
    host: true,
    port: 4173,
  },
});
