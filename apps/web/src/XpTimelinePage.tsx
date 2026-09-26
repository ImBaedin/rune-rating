import { api } from "@rune-rating/backend/convex/_generated/api";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bolt,
  CalendarDays,
  ChartNoAxesCombined,
  Clock3,
  Trophy,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PageHeader,
  PlayerPairLine,
  SegmentedControl,
  SourceChip,
} from "./components/comparison-ui";
import { SearchMultiSelect } from "./components/primitives/SearchMultiSelect";
import {
  heatmapValues,
  XpActivityHeatmap,
} from "./components/XpActivityHeatmap";
import { compareTimelineValues } from "./features/timelineComparison";
import {
  agilityIcon,
  attackIcon,
  constructionIcon,
  cookingIcon,
  craftingIcon,
  defenceIcon,
  farmingIcon,
  firemakingIcon,
  fishingIcon,
  fletchingIcon,
  herbloreIcon,
  hitpointsIcon,
  hunterIcon,
  magicIcon,
  miningIcon,
  prayerIcon,
  rangedIcon,
  runecraftIcon,
  sailingWorldIcon,
  skillsIcon,
  slayerIcon,
  smithingIcon,
  strengthIcon,
  thievingIcon,
  toDataUrl,
  woodcuttingIcon,
} from "./osrsIcons";

type Dashboard = FunctionReturnType<typeof api.xpTimeline.getDashboard>;
type SkillsComparison = FunctionReturnType<typeof api.comparisons.getSkills>;
type SkillSnapshot = NonNullable<SkillsComparison>["skills"][number];
type SkillOption = {
  key: string;
  name: string;
  xp?: { delta: number | null };
};
type DashboardPoint = Dashboard["points"][number];
type DashboardEvent = Dashboard["events"][number];
type Range = "7d" | "30d" | "90d" | "1y";
type CurrentXp = { left: number | null; right: number | null };
type SkillCategory = "all" | "Combat" | "Gathering" | "Artisan" | "Support";

const ranges: Range[] = ["7d", "30d", "90d", "1y"];
const rangePeriods: Record<Range, "week" | "month" | "quarter" | "year"> = {
  "7d": "week",
  "30d": "month",
  "90d": "quarter",
  "1y": "year",
};
const skillCategories: Record<Exclude<SkillCategory, "all">, Set<string>> = {
  Combat: new Set([
    "Attack",
    "Strength",
    "Defence",
    "Hitpoints",
    "Ranged",
    "Prayer",
    "Magic",
  ]),
  Gathering: new Set(["Mining", "Fishing", "Woodcutting", "Hunter", "Farming"]),
  Artisan: new Set([
    "Cooking",
    "Smithing",
    "Fletching",
    "Firemaking",
    "Crafting",
    "Herblore",
    "Construction",
    "Runecraft",
  ]),
  Support: new Set(["Agility", "Thieving", "Slayer"]),
};
const skillIconUrls: Record<string, string> = toDataUrl({
  Attack: attackIcon,
  Strength: strengthIcon,
  Defence: defenceIcon,
  Hitpoints: hitpointsIcon,
  Ranged: rangedIcon,
  Prayer: prayerIcon,
  Magic: magicIcon,
  Cooking: cookingIcon,
  Woodcutting: woodcuttingIcon,
  Fletching: fletchingIcon,
  Fishing: fishingIcon,
  Firemaking: firemakingIcon,
  Crafting: craftingIcon,
  Smithing: smithingIcon,
  Mining: miningIcon,
  Herblore: herbloreIcon,
  Agility: agilityIcon,
  Thieving: thievingIcon,
  Slayer: slayerIcon,
  Farming: farmingIcon,
  Runecraft: runecraftIcon,
  Hunter: hunterIcon,
  Construction: constructionIcon,
  Sailing: sailingWorldIcon,
});
const skillsIconUrl = toDataUrl(skillsIcon);
const skillCategoryRows: [SkillCategory, string][] = [
  ["Combat", "Combat"],
  ["Gathering", "Gathering"],
  ["Artisan", "Artisan"],
  ["Support", "Support"],
];
const skillCatalog = [
  "Attack",
  "Defence",
  "Strength",
  "Hitpoints",
  "Ranged",
  "Prayer",
  "Magic",
  "Cooking",
  "Woodcutting",
  "Fletching",
  "Fishing",
  "Firemaking",
  "Crafting",
  "Smithing",
  "Mining",
  "Herblore",
  "Agility",
  "Thieving",
  "Slayer",
  "Farming",
  "Runecraft",
  "Hunter",
  "Construction",
  "Sailing",
].map<SkillOption>((name) => ({
  key: `skill.${name.toLowerCase()}`,
  name,
}));
const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const formatCompact = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : compactNumber.format(value);
const formatSigned = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : `${value > 0 ? "+" : ""}${formatCompact(value)}`;
const formatDate = (timestamp: number | null | undefined) =>
  timestamp === null || timestamp === undefined
    ? "—"
    : shortDateFormatter.format(timestamp);
