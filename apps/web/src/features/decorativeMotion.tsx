import { useSyncExternalStore } from "react";

const preferenceKey = "rune-rating:pause-motion";
const preferenceEvent = "rune-rating:motion-change";
let sessionPaused: boolean | undefined;

function isPaused() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return true;
  try {
    return localStorage.getItem(preferenceKey) === "true";
  } catch {
    return sessionPaused ?? false;
  }
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  window.addEventListener(preferenceEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(preferenceEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useDecorativeMotionPaused() {
  return useSyncExternalStore(subscribe, isPaused, () => true);
}

export function MotionToggle() {
  const paused = useDecorativeMotionPaused();
  const systemReduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  return (
    <button
      type="button"
      className="motion-toggle"
      aria-pressed={paused}
      disabled={systemReduced}
      onClick={() => {
        sessionPaused = !paused;
        try {
          localStorage.setItem(preferenceKey, String(sessionPaused));
        } catch {
          // The in-memory preference still works when storage is unavailable.
        }
        window.dispatchEvent(new Event(preferenceEvent));
      }}
      title="Decorative motion also respects your system's reduced-motion preference"
    >
      {systemReduced
        ? "Motion reduced"
        : paused
          ? "Resume motion"
          : "Pause motion"}
    </button>
  );
}
