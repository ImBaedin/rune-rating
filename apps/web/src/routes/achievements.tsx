import { createFileRoute } from "@tanstack/react-router";
import flowCss from "@xyflow/react/dist/base.css?url";
import { atlasSearch } from "../features/achievements/atlasSearch";
import { AchievementsPage } from "../pages/AchievementsPage";
import atlasCss from "../pages/AchievementsPage.css?url";

export const Route = createFileRoute("/achievements")({
  validateSearch: atlasSearch,
  head: () => ({
    meta: [
      { title: "Achievement Atlas · RuneRating" },
      {
        name: "description",
        content:
          "Explore your RuneScape account’s achievement atlas: connected milestones, equipment paths, and new adventures.",
      },
      { name: "robots", content: "noindex" },
    ],
    links: [
      { rel: "stylesheet", href: flowCss },
      { rel: "stylesheet", href: atlasCss },
    ],
  }),
  component: AchievementsPage,
});