const formatDateRange = (
  start: number | null | undefined,
  end: number | null | undefined,
) =>
  start === null || start === undefined || end === null || end === undefined
    ? "—"
    : `${formatDate(start)} – ${formatDate(end)}`;
const sideName = (side: "left" | "right" | null, names: [string, string]) =>
  side === "left" ? names[0] : side === "right" ? names[1] : "Both players";
const sideAccent = (side: "left" | "right" | null) =>
  side === "right" ? "green" : side === null ? "muted" : "blue";

export default function XpTimelinePage({
  names,
  currentXp,
  skills,
  womQueueCompletionToken,
}: {
  names: [string, string];
  currentXp: CurrentXp;
  skills: SkillSnapshot[];
  womQueueCompletionToken: number;
}) {
  const getDashboard = useAction(api.xpTimeline.getDashboard);
  const [leftName, rightName] = names;
  const search = useSearch({ from: "/compare/$leftRsn/$rightRsn/xp-timeline" });
  const navigate = useNavigate({
    from: "/compare/$leftRsn/$rightRsn/xp-timeline",
  });
  const range = search.range ?? "90d";
  const setRange = (range: Range) => {
    void navigate({ search: { range } });
  };
  const [selectedSkillKeys, setSelectedSkillKeys] = useState<string[] | null>(
    null,
  );
  const [result, setResult] = useState<{
    data: Dashboard | null;
    error: string | null;
    key: string;
    isLoading: boolean;
  }>({ data: null, error: null, key: "", isLoading: true });
  const skillOptions = useMemo(() => {
    if (skills.length === 0) return skillCatalog;
    const byKey = new Map<string, SkillOption>(
      skillCatalog.map((skill) => [skill.key, skill]),
    );
    for (const skill of skills) byKey.set(skill.key, skill);
    return [...byKey.values()];
  }, [skills]);
  const selectedSkills = useMemo(
    () =>
      selectedSkillKeys === null
        ? []
        : selectedSkillKeys
            .map((key) => skillOptions.find((skill) => skill.key === key))
            .filter((skill): skill is SkillOption => skill !== undefined),
    [selectedSkillKeys, skillOptions],
  );
  const selectedSkillRequestKey =
    selectedSkillKeys === null ? "overall" : selectedSkillKeys.join(",");
  const requestKey = `${leftName}:${rightName}:${range}:${selectedSkillRequestKey}:${womQueueCompletionToken}`;
  const categorySkillKeys = (category: SkillCategory) =>
    skillOptions
      .filter(
        (skill) =>
          category === "all" || skillCategories[category].has(skill.name),
      )
      .map((skill) => skill.key);
  const metricLabel =
    selectedSkillKeys === null
      ? "Total XP"
      : selectedSkills.length === 1
        ? (selectedSkills[0]?.name ?? "Selected skill")
        : `${selectedSkills.length} skills`;

  useEffect(() => {
    let ignored = false;
    setResult((current) => ({
      data: current.key === requestKey ? current.data : null,
      error: null,
      key: requestKey,
      isLoading: true,
    }));
    void getDashboard({
      leftRsn: leftName,
      rightRsn: rightName,
      range: rangePeriods[range],
      ...(selectedSkillKeys ? { skillKeys: selectedSkillKeys } : {}),
    })
      .then((data) => {
        if (!ignored)
          setResult({ data, error: null, key: requestKey, isLoading: false });
      })
      .catch((error) => {
        if (!ignored) {
          setResult({
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "XP timeline unavailable",
            key: requestKey,
            isLoading: false,
          });
        }
      });
    return () => {
      ignored = true;
    };
  }, [getDashboard, leftName, range, requestKey, rightName, selectedSkillKeys]);

  const dashboard = result.key === requestKey ? result.data : null;
  const summaries = dashboard?.summaries;
  const currentGap =
    selectedSkillKeys !== null
      ? (summaries?.currentGap ?? null)
      : currentXp.left === null || currentXp.right === null
        ? (summaries?.currentGap ?? null)
        : currentXp.left - currentXp.right;
  const currentLeader =
    currentGap === null
      ? "Comparison unavailable"
      : currentGap === 0
        ? "Players are tied"
        : `${currentGap > 0 ? names[0] : names[1]} is ahead`;
  const gainComparison = compareTimelineValues(
    summaries?.leftGained,
    summaries?.rightGained,
  );
  const hasGainComparison = gainComparison !== null;
  const rangeGain = gainComparison?.maximum ?? null;
  let rangeLeader = "Comparison unavailable";
  if (gainComparison) {
    rangeLeader =
      gainComparison.leader === null
        ? "Players are tied"
        : sideName(gainComparison.leader, names);
  }
  const heatA = useMemo(
    () => heatmapValues(dashboard?.heatmapPoints ?? [], "leftGained"),
    [dashboard],
  );
  const heatB = useMemo(
    () => heatmapValues(dashboard?.heatmapPoints ?? [], "rightGained"),
    [dashboard],
  );
  const heatCombined = useMemo(
    () =>
      heatmapValues(dashboard?.heatmapPoints ?? [], [
        "leftGained",
        "rightGained",
      ]),
    [dashboard],
  );

  return (
    <div className="xp-page">
      <PageHeader
        title="XP Timeline"
        meta={<SourceChip label="Wise Old Man" />}
        controls={
          <>
            <MetricSelect
              value={metricLabel}
              skills={skillOptions}
              selectedSkillKeys={selectedSkillKeys}
              categorySkillKeys={categorySkillKeys}
              onChange={setSelectedSkillKeys}
            />
            <SegmentedControl
              label="Timeline range"
              value={range}
              options={ranges.map((item) => [item, item])}
              onChange={setRange}
            />
          </>
        }
      />

      {result.error ? (
        <div className="data-banner error" role="alert">
          {result.error}
        </div>
      ) : null}
      {result.isLoading && dashboard === null ? (
        <div className="data-banner">Loading XP timeline…</div>
      ) : null}

      <section className="xp-kpi-grid">
        <KpiCard
          icon={ChartNoAxesCombined}
          label="Current XP gap"
          value={formatSigned(currentGap)}
          unit="XP"
          detail={currentLeader}
          accent="blue"
        />
        <KpiCard
          icon={Bolt}
          label={`Recent ${range} gain`}
          value={formatSigned(rangeGain)}
          unit="XP"
          detail={rangeLeader}
          accent="blue"
        />
        <KpiCard
          icon={CalendarDays}
          label="Avg XP / day"
          value="Daily average"
          unit=""
          detail={
            <PlayerPairLine
              names={names}
              left={formatCompact(summaries?.leftAveragePerDay)}
              right={formatCompact(summaries?.rightAveragePerDay)}
            />
          }
          accent="blue"
        />
        <KpiCard
          icon={Activity}
          label="Biggest lead change"
          value={formatSigned(summaries?.biggestLeadChange?.value)}
          unit="XP"
          detail={formatDate(summaries?.biggestLeadChange?.date)}
          accent="split"
        />
        <KpiCard
          icon={Trophy}
          label="Longest lead streak"
          value={
            hasGainComparison
              ? `${summaries?.longestLeadStreak.days ?? 0}`
              : "—"
          }
          unit="days"
          detail={
            hasGainComparison
              ? sideName(summaries?.longestLeadStreak.side ?? null, names)
              : "Comparison unavailable"
          }
          accent="amber"
        />
      </section>

      <section className="xp-main-grid" aria-busy={result.isLoading}>
        <TimelineChart names={names} dashboard={dashboard} />
        <GapChart dashboard={dashboard} currentGap={currentGap} />
        <DailyGains names={names} points={dashboard?.points ?? []} />
        <XpActivityHeatmap
          names={names}
          valuesA={heatA}
          valuesB={heatB}
          valuesCombined={heatCombined}
        />
        <TimelineInsights names={names} dashboard={dashboard} />
      </section>

      <SummaryStrip
        names={names}
        dashboard={dashboard}
        currentGap={currentGap}
      />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  detail,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit: string;
  detail: ReactNode;
  accent: string;
}) {
  return (
    <article className={`panel xp-kpi ${accent}`}>
      <span className="xp-kpi-icon">
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <div className="xp-kpi-content">
        <span>{label}</span>
        <div className="xp-kpi-values">
          <strong>
            {value}
            {unit ? <small> {unit}</small> : null}
          </strong>
        </div>
        <div className="xp-kpi-detail">{detail}</div>
      </div>
    </article>
  );
}

