import type { Doc, Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";
import {
  buildRuneRatingForPlayer,
  type RuneRatingCard,
  ratingFormulaVersionKey,
} from "./ratingCalculation";
import { updateRatingDistributions } from "./ratingDistributions";

function fallbackAccountTypeKey(accountType: string) {
  const key = accountType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return key || "unknown";
}

function ratingDocument(
  player: Doc<"players">,
  card: RuneRatingCard,
  calculatedAt: number,
) {
  const accountTypeKey =
    player.accountTypeKey ?? fallbackAccountTypeKey(card.accountType);
  return {
    playerId: player._id,
    normalizedRsn: card.normalizedRsn,
    displayRsn: card.displayRsn,
    searchText: `${card.displayRsn} ${card.normalizedRsn}`,
    score: card.score,
    tier: card.tier,
    tierIndex: card.tierIndex,
    tierProgress: card.tierProgress,
    percentileLabel: card.percentileLabel,
    formulaVersion: card.formulaVersion,
    formulaVersionKey: ratingFormulaVersionKey,
    accountTypeKey,
    accountType: card.accountType,
    accountBuild: card.accountBuild,
    groupName: player.groupName ?? null,
    combatLevel: card.combatLevel,
    totalLevel: card.totalLevel,
    totalXp: card.totalXp,
    maxedSkills: card.maxedSkills,
    questPoints: card.questPoints,
    totalQuestPoints: card.totalQuestPoints,
    collectionObtained: card.collectionObtained,
    collectionTotal: card.collectionTotal,
    ehp: card.ehp,
    ehb: card.ehb,
    adjustedEhp: card.adjustedEhp,
    adjustedEhb: card.adjustedEhb,
    efficiencyRateType: card.efficiencyRateType,
    fetchedAt: card.fetchedAt,
    calculatedAt,
    refreshAllowedAt: card.refreshAllowedAt,
  };
}

async function existingRating(ctx: MutationCtx, playerId: Id<"players">) {
  return await ctx.db
    .query("playerRatings")
    .withIndex("by_player", (index) => index.eq("playerId", playerId))
    .unique();
}

export async function deletePlayerRating(
  ctx: MutationCtx,
  playerId: Id<"players">,
) {
  const existing = await existingRating(ctx, playerId);
  if (!existing) return;
  await updateRatingDistributions(ctx, existing, null);
  await ctx.db.delete(existing._id);
}

export async function syncPlayerRating(
  ctx: MutationCtx,
  playerId: Id<"players">,
  calculatedAt = Date.now(),
  options: {
    forceDistributionInsert?: boolean;
    distributionFormulaVersionKey?: string;
  } = {},
): Promise<
  | { status: "ready"; ratingId: Id<"playerRatings">; score: number }
  | { status: "deleted" | "missing" | "refreshing" | "unavailable" }
> {
  const existing = await existingRating(ctx, playerId);
  const player = await ctx.db.get(playerId);
  if (!player) {
    if (existing) {
      await updateRatingDistributions(ctx, existing, null, calculatedAt);
      await ctx.db.delete(existing._id);
      return { status: "deleted" };
    }
    return { status: "missing" };
  }

  const result = await buildRuneRatingForPlayer(ctx, player);
  if (result.status === "refreshing") return { status: "refreshing" };
  if (result.status === "unavailable") {
    if (existing) {
      await updateRatingDistributions(ctx, existing, null, calculatedAt);
      await ctx.db.delete(existing._id);
    }
    return { status: existing ? "deleted" : "unavailable" };
  }

  const value = ratingDocument(player, result.card, calculatedAt);
  const distributionValue =
    options.distributionFormulaVersionKey === undefined
      ? value
      : {
          ...value,
          formulaVersionKey: options.distributionFormulaVersionKey,
        };
  await updateRatingDistributions(
    ctx,
    options.forceDistributionInsert ? null : existing,
    distributionValue,
    calculatedAt,
  );
  if (existing) {
    await ctx.db.replace(existing._id, value);
    return { status: "ready", ratingId: existing._id, score: value.score };
  }

  const ratingId = await ctx.db.insert("playerRatings", value);
  return { status: "ready", ratingId, score: value.score };
}
