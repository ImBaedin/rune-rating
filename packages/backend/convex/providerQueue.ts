import { normalizeRsn, rsnLookupKey } from "@rune-rating/domain";
import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import {
  internalAction,
  internalMutation,
  query,
} from "./_generated/server.js";
import { captureQueuedRefreshResult } from "./providerQueueAnalytics";
import {
  FAILED_BACKOFF_MS,
  JOB_LEASE_MS,
  jobRequestCost,
  MAX_ATTEMPTS,
  MAX_JOBS_PER_PUMP,
  RATE_LIMIT_BACKOFF_MS,
  TIMEOUT_BACKOFF_MS,
} from "./providerQueueConfig";
import { providerError } from "./providerQueueErrors";
import { runProviderQueueOperation } from "./providerQueueOperations";
import {
  enqueueProviderJob,
  reclaimExpiredLeases,
  reserveProviderSlot,
} from "./providerQueueScheduling";
import type { RunningProviderJob } from "./providerQueueTypes";
import { collectionDetailView, providerQueueView } from "./providerQueueViews";
import {
  providerQueueJobArgsValidator,
  providerQueueOperationValidator,
  providerQueueProviderValidator,
  providerQueueViewStatusValidator,
} from "./validators";

const collectionDetailStatusValidator = v.object({
  rsn: v.string(),
  provider: providerQueueProviderValidator,
  operation: v.literal("runeProfileCollectionDetail"),
  status: providerQueueViewStatusValidator,
  position: v.union(v.number(), v.null()),
  estimatedRunAt: v.union(v.number(), v.null()),
  retryAt: v.union(v.number(), v.null()),
  lastErrorCode: v.union(v.string(), v.null()),
  message: v.string(),
});

const providerQueueStatusValidator = v.object({
  provider: providerQueueProviderValidator,
  operation: v.union(providerQueueOperationValidator, v.null()),
  status: providerQueueViewStatusValidator,
  position: v.union(v.number(), v.null()),
  estimatedRunAt: v.union(v.number(), v.null()),
  retryAt: v.union(v.number(), v.null()),
  lastErrorCode: v.union(v.string(), v.null()),
  completedAt: v.union(v.number(), v.null()),
  message: v.string(),
});

export const getProviderStatuses = query({
  args: { rsns: v.array(v.string()) },
  returns: v.array(providerQueueStatusValidator),
  handler: async (ctx, args) => {
    const rsns = args.rsns.slice(0, 2).map((rsn) => normalizeRsn(rsn));
    return [
      await providerQueueView(ctx, "wiseOldMan", rsns),
      await providerQueueView(ctx, "runeProfile", rsns),
    ];
  },
});

export const getCollectionDetailStatuses = query({
  args: { rsns: v.array(v.string()) },
  returns: v.array(collectionDetailStatusValidator),
  handler: async (ctx, args) => {
    const statuses = [];
    const seen = new Set<string>();
    for (const rsn of args.rsns.slice(0, 2)) {
      const normalized = normalizeRsn(rsn);
      const key = rsnLookupKey(normalized);
      if (seen.has(key)) continue;
      seen.add(key);
      statuses.push(await collectionDetailView(ctx, normalized));
    }
    return statuses;
  },
});

export const enqueueCollectionDetail = internalMutation({
  args: { rsn: v.string(), priority: v.optional(v.number()) },
  returns: collectionDetailStatusValidator,
  handler: async (ctx, args) => {
    const rsn = normalizeRsn(args.rsn);
    await enqueueProviderJob(ctx, {
      operation: "runeProfileCollectionDetail" as const,
      jobArgs: { type: "runeProfileCollectionDetail" as const, rsn },
      priority: args.priority ?? 0,
    });
    return await collectionDetailView(ctx, rsn);
  },
});

export const enqueueWiseOldManPlayer = internalMutation({
  args: {
    playerId: v.id("players"),
    rsn: v.string(),
    requestId: v.string(),
    priority: v.optional(v.number()),
  },
  returns: v.id("providerJobs"),
  handler: async (ctx, args) =>
    await enqueueProviderJob(ctx, {
      operation: "wiseOldManPlayer",
      jobArgs: {
        type: "wiseOldManPlayer",
        playerId: args.playerId,
        rsn: args.rsn,
        requestId: args.requestId,
      },
      priority: args.priority,
    }),
});

