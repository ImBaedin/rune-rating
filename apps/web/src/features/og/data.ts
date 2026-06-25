import { api } from "@rune-rating/backend/convex/_generated/api";
import { normalizeRsn } from "@rune-rating/domain";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { ratingDisplayPrestigeStats } from "../ratingDisplay";

type RuneRatingResult = FunctionReturnType<typeof api.runeRating.get>;
type SkillsComparison = FunctionReturnType<typeof api.comparisons.getSkills>;
type EfficiencyComparison = FunctionReturnType<
  typeof api.comparisons.getEfficiency
>;
type PlayerProfile = FunctionReturnType<typeof api.players.getProfile>;

export type RatingOgModel = {
  displayRsn: string;
  status: "ready" | "pending" | "unavailable";
  score: number | null;
  tier: string;
  percentileLabel: string;
  stats: Array<{ label: string; value: string }>;
  pillars: Array<{ label: string; score: number; maxScore: number }>;
  message: string;
};

export type CompareOgModel = {
  left: string;
  right: string;
  leftTier: string | null;
  rightTier: string | null;
  status: "ready" | "pending";
  leader: "left" | "right" | "tie" | "unknown";
  leaderLabel: string;
  stats: Array<{
    label: string;
    left: string;
    right: string;
    leader: "left" | "right" | "tie" | "unknown";
  }>;
  message: string;
};

const unavailableRating = (rsn: string, message: string): RatingOgModel => ({
  displayRsn: rsn,
  status: "unavailable",
  score: null,
  tier: "Unranked",
  percentileLabel: "Current snapshots unavailable",
  stats: [
    { label: "Status", value: "Refresh" },
    { label: "Source", value: "Convex" },
    { label: "Identity", value: "RSN" },
  ],
  pillars: [],
  message,
});

function convexClient() {
  const url = import.meta.env.VITE_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
}

function compact(value: number | null | undefined) {
  if (value === null || value === undefined) return "N/A";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString("en-US");
}

function hours(value: number | null | undefined) {
  if (value === null || value === undefined) return "N/A";
  return value >= 1_000
    ? `${(value / 1_000).toFixed(1)}k`
    : Math.round(value).toLocaleString("en-US");
}

function displayFromProfile(profile: PlayerProfile, fallback: string) {
  return profile?.displayRsn ?? fallback;
}

function valueLeader(
  left: number | null | undefined,
  right: number | null | undefined,
  lowerIsBetter = false,
): "left" | "right" | "tie" | "unknown" {
  if (
    left === null ||
    left === undefined ||
    right === null ||
    right === undefined
  ) {
    return "unknown";
  }
  if (left === right) return "tie";
  return lowerIsBetter
    ? left < right
      ? "left"
      : "right"
    : left > right
      ? "left"
      : "right";
}

function summarizeLeader(
  stats: Array<{ leader: "left" | "right" | "tie" | "unknown" }>,
) {
  const left = stats.filter((stat) => stat.leader === "left").length;
  const right = stats.filter((stat) => stat.leader === "right").length;
  if (left === 0 && right === 0) return "unknown";
  if (left === right) return "tie";
  return left > right ? "left" : "right";
}

function ratingFromResult(result: RuneRatingResult, fallbackRsn: string) {
  if (result.status === "ready") {
    return {
      displayRsn: result.card.displayRsn,
      status: "ready" as const,
      score: result.card.score,
      tier: result.card.tier,
      percentileLabel: result.card.percentileLabel,
      stats: ratingDisplayPrestigeStats(result.card)
        .slice(0, 4)
        .map((stat) => ({
          label: stat.label,
          value: stat.value,
        })),
      pillars: result.card.pillars.map((pillar) => ({
        label: pillar.label,
        score: pillar.score,
        maxScore: pillar.maxScore,
      })),
      message: "Current canonical RuneRating snapshot",
    };
  }

  if (result.status === "refreshing") {
    return {
      ...unavailableRating(result.displayRsn, result.message),
      status: "pending" as const,
      percentileLabel: "Refresh in progress",
    };
  }

  if (result.status === "unavailable") {
    return unavailableRating(result.displayRsn, result.message);
  }

  return unavailableRating(fallbackRsn, result.message);
}

function tierFromRating(result: RuneRatingResult) {
  return result.status === "ready" ? result.card.tier : null;
}

export async function loadRatingOgModel(rsn: string): Promise<RatingOgModel> {
  let normalized: string;
  try {
    normalized = normalizeRsn(decodeURIComponent(rsn.replaceAll("+", " ")));
  } catch {
    return unavailableRating(
      rsn,
      "This RuneRating URL contains an invalid RSN.",
    );
  }

  const client = convexClient();
  if (!client) {
    return unavailableRating(
      normalized,
      "Set VITE_CONVEX_URL to render live RuneRating cards.",
    );
  }

  try {
    const result = await client.query(api.runeRating.get, { rsn: normalized });
    return ratingFromResult(result, normalized);
  } catch {
    return unavailableRating(
      normalized,
      "RuneRating could not load current snapshots for this card.",
    );
  }
}

