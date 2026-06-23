import { rsnLookupKey } from "@rune-rating/domain";
import { internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server.js";
import {
  MAX_ATTEMPTS,
  MAX_JOBS_PER_PUMP,
  providerSpacingMs,
  TIMEOUT_BACKOFF_MS,
} from "./providerQueueConfig";
import type { JobArgs, Operation, Provider } from "./providerQueueTypes";
import {
  dedupeKeyFor,
  isActiveQueuedJob,
  providerFor,
} from "./providerQueueViews";

export async function reserveProviderSlot(
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

export async function enqueueProviderJob(
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

  if (existing && isActiveQueuedJob(existing, now)) {
    return existing._id;
  }

  const value = {
    provider: providerFor(args.operation),
    operation: args.operation,
    rsnKey: rsnLookupKey(args.jobArgs.rsn),
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

export async function reclaimExpiredLeases(ctx: MutationCtx, now: number) {
  const [scheduled, running] = await Promise.all([
    ctx.db
      .query("providerJobs")
      .withIndex("by_status_and_next_attempt_at", (index) =>
        index.eq("status", "scheduled"),
      )
      .take(MAX_JOBS_PER_PUMP),
    ctx.db
      .query("providerJobs")
      .withIndex("by_status_and_next_attempt_at", (index) =>
        index.eq("status", "running"),
      )
      .take(MAX_JOBS_PER_PUMP),
  ]);
  const expiredJobs = [...scheduled, ...running].filter(
    (job) => job.leaseUntil !== null && job.leaseUntil < now,
  );

  for (const job of expiredJobs) {
    const attempts = job.attempts + 1;
    const retry = attempts < MAX_ATTEMPTS ? now + TIMEOUT_BACKOFF_MS : null;
    await ctx.db.patch(job._id, {
      status: retry === null ? "dead" : "queued",
      attempts,
      nextAttemptAt: retry ?? now,
      leaseUntil: null,
      estimatedRunAt: null,
      lastErrorCode: "timeout",
      updatedAt: now,
    });
    if (retry !== null) {
      await ctx.scheduler.runAt(retry, internal.providerQueue.pump, {});
    }
  }

  return expiredJobs.length;
}
