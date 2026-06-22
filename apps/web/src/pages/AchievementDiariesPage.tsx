import { api } from "@rune-rating/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  ClipboardList,
  Gift,
  ListChecks,
  LockKeyhole,
  Trophy,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useComparisonShell } from "../App";
import {
  ComparisonKpiCard,
  DataNotice,
  PageHeader,
  PanelHeader,
  PlayerPairLine,
  SegmentedControl,
  SelectField,
  SourceChip,
} from "../components/comparison-ui";
import "./AchievementDiariesPage.css";

type CategoryResult = FunctionReturnType<typeof api.runeProfile.getCategory>;
type CategoryQueryResult = CategoryResult | undefined;
type DiaryItem = NonNullable<CategoryResult>["items"][number];
type PlayerSide = "left" | "right";
type Tier = "Easy" | "Medium" | "Hard" | "Elite";
type RegionFilter = "all" | string;
type StatusFilter = "all" | "incomplete";
type TierFilter = "all" | Tier;

const tiers: Tier[] = ["Easy", "Medium", "Hard", "Elite"];
const playerColors: Record<PlayerSide, string> = {
  left: "var(--blue)",
  right: "var(--green)",
};
const tierTotals: Record<Tier, number> = {
  Easy: 4,
  Medium: 4,
  Hard: 4,
  Elite: 4,
};

const fmt = new Intl.NumberFormat("en-US");

