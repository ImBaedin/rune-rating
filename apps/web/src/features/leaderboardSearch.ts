import { normalizeRsn } from "@rune-rating/domain";

export function leaderboardSearchInput(value: string) {
  if (!value.trim()) return { query: "", error: null };
  try {
    return { query: normalizeRsn(value), error: null };
  } catch {
    return {
      query: "",
      error: "Use 1–12 letters, numbers, spaces, underscores, or hyphens.",
    };
  }
}
