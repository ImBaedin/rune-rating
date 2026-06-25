import { fetchRuneProfileCollectionLog } from "@rune-rating/sdk-runeprofile";
import { internal } from "./_generated/api.js";
import { type ActionCtx, env } from "./_generated/server.js";
import { withProviderRequestAnalytics } from "./lib/analytics";
import type { RunningProviderJob } from "./providerQueueTypes";

type OperationResult =
  | { status: "completed"; collectionDetailSuccessRsn: string | null }
  | {
      status: "failed";
      errorCode: string;
      retryAfterMs: number | null;
      retryable: boolean;
    };

export async function runProviderQueueOperation(
  ctx: ActionCtx,
  job: RunningProviderJob,
): Promise<OperationResult> {
  switch (job.args.type) {
    case "wiseOldManPlayer":
      await ctx.runAction(internal.sources.wiseOldMan.refreshPlayer, {
        playerId: job.args.playerId,
        rsn: job.args.rsn,
        requestId: job.args.requestId,
      });
      return { status: "completed", collectionDetailSuccessRsn: null };
    case "wiseOldManOverview":
      await ctx.runAction(internal.wiseOldMan.refreshOverviewCache, {
        rsn: job.args.rsn,
      });
      return { status: "completed", collectionDetailSuccessRsn: null };
    case "wiseOldManSkillGains":
      await ctx.runAction(internal.wiseOldMan.refreshSkillGainsCache, {
        rsn: job.args.rsn,
        period: job.args.period,
      });
      return { status: "completed", collectionDetailSuccessRsn: null };
    case "wiseOldManSkillTimelines":
      await ctx.runAction(internal.wiseOldMan.refreshSkillTimelineCaches, {
        rsn: job.args.rsn,
        skillKeys: job.args.skillKeys,
      });
      return { status: "completed", collectionDetailSuccessRsn: null };
    case "wiseOldManEfficiencyTimelines":
      await ctx.runAction(internal.wiseOldMan.refreshEfficiencyTimelineCaches, {
        rsn: job.args.rsn,
        metrics: job.args.metrics,
      });
      return { status: "completed", collectionDetailSuccessRsn: null };
    case "runeProfilePlayer":
      await ctx.runAction(internal.sources.runeProfile.refreshPlayer, {
        playerId: job.args.playerId,
        rsn: job.args.rsn,
        requestId: job.args.requestId,
      });
      return { status: "completed", collectionDetailSuccessRsn: null };
    case "runeProfileCollectionDetail": {
      const collectionLog = await withProviderRequestAnalytics(
        {
          rsn: job.args.rsn,
          source: "runeProfile",
          endpoint: "collection_log",
          properties: { queued: true },
        },
        () =>
          fetchRuneProfileCollectionLog(job.args.rsn, {
            apiKey: env.RUNEPROFILE_API_KEY,
            userAgent: "RuneRating/0.1",
          }),
      );
      const { fetchedAt, ...collectionLogData } = collectionLog;
      const replaced: boolean = await ctx.runMutation(
        internal.runeProfile.replaceCollectionLog,
        {
          rsn: job.args.rsn,
          fetchedAt,
          collectionLog: collectionLogData,
        },
      );

      if (!replaced) {
        return {
          status: "failed",
          errorCode: "notConnected",
          retryAfterMs: null,
          retryable: false,
        };
      }

      return {
        status: "completed",
        collectionDetailSuccessRsn: job.args.rsn,
      };
    }
  }
}
