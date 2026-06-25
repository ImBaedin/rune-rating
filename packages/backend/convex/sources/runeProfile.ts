import {
  fetchRuneProfilePlayer,
  RuneProfileRequestError,
} from "@rune-rating/sdk-runeprofile";
import { v } from "convex/values";
import { internal } from "../_generated/api.js";
import { env, internalAction } from "../_generated/server.js";
import {
  analyticsDistinctIdForRsn,
  capturePostHogEvent,
  durationMs,
  withProviderRequestAnalytics,
} from "../lib/analytics";

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
      internal.refresh.markRuneProfileRefreshing,
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
          source: "runeProfile",
          endpoint: "player",
        },
        () =>
          fetchRuneProfilePlayer(args.rsn, {
            apiKey: env.RUNEPROFILE_API_KEY,
            userAgent: "RuneRating/0.1",
          }),
      );
      const completed: boolean = await ctx.runMutation(
        internal.refresh.completeRuneProfile,
        {
          playerId: args.playerId,
          requestId: args.requestId,
          fetchedAt: snapshot.fetchedAt,
          accountType: snapshot.accountType,
          groupName: snapshot.groupName,
          quests: snapshot.quests,
          questSummary: snapshot.questSummary,
          diaries: snapshot.diaries,
          diarySummary: snapshot.diarySummary,
          combatAchievementTasks: snapshot.combatAchievementTasks,
          combatAchievementTiers: snapshot.combatAchievementTiers,
          combatAchievementPoints: snapshot.combatAchievementPoints,
          combatAchievementTierReached: snapshot.combatAchievementTierReached,
          combatAchievementsValid: snapshot.combatAchievementsValid,
          collectionSummary: snapshot.collectionSummary,
        },
      );
      if (!completed) {
        throw new RuneProfileRequestError(
          "invalidResponse",
          "RuneProfile snapshot could not be committed.",
        );
      }
      await capturePostHogEvent({
        event: "refresh_result",
        distinctId: await analyticsDistinctIdForRsn(args.rsn),
        properties: {
          source: "runeProfile",
          category: "profile_summary",
          status: "fresh",
          duration_ms: durationMs(startedAt),
          error_code: null,
        },
      });
    } catch (error) {
      const requestError =
        error instanceof RuneProfileRequestError
          ? error
          : new RuneProfileRequestError(
              "failed",
              error instanceof Error
                ? error.message
                : "Unknown RuneProfile failure.",
            );
      const status =
        requestError.code === "notConnected"
          ? ("notConnected" as const)
          : requestError.code === "rateLimited"
            ? ("rateLimited" as const)
            : ("failed" as const);
      await ctx.runMutation(internal.refresh.completeRuneProfileFailure, {
        playerId: args.playerId,
        requestId: args.requestId,
        status,
        errorCode: requestError.code,
      });
      await capturePostHogEvent({
        event: "refresh_result",
        distinctId: await analyticsDistinctIdForRsn(args.rsn),
        properties: {
          source: "runeProfile",
          category: "profile_summary",
          status,
          duration_ms: durationMs(startedAt),
          error_code: requestError.code,
        },
      });
    }
    return null;
  },
});
