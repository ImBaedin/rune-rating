import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "../../../../App";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/")({
  component: OverviewPage,
});
