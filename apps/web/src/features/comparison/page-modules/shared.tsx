import { RefreshCw, Users } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "../../../components/comparison-ui";
import type { HistoryPeriod } from "../context";
import { useComparisonShell } from "../context";
import { type AppView, comparisonPath, pageTitles } from "../navigation";

export type EfficiencyRange = "7d" | "30d" | "90d" | "1y";

export const periodLabels: Record<HistoryPeriod, string> = {
  week: "7d",
  month: "30d",
  quarter: "90d",
  year: "1y",
};

export const efficiencyRanges: EfficiencyRange[] = ["7d", "30d", "90d", "1y"];
export const efficiencyRangePeriods: Record<EfficiencyRange, HistoryPeriod> = {
  "7d": "week",
  "30d": "month",
  "90d": "quarter",
  "1y": "year",
};
export const efficiencyDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
export const efficiencyDayMs = 24 * 60 * 60 * 1_000;

export function PlaceholderRoutePage({ view }: { view: AppView }) {
  const { names } = useComparisonShell();
  return <PagePlaceholder title={pageTitles[view]} names={names} view={view} />;
}

export function PanelHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h3>{title}</h3>
      </div>
      {action}
    </div>
  );
}

function PagePlaceholder({
  names,
  title,
  view,
}: {
  names: [string, string];
  title: string;
  view: AppView;
}) {
  return (
    <section className="placeholder-page">
      <PageHeader
        title={title}
        meta={<span>{comparisonPath(view, names)}</span>}
      />
      <div>
        <p>
          {title} is ready for a page worker to build against {names[0]} and{" "}
          {names[1]}. Keep provider fetches in Convex and reuse canonical read
          models.
        </p>
      </div>
      <code>{comparisonPath(view, names)}</code>
    </section>
  );
}

export function DataUnavailableOverlay({
  message,
}: {
  message: string | null;
}) {
  if (!message) return null;
  return (
    <div className="data-unavailable-overlay" role="status">
      <span>
        <Users size={16} />
      </span>
      <strong>RuneProfile data unavailable</strong>
      <p>{message}</p>
    </div>
  );
}

export function LoadingOverlay({
  isLoading,
  label,
  full = false,
}: {
  isLoading: boolean;
  label: string;
  full?: boolean;
}) {
  if (!isLoading) return null;
  return (
    <div
      className={`loading-overlay ${full ? "full" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span>
        <RefreshCw size={15} />
      </span>
      <strong>{label}</strong>
    </div>
  );
}
