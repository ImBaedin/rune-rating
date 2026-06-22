import { normalizeRsn } from "@rune-rating/domain";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { type AppView, comparisonPath, defaultRsns } from "../App";

const optionalRsn = (value: unknown) => {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  try {
    return normalizeRsn(value);
  } catch {
    return undefined;
  }
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    left: optionalRsn(search.left),
    right: optionalRsn(search.right),
    view:
      search.view === "skills" ||
      search.view === "timeline" ||
      search.view === "efficiency" ||
      search.view === "activity" ||
      search.view === "quests" ||
      search.view === "achievement-diaries" ||
      search.view === "combat-achievements" ||
      search.view === "bossing" ||
      search.view === "clues" ||
      search.view === "minigames" ||
      search.view === "collections"
        ? search.view
        : undefined,
  }),
  beforeLoad: ({ search }) => {
    const rsns: [string, string] = [
      search.left ?? defaultRsns[0],
      search.right ?? defaultRsns[1],
    ];
    throw redirect({
      to: comparisonPath((search.view ?? "overview") as AppView, rsns),
      replace: true,
    });
  },
});
