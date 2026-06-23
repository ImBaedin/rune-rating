import { api } from "@rune-rating/backend/convex/_generated/api";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { LucideIcon } from "lucide-react";
import { Bolt, CalendarDays, Clock3, Info } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  SourceChip as HeaderSourceChip,
  PageHeader,
  PlayerPairLine,
  SegmentedControl,
} from "../../../components/comparison-ui";
import {
  HeatmapRow,
  heatmapValues,
} from "../../../components/XpActivityHeatmap";
import { useComparisonShell } from "../context";
import { formatAge, formatCompact } from "../formatters";
import {
  type EfficiencyRange,
  efficiencyDateFormatter,
  efficiencyRangePeriods,
  efficiencyRanges,
  LoadingOverlay,
  PanelHeader,
} from "./shared";

type ActivityDashboard = FunctionReturnType<typeof api.xpTimeline.getDashboard>;

export function ActivityRoutePage() {
  const { names } = useComparisonShell();
  return <ActivityPage names={names} />;
}

type ActivityRange = EfficiencyRange;
type ActivityPoint = ActivityDashboard["points"][number];
type ActivitySide = "left" | "right";
type ActivitySignal = {
  label: string;
  value: string;
  detail: ReactNode;
  accent: "blue" | "green" | "amber" | "muted";
};

const activitySideName = (
  side: ActivitySide | null,
  names: [string, string],
) =>
  side === "left" ? names[0] : side === "right" ? names[1] : "Both players";
const activitySideClass = (side: ActivitySide | null) =>
  side === "left" ? "blue" : side === "right" ? "green" : "muted";

function activityGain(point: ActivityPoint, side: ActivitySide) {
  return side === "left" ? point.leftGained : point.rightGained;
}

function activityObservedDays(points: ActivityPoint[], side: ActivitySide) {
  return points.filter((point) => activityGain(point, side) !== null).length;
}

function activityActiveDays(points: ActivityPoint[], side: ActivitySide) {
  return points.filter((point) => (activityGain(point, side) ?? 0) > 0).length;
}

function longestQuietStretch(points: ActivityPoint[]) {
  let currentStart: number | null = null;
  let currentDays = 0;
  let longest = {
    start: null as number | null,
    end: null as number | null,
    days: 0,
  };

  for (const point of points) {
    const isQuiet = point.leftGained === 0 && point.rightGained === 0;
    if (!isQuiet) {
      currentStart = null;
      currentDays = 0;
      continue;
    }
    currentStart ??= point.date;
    currentDays += 1;
    if (currentDays > longest.days) {
      longest = { start: currentStart, end: point.date, days: currentDays };
    }
  }

  return longest;
}

function activitySignals(
  dashboard: ActivityDashboard | null,
  names: [string, string],
): ActivitySignal[] {
  if (dashboard === null) {
    return [
      {
        label: "Daily rhythm",
        value: "Waiting",
        detail: "Cached WOM overview is loading.",
        accent: "muted",
      },
    ];
  }

  const quiet = longestQuietStretch(dashboard.points);
  const spike = dashboard.summaries.biggestSingleDayGain;
  const leadChange = dashboard.summaries.biggestLeadChange;
  const activeWindow = dashboard.summaries.mostActivePeriod;

  return [
    {
      label: "Daily rhythm",
      value:
        dashboard.summaries.leftAveragePerDay === null ||
        dashboard.summaries.rightAveragePerDay === null
          ? "Partial"
          : "Avg XP/day",
      detail: (
        <PlayerPairLine
          names={names}
          left={formatCompact(dashboard.summaries.leftAveragePerDay)}
          right={formatCompact(dashboard.summaries.rightAveragePerDay)}
        />
      ),
      accent: "blue",
    },
    {
      label: "Biggest spike",
      value: formatCompact(spike?.value ?? null),
      detail:
        spike === null
          ? "No XP spike in this range."
          : `${activitySideName(spike.side, names)} on ${efficiencyDateFormatter.format(spike.date)}.`,
      accent: spike === null ? "muted" : activitySideClass(spike.side),
    },
    {
      label: "Quiet stretch",
      value: quiet.days === 0 ? "None" : `${quiet.days}d`,
      detail:
        quiet.days === 0 || quiet.start === null || quiet.end === null
          ? "No shared inactive streak detected."
          : `${efficiencyDateFormatter.format(quiet.start)} to ${efficiencyDateFormatter.format(quiet.end)}.`,
      accent: quiet.days >= 3 ? "amber" : "muted",
    },
    {
      label: "Active block",
      value: formatCompact(activeWindow.value),
      detail:
        activeWindow.startDate === null || activeWindow.endDate === null
          ? "No active window available."
          : `${activeWindow.days}d from ${efficiencyDateFormatter.format(activeWindow.startDate)}.`,
      accent: "green",
    },
    {
      label: "Lead pressure",
      value: formatCompact(leadChange?.value ?? null),
      detail:
        leadChange === null
          ? "No meaningful lead movement."
          : `${activitySideName(leadChange.side, names)} moved the gap on ${efficiencyDateFormatter.format(leadChange.date)}.`,
      accent:
        leadChange === null ? "muted" : activitySideClass(leadChange.side),
    },
  ];
}

