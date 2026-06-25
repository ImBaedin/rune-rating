import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookOpen,
  Clock3,
  Database,
  Gauge,
  Medal,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import type * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { type Player, players } from "../../../mockData";
import {
  type EfficiencyComparison,
  type HistoryPeriod,
  type OverviewHistory,
  type PlayerProfile,
  type RuneProfileDashboard,
  type SkillsComparison,
  useComparisonShell,
} from "../context";
import {
  formatAge,
  formatCompact,
  formatDelta,
  formatValue,
} from "../formatters";
import { compactName, playerAvatar } from "../playerIdentity";
import {
  DataUnavailableOverlay,
  LoadingOverlay,
  PanelHeader,
  periodLabels,
} from "./shared";
import { SkillsTable } from "./skills";

type TimelineComparison = {
  left: { timeline: OverviewHistory["left"]["timeline"] };
  right: { timeline: OverviewHistory["right"]["timeline"] };
};

const questPercentage = (value: number, total: number | undefined) =>
  `${total ? (value / total) * 100 : 0}%`;

type HighlightConfig = {
  icon: LucideIcon;
  title: string;
  fallbackCopy: string;
};

type HighlightTone = "left" | "right" | "neutral";

const highlights: HighlightConfig[] = [
  {
    icon: Activity,
    title: "More active recently",
    fallbackCopy: "Recent Wise Old Man snapshots show the stronger XP trend.",
  },
  {
    icon: Gauge,
    title: "More efficient",
    fallbackCopy: "Efficiency is based on current Wise Old Man EHP and EHB.",
  },
  {
    icon: BookOpen,
    title: "Ahead in questing",
    fallbackCopy: "RuneProfile quest points decide this comparison.",
  },
  {
    icon: Swords,
    title: "Stronger combat profile",
    fallbackCopy: "Combat level comes from Wise Old Man.",
  },
];

function toneFromDelta(delta: number | null): HighlightTone {
  if (delta === null || delta === 0) return "neutral";
  return delta > 0 ? "left" : "right";
}

