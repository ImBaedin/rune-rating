import { achievementFacts } from "@rune-rating/domain/achievement-facts";
import {
  achievementBindings,
  achievementVersion,
  evaluateAchievements,
} from "@rune-rating/domain/achievements";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { categorySnapshotKey, snapshotStateKey } from "./keys";

export const achievementCache = (ctx: QueryCtx, playerId: Id<"players">) =>
  ctx.db
    .query("achievementProgress")
    .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
    .unique();
export async function queueAchievementUpdate(
  ctx: MutationCtx,
  playerId: Id<"players">,
  collection = false,
) {
  if (!(await achievementCache(ctx, playerId))) return;
  await ctx.scheduler.runAfter(0, internal.achievements.rebuild, { playerId });
  if (collection) {
    const player = await ctx.db.get(playerId);
    if (player)
      await ctx.scheduler.runAfter(0, api.runeProfile.refreshCollectionLog, {
        rsns: [player.displayRsn],
      });
  }
}
export async function rebuildAchievementProgress(
  ctx: MutationCtx,
  playerId: Id<"players">,
) {
  const cache = await achievementCache(ctx, playerId);
  if (!cache) return;
  const get = (
    category:
      | "skills"
      | "activities"
      | "quests"
      | "diaries"
      | "combatAchievements"
      | "collection",
    segment = "all",
  ) =>
    ctx.db
      .query("categorySnapshots")
      .withIndex("by_key", (q) =>
        q.eq("key", categorySnapshotKey(playerId, category, segment)),
      )
      .unique();
  const [
    skills,
    activities,
    quests,
    diaries,
    combat,
    collection,
    detail,
    combatState,
  ] = await Promise.all([
    get("skills"),
    get("activities"),
    get("quests"),
    get("diaries"),
    get("combatAchievements"),
    get("collection", "summary"),
    get("collection", "detail"),
    ctx.db
      .query("snapshotStates")
      .withIndex("by_key", (q) =>
        q.eq(
          "key",
          snapshotStateKey(playerId, "runeProfile", "combatAchievements"),
        ),
      )
      .unique(),
  ]);
  const snapshots = [
    skills,
    activities,
    quests,
    diaries,
    combat,
    collection,
    detail,
  ];
  const sources = JSON.stringify([
    snapshots.map((s) => s?.fetchedAt ?? null),
    combatState?.errorCode ?? null,
  ]);
  if (
    cache.version === achievementVersion &&
    cache.states.length === achievementBindings.length &&
    cache.sources === sources
  )
    return;
  const categories = [
    "quests",
    "diaries",
    "combatAchievements",
    "collection",
  ] as const;
  const rows = await Promise.all(
    categories.map((category) =>
      ctx.db
        .query("canonicalItems")
        .withIndex("by_player_and_category", (q) =>
          q.eq("playerId", playerId).eq("category", category),
        )
        .take(6000),
    ),
  );
  if (rows.some((items) => items.length === 6000))
    throw Error("Achievement category exceeds the supported snapshot size");
  const pageSnapshots = detail
    ? await ctx.db
        .query("categorySnapshots")
        .withIndex("by_player_and_category", (q) =>
          q.eq("playerId", playerId).eq("category", "collection"),
        )
        .take(500)
    : [];
  if (pageSnapshots.length === 500)
    throw Error("Collection catalog exceeds the supported snapshot size");
  const facts = achievementFacts({
    skills: skills?.data.type === "skills" ? skills.data.values : [],
    activities:
      activities?.data.type === "activities" ? activities.data.values : [],
    quests: rows[0] ?? [],
    diaries: rows[1] ?? [],
    tasks: rows[2] ?? [],
    items: rows[3] ?? [],
    collectionComplete: !!detail,
    tasksComplete:
      !!combat &&
      combatState?.errorCode !== "granularInvalid" &&
      combatState?.errorCode !== "invalidResponse",
    questPoints:
      quests?.data.type === "quests" ? quests.data.earnedPoints : null,
    collectionTotal:
      collection?.data.type === "collection" ? collection.data.total : null,
    combatTier:
      combat?.data.type === "combatAchievements"
        ? (combat.data.tierReached ?? "none")
        : null,
    pages: pageSnapshots.flatMap((s) =>
      s.segment.startsWith("page:") && s.data.type === "collection"
        ? [
            {
              name: s.segment.split(":").slice(2).join(":"),
              obtained: s.data.obtained,
              total: s.data.total,
            },
          ]
        : [],
    ),
  });
  const result = evaluateAchievements(facts);
  const fetchedAt = Math.min(
    ...snapshots.flatMap((s) => (s ? [s.fetchedAt] : [])),
  );
  await ctx.db.patch(cache._id, {
    version: result.version,
    states: result.states,
    sources,
    fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : null,
    calculatedAt: Date.now(),
  });
  // Bounded chunks keep selected-node reads small without 973 writes per refresh.
  const previous = await ctx.db
    .query("achievementEvidence")
    .withIndex("by_playerId_and_chunk", (q) => q.eq("playerId", playerId))
    .take(100);
  if (previous.length === 100)
    throw Error("Achievement evidence exceeds the supported catalog size");
  const remaining = new Map(previous.map((row) => [row.chunk, row]));
  for (let offset = 0; offset < result.progress.length; offset += 32) {
    const chunk = offset / 32;
    const value = {
      playerId,
      chunk,
      version: result.version,
      rows: result.progress.slice(offset, offset + 32),
    };
    const existing = remaining.get(chunk);
    remaining.delete(chunk);
    if (!existing) await ctx.db.insert("achievementEvidence", value);
    else if (
      existing.version !== value.version ||
      JSON.stringify(existing.rows) !== JSON.stringify(value.rows)
    )
      await ctx.db.replace(existing._id, value);
  }
  for (const obsolete of remaining.values()) await ctx.db.delete(obsolete._id);
}