function ActivityPage({ names }: { names: [string, string] }) {
  const getDashboard = useAction(api.xpTimeline.getDashboard);
  const [range, setRange] = useState<ActivityRange>("30d");
  const [result, setResult] = useState<{
    data: ActivityDashboard | null;
    error: string | null;
    key: string;
    isLoading: boolean;
  }>({ data: null, error: null, key: "", isLoading: true });
  const requestKey = `${names[0]}:${names[1]}:${range}:activity`;

  useEffect(() => {
    let ignored = false;
    setResult((current) => ({
      data: current.key === requestKey ? current.data : null,
      error: null,
      key: requestKey,
      isLoading: true,
    }));
    void getDashboard({
      leftRsn: names[0],
      rightRsn: names[1],
      range: efficiencyRangePeriods[range],
    })
      .then((data) => {
        if (!ignored) {
          setResult({ data, error: null, key: requestKey, isLoading: false });
        }
      })
      .catch((error) => {
        if (!ignored) {
          setResult({
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "Activity data unavailable",
            key: requestKey,
            isLoading: false,
          });
        }
      });
    return () => {
      ignored = true;
    };
  }, [getDashboard, names, range, requestKey]);

  const dashboard = result.key === requestKey ? result.data : null;
  const points = dashboard?.points ?? [];
  const heatmapPoints = dashboard?.heatmapPoints ?? [];
  const leftActive = activityActiveDays(points, "left");
  const rightActive = activityActiveDays(points, "right");
  const leftObserved = activityObservedDays(points, "left");
  const rightObserved = activityObservedDays(points, "right");
  const quiet = longestQuietStretch(points);
  const biggestSpike = dashboard?.summaries.biggestSingleDayGain ?? null;
  const heatA = useMemo(
    () => heatmapValues(heatmapPoints, "leftGained", "activity-left"),
    [heatmapPoints],
  );
  const heatB = useMemo(
    () => heatmapValues(heatmapPoints, "rightGained", "activity-right"),
    [heatmapPoints],
  );
  const chartData = points.map((point) => ({
    timestamp: point.date,
    date: efficiencyDateFormatter.format(point.date),
    left: point.leftGained ?? 0,
    right: point.rightGained ?? 0,
  }));
  const signals = activitySignals(dashboard, names);
  const fetchedAtValues = [
    dashboard?.left.fetchedAt ?? null,
    dashboard?.right.fetchedAt ?? null,
  ].filter((value): value is number => value !== null);
  const oldestFetch =
    fetchedAtValues.length === 0 ? null : Math.min(...fetchedAtValues);

  return (
    <div className="activity-page">
      <PageHeader
        title="Activity"
        meta={<HeaderSourceChip label="Wise Old Man" />}
        controls={
          <SegmentedControl
            label="Activity range"
            value={range}
            options={efficiencyRanges.map((item) => [item, item])}
            onChange={setRange}
          />
        }
      />

      {result.error ? (
        <div className="data-banner error">{result.error}</div>
      ) : null}
      {result.isLoading && dashboard === null ? (
        <div className="data-banner">Loading cached WOM overview…</div>
      ) : null}

      <section className="activity-kpi-grid">
        <ActivityKpi
          icon={CalendarDays}
          label="Active days"
          value={`${Math.max(leftActive, rightActive)} active`}
          detail={
            <PlayerPairLine
              names={names}
              left={`${leftActive} active, ${leftObserved || "—"} observed`}
              right={`${rightActive} active, ${rightObserved || "—"} observed`}
            />
          }
          accent="blue"
        />
        <ActivityKpi
          icon={Bolt}
          label="Biggest spike"
          value={formatCompact(biggestSpike?.value ?? null)}
          detail={
            biggestSpike === null
              ? "No spike detected"
              : activitySideName(biggestSpike.side, names)
          }
          accent={activitySideClass(biggestSpike?.side ?? null)}
        />
        <ActivityKpi
          icon={Clock3}
          label="Quiet stretch"
          value={quiet.days === 0 ? "None" : `${quiet.days}d`}
          detail="Shared zero-gain days"
          accent={quiet.days >= 3 ? "amber" : "muted"}
        />
        <ActivityKpi
          icon={Info}
          label="Source freshness"
          value={oldestFetch === null ? "Waiting" : formatAge(oldestFetch)}
          detail="Cached WOM overview"
          accent="green"
        />
      </section>

      <section className="activity-main-grid">
        <article className="panel activity-heatmap-panel">
          <PanelHeader
            title="Daily rhythm"
            eyebrow="One-year cached activity map"
            action={
              <span className="activity-panel-note">
                Darker days indicate larger XP gain.
              </span>
            }
          />
          <div className="activity-heatmap">
            <HeatmapRow name={names[0]} values={heatA} accent="blue" />
            <HeatmapRow name={names[1]} values={heatB} accent="green" />
          </div>
          <LoadingOverlay
            isLoading={result.isLoading}
            label="Loading activity heatmap"
          />
        </article>

        <article className="panel activity-signals-panel">
          <PanelHeader title="Activity signals" eyebrow={range} />
          <div className="activity-signal-list">
            {signals.map((signal) => (
              <div
                className={`activity-signal ${signal.accent}`}
                key={signal.label}
              >
                <i />
                <span>
                  <small>{signal.label}</small>
                  <strong>{signal.value}</strong>
                  <div className="activity-signal-detail">{signal.detail}</div>
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel activity-bars-panel">
          <PanelHeader
            title="Daily gains"
            eyebrow={`${range} comparison`}
            action={
              <div className="xp-chart-legend">
                <span>
                  <i className="blue" />
                  {names[0]}
                </span>
                <span>
                  <i className="green" />
                  {names[1]}
                </span>
              </div>
            }
          />
          <div className="activity-bars-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={1} barCategoryGap="18%">
                <CartesianGrid stroke="#e8edf1" vertical={false} />
                <XAxis
                  dataKey="date"
                  interval="preserveStartEnd"
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatCompact}
                  width={42}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => formatCompact(Number(value))}
                  labelFormatter={(label) => `Daily gain: ${label}`}
                />
                <Bar dataKey="left" fill="var(--blue)" radius={[3, 3, 0, 0]} />
                <Bar
                  dataKey="right"
                  fill="var(--green)"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel activity-events-panel">
          <PanelHeader title="Notable days" eyebrow="Recent signals" />
          <div className="activity-event-list">
            {(dashboard?.events ?? []).length === 0 ? (
              <p>No notable activity events in this range.</p>
            ) : (
              dashboard?.events.map((event) => (
                <div
                  className="activity-event"
                  key={`${event.kind}-${event.date}`}
                >
                  <i className={activitySideClass(event.side)} />
                  <span>
                    <strong>
                      {event.kind === "spike"
                        ? "Biggest spike"
                        : event.kind === "leadChange"
                          ? "Lead change"
                          : "Quiet stretch"}
                    </strong>
                    <small>
                      {efficiencyDateFormatter.format(event.date)}
                      {event.endDate
                        ? ` to ${efficiencyDateFormatter.format(event.endDate)}`
                        : ""}
                    </small>
                  </span>
                  <b>{formatCompact(event.value)}</b>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

function ActivityKpi({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: ReactNode;
  accent: "blue" | "green" | "amber" | "muted";
}) {
  return (
    <article className={`panel activity-kpi ${accent}`}>
      <Icon size={22} strokeWidth={1.8} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <div className="activity-kpi-detail">{detail}</div>
      </div>
    </article>
  );
}