export function OverviewPage() {
  const {
    names,
    comparison,
    efficiency,
    leftProfile,
    rightProfile,
    runeProfile,
    runeProfileUnavailableMessage,
    overviewHistory,
    overviewHistoryError,
    isOverviewHistoryLoading,
    historyPeriod,
    setHistoryPeriod,
  } = useComparisonShell();

  return (
    <>
      <section className="hero-grid">
        <PlayerCard
          player={players[0]}
          fallbackName={names[0]}
          data={comparison?.left}
          skills={comparison?.skills}
          efficiency={efficiency?.efficiency}
          accountType={efficiency?.accountTypes.left}
          runeProfile={runeProfile?.left}
          runeProfileUnavailable={runeProfile?.left === null}
          isLoading={
            comparison === undefined ||
            efficiency === undefined ||
            runeProfile === undefined
          }
        />
        <AheadCard
          comparison={comparison}
          isLoading={comparison === undefined}
        />
        <PlayerCard
          player={players[1]}
          fallbackName={names[1]}
          data={comparison?.right}
          skills={comparison?.skills}
          efficiency={efficiency?.efficiency}
          accountType={efficiency?.accountTypes.right}
          runeProfile={runeProfile?.right}
          runeProfileUnavailable={runeProfile?.right === null}
          isLoading={
            comparison === undefined ||
            efficiency === undefined ||
            runeProfile === undefined
          }
        />
      </section>

      <section className="top-grid">
        <XpTimeline
          names={names}
          history={overviewHistory}
          period={historyPeriod}
          onPeriodChange={setHistoryPeriod}
          error={overviewHistoryError}
          isLoading={isOverviewHistoryLoading}
        />
        <ProgressCard
          title="Quest points"
          subtitle="RuneProfile"
          aValue={runeProfile?.left?.quests.earnedPoints ?? null}
          bValue={runeProfile?.right?.quests.earnedPoints ?? null}
          max={Math.max(
            runeProfile?.left?.quests.totalPoints ?? 0,
            runeProfile?.right?.quests.totalPoints ?? 0,
          )}
          unit="QP"
          names={names}
          unavailableMessage={runeProfileUnavailableMessage}
          isLoading={runeProfile === undefined}
        />
        <ProgressCard
          title="Achievement diaries"
          subtitle="RuneProfile"
          aValue={runeProfile?.left?.diaries.completed ?? null}
          bValue={runeProfile?.right?.diaries.completed ?? null}
          max={Math.max(
            runeProfile?.left?.diaries.total ?? 0,
            runeProfile?.right?.diaries.total ?? 0,
          )}
          unit="tasks"
          names={names}
          unavailableMessage={runeProfileUnavailableMessage}
          isLoading={runeProfile === undefined}
        />
      </section>

      <section className="lower-grid">
        <SkillsTable
          names={names}
          comparison={comparison}
          isLoading={comparison === undefined}
        />
        <EfficiencyCard
          names={names}
          comparison={efficiency}
          isLoading={efficiency === undefined}
        />
        <Highlights
          names={names}
          efficiency={efficiency}
          runeProfile={runeProfile}
          overviewHistory={overviewHistory}
          unavailableMessage={runeProfileUnavailableMessage}
          isLoading={
            efficiency === undefined ||
            runeProfile === undefined ||
            isOverviewHistoryLoading
          }
        />
      </section>

      <section className="bottom-grid">
        <RecentActivity
          names={names}
          history={overviewHistory}
          error={overviewHistoryError}
          isLoading={isOverviewHistoryLoading}
        />
        <QuestProgress
          data={runeProfile}
          unavailableMessage={runeProfileUnavailableMessage}
          isLoading={runeProfile === undefined}
        />
        <SourceAvailability
          names={names}
          leftProfile={leftProfile}
          rightProfile={rightProfile}
          isLoading={leftProfile === undefined || rightProfile === undefined}
        />
      </section>
    </>
  );
}

