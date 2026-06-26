import type { Doc } from "../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../_generated/server.js";
import { categorySnapshotKey, snapshotStateKey } from "./keys";
import {
  calculateAdjustedEfficiency,
  shouldUseIronmanEfficiencyRates,
} from "./wiseOldManEfficiency";

export const tierNames = [
  "Bronze",
  "Iron",
  "Steel",
  "Black",
  "Mithril",
  "Adamant",
  "Rune",
  "Dragon",
] as const;

export const ratingFormulaVersion = "Formula v1";
export const ratingFormulaVersionKey = "formula-v1";

const activeStatuses = new Set(["scheduled", "refreshing"]);
const completeStatuses = new Set(["fresh"]);
const unavailableStatuses = new Set(["notConnected", "notFound"]);
const skillScoreCap = 260;
const combatScoreCap = 190;
const unlockScoreCap = 150;
const collectionScoreCap = 140;
const efficiencyScoreCap = 120;
const balanceScoreCap = 140;

export type TierName = (typeof tierNames)[number];

export type SourceState = {
  source: "hiscores" | "wiseOldMan" | "runeProfile";
  label: string;
  status:
    | "scheduled"
    | "refreshing"
    | "fresh"
    | "failed"
    | "notFound"
    | "notConnected"
    | "rateLimited"
    | null;
  lastSuccessAt: number | null;
  errorCode: string | null;
};

export type RuneRatingPillar = {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  detail: string;
};

export type RuneRatingPrestigeStat = {
  label: string;
  value: string;
  detail: string;
};

export type RuneRatingCard = {
  normalizedRsn: string;
  displayRsn: string;
  score: number;
  leaderboardRank: number | null;
  leaderboardRankedCount: number;
  leaderboardTopPercent: number | null;
  tier: TierName;
  tierIndex: number;
  tierProgress: number;
  percentileLabel: string;
  formulaVersion: string;
  fetchedAt: number;
  refreshAllowedAt: number;
  accountType: string;
  accountBuild: string;
  combatLevel: number;
  totalLevel: number;
  totalXp: number;
  maxedSkills: number;
  questPoints: number;
  totalQuestPoints: number;
  diaryCompleted: number;
  diaryTotal: number;
  combatAchievementTier: string | null;
  collectionObtained: number;
  collectionTotal: number;
  ehp: number;
  ehb: number;
  adjustedEhp: number | null;
  adjustedEhb: number | null;
  efficiencyRateType: "ironman" | null;
  pillars: RuneRatingPillar[];
  prestigeStats: RuneRatingPrestigeStat[];
  sources: SourceState[];
};

export type RuneRatingBuildResult =
  | {
      status: "refreshing";
      displayRsn: string;
      message: string;
      sources: SourceState[];
    }
  | {
      status: "unavailable";
      displayRsn: string;
      message: string;
      missingSources: string[];
      sources: SourceState[];
    }
  | { status: "ready"; card: RuneRatingCard };

type DbCtx = QueryCtx | MutationCtx;

function accountTypeLabel(
  player: { accountTypeName?: string; accountTypeKey?: string },
  fallback: string,
) {
  return player.accountTypeName ?? player.accountTypeKey ?? fallback;
}

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

const percent = (value: number, total: number) =>
  total <= 0 ? 0 : clamp(value / total);

const rounded = (value: number) => Math.round(clamp(value, 0, 1_000));

const compact = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString("en-US");
};

const hours = (value: number) =>
  value >= 1_000
    ? `${(value / 1_000).toFixed(1)}k`
    : Math.round(value).toLocaleString("en-US");

const metricValue = (value: { value: number | null } | null | undefined) =>
  value?.value ?? null;

export function tierFor(score: number): {
  tier: TierName;
  tierIndex: number;
  tierProgress: number;
} {
  const thresholds = [0, 150, 275, 400, 525, 650, 775, 875, 1_000];
  let tierIndex = tierNames.length - 1;
  for (let index = 0; index < tierNames.length; index += 1) {
    const threshold = thresholds[index] ?? 0;
    const next = thresholds[index + 1] ?? 1_001;
    if (score >= threshold && score < next) {
      tierIndex = index;
      break;
    }
  }
  const start = thresholds[tierIndex] ?? 0;
  const end = thresholds[tierIndex + 1] ?? 1_000;
  return {
    tier: tierNames[tierIndex] ?? "Bronze",
    tierIndex,
    tierProgress: clamp((score - start) / Math.max(1, end - start)),
  };
}

