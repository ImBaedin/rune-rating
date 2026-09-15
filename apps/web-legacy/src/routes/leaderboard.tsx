import { createFileRoute } from "@tanstack/react-router";
import { LeaderboardPage } from "../LeaderboardPage";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      {
        title: "RuneRating Leaderboard",
      },
    ],
  }),
  component: LeaderboardPage,
});