function MetricSelect({
  value,
  skills,
  selectedSkillKeys,
  categorySkillKeys,
  onChange,
}: {
  value: string;
  skills: SkillOption[];
  selectedSkillKeys: string[] | null;
  categorySkillKeys: (category: SkillCategory) => string[];
  onChange: (skillKeys: string[] | null) => void;
}) {
  const selectedKeys = selectedSkillKeys ?? [];
  const selectedKeySet = new Set(selectedKeys);
  const presets = [
    {
      label: "Total XP",
      description: "Overall timeline",
      selected: selectedSkillKeys === null,
      onSelect: () => onChange(null),
    },
    ...skillCategoryRows.map(([category, label]) => {
      const keys = categorySkillKeys(category);
      return {
        label,
        description: `${keys.length} skills`,
        selected:
          selectedSkillKeys !== null &&
          keys.length === selectedKeys.length &&
          keys.every((key) => selectedKeySet.has(key)),
        onSelect: () => onChange(keys),
      };
    }),
  ];
  return (
    <SearchMultiSelect
      label="Metric"
      summary={value}
      items={skills.map((skill) => ({
        value: skill.key,
        label: skill.name,
        icon: <OsrsSkillIcon name={skill.name} />,
      }))}
      value={selectedKeys}
      onChange={onChange}
      presets={presets}
      searchLabel="Search timeline skills"
      placeholder="Search skills…"
      emptyMessage="No matching skills."
      minSelections={1}
    />
  );
}