export default function AchievementDiariesPage() {
  const { names, runeProfile, runeProfileUnavailableMessage } =
    useComparisonShell();
  const leftCategory = useQuery(api.runeProfile.getCategory, {
    rsn: names[0],
    category: "diaries",
  });
  const rightCategory = useQuery(api.runeProfile.getCategory, {
    rsn: names[1],
    category: "diaries",
  });
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("incomplete");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  const model = useMemo(
    () => buildDiaryModel(leftCategory, rightCategory),
    [leftCategory, rightCategory],
  );
  const isLoading =
    runeProfile === undefined ||
    leftCategory === undefined ||
    rightCategory === undefined;
  const leftStats = model.players.left;
  const rightStats = model.players.right;
  const visibleRows = model.regions.filter((row) => {
    const matchesRegion = regionFilter === "all" || row.region === regionFilter;
    const hasIncomplete =
      tierFilter === "all"
        ? row.sides.left?.remainingTasks !== 0 ||
          row.sides.right?.remainingTasks !== 0
        : row.sides.left?.tiers[tierFilter]?.remaining !== 0 ||
          row.sides.right?.tiers[tierFilter]?.remaining !== 0;
    return matchesRegion && (statusFilter === "all" || hasIncomplete === true);
  });
  const visibleTiers = tierFilter === "all" ? tiers : [tierFilter];

  return (
    <section className="achievement-diaries-page" aria-busy={isLoading}>
      <PageHeader
        title="Achievement Diaries"
        meta={<SourceChip label="RuneProfile" href="https://runeprofile.com" />}
        controls={
          <>
            <SelectField
              label="Region"
              value={regionFilter}
              options={[
                ["all", "All regions"],
                ...model.regions.map(
                  (row) => [row.region, row.region] as [RegionFilter, string],
                ),
              ]}
              onChange={setRegionFilter}
            />
            <SegmentedControl
              label="Difficulty filter"
              value={tierFilter}
              options={[
                ...tiers.map((tier) => [tier, tier] as [TierFilter, string]),
                ["all", "All"],
              ]}
              onChange={setTierFilter}
            />
            <SelectField
              label="Status"
              value={statusFilter}
              options={[
                ["incomplete", "Incomplete"],
                ["all", "All statuses"],
              ]}
              onChange={setStatusFilter}
            />
          </>
        }
      />

      {runeProfileUnavailableMessage ? (
        <DataNotice>{runeProfileUnavailableMessage}</DataNotice>
      ) : null}

      <div className="ad-kpi-grid">
        <DiaryMetricCard
          icon={<ListChecks size={22} />}
          title="Completed tiers"
          values={{
            left: leftStats?.completedTiers ?? null,
            right: rightStats?.completedTiers ?? null,
          }}
          max={model.maxTiers}
          names={names}
        />
        <DiaryMetricCard
          icon={<Trophy size={22} />}
          title="Elite complete"
          values={{
            left: leftStats?.eliteComplete ?? null,
            right: rightStats?.eliteComplete ?? null,
          }}
          max={model.totalEliteTiers}
          names={names}
        />
        <DiaryMetricCard
          icon={<AlertTriangle size={22} />}
          title="Task blockers"
          values={{
            left: leftStats?.remainingTasks ?? null,
            right: rightStats?.remainingTasks ?? null,
          }}
          names={names}
        />
        <DiaryMetricCard
          icon={<Gift size={22} />}
          title="Reward unlocks"
          values={{
            left: leftStats?.completedTasks ?? null,
            right: rightStats?.completedTasks ?? null,
          }}
          names={names}
        />
      </div>

      <div className="ad-main-grid">
        <article className="ad-panel ad-region-panel">
          <PanelHeader title="Completed tiers by region" names={names} />
          <div className="ad-region-table-wrap">
            <table className="ad-region-table">
              <thead>
                <tr>
                  <th>Region</th>
                  {visibleTiers.map((tier) => (
                    <th key={tier}>{tier}</th>
                  ))}
                  <th>Total</th>
                  <th aria-label="Expand region" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <RegionRow
                    key={row.region}
                    row={row}
                    visibleTiers={visibleTiers}
                  />
                ))}
                <tr className="ad-region-total">
                  <td>Total</td>
                  {visibleTiers.map((tier) => (
                    <td key={tier}>
                      <DualValue
                        left={leftStats?.byTier[tier]?.completed ?? null}
                        right={rightStats?.byTier[tier]?.completed ?? null}
                        max={model.totalRegions}
                        compact
                      />
                    </td>
                  ))}
                  <td>
                    <DualValue
                      left={leftStats?.completedTiers ?? null}
                      right={rightStats?.completedTiers ?? null}
                      max={model.maxTiers}
                    />
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <aside className="ad-side-column">
          <article className="ad-panel ad-progress-panel">
            <PanelHeader title="Diary progress" names={names} />
            <div className="ad-progress-charts">
              <div>
                <span>All tiers</span>
                <CompletionDonut
                  left={leftStats?.tierPercent ?? null}
                  right={rightStats?.tierPercent ?? null}
                />
              </div>
              <div>
                <span>Elite tiers</span>
                <EliteGauge
                  left={leftStats?.elitePercent ?? null}
                  right={rightStats?.elitePercent ?? null}
                />
              </div>
            </div>
          </article>

          <article className="ad-panel ad-signals-panel">
            <h2>Diary signals</h2>
            <div className="ad-signal-list">
              <SignalRow
                icon={<Trophy size={16} />}
                tone="blue"
                label="Regions with Elite complete"
                detail="Highest tier better"
                left={leftStats?.eliteComplete ?? null}
                right={rightStats?.eliteComplete ?? null}
              />
              <SignalRow
                icon={<LockKeyhole size={16} />}
                tone="green"
                label="Elite tiers in progress"
                detail="Partial Elite tiers"
                left={leftStats?.eliteInProgress ?? null}
                right={rightStats?.eliteInProgress ?? null}
              />
              <SignalRow
                icon={<ClipboardList size={16} />}
                tone="green"
                label="Most total completions"
                detail="Overall tier completions"
                left={leftStats?.completedTasks ?? null}
                right={rightStats?.completedTasks ?? null}
              />
              <SignalRow
                icon={<AlertTriangle size={16} />}
                tone="amber"
                label="Most blocked tasks"
                detail="Incomplete requirements"
                left={leftStats?.remainingTasks ?? null}
                right={rightStats?.remainingTasks ?? null}
              />
              <SignalRow
                icon={<ListChecks size={16} />}
                tone="slate"
                label="Tasks remaining"
                detail="All incomplete tasks"
                left={leftStats?.remainingTasks ?? null}
                right={rightStats?.remainingTasks ?? null}
              />
            </div>
          </article>
        </aside>
      </div>

      <div className="ad-lower-grid">
        <article className="ad-panel">
          <PanelHeader title="Tier completion distribution" names={names} />
          <div className="ad-chart-frame">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={model.tierChartData} barGap={8}>
                <CartesianGrid stroke="#e7ebf0" vertical={false} />
                <XAxis dataKey="tier" tickLine={false} axisLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tickLine={false}
                  axisLine={false}
                  width={34}
                />
                <Tooltip
                  formatter={(value) => [
                    `${Number(value ?? 0).toFixed(1)}%`,
                    "",
                  ]}
                  cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
                />
                <Bar
                  dataKey="left"
                  fill={playerColors.left}
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="right"
                  fill={playerColors.right}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="ad-panel-footnote">
            Percent of total tiers completed per difficulty.
          </p>
        </article>

        <article className="ad-panel">
          <h2>Top blockers (by remaining tasks)</h2>
          <BlockerTable rows={model.blockers} names={names} />
        </article>

        <article className="ad-panel">
          <h2>Missing Elite tasks</h2>
          <MissingEliteTable rows={model.missingElite} names={names} />
        </article>
      </div>

      <footer className="ad-footnote">
        <span>
          Data sourced from RuneProfile. Tiers and tasks reflect the latest
          cached canonical snapshot for each player.
        </span>
      </footer>
    </section>
  );
}

