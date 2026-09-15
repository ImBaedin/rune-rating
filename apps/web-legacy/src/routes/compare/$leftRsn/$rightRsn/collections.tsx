import { createFileRoute } from "@tanstack/react-router";
import CollectionsPage from "../../../../pages/CollectionsPage";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn/collections")(
  {
    component: CompareCollectionsRoute,
  },
);

function CompareCollectionsRoute() {
  return <CollectionsPage />;
}
