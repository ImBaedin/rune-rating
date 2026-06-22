export const sources = ["hiscores", "wiseOldMan", "runeProfile"] as const;
export type Source = (typeof sources)[number];

export const categories = [
  "skills",
  "activities",
  "clues",
  "bossing",
  "minigames",
  "efficiency",
  "quests",
  "diaries",
  "combatAchievements",
  "collection",
] as const;
export type Category = (typeof categories)[number];

export type AvailabilityReason = "unranked" | "unavailable";

export type CanonicalValue = {
  value: number | null;
  availabilityReason: AvailabilityReason | null;
};

export type CanonicalSkill = {
  key: string;
  name: string;
  rank: CanonicalValue;
  level: CanonicalValue;
  xp: CanonicalValue;
};

export type CanonicalActivity = {
  key: string;
  name: string;
  category: "activities" | "clues" | "bossing" | "minigames";
  rank: CanonicalValue;
  score: CanonicalValue;
};

export type HiscoresSnapshot = {
  source: "hiscores";
  displayRsn: string;
  fetchedAt: number;
  skills: CanonicalSkill[];
  activities: CanonicalActivity[];
};

export type EfficiencySnapshot = {
  source: "wiseOldMan";
  displayRsn: string;
  fetchedAt: number;
  accountType: string;
  accountBuild: string;
  combatLevel: number;
  ehp: number;
  ehb: number;
  timeToMax: number;
  timeTo200m: number;
};

export type ComparisonLeader = "left" | "right" | "tie" | "indeterminate";

export type NumericComparison = {
  left: number | null;
  right: number | null;
  delta: number | null;
  leader: ComparisonLeader;
};
