import type { Provider, QueueJob } from "./providerQueueTypes";

export const RUNEPROFILE_SPACING_MS = 600;
export const WISE_OLD_MAN_SPACING_MS = 700;
export const JOB_LEASE_MS = 2 * 60 * 1_000;
export const MAX_JOBS_PER_PUMP = 5;
export const MAX_ATTEMPTS = 4;
export const FAILED_BACKOFF_MS = 5 * 60 * 1_000;
export const TIMEOUT_BACKOFF_MS = 60 * 1_000;
export const RATE_LIMIT_BACKOFF_MS = 60 * 1_000;

export function providerSpacingMs(provider: Provider) {
  return provider === "wiseOldMan"
    ? WISE_OLD_MAN_SPACING_MS
    : RUNEPROFILE_SPACING_MS;
}

export function jobRequestCost(job: Pick<QueueJob, "operation" | "args">) {
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
