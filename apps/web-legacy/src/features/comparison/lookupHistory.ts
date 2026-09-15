export const lookupHistoryKey = "rune-rating:player-lookups";

const maxLookupHistory = 12;

export const readLookupHistory = () => {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(lookupHistoryKey) ?? "[]",
    );
    return Array.isArray(stored)
      ? stored.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
};

export const addToLookupHistory = (history: string[], rsns: string[]) => {
  const next = [...history];
  for (const rsn of [...rsns].reverse()) {
    const existing = next.findIndex(
      (value) => value.toLocaleLowerCase() === rsn.toLocaleLowerCase(),
    );
    if (existing !== -1) next.splice(existing, 1);
    next.unshift(rsn);
  }
  return next.slice(0, maxLookupHistory);
};
