import { normalizeRsn } from "@rune-rating/domain";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RouteMessage } from "../../../components/RouteMessage";
import { ComparisonShell } from "../../../features/comparison/ComparisonShell";
import { compareHead } from "../../../features/og/meta";

export const Route = createFileRoute("/compare/$leftRsn/$rightRsn")({
  head: ({ params }) => compareHead(params.leftRsn, params.rightRsn),
  component: CompareShellRoute,
});

function CompareShellRoute() {
  const { leftRsn, rightRsn } = Route.useParams();
  const normalized = normalizeRouteRsns(leftRsn, rightRsn);
  if (!normalized) {
    return (
      <RouteMessage
        eyebrow="Invalid player name"
        title="That comparison URL contains an invalid RSN."
      >
        Player names must be 1-12 characters and can use letters, numbers,
        spaces, underscores, or hyphens.
      </RouteMessage>
    );
  }
  return (
    <ComparisonShell routeRsns={normalized}>
      <Outlet />
    </ComparisonShell>
  );
}

function normalizeRouteRsns(leftRsn: string, rightRsn: string) {
  try {
    return [normalizeRsn(leftRsn), normalizeRsn(rightRsn)] as [string, string];
  } catch {
    return null;
  }
}
