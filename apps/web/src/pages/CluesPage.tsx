import { api } from "@rune-rating/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  BarChart3,
  FileText,
  Medal,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useMemo } from "react";
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
  ComparisonKpiCard,
  DataNotice,
  EmptyState,
  PageHeader,
  PairChartTooltip,
  PanelHeader,
  PlayerPairLine,
  SourceChip,
  sideLabel,
  sideTone,
} from "../components/comparison-ui";
import {
  knownTotal,
  scoreDifference,
  scoreLeadDetail,
  scoreLeader,
} from "../features/comparison/activityScores";
import { chartPlayerColors } from "../features/comparison/chartTheme";
import { clueRankTarget } from "../features/comparison/clueTargets";
import { useComparisonShell } from "../features/comparison/context";
import {
  formatCompact,
  formatLead,
  formatValue as formatNumber,
  formatDelta as formatSigned,
} from "../features/comparison/formatters";
import "./CluesPage.css";

type ActivitiesComparison = FunctionReturnType<
  typeof api.comparisons.getActivities
>;
type ActivityRow = NonNullable<ActivitiesComparison>["activities"][number];
type PlayerSide = "left" | "right" | "tie" | "indeterminate";
type TierKey = "beginner" | "easy" | "medium" | "hard" | "elite" | "master";

type ClueRow = ActivityRow & {
  tier: TierKey;
  label: string;
  tone: string;
};

const clueTiers: {
  key: TierKey;
  label: string;
  tone: string;
  threshold: number;
}[] = [
  { key: "beginner", label: "Beginner", tone: "green", threshold: 50_000 },
  { key: "easy", label: "Easy", tone: "blue", threshold: 40_000 },
  { key: "medium", label: "Medium", tone: "yellow", threshold: 20_000 },
  { key: "hard", label: "Hard", tone: "orange", threshold: 15_000 },
  { key: "elite", label: "Elite", tone: "purple", threshold: 10_000 },
  { key: "master", label: "Master", tone: "red", threshold: 5_000 },
];

const tierByKey = new Map(clueTiers.map((tier) => [tier.key, tier]));
const tierOrder = new Map(clueTiers.map((tier, index) => [tier.key, index]));

function tierFromName(name: string): TierKey | null {
  const match = name.match(/\((beginner|easy|medium|hard|elite|master)\)/i);
  return (match?.[1]?.toLowerCase() as TierKey) ?? null;
}

function rankGap(row: ClueRow) {
  if (row.rank.left === null || row.rank.right === null) return null;
  return Math.abs(row.rank.left - row.rank.right);
}

function buildRows(activities: ActivityRow[] | undefined): ClueRow[] {
  return (activities ?? [])
    .filter((activity) => activity.category === "clues")
    .map((activity) => {
      const tier = tierFromName(activity.name);
      if (tier === null) return null;
      const definition = tierByKey.get(tier);
      return {
        ...activity,
        tier,
        label: definition?.label ?? activity.name,
        tone: definition?.tone ?? "blue",
      };
    })
    .filter((row): row is ClueRow => row !== null)
    .sort(
      (a, b) => (tierOrder.get(a.tier) ?? 0) - (tierOrder.get(b.tier) ?? 0),
    );
}

