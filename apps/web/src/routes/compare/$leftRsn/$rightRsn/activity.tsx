import { createFileRoute } from "@tanstack/react-router";
import { ActivityRoutePage } from "../../../../App";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/activity")({
  component: ActivityRoutePage,
});
