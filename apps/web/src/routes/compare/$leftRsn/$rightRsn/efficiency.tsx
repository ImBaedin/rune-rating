import { createFileRoute } from "@tanstack/react-router";
import { EfficiencyRoutePage } from "../../../../App";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/efficiency")({
  component: EfficiencyRoutePage,
});