function CluesPage() {
  const { names } = useComparisonShell();
  const comparison = useQuery(api.comparisons.getActivities, {
    leftRsn: names[0],
    rightRsn: names[1],
  });

  const rows = useMemo(
    () => buildRows(comparison?.activities),
    [comparison?.activities],
  );
  const model = useMemo(() => buildClueModel(rows), [rows]);
  const chartData = useMemo(
    () =>
      rows.map((row) => ({
        tier: row.label,
        left: row.score.left,
        right: row.score.right,
      })),
    [rows],
  );
  const isLoading = comparison === undefined;

  return (
    <section className="clues-page" aria-busy={isLoading}>
      <PageHeader title="Clues" meta={<SourceChip label="Hiscores" />} />

      {comparison === null ? (
        <DataNotice>
          Clue data is not available for this comparison yet.
        </DataNotice>
      ) : null}

      <section className="clues-kpis" aria-label="Clue summary">
        <ComparisonKpiCard
          isLoading={isLoading}
          icon={<FileText size={24} />}
          label="Total Clue Lead"
          value={formatLead(model.totalScoreLead)}
          detail={scoreLeadDetail(
            model.totalScoreLead,
            names,
            "Completions are tied",
          )}
          tone={sideTone(model.totalLeader)}
        />
        <ComparisonKpiCard
          isLoading={isLoading}
          icon={<Trophy size={25} />}
          label="Highest Tier Lead"
          value={model.highestLeadValue}
          detail={
            model.highestLeadTier === null
              ? "No known completion differences"
              : `${sideLabel(model.highestLeadSide, names)} ahead in ${model.highestLeadTier}`
          }
          tone={sideTone(model.highestLeadSide)}
        />
        <ComparisonKpiCard
          isLoading={isLoading}
          icon={<BarChart3 size={25} />}
          label="Tiers led"
          value={
            model.leadingTierCount === null
              ? "—"
              : `${model.leadingTierCount} of ${model.comparableTierCount}`
          }
          detail={
            <PlayerPairLine
              names={names}
              left={formatNumber(model.leftLeadCount)}
              right={formatNumber(model.rightLeadCount)}
              leftLabel="Leads"
              rightLabel="Leads"
            />
          }
          tone={sideTone(model.leadingTierSide)}
        />
        <ComparisonKpiCard
          isLoading={isLoading}
          icon={<TrendingUp size={26} />}
          label="Best Rank Advantage"
          value={formatNumber(model.bestRankAdvantage?.gap ?? null)}
          detail={model.bestRankAdvantage?.label ?? "No ranked tier"}
          tone={sideTone(model.bestRankAdvantage?.side ?? "indeterminate")}
        />
      </section>

      <div className="clues-main-grid">
        <div className="clues-primary-column">
          <article className="clues-panel clues-chart-panel">
            <PanelHeader
              title="Clue Scroll Completions by Tier"
              subtitle="All tiers"
            />
            <div className="clues-legend">
              <span>
                <i className="left" />
                {names[0]}
              </span>
              <span>
                <i className="right" />
                {names[1]}
              </span>
            </div>
            <div className="clues-chart-frame">
              <ResponsiveContainer
                width="100%"
                height={255}
                minWidth={0}
                minHeight={0}
                initialDimension={{ width: 1, height: 1 }}
              >
                <BarChart data={chartData} barGap={7} barCategoryGap="24%">
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis
                    dataKey="tier"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={8}
                  />
                  <YAxis
                    tickFormatter={(value) => formatCompact(Number(value))}
                    tickLine={false}
                    axisLine={false}
                    width={42}
                  />
                  <Tooltip
                    filterNull={false}
                    content={
                      <PairChartTooltip
                        names={names}
                        formatter={formatNumber}
                      />
                    }
                    labelFormatter={(label) => `${label} clues`}
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
          </article>

          <ClueTable rows={rows} names={names} isLoading={isLoading} />
        </div>

        <aside className="clues-side-column" aria-label="Rank gaps by tier">
          <article className="clues-panel clues-pressure-panel">
            <PanelHeader title="Rank gaps by tier" />
            <div className="clues-pressure-list">
              {model.pressureRows.map((row) => (
                <PressureRow key={row.key} row={row} />
              ))}
            </div>
          </article>

          <article className="clues-panel clues-opportunity-panel">
            <PanelHeader
              title="Rank targets"
              subtitle={`Unreached rank targets for ${names[1]}`}
            />
            <div className="clues-opportunity-list">
              {model.opportunities.map((row) => (
                <div className="clues-opportunity" key={row.key}>
                  <span className={`clues-tier-badge ${row.tone}`}>
                    <Medal size={14} />
                  </span>
                  <div>
                    <strong>
                      {row.label}: Top {formatNumber(row.threshold)}
                    </strong>
                    <small>
                      {formatNumber(row.currentRank)} →{" "}
                      {formatNumber(row.threshold)}
                    </small>
                  </div>
                  <b>
                    {formatNumber(row.toPass)}
                    <small>Pass</small>
                  </b>
                </div>
              ))}
              {model.opportunities.length === 0 ? (
                <EmptyState>
                  {isLoading
                    ? "Loading clue ranks…"
                    : `No unreached targets in the available ranks for ${names[1]}.`}
                </EmptyState>
              ) : null}
            </div>
          </article>
        </aside>
      </div>

      <p className="clues-footnote">
        Clue completion data is sourced from official OSRS Hiscores snapshots.
      </p>
    </section>
  );
}

