import { normalizeRsn, rsnLookupKey } from "@rune-rating/domain";
import {
  fetchRuneProfileCollectionLog,
  RuneProfileRequestError,
} from "@rune-rating/sdk-runeprofile";
import { WiseOldManRequestError } from "@rune-rating/sdk-wise-old-man";
import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel";
import {
  env,
  internalAction,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
  query,
} from "./_generated/server.js";
import {
  analyticsDistinctIdForRsn,
  capturePostHogEvent,
  durationMs,
} from "./lib/analytics";
import {
  providerQueueJobArgsValidator,
  providerQueueOperationValidator,
  providerQueueProviderValidator,
  providerQueueViewStatusValidator,
} from "./validators";

const RUNEPROFILE_SPACING_MS = 600;
const WISE_OLD_MAN_SPACING_MS = 700;
const JOB_LEASE_MS = 2 * 60 * 1_000;
const MAX_JOBS_PER_PUMP = 5;
const MAX_ATTEMPTS = 4;
const FAILED_BACKOFF_MS = 5 * 60 * 1_000;
const TIMEOUT_BACKOFF_MS = 60 * 1_000;
const RATE_LIMIT_BACKOFF_MS = 60 * 1_000;

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

type Provider = "wiseOldMan" | "runeProfile";
type QueueJob = Doc<"providerJobs">;
type JobArgs = QueueJob["args"];
type Operation = QueueJob["operation"];
type QueueViewStatus =
  | "idle"
  | "queued"
  | "running"
  | "retrying"
  | "succeeded"
  | "failed";

function providerSpacingMs(provider: Provider) {
  return provider === "wiseOldMan"
    ? WISE_OLD_MAN_SPACING_MS
    : RUNEPROFILE_SPACING_MS;
}

function collectionDetailDedupeKey(rsn: string) {
  return `runeProfile:collectionDetail:${rsnLookupKey(rsn)}`;
}

function dedupeKeyFor(args: JobArgs) {
  switch (args.type) {
    case "wiseOldManPlayer":
      return `wiseOldMan:player:${args.requestId}`;
    case "wiseOldManOverview":
      return `wiseOldMan:overview:${rsnLookupKey(args.rsn)}`;
    case "wiseOldManSkillGains":
      return `wiseOldMan:skillGains:${rsnLookupKey(args.rsn)}:${args.period}`;
    case "wiseOldManSkillTimelines":
      return `wiseOldMan:skillTimelines:${rsnLookupKey(args.rsn)}:${[
        ...new Set(args.skillKeys),
      ]
        .sort()
        .join(",")}`;
    case "wiseOldManEfficiencyTimelines":
      return `wiseOldMan:efficiencyTimelines:${rsnLookupKey(args.rsn)}:${[
        ...new Set(args.metrics),
      ]
        .sort()
        .join(",")}`;
    case "runeProfilePlayer":
      return `runeProfile:player:${args.requestId}`;
    case "runeProfileCollectionDetail":
      return collectionDetailDedupeKey(args.rsn);
  }
}

function providerFor(operation: Operation): Provider {
  return operation.startsWith("wiseOldMan") ? "wiseOldMan" : "runeProfile";
}

function jobRequestCost(job: Pick<QueueJob, "operation" | "args">) {
  switch (job.args.type) {
    case "runeProfilePlayer":
      return 4;
    case "wiseOldManOverview":
      return 2;
    case "wiseOldManEfficiencyTimelines":
      return 1 + job.args.metrics.length;
    default:
      return 1;
  }
}

async function reserveProviderSlot(
  ctx: MutationCtx,
  provider: Provider,
  now: number,
  cost: number,
) {
  const existing = await ctx.db
    .query("providerRateLimits")
    .withIndex("by_provider", (index) => index.eq("provider", provider))
    .unique();
  const spacingMs = providerSpacingMs(provider);
  const runAt = Math.max(now, existing?.nextAvailableAt ?? now);
  const value = {
    nextAvailableAt: runAt + spacingMs * Math.max(1, cost),
    spacingMs,
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, value);
  } else {
    await ctx.db.insert("providerRateLimits", {
      provider,
      ...value,
    });
  }

  return runAt;
}