function PlayerCard({
  player,
  fallbackName,
  data,
  skills: liveSkills,
  efficiency,
  accountType,
  runeProfile,
  runeProfileUnavailable,
  isLoading,
}: {
  player: Player;
  fallbackName: string;
  data?: { displayRsn: string; fetchedAt: number };
  skills?: NonNullable<SkillsComparison>["skills"];
  efficiency?: NonNullable<EfficiencyComparison>["efficiency"];
  accountType?: string;
  runeProfile?: RuneProfileDashboard["left"];
  runeProfileUnavailable: boolean;
  isLoading: boolean;
}) {
  const overall = liveSkills?.find((skill) => skill.key === "skill.overall");
  const isLeft = player.id === "a";
  const displayName = data?.displayRsn ?? fallbackName;
  const avatar = playerAvatar(displayName, player.accent);
  const totalLevel = isLeft ? overall?.level.left : overall?.level.right;
  const totalXp = isLeft ? overall?.xp.left : overall?.xp.right;
  const combatLevel = isLeft
    ? efficiency?.combatLevel.left
    : efficiency?.combatLevel.right;
  return (
    <article
      className={`panel player-card ${player.accent}`}
      aria-busy={isLoading}
    >
      <div className="player-top">
        <div
          className={`avatar ${player.accent}`}
          style={avatar.style}
          aria-hidden="true"
        >
          {avatar.label}
        </div>
        <div className="player-identity">
          <span className="eyebrow">Player {player.id.toUpperCase()}</span>
          <div className="verified-name">
            <h2>{displayName}</h2>
            <ShieldCheck size={15} />
          </div>
          <span className="account-tag">
            {accountType ?? player.accountType}
          </span>
        </div>
      </div>
      <div className="stat-row">
        <Metric
          label="Total level"
          value={formatValue(totalLevel)}
          detail="Official Hiscores"
        />
        <Metric
          label="Total XP"
          value={formatValue(totalXp)}
          detail={
            overall?.xp.delta === null || overall?.xp.delta === undefined
              ? "Unavailable"
              : `${formatDelta(isLeft ? overall.xp.delta : -overall.xp.delta)} vs rival`
          }
        />
        <Metric
          label="Combat level"
          value={combatLevel == null ? "—" : combatLevel.toFixed(1)}
          detail="Wise Old Man"
        />
      </div>
      <div className="player-bottom">
        <CompactMetric
          icon={BookOpen}
          label="Quest points"
          value={
            runeProfile
              ? `${formatValue(runeProfile.quests.earnedPoints)} / ${formatValue(runeProfile.quests.totalPoints)}`
              : "—"
          }
          unavailable={runeProfileUnavailable}
        />
        <CompactMetric
          icon={Medal}
          label="Achievement diaries"
          value={
            runeProfile
              ? `${formatValue(runeProfile.diaries.completed)} / ${formatValue(runeProfile.diaries.total)}`
              : "—"
          }
          unavailable={runeProfileUnavailable}
        />
        <CompactMetric
          icon={Clock3}
          label="Freshness"
          value={data ? formatAge(data.fetchedAt) : "Waiting"}
        />
      </div>
      <LoadingOverlay
        isLoading={isLoading}
        label="Loading player snapshot"
        full
      />
    </article>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function CompactMetric({
  icon: Icon,
  label,
  value,
  unavailable = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unavailable?: boolean;
}) {
  return (
    <div
      className={`compact-metric ${unavailable ? "compact-metric-unavailable" : ""}`}
    >
      <Icon size={14} />
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
      {unavailable ? <em>RuneProfile unavailable</em> : null}
    </div>
  );
}

function AheadCard({
  comparison,
  isLoading,
}: {
  comparison: SkillsComparison | undefined;
  isLoading: boolean;
}) {
  const leftLeads =
    comparison?.skills.filter(
      (skill) => skill.key !== "skill.overall" && skill.xp.leader === "left",
    ).length ?? 0;
  const rightLeads =
    comparison?.skills.filter(
      (skill) => skill.key !== "skill.overall" && skill.xp.leader === "right",
    ).length ?? 0;
  const leader =
    leftLeads === rightLeads
      ? "Tied"
      : leftLeads > rightLeads
        ? comparison?.left.displayRsn
        : comparison?.right.displayRsn;
  const overall = comparison?.skills.find(
    (skill) => skill.key === "skill.overall",
  );
  const rows = [
    { label: "Skill XP categories led", a: `${leftLeads}`, b: `${rightLeads}` },
    {
      label: "Total level difference",
      a: formatDelta(overall?.level.delta ?? null),
      b: formatDelta(
        overall?.level.delta == null ? null : -overall.level.delta,
      ),
    },
    {
      label: "Total XP difference",
      a: formatDelta(overall?.xp.delta ?? null),
      b: formatDelta(overall?.xp.delta == null ? null : -overall.xp.delta),
    },
  ];
  return (
    <article className="panel ahead-card" aria-busy={isLoading}>
      <div className="ahead-title">
        <div className="trophy-orbit">
          <Trophy size={22} />
        </div>
        <div>
          <span className="eyebrow">Who is ahead?</span>
          <h2>{comparison ? leader : "Waiting"}</h2>
          <p>
            {leftLeads === rightLeads
              ? "in skill XP categories"
              : "leads skill XP categories"}
          </p>
        </div>
        <span className="lead-score">
          {leftLeads}–{rightLeads}
        </span>
      </div>
      <div className="comparison-list">
        {rows.map((row) => (
          <div className="comparison-row" key={row.label}>
            <span>{row.label}</span>
            <strong className="blue-text">{row.a}</strong>
            <strong className="green-text">{row.b}</strong>
          </div>
        ))}
      </div>
      <LoadingOverlay
        isLoading={isLoading}
        label="Comparing player snapshots"
        full
      />
    </article>
  );
}

function valueAt(
  points: OverviewHistory["left"]["timeline"],
  timestamp: number,
) {
  let value: number | null = null;
  for (const point of points) {
    if (point.date > timestamp) break;
    value = point.value;
  }
  return value;
}

function buildTimeline(history: TimelineComparison | null) {
  if (!history) return [];
  const allPoints = [...history.left.timeline, ...history.right.timeline];
  const start = Math.min(...allPoints.map((point) => point.date));
  const end = Math.max(...allPoints.map((point) => point.date));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];

  const leftStart = history.left.timeline[0]?.value ?? null;
  const rightStart = history.right.timeline[0]?.value ?? null;
  return Array.from({ length: 9 }, (_, index) => {
    const date = start + ((end - start) * index) / 8;
    const left = valueAt(history.left.timeline, date);
    const right = valueAt(history.right.timeline, date);
    return {
      date,
      a:
        left === null || leftStart === null ? 0 : Math.max(0, left - leftStart),
      b:
        right === null || rightStart === null
          ? 0
          : Math.max(0, right - rightStart),
    };
  });
}

function buildDailyGains(history: OverviewHistory | null) {
  if (!history) return [];
  const end = Date.now();
  const dayMs = 24 * 60 * 60 * 1_000;
  return Array.from({ length: 7 }, (_, index) => {
    const start = end - (7 - index) * dayMs;
    const finish = start + dayMs;
    const gain = (points: OverviewHistory["left"]["timeline"]) => {
      const startValue = valueAt(points, start);
      const endValue = valueAt(points, finish);
      return startValue === null || endValue === null
        ? 0
        : Math.max(0, endValue - startValue);
    };
    return {
      date: start,
      a: gain(history.left.timeline),
      b: gain(history.right.timeline),
    };
  });
}

function XpTimeline({
  names,
  history,
  period,
  onPeriodChange,
  error,
  isLoading,
}: {
  names: [string, string];
  history: OverviewHistory | null;
  period: HistoryPeriod;
  onPeriodChange: (period: HistoryPeriod) => void;
  error: string | null;
  isLoading: boolean;
}) {
  const timeline = buildTimeline(history);
  const max = Math.max(1, ...timeline.flatMap((item) => [item.a, item.b]));
  const chartData = timeline.map((item) => ({
    ...item,
    label: new Date(item.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));
  return (
    <article className="panel timeline-panel" aria-busy={isLoading}>
      <PanelHeader
        title="XP gained over time"
        eyebrow="Synchronized Wise Old Man timeline"
        action={
          <div className="segmented">
            {(Object.keys(periodLabels) as HistoryPeriod[]).map((value) => (
              <button
                type="button"
                className={period === value ? "active" : ""}
                onClick={() => onPeriodChange(value)}
                key={value}
              >
                {periodLabels[value]}
              </button>
            ))}
          </div>
        }
      />
      <div className="timeline-body">
        <div className="chart-wrap">
          <ResponsiveContainer
            height="100%"
            minHeight={0}
            minWidth={0}
            width="100%"
          >
            <AreaChart
              data={chartData}
              margin={{ top: 12, right: 12, bottom: 4, left: 0 }}
            >
              <defs>
                <linearGradient
                  id="overviewBlueFill"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--blue)"
                    stopOpacity={0.18}
                  />
                  <stop offset="100%" stopColor="var(--blue)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e6ebef" vertical={false} />
              <XAxis dataKey="label" minTickGap={18} tickLine={false} />
              <YAxis
                domain={[0, max]}
                tickFormatter={formatCompact}
                tickLine={false}
                width={38}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatCompact(typeof value === "number" ? value : null),
                  name === "a"
                    ? (history?.left.rsn ?? names[0])
                    : (history?.right.rsn ?? names[1]),
                ]}
              />
              <Area
                dataKey="a"
                fill="url(#overviewBlueFill)"
                isAnimationActive={false}
                stroke="var(--blue)"
                strokeWidth={2}
                type="monotone"
              />
              <Area
                dataKey="b"
                fill="var(--green)"
                fillOpacity={0}
                isAnimationActive={false}
                stroke="var(--green)"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-summary">
          <div className="summary-box blue-summary">
            <span>{history?.left.rsn ?? names[0]}</span>
            <strong>+{formatValue(timeline.at(-1)?.a ?? null)} XP</strong>
            <small>{periodLabels[period]} WOM timeline</small>
          </div>
          <div className="summary-box green-summary">
            <span>{history?.right.rsn ?? names[1]}</span>
            <strong>+{formatValue(timeline.at(-1)?.b ?? null)} XP</strong>
            <small>{error ?? `${periodLabels[period]} WOM timeline`}</small>
          </div>
        </div>
      </div>
      <LoadingOverlay isLoading={isLoading} label="Loading XP timeline" />
    </article>
  );
}

