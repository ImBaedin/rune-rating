import { api } from "@rune-rating/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertTriangle,
  Check,
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
import { chartPlayerColors } from "../features/comparison/chartTheme";
import { useComparisonShell } from "../features/comparison/context";
import { formatCountOf, formatValue } from "../features/comparison/formatters";
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
const tierTotals: Record<Tier, number> = {
  Easy: 4,
  Medium: 4,
  Hard: 4,
  Elite: 4,
};

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
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
  const visibleTierMaximum = model.totalRegions * visibleTiers.length;
  const leftVisibleCompleted = leftStats
    ? visibleTiers.reduce(
        (total, tier) => total + leftStats.byTier[tier].completed,
        0,
      )
    : null;
  const rightVisibleCompleted = rightStats
    ? visibleTiers.reduce(
        (total, tier) => total + rightStats.byTier[tier].completed,
        0,
      )
    : null;

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
          title="Tasks remaining"
          values={{
            left: leftStats?.remainingTasks ?? null,
            right: rightStats?.remainingTasks ?? null,
          }}
          names={names}
        />
        <DiaryMetricCard
          icon={<Gift size={22} />}
          title="Tasks completed"
          values={{
            left: leftStats?.completedTasks ?? null,
            right: rightStats?.completedTasks ?? null,
          }}
          names={names}
        />
      </div>

      <div className="ad-main-grid">
        <article className="ad-panel ad-region-panel">
          <PanelHeader title="Completed tiers by region" />
          <div className="ad-region-table-wrap">
            <table
              className={`ad-region-table ad-region-matrix ${visibleTiers.length === 1 ? "single-tier" : ""}`.trim()}
            >
              <thead>
                <tr>
                  <th rowSpan={2}>Region</th>
                  <th colSpan={visibleTiers.length}>
                    <span className="ad-matrix-player left">
                      <i />
                      {names[0]}
                    </span>
                  </th>
                  <th
                    className="ad-player-divider"
                    colSpan={visibleTiers.length}
                  >
                    <span className="ad-matrix-player right">
                      <i />
                      {names[1]}
                    </span>
                  </th>
                </tr>
                <tr>
                  {visibleTiers.map((tier) => (
                    <th className="ad-matrix-tier" key={`left-${tier}`}>
                      {tier}
                    </th>
                  ))}
                  {visibleTiers.map((tier) => (
                    <th
                      className={`ad-matrix-tier ${tier === visibleTiers[0] ? "ad-player-divider" : ""}`.trim()}
                      key={`right-${tier}`}
                    >
                      {tier}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <RegionRow
                    key={row.region}
                    row={row}
                    visibleTiers={visibleTiers}
                    names={names}
                  />
                ))}
                <tr className="ad-region-total">
                  <td>Visible total</td>
                  <td colSpan={visibleTiers.length}>
                    <RegionTotal
                      side="left"
                      value={leftVisibleCompleted}
                      max={visibleTierMaximum}
                    />
                  </td>
                  <td
                    className="ad-player-divider"
                    colSpan={visibleTiers.length}
                  >
                    <RegionTotal
                      side="right"
                      value={rightVisibleCompleted}
                      max={visibleTierMaximum}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <MobileRegionMatrix
            leftTotal={leftVisibleCompleted}
            max={visibleTierMaximum}
            names={names}
            rightTotal={rightVisibleCompleted}
            rows={visibleRows}
            visibleTiers={visibleTiers}
          />
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
            <h2>Diary summary</h2>
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
                left={leftStats?.completedTiers ?? null}
                right={rightStats?.completedTiers ?? null}
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
            <ResponsiveContainer
              width="100%"
              height={210}
              minWidth={0}
              minHeight={0}
              initialDimension={{ width: 1, height: 1 }}
            >
              <BarChart data={model.tierChartData} barGap={8}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
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
                  cursor={{ fill: "var(--chart-cursor)" }}
                />
                <Bar
                  dataKey="left"
                  fill={chartPlayerColors.left}
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="right"
                  fill={chartPlayerColors.right}
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
          <h2>Diaries with the most tasks remaining</h2>
          <BlockerTable rows={model.blockers} names={names} />
        </article>

        <article className="ad-panel">
          <h2>Missing Elite tasks</h2>
          <MissingEliteTable rows={model.missingElite} names={names} />
        </article>
      </div>

      <footer className="ad-footnote">
        <span>Diary data comes from RuneProfile.</span>
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
  return formatCountOf(value, max);
}

function formatDiaryCardValue(value: number | null, max?: number) {
  if (value === null) return "Unavailable";
  return formatCountOf(value, max);
}

