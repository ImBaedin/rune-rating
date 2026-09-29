import { expect, test } from "bun:test";
import {
  anchoredViewport,
  sectionAtViewportCenter,
  sectionViewport,
} from "../src/features/achievements/atlasViewport";

test("manual panning selects the section at the viewport center across zoom levels and gaps", () => {
  const sections = [
    { id: "quests", x: 0, width: 1800 },
    { id: "travel", x: 1960, width: 1580 },
    { id: "equipment", x: 3700, width: 2200 },
  ];
  for (const zoom of [0.25, 0.85, 1.8]) {
    for (const [center, expected] of [
      [-500, "quests"],
      [900, "quests"],
      [1850, "quests"],
      [1910, "travel"],
      [2700, "travel"],
      [4700, "equipment"],
      [6500, "equipment"],
    ] as const) {
      expect(
        sectionAtViewportCenter(
          sections,
          { x: 700 - center * zoom, y: -200, zoom },
          1400,
        )?.id,
      ).toBe(expected);
    }
  }
});

test("navigation centers a section that fits at the current zoom", () => {
  const view = sectionViewport({ x: 8000, width: 1800 }, 1400, 0.5);
  const left = view.x + 8000 * view.zoom;
  const right = 1400 - (left + 1800 * view.zoom);
  expect(left).toBeCloseTo(right);
  expect(view.zoom).toBe(0.5);
});
test("navigation left-aligns a wide section without changing zoom", () => {
  const section = { x: 8000, width: 1800 };
  for (const zoom of [0.85, 1, 1.8]) {
    const view = sectionViewport(section, 1400, zoom);
    expect(view.x + section.x * zoom).toBeCloseTo(24);
    expect(view.zoom).toBe(zoom);
  }
});
test("Safari viewport updates keep the graph point under the pinch stationary", () => {
  const view = { x: -10000, y: -340, zoom: 0.8 };
  const anchor = { x: 321, y: 247 };
  for (const requested of [0.1, 0.7, 1.6, 3]) {
    const next = anchoredViewport(view, requested, anchor);
    expect((anchor.x - next.x) / next.zoom).toBeCloseTo(
      (anchor.x - view.x) / view.zoom,
    );
    expect((anchor.y - next.y) / next.zoom).toBeCloseTo(
      (anchor.y - view.y) / view.zoom,
    );
    expect(next.zoom).toBeGreaterThanOrEqual(0.25);
    expect(next.zoom).toBeLessThanOrEqual(1.8);
  }
});
