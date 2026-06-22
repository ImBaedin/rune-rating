import { createFileRoute } from "@tanstack/react-router";
import BossingPage from "../../../../pages/BossingPage";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/bossing")({
  component: CompareBossingRoute,
});

function CompareBossingRoute() {
  return <BossingPage />;
}
