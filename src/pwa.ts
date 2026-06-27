import { useSyncExternalStore } from "react";

/**
 * Service-worker registration + update plumbing.
 *
 * Behaviour: the worker installs and precaches in the background automatically.
 * When a new build is found it waits, and `updateReady` flips to true so the UI
 * can offer a manual "Update" button. Applying it (skipWaiting → controllerchange)
 * reloads the page onto the new version.
 */

let registration: ServiceWorkerRegistration | null = null;
let waiting: ServiceWorker | null = null;
let updateReady = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function markWaiting(worker: ServiceWorker) {
  waiting = worker;
  updateReady = true;
  emit();
}

const swUrl = `${import.meta.env.BASE_URL}sw.js`;

export function registerPwa() {
  if (import.meta.env.DEV) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  initInstallPrompt();

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    void registerWorker();
  });
}

async function registerWorker() {
  try {
    const reg = await navigator.serviceWorker.register(swUrl);
    registration = reg;

    if (reg.waiting && navigator.serviceWorker.controller) markWaiting(reg.waiting);

    reg.addEventListener("updatefound", () => {
      const next = reg.installing;
      if (!next) return;
      next.addEventListener("statechange", () => {
        if (next.state === "installed" && navigator.serviceWorker.controller) markWaiting(next);
      });
    });

    // Background checks: when the tab regains focus, and hourly.
    const check = () => {
      void reg.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
    window.setInterval(check, 60 * 60 * 1000);
  } catch {
    // Registration failed (e.g. unsupported context) — the app still works online.
  }
}

/** Apply a waiting update: ask it to take over; controllerchange then reloads. */
export function applyPwaUpdate() {
  if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
}

/** Manually poll for a new version. Resolves to whether an update is now ready. */
export async function checkForPwaUpdate(): Promise<boolean> {
  if (!registration) return false;
  await registration.update();
  return updateReady;
}

/** True only when launched as an installed PWA (standalone window), not a browser tab. */
function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const inDisplayMode = (mode: string) =>
    typeof window.matchMedia === "function" && window.matchMedia(`(display-mode: ${mode})`).matches;
  const iosStandalone =
    typeof navigator !== "undefined" &&
    "standalone" in navigator &&
    (navigator as { standalone?: boolean }).standalone === true;
  return (
    inDisplayMode("standalone") ||
    inDisplayMode("minimal-ui") ||
    inDisplayMode("window-controls-overlay") ||
    iosStandalone
  );
}

export const isPwaStandalone = detectStandalone();

/** React binding: re-renders when an update becomes ready. */
export function usePwaUpdateReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => updateReady,
    () => false,
  );
}

/* ---------- Install prompt (Android / Chromium `beforeinstallprompt`) ---------- */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const AUTO_PROMPT_KEY = "seating-planner:installPrompted";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let canInstall = false;
const installListeners = new Set<() => void>();

function emitInstall() {
  for (const l of installListeners) l();
}

function subscribeInstall(cb: () => void) {
  installListeners.add(cb);
  return () => {
    installListeners.delete(cb);
  };
}

function autoPrompted(): boolean {
  try {
    return localStorage.getItem(AUTO_PROMPT_KEY) === "1";
  } catch {
    return true; // storage blocked → don't auto-pop
  }
}

/** Show the system install dialog. Marks "prompted" only if it actually opened. */
async function triggerInstall() {
  const dp = deferredPrompt;
  if (!dp) return;
  try {
    await dp.prompt();
    try {
      localStorage.setItem(AUTO_PROMPT_KEY, "1");
    } catch {
      /* ignore */
    }
    deferredPrompt = null;
    canInstall = false;
    emitInstall();
    await dp.userChoice;
  } catch {
    // Browser refused (e.g. needs a user gesture) — keep the deferred prompt so the
    // settings "Install" button can trigger it from a click.
  }
}

function initInstallPrompt() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    canInstall = true;
    emitInstall();
    // Auto-offer once per device (separate flag; never reset by settings).
    if (!autoPrompted()) void triggerInstall();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    canInstall = false;
    emitInstall();
  });
}

/** Trigger the system install dialog from a user gesture (settings button). */
export function promptInstall() {
  void triggerInstall();
}

/** React binding: whether the app can currently be installed (button visibility). */
export function usePwaCanInstall(): boolean {
  return useSyncExternalStore(
    subscribeInstall,
    () => canInstall,
    () => false,
  );
}