function OsrsSkillIcon({
  name,
  className = "",
}: {
  name: string | undefined;
  className?: string;
}) {
  return (
    <img
      className={`osrs-skill-icon ${className}`}
      src={name ? (skillIconUrls[name] ?? skillsIconUrl) : skillsIconUrl}
      alt=""
    />
  );
}

function TimelineChart({
  names,
  dashboard,
}: {
  names: [string, string];
  dashboard: Dashboard | null;
}) {
  const points = dashboard?.points ?? [];
  const values = points
    .flatMap((point) => [point.leftXp, point.rightXp])
    .filter((value): value is number => value !== null);
  const minimum = values.length > 0 ? Math.min(...values) : 0;
  const rawMaximum = values.length > 0 ? Math.max(...values) : 1;
  const maximum = rawMaximum === minimum ? minimum + 1 : rawMaximum;
  return (
    <article className="panel xp-timeline-chart">
      <ChartHeading title="Cumulative XP Over Time" names={names} />
      <div className="xp-rechart-wrap">
        <ResponsiveContainer
          height="100%"
          initialDimension={{ width: 1, height: 1 }}
          minHeight={0}
          minWidth={0}
          width="100%"
        >
          <LineChart
            data={points}
            margin={{ top: 13, right: 29, bottom: 8, left: 0 }}
          >
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              domain={["dataMin", "dataMax"]}
              minTickGap={24}
              scale="time"
              tickFormatter={formatDate}
              tickLine={false}
              type="number"
            />
            <YAxis
              domain={[minimum, maximum]}
              tickFormatter={formatCompact}
              tickLine={false}
              width={38}
            />
            <Tooltip
              formatter={(value, name) => [
                formatCompact(typeof value === "number" ? value : null),
                name === "leftXp" ? names[0] : names[1],
              ]}
              labelFormatter={(label) =>
                typeof label === "number" ? formatDate(label) : label
              }
            />
            {(dashboard?.events ?? []).map((event) => (
              <ReferenceLine
                key={`${event.kind}-${event.date}`}
                x={event.date}
                stroke={event.side === "right" ? "var(--green)" : "var(--blue)"}
                strokeDasharray="3 3"
              />
            ))}
            <Line
              connectNulls
              dataKey="leftXp"
              dot={false}
              isAnimationActive={false}
              stroke="var(--blue)"
              strokeWidth={2}
              type="monotone"
            />
            <Line
              connectNulls
              dataKey="rightXp"
              dot={false}
              isAnimationActive={false}
              stroke="var(--green)"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="xp-end-label blue">
          {formatCompact(points.at(-1)?.leftXp)}
        </div>
        <div className="xp-end-label green">
          {formatCompact(points.at(-1)?.rightXp)}
        </div>
      </div>
      <div className="xp-event-strip">
        {(dashboard?.events ?? []).map((event) => (
          <Event
            key={`${event.kind}-${event.date}`}
            event={event}
            names={names}
          />
        ))}
        {(dashboard?.events.length ?? 0) === 0 ? (
          <span className="xp-empty-copy">No timeline events detected.</span>
        ) : null}
      </div>
    </article>
  );
}

