import {
  fetchWiseOldManEhbRates,
  fetchWiseOldManEhpRates,
  fetchWiseOldManPlayer,
  WiseOldManRequestError,
} from "@rune-rating/sdk-wise-old-man";
import { v } from "convex/values";
import { internal } from "../_generated/api.js";
import { internalAction } from "../_generated/server.js";
import {
  analyticsDistinctIdForRsn,
  capturePostHogEvent,
  durationMs,
  withProviderRequestAnalytics,
} from "../lib/analytics";

const EFFICIENCY_RATE_CACHE_MS = 24 * 60 * 60 * 1_000;

export const refreshPlayer = internalAction({
  args: {
    playerId: v.id("players"),
    rsn: v.string(),
    requestId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const ownsLease = await ctx.runMutation(
      internal.refresh.markWiseOldManRefreshing,
      {
        playerId: args.playerId,
        requestId: args.requestId,
      },
    );
    if (!ownsLease) return null;

    try {
      const snapshot = await withProviderRequestAnalytics(
        {
          rsn: args.rsn,
          source: "wiseOldMan",
          endpoint: "player",
        },
        () =>
          fetchWiseOldManPlayer(args.rsn, {
            userAgent: "RuneRating/0.1",
          }),
      );
      await ctx.runMutation(internal.refresh.completeWiseOldMan, {
        playerId: args.playerId,
        requestId: args.requestId,
        fetchedAt: snapshot.fetchedAt,
        accountType: snapshot.accountType,
        accountBuild: snapshot.accountBuild,
        combatLevel: snapshot.combatLevel,
        ehp: snapshot.ehp,
        ehb: snapshot.ehb,
        timeToMax: snapshot.timeToMax,
        timeTo200m: snapshot.timeTo200m,
      });
      const ratesAreFresh: boolean = await ctx.runQuery(
        internal.refresh.areWiseOldManIronmanEfficiencyRatesFresh,
        { maxAgeMs: EFFICIENCY_RATE_CACHE_MS },
      );
      if (!ratesAreFresh) {
        try {
          const [ehpSkills, ehbBosses] = await Promise.all([
            withProviderRequestAnalytics(
              {
                rsn: args.rsn,
                source: "wiseOldMan",
                endpoint: "ehp_rates",
                properties: { account_type: "ironman" },
              },
              () =>
                fetchWiseOldManEhpRates("ironman", {
                  userAgent: "RuneRating/0.1",
                }),
            ),
            withProviderRequestAnalytics(
              {
                rsn: args.rsn,
                source: "wiseOldMan",
                endpoint: "ehb_rates",
                properties: { account_type: "ironman" },
              },
              () =>
                fetchWiseOldManEhbRates("ironman", {
                  userAgent: "RuneRating/0.1",
                }),
            ),
          ]);
          await ctx.runMutation(
            internal.refresh.upsertWiseOldManIronmanEfficiencyRates,
            {
              fetchedAt: Date.now(),
              ehpSkills,
              ehbBosses,
            },
          );
        } catch {
          // Player efficiency is still usable if the shared rates endpoint is down.
        }
      }
      await capturePostHogEvent({
        event: "refresh_result",
        distinctId: await analyticsDistinctIdForRsn(args.rsn),
        properties: {
          source: "wiseOldMan",
          category: "efficiency",
          status: "fresh",
          duration_ms: durationMs(startedAt),
          error_code: null,
        },
      });
    } catch (error) {
      const requestError =
        error instanceof WiseOldManRequestError
          ? error
          : new WiseOldManRequestError(
              "failed",
              error instanceof Error
                ? error.message
                : "Unknown Wise Old Man failure.",
            );
      const status =
        requestError.code === "notConnected"
          ? ("notConnected" as const)
          : requestError.code === "rateLimited"
            ? ("rateLimited" as const)
            : ("failed" as const);
      await ctx.runMutation(internal.refresh.completeWiseOldManFailure, {
        playerId: args.playerId,
        requestId: args.requestId,
        status,
        errorCode: requestError.code,
      });
      await capturePostHogEvent({
        event: "refresh_result",
        distinctId: await analyticsDistinctIdForRsn(args.rsn),
        properties: {
          source: "wiseOldMan",
          category: "efficiency",
          status,
          duration_ms: durationMs(startedAt),
          error_code: requestError.code,
        },
      });
    }
    return null;
  },
});
