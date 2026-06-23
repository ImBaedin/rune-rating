import { normalizeRsn, rsnLookupKey } from "@rune-rating/domain";
import type { QueryCtx } from "./_generated/server.js";
import type {
  JobArgs,
  Operation,
  Provider,
  QueueJob,
  QueueViewStatus,
} from "./providerQueueTypes";

export function collectionDetailDedupeKey(rsn: string) {
  return `runeProfile:collectionDetail:${rsnLookupKey(rsn)}`;
}

export function dedupeKeyFor(args: JobArgs) {
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

export function providerFor(operation: Operation): Provider {
  return operation.startsWith("wiseOldMan") ? "wiseOldMan" : "runeProfile";
}

export function queueViewStatus(
  job: QueueJob | null,
  now: number,
): QueueViewStatus {
  if (!job) return "idle";
  if (job.status === "dead") return "failed";
  if (job.status === "succeeded") return "succeeded";
  if (job.status === "running") return "running";
  if (job.attempts > 0 && job.nextAttemptAt > now) return "retrying";
  return "queued";
}

export function queueMessage(status: QueueViewStatus) {
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

export function isActiveQueuedJob(job: QueueJob, now: number) {
  if (job.status === "queued") return true;
  if (job.status !== "scheduled" && job.status !== "running") return false;
  return job.leaseUntil === null || job.leaseUntil >= now;
}

async function queuePosition(ctx: { db: QueryCtx["db"] }, job: QueueJob) {
  if (job.status !== "queued" && job.status !== "scheduled") return null;
  const [queued, scheduled] = await Promise.all([
    ctx.db
      .query("providerJobs")
      .withIndex(
        "by_provider_and_operation_and_status_and_estimated_run_at",
        (index) =>
          index
            .eq("provider", job.provider)
            .eq("operation", job.operation)
            .eq("status", "queued"),
      )
      .take(100),
    ctx.db
      .query("providerJobs")
      .withIndex(
        "by_provider_and_operation_and_status_and_estimated_run_at",
        (index) =>
          index
            .eq("provider", job.provider)
            .eq("operation", job.operation)
            .eq("status", "scheduled"),
      )
      .take(100),
  ]);
  const jobs = [...queued, ...scheduled].sort((left, right) => {
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

async function activeProviderJobsForRsn(
  ctx: { db: QueryCtx["db"] },
  provider: Provider,
  rsnKey: string,
) {
  const [running, scheduled, queued] = await Promise.all([
    ctx.db
      .query("providerJobs")
      .withIndex("by_provider_and_rsn_key_and_status", (index) =>
        index
          .eq("provider", provider)
          .eq("rsnKey", rsnKey)
          .eq("status", "running"),
      )
      .take(20),
    ctx.db
      .query("providerJobs")
      .withIndex("by_provider_and_rsn_key_and_status", (index) =>
        index
          .eq("provider", provider)
          .eq("rsnKey", rsnKey)
          .eq("status", "scheduled"),
      )
      .take(20),
    ctx.db
      .query("providerJobs")
      .withIndex("by_provider_and_rsn_key_and_status", (index) =>
        index
          .eq("provider", provider)
          .eq("rsnKey", rsnKey)
          .eq("status", "queued"),
      )
      .take(20),
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

async function terminalProviderJobsForRsn(
  ctx: { db: QueryCtx["db"] },
  provider: Provider,
  rsnKey: string,
) {
  const [succeeded, dead] = await Promise.all([
    ctx.db
      .query("providerJobs")
      .withIndex("by_provider_and_rsn_key_and_status", (index) =>
        index
          .eq("provider", provider)
          .eq("rsnKey", rsnKey)
          .eq("status", "succeeded"),
      )
      .take(20),
    ctx.db
      .query("providerJobs")
      .withIndex("by_provider_and_rsn_key_and_status", (index) =>
        index
          .eq("provider", provider)
          .eq("rsnKey", rsnKey)
          .eq("status", "dead"),
      )
      .take(20),
  ]);
  return [...succeeded, ...dead];
}

export async function providerQueueView(
  ctx: { db: QueryCtx["db"] },
  provider: Provider,
  rsns: string[],
) {
  const now = Date.now();
  const keys = new Set(rsns.map((rsn) => rsnLookupKey(rsn)));
  const indexedActiveJobs = (
    await Promise.all(
      [...keys].map((key) => activeProviderJobsForRsn(ctx, provider, key)),
    )
  ).flat();
  const activeJobs = (
    indexedActiveJobs.length > 0
      ? indexedActiveJobs
      : await activeProviderJobs(ctx, provider)
  )
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
  const indexedTerminalJobs =
    activeJobs.length === 0
      ? (
          await Promise.all(
            [...keys].map((key) =>
              terminalProviderJobsForRsn(ctx, provider, key),
            ),
          )
        ).flat()
      : [];
  const terminalJobs =
    activeJobs.length === 0
      ? (indexedTerminalJobs.length > 0
          ? indexedTerminalJobs
          : await terminalProviderJobs(ctx, provider)
        )
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

export async function collectionDetailView(
  ctx: { db: QueryCtx["db"] },
  rsn: string,
) {
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
