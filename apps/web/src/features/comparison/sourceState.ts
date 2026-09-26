import { rsnLookupKey } from "@rune-rating/domain";
import type { PlayerProfile } from "./context";

type SnapshotState = NonNullable<PlayerProfile>["skillsState"];

const profileRefreshStates = (profile: PlayerProfile | undefined) => [
  profile?.skillsState,
  profile?.activitiesState,
  profile?.efficiencyState,
  profile?.questsState,
  profile?.diariesState,
  profile?.combatAchievementsState,
  profile?.collectionState,
];

export const hasActiveRefresh = (profile: PlayerProfile | undefined) =>
  profileRefreshStates(profile).some(
    (state) => state?.status === "scheduled" || state?.status === "refreshing",
  );

export function nextSnapshotCheckAt(
  profiles: (PlayerProfile | undefined)[],
  now: number,
): number | null {
  if (profiles.some((profile) => profile === undefined)) return null;
  return profiles.reduce<number | null>((earliest, profile) => {
    if (!profile || hasActiveRefresh(profile)) return earliest;
    const eligibleAt = Math.max(
      profile.snapshotStaleAt ?? 0,
      profile.refreshAllowedAt,
    );
    // Already-eligible profiles are handled immediately by the refresh effect.
    if (eligibleAt <= now) return earliest;
    return earliest === null ? eligibleAt : Math.min(earliest, eligibleAt);
  }, null);
}

export function snapshotRefreshKey(
  rsn: string,
  profile: PlayerProfile | undefined,
  now: number,
): string | null {
  if (profile === undefined) return null;
  const key = rsnLookupKey(rsn);
  if (profile === null) return `${key}:initial`;
  if (profile.refreshAllowedAt > now || hasActiveRefresh(profile)) return null;
  if (
    profile.skillsState?.lastSuccessAt == null ||
    profile.lastSnapshotAt === null
  ) {
    return `${key}:initial`;
  }
  if (profile.snapshotStaleAt === null || profile.snapshotStaleAt > now)
    return null;
  return `${key}:${profile.lastSnapshotAt}`;
}

export function sourceHealth(
  states: (SnapshotState | undefined)[],
  now: number,
) {
  if (
    states.some(
      (state) =>
        state?.status === "scheduled" || state?.status === "refreshing",
    )
  ) {
    return { status: "delayed", detail: "refreshing" } as const;
  }
  if (states.some((state) => state?.status === "failed")) {
    return { status: "off", detail: "failed" } as const;
  }
  if (
    states.some(
      (state) =>
        state?.status === "notFound" || state?.status === "notConnected",
    )
  ) {
    return { status: "off", detail: "unavailable" } as const;
  }
  if (states.some((state) => state?.status === "rateLimited")) {
    return { status: "delayed", detail: "rate limited" } as const;
  }
  if (
    states.length === 0 ||
    states.some((state) => !state || state.lastSuccessAt === null)
  ) {
    return { status: "delayed", detail: "waiting" } as const;
  }
  if (
    states.every(
      (state) =>
        state?.status === "fresh" &&
        state.lastSuccessAt !== null &&
        now - state.lastSuccessAt < 3_600_000,
    )
  ) {
    return { status: "live", detail: "fresh" } as const;
  }
  return { status: "delayed", detail: "stale" } as const;
}

const invalidCombatRefreshKey = (
  rsn: string,
  profile: PlayerProfile | undefined,
) => {
  const state = profile?.combatAchievementsState;
  if (
    !profile ||
    !state ||
    state.status !== "failed" ||
    (state.errorCode !== "invalidResponse" &&
      state.errorCode !== "granularInvalid") ||
    hasActiveRefresh(profile)
  ) {
    return null;
  }

  return `${rsn.trim().toLocaleLowerCase()}:combat-invalid:${state.lastSuccessAt ?? "none"}`;
};

export function automaticRefreshKey(
  rsn: string,
  profile: PlayerProfile | undefined,
  now: number,
  usedKeys: ReadonlySet<string>,
): string | null {
  const repairKey = invalidCombatRefreshKey(rsn, profile);
  if (repairKey !== null && !usedKeys.has(repairKey)) return repairKey;
  const staleKey = snapshotRefreshKey(rsn, profile, now);
  return staleKey !== null && !usedKeys.has(staleKey) ? staleKey : null;
}