function CompletionDonut({
  left,
  right,
}: {
  left: number | null;
  right: number | null;
}) {
  return (
    <ResponsiveContainer
      width="100%"
      height={96}
      minWidth={0}
      minHeight={0}
      initialDimension={{ width: 1, height: 1 }}
    >
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
          <Cell fill={chartPlayerColors.left} />
          <Cell fill="var(--chart-track)" />
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
          <Cell fill={chartPlayerColors.right} />
          <Cell fill="var(--chart-track)" />
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
    <ResponsiveContainer
      width="100%"
      height={82}
      minWidth={0}
      minHeight={0}
      initialDimension={{ width: 1, height: 1 }}
    >
      <RadialBarChart
        innerRadius="58%"
        outerRadius="100%"
        startAngle={180}
        endAngle={0}
        data={[
          { name: "left", value: left ?? 0, fill: chartPlayerColors.left },
          { name: "right", value: right ?? 0, fill: chartPlayerColors.right },
        ]}
      >
        <RadialBar
          background={{ fill: "var(--chart-track)" }}
          dataKey="value"
          cornerRadius={8}
        />
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
  names,
}: {
  row: ReturnType<typeof buildDiaryModel>["regions"][number];
  visibleTiers: Tier[];
  names: [string, string];
}) {
  return (
    <tr>
      <td>
        <strong>{row.region}</strong>
      </td>
      {(["left", "right"] as const).flatMap((side) =>
        visibleTiers.map((tier, index) => (
          <td
            className={
              side === "right" && index === 0 ? "ad-player-divider" : undefined
            }
            key={`${side}-${tier}`}
          >
            <TierStatus
              name={names[side === "left" ? 0 : 1]}
              region={row.region}
              side={side}
              tier={tier}
              value={row.sides[side]?.tiers[tier] ?? null}
            />
          </td>
        )),
      )}
    </tr>
  );
}

function MobileRegionMatrix({
  leftTotal,
  max,
  names,
  rightTotal,
  rows,
  visibleTiers,
}: {
  leftTotal: number | null;
  max: number;
  names: [string, string];
  rightTotal: number | null;
  rows: ReturnType<typeof buildDiaryModel>["regions"];
  visibleTiers: Tier[];
}) {
  return (
    <div className="ad-mobile-region-list">
      {rows.map((row) => (
        <article className="ad-mobile-region" key={row.region}>
          <h3>{row.region}</h3>
          <div className="ad-mobile-region-players">
            {(["left", "right"] as const).map((side) => {
              const name = names[side === "left" ? 0 : 1];
              return (
                <section className={`ad-mobile-player ${side}`} key={side}>
                  <h4>
                    <i />
                    <span>{name}</span>
                  </h4>
                  <div
                    className={`ad-mobile-tier-grid ${visibleTiers.length === 1 ? "single-tier" : ""}`.trim()}
                  >
                    {visibleTiers.map((tier) => (
                      <div className="ad-mobile-tier" key={tier}>
                        <span className="ad-mobile-tier-label">{tier}</span>
                        <TierStatus
                          name={name}
                          region={row.region}
                          side={side}
                          tier={tier}
                          value={row.sides[side]?.tiers[tier] ?? null}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </article>
      ))}
      <div className="ad-mobile-region-total">
        <span>Visible total</span>
        <div>
          <RegionTotal side="left" value={leftTotal} max={max} />
        </div>
        <div>
          <RegionTotal side="right" value={rightTotal} max={max} />
        </div>
      </div>
    </div>
  );
}

function TierStatus({
  name,
  region,
  side,
  tier,
  value,
}: {
  name: string;
  region: string;
  side: PlayerSide;
  tier: Tier;
  value: {
    completed: boolean | null;
    current: number;
    total: number;
    remaining: number;
  } | null;
}) {
  if (value === null || value.completed === null) {
    return (
      <span
        className="ad-tier-status unavailable"
        aria-label={`${name}: ${region} ${tier} status unavailable`}
        role="img"
      >
        —
      </span>
    );
  }

  if (value.completed) {
    return (
      <span
        className={`ad-tier-status complete ${side}`}
        aria-label={`${name}: ${region} ${tier} complete`}
        role="img"
      >
        <Check aria-hidden="true" size={18} />
      </span>
    );
  }

  const progress =
    value.total > 0
      ? Math.max(0, Math.min(100, (value.current / value.total) * 100))
      : 0;
  return (
    <span
      className={`ad-tier-status progress ${side}`}
      aria-label={`${name}: ${region} ${tier}, ${value.current} of ${value.total} tasks complete`}
      role="img"
    >
      <svg aria-hidden="true" viewBox="0 0 36 36">
        <circle className="track" cx="18" cy="18" r="14" />
        <circle
          className="value"
          cx="18"
          cy="18"
          r="14"
          pathLength="100"
          strokeDasharray={`${progress} ${100 - progress}`}
          transform="rotate(-90 18 18)"
        />
        <text
          className="copy"
          dominantBaseline="central"
          textAnchor="middle"
          x="18"
          y="18"
        >
          {value.current}/{value.total}
        </text>
      </svg>
    </span>
  );
}

function RegionTotal({
  side,
  value,
  max,
}: {
  side: PlayerSide;
  value: number | null;
  max: number;
}) {
  return (
    <span className={`ad-region-summary ${side}`}>
      <strong>{value === null ? "—" : value}</strong>
      <small className="ad-region-summary-copy">/ {max} tiers complete</small>
    </span>
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
      <b className="ad-left">{left === null ? "-" : formatValue(left)}</b>
      <b className="ad-right">{right === null ? "-" : formatValue(right)}</b>
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
