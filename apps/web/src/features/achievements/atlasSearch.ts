import { normalizeRsn } from "@rune-rating/domain";

export function atlasSearch(search: Record<string, unknown>): { rsn?: string } {
  if (typeof search.rsn !== "string") return {};
  try {
    return { rsn: normalizeRsn(search.rsn) };
  } catch {
    return {};
  }
}
