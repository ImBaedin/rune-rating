import { createFileRoute } from "@tanstack/react-router";
import QuestsPage from "../../../../pages/QuestsPage";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/quests")({
  component: CompareQuestsRoute,
});

function CompareQuestsRoute() {
  return <QuestsPage />;
}