function ProgressCard({
  title,
  subtitle,
  aValue,
  bValue,
  max,
  unit,
  names,
  unavailableMessage,
  isLoading,
}: {
  title: string;
  subtitle: string;
  aValue: number | null;
  bValue: number | null;
  max: number;
  unit: string;
  names: [string, string];
  unavailableMessage: string | null;
  isLoading: boolean;
}) {
  const safeMax = Math.max(max, 1);
  const difference =
    aValue === null || bValue === null ? null : Math.abs(aValue - bValue);
  const leader =
    aValue === null || bValue === null || aValue === bValue
      ? null
      : aValue > bValue
        ? names[0]
        : names[1];
  return (
    <article
      className="panel progress-panel availability-host"
      aria-busy={isLoading}
    >
      <div className={unavailableMessage ? "availability-content-blurred" : ""}>
        <PanelHeader title={title} eyebrow={subtitle} />
        <div className="rings">
          <Ring
            value={aValue ?? 0}
            max={safeMax}
            accent="blue"
            name={names[0]}
          />
          <Ring
            value={bValue ?? 0}
            max={safeMax}
            accent="green"
            name={names[1]}
          />
        </div>
        <div className="lead-callout">
          <Sparkles size={13} />
          {leader && difference !== null
            ? `${leader} leads by ${formatValue(difference)} ${unit}`
            : "Comparison unavailable"}
        </div>
      </div>
      <DataUnavailableOverlay message={unavailableMessage} />
      <LoadingOverlay isLoading={isLoading} label={`Loading ${title}`} />
    </article>
  );
}

