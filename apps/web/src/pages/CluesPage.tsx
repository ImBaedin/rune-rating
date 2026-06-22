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
import { useComparisonShell } from "../App";
import {
  ComparisonKpiCard,
  DataNotice,
  PageHeader,
  PanelHeader,
  PlayerPairLine,
  SourceChip,
  sideLabel,
  sideTone,
} from "../components/comparison-ui";
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

const fmt = new Intl.NumberFormat("en-US");
const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const playerColors = {
  left: "var(--blue)",
  right: "var(--green)",
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

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : fmt.format(value);
}

function formatSigned(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value > 0 ? "+" : ""}${fmt.format(value)}`;
}

function formatLead(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  if (value === 0) return "0";
  return `+${fmt.format(Math.abs(value))}`;
}

function rankGap(row: ClueRow) {
  if (row.rank.left === null || row.rank.right === null) return null;
  return Math.abs(row.rank.left - row.rank.right);
}

function isRanked(row: ClueRow) {
  return row.score.left !== null || row.score.right !== null;
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
        left: row.score.left ?? 0,
        right: row.score.right ?? 0,
      })),
    [rows],
  );
  const isLoading = comparison === undefined;

  return (
    <section className="clues-page" aria-busy={isLoading}>
      <PageHeader title="Clues" meta={<SourceChip label="Hiscores" />} />

      {comparison === null ? (
        <DataNotice>
          Hiscores activity snapshots are not available for this comparison yet.
        </DataNotice>
      ) : null}

      <section className="clues-kpis" aria-label="Clue summary">
        <ComparisonKpiCard
          icon={<FileText size={24} />}
          label="Total Clue Lead"
          value={formatLead(model.totalScoreLead)}
          detail={`${sideLabel(model.totalLeader, names)} ahead`}
          tone={sideTone(model.totalLeader)}
        />
        <ComparisonKpiCard
          icon={<Trophy size={25} />}
          label="Highest Tier Lead"
          value={model.highestLeadValue}
          detail={
            model.highestLeadTier === null
              ? `${sideLabel(model.highestLeadSide, names)} ahead`
              : `${sideLabel(model.highestLeadSide, names)} ahead in ${model.highestLeadTier}`
          }
          tone={sideTone(model.highestLeadSide)}
        />
        <ComparisonKpiCard
          icon={<BarChart3 size={25} />}
          label="Tiers led"
          value={`${model.leadingTierCount} of ${model.rankedTierCount}`}
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
              <ResponsiveContainer width="100%" height={255}>
                <BarChart data={chartData} barGap={7} barCategoryGap="24%">
                  <CartesianGrid stroke="#e5ebf2" vertical={false} />
                  <XAxis
                    dataKey="tier"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={8}
                  />
                  <YAxis
                    tickFormatter={(value) => compactFmt.format(Number(value))}
                    tickLine={false}
                    axisLine={false}
                    width={42}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatNumber(Number(value)),
                      name === "left" ? names[0] : names[1],
                    ]}
                    labelFormatter={(label) => `${label} clues`}
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
          </article>

          <ClueTable rows={rows} names={names} isLoading={isLoading} />
        </div>

        <aside className="clues-side-column" aria-label="Tier pressure">
          <article className="clues-panel clues-pressure-panel">
            <PanelHeader
              title="Tier Pressure"
              subtitle={`Where ${names[1]} can gain the most rankings`}
            />
            <div className="clues-pressure-list">
              {model.pressureRows.map((row) => (
                <PressureRow key={row.key} row={row} />
              ))}
            </div>
          </article>

          <article className="clues-panel clues-opportunity-panel">
            <PanelHeader
              title="Top Ranking Opportunities"
              subtitle="Specific rank thresholds within tiers"
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
                      {formatNumber(row.threshold - 1)}
                    </small>
                  </div>
                  <b>
                    {formatNumber(row.toPass)}
                    <small>Pass</small>
                  </b>
                </div>
              ))}
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
  const totalRow = rows.reduce(
    (total, row) => ({
      left: total.left + (row.score.left ?? 0),
      right: total.right + (row.score.right ?? 0),
    }),
    { left: 0, right: 0 },
  );
  const totalDelta = totalRow.left - totalRow.right;
  const totalLeader =
    totalDelta === 0 ? "tie" : totalDelta > 0 ? "left" : "right";
  const rankedRows = rows.filter(isRanked);
  const leftLeadCount = rankedRows.filter(
    (row) => row.score.leader === "left",
  ).length;
  const rightLeadCount = rankedRows.filter(
    (row) => row.score.leader === "right",
  ).length;
  const leadingTierSide =
    leftLeadCount === rightLeadCount
      ? "tie"
      : leftLeadCount > rightLeadCount
        ? "left"
        : "right";
  const leadingTierCount = Math.max(leftLeadCount, rightLeadCount);
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
      const gap = rankGap(row) ?? 0;
      return {
        key: row.key,
        label: row.label,
        tone: row.tone,
        gap,
        pressure: Math.min(100, Math.max(3, gap / 200)),
      };
    })
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 6);
  const opportunities = rows
    .map((row) => {
      const currentRank = row.rank.right ?? row.rank.left ?? null;
      const tier = tierByKey.get(row.tier);
      if (currentRank === null || tier === undefined) return null;
      const toPass = Math.max(0, currentRank - tier.threshold + 1);
      return {
        key: row.key,
        label: row.label,
        tone: row.tone,
        threshold: tier.threshold,
        currentRank,
        toPass,
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
    rankedTierCount: rankedRows.length,
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
  const totalLeft = rows.reduce((sum, row) => sum + (row.score.left ?? 0), 0);
  const totalRight = rows.reduce((sum, row) => sum + (row.score.right ?? 0), 0);
  const totalDelta = totalLeft - totalRight;
  const totalLeader =
    totalDelta === 0 ? "tie" : totalDelta > 0 ? "left" : "right";

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
                  <td>{isRanked(row) ? "Ranked" : "Unranked"}</td>
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
    gap: number;
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