function buildDiaryModel(
  left: CategoryQueryResult,
  right: CategoryQueryResult,
) {
  const regions = Array.from(
    new Set([
      ...(left?.items.map((item) => item.group) ?? []),
      ...(right?.items.map((item) => item.group) ?? []),
    ]),
  ).sort((a, b) => a.localeCompare(b));
  const totalRegions = regions.length;
  const maxTiers = totalRegions * tiers.length;
  const totalEliteTiers = totalRegions;
  const players = {
    left: left ? summarizePlayer(left.items, totalRegions) : null,
    right: right ? summarizePlayer(right.items, totalRegions) : null,
  };
  const regionRows = regions.map((region) => ({
    region,
    sides: {
      left: left ? summarizeRegion(left.items, region) : null,
      right: right ? summarizeRegion(right.items, region) : null,
    },
  }));
  const blockers = regionRows
    .flatMap((row) =>
      tiers.map((tier) => ({
        label: `${row.region} (${tier})`,
        left: row.sides.left?.tiers[tier]?.remaining ?? null,
        right: row.sides.right?.tiers[tier]?.remaining ?? null,
      })),
    )
    .filter((row) => (row.left ?? 0) > 0 || (row.right ?? 0) > 0)
    .sort(
      (a, b) =>
        Math.max(b.left ?? 0, b.right ?? 0) -
        Math.max(a.left ?? 0, a.right ?? 0),
    )
    .slice(0, 5);
  const missingElite = regionRows
    .map((row) => ({
      task: `${row.region} Elite`,
      region: row.region,
      left: row.sides.left?.tiers.Elite ?? null,
      right: row.sides.right?.tiers.Elite ?? null,
    }))
    .filter(
      (row) =>
        row.left?.completed === false ||
        row.right?.completed === false ||
        row.left === null ||
        row.right === null,
    )
    .sort(
      (a, b) =>
        Math.max(b.left?.remaining ?? 0, b.right?.remaining ?? 0) -
        Math.max(a.left?.remaining ?? 0, a.right?.remaining ?? 0),
    )
    .slice(0, 5);
  return {
    players,
    regions: regionRows,
    totalRegions,
    maxTiers,
    totalEliteTiers,
    blockers,
    missingElite,
    tierChartData: tiers.map((tier) => ({
      tier,
      left: players.left?.byTier[tier]?.percent ?? 0,
      right: players.right?.byTier[tier]?.percent ?? 0,
    })),
  };
}

function summarizePlayer(items: DiaryItem[], totalRegions: number) {
  const byTier = Object.fromEntries(
    tiers.map((tier) => {
      const tierItems = items.filter((item) => itemTier(item) === tier);
      const completed = tierItems.filter(
        (item) => item.completed === true,
      ).length;
      return [
        tier,
        {
          completed,
          total: totalRegions,
          percent: totalRegions > 0 ? (completed / totalRegions) * 100 : 0,
        },
      ];
    }),
  ) as Record<Tier, { completed: number; total: number; percent: number }>;
  const completedTiers = items.filter((item) => item.completed === true).length;
  const completedTasks = items.reduce(
    (sum, item) => sum + (item.current ?? 0),
    0,
  );
  const totalTasks = items.reduce((sum, item) => sum + (item.total ?? 0), 0);
  const remainingTasks = Math.max(0, totalTasks - completedTasks);
  const eliteItems = items.filter((item) => itemTier(item) === "Elite");
  const eliteComplete = eliteItems.filter(
    (item) => item.completed === true,
  ).length;
  const eliteInProgress = eliteItems.filter(
    (item) =>
      item.completed === false &&
      (item.current ?? 0) > 0 &&
      (item.total ?? 0) > 0,
  ).length;
  return {
    byTier,
    completedTiers,
    completedTasks,
    totalTasks,
    remainingTasks,
    eliteComplete,
    eliteInProgress,
    eliteGap: Math.max(0, totalRegions - eliteComplete),
    tierPercent:
      totalRegions > 0
        ? (completedTiers / (totalRegions * tiers.length)) * 100
        : 0,
    elitePercent: totalRegions > 0 ? (eliteComplete / totalRegions) * 100 : 0,
  };
}

