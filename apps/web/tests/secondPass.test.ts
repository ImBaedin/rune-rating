import { describe, expect, test } from "bun:test";
import { clueRankTarget } from "../src/features/comparison/clueTargets";
import type { PlayerProfile } from "../src/features/comparison/context";
import { buildSmoothedDailyGainTimeline } from "../src/features/comparison/efficiencyTimeline";
import {
  comparisonPath,
  viewFromPathname,
} from "../src/features/comparison/navigation";
import {
  questCompletionDiffers,
  questPointCompletions,
} from "../src/features/comparison/questCompletion";
import {
  nextSnapshotCheckAt,
  snapshotRefreshKey,
} from "../src/features/comparison/sourceState";
import { summarizeLeader } from "../src/features/og/data";
import { compareHead } from "../src/features/og/meta";

test("advertised comparison URLs round-trip names containing spaces", () => {
  const names: [string, string] = ["GIM Wamuu", "Starmie Iron"];
  const meta = compareHead(...names).meta.find(
    (entry) => "property" in entry && entry.property === "og:url",
  );
  expect(
    meta && "content" in meta && meta.content
      ? new URL(meta.content).pathname
      : null,
  ).toBe(comparisonPath("overview", names));
});

test("RSNs matching route names stay on overview; actual child routes still match", () => {
  for (const rsn of [
    "skills",
    "quests",
    "activity",
    "collections",
    "constructor",
  ]) {
    expect(viewFromPathname(comparisonPath("overview", ["Alice", rsn]))).toBe(
      "overview",
    );
    expect(viewFromPathname(comparisonPath("skills", ["Alice", rsn]))).toBe(
      "skills",
    );
  }
  expect(viewFromPathname("/compare/Alice/Bob/toString")).toBe("overview");
  expect(viewFromPathname("/compare/Alice/Bob/xp-timeline/")).toBe("timeline");
});

describe("quest data availability", () => {
  test("only two known completion states can establish a difference", () => {
    for (const unknown of [null, { completed: null }]) {
      expect(questCompletionDiffers({ completed: true }, unknown)).toBe(false);
      expect(questCompletionDiffers(unknown, { completed: false })).toBe(false);
    }
    expect(
      questCompletionDiffers({ completed: true }, { completed: false }),
    ).toBe(true);
    expect(
      questCompletionDiffers({ completed: false }, { completed: true }),
    ).toBe(true);
    expect(
      questCompletionDiffers({ completed: true }, { completed: true }),
    ).toBe(false);
  });
  test("point-band totals distinguish missing data, real zero, and unknown points", () => {
    expect(questPointCompletions(undefined, "5")).toBeNull();
    expect(questPointCompletions([{ completed: false, points: 5 }], "5")).toBe(
      0,
    );
    expect(questPointCompletions([{ completed: true, points: 6 }], "5")).toBe(
      1,
    );
    expect(
      questPointCompletions([{ completed: true, points: null }], "0"),
    ).toBeNull();
    expect(
      questPointCompletions([{ completed: null, points: 5 }], "5"),
    ).toBeNull();
  });
});

test("steady efficiency gains keep the same daily rate across short and long ranges", () => {
  const dayMs = 86_400_000;
  for (const days of [1, 7, 14, 30]) {
    const points = Array.from({ length: days + 1 }, (_, index) => ({
      date: index * dayMs,
      value: 100 + index * 14,
    }));
    expect(
      buildSmoothedDailyGainTimeline(points).map((point) => point.value),
    ).toEqual(Array(days).fill(14));
  }
  expect(buildSmoothedDailyGainTimeline([])).toEqual([]);
  expect(buildSmoothedDailyGainTimeline([{ date: 0, value: 100 }])).toEqual([]);
  expect(
    buildSmoothedDailyGainTimeline([
      { date: 0, value: 100 },
      { date: dayMs, value: 90 },
    ])[0]?.value,
  ).toBe(0);
});

test("refresh timing uses current eligibility when changing profiles or rearming timers", () => {
  const minute = 60_000;
  const profile: NonNullable<PlayerProfile> = {
    normalizedRsn: "alice",
    displayRsn: "Alice",
    refreshAllowedAt: 30 * minute,
    lastSnapshotAt: 1,
    snapshotStaleAt: 30 * minute,
    skillsState: {
      status: "fresh",
      lastAttemptAt: 1,
      lastSuccessAt: 1,
      errorCode: null,
    },
    activitiesState: null,
    efficiencyState: null,
    questsState: null,
    diariesState: null,
    combatAchievementsState: null,
    collectionState: null,
  };
  expect(nextSnapshotCheckAt([profile], 20 * minute)).toBe(30 * minute);
  expect(nextSnapshotCheckAt([profile], 40 * minute)).toBeNull();
  expect(snapshotRefreshKey("Alice", profile, 40 * minute)).toBe("alice:1");
  const coolingDown = { ...profile, refreshAllowedAt: 50 * minute };
  expect(nextSnapshotCheckAt([coolingDown], 40 * minute)).toBe(50 * minute);
  expect(snapshotRefreshKey("Alice", coolingDown, 40 * minute)).toBeNull();
  expect(nextSnapshotCheckAt([undefined, profile], 20 * minute)).toBeNull();
  expect(
    nextSnapshotCheckAt(
      [
        {
          ...profile,
          skillsState: {
            lastAttemptAt: 1,
            lastSuccessAt: 1,
            errorCode: null,
            status: "scheduled",
          },
        },
      ],
      20 * minute,
    ),
  ).toBeNull();
});

test("clue targets require a known rank outside the inclusive target", () => {
  expect(clueRankTarget(null, 5_000)).toBeNull();
  expect(clueRankTarget(3_000, 5_000)).toBeNull();
  expect(clueRankTarget(5_000, 5_000)).toBeNull();
  expect(clueRankTarget(5_001, 5_000)).toEqual({
    currentRank: 5_001,
    threshold: 5_000,
    toPass: 1,
  });
  expect(clueRankTarget(28_856, 5_000)?.toPass).toBe(23_856);
});

test("OG comparison distinguishes known ties from entirely unknown metrics", () => {
  expect(summarizeLeader([])).toBe("unknown");
  expect(summarizeLeader([{ leader: "unknown" }])).toBe("unknown");
  expect(summarizeLeader([{ leader: "tie" }, { leader: "unknown" }])).toBe(
    "tie",
  );
  expect(summarizeLeader([{ leader: "left" }, { leader: "right" }])).toBe(
    "tie",
  );
  expect(summarizeLeader([{ leader: "left" }, { leader: "tie" }])).toBe("left");
  expect(
    summarizeLeader([
      { leader: "right" },
      { leader: "right" },
      { leader: "left" },
    ]),
  ).toBe("right");
});
