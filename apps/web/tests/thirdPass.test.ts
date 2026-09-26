import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PairChartTooltip } from "../src/components/comparison-ui";
import {
  knownTotal,
  scoreDifference,
} from "../src/features/comparison/activityScores";
import type { PlayerProfile } from "../src/features/comparison/context";
import { automaticRefreshKey } from "../src/features/comparison/sourceState";

test("consuming a combat repair preserves future stale refreshes and cooldowns", () => {
  const profile: NonNullable<PlayerProfile> = {
    normalizedRsn: "alice",
    displayRsn: "Alice",
    refreshAllowedAt: 10,
    lastSnapshotAt: 1,
    snapshotStaleAt: 10,
    skillsState: {
      status: "fresh",
      lastAttemptAt: 1,
      lastSuccessAt: 1,
      errorCode: null,
    },
    combatAchievementsState: {
      status: "failed",
      lastAttemptAt: 1,
      lastSuccessAt: 1,
      errorCode: "granularInvalid",
    },
    activitiesState: null,
    efficiencyState: null,
    questsState: null,
    diariesState: null,
    collectionState: null,
  };
  const used = new Set<string>();
  expect(automaticRefreshKey("Alice", profile, 5, used)).toBe(
    "alice:combat-invalid:1",
  );
  used.add("alice:combat-invalid:1");
  expect(automaticRefreshKey("Alice", profile, 5, used)).toBeNull();
  expect(automaticRefreshKey("Alice", profile, 11, used)).toBe("alice:1");
  used.add("alice:1");
  expect(automaticRefreshKey("Alice", profile, 11, used)).toBeNull();
  expect(
    automaticRefreshKey("Alice", { ...profile, lastSnapshotAt: 2 }, 11, used),
  ).toBe("alice:2");
  expect(
    automaticRefreshKey(
      "Alice",
      {
        ...profile,
        skillsState: {
          ...profile.skillsState,
          lastAttemptAt: 1,
          lastSuccessAt: 1,
          errorCode: null,
          status: "refreshing",
        },
      },
      11,
      new Set(),
    ),
  ).toBeNull();
  expect(automaticRefreshKey("Alice", undefined, 11, used)).toBeNull();
});

test("totals require all contributing scores, preserving real zeros and ties", () => {
  expect(knownTotal([])).toBeNull();
  expect(knownTotal([10, null])).toBeNull();
  expect(knownTotal([0, 0])).toBe(0);
  expect(knownTotal([10, 20])).toBe(30);
  expect(
    scoreDifference(knownTotal([10, null]), knownTotal([5, 20])),
  ).toBeNull();
  expect(scoreDifference(knownTotal([0, 0]), knownTotal([0, 0]))).toBe(0);
});

test("paired chart tooltips distinguish missing data from a measured zero", () => {
  const html = renderToStaticMarkup(
    createElement(PairChartTooltip, {
      active: true,
      label: "Sample",
      names: ["Alice", "Bob"],
      formatter: (value) => `${value} XP`,
      payload: [
        { dataKey: "left", value: 0 },
        { dataKey: "right", value: null },
      ],
    }),
  );
  expect(html).toContain("0 XP");
  expect(html).toContain("Unavailable");
  expect(html).not.toContain("null XP");
});
