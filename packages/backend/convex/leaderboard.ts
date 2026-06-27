import { rsnLookupKey } from "@rune-rating/domain";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import type { Doc } from "./_generated/dataModel.js";
import {
  internalMutation,
  type MutationCtx,
  query,
} from "./_generated/server.js";
import { syncPlayerRating } from "./lib/playerRatings";
import { ratingFormulaVersionKey } from "./lib/ratingCalculation";
import {
  clearRatingDistributions,
  getRatingDistribution,
  getRatingDistributionTotal,
  publishRatingDistributionDraft,
  rankFromDistribution,
} from "./lib/ratingDistributions";

const leaderboardEntryValidator = v.object({
  _id: v.id("playerRatings"),
  playerId: v.id("players"),
  normalizedRsn: v.string(),
  displayRsn: v.string(),
  score: v.number(),
  leaderboardRank: v.union(v.number(), v.null()),
  leaderboardRankedCount: v.number(),
  leaderboardTopPercent: v.union(v.number(), v.null()),
  leaderboardLabel: v.string(),
  tier: v.union(
    v.literal("Bronze"),
    v.literal("Iron"),
    v.literal("Steel"),
    v.literal("Black"),
    v.literal("Mithril"),
    v.literal("Adamant"),
    v.literal("Rune"),
    v.literal("Dragon"),
  ),
  tierIndex: v.number(),
  tierProgress: v.number(),
  formulaVersion: v.string(),
  formulaVersionKey: v.string(),
  accountTypeKey: v.string(),
  accountType: v.string(),
  accountBuild: v.string(),
  groupName: v.union(v.string(), v.null()),
  combatLevel: v.number(),
  totalLevel: v.number(),
  totalXp: v.number(),
  maxedSkills: v.number(),
  questPoints: v.number(),
  totalQuestPoints: v.number(),
  collectionObtained: v.number(),
  collectionTotal: v.number(),
  ehp: v.number(),
  ehb: v.number(),
  adjustedEhp: v.union(v.number(), v.null()),
  adjustedEhb: v.union(v.number(), v.null()),
  efficiencyRateType: v.union(v.literal("ironman"), v.null()),
  fetchedAt: v.number(),
  calculatedAt: v.number(),
  refreshAllowedAt: v.number(),
});

const leaderboardPageValidator = v.object({
  page: v.array(leaderboardEntryValidator),
  isDone: v.boolean(),
  continueCursor: v.string(),
});

const totalProfilesValidator = v.object({
  totalProfiles: v.number(),
});

const backfillResultValidator = v.object({
  processed: v.number(),
  ready: v.number(),
  removed: v.number(),
  skipped: v.number(),
  isDone: v.boolean(),
  continueCursor: v.string(),
});

const backfillAllResultValidator = v.object({
  processed: v.number(),
  ready: v.number(),
  removed: v.number(),
  skipped: v.number(),
  isDone: v.boolean(),
  continueCursor: v.string(),
  scheduledNext: v.boolean(),
  nextDelayMs: v.number(),
});

function pageSize(size: number, max = 100) {
  if (!Number.isFinite(size)) return 25;
  return Math.min(max, Math.max(1, Math.floor(size)));
}

function delayMs(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return 1_000;
  return Math.min(60_000, Math.max(0, Math.floor(value)));
}

async function backfillRatingPage(
  ctx: MutationCtx,
  args: {
    cursor: string | null;
    limit?: number;
    forceDistributionInsert?: boolean;
    distributionFormulaVersionKey?: string;
  },
) {
  const result = await ctx.db
    .query("players")
    .paginate({ cursor: args.cursor, numItems: pageSize(args.limit ?? 50) });

  let ready = 0;
  let removed = 0;
  let skipped = 0;
  for (const player of result.page) {
    const status = await syncPlayerRating(ctx, player._id, Date.now(), {
      forceDistributionInsert: args.forceDistributionInsert,
      distributionFormulaVersionKey: args.distributionFormulaVersionKey,
    });
    if (status.status === "ready") ready += 1;
    else if (status.status === "deleted") removed += 1;
    else skipped += 1;
  }

  return {
    processed: result.page.length,
    ready,
    removed,
    skipped,
    isDone: result.isDone,
    continueCursor: result.continueCursor,
  };
}

