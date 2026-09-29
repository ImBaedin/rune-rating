import type {
  AchievementSourceFreshness,
  AchievementSourceKey,
} from "@rune-rating/domain/achievements";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { QueryCtx } from "../../../convex/_generated/server";
import { getRefreshCooldownMs } from "../../../convex/lib/config";
import {
  categorySnapshotKey,
  snapshotStateKey,
} from "../../../convex/lib/keys";
import {
  collectionDetailDedupeKey,
  queueViewStatus,
} from "../../../convex/providerQueueViews";

const definitions = {
  skills: {
    source: "hiscores",
    category: "skills",
    segment: "all",
    label: "Skill levels",
  },
  activities: {
    source: "hiscores",
    category: "activities",
    segment: "all",
    label: "Activity and boss scores",
  },
  quests: {
    source: "runeProfile",
    category: "quests",
    segment: "all",
    label: "Quest progress",
  },
  diaries: {
    source: "runeProfile",
    category: "diaries",
    segment: "all",
    label: "Achievement diaries",
  },
  combatAchievements: {
    source: "runeProfile",
    category: "combatAchievements",
    segment: "all",
    label: "Combat achievements",
  },
  collectionSummary: {
    source: "runeProfile",
    category: "collection",
    segment: "summary",
    label: "Collection catalog total",
  },
  collectionDetail: {
    source: "runeProfile",
    category: "collection",
    segment: "detail",
    label: "Collection log items",
  },
} as const;
export const allAchievementSourceKeys = Object.keys(
  definitions,
) as AchievementSourceKey[];

export async function achievementFreshness(
  ctx: QueryCtx,
  playerId: Id<"players">,
  rsn: string,
  keys: AchievementSourceKey[],
  knownStates: Partial<
    Record<AchievementSourceKey, Doc<"snapshotStates"> | null>
  > = {},
): Promise<AchievementSourceFreshness[]> {
  const now = Date.now();
  const cooldownMs = await getRefreshCooldownMs(ctx);
  return await Promise.all(
    keys.map(async (key): Promise<AchievementSourceFreshness> => {
      const definition = definitions[key];
      const [snapshot, state, job] = await Promise.all([
        ctx.db
          .query("categorySnapshots")
          .withIndex("by_key", (q) =>
            q.eq(
              "key",
              categorySnapshotKey(
                playerId,
                definition.category,
                definition.segment,
              ),
            ),
          )
          .unique(),
        key === "collectionDetail"
          ? null
          : key in knownStates
            ? knownStates[key]
            : ctx.db
                .query("snapshotStates")
                .withIndex("by_key", (q) =>
                  q.eq(
                    "key",
                    snapshotStateKey(
                      playerId,
                      definition.source,
                      definition.category,
                    ),
                  ),
                )
                .unique(),
        key === "collectionDetail"
          ? ctx.db
              .query("providerJobs")
              .withIndex("by_dedupe_key", (q) =>
                q.eq("dedupeKey", collectionDetailDedupeKey(rsn)),
              )
              .unique()
          : null,
      ]);
      const fetchedAt = snapshot?.fetchedAt ?? null;
      const staleAt = fetchedAt === null ? null : fetchedAt + cooldownMs;
      let status: AchievementSourceFreshness["status"] =
        fetchedAt === null
          ? "missing"
          : staleAt !== null && staleAt <= now
            ? "stale"
            : "fresh";
      let reason: string | null =
        status === "missing"
          ? "No saved data is available."
          : status === "stale"
            ? "The saved data is past the refresh interval."
            : null;
      if (key === "collectionDetail") {
        const queued = queueViewStatus(job, now);
        if (["queued", "running", "retrying"].includes(queued)) {
          status = "refreshing";
          reason = "Item-level collection data is queued or refreshing.";
        } else if (
          queued === "failed" &&
          job &&
          job.updatedAt >= (fetchedAt ?? 0)
        ) {
          status = "failed";
          reason = "The latest item-level collection refresh failed.";
        }
        // The summary timestamp/status cannot establish item-level freshness.
      } else if (
        state?.status === "scheduled" ||
        state?.status === "refreshing"
      ) {
        status = "refreshing";
        reason = "A refresh is queued or in progress.";
      } else if (
        state &&
        ["failed", "rateLimited", "notFound", "notConnected"].includes(
          state.status,
        )
      ) {
        status = "failed";
        reason =
          state.errorCode === "granularInvalid" ||
          state.errorCode === "invalidResponse"
            ? "The latest provider response could not be validated."
            : state.status === "rateLimited"
              ? "The provider has temporarily rate-limited refreshes."
              : state.status === "notFound" || state.status === "notConnected"
                ? "The provider could not find a public profile."
                : "The latest refresh failed.";
      }
      return {
        key,
        label: definition.label,
        provider: definition.source === "hiscores" ? "Hiscores" : "RuneProfile",
        status,
        fetchedAt,
        staleAt,
        reason,
      };
    }),
  );
}
