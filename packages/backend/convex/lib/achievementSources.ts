import type { CanonicalActivity, CanonicalSkill } from "@rune-rating/domain";
import type { AchievementSourceKey } from "@rune-rating/domain/achievements";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { contentHash } from "./contentHash";
import { categorySnapshotKey } from "./keys";

export const achievementSourceDefinitions = {
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
  achievementSourceDefinitions,
) as AchievementSourceKey[];
export type AchievementSource = { fetchedAt: number; contentHash: string };
export type AchievementSources = Partial<
  Record<AchievementSourceKey, AchievementSource | null>
>;

export async function updateAchievementSources(
  ctx: MutationCtx,
  playerId: Id<"players">,
  updates: Array<{
    key: AchievementSourceKey;
    fetchedAt: number;
    content: unknown;
  }>,
) {
  const existing = await ctx.db
    .query("achievementSources")
    .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
    .unique();
  const sources = { ...existing?.sources };
  for (const update of updates) {
    sources[update.key] = {
      fetchedAt: update.fetchedAt,
      contentHash: await contentHash(update.content),
    };
  }
  if (existing) await ctx.db.patch(existing._id, { sources });
  else await ctx.db.insert("achievementSources", { playerId, sources });
}

export async function readAchievementSources(
  ctx: QueryCtx,
  playerId: Id<"players">,
  keys = allAchievementSourceKeys,
  options: { timestampsOnly?: boolean } = {},
): Promise<AchievementSources> {
  // For a small detail query, existing summary rows are smaller and have fewer
  // invalidations than the shared metadata record. Never load skill/activity
  // arrays just to read a timestamp.
  const useSmallSummaries =
    options.timestampsOnly &&
    keys.length <= 2 &&
    keys.every((key) =>
      ["quests", "diaries", "collectionSummary", "collectionDetail"].includes(
        key,
      ),
    );
  const metadata = useSmallSummaries
    ? null
    : await ctx.db
        .query("achievementSources")
        .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
        .unique();
  const entries = await Promise.all(
    keys.map(async (key) => {
      if (metadata?.sources[key]) return [key, metadata.sources[key]] as const;
      // Old players and not-yet-refreshed categories retain the live correctness path.
      const definition = achievementSourceDefinitions[key];
      const snapshot = await ctx.db
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
        .unique();
      return [
        key,
        snapshot
          ? {
              fetchedAt: snapshot.fetchedAt,
              contentHash: `legacy:${snapshot.fetchedAt}`,
            }
          : null,
      ] as const;
    }),
  );
  return Object.fromEntries(entries);
}

// Ranking positions can move while the player's achievement facts stay identical.
export function achievementHiscoresContent(
  data:
    | { type: "skills"; values: CanonicalSkill[] }
    | { type: "activities"; values: CanonicalActivity[] },
) {
  if (data.type === "skills")
    return data.values.map((skill) => ({
      key: skill.key,
      name: skill.name,
      level: skill.level.value,
      xp: skill.xp.value,
    }));
  return data.values.map((activity) => ({
    key: activity.key,
    name: activity.name,
    category: activity.category,
    score: activity.rank.value === null ? null : activity.score.value,
  }));
}