function entryView(
  entry: Doc<"playerRatings">,
  distribution: Doc<"ratingDistributions"> | null,
) {
  const rank = rankFromDistribution(distribution, entry.score, true);
  return {
    _id: entry._id,
    playerId: entry.playerId,
    normalizedRsn: entry.normalizedRsn,
    displayRsn: entry.displayRsn,
    score: entry.score,
    leaderboardRank: rank.rank,
    leaderboardRankedCount: rank.rankedCount,
    leaderboardTopPercent: rank.topPercent,
    leaderboardLabel: rank.label,
    tier: entry.tier,
    tierIndex: entry.tierIndex,
    tierProgress: entry.tierProgress,
    formulaVersion: entry.formulaVersion,
    formulaVersionKey: entry.formulaVersionKey,
    accountTypeKey: entry.accountTypeKey,
    accountType: entry.accountType,
    accountBuild: entry.accountBuild,
    groupName: entry.groupName,
    combatLevel: entry.combatLevel,
    totalLevel: entry.totalLevel,
    totalXp: entry.totalXp,
    maxedSkills: entry.maxedSkills,
    questPoints: entry.questPoints,
    totalQuestPoints: entry.totalQuestPoints,
    collectionObtained: entry.collectionObtained,
    collectionTotal: entry.collectionTotal,
    ehp: entry.ehp,
    ehb: entry.ehb,
    adjustedEhp: entry.adjustedEhp,
    adjustedEhb: entry.adjustedEhb,
    efficiencyRateType: entry.efficiencyRateType,
    fetchedAt: entry.fetchedAt,
    calculatedAt: entry.calculatedAt,
    refreshAllowedAt: entry.refreshAllowedAt,
  };
}

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    accountTypeKey: v.optional(v.string()),
  },
  returns: leaderboardPageValidator,
  handler: async (ctx, args) => {
    const paginationOpts = {
      ...args.paginationOpts,
      numItems: pageSize(args.paginationOpts.numItems),
    };
    const { accountTypeKey } = args;
    const result =
      accountTypeKey === undefined
        ? await ctx.db
            .query("playerRatings")
            .withIndex("by_score")
            .order("desc")
            .paginate(paginationOpts)
        : await ctx.db
            .query("playerRatings")
            .withIndex("by_account_type_key_and_score", (index) =>
              index.eq("accountTypeKey", accountTypeKey),
            )
            .order("desc")
            .paginate(paginationOpts);

    const firstEntry = result.page[0];
    const distribution =
      firstEntry === undefined
        ? null
        : await getRatingDistribution(
            ctx,
            firstEntry,
            accountTypeKey === undefined ? "global" : "accountType",
          );

    return {
      page: result.page.map((entry) => entryView(entry, distribution)),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const totalProfiles = query({
  args: {
    accountTypeKey: v.optional(v.string()),
  },
  returns: totalProfilesValidator,
  handler: async (ctx, args) => {
    const totalProfiles = await getRatingDistributionTotal(ctx, {
      formulaVersionKey: ratingFormulaVersionKey,
      scope: args.accountTypeKey === undefined ? "global" : "accountType",
      scopeKey: args.accountTypeKey,
    });
    return { totalProfiles };
  },
});

export const getByRsn = query({
  args: { rsn: v.string() },
  returns: v.union(leaderboardEntryValidator, v.null()),
  handler: async (ctx, args) => {
    const normalizedRsn = rsnLookupKey(args.rsn);
    const entry = await ctx.db
      .query("playerRatings")
      .withIndex("by_normalized_rsn", (index) =>
        index.eq("normalizedRsn", normalizedRsn),
      )
      .unique();
    if (!entry) return null;
    const distribution = await getRatingDistribution(ctx, entry, "global");
    return entryView(entry, distribution);
  },
});

export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    accountTypeKey: v.optional(v.string()),
    accountBuild: v.optional(v.string()),
  },
  returns: v.array(leaderboardEntryValidator),
  handler: async (ctx, args) => {
    const queryText = rsnLookupKey(args.query);
    if (queryText.length === 0) return [];

    const limit = pageSize(args.limit ?? 20, 50);
    const { accountBuild, accountTypeKey } = args;
    const entries =
      accountTypeKey !== undefined
        ? await ctx.db
            .query("playerRatings")
            .withSearchIndex("search_search_text", (search) =>
              search
                .search("searchText", queryText)
                .eq("accountTypeKey", accountTypeKey),
            )
            .take(limit)
        : accountBuild !== undefined
          ? await ctx.db
              .query("playerRatings")
              .withSearchIndex("search_search_text", (search) =>
                search
                  .search("searchText", queryText)
                  .eq("accountBuild", accountBuild),
              )
              .take(limit)
          : await ctx.db
              .query("playerRatings")
              .withSearchIndex("search_search_text", (search) =>
                search.search("searchText", queryText),
              )
              .take(limit);

    const firstEntry = entries[0];
    const distribution =
      firstEntry === undefined
        ? null
        : await getRatingDistribution(
            ctx,
            firstEntry,
            accountTypeKey === undefined ? "global" : "accountType",
          );

    return entries
      .sort((left, right) => right.score - left.score)
      .map((entry) => entryView(entry, distribution));
  },
});

