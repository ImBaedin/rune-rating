import { createFileRoute } from "@tanstack/react-router";
import { leaderboardSearch } from "../features/viewSearch";
import { LeaderboardPage } from "../LeaderboardPage";

export const Route = createFileRoute("/leaderboard")({
  validateSearch: leaderboardSearch,
  head: () => ({
    meta: [
      {
        title: "RuneRating Leaderboard",
      },
    ],
  }),
  component: LeaderboardPage,
});
