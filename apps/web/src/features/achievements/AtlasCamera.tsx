import { type Ref, useEffect, useImperativeHandle, useRef } from "react";
import worldMap from "../../assets/atlas/gielinor.webp";
import { type AtlasNode, defaultAtlasLocation } from "./atlasPreview";

const overviewZoom = 1.45;
const nodeZoom = 2.3;
const initialCamera = {
  x: defaultAtlasLocation.x,
  y: defaultAtlasLocation.y,
  offsetX: 0,
  offsetY: 0,
  zoom: overviewZoom,
};
export type AtlasCameraTarget = {
  id: string;
  element: () => HTMLElement | null;
  pullBack: boolean;
};
export type AtlasCameraHandle = { freezeFocalPoint: () => void };
const smoothstep = (value: number) => value * value * (3 - 2 * value);
const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

/** The camera owns animation frames; React only supplies the next destination. */
export function AtlasCamera({
  ref,
  location,
  target,
  paused,
}: {
  ref: Ref<AtlasCameraHandle>;
  location: AtlasNode["location"];
  target: AtlasCameraTarget | null;
  paused: boolean;
}) {
  const image = useRef<HTMLImageElement>(null);
  const zoomLayer = useRef<HTMLDivElement>(null);
  const camera = useRef(initialCamera);
  const focalFrozen = useRef(false);
  useImperativeHandle(
    ref,
    () => ({
      freezeFocalPoint: () => {
        focalFrozen.current = true;
      },
    }),
    [],
  );
  const { x, y } = location;

  useEffect(() => {
    const map = image.current;
    const layer = zoomLayer.current;
    const boundsLayer = layer?.parentElement;
    if (!map || !layer || !boundsLayer) return;

    const start = { ...camera.current };
    focalFrozen.current = false;
    const arrivalZoom = target ? nodeZoom : overviewZoom;
    const startedAt = performance.now();
    let frame = 0;

    function focalOffset() {
      const node = target?.element()?.getBoundingClientRect();
      const bounds = boundsLayer?.getBoundingClientRect();
      if (!node || !bounds) return { offsetX: 0, offsetY: 0 };
      // Measure in the unscaled parent so graph zoom, drag, and map parallax
      // are included without feeding the camera's own transform back into it.
      return {
        offsetX: node.left + node.width / 2 - (bounds.left + bounds.width / 2),
        offsetY: node.top + node.height / 2 - (bounds.top + bounds.height / 2),
      };
    }

    function draw(next: typeof initialCamera) {
      camera.current = next;
      if (map)
        map.style.transform = `translate(${-next.x * 100}%, ${-next.y * 100}%)`;
      if (layer)
        layer.style.transform = `translate(${next.offsetX}px, ${next.offsetY}px) scale(${next.zoom})`;
    }

    // Follow section navigation during a flight, but never chase graph gestures.
    let focal = focalOffset();

    // Hydration resolves the motion preference; an overview is not a camera flight.
    if (!target) {
      draw({ x, y, ...focalOffset(), zoom: arrivalZoom });
      return;
    }

    function tick(now: number) {
      if (paused) {
        // A search jump may mount its virtualized node after this effect runs.
        // Resolve that frame before snapping, without starting a camera flight.
        if (!target?.element() && now - startedAt < 500) {
          frame = requestAnimationFrame(tick);
          return;
        }
        draw({ x, y, ...focalOffset(), zoom: arrivalZoom });
        return;
      }
      const progress = Math.min(1, (now - startedAt) / 1900);
      // Hover flights pull back; direct selections retain their current zoom.
      // Both finish the push in during the final part of the pan.
      const pan = 1 - (1 - progress) ** 3;
      const travelZoom =
        target?.pullBack === false ? start.zoom : Math.min(start.zoom, 1.06);
      const zoom =
        progress < 0.4
          ? lerp(start.zoom, travelZoom, smoothstep(progress / 0.4))
          : lerp(travelZoom, arrivalZoom, smoothstep((progress - 0.4) / 0.6));
      if (!focalFrozen.current) focal = focalOffset();
      draw({
        x: lerp(start.x, x, pan),
        y: lerp(start.y, y, pan),
        offsetX: lerp(start.offsetX, focal.offsetX, pan),
        offsetY: lerp(start.offsetY, focal.offsetY, pan),
        zoom,
      });
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    // Interrupted flights resume from the last rendered position and zoom.
    return () => cancelAnimationFrame(frame);
  }, [x, y, target, paused]);

  return (
    <div
      className="atlas-camera"
      ref={zoomLayer}
      style={{ transform: `translate(0px, 0px) scale(${initialCamera.zoom})` }}
    >
      <img
        className="atlas-world-image"
        ref={image}
        src={worldMap}
        alt=""
        width={3200}
        height={2267}
        style={{
          transform: `translate(${-initialCamera.x * 100}%, ${-initialCamera.y * 100}%)`,
        }}
      />
    </div>
  );
}
