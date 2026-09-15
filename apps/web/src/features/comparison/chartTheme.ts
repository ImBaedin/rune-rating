export const chartPlayerColors = {
  left: "var(--player-left)",
  right: "var(--player-right)",
} as const;

export const chartCategoryColors = [
  "var(--chart-series-1)",
  "var(--chart-series-2)",
  "var(--chart-series-3)",
  "var(--chart-series-4)",
  "var(--chart-series-5)",
  "var(--chart-series-6)",
  "var(--chart-series-7)",
  "var(--chart-series-8)",
] as const;

export const chartTierColors = {
  Easy: "var(--chart-tier-easy)",
  Medium: "var(--chart-tier-medium)",
  Hard: "var(--chart-tier-hard)",
  Elite: "var(--chart-tier-elite)",
  Master: "var(--chart-tier-master)",
  Grandmaster: "var(--chart-tier-grandmaster)",
} as const;

export const chartCategoryColor = (index: number) =>
  chartCategoryColors[index % chartCategoryColors.length] ??
  chartCategoryColors[5];

export const mutedChartColor = (color: string) =>
  `color-mix(in srgb, ${color} 20%, var(--surface-raised))`;