function Ring({
  value,
  max,
  accent,
  name,
}: {
  value: number;
  max: number;
  accent: string;
  name: string;
}) {
  const percentage = Math.round((value / max) * 100);
  return (
    <div className="ring-item">
      <div
        className={`ring ${accent}`}
        style={
          { "--progress": `${percentage * 3.6}deg` } as React.CSSProperties
        }
      >
        <div>
          <strong>{value}</strong>
          <span>/ {max}</span>
        </div>
      </div>
      <strong>{percentage}%</strong>
      <small>{name}</small>
    </div>
  );
}

function EfficiencyCard({
  names,
  comparison,
  isLoading,
}: {
  names: [string, string];
  comparison: EfficiencyComparison | undefined;
  isLoading: boolean;
}) {
  const labels = names.map(compactName) as [string, string];
  const rows = [
    ["EHP", comparison?.efficiency.ehp],
    ["EHB", comparison?.efficiency.ehb],
    ["Hours to max", comparison?.efficiency.timeToMax],
    ["Hours to 200m all", comparison?.efficiency.timeTo200m],
  ] as const;
  return (
    <article className="panel efficiency-panel" aria-busy={isLoading}>
      <PanelHeader title="Efficiency & EHP" eyebrow="Wise Old Man" />
      <div className="column-labels">
        <span />
        <strong className="blue-text">{labels[0]}</strong>
        <strong className="green-text">{labels[1]}</strong>
      </div>
      {rows.map(([label, metric]) => (
        <div className="efficiency-row" key={label}>
          <span>{label}</span>
          <strong>{metric?.left == null ? "—" : metric.left.toFixed(1)}</strong>
          <strong>
            {metric?.right == null ? "—" : metric.right.toFixed(1)}
          </strong>
        </div>
      ))}
      <div className="efficiency-rank">
        <span>WOM profile</span>
        <strong>{comparison ? "Connected" : "Unavailable"}</strong>
      </div>
      <LoadingOverlay
        isLoading={isLoading}
        label="Loading efficiency metrics"
      />
    </article>
  );
}

