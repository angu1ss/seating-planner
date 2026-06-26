# Seating Planner

A browser app for arranging tables and seating guests at events (weddings, banquets, conferences). Everything runs client‑side: autosave to `localStorage` plus project export/import as `.json`. EN/RU localization, light/dark theme, responsive for desktop, tablet and phone.

Stack: React + TypeScript + Vite, Konva (react‑konva) for the canvas, Zustand for state, Font Awesome Pro for icons.

[Русская версия README](./README.ru.md)

## Keyboard shortcuts

| Keys                                | Action                       |
|-------------------------------------|------------------------------|
| `Esc`                               | Deselect / close dialog      |
| `Ctrl/⌘ + A` / `Ctrl/⌘ + Shift + A` | Select all tables / deselect |
| `Ctrl/⌘ + C` / `Ctrl/⌘ + V`         | Copy / paste (at cursor)     |
| `Ctrl/⌘ + D`                        | Duplicate                    |
| `Ctrl/⌘ + S`                        | Export project to `.json`    |
| `Delete` / `Backspace`              | Delete selection             |
| Arrows / `Shift` + arrows           | Move by a small / large step |
| `[` / `]` (with `Shift` — ±90°)     | Rotate selection by ±15°     |
| `L`                                 | Lock / unlock selection      |
| `+` / `−` / `PageUp` / `PageDown`   | Zoom; `0` — fit to screen    |
| Space + drag                        | Pan the canvas               |

The same list is available in the editor via the help button (top‑right).

## Font Awesome Pro token

Icons use Font Awesome Pro, installed from a private registry, so a token is required **at install time**.

- **Local:** copy `.env.example` to `.env` and set `FONTAWESOME_NPM_AUTH_TOKEN` (from your Font Awesome account → *npm tokens*). Docker Compose reads `.env` automatically.
- **CI (GitHub Actions):** add a repository secret named `FONTAWESOME_NPM_AUTH_TOKEN`.

## Run with Docker (no local Node/npm)

```bash
docker compose up --build      # http://localhost:5173
```

Stop with `docker compose down`. Rebuild the image after changing dependencies (`docker compose up --build`).

## Run with npm

```bash
npm install
npm run dev       # dev server
npm run build     # production build
npm run preview   # preview the build
```
