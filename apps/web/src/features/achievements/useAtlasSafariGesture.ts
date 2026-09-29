import { useReactFlow } from "@xyflow/react";
import { type RefObject, useEffect, useRef } from "react";
import { type AtlasPan, anchoredViewport } from "./atlasViewport";

type SafariGesture = Event & {
  scale: number;
  clientX: number;
  clientY: number;
};

/** Safari's desktop gesture events feed the same React Flow viewport as wheel/touch. */
export function useAtlasSafariGesture(
  container: RefObject<HTMLDivElement | null>,
  onStart: () => void,
  onEnd: () => void,
) {
  const flow = useReactFlow();
  const gesture = useRef<{ scale: number; anchor: AtlasPan } | null>(null);
  const cursor = useRef<AtlasPan>({ x: 0, y: 0 });
  const touches = useRef(0);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    function anchor(event: SafariGesture) {
      const rect = element?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      if (event.clientX || event.clientY)
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
      return cursor.current;
    }
    function start(event: Event) {
      event.preventDefault();
      if (touches.current) return;
      const native = event as SafariGesture;
      gesture.current = { scale: native.scale || 1, anchor: anchor(native) };
      onStart();
    }
    function change(event: Event) {
      event.preventDefault();
      const current = gesture.current;
      const native = event as SafariGesture;
      if (
        !current ||
        touches.current ||
        !Number.isFinite(native.scale) ||
        native.scale <= 0
      )
        return;
      const nextAnchor = anchor(native);
      const view = flow.getViewport();
      const next = anchoredViewport(
        view,
        (view.zoom * native.scale) / current.scale,
        current.anchor,
      );
      next.x += nextAnchor.x - current.anchor.x;
      next.y += nextAnchor.y - current.anchor.y;
      void flow.setViewport(next);
      gesture.current = { scale: native.scale, anchor: nextAnchor };
    }
    function end(event: Event) {
      event.preventDefault();
      if (!gesture.current) return;
      gesture.current = null;
      onEnd();
    }
    function wheel(event: WheelEvent) {
      if (!gesture.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    function trackTouches(event: TouchEvent) {
      touches.current = event.touches.length;
    }
    function trackCursor(event: PointerEvent) {
      const rect = element?.getBoundingClientRect();
      if (rect)
        cursor.current = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
    }
    element.addEventListener("gesturestart", start, { passive: false });
    element.addEventListener("gesturechange", change, { passive: false });
    element.addEventListener("gestureend", end, { passive: false });
    element.addEventListener("wheel", wheel, { passive: false, capture: true });
    element.addEventListener("touchstart", trackTouches, { passive: true });
    element.addEventListener("touchend", trackTouches, { passive: true });
    element.addEventListener("touchcancel", trackTouches, { passive: true });
    element.addEventListener("pointermove", trackCursor, { passive: true });
    return () => {
      element.removeEventListener("gesturestart", start);
      element.removeEventListener("gesturechange", change);
      element.removeEventListener("gestureend", end);
      element.removeEventListener("wheel", wheel, true);
      element.removeEventListener("touchstart", trackTouches);
      element.removeEventListener("touchend", trackTouches);
      element.removeEventListener("touchcancel", trackTouches);
      element.removeEventListener("pointermove", trackCursor);
    };
  }, [container, flow, onStart, onEnd]);
}
