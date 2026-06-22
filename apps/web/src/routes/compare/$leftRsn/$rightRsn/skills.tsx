import { createFileRoute } from "@tanstack/react-router";
import { SkillsRoutePage } from "../../../../App";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/skills")({
  component: SkillsRoutePage,
});