export const enqueueRuneProfilePlayer = internalMutation({
  args: {
    playerId: v.id("players"),
    rsn: v.string(),
    requestId: v.string(),
    priority: v.optional(v.number()),
  },
  returns: v.id("providerJobs"),
  handler: async (ctx, args) =>
    await enqueueProviderJob(ctx, {
      operation: "runeProfilePlayer",
      jobArgs: {
        type: "runeProfilePlayer",
        playerId: args.playerId,
        rsn: args.rsn,
        requestId: args.requestId,
      },
      priority: args.priority,
    }),
});

export const enqueueWiseOldManOverview = internalMutation({
  args: { rsn: v.string(), priority: v.optional(v.number()) },
  returns: v.id("providerJobs"),
  handler: async (ctx, args) =>
    await enqueueProviderJob(ctx, {
      operation: "wiseOldManOverview",
      jobArgs: { type: "wiseOldManOverview", rsn: args.rsn },
      priority: args.priority,
    }),
});

export const enqueueWiseOldManSkillGains = internalMutation({
  args: {
    rsn: v.string(),
    period: v.union(
      v.literal("week"),
      v.literal("month"),
      v.literal("quarter"),
      v.literal("year"),
    ),
    priority: v.optional(v.number()),
  },
  returns: v.id("providerJobs"),
  handler: async (ctx, args) =>
    await enqueueProviderJob(ctx, {
      operation: "wiseOldManSkillGains",
      jobArgs: {
        type: "wiseOldManSkillGains",
        rsn: args.rsn,
        period: args.period,
      },
      priority: args.priority,
    }),
});

export const enqueueWiseOldManSkillTimelines = internalMutation({
  args: {
    rsn: v.string(),
    skillKeys: v.array(v.string()),
    priority: v.optional(v.number()),
  },
  returns: v.id("providerJobs"),
  handler: async (ctx, args) =>
    await enqueueProviderJob(ctx, {
      operation: "wiseOldManSkillTimelines",
      jobArgs: {
        type: "wiseOldManSkillTimelines",
        rsn: args.rsn,
        skillKeys: [...new Set(args.skillKeys)],
      },
      priority: args.priority,
    }),
});

export const enqueueWiseOldManEfficiencyTimelines = internalMutation({
  args: {
    rsn: v.string(),
    metrics: v.array(v.union(v.literal("ehp"), v.literal("ehb"))),
    priority: v.optional(v.number()),
  },
  returns: v.id("providerJobs"),
  handler: async (ctx, args) =>
    await enqueueProviderJob(ctx, {
      operation: "wiseOldManEfficiencyTimelines",
      jobArgs: {
        type: "wiseOldManEfficiencyTimelines",
        rsn: args.rsn,
        metrics: [...new Set(args.metrics)],
      },
      priority: args.priority,
    }),
});

export const pump = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    await reclaimExpiredLeases(ctx, now);

    const jobs = await ctx.db
      .query("providerJobs")
      .withIndex("by_status_and_next_attempt_at", (index) =>
        index.eq("status", "queued").lte("nextAttemptAt", now),
      )
      .take(MAX_JOBS_PER_PUMP);

    for (const job of jobs) {
      const runAt = await reserveProviderSlot(
        ctx,
        job.provider,
        now,
        jobRequestCost(job),
      );
      await ctx.db.patch(job._id, {
        status: "scheduled",
        estimatedRunAt: runAt,
        leaseUntil: runAt + JOB_LEASE_MS,
        updatedAt: now,
      });
      await ctx.scheduler.runAt(runAt, internal.providerQueue.runJob, {
        jobId: job._id,
      });
      await ctx.scheduler.runAt(
        runAt + JOB_LEASE_MS,
        internal.providerQueue.pump,
        {},
      );
    }

    if (jobs.length === MAX_JOBS_PER_PUMP) {
      await ctx.scheduler.runAfter(0, internal.providerQueue.pump, {});
    }

    return jobs.length;
  },
});

