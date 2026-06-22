import { createFileRoute } from "@tanstack/react-router";
import MinigamesPage from "../../../../pages/MinigamesPage";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/minigames")({
  component: MinigamesPage,
});
