import { normalizeRsn } from "@rune-rating/domain";
import { createFileRoute } from "@tanstack/react-router";
import { RatingPage } from "../RatingPage";

const optionalRsn = (value: unknown) => {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  try {
    return normalizeRsn(value);
  } catch {
    return undefined;
  }
};

export const Route = createFileRoute("/rating")({
  validateSearch: (search: Record<string, unknown>) => ({
    rsn: optionalRsn(search.rsn),
  }),
  component: RatingPage,
});
