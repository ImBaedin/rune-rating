import { createFileRoute } from "@tanstack/react-router";
import { EfficiencyRoutePage } from "../../../../features/comparison/pages";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/efficiency")({
  component: EfficiencyRoutePage,
});