function buildClueModel(rows: ClueRow[]) {
  const totalDelta = scoreDifference(
    knownTotal(rows.map((row) => row.score.left)),
    knownTotal(rows.map((row) => row.score.right)),
  );
  const totalLeader = scoreLeader(totalDelta);
  const comparableRows = rows.filter(
    (row) => row.score.left !== null && row.score.right !== null,
  );
  const leftLeadCount = comparableRows.length
    ? comparableRows.filter((row) => row.score.leader === "left").length
    : null;
  const rightLeadCount = comparableRows.length
    ? comparableRows.filter((row) => row.score.leader === "right").length
    : null;
  const leadingTierSide = scoreLeader(
    scoreDifference(leftLeadCount, rightLeadCount),
  );
  const leadingTierCount =
    leftLeadCount === null || rightLeadCount === null
      ? null
      : Math.max(leftLeadCount, rightLeadCount);
  const scoreLeads = rows
    .filter((row) => row.score.delta !== null)
    .map((row) => ({
      row,
      side: row.score.leader,
      delta: Math.abs(row.score.delta ?? 0),
    }))
    .filter((row) => row.side === "left" || row.side === "right")
    .sort((a, b) => b.delta - a.delta);
  const highestLead = scoreLeads[0] ?? null;
  const rankLeads = rows
    .map((row) => ({
      row,
      side: row.rank.leader,
      gap: rankGap(row),
    }))
    .filter(
      (
        row,
      ): row is {
        row: ClueRow;
        side: "left" | "right";
        gap: number;
      } => row.gap !== null && (row.side === "left" || row.side === "right"),
    )
    .sort((a, b) => b.gap - a.gap);
  const pressureRows = rows
    .map((row) => {
      const gap = rankGap(row);
      return {
        key: row.key,
        label: row.label,
        tone: row.tone,
        gap,
        pressure: gap === null ? 0 : Math.min(100, Math.max(3, gap / 200)),
      };
    })
    .sort((a, b) => (b.gap ?? -1) - (a.gap ?? -1))
    .slice(0, 6);
  const opportunities = rows
    .map((row) => {
      const tier = tierByKey.get(row.tier);
      if (tier === undefined) return null;
      const target = clueRankTarget(row.rank.right, tier.threshold);
      if (target === null) return null;
      return {
        key: row.key,
        label: row.label,
        tone: row.tone,
        ...target,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.toPass - b.toPass)
    .slice(0, 5);
  return {
    totalScoreLead: totalDelta,
    totalLeader: totalLeader as PlayerSide,
    highestLeadValue: highestLead ? formatLead(highestLead.delta) : "—",
    highestLeadTier: highestLead?.row.label ?? null,
    highestLeadSide: (highestLead?.side ?? "indeterminate") as PlayerSide,
    comparableTierCount: comparableRows.length,
    leadingTierCount,
    leftLeadCount,
    rightLeadCount,
    leadingTierSide: leadingTierSide as PlayerSide,
    bestRankAdvantage: rankLeads[0]
      ? {
          label: rankLeads[0].row.label,
          gap: rankLeads[0].gap,
          side: rankLeads[0].side,
        }
      : null,
    pressureRows,
    opportunities,
  };
}

function ClueTable({
  rows,
  names,
  isLoading,
}: {
  rows: ClueRow[];
  names: [string, string];
  isLoading: boolean;
}) {
  const totalLeft = knownTotal(rows.map((row) => row.score.left));
  const totalRight = knownTotal(rows.map((row) => row.score.right));
  const totalDelta = scoreDifference(totalLeft, totalRight);
  const totalLeader = scoreLeader(totalDelta);

  return (
    <article className="clues-panel clues-table-panel">
      <div className="clues-table-wrap">
        <table className="clues-table">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Rank (A)</th>
              <th>Rank (B)</th>
              <th>Completions (A)</th>
              <th>Completions (B)</th>
              <th>Δ Completions</th>
              <th>Leader</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8}>Loading clue tiers...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8}>No clue rows available.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <span className={`clues-tier-badge ${row.tone}`}>
                      <Target size={13} />
                    </span>
                    {row.label}
                  </td>
                  <td>{formatNumber(row.rank.left)}</td>
                  <td>{formatNumber(row.rank.right)}</td>
                  <td>{formatNumber(row.score.left)}</td>
                  <td>{formatNumber(row.score.right)}</td>
                  <td className={sideTone(row.score.leader)}>
                    {formatSigned(row.score.delta)}
                  </td>
                  <td>
                    <span
                      className={`clues-leader ${sideTone(row.score.leader)}`}
                    >
                      {sideLabel(row.score.leader, names)}
                    </span>
                  </td>
                  <td>
                    {row.score.left !== null && row.score.right !== null
                      ? "Available"
                      : row.score.left !== null || row.score.right !== null
                        ? "Partial"
                        : "Unavailable"}
                  </td>
                </tr>
              ))
            )}
            {rows.length > 0 ? (
              <tr className="clues-total-row">
                <td>Total</td>
                <td />
                <td />
                <td>{formatNumber(totalLeft)}</td>
                <td>{formatNumber(totalRight)}</td>
                <td className={sideTone(totalLeader)}>
                  {formatSigned(totalDelta)}
                </td>
                <td>
                  <span className={`clues-leader ${sideTone(totalLeader)}`}>
                    {sideLabel(totalLeader, names)}
                  </span>
                </td>
                <td>All rows</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function PressureRow({
  row,
}: {
  row: {
    key: string;
    label: string;
    tone: string;
    gap: number | null;
    pressure: number;
  };
}) {
  return (
    <div className="clues-pressure-row">
      <span className={`clues-tier-badge ${row.tone}`}>
        <Target size={13} />
      </span>
      <strong>{row.label}</strong>
      <div className="clues-pressure-track">
        <i style={{ width: `${row.pressure}%` }} />
      </div>
      <b>{formatNumber(row.gap)}</b>
    </div>
  );
}

export default CluesPage;
