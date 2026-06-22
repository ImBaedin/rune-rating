import { createFileRoute } from "@tanstack/react-router";
import { XpTimelineRoutePage } from "../../../../App";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/xp-timeline")(
  {
    component: XpTimelineRoutePage,
  },
);
