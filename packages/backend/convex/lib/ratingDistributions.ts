import type { Doc } from "../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../_generated/server.js";

const maxScore = 1_000;
const scoreBucketCount = maxScore + 1;
const globalScopeKey = "all";

type RatingDistributionScope = "global" | "accountType";
type DbCtx = QueryCtx | MutationCtx;

type RatingDistributionInput = {
  score: number;
  formulaVersionKey: string;
  accountTypeKey: string;
};

export type LeaderboardRank = {
  rank: number | null;
  rankedCount: number;
  topPercent: number | null;
  label: string;
};

function scoreBucket(score: number) {
  if (!Number.isFinite(score)) return 0;
  return Math.min(maxScore, Math.max(0, Math.round(score)));
}

function distributionKey(
  formulaVersionKey: string,
  scope: RatingDistributionScope,
  scopeKey: string,
) {
  return `${formulaVersionKey}:${scope}:${scopeKey}`;
}

function scopesForRating(rating: RatingDistributionInput) {
  return [
    {
      key: distributionKey(rating.formulaVersionKey, "global", globalScopeKey),
      formulaVersionKey: rating.formulaVersionKey,
      scope: "global" as const,
      scopeKey: globalScopeKey,
      score: scoreBucket(rating.score),
    },
    {
      key: distributionKey(
        rating.formulaVersionKey,
        "accountType",
        rating.accountTypeKey,
      ),
      formulaVersionKey: rating.formulaVersionKey,
      scope: "accountType" as const,
      scopeKey: rating.accountTypeKey,
      score: scoreBucket(rating.score),
    },
  ];
}

function emptyCounts() {
  return Array.from({ length: scoreBucketCount }, () => 0);
}

function rankLabel(rank: number | null, topPercent: number | null) {
  if (rank === null || topPercent === null) return "Leaderboard pending";
  if (rank <= 100) return `Rank #${rank} / Top 100`;
  return `Rank #${rank} / Top ${topPercent}%`;
}

async function distributionsForFormula(
  ctx: MutationCtx,
  formulaVersionKey: string,
) {
  const distributions: Doc<"ratingDistributions">[] = [];
  for await (const distribution of ctx.db
    .query("ratingDistributions")
    .withIndex("by_formula_version_key", (index) =>
      index.eq("formulaVersionKey", formulaVersionKey),
    )) {
    distributions.push(distribution);
  }
  return distributions;
}

export async function clearRatingDistributions(
  ctx: MutationCtx,
  formulaVersionKey?: string,
) {
  if (formulaVersionKey !== undefined) {
    for (const distribution of await distributionsForFormula(
      ctx,
      formulaVersionKey,
    )) {
      await ctx.db.delete(distribution._id);
    }
    return;
  }

  for await (const distribution of ctx.db.query("ratingDistributions")) {
    await ctx.db.delete(distribution._id);
  }
}

export async function publishRatingDistributionDraft(
  ctx: MutationCtx,
  args: {
    draftFormulaVersionKey: string;
    liveFormulaVersionKey: string;
    updatedAt?: number;
  },
) {
  const [draftDistributions, liveDistributions] = await Promise.all([
    distributionsForFormula(ctx, args.draftFormulaVersionKey),
    distributionsForFormula(ctx, args.liveFormulaVersionKey),
  ]);

  for (const distribution of liveDistributions) {
    await ctx.db.delete(distribution._id);
  }

  const updatedAt = args.updatedAt ?? Date.now();
  for (const distribution of draftDistributions) {
    await ctx.db.replace(distribution._id, {
      key: distributionKey(
        args.liveFormulaVersionKey,
        distribution.scope,
        distribution.scopeKey,
      ),
      formulaVersionKey: args.liveFormulaVersionKey,
      scope: distribution.scope,
      scopeKey: distribution.scopeKey,
      total: distribution.total,
      countsByScore: distribution.countsByScore,
      updatedAt,
    });
  }
}

