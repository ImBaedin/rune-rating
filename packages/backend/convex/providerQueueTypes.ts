import type { Doc, Id } from "./_generated/dataModel";

export type Provider = "wiseOldMan" | "runeProfile";
export type QueueJob = Doc<"providerJobs">;
export type JobArgs = QueueJob["args"];
export type Operation = QueueJob["operation"];
export type QueueViewStatus =
  | "idle"
  | "queued"
  | "running"
  | "retrying"
  | "succeeded"
  | "failed";

export type RunningProviderJob = {
  _id: Id<"providerJobs">;
  provider: Provider;
  operation: Operation;
  args: JobArgs;
  startedAt: number;
};
