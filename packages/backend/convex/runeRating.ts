import { v } from "convex/values";
import { query } from "./_generated/server.js";
import { findPlayerByRsn } from "./lib/players";
import {
  buildRuneRatingForPlayer,
  ratingFormulaVersionKey,
  type SourceState,
  tierNames,
} from "./lib/ratingCalculation";
import {
  getRatingDistribution,
  rankFromDistribution,
} from "./lib/ratingDistributions";
import { snapshotStatusValidator } from "./validators";

const sourceStateValidator = v.object({
  source: v.union(
    v.literal("hiscores"),
    v.literal("wiseOldMan"),
    v.literal("runeProfile"),
  ),
  label: v.string(),
  status: v.union(snapshotStatusValidator, v.null()),
  lastSuccessAt: v.union(v.number(), v.null()),
  errorCode: v.union(v.string(), v.null()),
});

const pillarValidator = v.object({
  key: v.string(),
  label: v.string(),
  score: v.number(),
  maxScore: v.number(),
  detail: v.string(),
});

const prestigeStatValidator = v.object({
  label: v.string(),
  value: v.string(),
  detail: v.string(),
});

const ratingCardValidator = v.object({
  normalizedRsn: v.string(),
  displayRsn: v.string(),
  score: v.number(),
  leaderboardRank: v.union(v.number(), v.null()),
  leaderboardRankedCount: v.number(),
  leaderboardTopPercent: v.union(v.number(), v.null()),
  tier: v.union(...tierNames.map((tier) => v.literal(tier))),
  tierIndex: v.number(),
  tierProgress: v.number(),
  percentileLabel: v.string(),
  formulaVersion: v.string(),
  fetchedAt: v.number(),
  refreshAllowedAt: v.number(),
  accountType: v.string(),
  accountBuild: v.string(),
  combatLevel: v.number(),
  totalLevel: v.number(),
  totalXp: v.number(),
  maxedSkills: v.number(),
  questPoints: v.number(),
  totalQuestPoints: v.number(),
  diaryCompleted: v.number(),
  diaryTotal: v.number(),
  combatAchievementTier: v.union(v.string(), v.null()),
  collectionObtained: v.number(),
  collectionTotal: v.number(),
  ehp: v.number(),
  ehb: v.number(),
  adjustedEhp: v.union(v.number(), v.null()),
  adjustedEhb: v.union(v.number(), v.null()),
  efficiencyRateType: v.union(v.literal("ironman"), v.null()),
  pillars: v.array(pillarValidator),
  prestigeStats: v.array(prestigeStatValidator),
  sources: v.array(sourceStateValidator),
});

const resultValidator = v.union(
  v.object({
    status: v.literal("notRequested"),
    message: v.string(),
  }),
  v.object({
    status: v.literal("refreshing"),
    displayRsn: v.string(),
    message: v.string(),
    sources: v.array(sourceStateValidator),
  }),
  v.object({
    status: v.literal("unavailable"),
    displayRsn: v.string(),
    message: v.string(),
    missingSources: v.array(v.string()),
    sources: v.array(sourceStateValidator),
  }),
  v.object({
    status: v.literal("ready"),
    card: ratingCardValidator,
  }),
);

export const get = query({
  args: { rsn: v.string() },
  returns: resultValidator,
  handler: async (ctx, args) => {
    const player = await findPlayerByRsn(ctx, args.rsn);
    if (!player) {
      return {
        status: "notRequested" as const,
        message: "Submit an RSN to generate a RuneRating card.",
      };
    }

    const result = await buildRuneRatingForPlayer(ctx, player);
    if (result.status !== "ready") return result;

    const cachedRating = await ctx.db
      .query("playerRatings")
      .withIndex("by_player", (index) => index.eq("playerId", player._id))
      .unique();
    const distribution = await getRatingDistribution(
      ctx,
      {
        score: result.card.score,
        formulaVersionKey: ratingFormulaVersionKey,
        accountTypeKey: cachedRating?.accountTypeKey ?? "unknown",
      },
      "global",
    );
    const rank = rankFromDistribution(
      distribution,
      result.card.score,
      cachedRating?.formulaVersionKey === ratingFormulaVersionKey &&
        cachedRating.score === result.card.score,
    );

    return {
      status: "ready" as const,
      card: {
        ...result.card,
        leaderboardRank: rank.rank,
        leaderboardRankedCount: rank.rankedCount,
        leaderboardTopPercent: rank.topPercent,
        percentileLabel: rank.label,
      },
    };
  },
});

export type RuneRatingSourceState = SourceState;
