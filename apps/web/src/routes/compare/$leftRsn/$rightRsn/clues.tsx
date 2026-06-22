import { createFileRoute } from "@tanstack/react-router";
import CluesPage from "../../../../pages/CluesPage";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/clues")({
  component: CompareCluesRoute,
});

function CompareCluesRoute() {
  return <CluesPage />;
}
