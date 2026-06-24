import { normalizeRsn } from "@rune-rating/domain";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ComparisonShell } from "../../../App";
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
      <main className="route-message">
        <section>
          <p className="eyebrow">Invalid player name</p>
          <h1>That comparison URL contains an invalid RSN.</h1>
          <p>
            Player names must be 1-12 characters and can use letters, numbers,
            spaces, underscores, or hyphens.
          </p>
        </section>
      </main>
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