function Highlights({
  names,
  efficiency,
  runeProfile,
  overviewHistory,
  unavailableMessage,
  isLoading,
}: {
  names: [string, string];
  efficiency: EfficiencyComparison | undefined;
  runeProfile: RuneProfileDashboard | undefined;
  overviewHistory: OverviewHistory | null;
  unavailableMessage: string | null;
  isLoading: boolean;
}) {
  const questPointDelta =
    runeProfile?.left && runeProfile.right
      ? runeProfile.left.quests.earnedPoints -
        runeProfile.right.quests.earnedPoints
      : null;
  const ehpDelta = efficiency?.efficiency.ehp.delta ?? null;
  const combatDelta = efficiency?.efficiency.combatLevel.delta ?? null;
  const activityDelta =
    overviewHistory === null
      ? null
      : (buildTimeline(overviewHistory).at(-1)?.a ?? 0) -
        (buildTimeline(overviewHistory).at(-1)?.b ?? 0);
  const copyByTitle: Record<string, string | null> = {
    "More active recently":
      activityDelta === null
        ? null
        : activityDelta === 0
          ? "Both players gained the same XP in the selected timeline."
          : `${activityDelta > 0 ? names[0] : names[1]} gained ${formatCompact(Math.abs(activityDelta))} more XP in the selected timeline.`,
    "More efficient":
      ehpDelta === null
        ? null
        : ehpDelta === 0
          ? "Both players have the same current EHP."
          : `${ehpDelta > 0 ? names[0] : names[1]} leads by ${Math.abs(ehpDelta).toFixed(1)} EHP.`,
    "Ahead in questing":
      questPointDelta === null
        ? null
        : questPointDelta === 0
          ? "Both players have earned the same number of quest points."
          : `${questPointDelta > 0 ? names[0] : names[1]} leads by ${formatValue(Math.abs(questPointDelta))} quest points.`,
    "Stronger combat profile":
      combatDelta === null
        ? null
        : combatDelta === 0
          ? "Both players have the same current combat level."
          : `${combatDelta > 0 ? names[0] : names[1]} leads by ${Math.abs(combatDelta).toFixed(1)} combat levels.`,
  };
  const toneByTitle: Record<string, HighlightTone> = {
    "More active recently": toneFromDelta(activityDelta),
    "More efficient": toneFromDelta(ehpDelta),
    "Ahead in questing": toneFromDelta(questPointDelta),
    "Stronger combat profile": toneFromDelta(combatDelta),
  };

  return (
    <article className="panel highlights-panel" aria-busy={isLoading}>
      <PanelHeader title="Comparison highlights" eyebrow="Generated summary" />
      <div className="highlight-list">
        {highlights.map(({ icon: Icon, title, fallbackCopy }) => {
          const isRuneProfileHighlight = title === "Ahead in questing";
          const isUnavailable =
            isRuneProfileHighlight && unavailableMessage !== null;
          const tone = isUnavailable ? "neutral" : toneByTitle[title];
          return (
            <div
              className={[
                "highlight",
                `highlight-${tone}`,
                isUnavailable ? "highlight-unavailable" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={title}
            >
              <span className="highlight-icon">
                <Icon size={15} />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{copyByTitle[title] ?? fallbackCopy}</small>
              </span>
              {isUnavailable ? <em>RuneProfile unavailable</em> : null}
            </div>
          );
        })}
      </div>
      <LoadingOverlay
        isLoading={isLoading}
        label="Loading comparison highlights"
      />
    </article>
  );
}

function RecentActivity({
  names,
  history,
  error,
  isLoading,
}: {
  names: [string, string];
  history: OverviewHistory | null;
  error: string | null;
  isLoading: boolean;
}) {
  const recentActivity = buildDailyGains(history);
  const max = Math.max(
    1,
    ...recentActivity.flatMap((item) => [item.a, item.b]),
  );
  const chartData = recentActivity.map((item) => ({
    ...item,
    label: new Date(item.date).toLocaleDateString(undefined, {
      weekday: "narrow",
    }),
  }));
  return (
    <article className="panel activity-panel" aria-busy={isLoading}>
      <PanelHeader
        title="Recent XP gains"
        eyebrow="Last 7 days · Wise Old Man"
        action={
          <span className="fresh-badge">
            <i /> Live
          </span>
        }
      />
      <div className="bar-chart">
        <ResponsiveContainer
          height="100%"
          minHeight={0}
          minWidth={0}
          width="100%"
        >
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 4, bottom: 0, left: -10 }}
          >
            <CartesianGrid stroke="#e6ebef" vertical={false} />
            <XAxis dataKey="label" tickLine={false} />
            <YAxis
              domain={[0, max]}
              hide
              tickFormatter={formatCompact}
              tickLine={false}
            />
            <Tooltip
              formatter={(value, name) => [
                formatCompact(typeof value === "number" ? value : null),
                name === "a"
                  ? (history?.left.rsn ?? names[0])
                  : (history?.right.rsn ?? names[1]),
              ]}
            />
            <Bar
              dataKey="a"
              fill="var(--blue)"
              isAnimationActive={false}
              radius={[3, 3, 0, 0]}
            />
            <Bar
              dataKey="b"
              fill="var(--green)"
              isAnimationActive={false}
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        <span>
          <i className="blue-bg" />
          {history?.left.rsn ?? names[0]} (+
          {formatValue(history?.left.sevenDayGained ?? null)})
        </span>
        <span>
          <i className="green-bg" />
          {history?.right.rsn ?? names[1]} (+
          {formatValue(history?.right.sevenDayGained ?? null)})
        </span>
      </div>
      {error ? <p className="source-note">{error}</p> : null}
      <LoadingOverlay isLoading={isLoading} label="Loading recent XP gains" />
    </article>
  );
}

