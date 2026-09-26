import { createFileRoute } from "@tanstack/react-router";
import { XpTimelineRoutePage } from "../../../../features/comparison/pages";
import { timelineSearch } from "../../../../features/viewSearch";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/xp-timeline")(
  {
    validateSearch: timelineSearch,
    component: XpTimelineRoutePage,
  },
);
