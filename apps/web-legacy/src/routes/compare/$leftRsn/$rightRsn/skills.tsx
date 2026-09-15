import { createFileRoute } from "@tanstack/react-router";
import { SkillsRoutePage } from "../../../../features/comparison/pages";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/skills")({
  component: SkillsRoutePage,
});
