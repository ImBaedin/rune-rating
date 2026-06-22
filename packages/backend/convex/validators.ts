import { v } from "convex/values";

export const sourceValidator = v.union(
  v.literal("hiscores"),
  v.literal("wiseOldMan"),
  v.literal("runeProfile"),
);

export const categoryValidator = v.union(
  v.literal("skills"),
  v.literal("activities"),
  v.literal("efficiency"),
  v.literal("quests"),
  v.literal("diaries"),
  v.literal("combatAchievements"),
  v.literal("collection"),
);

export const snapshotStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("refreshing"),
  v.literal("fresh"),
  v.literal("failed"),
  v.literal("notFound"),
  v.literal("notConnected"),
  v.literal("rateLimited"),
);

export const availabilityReasonValidator = v.union(
  v.literal("unranked"),
  v.literal("unavailable"),
);

export const canonicalValueValidator = v.object({
  value: v.union(v.number(), v.null()),
  availabilityReason: v.union(availabilityReasonValidator, v.null()),
});

export const canonicalSkillValidator = v.object({
  key: v.string(),
  name: v.string(),
  rank: canonicalValueValidator,
  level: canonicalValueValidator,
  xp: canonicalValueValidator,
});

export const canonicalActivityValidator = v.object({
  key: v.string(),
  name: v.string(),
  category: v.union(
    v.literal("activities"),
    v.literal("clues"),
    v.literal("bossing"),
    v.literal("minigames"),
  ),
  rank: canonicalValueValidator,
  score: canonicalValueValidator,
});

export const skillsDataValidator = v.object({
  type: v.literal("skills"),
  values: v.array(canonicalSkillValidator),
});

export const activitiesDataValidator = v.object({
  type: v.literal("activities"),
  values: v.array(canonicalActivityValidator),
});

export const efficiencyDataValidator = v.object({
  type: v.literal("efficiency"),
  accountType: v.string(),
  accountBuild: v.string(),
  combatLevel: v.number(),
  ehp: v.number(),
  ehb: v.number(),
  timeToMax: v.number(),
  timeTo200m: v.number(),
});

export const questsDataValidator = v.object({
  type: v.literal("quests"),
  completed: v.number(),
  started: v.number(),
  notStarted: v.number(),
  total: v.number(),
  earnedPoints: v.number(),
  totalPoints: v.number(),
});

export const diariesDataValidator = v.object({
  type: v.literal("diaries"),
  completed: v.number(),
  total: v.number(),
});

export const combatAchievementsDataValidator = v.object({
  type: v.literal("combatAchievements"),
  completed: v.number(),
  total: v.number(),
  points: v.number(),
  tierReached: v.union(v.string(), v.null()),
});

export const collectionDataValidator = v.object({
  type: v.literal("collection"),
  obtained: v.number(),
  total: v.number(),
});

export const categoryDataValidator = v.union(
  skillsDataValidator,
  activitiesDataValidator,
  efficiencyDataValidator,
  questsDataValidator,
  diariesDataValidator,
  combatAchievementsDataValidator,
  collectionDataValidator,
);

export const canonicalItemValidator = v.object({
  key: v.string(),
  label: v.string(),
  group: v.string(),
  state: v.union(v.string(), v.null()),
  completed: v.union(v.boolean(), v.null()),
  current: v.union(v.number(), v.null()),
  total: v.union(v.number(), v.null()),
  points: v.union(v.number(), v.null()),
});

export const comparisonLeaderValidator = v.union(
  v.literal("left"),
  v.literal("right"),
  v.literal("tie"),
  v.literal("indeterminate"),
);

export const numericComparisonValidator = v.object({
  left: v.union(v.number(), v.null()),
  right: v.union(v.number(), v.null()),
  delta: v.union(v.number(), v.null()),
  leader: comparisonLeaderValidator,
});

export const skillComparisonValidator = v.object({
  key: v.string(),
  name: v.string(),
  level: numericComparisonValidator,
  xp: numericComparisonValidator,
  rank: numericComparisonValidator,
});

export const activityComparisonValidator = v.object({
  key: v.string(),
  name: v.string(),
  category: v.union(
    v.literal("activities"),
    v.literal("clues"),
    v.literal("bossing"),
    v.literal("minigames"),
  ),
  score: numericComparisonValidator,
  rank: numericComparisonValidator,
});

export const efficiencyComparisonValidator = v.object({
  combatLevel: numericComparisonValidator,
  ehp: numericComparisonValidator,
  ehb: numericComparisonValidator,
  timeToMax: numericComparisonValidator,
  timeTo200m: numericComparisonValidator,
});

export const snapshotStateViewValidator = v.object({
  status: snapshotStatusValidator,
  lastAttemptAt: v.number(),
  lastSuccessAt: v.union(v.number(), v.null()),
  errorCode: v.union(v.string(), v.null()),
});
