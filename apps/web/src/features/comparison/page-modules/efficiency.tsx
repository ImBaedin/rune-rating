import { api } from "@rune-rating/backend/convex/_generated/api";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { LucideIcon } from "lucide-react";
import { Activity, BarChart3, Clock3, Target, Zap } from "lucide-react";
import { type PointerEvent, useEffect, useMemo, useState } from "react";
import {
  SourceChip as HeaderSourceChip,
  PageHeader,
} from "../../../components/comparison-ui";
import type { EfficiencyComparison } from "../context";
import { useComparisonShell } from "../context";
import { formatValue } from "../formatters";
import {
  efficiencyDateFormatter,
  efficiencyDayMs,
  efficiencyRangePeriods,
  efficiencyRanges,
  LoadingOverlay,
  PanelHeader,
  periodLabels,
} from "./shared";

type EfficiencyTimelines = FunctionReturnType<
  typeof api.wiseOldMan.getEfficiencyTimelines
>;

export function EfficiencyRoutePage() {
  const { efficiency, names, womQueueCompletionToken } = useComparisonShell();
  return (
    <EfficiencyPage
      comparison={efficiency}
      isCurrentLoading={efficiency === undefined}
      names={names}
      womQueueCompletionToken={womQueueCompletionToken}
    />
  );
}

type EfficiencyMetricMode = "ehp" | "ehb";
type EfficiencyChartMode = "total" | "daily";
type EfficiencyRange = "7d" | "30d" | "90d" | "1y";
type EfficiencyTimelinePoint = {
  date: number;
  dateLabel: string;
  left: number;
  right: number;
  gap: number;
};
type ChartCoordinate = {
  x: number;
  y: number;
};
type EfficiencySignalRow = {
  label: string;
  leftValue: string;
  leftTrend: string;
  rightValue: string;
  rightTrend: string;
  difference: string;
  differenceTrend: string;
  direction: "up" | "down";
};

const efficiencyDailySmoothingDays = 14;
const efficiencyChartFrame = {
  width: 1120,
  height: 230,
  pad: { top: 14, right: 16, bottom: 27, left: 44 },
} as const;

const formatHours = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined
    ? "—"
    : `${value > 0 ? "+" : ""}${formatValue(Number(value.toFixed(digits)))} hrs`;
const formatUnsignedHours = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined
    ? "—"
    : `${formatValue(Number(value.toFixed(digits)))} hrs`;
const formatTrend = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;

function timelineForMetric(
  timelines: EfficiencyTimelines | null,
  side: "left" | "right",
  metric: EfficiencyMetricMode,
) {
  return (
    timelines?.[side].timelines.find((timeline) => timeline.metric === metric)
      ?.timeline ?? []
  );
}

function valueAtTimeline(
  points: Array<{ date: number; value: number }>,
  timestamp: number,
) {
  let value: number | null = null;
  for (const point of points) {
    if (point.date > timestamp) break;
    value = point.value;
  }
  return value;
}

function gainBetweenTimeline(
  points: Array<{ date: number; value: number }>,
  start: number,
  end: number,
) {
  const startValue = valueAtTimeline(points, start);
  const endValue = valueAtTimeline(points, end);
  return startValue === null || endValue === null
    ? null
    : Math.max(0, endValue - startValue);
}

function timelineGain(points: Array<{ date: number; value: number }>) {
  const first = points[0]?.value;
  const last = points.at(-1)?.value;
  return first === undefined || last === undefined
    ? null
    : Math.max(0, last - first);
}

function timelineVelocity(points: Array<{ date: number; value: number }>) {
  const gained = timelineGain(points);
  const first = points[0]?.date;
  const last = points.at(-1)?.date;
  if (gained === null || first === undefined || last === undefined) return null;
  const days = Math.max(1, (last - first) / efficiencyDayMs);
  return gained / days;
}

