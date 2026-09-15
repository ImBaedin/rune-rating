import { createFileRoute } from "@tanstack/react-router";
import { ActivityRoutePage } from "../../../../features/comparison/pages";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/activity")({
  component: ActivityRoutePage,
});