function queueViewStatus(job: QueueJob | null, now: number): QueueViewStatus {
  if (!job) return "idle";
  if (job.status === "dead") return "failed";
  if (job.status === "succeeded") return "succeeded";
  if (job.status === "running") return "running";
  if (job.attempts > 0 && job.nextAttemptAt > now) return "retrying";
  return "queued";
}

function queueMessage(status: QueueViewStatus) {
  switch (status) {
    case "idle":
      return "No provider job is queued.";
    case "queued":
      return "Provider request queued.";
    case "running":
      return "Provider request is running.";
    case "retrying":
      return "Provider request will retry.";
    case "succeeded":
      return "Provider request completed.";
    case "failed":
      return "Provider request failed.";
  }
}

async function queuePosition(ctx: { db: QueryCtx["db"] }, job: QueueJob) {
  if (job.status !== "queued" && job.status !== "scheduled") return null;
  const [queued, scheduled] = await Promise.all([
    ctx.db
      .query("providerJobs")
      .withIndex("by_provider_and_status_and_estimated_run_at", (index) =>
        index.eq("provider", job.provider).eq("status", "queued"),
      )
      .take(100),
    ctx.db
      .query("providerJobs")
      .withIndex("by_provider_and_status_and_estimated_run_at", (index) =>
        index.eq("provider", job.provider).eq("status", "scheduled"),
      )
      .take(100),
  ]);
  const jobs = [...queued, ...scheduled]
    .filter((entry) => entry.operation === job.operation)
    .sort((left, right) => {
      const leftTime = left.estimatedRunAt ?? left.nextAttemptAt;
      const rightTime = right.estimatedRunAt ?? right.nextAttemptAt;
      return (
        leftTime - rightTime ||
        right.priority - left.priority ||
        left.createdAt - right.createdAt
      );
    });
  const index = jobs.findIndex((entry) => entry._id === job._id);
  return index === -1 ? null : index + 1;
}

function jobRsn(job: QueueJob) {
  return job.args.rsn;
}

async function activeProviderJobs(
  ctx: { db: QueryCtx["db"] },
  provider: Provider,
) {
  const [running, scheduled, queued] = await Promise.all([
    ctx.db
      .query("providerJobs")
      .withIndex("by_provider_and_status_and_estimated_run_at", (index) =>
        index.eq("provider", provider).eq("status", "running"),
      )
      .take(100),
    ctx.db
      .query("providerJobs")
      .withIndex("by_provider_and_status_and_estimated_run_at", (index) =>
        index.eq("provider", provider).eq("status", "scheduled"),
      )
      .take(100),
    ctx.db
      .query("providerJobs")
      .withIndex("by_provider_and_status_and_estimated_run_at", (index) =>
        index.eq("provider", provider).eq("status", "queued"),
      )
      .take(100),
  ]);
  return [...running, ...scheduled, ...queued];
}

async function terminalProviderJobs(
  ctx: { db: QueryCtx["db"] },
  provider: Provider,
) {
  const [succeeded, dead] = await Promise.all([
    ctx.db
      .query("providerJobs")
      .withIndex("by_provider_and_status_and_estimated_run_at", (index) =>
        index.eq("provider", provider).eq("status", "succeeded"),
      )
      .take(100),
    ctx.db
      .query("providerJobs")
      .withIndex("by_provider_and_status_and_estimated_run_at", (index) =>
        index.eq("provider", provider).eq("status", "dead"),
      )
      .take(100),
  ]);
  return [...succeeded, ...dead];
}

