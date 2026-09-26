import { describe, expect, test } from "bun:test";
import { sanitizeAnalyticsEvent } from "../src/features/analyticsPrivacy";
import type { PlayerProfile } from "../src/features/comparison/context";
import {
  snapshotRefreshKey,
  sourceHealth,
} from "../src/features/comparison/sourceState";
import { leaderboardSearchInput } from "../src/features/leaderboardSearch";
import { compareTimelineValues } from "../src/features/timelineComparison";
import { leaderboardSearch, timelineSearch } from "../src/features/viewSearch";

const now = 10_000_000;
const fresh = {
  status: "fresh" as const,
  lastAttemptAt: now,
  lastSuccessAt: now,
  errorCode: null,
};
const emptyProfile: NonNullable<PlayerProfile> = {
  normalizedRsn: "example",
  displayRsn: "Example",
  refreshAllowedAt: 0,
  lastSnapshotAt: null,
  snapshotStaleAt: null,
  skillsState: null,
  activitiesState: null,
  efficiencyState: null,
  questsState: null,
  diariesState: null,
  combatAchievementsState: null,
  collectionState: null,
};
describe("comparison refresh lifecycle", () => {
  test("waits for the query, then requests missing and never-successful profiles", () => {
    expect(snapshotRefreshKey("Example", undefined, now)).toBeNull();
    expect(snapshotRefreshKey("Example", null, now)).toBe("example:initial");
    expect(snapshotRefreshKey("Example", emptyProfile, now)).toBe(
      "example:initial",
    );
  });
  test("does not bypass cooldown or duplicate active work", () => {
    expect(
      snapshotRefreshKey(
        "Example",
        { ...emptyProfile, refreshAllowedAt: now + 1 },
        now,
      ),
    ).toBeNull();
    for (const status of ["scheduled", "refreshing"] as const) {
      expect(
        snapshotRefreshKey(
          "Example",
          { ...emptyProfile, efficiencyState: { ...fresh, status } },
          now,
        ),
      ).toBeNull();
    }
  });
  test("requests expired snapshots and leaves current snapshots alone", () => {
    const profile = {
      ...emptyProfile,
      skillsState: fresh,
      lastSnapshotAt: now - 100,
      snapshotStaleAt: now + 1,
    };
    expect(snapshotRefreshKey("Example", profile, now)).toBeNull();
    expect(
      snapshotRefreshKey("Example", { ...profile, snapshotStaleAt: now }, now),
    ).toBe(`example:${now - 100}`);
  });
  test("reports both players' actual source health, including terminal errors", () => {
    expect(sourceHealth([fresh, fresh], now).status).toBe("live");
    expect(sourceHealth([fresh, null], now).detail).toBe("waiting");
    expect(
      sourceHealth([fresh, { ...fresh, status: "failed" }], now).status,
    ).toBe("off");
    expect(
      sourceHealth([fresh, { ...fresh, status: "notFound" }], now).detail,
    ).toBe("unavailable");
    expect(
      sourceHealth([fresh, { ...fresh, status: "rateLimited" }], now).detail,
    ).toBe("rate limited");
    expect(sourceHealth([fresh, fresh], now + 3_600_000).detail).toBe("stale");
  });
});

test("pageview and pageleave strip automatic URLs, titles, referrers and person fields", () => {
  for (const eventName of ["$pageview", "$pageleave", "comparison_submitted"]) {
    const event = sanitizeAnalyticsEvent({
      event: eventName,
      uuid: "test",
      properties: {
        page: "comparison",
        left_rsn_hash: "abcdef",
        distinct_id: "anonymous-uuid",
        $current_url: "https://example.com/compare/PrivateName/OtherName",
        $pathname: "/rating",
        title: "PrivateName rating",
        rsn: "PrivateName",
        $referrer: "https://example.com/rating?rsn=PrivateName",
        $initial_current_url: "https://example.com/rating?rsn=PrivateName",
        $set_once: { $initial_pathname: "/compare/PrivateName/OtherName" },
        arbitrary: "PrivateName",
      },
      $set: { name: "PrivateName" },
      $set_once: { name: "PrivateName" },
    });
    expect(event?.properties).toEqual({
      page: "comparison",
      left_rsn_hash: "abcdef",
      distinct_id: "anonymous-uuid",
    });
    expect(JSON.stringify(event)).not.toContain("PrivateName");
  }
});

test("timeline distinguishes unavailable, actual zero, ties and a winner", () => {
  expect(compareTimelineValues(null, 123)).toBeNull();
  expect(compareTimelineValues(123, undefined)).toBeNull();
  expect(compareTimelineValues(0, 0)).toEqual({
    delta: 0,
    maximum: 0,
    leader: null,
  });
  expect(compareTimelineValues(10, 10)?.leader).toBeNull();
  expect(compareTimelineValues(0, 100)).toEqual({
    delta: -100,
    maximum: 100,
    leader: "right",
  });
});

test("URL filters reject unsupported values", () => {
  expect(timelineSearch({ range: "7d" }).range).toBe("7d");
  expect(timelineSearch({ range: "forever" }).range).toBeUndefined();
  expect(leaderboardSearch({ account: "ironman" }).account).toBe("ironman");
  expect(leaderboardSearch({ account: "admin" }).account).toBeUndefined();
});

test("invalid live leaderboard input is not sent to the backend", () => {
  for (const input of ["this name is too long", "not.a.name"]) {
    const result = leaderboardSearchInput(input);
    expect(result.query).toBe("");
    expect(result.error).toBeTruthy();
  }
  expect(leaderboardSearchInput("  GIM_Wamuu ")).toEqual({
    query: "GIM Wamuu",
    error: null,
  });
  expect(leaderboardSearchInput("  ")).toEqual({ query: "", error: null });
});