function GapChart({
  dashboard,
  currentGap,
}: {
  dashboard: Dashboard | null;
  currentGap: number | null;
}) {
  const points = dashboard?.points ?? [];
  const numeric = points
    .map((point) => point.gap)
    .filter((value): value is number => value !== null);
  const maximum = Math.max(1, ...numeric.map(Math.abs));
  return (
    <article className="panel xp-gap-chart">
      <ChartHeading
        title="XP Gap Over Time (A - B)"
        trailing={
          <span>
            Current Gap <strong>{formatSigned(currentGap)}</strong> XP
          </span>
        }
      />
      <div className="xp-rechart-wrap gap">
        <ResponsiveContainer
          height="100%"
          initialDimension={{ width: 1, height: 1 }}
          minHeight={0}
          minWidth={0}
          width="100%"
        >
          <AreaChart
            data={points}
            margin={{ top: 13, right: 18, bottom: 8, left: 0 }}
          >
            <defs>
              <linearGradient id="xpGapFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--blue)" stopOpacity={0.45} />
                <stop
                  offset="100%"
                  stopColor="var(--blue)"
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              domain={["dataMin", "dataMax"]}
              minTickGap={28}
              scale="time"
              tickFormatter={formatDate}
              tickLine={false}
              type="number"
            />
            <YAxis
              domain={[-maximum, maximum]}
              tickFormatter={formatCompact}
              tickLine={false}
              width={38}
            />
            <Tooltip
              formatter={(value) => [
                formatSigned(typeof value === "number" ? value : null),
                "Gap",
              ]}
              labelFormatter={(label) =>
                typeof label === "number" ? formatDate(label) : label
              }
            />
            <ReferenceLine
              y={0}
              stroke="var(--chart-cursor-line)"
              strokeDasharray="3 3"
            />
            <Area
              connectNulls
              dataKey="gap"
              fill="url(#xpGapFill)"
              isAnimationActive={false}
              stroke="var(--blue)"
              strokeWidth={2}
              type="monotone"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function ChartHeading({
  title,
  names,
  trailing,
}: {
  title: string;
  names?: [string, string];
  trailing?: ReactNode;
}) {
  return (
    <div className="xp-chart-heading">
      <strong>{title}</strong>
      {names ? (
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
      ) : (
        trailing
      )}
    </div>
  );
}

function Event({
  event,
  names,
}: {
  event: DashboardEvent;
  names: [string, string];
}) {
  const title =
    event.kind === "leadChange"
      ? "Lead Change"
      : event.kind === "spike"
        ? "Big Spike"
        : "Inactivity";
  const Icon = event.kind === "inactivity" ? Clock3 : Bolt;
  const detail = event.endDate
    ? formatDateRange(event.date, event.endDate)
    : `${sideName(event.side, names)} · ${formatDate(event.date)}`;
  return (
    <div className="xp-event">
      <i className={sideAccent(event.side)}>
        <Icon size={11} />
      </i>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </div>
  );
}

function DailyGains({
  names,
  points,
}: {
  names: [string, string];
  points: DashboardPoint[];
}) {
  const maximum = Math.max(
    1,
    ...points.flatMap((point) => [
      point.leftGained ?? 0,
      point.rightGained ?? 0,
    ]),
  );
  return (
    <article className="panel xp-daily-chart">
      <ChartHeading title="Daily XP Gained" names={names} />
      <div className="xp-rechart-wrap daily">
        <ResponsiveContainer
          height="100%"
          initialDimension={{ width: 1, height: 1 }}
          minHeight={0}
          minWidth={0}
          width="100%"
        >
          <BarChart
            data={points}
            margin={{ top: 13, right: 18, bottom: 8, left: 0 }}
          >
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              domain={["dataMin", "dataMax"]}
              minTickGap={24}
              scale="time"
              tickFormatter={formatDate}
              tickLine={false}
              type="number"
            />
            <YAxis
              domain={[0, maximum]}
              tickFormatter={formatCompact}
              tickLine={false}
              width={38}
            />
            <Tooltip
              formatter={(value, name) => [
                formatCompact(typeof value === "number" ? value : null),
                name === "leftGained" ? names[0] : names[1],
              ]}
              labelFormatter={(label) =>
                typeof label === "number" ? formatDate(label) : label
              }
            />
            <Bar
              dataKey="leftGained"
              fill="var(--blue)"
              isAnimationActive={false}
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="rightGained"
              fill="var(--green)"
              isAnimationActive={false}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function TimelineInsights({
  names,
  dashboard,
}: {
  names: [string, string];
  dashboard: Dashboard | null;
}) {
  const summaries = dashboard?.summaries;
  const gainDelta =
    compareTimelineValues(summaries?.leftGained, summaries?.rightGained)
      ?.delta ?? null;
  const biggestGain =
    gainDelta === null ? null : summaries?.biggestSingleDayGain;
  const inactive = dashboard?.events.find(
    (event) => event.kind === "inactivity",
  );
  return (
    <article className="panel xp-insight-panel">
      <div className="xp-card-title">
        <strong>Timeline Insights</strong>
      </div>
      <Insight
        icon={ChartNoAxesCombined}
        accent={
          gainDelta === null || gainDelta === 0
            ? "muted"
            : gainDelta > 0
              ? "blue"
              : "green"
        }
        text={
          gainDelta === null
            ? "XP gain comparison is unavailable."
            : gainDelta === 0
              ? "Both players gained the same XP during this range."
              : `${gainDelta > 0 ? names[0] : names[1]} gained more XP during this range.`
        }
        detail={
          gainDelta === null
            ? "History is needed for both players."
            : `${formatSigned(Math.abs(gainDelta))} XP difference`
        }
      />
      <Insight
        icon={Bolt}
        accent={sideAccent(biggestGain?.side ?? null)}
        text={
          biggestGain
            ? `${sideName(biggestGain.side, names)} recorded the largest single-day gain.`
            : "Largest single-day gain comparison is unavailable."
        }
        detail={
          biggestGain
            ? `${formatCompact(biggestGain.value)} on ${formatDate(biggestGain.date)}`
            : "No comparable daily history."
        }
      />
      {inactive && gainDelta !== null ? (
        <Insight
          icon={Clock3}
          accent="muted"
          text="Both accounts had an inactive period."
          detail={formatDateRange(inactive.date, inactive.endDate)}
        />
      ) : null}
    </article>
  );
}

function Insight({
  icon: Icon,
  accent,
  text,
  detail,
}: {
  icon: LucideIcon;
  accent: string;
  text: string;
  detail: string;
}) {
  return (
    <div className="xp-insight">
      <i className={accent}>
        <Icon size={15} />
      </i>
      <span>
        {text}
        <small>{detail}</small>
      </span>
    </div>
  );
}

function SummaryStrip({
  names,
  dashboard,
  currentGap,
}: {
  names: [string, string];
  dashboard: Dashboard | null;
  currentGap: number | null;
}) {
  const summaries = dashboard?.summaries;
  const hasComparison =
    summaries?.leftGained != null && summaries.rightGained != null;
  const cards: Array<{
    icon: LucideIcon;
    label: string;
    value: string;
    detail: string;
    accent: string;
  }> = [
    {
      icon: ChartNoAxesCombined,
      label: "Current XP gap",
      value: formatSigned(currentGap),
      detail:
        currentGap === null
          ? "Comparison unavailable"
          : sideName(
              currentGap === 0 ? null : currentGap > 0 ? "left" : "right",
              names,
            ),
      accent: "blue",
    },
    {
      icon: Trophy,
      label: "Longest lead streak",
      value: hasComparison
        ? `${summaries?.longestLeadStreak.days ?? 0} days`
        : "—",
      detail: hasComparison
        ? formatDateRange(
            summaries?.longestLeadStreak.startDate,
            summaries?.longestLeadStreak.endDate,
          )
        : "Comparison unavailable",
      accent: "amber",
    },
    {
      icon: Bolt,
      label: "Biggest single day gain",
      value: hasComparison
        ? formatCompact(summaries?.biggestSingleDayGain?.value)
        : "—",
      detail:
        hasComparison && summaries?.biggestSingleDayGain
          ? `${sideName(summaries.biggestSingleDayGain.side, names)} · ${formatDate(summaries.biggestSingleDayGain.date)}`
          : "Comparison unavailable",
      accent: "blue",
    },
    {
      icon: CalendarDays,
      label: "Most active period",
      value: hasComparison
        ? formatDateRange(
            summaries?.mostActivePeriod.startDate,
            summaries?.mostActivePeriod.endDate,
          )
        : "—",
      detail: hasComparison
        ? `${summaries?.mostActivePeriod.days ?? 0} days · ${formatCompact(summaries?.mostActivePeriod.value)} XP`
        : "Comparison unavailable",
      accent: "amber",
    },
  ];
  return (
    <section className="xp-summary-strip">
      {cards.map((card) => (
        <SummaryCard key={card.label} {...card} />
      ))}
      <DualSummary
        names={names}
        label="Avg XP / day"
        left={formatCompact(summaries?.leftAveragePerDay)}
        right={formatCompact(summaries?.rightAveragePerDay)}
      />
      <DualSummary
        names={names}
        label="7 day gain"
        left={formatSigned(dashboard?.gainWindows.sevenDays.left)}
        right={formatSigned(dashboard?.gainWindows.sevenDays.right)}
      />
      <DualSummary
        names={names}
        label="30 day gain"
        left={formatSigned(dashboard?.gainWindows.thirtyDays.left)}
        right={formatSigned(dashboard?.gainWindows.thirtyDays.right)}
      />
      <DualSummary
        names={names}
        label="90 day gain"
        left={formatSigned(dashboard?.gainWindows.ninetyDays.left)}
        right={formatSigned(dashboard?.gainWindows.ninetyDays.right)}
      />
    </section>
  );
}

function SummaryCard({
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
  accent: string;
}) {
  return (
    <article className="panel xp-summary-card">
      <i className={accent}>
        <Icon size={17} />
      </i>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function DualSummary({
  names,
  label,
  left,
  right,
}: {
  names: [string, string];
  label: string;
  left: string;
  right: string;
}) {
  return (
    <article className="panel xp-dual-summary">
      <span>{label}</span>
      <PlayerPairLine names={names} left={left} right={right} />
    </article>
  );
}