async function providerQueueView(
  ctx: { db: QueryCtx["db"] },
  provider: Provider,
  rsns: string[],
) {
  const now = Date.now();
  const keys = new Set(rsns.map((rsn) => rsnLookupKey(rsn)));
  const activeJobs = (await activeProviderJobs(ctx, provider))
    .filter((job) => keys.has(rsnLookupKey(jobRsn(job))))
    .sort((left, right) => {
      const leftStatus = queueViewStatus(left, now);
      const rightStatus = queueViewStatus(right, now);
      const leftRank =
        leftStatus === "running" ? 0 : leftStatus === "retrying" ? 2 : 1;
      const rightRank =
        rightStatus === "running" ? 0 : rightStatus === "retrying" ? 2 : 1;
      const leftTime =
        left.estimatedRunAt ?? left.nextAttemptAt ?? left.createdAt;
      const rightTime =
        right.estimatedRunAt ?? right.nextAttemptAt ?? right.createdAt;
      return leftRank - rightRank || leftTime - rightTime;
    });
  const terminalJobs =
    activeJobs.length === 0
      ? (await terminalProviderJobs(ctx, provider))
          .filter((job) => keys.has(rsnLookupKey(jobRsn(job))))
          .sort(
            (left, right) =>
              (right.completedAt ?? right.updatedAt) -
              (left.completedAt ?? left.updatedAt),
          )
      : [];
  const job = activeJobs[0] ?? terminalJobs[0] ?? null;
  const rate = job
    ? await ctx.db
        .query("providerRateLimits")
        .withIndex("by_provider", (index) => index.eq("provider", provider))
        .unique()
    : null;
  const status = queueViewStatus(job, now);

  return {
    provider,
    operation: job?.operation ?? null,
    status,
    position: job ? await queuePosition(ctx, job) : null,
    estimatedRunAt:
      job?.estimatedRunAt ??
      (status === "queued"
        ? Math.max(now, rate?.nextAvailableAt ?? now)
        : null),
    retryAt: status === "retrying" ? (job?.nextAttemptAt ?? null) : null,
    lastErrorCode: job?.lastErrorCode ?? null,
    completedAt: job?.completedAt ?? null,
    message: queueMessage(status),
  };
}

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

async function collectionDetailView(ctx: { db: QueryCtx["db"] }, rsn: string) {
  const now = Date.now();
  const existing = await ctx.db
    .query("providerJobs")
    .withIndex("by_dedupe_key", (index) =>
      index.eq("dedupeKey", collectionDetailDedupeKey(rsn)),
    )
    .unique();
  const rate = await ctx.db
    .query("providerRateLimits")
    .withIndex("by_provider", (index) => index.eq("provider", "runeProfile"))
    .unique();
  const status = queueViewStatus(existing, now);
  return {
    rsn: normalizeRsn(rsn),
    provider: "runeProfile" as const,
    operation: "runeProfileCollectionDetail" as const,
    status,
    position: existing ? await queuePosition(ctx, existing) : null,
    estimatedRunAt:
      existing?.estimatedRunAt ??
      (status === "queued"
        ? Math.max(now, rate?.nextAvailableAt ?? now)
        : null),
    retryAt: status === "retrying" ? (existing?.nextAttemptAt ?? null) : null,
    lastErrorCode: existing?.lastErrorCode ?? null,
    message: queueMessage(status),
  };
}

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

async function enqueueProviderJob(
  ctx: MutationCtx,
  args: {
    operation: Operation;
    jobArgs: JobArgs;
    priority?: number;
  },
) {
  const now = Date.now();
  const dedupeKey = dedupeKeyFor(args.jobArgs);
  const existing = await ctx.db
    .query("providerJobs")
    .withIndex("by_dedupe_key", (index) => index.eq("dedupeKey", dedupeKey))
    .unique();

  if (
    existing &&
    (existing.status === "queued" ||
      existing.status === "scheduled" ||
      existing.status === "running")
  ) {
    return existing._id;
  }

  const value = {
    provider: providerFor(args.operation),
    operation: args.operation,
    args: args.jobArgs,
    status: "queued" as const,
    priority: args.priority ?? 0,
    nextAttemptAt: now,
    attempts: 0,
    leaseUntil: null,
    estimatedRunAt: null,
    startedAt: null,
    completedAt: null,
    lastErrorCode: null,
    updatedAt: now,
  };

  let jobId: Id<"providerJobs">;
  if (existing) {
    await ctx.db.patch(existing._id, value);
    jobId = existing._id;
  } else {
    jobId = await ctx.db.insert("providerJobs", {
      dedupeKey,
      createdAt: now,
      ...value,
    });
  }

  await ctx.scheduler.runAfter(0, internal.providerQueue.pump, {});
  return jobId;
}

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
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (job?.status !== "scheduled") return null;
    if (job.leaseUntil !== null && job.leaseUntil < Date.now()) return null;

    await ctx.db.patch(job._id, {
      status: "running",
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      _id: job._id,
      provider: job.provider,
      operation: job.operation,
      args: job.args,
    };
  },
});