export const recomputeForPlayer = internalMutation({
  args: { playerId: v.id("players") },
  returns: v.object({
    status: v.union(
      v.literal("ready"),
      v.literal("deleted"),
      v.literal("missing"),
      v.literal("refreshing"),
      v.literal("unavailable"),
    ),
    score: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const result = await syncPlayerRating(ctx, args.playerId);
    return {
      status: result.status,
      score: result.status === "ready" ? result.score : null,
    };
  },
});

export const backfillCurrentRatings = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  returns: backfillResultValidator,
  handler: async (ctx, args) => {
    return await backfillRatingPage(ctx, args);
  },
});

export const backfillAllCurrentRatings = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
    delayMs: v.optional(v.number()),
    resetDistributions: v.optional(v.boolean()),
    rebuildFormulaVersionKey: v.optional(v.string()),
  },
  returns: backfillAllResultValidator,
  handler: async (ctx, args) => {
    const shouldReset =
      (args.cursor === undefined || args.cursor === null) &&
      args.resetDistributions !== false;
    const isRebuildingDistributions =
      shouldReset || args.rebuildFormulaVersionKey !== undefined;
    const rebuildFormulaVersionKey = isRebuildingDistributions
      ? (args.rebuildFormulaVersionKey ??
        `${ratingFormulaVersionKey}:rebuild:${Date.now()}`)
      : undefined;
    if (shouldReset && rebuildFormulaVersionKey !== undefined) {
      await clearRatingDistributions(ctx, rebuildFormulaVersionKey);
    }

    const batchLimit = pageSize(args.limit ?? 10, 25);
    const nextDelayMs = delayMs(args.delayMs);
    const result = await backfillRatingPage(ctx, {
      cursor: args.cursor ?? null,
      limit: batchLimit,
      forceDistributionInsert: isRebuildingDistributions,
      distributionFormulaVersionKey: rebuildFormulaVersionKey,
    });

    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        nextDelayMs,
        internal.leaderboard.backfillAllCurrentRatings,
        {
          cursor: result.continueCursor,
          limit: batchLimit,
          delayMs: nextDelayMs,
          resetDistributions: false,
          rebuildFormulaVersionKey,
        },
      );
    } else if (rebuildFormulaVersionKey !== undefined) {
      await publishRatingDistributionDraft(ctx, {
        draftFormulaVersionKey: rebuildFormulaVersionKey,
        liveFormulaVersionKey: ratingFormulaVersionKey,
      });
    }

    return {
      ...result,
      scheduledNext: !result.isDone,
      nextDelayMs,
    };
  },
});
