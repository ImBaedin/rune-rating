import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "../../../../features/comparison/pages";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/")({
  component: OverviewPage,
});
