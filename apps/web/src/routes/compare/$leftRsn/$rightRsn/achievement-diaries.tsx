import { createFileRoute } from "@tanstack/react-router";
import AchievementDiariesPage from "../../../../pages/AchievementDiariesPage";

export const Route = createFileRoute(
  "/compare/$leftRsn/$rightRsn/achievement-diaries",
)({
  component: CompareAchievementDiariesRoute,
});

function CompareAchievementDiariesRoute() {
  return <AchievementDiariesPage />;
}
