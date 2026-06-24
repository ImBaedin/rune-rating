import { normalizeRsn } from "@rune-rating/domain";
import { createFileRoute } from "@tanstack/react-router";
import { ratingHead } from "../features/og/meta";
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
  head: ({ match }) =>
    ratingHead((match.search as { rsn?: string }).rsn),
  component: RatingPage,
});
