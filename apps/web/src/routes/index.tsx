import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "../LandingPage";

export const Route = createFileRoute("/")({
  component: LandingPage,
});