function stateView(
  state: {
    status: NonNullable<SourceState["status"]>;
    lastSuccessAt: number | null;
    errorCode: string | null;
  } | null,
  source: SourceState["source"],
  label: string,
): SourceState {
  return {
    source,
    label,
    status: state?.status ?? null,
    lastSuccessAt: state?.lastSuccessAt ?? null,
    errorCode: state?.errorCode ?? null,
  };
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export async function buildRuneRatingForPlayer(
  ctx: DbCtx,
  player: Doc<"players">,
): Promise<RuneRatingBuildResult> {
  const [
    skillsState,
    activitiesState,
    efficiencyState,
    questsState,
    diariesState,
    combatAchievementsState,
    collectionState,
    skillsSnapshot,
    activitiesSnapshot,
    efficiencySnapshot,
    questsSnapshot,
    diariesSnapshot,
    combatAchievementsSnapshot,
    collectionSnapshot,
    ironmanEfficiencyRates,
  ] = await Promise.all([
    ctx.db
      .query("snapshotStates")
      .withIndex("by_key", (index) =>
        index.eq("key", snapshotStateKey(player._id, "hiscores", "skills")),
      )
      .unique(),
    ctx.db
      .query("snapshotStates")
      .withIndex("by_key", (index) =>
        index.eq("key", snapshotStateKey(player._id, "hiscores", "activities")),
      )
      .unique(),
    ctx.db
      .query("snapshotStates")
      .withIndex("by_key", (index) =>
        index.eq(
          "key",
          snapshotStateKey(player._id, "wiseOldMan", "efficiency"),
        ),
      )
      .unique(),
    ctx.db
      .query("snapshotStates")
      .withIndex("by_key", (index) =>
        index.eq("key", snapshotStateKey(player._id, "runeProfile", "quests")),
      )
      .unique(),
    ctx.db
      .query("snapshotStates")
      .withIndex("by_key", (index) =>
        index.eq("key", snapshotStateKey(player._id, "runeProfile", "diaries")),
      )
      .unique(),
    ctx.db
      .query("snapshotStates")
      .withIndex("by_key", (index) =>
        index.eq(
          "key",
          snapshotStateKey(player._id, "runeProfile", "combatAchievements"),
        ),
      )
      .unique(),
    ctx.db
      .query("snapshotStates")
      .withIndex("by_key", (index) =>
        index.eq(
          "key",
          snapshotStateKey(player._id, "runeProfile", "collection"),
        ),
      )
      .unique(),
    ctx.db
      .query("categorySnapshots")
      .withIndex("by_key", (index) =>
        index.eq("key", categorySnapshotKey(player._id, "skills", "all")),
      )
      .unique(),
    ctx.db
      .query("categorySnapshots")
      .withIndex("by_key", (index) =>
        index.eq("key", categorySnapshotKey(player._id, "activities", "all")),
      )
      .unique(),
    ctx.db
      .query("categorySnapshots")
      .withIndex("by_key", (index) =>
        index.eq("key", categorySnapshotKey(player._id, "efficiency", "all")),
      )
      .unique(),
    ctx.db
      .query("categorySnapshots")
      .withIndex("by_key", (index) =>
        index.eq("key", categorySnapshotKey(player._id, "quests", "all")),
      )
      .unique(),
    ctx.db
      .query("categorySnapshots")
      .withIndex("by_key", (index) =>
        index.eq("key", categorySnapshotKey(player._id, "diaries", "all")),
      )
      .unique(),
    ctx.db
      .query("categorySnapshots")
      .withIndex("by_key", (index) =>
        index.eq(
          "key",
          categorySnapshotKey(player._id, "combatAchievements", "all"),
        ),
      )
      .unique(),
    ctx.db
      .query("categorySnapshots")
      .withIndex("by_key", (index) =>
        index.eq(
          "key",
          categorySnapshotKey(player._id, "collection", "summary"),
        ),
      )
      .unique(),
    ctx.db
      .query("wiseOldManEfficiencyRates")
      .withIndex("by_key", (index) => index.eq("key", "ironman"))
      .unique(),
  ]);

  const sources = [
    stateView(skillsState, "hiscores", "Hiscores skills"),
    stateView(activitiesState, "hiscores", "Hiscores activities"),
    stateView(efficiencyState, "wiseOldMan", "Wise Old Man efficiency"),
    stateView(questsState, "runeProfile", "RuneProfile quests"),
    stateView(diariesState, "runeProfile", "RuneProfile diaries"),
    stateView(
      combatAchievementsState,
      "runeProfile",
      "RuneProfile combat achievements",
    ),
    stateView(collectionState, "runeProfile", "RuneProfile collection"),
  ];

  if (sources.some((source) => activeStatuses.has(source.status ?? ""))) {
    return {
      status: "refreshing",
      displayRsn: player.displayRsn,
      message: "Refreshing provider snapshots for this account.",
      sources,
    };
  }

  const missingSources = [
    !completeStatuses.has(skillsState?.status ?? "") ? "Hiscores" : null,
    !completeStatuses.has(activitiesState?.status ?? "") ? "Hiscores" : null,
    !completeStatuses.has(efficiencyState?.status ?? "") ||
    unavailableStatuses.has(efficiencyState?.status ?? "")
      ? "Wise Old Man"
      : null,
    [questsState, diariesState, combatAchievementsState, collectionState].some(
      (state) =>
        !completeStatuses.has(state?.status ?? "") ||
        unavailableStatuses.has(state?.status ?? ""),
    )
      ? "RuneProfile"
      : null,
  ].filter((source): source is string => source !== null);
  const uniqueMissingSources = [...new Set(missingSources)];

  if (
    uniqueMissingSources.length > 0 ||
    skillsSnapshot?.data.type !== "skills" ||
    activitiesSnapshot?.data.type !== "activities" ||
    efficiencySnapshot?.data.type !== "efficiency" ||
    questsSnapshot?.data.type !== "quests" ||
    diariesSnapshot?.data.type !== "diaries" ||
    combatAchievementsSnapshot?.data.type !== "combatAchievements" ||
    collectionSnapshot?.data.type !== "collection"
  ) {
    const primaryMissing = uniqueMissingSources.filter((source) =>
      ["Wise Old Man", "RuneProfile"].includes(source),
    );
    const missing =
      primaryMissing.length > 0 ? primaryMissing : uniqueMissingSources;
    return {
      status: "unavailable",
      displayRsn: player.displayRsn,
      message:
        missing.length > 0
          ? `We can't generate a RuneRating until ${missing.join(" and ")} data is available for this RSN.`
          : "We can't generate a RuneRating until all provider snapshots finish successfully.",
      missingSources: missing,
      sources,
    };
  }

  const skills = skillsSnapshot.data.values.filter(
    (skill) => skill.key !== "skill.overall",
  );
  const overall = skillsSnapshot.data.values.find(
    (skill) => skill.key === "skill.overall",
  );
  const totalLevel =
    metricValue(overall?.level) ??
    skills.reduce((total, skill) => total + (metricValue(skill.level) ?? 0), 0);
  const totalXp =
    metricValue(overall?.xp) ??
    skills.reduce((total, skill) => total + (metricValue(skill.xp) ?? 0), 0);
  const skillCount = Math.max(1, skills.length);
  const maxTotalLevel = skillCount * 99;
  const maxTotalXp = skillCount * 200_000_000;
  const maxedSkills = skills.filter(
    (skill) => (metricValue(skill.level) ?? 0) >= 99,
  ).length;

  const skillScore =
    percent(totalLevel, maxTotalLevel) * 155 +
    Math.sqrt(percent(totalXp, maxTotalXp)) * 85 +
    percent(maxedSkills, skillCount) * 20;

  const bossActivities = activitiesSnapshot.data.values.filter(
    (activity) => activity.category === "bossing",
  );
  const bossScores = bossActivities
    .map((activity) => metricValue(activity.score) ?? 0)
    .filter((score) => score > 0);
  const bossBreadth = percent(
    bossScores.length,
    Math.max(1, bossActivities.length),
  );
  const bossDepth = clamp(
    bossScores.reduce(
      (total, score) => total + Math.log1p(score) / Math.log1p(2_500),
      0,
    ) / Math.max(1, bossActivities.length),
  );
  const combatCompletion = percent(
    combatAchievementsSnapshot.data.completed,
    combatAchievementsSnapshot.data.total,
  );
  const combatTierBonus = clamp(combatAchievementsSnapshot.data.points / 1_500);
  const combatScore =
    bossBreadth * 55 +
    bossDepth * 70 +
    combatCompletion * 45 +
    combatTierBonus * 20;

  const questPercent = percent(
    questsSnapshot.data.earnedPoints,
    questsSnapshot.data.totalPoints,
  );
  const diaryPercent = percent(
    diariesSnapshot.data.completed,
    diariesSnapshot.data.total,
  );
  const unlockScore = questPercent * 85 + diaryPercent * 65;

  const clueAll = activitiesSnapshot.data.values.find(
    (activity) => activity.name === "Clue Scrolls (all)",
  );
  const clueScore = metricValue(clueAll?.score) ?? 0;
  const minigameScores = activitiesSnapshot.data.values
    .filter((activity) => activity.category === "minigames")
    .map((activity) => metricValue(activity.score) ?? 0);
  const minigameBreadth = percent(
    minigameScores.filter((score) => score > 0).length,
    Math.max(1, minigameScores.length),
  );
  const collectionPercent = percent(
    collectionSnapshot.data.obtained,
    collectionSnapshot.data.total,
  );
  const collectionScore =
    collectionPercent * 75 +
    clamp(Math.log1p(clueScore) / Math.log1p(25_000)) * 35 +
    minigameBreadth * 30;

  const adjustedEfficiency =
    shouldUseIronmanEfficiencyRates(
      player.accountTypeKey ??
        player.accountTypeName ??
        efficiencySnapshot.data.accountType,
    ) && ironmanEfficiencyRates
      ? calculateAdjustedEfficiency(
          skillsSnapshot.data.values,
          activitiesSnapshot.data.values,
          ironmanEfficiencyRates.ehpSkills,
          ironmanEfficiencyRates.ehbBosses,
        )
      : null;
  const scoredEhp = adjustedEfficiency?.ehp ?? efficiencySnapshot.data.ehp;
  const scoredEhb = adjustedEfficiency?.ehb ?? efficiencySnapshot.data.ehb;

  const efficiencyScore =
    Math.sqrt(clamp(scoredEhp / 12_000)) * 50 +
    Math.sqrt(clamp(scoredEhb / 3_000)) * 45 +
    percent(efficiencySnapshot.data.combatLevel, 126) * 25;

  const pillarPercents = [
    skillScore / skillScoreCap,
    combatScore / combatScoreCap,
    unlockScore / unlockScoreCap,
    collectionScore / collectionScoreCap,
    efficiencyScore / efficiencyScoreCap,
  ];
  const accountBalance =
    average(pillarPercents) * 60 +
    (1 -
      Math.min(
        1,
        Math.sqrt(
          average(
            pillarPercents.map(
              (value) => (value - average(pillarPercents)) ** 2,
            ),
          ),
        ) * 2,
      )) *
      50 +
    percent(maxedSkills, skillCount) * 30;

  const pillars = [
    {
      key: "skills",
      label: "Skill mastery",
      score: rounded(skillScore),
      maxScore: skillScoreCap,
      detail: `${maxedSkills}/${skillCount} skills at 99, ${compact(totalXp)} XP`,
    },
    {
      key: "combat",
      label: "Bossing and combat proof",
      score: rounded(combatScore),
      maxScore: combatScoreCap,
      detail: `${bossScores.length} bosses logged, ${Math.round(combatCompletion * 100)}% combat tasks`,
    },
    {
      key: "unlocks",
      label: "World unlocks",
      score: rounded(unlockScore),
      maxScore: unlockScoreCap,
      detail: `${questsSnapshot.data.earnedPoints}/${questsSnapshot.data.totalPoints} quest points`,
    },
    {
      key: "collections",
      label: "Collections, clues, and minigames",
      score: rounded(collectionScore),
      maxScore: collectionScoreCap,
      detail: `${collectionSnapshot.data.obtained}/${collectionSnapshot.data.total} collection slots`,
    },
    {
      key: "efficiency",
      label: "Efficiency signal",
      score: rounded(efficiencyScore),
      maxScore: efficiencyScoreCap,
      detail:
        adjustedEfficiency === null
          ? `${hours(scoredEhp)} EHP, ${hours(scoredEhb)} EHB`
          : `${hours(scoredEhp)} adjusted EHP, ${hours(scoredEhb)} adjusted EHB`,
    },
    {
      key: "balance",
      label: "Account shape",
      score: rounded(accountBalance),
      maxScore: balanceScoreCap,
      detail: "Rewards broad progress across all scoring pillars",
    },
  ];
  const score = rounded(
    pillars.reduce((total, pillar) => total + pillar.score, 0),
  );
  const tier = tierFor(score);
  const fetchedAt = Math.min(
    skillsSnapshot.fetchedAt,
    activitiesSnapshot.fetchedAt,
    efficiencySnapshot.fetchedAt,
    questsSnapshot.fetchedAt,
    diariesSnapshot.fetchedAt,
    combatAchievementsSnapshot.fetchedAt,
    collectionSnapshot.fetchedAt,
  );

  return {
    status: "ready",
    card: {
      normalizedRsn: player.normalizedRsn,
      displayRsn: player.displayRsn,
      score,
      leaderboardRank: null,
      leaderboardRankedCount: 0,
      leaderboardTopPercent: null,
      ...tier,
      percentileLabel: "Leaderboard pending",
      formulaVersion: ratingFormulaVersion,
      fetchedAt,
      refreshAllowedAt: player.refreshAllowedAt,
      accountType: accountTypeLabel(
        player,
        efficiencySnapshot.data.accountType,
      ),
      accountBuild: efficiencySnapshot.data.accountBuild,
      combatLevel: efficiencySnapshot.data.combatLevel,
      totalLevel,
      totalXp,
      maxedSkills,
      questPoints: questsSnapshot.data.earnedPoints,
      totalQuestPoints: questsSnapshot.data.totalPoints,
      diaryCompleted: diariesSnapshot.data.completed,
      diaryTotal: diariesSnapshot.data.total,
      combatAchievementTier: combatAchievementsSnapshot.data.tierReached,
      collectionObtained: collectionSnapshot.data.obtained,
      collectionTotal: collectionSnapshot.data.total,
      ehp: efficiencySnapshot.data.ehp,
      ehb: efficiencySnapshot.data.ehb,
      adjustedEhp: adjustedEfficiency?.ehp ?? null,
      adjustedEhb: adjustedEfficiency?.ehb ?? null,
      efficiencyRateType:
        adjustedEfficiency === null ? null : ("ironman" as const),
      pillars,
      prestigeStats: [
        {
          label: "Total level",
          value: totalLevel.toLocaleString("en-US"),
          detail: `${maxedSkills}/${skillCount} skills at 99`,
        },
        {
          label: "Total XP",
          value: compact(totalXp),
          detail: "Hiscores-owned snapshot",
        },
        {
          label: "EHP / EHB",
          value: `${hours(scoredEhp)} / ${hours(scoredEhb)}`,
          detail:
            adjustedEfficiency === null
              ? "Wise Old Man efficiency"
              : "GIM adjusted with WOM ironman rates",
        },
        {
          label: "Quest points",
          value: `${questsSnapshot.data.earnedPoints}/${questsSnapshot.data.totalPoints}`,
          detail: `${Math.round(questPercent * 100)}% quest completion`,
        },
        {
          label: "Combat tier",
          value: combatAchievementsSnapshot.data.tierReached ?? "Unranked",
          detail: `${combatAchievementsSnapshot.data.completed}/${combatAchievementsSnapshot.data.total} tasks`,
        },
        {
          label: "Collection",
          value: `${Math.round(collectionPercent * 100)}%`,
          detail: `${collectionSnapshot.data.obtained}/${collectionSnapshot.data.total} slots`,
        },
      ],
      sources,
    },
  };
}
