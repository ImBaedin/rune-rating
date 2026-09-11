import {
  fetchHiscores,
  HiscoresRequestError,
  isKnownHiscoresActivityName,
} from "@rune-rating/sdk-hiscores";
import { v } from "convex/values";
import { internal } from "../_generated/api.js";
import { internalAction } from "../_generated/server.js";
import {
  analyticsDistinctIdForRsn,
  capturePostHogEvent,
  durationMs,
  withProviderRequestAnalytics,
} from "../lib/analytics";

const reportedContractExtensions = new Set<string>();

async function reportUnknownActivities(rsn: string, names: string[]) {
  const unreportedNames = names.filter((name) => {
    const key = `hiscores:${name}`;
    if (reportedContractExtensions.has(key)) return false;
    reportedContractExtensions.add(key);
    return true;
  });
  if (unreportedNames.length === 0) return;

  console.warn(
    `Hiscores returned new activities: ${unreportedNames.join(", ")}.`,
  );
  try {
    await capturePostHogEvent({
      event: "provider_contract_extension",
      distinctId: await analyticsDistinctIdForRsn(rsn),
      properties: {
        source: "hiscores",
        endpoint: "player_hiscores",
        field_count: unreportedNames.length,
        fields: unreportedNames.join(","),
      },
    });
  } catch (error) {
    console.warn("Failed to report a Hiscores contract extension.", error);
  }
}

export const refreshPlayer = internalAction({
  args: {
    playerId: v.id("players"),
    rsn: v.string(),
    requestId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const ownsLease = await ctx.runMutation(internal.refresh.markRefreshing, {
      playerId: args.playerId,
      requestId: args.requestId,
    });
    if (!ownsLease) return null;

    try {
      const snapshot = await withProviderRequestAnalytics(
        {
          rsn: args.rsn,
          source: "hiscores",
          endpoint: "player_hiscores",
        },
        () =>
          fetchHiscores(args.rsn, {
            userAgent: "RuneRating",
          }),
      );
      const unknownActivityNames = snapshot.activities
        .filter((activity) => !isKnownHiscoresActivityName(activity.name))
        .map((activity) => activity.name);
      if (unknownActivityNames.length > 0) {
        await reportUnknownActivities(args.rsn, unknownActivityNames);
      }
      await ctx.runMutation(internal.refresh.completeHiscores, {
        playerId: args.playerId,
        requestId: args.requestId,
        displayRsn: args.rsn,
        fetchedAt: snapshot.fetchedAt,
        skills: snapshot.skills,
        activities: snapshot.activities,
      });
      await capturePostHogEvent({
        event: "refresh_result",
        distinctId: await analyticsDistinctIdForRsn(args.rsn),
        properties: {
          source: "hiscores",
          category: "skills_activities",
          status: "fresh",
          duration_ms: durationMs(startedAt),
          error_code: null,
        },
      });
    } catch (error) {
      const requestError =
        error instanceof HiscoresRequestError
          ? error
          : new HiscoresRequestError(
              "failed",
              error instanceof Error
                ? error.message
                : "Unknown Hiscores failure.",
            );
      const status =
        requestError.code === "notFound"
          ? ("notFound" as const)
          : requestError.code === "rateLimited"
            ? ("rateLimited" as const)
            : ("failed" as const);
      await ctx.runMutation(internal.refresh.completeFailure, {
        playerId: args.playerId,
        requestId: args.requestId,
        status,
        errorCode: requestError.code,
      });
      await capturePostHogEvent({
        event: "refresh_result",
        distinctId: await analyticsDistinctIdForRsn(args.rsn),
        properties: {
          source: "hiscores",
          category: "skills_activities",
          status,
          duration_ms: durationMs(startedAt),
          error_code: requestError.code,
        },
      });
    }
    return null;
  },
});