export async function updateRatingDistributions(
  ctx: MutationCtx,
  previous: RatingDistributionInput | null,
  next: RatingDistributionInput | null,
  updatedAt = Date.now(),
) {
  const deltas = new Map<
    string,
    {
      formulaVersionKey: string;
      scope: RatingDistributionScope;
      scopeKey: string;
      totalDelta: number;
      scoreDeltas: Map<number, number>;
    }
  >();

  const addDelta = (rating: RatingDistributionInput, direction: 1 | -1) => {
    for (const scope of scopesForRating(rating)) {
      const existing = deltas.get(scope.key) ?? {
        formulaVersionKey: scope.formulaVersionKey,
        scope: scope.scope,
        scopeKey: scope.scopeKey,
        totalDelta: 0,
        scoreDeltas: new Map<number, number>(),
      };
      existing.totalDelta += direction;
      existing.scoreDeltas.set(
        scope.score,
        (existing.scoreDeltas.get(scope.score) ?? 0) + direction,
      );
      deltas.set(scope.key, existing);
    }
  };

  if (previous) addDelta(previous, -1);
  if (next) addDelta(next, 1);
  const previousScopes = previous ? scopesForRating(previous) : [];
  const nextScopes = next ? scopesForRating(next) : [];

  for (const [key, delta] of deltas) {
    const existing = await ctx.db
      .query("ratingDistributions")
      .withIndex("by_key", (index) => index.eq("key", key))
      .unique();
    const previousScope = previousScopes.find((scope) => scope.key === key);
    const nextScope = nextScopes.find((scope) => scope.key === key);
    const hasScoreChanges = [...delta.scoreDeltas.values()].some(
      (value) => value !== 0,
    );
    if (existing && delta.totalDelta === 0 && !hasScoreChanges) continue;
    if (!existing && !nextScope) continue;

    const counts = existing?.countsByScore ?? emptyCounts();
    const initialTotal =
      existing?.total ?? (previousScope && nextScope ? 1 : 0);
    if (!existing && previousScope && nextScope) {
      counts[previousScope.score] = 1;
    }

    for (const [score, scoreDelta] of delta.scoreDeltas) {
      if (scoreDelta === 0) continue;
      counts[score] = Math.max(0, (counts[score] ?? 0) + scoreDelta);
    }

    const value = {
      key,
      formulaVersionKey: delta.formulaVersionKey,
      scope: delta.scope,
      scopeKey: delta.scopeKey,
      total: Math.max(0, initialTotal + delta.totalDelta),
      countsByScore: counts,
      updatedAt,
    };

    if (existing) {
      await ctx.db.replace(existing._id, value);
    } else {
      await ctx.db.insert("ratingDistributions", value);
    }
  }
}

export function rankFromDistribution(
  distribution: Doc<"ratingDistributions"> | null,
  score: number,
  includesRating: boolean,
): LeaderboardRank {
  if (!distribution || distribution.total <= 0) {
    return {
      rank: null,
      rankedCount: 0,
      topPercent: null,
      label: rankLabel(null, null),
    };
  }

  const bucket = scoreBucket(score);
  let betterCount = 0;
  for (let index = bucket + 1; index <= maxScore; index += 1) {
    betterCount += distribution.countsByScore[index] ?? 0;
  }

  const rank = betterCount + 1;
  const rankedCount = distribution.total + (includesRating ? 0 : 1);
  const topPercent = Math.max(1, Math.ceil((rank / rankedCount) * 100));

  return {
    rank,
    rankedCount,
    topPercent,
    label: rankLabel(rank, topPercent),
  };
}

export async function getRatingDistribution(
  ctx: DbCtx,
  rating: RatingDistributionInput,
  scope: RatingDistributionScope,
) {
  const key =
    scope === "global"
      ? distributionKey(rating.formulaVersionKey, "global", globalScopeKey)
      : distributionKey(
          rating.formulaVersionKey,
          "accountType",
          rating.accountTypeKey,
        );
  return await ctx.db
    .query("ratingDistributions")
    .withIndex("by_key", (index) => index.eq("key", key))
    .unique();
}

export async function getRatingDistributionTotal(
  ctx: DbCtx,
  args: {
    formulaVersionKey: string;
    scope: RatingDistributionScope;
    scopeKey?: string;
  },
) {
  const distribution = await ctx.db
    .query("ratingDistributions")
    .withIndex("by_key", (index) =>
      index.eq(
        "key",
        distributionKey(
          args.formulaVersionKey,
          args.scope,
          args.scopeKey ?? globalScopeKey,
        ),
      ),
    )
    .unique();
  return distribution?.total ?? 0;
}
