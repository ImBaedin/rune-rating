import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "../LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RuneRating — OSRS player stats" },
      {
        name: "description",
        content:
          "Look up a player’s rating, stats, and account progress. Compare Old School RuneScape players across skills, bossing, quests, and collections.",
      },
    ],
  }),
  component: LandingPage,
});
