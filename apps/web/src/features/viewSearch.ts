export type TimelineRange = "7d" | "30d" | "90d" | "1y";
export function timelineSearch(search: Record<string, unknown>): {
  range?: TimelineRange;
} {
  const range = search.range;
  return {
    range:
      range === "7d" || range === "30d" || range === "90d" || range === "1y"
        ? range
        : undefined,
  };
}

const accountTypes = new Set([
  "normal",
  "ironman",
  "hardcore_ironman",
  "ultimate_ironman",
  "group_ironman",
]);
export function leaderboardSearch(search: Record<string, unknown>): {
  account?: string;
} {
  return {
    account:
      typeof search.account === "string" && accountTypes.has(search.account)
        ? search.account
        : undefined,
  };
}