export const completeJob = internalMutation({
  args: { jobId: v.id("providerJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
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
    errorCode: v.string(),
    retryAfterMs: v.union(v.number(), v.null()),
    retryable: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

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

function runeProfileError(error: unknown) {
  if (error instanceof RuneProfileRequestError) {
    return {
      code: error.code,
      retryAfterMs: error.retryAfterMs,
      retryable:
        error.code === "rateLimited" ||
        error.code === "timeout" ||
        error.code === "failed",
    };
  }
  return { code: "failed", retryAfterMs: null, retryable: true };
}

function providerError(error: unknown) {
  if (error instanceof WiseOldManRequestError) {
    return {
      code: error.code,
      retryAfterMs: error.retryAfterMs,
      retryable:
        error.code === "rateLimited" ||
        error.code === "timeout" ||
        error.code === "failed",
    };
  }
  return runeProfileError(error);
}

export const runJob = internalAction({
  args: { jobId: v.id("providerJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job: {
      _id: Id<"providerJobs">;
      provider: Provider;
      operation: Operation;
      args: JobArgs;
    } | null = await ctx.runMutation(internal.providerQueue.markRunning, {
      jobId: args.jobId,
    });
    if (!job) return null;

    const startedAt = Date.now();
    try {
      switch (job.args.type) {
        case "wiseOldManPlayer":
          await ctx.runAction(internal.sources.wiseOldMan.refreshPlayer, {
            playerId: job.args.playerId,
            rsn: job.args.rsn,
            requestId: job.args.requestId,
          });
          break;
        case "wiseOldManOverview":
          await ctx.runAction(internal.wiseOldMan.refreshOverviewCache, {
            rsn: job.args.rsn,
          });
          break;
        case "wiseOldManSkillGains":
          await ctx.runAction(internal.wiseOldMan.refreshSkillGainsCache, {
            rsn: job.args.rsn,
            period: job.args.period,
          });
          break;
        case "wiseOldManSkillTimelines":
          await ctx.runAction(internal.wiseOldMan.refreshSkillTimelineCaches, {
            rsn: job.args.rsn,
            skillKeys: job.args.skillKeys,
          });
          break;
        case "wiseOldManEfficiencyTimelines":
          await ctx.runAction(
            internal.wiseOldMan.refreshEfficiencyTimelineCaches,
            {
              rsn: job.args.rsn,
              metrics: job.args.metrics,
            },
          );
          break;
        case "runeProfilePlayer":
          await ctx.runAction(internal.sources.runeProfile.refreshPlayer, {
            playerId: job.args.playerId,
            rsn: job.args.rsn,
            requestId: job.args.requestId,
          });
          break;
        case "runeProfileCollectionDetail": {
          const collectionLog = await fetchRuneProfileCollectionLog(
            job.args.rsn,
            {
              apiKey: env.RUNEPROFILE_API_KEY,
              userAgent: "RuneRating/0.1",
            },
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
            await ctx.runMutation(internal.providerQueue.failJob, {
              jobId: job._id,
              errorCode: "notConnected",
              retryAfterMs: null,
              retryable: false,
            });
            return null;
          }
          await capturePostHogEvent({
            event: "refresh_result",
            distinctId: await analyticsDistinctIdForRsn(job.args.rsn),
            properties: {
              source: "runeProfile",
              category: "collection_detail",
              status: "fresh",
              duration_ms: durationMs(startedAt),
              error_code: null,
              queued: true,
            },
          });
          break;
        }
      }

      await ctx.runMutation(internal.providerQueue.completeJob, {
        jobId: job._id,
      });
    } catch (error) {
      const requestError = providerError(error);
      await ctx.runMutation(internal.providerQueue.failJob, {
        jobId: job._id,
        errorCode: requestError.code,
        retryAfterMs: requestError.retryAfterMs,
        retryable: requestError.retryable,
      });
      await capturePostHogEvent({
        event: "refresh_result",
        distinctId: await analyticsDistinctIdForRsn(job.args.rsn),
        properties: {
          source: job.provider,
          category: job.operation,
          status:
            requestError.code === "notConnected"
              ? "notConnected"
              : requestError.code === "rateLimited"
                ? "rateLimited"
                : "failed",
          duration_ms: durationMs(startedAt),
          error_code: requestError.code,
          queued: true,
        },
      });
    }
    return null;
  },
});
