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
