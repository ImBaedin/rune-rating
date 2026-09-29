import { expect, test } from "bun:test";
import { atlasRefreshKeys } from "../src/features/achievements/atlasFreshness";
import type { PlayerProfile } from "../src/features/comparison/context";
import { nextSnapshotCheckAt } from "../src/features/comparison/sourceState";

const state = {
  status: "fresh" as const,
  lastAttemptAt: 1,
  lastSuccessAt: 1,
  errorCode: null,
};
const profile: NonNullable<PlayerProfile> = {
  normalizedRsn: "alice",
  displayRsn: "Alice",
  lastSnapshotAt: 1,
  snapshotStaleAt: 10,
  refreshAllowedAt: 15,
  skillsState: state,
  activitiesState: state,
  efficiencyState: state,
  questsState: state,
  diariesState: state,
  combatAchievementsState: state,
  collectionState: state,
};
const progress = { version: "v1", needsRebuild: false };

test("first achievement visit waits for queries, then enrolls and refreshes once", () => {
  const missing = { ...progress, needsRebuild: true };
  const used = new Set<string>();
  expect(atlasRefreshKeys("Alice", undefined, missing, 1, used)).toEqual([]);
  expect(atlasRefreshKeys("Alice", null, undefined, 1, used)).toEqual([]);
  const keys = atlasRefreshKeys("Alice", null, missing, 1, used);
  expect(keys).toEqual(["alice:atlas:v1", "alice:initial"]);
  for (const key of keys) used.add(key);
  expect(atlasRefreshKeys("ALICE", null, missing, 1, used)).toEqual([]);
});

test("fresh progress is reused; stale progress waits for cooldown and refreshes once per snapshot", () => {
  const used = new Set<string>();
  expect(atlasRefreshKeys("Alice", profile, progress, 5, used)).toEqual([]);
  expect(atlasRefreshKeys("Alice", profile, progress, 10, used)).toEqual([]);
  expect(nextSnapshotCheckAt([profile], 5)).toBe(15);
  expect(atlasRefreshKeys("Alice", profile, progress, 15, used)).toEqual([
    "alice:1",
  ]);
  used.add("alice:1");
  expect(atlasRefreshKeys("Alice", profile, progress, 20, used)).toEqual([]);
  const updated = {
    ...profile,
    lastSnapshotAt: 20,
    snapshotStaleAt: 30,
    refreshAllowedAt: 35,
  };
  expect(nextSnapshotCheckAt([updated], 20)).toBe(35);
  expect(atlasRefreshKeys("Alice", updated, progress, 35, used)).toEqual([
    "alice:20",
  ]);
});

test("atlas revisions rebuild during cooldown and each new revision triggers a repair", () => {
  const used = new Set<string>();
  const outdated = { ...progress, needsRebuild: true };
  expect(atlasRefreshKeys("Alice", profile, outdated, 5, used)).toEqual([
    "alice:atlas:v1",
  ]);
  used.add("alice:atlas:v1");
  expect(atlasRefreshKeys("Alice", profile, outdated, 5, used)).toEqual([]);
  expect(
    atlasRefreshKeys("Alice", profile, { ...outdated, version: "v2" }, 5, used),
  ).toEqual(["alice:atlas:v2"]);
  expect(atlasRefreshKeys("Alice", profile, progress, 15, used)).toEqual([
    "alice:1",
  ]);
});

test("an active provider refresh prevents duplicate refreshes", () => {
  const active = {
    ...profile,
    skillsState: { ...state, status: "refreshing" as const },
  };
  expect(nextSnapshotCheckAt([active], 15)).toBeNull();
  expect(atlasRefreshKeys("Alice", active, progress, 15, new Set())).toEqual(
    [],
  );
});
