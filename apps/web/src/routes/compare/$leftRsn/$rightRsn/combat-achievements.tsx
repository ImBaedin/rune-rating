import { createFileRoute } from "@tanstack/react-router";
import CombatAchievementsPage from "../../../../pages/CombatAchievementsPage";

export const Route = createFileRoute(
  "/compare/$leftRsn/$rightRsn/combat-achievements",
)({
  component: CompareCombatAchievementsRoute,
});

function CompareCombatAchievementsRoute() {
  return <CombatAchievementsPage />;
}