function compareStats(
  skills: SkillsComparison,
  efficiency: EfficiencyComparison,
) {
  const overall = skills?.skills.find((skill) => skill.key === "skill.overall");
  const stats = [
    {
      label: "Total level",
      left: overall?.level.left ?? null,
      right: overall?.level.right ?? null,
      format: compact,
      lowerIsBetter: false,
    },
    {
      label: "Total XP",
      left: overall?.xp.left ?? null,
      right: overall?.xp.right ?? null,
      format: compact,
      lowerIsBetter: false,
    },
    {
      label: "Combat level",
      left: efficiency?.efficiency.combatLevel.left ?? null,
      right: efficiency?.efficiency.combatLevel.right ?? null,
      format: compact,
      lowerIsBetter: false,
    },
    {
      label: "EHP",
      left: efficiency?.efficiency.ehp.left ?? null,
      right: efficiency?.efficiency.ehp.right ?? null,
      format: hours,
      lowerIsBetter: false,
    },
    {
      label: "EHB",
      left: efficiency?.efficiency.ehb.left ?? null,
      right: efficiency?.efficiency.ehb.right ?? null,
      format: hours,
      lowerIsBetter: false,
    },
    {
      label: "Time to max",
      left: efficiency?.efficiency.timeToMax.left ?? null,
      right: efficiency?.efficiency.timeToMax.right ?? null,
      format: hours,
      lowerIsBetter: true,
    },
  ];

  return stats.map((stat) => ({
    label: stat.label,
    left: stat.format(stat.left),
    right: stat.format(stat.right),
    leader: valueLeader(stat.left, stat.right, stat.lowerIsBetter),
  }));
}

export async function loadCompareOgModel(
  leftRsn: string,
  rightRsn: string,
): Promise<CompareOgModel> {
  let left: string;
  let right: string;
  try {
    left = normalizeRsn(decodeURIComponent(leftRsn.replaceAll("+", " ")));
    right = normalizeRsn(decodeURIComponent(rightRsn.replaceAll("+", " ")));
  } catch {
    return {
      left: leftRsn,
      right: rightRsn,
      leftTier: null,
      rightTier: null,
      status: "pending",
      leader: "unknown",
      leaderLabel: "Invalid comparison URL",
      stats: [],
      message: "Player names must be valid OSRS RSNs.",
    };
  }

  const client = convexClient();
  if (!client) {
    return {
      left,
      right,
      leftTier: null,
      rightTier: null,
      status: "pending",
      leader: "unknown",
      leaderLabel: "Snapshots unavailable",
      stats: [],
      message: "Set VITE_CONVEX_URL to render live comparison cards.",
    };
  }

  try {
    const [
      leftProfile,
      rightProfile,
      skills,
      efficiency,
      leftRating,
      rightRating,
    ] = await Promise.all([
      client.query(api.players.getProfile, { rsn: left }),
      client.query(api.players.getProfile, { rsn: right }),
      client.query(api.comparisons.getSkills, {
        leftRsn: left,
        rightRsn: right,
      }),
      client.query(api.comparisons.getEfficiency, {
        leftRsn: left,
        rightRsn: right,
      }),
      client.query(api.runeRating.get, { rsn: left }),
      client.query(api.runeRating.get, { rsn: right }),
    ]);
    const leftDisplay = displayFromProfile(leftProfile, left);
    const rightDisplay = displayFromProfile(rightProfile, right);
    const leftTier = tierFromRating(leftRating);
    const rightTier = tierFromRating(rightRating);

    if (!skills && !efficiency) {
      return {
        left: leftDisplay,
        right: rightDisplay,
        leftTier,
        rightTier,
        status: "pending",
        leader: "unknown",
        leaderLabel: "Refresh needed",
        stats: [],
        message: "Comparison snapshots are not ready yet.",
      };
    }

    const stats = compareStats(skills, efficiency);
    const leader = summarizeLeader(stats);
    return {
      left: leftDisplay,
      right: rightDisplay,
      leftTier,
      rightTier,
      status: "ready",
      leader,
      leaderLabel:
        leader === "tie"
          ? "Even profile shape"
          : leader === "left"
            ? `${leftDisplay} leads more shared metrics`
            : leader === "right"
              ? `${rightDisplay} leads more shared metrics`
              : "Shared metrics pending",
      stats,
      message: "Current canonical comparison snapshot",
    };
  } catch {
    return {
      left,
      right,
      leftTier: null,
      rightTier: null,
      status: "pending",
      leader: "unknown",
      leaderLabel: "Snapshots unavailable",
      stats: [],
      message: "RuneRating could not load this comparison card.",
    };
  }
}
