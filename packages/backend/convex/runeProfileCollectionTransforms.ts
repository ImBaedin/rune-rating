import type { Doc } from "./_generated/dataModel";
import type { QueueViewStatus } from "./providerQueueTypes";

export type CollectionSideSummary = {
  fetchedAt: number;
  obtained: number;
  total: number;
  percent: number;
} | null;

export function collectionPercent(obtained: number, total: number) {
  return total === 0 ? 0 : (obtained / total) * 100;
}

export function collectionLeader(delta: number | null) {
  if (delta === null) return "indeterminate" as const;
  if (delta > 0) return "left" as const;
  if (delta < 0) return "right" as const;
  return "tie" as const;
}

export function collectionSnapshotValue(
  snapshot:
    | Pick<Doc<"categorySnapshots">, "fetchedAt" | "data">
    | null
    | undefined,
): CollectionSideSummary {
  if (snapshot?.data.type !== "collection") return null;
  const obtained = snapshot.data.obtained ?? 0;
  const total = snapshot.data.total ?? 0;
  return {
    fetchedAt: snapshot.fetchedAt,
    obtained,
    total,
    percent: collectionPercent(obtained, total),
  };
}

export function collectionItemComparisonKey(item: {
  points: number | null;
  label: string;
}) {
  return item.points === null
    ? `collection.item.${item.label.toLocaleLowerCase()}`
    : `collection.item.${item.points}`;
}

export function collectionRefreshStatusFromQueueJob(job: {
  status: QueueViewStatus;
  lastErrorCode: string | null;
}) {
  if (job.status === "succeeded") return "fresh" as const;
  if (job.status === "failed" && job.lastErrorCode === "notConnected") {
    return "notConnected" as const;
  }
  if (job.status === "failed" && job.lastErrorCode === "rateLimited") {
    return "rateLimited" as const;
  }
  if (job.status === "failed") return "failed" as const;
  if (job.status === "running") return "running" as const;
  if (job.status === "retrying") return "retrying" as const;
  return "queued" as const;
}
