import { normalizeRsn } from "@rune-rating/domain";
import {
  achievementBindings,
  achievementSourceKeys,
  achievementVersion,
} from "@rune-rating/domain/achievements";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalMutation, query } from "./_generated/server";
import {
  achievementFreshness,
  allAchievementSourceKeys,
} from "./lib/achievementFreshness";
import {
  achievementCache,
  rebuildAchievementProgress,
} from "./lib/achievements";
import {
  achievementEvidenceFields,
  achievementSourceFreshnessValidator,
} from "./lib/achievementValidators";
import { snapshotStateKey } from "./lib/keys";
import { findPlayerByRsn, getOrCreatePlayer } from "./lib/players";

export const enroll = internalMutation({
  args: { rsn: v.string() },
  returns: v.null(),
  handler: async (ctx, { rsn }) => {
    const player = await getOrCreatePlayer(ctx, rsn, Date.now());
    const cache = await achievementCache(ctx, player._id);
    if (!cache)
      await ctx.db.insert("achievementProgress", {
        playerId: player._id,
        version: "",
        states: "",
        sources: "",
        fetchedAt: null,
        calculatedAt: 0,
      });
    await rebuildAchievementProgress(ctx, player._id);
    const profile = await ctx.db
      .query("snapshotStates")
      .withIndex("by_key", (q) =>
        q.eq("key", snapshotStateKey(player._id, "runeProfile", "quests")),
      )
      .unique();
    if (
      profile?.lastSuccessAt &&
      !["notConnected", "notFound"].includes(profile.status)
    )
      await ctx.scheduler.runAfter(0, api.runeProfile.refreshCollectionLog, {
        rsns: [player.displayRsn],
      });
    return null;
  },
});
export const rebuild = internalMutation({
  args: { playerId: v.id("players") },
  returns: v.null(),
  handler: async (ctx, { playerId }) => {
    await rebuildAchievementProgress(ctx, playerId);
    return null;
  },
});

// Provider calls stay in the existing rate-limited backend queue. Visiting or refreshing
// the atlas shares the same player cooldown and collection-detail job as comparison.
export const load = action({
  args: { rsn: v.string() },
  returns: v.null(),
  handler: async (ctx, { rsn }) => {
    const normalized = normalizeRsn(rsn);
    await ctx.runMutation(internal.achievements.enroll, { rsn: normalized });
    await ctx.runMutation(api.refresh.request, { rsns: [normalized] });
    return null;
  },
});
const availability = v.union(
  v.literal("ready"),
  v.literal("pending"),
  v.literal("requiresRuneProfile"),
  v.literal("failed"),
);
export const progress = query({
  args: { rsn: v.string() },
  returns: v.object({
    availability,
    version: v.string(),
    states: v.string(),
    displayRsn: v.string(),
    fetchedAt: v.union(v.number(), v.null()),
    refreshing: v.boolean(),
    stale: v.boolean(),
    needsRebuild: v.boolean(),
    refreshAllowedAt: v.number(),
  }),
  handler: async (ctx, { rsn }) => {
    const normalized = normalizeRsn(rsn);
    const player = await findPlayerByRsn(ctx, normalized);
    const empty = {
      availability: "pending" as const,
      version: achievementVersion,
      states: "",
      displayRsn: normalized,
      fetchedAt: null,
      refreshing: false,
      stale: false,
      needsRebuild: true,
      refreshAllowedAt: 0,
    };
    if (!player) return empty;
    const state = await ctx.db
      .query("snapshotStates")
      .withIndex("by_key", (q) =>
        q.eq("key", snapshotStateKey(player._id, "runeProfile", "quests")),
      )
      .unique();
    const cache = await achievementCache(ctx, player._id);
    const sources = await achievementFreshness(
      ctx,
      player._id,
      player.displayRsn,
      allAchievementSourceKeys,
    );
    const refreshing = sources.some((source) => source.status === "refreshing");
    const unavailable =
      state?.status === "notConnected" || state?.status === "notFound";
    const ready =
      !!state?.lastSuccessAt &&
      cache?.version === achievementVersion &&
      cache.states.length === achievementBindings.length;
    let availability: "requiresRuneProfile" | "ready" | "failed" | "pending" =
      "pending";
    if (unavailable) availability = "requiresRuneProfile";
    else if (ready) availability = "ready";
    else if (state?.status === "failed" || state?.status === "rateLimited")
      availability = "failed";
    return {
      availability,
      version: achievementVersion,
      states: !unavailable && ready ? cache.states : "",
      displayRsn: player.displayRsn,
      fetchedAt: ready ? cache.fetchedAt : null,
      refreshing,
      stale: ready && sources.some((source) => source.status !== "fresh"),
      needsRebuild:
        cache?.version !== achievementVersion ||
        cache.states.length !== achievementBindings.length,
      refreshAllowedAt: player.refreshAllowedAt,
    };
  },
});
export const detail = query({
  args: { rsn: v.string(), nodeId: v.string() },
  returns: v.union(
    v.object({
      ...achievementEvidenceFields,
      sourceFreshness: v.array(achievementSourceFreshnessValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, { rsn, nodeId }) => {
    const index = achievementBindings.findIndex((n) => n.id === nodeId);
    if (index < 0) return null;
    const player = await findPlayerByRsn(ctx, rsn);
    if (!player) return null;
    const state = await ctx.db
      .query("snapshotStates")
      .withIndex("by_key", (q) =>
        q.eq("key", snapshotStateKey(player._id, "runeProfile", "quests")),
      )
      .unique();
    if (
      !state?.lastSuccessAt ||
      ["notConnected", "notFound"].includes(state.status)
    )
      return null;
    const evidence = await ctx.db
      .query("achievementEvidence")
      .withIndex("by_playerId_and_chunk", (q) =>
        q.eq("playerId", player._id).eq("chunk", Math.floor(index / 32)),
      )
      .unique();
    const result =
      evidence?.version === achievementVersion
        ? evidence.rows[index % 32]
        : null;
    if (!result) return null;
    const sourceFreshness = await achievementFreshness(
      ctx,
      player._id,
      player.displayRsn,
      achievementSourceKeys(nodeId),
    );
    return { ...result, sourceFreshness };
  },
});
