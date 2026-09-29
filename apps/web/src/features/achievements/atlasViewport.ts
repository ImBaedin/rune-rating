import type { Viewport } from "@xyflow/react";

export type AtlasPan = { x: number; y: number };
export const atlasInitialZoom = 0.85;
export const atlasMinZoom = 0.25;
export const atlasMaxZoom = 1.8;
export const atlasNodeWidth = 190;
export const atlasNodeHeight = 180;

/** The section beneath the viewport center owns the active tab; gaps use the nearest edge. */
export function sectionAtViewportCenter<T extends { x: number; width: number }>(
  sections: readonly T[],
  viewport: Viewport,
  width: number,
): T | undefined {
  const center = (width / 2 - viewport.x) / viewport.zoom;
  let closest: T | undefined;
  let distance = Number.POSITIVE_INFINITY;
  for (const section of sections) {
    const gap = Math.max(
      section.x - center,
      center - section.x - section.width,
      0,
    );
    if (gap < distance) {
      closest = section;
      distance = gap;
    }
  }
  return closest;
}

/** Preserve zoom; center a section that fits, otherwise expose its left edge. */
export function sectionViewport(
  section: { x: number; width: number },
  viewportWidth: number,
  zoom: number,
): Viewport {
  const padding = 24;
  const available = Math.max(0, viewportWidth - padding * 2);
  const inset = Math.max(padding, (viewportWidth - section.width * zoom) / 2);
  return {
    x: (section.width * zoom <= available ? inset : padding) - section.x * zoom,
    y: 20,
    zoom,
  };
}

/** Keep a graph point fixed on screen while changing zoom atomically. */
export function anchoredViewport(
  viewport: Viewport,
  zoom: number,
  anchor: AtlasPan,
): Viewport {
  const next = Math.max(atlasMinZoom, Math.min(atlasMaxZoom, zoom));
  const ratio = next / viewport.zoom;
  return {
    x: anchor.x - (anchor.x - viewport.x) * ratio,
    y: anchor.y - (anchor.y - viewport.y) * ratio,
    zoom: next,
  };
}