function QuestProgress({
  data,
  unavailableMessage,
  isLoading,
}: {
  data: RuneProfileDashboard | undefined;
  unavailableMessage: string | null;
  isLoading: boolean;
}) {
  const left = data?.left?.quests;
  const right = data?.right?.quests;
  const rows = [
    ["Completed", left?.completed ?? 0, right?.completed ?? 0],
    ["In progress", left?.started ?? 0, right?.started ?? 0],
    ["Not started", left?.notStarted ?? 0, right?.notStarted ?? 0],
  ] as const;
  return (
    <article
      className="panel quest-panel availability-host"
      aria-busy={isLoading}
    >
      <div className={unavailableMessage ? "availability-content-blurred" : ""}>
        <PanelHeader title="Quest progress" eyebrow="RuneProfile" />
        <div className="quest-stack blue-stack">
          <i
            style={{
              width: questPercentage(left?.completed ?? 0, left?.total),
            }}
          />
          <i
            style={{ width: questPercentage(left?.started ?? 0, left?.total) }}
          />
          <i
            style={{
              width: questPercentage(left?.notStarted ?? 0, left?.total),
            }}
          />
        </div>
        <div className="quest-stack green-stack">
          <i
            style={{
              width: questPercentage(right?.completed ?? 0, right?.total),
            }}
          />
          <i
            style={{
              width: questPercentage(right?.started ?? 0, right?.total),
            }}
          />
          <i
            style={{
              width: questPercentage(right?.notStarted ?? 0, right?.total),
            }}
          />
        </div>
        <div className="quest-rows">
          {rows.map((row) => (
            <div key={row[0]}>
              <span>{row[0]}</span>
              <strong className="blue-text">{row[1]}</strong>
              <strong className="green-text">{row[2]}</strong>
            </div>
          ))}
        </div>
      </div>
      <DataUnavailableOverlay message={unavailableMessage} />
      <LoadingOverlay isLoading={isLoading} label="Loading quest progress" />
    </article>
  );
}

