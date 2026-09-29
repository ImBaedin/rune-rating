import { v } from "convex/values";

const evidenceFields = {
  key: v.string(),
  label: v.string(),
  met: v.union(v.boolean(), v.null()),
  current: v.union(v.number(), v.null()),
  target: v.union(v.number(), v.null()),
  reason: v.union(v.string(), v.null()),
};
export const achievementEvidenceFields = {
  ...evidenceFields,
  evidence: v.array(v.object(evidenceFields)),
  readiness: v.optional(
    v.object({
      met: v.union(v.boolean(), v.null()),
      reason: v.union(v.string(), v.null()),
      evidence: v.array(v.object(evidenceFields)),
    }),
  ),
  collectionLog: v.optional(
    v.object({
      items: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          itemId: v.number(),
          obtained: v.boolean(),
        }),
      ),
    }),
  ),
  breakdown: v.optional(
    v.object({
      label: v.string(),
      unit: v.union(v.literal("XP"), v.literal("levels"), v.literal("slots")),
      items: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          current: v.number(),
          target: v.number(),
          milestoneId: v.optional(v.string()),
        }),
      ),
    }),
  ),
  contributors: v.optional(
    v.object({
      label: v.string(),
      items: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          milestoneId: v.optional(v.string()),
        }),
      ),
    }),
  ),
};
export const achievementEvidenceValidator = v.object(achievementEvidenceFields);
export const achievementSourceFreshnessValidator = v.object({
  key: v.union(
    ...(
      [
        "skills",
        "activities",
        "quests",
        "diaries",
        "combatAchievements",
        "collectionSummary",
        "collectionDetail",
      ] as const
    ).map((key) => v.literal(key)),
  ),
  label: v.string(),
  provider: v.union(v.literal("Hiscores"), v.literal("RuneProfile")),
  status: v.union(
    v.literal("fresh"),
    v.literal("stale"),
    v.literal("refreshing"),
    v.literal("failed"),
    v.literal("missing"),
  ),
  fetchedAt: v.union(v.number(), v.null()),
  staleAt: v.union(v.number(), v.null()),
  reason: v.union(v.string(), v.null()),
});