function summarizeRegion(items: DiaryItem[], region: string) {
  const regionItems = items.filter((item) => item.group === region);
  const tierMap = Object.fromEntries(
    tiers.map((tier) => {
      const item = regionItems.find(
        (candidate) => itemTier(candidate) === tier,
      );
      const current = item?.current ?? 0;
      const total = item?.total ?? tierTotals[tier];
      return [
        tier,
        {
          completed: item?.completed ?? null,
          current,
          total,
          remaining: Math.max(0, total - current),
        },
      ];
    }),
  ) as Record<
    Tier,
    {
      completed: boolean | null;
      current: number;
      total: number;
      remaining: number;
    }
  >;
  return {
    tiers: tierMap,
    completedTiers: Object.values(tierMap).filter(
      (tier) => tier.completed === true,
    ).length,
    remainingTasks: Object.values(tierMap).reduce(
      (sum, tier) => sum + tier.remaining,
      0,
    ),
  };
}

function itemTier(item: DiaryItem): Tier {
  const suffix = item.label.split(" ").at(-1);
  return tiers.includes(suffix as Tier) ? (suffix as Tier) : "Easy";
}

function DiaryMetricCard({
  icon,
  title,
  values,
  max,
  names,
}: {
  icon: React.ReactNode;
  title: string;
  values: Record<PlayerSide, number | null>;
  max?: number;
  names: [string, string];
}) {
  return (
    <ComparisonKpiCard
      icon={icon}
      label={title}
      value={formatDiaryPrimaryValue(values, max)}
      detail={
        <PlayerPairLine
          names={names}
          left={formatDiaryCardValue(values.left, max)}
          right={formatDiaryCardValue(values.right, max)}
        />
      }
      className="ad-kpi-card"
      tone="slate"
    />
  );
}

function formatDiaryPrimaryValue(
  values: Record<PlayerSide, number | null>,
  max?: number,
) {
  const available = [values.left, values.right].filter(
    (value): value is number => value !== null,
  );
  if (available.length === 0) return "—";
  const value = Math.max(...available);
  return max ? `${fmt.format(value)} of ${fmt.format(max)}` : fmt.format(value);
}

function formatDiaryCardValue(value: number | null, max?: number) {
  if (value === null) return "Unavailable";
  if (!max) return fmt.format(value);
  return `${fmt.format(value)} of ${fmt.format(max)}`;
}