function sourceStateLabel(
  state: NonNullable<PlayerProfile>["skillsState"] | undefined,
) {
  if (!state) return "Missing";
  if (state.status === "fresh" && state.lastSuccessAt) {
    return formatAge(state.lastSuccessAt);
  }
  return state.status === "notConnected" ? "Not connected" : state.status;
}

function SourceAvailability({
  names,
  leftProfile,
  rightProfile,
  isLoading,
}: {
  names: [string, string];
  leftProfile: PlayerProfile | undefined;
  rightProfile: PlayerProfile | undefined;
  isLoading: boolean;
}) {
  const labels = names.map(compactName) as [string, string];
  return (
    <article className="panel source-panel" aria-busy={isLoading}>
      <PanelHeader title="Source availability" eyebrow="Coverage & freshness" />
      <div className="source-grid">
        <div className="source-grid-head">
          <span />
          <strong>{labels[0]}</strong>
          <strong>{labels[1]}</strong>
        </div>
        <SourceRow
          icon={Database}
          label="Hiscores"
          a={sourceStateLabel(leftProfile?.skillsState)}
          b={sourceStateLabel(rightProfile?.skillsState)}
        />
        <SourceRow
          icon={Activity}
          label="Wise Old Man"
          a={sourceStateLabel(leftProfile?.efficiencyState)}
          b={sourceStateLabel(rightProfile?.efficiencyState)}
          aWarning={leftProfile?.efficiencyState?.status !== "fresh"}
          bWarning={rightProfile?.efficiencyState?.status !== "fresh"}
        />
        <SourceRow
          icon={Users}
          label="RuneProfile"
          a={sourceStateLabel(leftProfile?.questsState)}
          b={sourceStateLabel(rightProfile?.questsState)}
          aWarning={leftProfile?.questsState?.status !== "fresh"}
          bWarning={rightProfile?.questsState?.status !== "fresh"}
        />
      </div>
      <p className="source-note">
        <Clock3 size={12} /> Wise Old Man supplies current efficiency metrics;
        provider history remains on demand.
      </p>
      <LoadingOverlay
        isLoading={isLoading}
        label="Loading source availability"
      />
    </article>
  );
}

function SourceRow({
  icon: Icon,
  label,
  a,
  b,
  aWarning = false,
  bWarning = false,
}: {
  icon: LucideIcon;
  label: string;
  a: string;
  b: string;
  aWarning?: boolean;
  bWarning?: boolean;
}) {
  return (
    <div className="source-row">
      <span>
        <Icon size={13} />
        {label}
      </span>
      <strong className={aWarning ? "warning-text" : ""}>
        <i className={`status-dot ${aWarning ? "warning" : "live"}`} />
        {a}
      </strong>
      <strong className={bWarning ? "warning-text" : ""}>
        <i className={`status-dot ${bWarning ? "warning" : "live"}`} />
        {b}
      </strong>
    </div>
  );
}
