import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  categoryDataValidator,
  categoryValidator,
  providerQueueJobArgsValidator,
  providerQueueJobStatusValidator,
  providerQueueOperationValidator,
  providerQueueProviderValidator,
  snapshotStatusValidator,
  sourceValidator,
  wiseOldManEhbBossRateValidator,
  wiseOldManEhpSkillRateValidator,
} from "./validators";

export default defineSchema({
  players: defineTable({
    normalizedRsn: v.string(),
    displayRsn: v.string(),
    createdAt: v.number(),
    lastRequestedAt: v.number(),
    lastSnapshotAt: v.union(v.number(), v.null()),
    refreshAllowedAt: v.number(),
    accountTypeKey: v.optional(v.string()),
    accountTypeName: v.optional(v.string()),
    accountTypeSource: v.optional(sourceValidator),
    groupName: v.optional(v.union(v.string(), v.null())),
  })
    .index("by_normalized_rsn", ["normalizedRsn"])
    .index("by_refresh_allowed_at", ["refreshAllowedAt"]),

  snapshotStates: defineTable({
    key: v.string(),
    playerId: v.id("players"),
    source: sourceValidator,
    category: categoryValidator,
    status: snapshotStatusValidator,
    requestId: v.string(),
    lastAttemptAt: v.number(),
    lastSuccessAt: v.union(v.number(), v.null()),
    errorCode: v.union(v.string(), v.null()),
  }).index("by_key", ["key"]),

  categorySnapshots: defineTable({
    key: v.string(),
    playerId: v.id("players"),
    source: sourceValidator,
    category: categoryValidator,
    segment: v.string(),
    fetchedAt: v.number(),
    completeness: v.literal("complete"),
    data: categoryDataValidator,
  })
    .index("by_key", ["key"])
    .index("by_player_and_category", ["playerId", "category"]),

  canonicalItems: defineTable({
    key: v.string(),
    playerId: v.id("players"),
    source: sourceValidator,
    category: categoryValidator,
    revision: v.string(),
    itemKey: v.string(),
    label: v.string(),
    group: v.string(),
    state: v.union(v.string(), v.null()),
    completed: v.union(v.boolean(), v.null()),
    current: v.union(v.number(), v.null()),
    total: v.union(v.number(), v.null()),
    points: v.union(v.number(), v.null()),
  })
    .index("by_key", ["key"])
    .index("by_player_and_category", ["playerId", "category"])
    .index("by_player_and_category_and_group", [
      "playerId",
      "category",
      "group",
    ])
    .index("by_player_and_category_and_item_key", [
      "playerId",
      "category",
      "itemKey",
    ])
    .index("by_player_and_category_and_revision", [
      "playerId",
      "category",
      "revision",
    ])
    .index("by_player_and_category_and_revision_and_item_key", [
      "playerId",
      "category",
      "revision",
      "itemKey",
    ])
    .index("by_player_and_category_and_revision_and_group", [
      "playerId",
      "category",
      "revision",
      "group",
    ]),

  refreshLeases: defineTable({
    playerId: v.id("players"),
    requestId: v.string(),
    leaseUntil: v.number(),
  }).index("by_player", ["playerId"]),

  wiseOldManOverviewCaches: defineTable({
    normalizedRsn: v.string(),
    displayRsn: v.string(),
    fetchedAt: v.union(v.number(), v.null()),
    refreshAllowedAt: v.number(),
    requestId: v.union(v.string(), v.null()),
    timeline: v.array(
      v.object({
        date: v.number(),
        value: v.number(),
      }),
    ),
    sevenDayGained: v.union(v.number(), v.null()),
  }).index("by_normalized_rsn", ["normalizedRsn"]),

  wiseOldManSkillGainsCaches: defineTable({
    key: v.string(),
    normalizedRsn: v.string(),
    displayRsn: v.string(),
    period: v.string(),
    fetchedAt: v.union(v.number(), v.null()),
    refreshAllowedAt: v.number(),
    requestId: v.union(v.string(), v.null()),
    gains: v.array(
      v.object({
        key: v.string(),
        gained: v.union(v.number(), v.null()),
        start: v.union(v.number(), v.null()),
        end: v.union(v.number(), v.null()),
      }),
    ),
  }).index("by_key", ["key"]),

  wiseOldManSkillTimelineCaches: defineTable({
    key: v.string(),
    normalizedRsn: v.string(),
    displayRsn: v.string(),
    skillKey: v.string(),
    fetchedAt: v.union(v.number(), v.null()),
    refreshAllowedAt: v.number(),
    requestId: v.union(v.string(), v.null()),
    errorCode: v.optional(v.union(v.string(), v.null())),
    timeline: v.array(
      v.object({
        date: v.number(),
        value: v.number(),
      }),
    ),
  }).index("by_key", ["key"]),

  wiseOldManEfficiencyTimelineCaches: defineTable({
    key: v.string(),
    normalizedRsn: v.string(),
    displayRsn: v.string(),
    metric: v.union(v.literal("ehp"), v.literal("ehb")),
    fetchedAt: v.union(v.number(), v.null()),
    refreshAllowedAt: v.number(),
    requestId: v.union(v.string(), v.null()),
    errorCode: v.optional(v.union(v.string(), v.null())),
    timeline: v.array(
      v.object({
        date: v.number(),
        value: v.number(),
      }),
    ),
  }).index("by_key", ["key"]),

  wiseOldManEfficiencyRates: defineTable({
    key: v.string(),
    type: v.literal("ironman"),
    fetchedAt: v.number(),
    ehpSkills: v.array(wiseOldManEhpSkillRateValidator),
    ehbBosses: v.array(wiseOldManEhbBossRateValidator),
  }).index("by_key", ["key"]),

  runtimeConfig: defineTable({
    key: v.string(),
    numberValue: v.number(),
  }).index("by_key", ["key"]),

  providerJobs: defineTable({
    provider: providerQueueProviderValidator,
    operation: providerQueueOperationValidator,
    dedupeKey: v.string(),
    rsnKey: v.optional(v.string()),
    args: providerQueueJobArgsValidator,
    status: providerQueueJobStatusValidator,
    priority: v.number(),
    nextAttemptAt: v.number(),
    attempts: v.number(),
    leaseUntil: v.union(v.number(), v.null()),
    estimatedRunAt: v.union(v.number(), v.null()),
    startedAt: v.union(v.number(), v.null()),
    completedAt: v.union(v.number(), v.null()),
    lastErrorCode: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_dedupe_key", ["dedupeKey"])
    .index("by_status_and_next_attempt_at", ["status", "nextAttemptAt"])
    .index("by_provider_and_rsn_key_and_status", [
      "provider",
      "rsnKey",
      "status",
    ])
    .index("by_provider_and_operation_and_status_and_estimated_run_at", [
      "provider",
      "operation",
      "status",
      "estimatedRunAt",
    ])
    .index("by_provider_and_status_and_estimated_run_at", [
      "provider",
      "status",
      "estimatedRunAt",
    ]),

  providerRateLimits: defineTable({
    provider: providerQueueProviderValidator,
    nextAvailableAt: v.number(),
    spacingMs: v.number(),
    updatedAt: v.number(),
  }).index("by_provider", ["provider"]),
});