export const markRunning = internalMutation({
  args: { jobId: v.id("providerJobs") },
  returns: v.union(
    v.object({
      _id: v.id("providerJobs"),
      provider: providerQueueProviderValidator,
      operation: providerQueueOperationValidator,
      args: providerQueueJobArgsValidator,
      startedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (job?.status !== "scheduled") return null;
    if (job.leaseUntil !== null && job.leaseUntil < Date.now()) return null;

    const startedAt = Date.now();
    await ctx.db.patch(job._id, {
      status: "running",
      startedAt,
      updatedAt: startedAt,
    });

    return {
      _id: job._id,
      provider: job.provider,
      operation: job.operation,
      args: job.args,
      startedAt,
    };
  },
});

export const completeJob = internalMutation({
  args: { jobId: v.id("providerJobs"), startedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    if (job.status !== "running" || job.startedAt !== args.startedAt) {
      return null;
    }
    await ctx.db.patch(job._id, {
      status: "succeeded",
      leaseUntil: null,
      completedAt: now,
      lastErrorCode: null,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.providerQueue.pump, {});
    return null;
  },
});

export const failJob = internalMutation({
  args: {
    jobId: v.id("providerJobs"),
    startedAt: v.number(),
    errorCode: v.string(),
    retryAfterMs: v.union(v.number(), v.null()),
    retryable: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    if (job.status !== "running" || job.startedAt !== args.startedAt) {
      return null;
    }

    const attempts = job.attempts + 1;
    const retry =
      args.retryable && attempts < MAX_ATTEMPTS
        ? now +
          (args.retryAfterMs ??
            (args.errorCode === "rateLimited"
              ? RATE_LIMIT_BACKOFF_MS
              : args.errorCode === "timeout"
                ? TIMEOUT_BACKOFF_MS
                : FAILED_BACKOFF_MS))
        : null;

    await ctx.db.patch(job._id, {
      status: retry === null ? "dead" : "queued",
      attempts,
      nextAttemptAt: retry ?? now,
      leaseUntil: null,
      estimatedRunAt: null,
      lastErrorCode: args.errorCode,
      updatedAt: now,
    });

    if (retry !== null) {
      await ctx.scheduler.runAt(retry, internal.providerQueue.pump, {});
    }
    return null;
  },
});

export const runJob = internalAction({
  args: { jobId: v.id("providerJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job: RunningProviderJob | null = await ctx.runMutation(
      internal.providerQueue.markRunning,
      {
        jobId: args.jobId,
      },
    );
    if (!job) return null;

    const startedAt = job.startedAt;
    try {
      const result = await runProviderQueueOperation(ctx, job);
      if (result.status === "failed") {
        await ctx.runMutation(internal.providerQueue.failJob, {
          jobId: job._id,
          startedAt: job.startedAt,
          errorCode: result.errorCode,
          retryAfterMs: result.retryAfterMs,
          retryable: result.retryable,
        });
        await captureQueuedRefreshResult({
          rsn: job.args.rsn,
          provider: job.provider,
          operation: job.operation,
          startedAt,
          status:
            result.errorCode === "notConnected"
              ? "notConnected"
              : result.errorCode === "rateLimited"
                ? "rateLimited"
                : "failed",
          errorCode: result.errorCode,
        });
        return null;
      }

      await ctx.runMutation(internal.providerQueue.completeJob, {
        jobId: job._id,
        startedAt: job.startedAt,
      });
      if (result.collectionDetailSuccessRsn !== null) {
        await captureQueuedRefreshResult({
          rsn: result.collectionDetailSuccessRsn,
          provider: job.provider,
          operation: job.operation,
          startedAt,
          status: "fresh",
          errorCode: null,
        });
      }
    } catch (error) {
      const requestError = providerError(error);
      await ctx.runMutation(internal.providerQueue.failJob, {
        jobId: job._id,
        startedAt: job.startedAt,
        errorCode: requestError.code,
        retryAfterMs: requestError.retryAfterMs,
        retryable: requestError.retryable,
      });
      await captureQueuedRefreshResult({
        rsn: job.args.rsn,
        provider: job.provider,
        operation: job.operation,
        startedAt,
        status:
          requestError.code === "notConnected"
            ? "notConnected"
            : requestError.code === "rateLimited"
              ? "rateLimited"
              : "failed",
        errorCode: requestError.code,
      });
    }
    return null;
  },
});
