import { createFileRoute } from "@tanstack/react-router";
import { ratingImageResponse } from "../../features/og/render";

export const Route = createFileRoute("/og/rating.png")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        ratingImageResponse({
          displayRsn: "RuneRating",
          status: "pending",
          score: null,
          tier: "Unranked",
          percentileLabel: "Generate a current player rating",
          stats: [
            { label: "Source", value: "Hiscores" },
            { label: "Signals", value: "7" },
            { label: "Refresh", value: "Hourly" },
          ],
          pillars: [],
          message: "Current canonical OSRS profile scoring",
        }, {
          origin: new URL(request.url).origin,
        }),
    },
  },
});
