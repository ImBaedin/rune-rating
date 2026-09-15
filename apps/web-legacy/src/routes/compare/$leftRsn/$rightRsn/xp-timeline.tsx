import { createFileRoute } from "@tanstack/react-router";
import { XpTimelineRoutePage } from "../../../../features/comparison/pages";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/xp-timeline")(
  {
    component: XpTimelineRoutePage,
  },
);