function buildSmoothedDailyGainTimeline(
  points: Array<{ date: number; value: number }>,
) {
  const firstDate = points[0]?.date;
  const lastDate = points.at(-1)?.date;
  if (firstDate === undefined || lastDate === undefined) return [];
  const samples: Array<{ date: number; value: number }> = [];
  for (
    let date = firstDate + efficiencyDayMs;
    date <= lastDate;
    date += efficiencyDayMs
  ) {
    const endValue = valueAtTimeline(points, date);
    const startDate = Math.max(
      firstDate,
      date - efficiencyDailySmoothingDays * efficiencyDayMs,
    );
    const startValue = valueAtTimeline(points, startDate);
    if (endValue === null || startValue === null) continue;
    if (date <= startDate) continue;
    samples.push({
      date,
      value: Math.max(0, endValue - startValue) / efficiencyDailySmoothingDays,
    });
  }
  return samples;
}

function sevenDayTrend(points: Array<{ date: number; value: number }>) {
  const end = points.at(-1)?.date;
  if (end === undefined) return null;
  const current = gainBetweenTimeline(points, end - 7 * efficiencyDayMs, end);
  const previous = gainBetweenTimeline(
    points,
    end - 14 * efficiencyDayMs,
    end - 7 * efficiencyDayMs,
  );
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function buildEfficiencyChartData(
  leftTimeline: Array<{ date: number; value: number }>,
  rightTimeline: Array<{ date: number; value: number }>,
  chartMode: EfficiencyChartMode,
): EfficiencyTimelinePoint[] {
  const leftPoints =
    chartMode === "daily"
      ? buildSmoothedDailyGainTimeline(leftTimeline)
      : leftTimeline;
  const rightPoints =
    chartMode === "daily"
      ? buildSmoothedDailyGainTimeline(rightTimeline)
      : rightTimeline;
  const dates = [
    ...new Set([...leftPoints, ...rightPoints].map((point) => point.date)),
  ].sort((left, right) => left - right);
  return dates.flatMap((date) => {
    const left = valueAtTimeline(leftPoints, date);
    const right = valueAtTimeline(rightPoints, date);
    return left === null || right === null
      ? []
      : [
          {
            date,
            dateLabel: efficiencyDateFormatter.format(date),
            left,
            right,
            gap: left - right,
          },
        ];
  });
}

function buildEfficiencySignals(
  timelines: EfficiencyTimelines | null,
  comparison: EfficiencyComparison | undefined,
): EfficiencySignalRow[] {
  const metricRows = (["ehp", "ehb"] as const).flatMap((metric) => {
    const left = timelineForMetric(timelines, "left", metric);
    const right = timelineForMetric(timelines, "right", metric);
    const leftGained = timelineGain(left);
    const rightGained = timelineGain(right);
    const leftVelocity = timelineVelocity(left);
    const rightVelocity = timelineVelocity(right);
    const difference =
      leftGained === null || rightGained === null
        ? null
        : leftGained - rightGained;
    const velocityDifference =
      leftVelocity === null || rightVelocity === null
        ? null
        : leftVelocity - rightVelocity;
    return [
      {
        label: `Recent ${metric.toUpperCase()} gained`,
        leftValue: formatHours(leftGained),
        leftTrend: formatTrend(sevenDayTrend(left)),
        rightValue: formatHours(rightGained),
        rightTrend: formatTrend(sevenDayTrend(right)),
        difference: formatHours(difference),
        differenceTrend: formatTrend(
          difference === null || leftGained === null || leftGained === 0
            ? null
            : (difference / leftGained) * 100,
        ),
        direction: "up" as const,
      },
      {
        label: `${metric.toUpperCase()} velocity (hrs/day)`,
        leftValue:
          leftVelocity === null
            ? "—"
            : Number(leftVelocity.toFixed(1)).toString(),
        leftTrend: formatTrend(sevenDayTrend(left)),
        rightValue:
          rightVelocity === null
            ? "—"
            : Number(rightVelocity.toFixed(1)).toString(),
        rightTrend: formatTrend(sevenDayTrend(right)),
        difference:
          velocityDifference === null
            ? "—"
            : `${velocityDifference > 0 ? "+" : ""}${Number(
                velocityDifference.toFixed(1),
              )}`,
        differenceTrend: "—",
        direction: "up" as const,
      },
    ];
  });

  return [
    ...metricRows,
    {
      label: "Hours to max",
      leftValue: formatUnsignedHours(comparison?.efficiency.timeToMax.left),
      leftTrend: "—",
      rightValue: formatUnsignedHours(comparison?.efficiency.timeToMax.right),
      rightTrend: "—",
      difference: formatHours(comparison?.efficiency.timeToMax.delta),
      differenceTrend: "—",
      direction: "down",
    },
    {
      label: "Hours to 200m",
      leftValue: formatUnsignedHours(comparison?.efficiency.timeTo200m.left),
      leftTrend: "—",
      rightValue: formatUnsignedHours(comparison?.efficiency.timeTo200m.right),
      rightTrend: "—",
      difference: formatHours(comparison?.efficiency.timeTo200m.delta),
      differenceTrend: "—",
      direction: "down",
    },
  ];
}

function buildStraightPath(points: ChartCoordinate[]) {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function buildSmoothPath(points: ChartCoordinate[]) {
  if (points.length < 3) return buildStraightPath(points);
  return points
    .map((point, index) => {
      if (index === 0) return `M${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      const previous = points[index - 1] ?? point;
      const next = points[index + 1] ?? point;
      const beforePrevious = points[index - 2] ?? previous;
      const controlOneX = previous.x + (point.x - beforePrevious.x) / 6;
      const controlOneY = previous.y + (point.y - beforePrevious.y) / 6;
      const controlTwoX = point.x - (next.x - previous.x) / 6;
      const controlTwoY = point.y - (next.y - previous.y) / 6;
      return `C${controlOneX.toFixed(1)},${controlOneY.toFixed(1)} ${controlTwoX.toFixed(1)},${controlTwoY.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function EfficiencyPage({
  comparison,
  isCurrentLoading,
  names,
  womQueueCompletionToken,
}: {
  comparison: EfficiencyComparison | undefined;
  isCurrentLoading: boolean;
  names: [string, string];
  womQueueCompletionToken: number;
}) {
  const getEfficiencyTimelines = useAction(
    api.wiseOldMan.getEfficiencyTimelines,
  );
  const [metricMode, setMetricMode] = useState<EfficiencyMetricMode>("ehp");
  const [chartMode, setChartMode] = useState<EfficiencyChartMode>("total");
  const [range, setRange] = useState<EfficiencyRange>("90d");
  const [hoursPerWeek, setHoursPerWeek] = useState(20);
  const [timelineResult, setTimelineResult] = useState<{
    data: EfficiencyTimelines | null;
    error: string | null;
    key: string;
    isLoading: boolean;
  }>({ data: null, error: null, key: "", isLoading: true });
  const requestKey = `${names[0]}:${names[1]}:${range}:${womQueueCompletionToken}`;

  useEffect(() => {
    let ignored = false;
    setTimelineResult((current) => ({
      data: current.key === requestKey ? current.data : null,
      error: null,
      key: requestKey,
      isLoading: true,
    }));
    void getEfficiencyTimelines({
      leftRsn: names[0],
      rightRsn: names[1],
      metrics: ["ehp", "ehb"],
      period: efficiencyRangePeriods[range],
    })
      .then((data) => {
        if (!ignored) {
          setTimelineResult({
            data,
            error: null,
            key: requestKey,
            isLoading: false,
          });
        }
      })
      .catch((error) => {
        if (!ignored) {
          setTimelineResult({
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "Efficiency timeline unavailable",
            key: requestKey,
            isLoading: false,
          });
        }
      });
    return () => {
      ignored = true;
    };
  }, [getEfficiencyTimelines, names, range, requestKey]);

  const timelines =
    timelineResult.key === requestKey ? timelineResult.data : null;
  const leftTimeline = timelineForMetric(timelines, "left", metricMode);
  const rightTimeline = timelineForMetric(timelines, "right", metricMode);
  const ehpGap = comparison?.efficiency.ehp.delta ?? null;
  const hasEhpGap = ehpGap !== null && Math.abs(ehpGap) >= 0.05;
  const behindSide =
    !hasEhpGap || ehpGap === null ? null : ehpGap > 0 ? "right" : "left";
  const closingWeeks =
    !hasEhpGap || ehpGap === null
      ? null
      : Math.abs(ehpGap) / Math.max(1, hoursPerWeek);
  const closingProgress = Math.min(100, (hoursPerWeek / 40) * 100);
  const chartData = useMemo(
    () => buildEfficiencyChartData(leftTimeline, rightTimeline, chartMode),
    [leftTimeline, rightTimeline, chartMode],
  );
  const signals = useMemo(
    () => buildEfficiencySignals(timelines, comparison),
    [timelines, comparison],
  );
  const accountTypes = comparison?.accountTypes ?? null;
  const accountTypeMismatch =
    accountTypes !== null && accountTypes.left !== accountTypes.right;
  const ratio = (side: "left" | "right") => {
    const ehp = comparison?.efficiency.ehp[side];
    const ehb = comparison?.efficiency.ehb[side];
    return ehp === null ||
      ehp === undefined ||
      ehb === null ||
      ehb === undefined ||
      ehb === 0
      ? null
      : ehp / ehb;
  };
  const efficiencyStyle = (side: "left" | "right") => {
    const value = ratio(side);
    if (value === null) return "—";
    if (value >= 1.25) return "Skilling-weighted";
    if (value <= 0.9) return "PvM-weighted";
    return "Balanced";
  };
  const maxTargetWeeks =
    comparison?.efficiency.timeToMax.left == null
      ? null
      : comparison.efficiency.timeToMax.left / Math.max(1, hoursPerWeek);
  const maxTargetDate =
    maxTargetWeeks === null
      ? "—"
      : efficiencyDateFormatter.format(
          Date.now() + maxTargetWeeks * 7 * efficiencyDayMs,
        );

  return (
    <div className="efficiency-page">
      <PageHeader
        title="EHP / Efficiency"
        meta={<HeaderSourceChip label="Wise Old Man" />}
      />

      {timelineResult.error ? (
        <div className="data-banner error">{timelineResult.error}</div>
      ) : null}
      {timelineResult.isLoading && timelines === null ? (
        <div className="data-banner">
          Loading cached WOM efficiency timeline…
        </div>
      ) : null}

      <section className="efficiency-kpi-grid">
        <EfficiencyKpiCard
          icon={BarChart3}
          label="EHP lead"
          value={formatHours(comparison?.efficiency.ehp.delta)}
          detail="Higher is better"
          accent="blue"
        />
        <EfficiencyKpiCard
          icon={Activity}
          label="EHB lead"
          value={formatHours(comparison?.efficiency.ehb.delta)}
          detail="Higher is better"
          accent="blue"
        />
        <EfficiencyKpiCard
          icon={Clock3}
          label="Time to max gap"
          value={formatHours(comparison?.efficiency.timeToMax.delta)}
          detail="Lower is better"
          accent="green"
        />
        <EfficiencyKpiCard
          icon={Target}
          label="Time to 200m gap"
          value={formatHours(comparison?.efficiency.timeTo200m.delta, 0)}
          detail="Lower is better"
          accent="green"
        />
      </section>

      <section className="efficiency-main-grid">
        <article className="panel efficiency-chart-panel">
          <PanelHeader
            title="Effective hours timeline"
            eyebrow="Wise Old Man historical snapshots"
            action={
              <div className="efficiency-chart-actions">
                <fieldset
                  className="segmented"
                  aria-label="Effective hours metric"
                >
                  {(["ehp", "ehb"] as const).map((mode) => (
                    <button
                      type="button"
                      className={metricMode === mode ? "active" : ""}
                      key={mode}
                      onClick={() => setMetricMode(mode)}
                    >
                      {mode.toUpperCase()}
                    </button>
                  ))}
                </fieldset>
                <fieldset className="segmented" aria-label="Chart value">
                  {(
                    [
                      ["total", "Total"],
                      ["daily", "Gained/day"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      type="button"
                      className={chartMode === mode ? "active" : ""}
                      key={mode}
                      onClick={() => setChartMode(mode)}
                    >
                      {label}
                    </button>
                  ))}
                </fieldset>
                <fieldset className="xp-range" aria-label="Efficiency range">
                  {efficiencyRanges.map((item) => (
                    <button
                      type="button"
                      className={range === item ? "active" : ""}
                      key={item}
                      onClick={() => setRange(item)}
                    >
                      {item}
                    </button>
                  ))}
                </fieldset>
              </div>
            }
          />
          <div className="efficiency-rechart-wrap">
            <EfficiencyLineChart
              data={chartData}
              mode={chartMode}
              names={names}
            />
            {chartData.length === 0 ? (
              <div className="efficiency-empty-chart">
                No {metricMode.toUpperCase()}{" "}
                {chartMode === "daily" ? "gain" : "timeline"} points for both
                players.
              </div>
            ) : null}
          </div>
          <div className="efficiency-chart-footer">
            <span>
              {chartMode === "daily"
                ? "Daily gain shows a smoothed 14-day average from WOM snapshots."
                : "All times in game time (UTC)."}
            </span>
            <div className="xp-chart-legend">
              <span>
                <i className="blue" />
                {names[0]}
              </span>
              <span>
                <i className="green" />
                {names[1]}
              </span>
              <span>
                <i className="muted" />
                {chartMode === "daily" ? "14d avg hrs/day" : "effective hours"}
              </span>
            </div>
          </div>
          <LoadingOverlay
            isLoading={timelineResult.isLoading || isCurrentLoading}
            label="Loading efficiency timeline"
          />
        </article>

        <EfficiencyProfile
          accountTypes={accountTypes}
          accountTypeMismatch={accountTypeMismatch}
          combatLevel={comparison?.efficiency.combatLevel}
          efficiencyStyle={efficiencyStyle}
          names={names}
          ratio={ratio}
        />

        <article className="panel efficiency-planner">
          <PanelHeader
            title="Time debt planner"
            eyebrow="Projected from current gap"
          />
          <div className="efficiency-slider-row">
            <label htmlFor="effective-hours">
              <span>Efficient hours per week</span>
              <strong>{hoursPerWeek} hrs</strong>
            </label>
            <input
              id="effective-hours"
              type="range"
              min="5"
              max="40"
              step="1"
              value={hoursPerWeek}
              onChange={(event) => setHoursPerWeek(Number(event.target.value))}
            />
            <div className="efficiency-slider-ticks">
              <span>5</span>
              <span>10</span>
              <span>20</span>
              <span>30</span>
              <span>40</span>
            </div>
          </div>
          <div className="efficiency-forecast-list">
            <EfficiencyForecast
              icon={Clock3}
              text={
                closingWeeks === null || behindSide === null
                  ? "Current EHP gap is tied or unavailable."
                  : `At ${hoursPerWeek} efficient hrs/week, ${behindSide === "left" ? names[0] : names[1]} closes the EHP gap in ${closingWeeks.toFixed(1)} weeks.`
              }
              value={
                closingWeeks === null ? "—" : `${closingWeeks.toFixed(1)} weeks`
              }
              accent="green"
              progress={closingProgress}
            />
            <EfficiencyForecast
              icon={Target}
              text={`${names[0]} reaches max efficiency target around ${maxTargetDate}.`}
              value={
                maxTargetWeeks === null
                  ? "—"
                  : `~${Math.max(1, Math.round(maxTargetWeeks / 4.345))} months`
              }
              accent="blue"
              progress={
                comparison?.efficiency.timeToMax.left == null
                  ? 0
                  : Math.max(
                      8,
                      100 -
                        Math.min(
                          100,
                          (comparison.efficiency.timeToMax.left / 3_000) * 100,
                        ),
                    )
              }
            />
          </div>
        </article>
      </section>

      <article className="panel efficiency-signals-panel">
        <PanelHeader
          title="Efficiency signals"
          eyebrow={`${periodLabels[efficiencyRangePeriods[range]]} WOM timeline`}
        />
        <div className="table-scroll efficiency-signals-scroll">
          <table className="skills-detail-table efficiency-signals-table">
            <thead>
              <tr>
                <th>Signal</th>
                <th>{names[0]}</th>
                <th>{names[1]}</th>
                <th>Delta</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((row) => (
                <tr key={row.label}>
                  <td>
                    <span className="efficiency-signal-name">
                      <Zap size={13} />
                      {row.label}
                    </span>
                  </td>
                  <td>
                    <EfficiencySignalValue
                      trend={row.leftTrend}
                      trendClass={
                        row.direction === "down" ? "green-text" : "blue-text"
                      }
                      value={row.leftValue}
                    />
                  </td>
                  <td>
                    <EfficiencySignalValue
                      trend={row.rightTrend}
                      trendClass="green-text"
                      value={row.rightValue}
                    />
                  </td>
                  <td>
                    <EfficiencySignalValue
                      trend={row.differenceTrend}
                      trendClass={
                        row.direction === "down" ? "green-text" : "blue-text"
                      }
                      value={row.difference}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

function EfficiencySignalValue({
  trend,
  trendClass,
  value,
}: {
  trend: string;
  trendClass: string;
  value: string;
}) {
  return (
    <span className="efficiency-signal-value">
      <strong>{value}</strong>
      <em className={trendClass}>{trend}</em>
    </span>
  );
}

function EfficiencyKpiCard({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  accent: "blue" | "green";
}) {
  return (
    <article className={`panel efficiency-kpi ${accent}`}>
      <Icon size={22} strokeWidth={1.8} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>
          {accent === "green" ? "↓" : "↑"} {detail}
        </small>
      </div>
    </article>
  );
}

function EfficiencyLineChart({
  data,
  mode,
  names,
}: {
  data: EfficiencyTimelinePoint[];
  mode: EfficiencyChartMode;
  names: [string, string];
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const { width, height, pad } = efficiencyChartFrame;
  const values = data.flatMap((point) => [point.left, point.right]);
  const max = Math.max(...values, 1);
  const top =
    mode === "daily"
      ? Math.max(1, Math.ceil(max * 2) / 2)
      : Math.ceil(max / 1_000) * 1_000;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    key: `tick-${ratio}`,
    value:
      mode === "daily"
        ? Number((top * ratio).toFixed(1))
        : Math.round((top * ratio) / 1_000) * 1_000,
  }));
  const xLabelStep = Math.max(1, Math.ceil(data.length / 7));
  const x = (index: number) =>
    pad.left +
    (index / Math.max(1, data.length - 1)) * (width - pad.left - pad.right);
  const y = (value: number) =>
    pad.top + (1 - value / top) * (height - pad.top - pad.bottom);
  const coordinates = (side: "left" | "right") =>
    data.map((point, index) => ({
      x: x(index),
      y: y(point[side]),
    }));
  const path = (side: "left" | "right") => {
    const points = coordinates(side);
    return mode === "daily"
      ? buildSmoothPath(points)
      : buildStraightPath(points);
  };
  const areaPath = (side: "left" | "right") => {
    if (data.length === 0) return "";
    return `${path(side)} L${x(data.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  };
  const formatChartValue = (value: number) =>
    mode === "daily"
      ? `${value.toLocaleString("en-US", {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        })} hrs/day`
      : formatUnsignedHours(value);
  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (data.length === 0) {
      setHoverIndex(null);
      return;
    }
    const matrix = event.currentTarget.getScreenCTM();
    if (matrix === null) {
      setHoverIndex(null);
      return;
    }
    const svgX = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    ).x;
    const plotLeft = pad.left;
    const plotWidth = width - pad.left - pad.right;
    const ratio = Math.min(1, Math.max(0, (svgX - plotLeft) / plotWidth));
    setHoverIndex(Math.round(ratio * (data.length - 1)));
  };
  const hoveredPoint = hoverIndex === null ? null : (data[hoverIndex] ?? null);
  const hoverX = hoverIndex === null ? null : x(hoverIndex);
  const tooltipLeft =
    hoverX === null
      ? "50%"
      : `${Math.min(92, Math.max(8, (hoverX / width) * 100))}%`;

  return (
    <>
      <svg
        className="efficiency-svg-chart"
        role="img"
        aria-label="Effective hours comparison timeline"
        onPointerLeave={() => setHoverIndex(null)}
        onPointerMove={handlePointerMove}
        viewBox={`0 0 ${width} ${height}`}
      >
        {ticks.map((tick) => (
          <g key={tick.key}>
            <line
              className="xp-grid-line"
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick.value)}
              y2={y(tick.value)}
            />
            <text x={pad.left - 10} y={y(tick.value) + 3} textAnchor="end">
              {mode === "daily"
                ? tick.value.toLocaleString("en-US", {
                    maximumFractionDigits: 1,
                  })
                : `${Math.round(tick.value / 1_000)}k`}
            </text>
          </g>
        ))}
        {data.map((point, index) =>
          index % xLabelStep === 0 || index === data.length - 1 ? (
            <text
              className="efficiency-svg-x"
              key={point.date}
              x={x(index)}
              y={height - 6}
              textAnchor="middle"
            >
              {point.dateLabel}
            </text>
          ) : null,
        )}
        <path className="xp-area blue" d={areaPath("left")} />
        <path className="xp-area green" d={areaPath("right")} />
        <path className="xp-line blue" d={path("left")} />
        <path className="xp-line green" d={path("right")} />
        {mode === "total"
          ? data.map((point, index) => (
              <g key={`${point.date}-dots`}>
                <circle
                  className="xp-dot blue"
                  cx={x(index)}
                  cy={y(point.left)}
                  r="2.8"
                />
                <circle
                  className="xp-dot green"
                  cx={x(index)}
                  cy={y(point.right)}
                  r="2.8"
                />
              </g>
            ))
          : null}
        {hoveredPoint !== null && hoverX !== null ? (
          <g className="efficiency-hover-layer">
            <line
              className="efficiency-hover-line"
              x1={hoverX}
              x2={hoverX}
              y1={pad.top}
              y2={height - pad.bottom}
            />
            <circle
              className="efficiency-hover-dot blue"
              cx={hoverX}
              cy={y(hoveredPoint.left)}
              r="4"
            />
            <circle
              className="efficiency-hover-dot green"
              cx={hoverX}
              cy={y(hoveredPoint.right)}
              r="4"
            />
          </g>
        ) : null}
      </svg>
      {hoveredPoint !== null ? (
        <div className="efficiency-chart-tooltip" style={{ left: tooltipLeft }}>
          <strong>{hoveredPoint.dateLabel}</strong>
          <small>
            <i className="blue" />
            <span>{names[0]}</span>
            <b>{formatChartValue(hoveredPoint.left)}</b>
          </small>
          <small>
            <i className="green" />
            <span>{names[1]}</span>
            <b>{formatChartValue(hoveredPoint.right)}</b>
          </small>
          <em>{mode === "daily" ? "14-day average" : "Effective hours"}</em>
        </div>
      ) : null}
    </>
  );
}

function EfficiencyProfile({
  accountTypes,
  accountTypeMismatch,
  combatLevel,
  efficiencyStyle,
  names,
  ratio,
}: {
  accountTypes: { left: string; right: string } | null;
  accountTypeMismatch: boolean;
  combatLevel:
    | NonNullable<EfficiencyComparison>["efficiency"]["combatLevel"]
    | undefined;
  efficiencyStyle: (side: "left" | "right") => string;
  names: [string, string];
  ratio: (side: "left" | "right") => number | null;
}) {
  const leftStyle = efficiencyStyle("left");
  const rightStyle = efficiencyStyle("right");
  return (
    <article className="panel efficiency-profile-panel">
      <PanelHeader title="Efficiency profile" eyebrow="Account comparison" />
      <div className="efficiency-profile-grid">
        <span />
        <strong className="blue-text">{names[0]}</strong>
        <strong className="green-text">{names[1]}</strong>
        <span>Account type</span>
        <b>{accountTypes?.left ?? "—"}</b>
        <b>{accountTypes?.right ?? "—"}</b>
        {accountTypeMismatch ? (
          <p className="efficiency-profile-warning">
            Different account types: compare rates carefully.
          </p>
        ) : null}
        <span>Primary build</span>
        <b className="blue-text">{leftStyle}</b>
        <b className="green-text">{rightStyle}</b>
        <span>Combat level</span>
        <b>{formatValue(combatLevel?.left ?? null)}</b>
        <b>{formatValue(combatLevel?.right ?? null)}</b>
        <span>EHP / EHB ratio</span>
        <b>{ratio("left")?.toFixed(2) ?? "—"}</b>
        <b>{ratio("right")?.toFixed(2) ?? "—"}</b>
        <span>Efficiency style</span>
        <b>
          <em className="efficiency-pill blue">{leftStyle}</em>
        </b>
        <b>
          <em className="efficiency-pill green">{rightStyle}</em>
        </b>
      </div>
    </article>
  );
}

function EfficiencyForecast({
  icon: Icon,
  text,
  value,
  accent,
  progress,
}: {
  icon: LucideIcon;
  text: string;
  value: string;
  accent: "blue" | "green";
  progress: number;
}) {
  return (
    <div className={`efficiency-forecast ${accent}`}>
      <Icon size={16} />
      <div>
        <span>{text}</span>
        <i>
          <b style={{ width: `${progress}%` }} />
        </i>
      </div>
      <strong>{value}</strong>
    </div>
  );
}
