export type RatingDisplayCard = {
  ehp: number;
  ehb: number;
  adjustedEhp: number | null;
  adjustedEhb: number | null;
  efficiencyRateType: "ironman" | null;
  prestigeStats: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
};

export function formatRatingHours(value: number) {
  return value >= 1_000
    ? `${(value / 1_000).toFixed(1)}k`
    : Math.round(value).toLocaleString("en-US");
}

export function ratingDisplayPrestigeStats(card: RatingDisplayCard) {
  const shownEhp = card.adjustedEhp ?? card.ehp;
  const shownEhb = card.adjustedEhb ?? card.ehb;
  const hasAdjustedEfficiency =
    card.adjustedEhp !== null || card.adjustedEhb !== null;

  return card.prestigeStats.map((stat) => {
    if (stat.label !== "EHP / EHB") return stat;

    return {
      ...stat,
      label: hasAdjustedEfficiency ? "Adjusted EHP / EHB" : stat.label,
      value: `${formatRatingHours(shownEhp)} / ${formatRatingHours(shownEhb)}`,
      detail:
        card.efficiencyRateType === "ironman"
          ? "GIM adjusted with WOM ironman rates"
          : stat.detail,
    };
  });
}

const accountBuildLabels: Record<string, string> = {
  main: "Main",
  f2p: "F2P",
  lvl3: "Level 3",
  level3: "Level 3",
  "1def": "1 Def",
  def1: "1 Def",
  zerker: "Zerker",
};

const accountTypeLabels: Record<string, string> = {
  regular: "Regular",
  ironman: "Ironman",
  hardcore_ironman: "Hardcore Ironman",
  ultimate_ironman: "Ultimate Ironman",
  group_ironman: "Group Ironman",
  unranked_group_ironman: "Unranked Group Ironman",
  ranked_group_ironman: "Ranked Group Ironman",
};

function titleCaseParts(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(" ");
}

export function formatAccountBuild(value: string) {
  const key = value.trim().toLocaleLowerCase();
  if (!key) return "";
  const compactKey = key.replace(/[\s_-]+/g, "");
  const mapped = accountBuildLabels[key] ?? accountBuildLabels[compactKey];
  if (mapped) return mapped;
  return titleCaseParts(key);
}

export function formatAccountType(value: string) {
  const key = value.trim().toLocaleLowerCase();
  if (!key) return "";
  const snakeKey = key.replace(/[\s-]+/g, "_");
  return accountTypeLabels[snakeKey] ?? titleCaseParts(key);
}
