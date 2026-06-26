import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