function CompletionDonut({
  left,
  right,
}: {
  left: number | null;
  right: number | null;
}) {
  return (
    <ResponsiveContainer width="100%" height={82}>
      <PieChart>
        <Pie
          data={donutData(left)}
          dataKey="value"
          innerRadius={24}
          outerRadius={32}
          startAngle={90}
          endAngle={-270}
          stroke="none"
        >
          <Cell fill={playerColors.left} />
          <Cell fill="#d8dee7" />
        </Pie>
        <Pie
          data={donutData(right)}
          dataKey="value"
          innerRadius={34}
          outerRadius={42}
          startAngle={90}
          endAngle={-270}
          stroke="none"
        >
          <Cell fill={playerColors.right} />
          <Cell fill="#d8dee7" />
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

function EliteGauge({
  left,
  right,
}: {
  left: number | null;
  right: number | null;
}) {
  return (
    <ResponsiveContainer width="100%" height={82}>
      <RadialBarChart
        innerRadius="58%"
        outerRadius="100%"
        startAngle={180}
        endAngle={0}
        data={[
          { name: "left", value: left ?? 0, fill: playerColors.left },
          { name: "right", value: right ?? 0, fill: playerColors.right },
        ]}
      >
        <RadialBar background dataKey="value" cornerRadius={8} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

function donutData(value: number | null) {
  const complete = Math.max(0, Math.min(100, value ?? 0));
  return [
    { name: "complete", value: complete },
    { name: "remaining", value: 100 - complete },
  ];
}

function RegionRow({
  row,
  visibleTiers,
}: {
  row: ReturnType<typeof buildDiaryModel>["regions"][number];
  visibleTiers: Tier[];
}) {
  return (
    <tr>
      <td>
        <strong>{row.region}</strong>
      </td>
      {visibleTiers.map((tier) => (
        <td key={tier}>
          <DualValue
            left={row.sides.left?.tiers[tier]?.current ?? null}
            right={row.sides.right?.tiers[tier]?.current ?? null}
            max={
              Math.max(
                row.sides.left?.tiers[tier]?.total ?? 0,
                row.sides.right?.tiers[tier]?.total ?? 0,
              ) || tierTotals[tier]
            }
            compact
          />
        </td>
      ))}
      <td>
        <DualValue
          left={row.sides.left?.completedTiers ?? null}
          right={row.sides.right?.completedTiers ?? null}
          max={tiers.length}
        />
      </td>
      <td>
        <ChevronRight size={14} />
      </td>
    </tr>
  );
}

function DualValue({
  left,
  right,
  max,
  compact = false,
}: {
  left: number | null;
  right: number | null;
  max: number;
  compact?: boolean;
}) {
  return (
    <div className={`ad-dual-value ${compact ? "compact" : ""}`}>
      <span className="ad-dual-line">
        <b className="ad-left">{left === null ? "-" : left}</b>
        <small>/ {max}</small>
      </span>
      <span className="ad-dual-line">
        <b className="ad-right">{right === null ? "-" : right}</b>
        <small>/ {max}</small>
      </span>
      <span className="ad-mini-bars" aria-hidden="true">
        <i
          className="left"
          style={{
            width: `${left === null || max === 0 ? 0 : (left / max) * 100}%`,
          }}
        />
        <i
          className="right"
          style={{
            width: `${right === null || max === 0 ? 0 : (right / max) * 100}%`,
          }}
        />
      </span>
    </div>
  );
}

function SignalRow({
  icon,
  tone,
  label,
  detail,
  left,
  right,
}: {
  icon: React.ReactNode;
  tone: "blue" | "green" | "amber" | "slate";
  label: string;
  detail: string;
  left: number | null;
  right: number | null;
}) {
  return (
    <div className="ad-signal-row">
      <span className={`ad-signal-icon ${tone}`}>{icon}</span>
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <b className="ad-left">{left === null ? "-" : fmt.format(left)}</b>
      <b className="ad-right">{right === null ? "-" : fmt.format(right)}</b>
    </div>
  );
}

function BlockerTable({
  rows,
  names,
}: {
  rows: Array<{ label: string; left: number | null; right: number | null }>;
  names: [string, string];
}) {
  return (
    <div className="ad-compact-table-wrap">
      <table className="ad-compact-table">
        <thead>
          <tr>
            <th>Region</th>
            <th>{names[0]}</th>
            <th>{names[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{row.left === null ? "-" : row.left}</td>
              <td>
                <span className="ad-pill">
                  {row.right === null ? "-" : row.right}
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3}>No blocker rows available.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function MissingEliteTable({
  rows,
  names,
}: {
  rows: Array<{
    task: string;
    region: string;
    left: { completed: boolean | null } | null;
    right: { completed: boolean | null } | null;
  }>;
  names: [string, string];
}) {
  return (
    <div className="ad-compact-table-wrap">
      <table className="ad-compact-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Region</th>
            <th>{names[0]}</th>
            <th>{names[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.task}>
              <td>{row.task}</td>
              <td>{row.region}</td>
              <td>
                <CompletionMark value={row.left?.completed ?? null} />
              </td>
              <td>
                <CompletionMark value={row.right?.completed ?? null} />
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4}>No missing Elite rows available.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function CompletionMark({ value }: { value: boolean | null }) {
  if (value === null) return <span className="ad-muted-mark">-</span>;
  if (!value) return <span className="ad-muted-mark">-</span>;
  return <Check className="ad-check" size={15} />;
}
