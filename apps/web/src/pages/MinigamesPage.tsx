import { api } from "@rune-rating/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Gamepad2, Medal, Target, Trophy } from "lucide-react";
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
} from "../components/comparison-ui";
import {
  knownTotal,
  scoreDifference,
  scoreLeadDetail,
} from "../features/comparison/activityScores";
import { useComparisonShell } from "../features/comparison/context";
import {
  formatDelta,
  formatValue as formatNumber,
} from "../features/comparison/formatters";
import "./MinigamesPage.css";

type ActivitiesComparison = FunctionReturnType<
  typeof api.comparisons.getActivities
>;
type ActivityRow = NonNullable<ActivitiesComparison>["activities"][number];
type Leader = ActivityRow["score"]["leader"];
type MinigameRow = ActivityRow & {
  scoreGap: number | null;
  rankGap: number | null;
};

const leaderLabel = (leader: Leader, names: [string, string]) => {
  if (leader === "left") return names[0];
  if (leader === "right") return names[1];
  if (leader === "tie") return "Tie";
  return "Unranked";
};

const leaderClass = (leader: Leader) =>
  leader === "left" ? "blue" : leader === "right" ? "green" : "muted";

function MinigamesPage() {
  const { names } = useComparisonShell();
  const comparison = useQuery(api.comparisons.getActivities, {
    leftRsn: names[0],
    rightRsn: names[1],
  });

  const rows = useMemo<MinigameRow[]>(
    () =>
      (comparison?.activities ?? [])
        .filter((activity) => activity.category === "minigames")
        .map((activity) => ({
          ...activity,
          scoreGap:
            activity.score.delta === null
              ? null
              : Math.abs(activity.score.delta),
          rankGap:
            activity.rank.delta === null ? null : Math.abs(activity.rank.delta),
        }))
        .sort((left, right) => {
          const scoreGap = (right.scoreGap ?? -1) - (left.scoreGap ?? -1);
          return scoreGap || left.name.localeCompare(right.name);
        }),
    [comparison],
  );

  const scoredRows = useMemo(
    () =>
      rows.filter((row) => row.score.left !== null || row.score.right !== null),
    [rows],
  );

  const chartRows = useMemo(
    () =>
      scoredRows
        .slice()
        .sort((left, right) => {
          const rightMax = Math.max(
            right.score.left ?? 0,
            right.score.right ?? 0,
          );
          const leftMax = Math.max(left.score.left ?? 0, left.score.right ?? 0);
          return rightMax - leftMax || left.name.localeCompare(right.name);
        })
        .map((row) => ({
          name: row.name,
          left: row.score.left,
          right: row.score.right,
        })),
    [scoredRows],
  );

  const gapRows = useMemo(
    () =>
      rows
        .filter((row) => row.scoreGap !== null && row.score.leader !== "tie")
        .sort((left, right) => (right.scoreGap ?? 0) - (left.scoreGap ?? 0))
        .slice(0, 5),
    [rows],
  );

  const stats = useMemo(() => {
    const leftTotal = knownTotal(rows.map((row) => row.score.left));
    const rightTotal = knownTotal(rows.map((row) => row.score.right));
    const leftRanked = rows.length
      ? rows.filter((row) => row.rank.left !== null).length
      : null;
    const rightRanked = rows.length
      ? rows.filter((row) => row.rank.right !== null).length
      : null;
    const rankEdge = rows
      .filter((row) => row.rankGap !== null && row.rank.leader !== "tie")
      .sort((left, right) => (right.rankGap ?? 0) - (left.rankGap ?? 0))[0];
    const unrankedPressure = rows.filter(
      (row) => row.score.left === null || row.score.right === null,
    ).length;

    return {
      totalGap: scoreDifference(leftTotal, rightTotal),
      leftRanked,
      rightRanked,
      rankEdge,
      unrankedPressure: rows.length ? unrankedPressure : null,
    };
  }, [rows]);

  const isLoading = comparison === undefined;
  const noSnapshots = comparison === null;

  return (
    <div className="minigames-page">
      <PageHeader title="Minigames" meta={<SourceChip label="Hiscores" />} />

      {noSnapshots ? (
        <DataNotice>
          Minigame data is not ready for one or both players yet.
        </DataNotice>
      ) : null}

      <section className="minigames-kpis" aria-label="Minigame summary">
        <ComparisonKpiCard
          label="Total minigame score lead"
          value={formatDelta(stats.totalGap)}
          detail={scoreLeadDetail(stats.totalGap, names)}
          tone={
            stats.totalGap === null || stats.totalGap === 0
              ? "violet"
              : stats.totalGap > 0
                ? "blue"
                : "green"
          }
          icon={<Trophy size={30} />}
          isLoading={isLoading}
          loadingDetail="Loading player data"
        />
        <ComparisonKpiCard
          label="Ranked minigames"
          value={
            isLoading
              ? "..."
              : stats.leftRanked === null || stats.rightRanked === null
                ? "—"
                : `${formatNumber(Math.max(stats.leftRanked, stats.rightRanked))} ranked`
          }
          detail={
            <PlayerPairLine
              names={names}
              left={isLoading ? "..." : formatNumber(stats.leftRanked)}
              right={isLoading ? "..." : formatNumber(stats.rightRanked)}
            />
          }
          tone="green"
          icon={<Gamepad2 size={30} />}
          isLoading={false}
        />
        <ComparisonKpiCard
          label="Largest rank gap"
          value={
            stats.rankEdge
              ? `${formatNumber(stats.rankEdge.rankGap)} places`
              : "—"
          }
          detail={stats.rankEdge?.name ?? "No rank gap"}
          tone="violet"
          icon={<Medal size={30} />}
          isLoading={isLoading}
          loadingDetail="Loading player data"
        />
        <ComparisonKpiCard
          label="Missing scores"
          value={`${isLoading ? "..." : formatNumber(stats.unrankedPressure)}`}
          detail="missing score entries"
          tone="amber"
          icon={<Target size={30} />}
          isLoading={false}
        />
      </section>

      <section className="minigames-grid">
        <div className="minigames-main">
          <section className="minigames-panel minigames-chart-panel">
            <PanelHeader
              title="Top minigame scores"
              subtitle="Grouped comparison of available minigame scores."
              names={names}
            />
            <div className="minigames-chart">
              {isLoading ? (
                <EmptyState>Loading minigame scores...</EmptyState>
              ) : chartRows.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={320}
                  minWidth={0}
                  minHeight={0}
                  initialDimension={{ width: 1, height: 1 }}
                >
                  <BarChart
                    data={chartRows}
                    layout="vertical"
                    margin={{ top: 6, right: 20, bottom: 12, left: 12 }}
                    barCategoryGap={9}
                  >
                    <CartesianGrid
                      horizontal={false}
                      stroke="var(--chart-grid)"
                    />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      width={132}
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                    />
                    <Tooltip
                      filterNull={false}
                      content={
                        <PairChartTooltip
                          names={names}
                          formatter={formatNumber}
                        />
                      }
                    />
                    <Bar
                      dataKey="left"
                      fill="var(--blue)"
                      radius={[0, 4, 4, 0]}
                    />
                    <Bar
                      dataKey="right"
                      fill="var(--green)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No minigame scores available.</EmptyState>
              )}
            </div>
          </section>

          <section className="minigames-panel minigames-table-panel">
            <div className="minigames-table-wrap">
              <table className="minigames-table">
                <thead>
                  <tr>
                    <th>Minigame</th>
                    <th>Score ({names[0]})</th>
                    <th>Rank ({names[0]})</th>
                    <th>Score ({names[1]})</th>
                    <th>Rank ({names[1]})</th>
                    <th>Delta</th>
                    <th>Leader</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8}>
                        <EmptyState>Loading minigame rows...</EmptyState>
                      </td>
                    </tr>
                  ) : rows.length > 0 ? (
                    rows.map((row) => (
                      <tr key={row.key}>
                        <td>
                          <span className="minigames-name">
                            <Gamepad2 size={13} />
                            {row.name}
                          </span>
                        </td>
                        <td>{formatNumber(row.score.left)}</td>
                        <td>{formatNumber(row.rank.left)}</td>
                        <td>{formatNumber(row.score.right)}</td>
                        <td>{formatNumber(row.rank.right)}</td>
                        <td
                          className={`minigames-delta ${leaderClass(
                            row.score.leader,
                          )}`}
                        >
                          {formatDelta(row.score.delta)}
                        </td>
                        <td>
                          <span
                            className={`minigames-leader ${leaderClass(
                              row.score.leader,
                            )}`}
                          >
                            {leaderLabel(row.score.leader, names)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`minigames-status ${
                              row.rank.left !== null && row.rank.right !== null
                                ? "ranked"
                                : "unranked"
                            }`}
                          >
                            {row.rank.left !== null && row.rank.right !== null
                              ? "Ranked"
                              : row.rank.left !== null ||
                                  row.rank.right !== null
                                ? "Partial"
                                : "Unranked"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8}>
                        <EmptyState>No minigames available.</EmptyState>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="minigames-side minigames-panel">
          <h2>Largest score gaps</h2>
          <div className="minigames-gap-list">
            {isLoading ? (
              <EmptyState>Loading score gaps...</EmptyState>
            ) : gapRows.length > 0 ? (
              gapRows.map((row) => (
                <GapRow row={row} names={names} key={row.key} />
              ))
            ) : (
              <EmptyState>No score gaps yet.</EmptyState>
            )}
          </div>
        </aside>
      </section>

      <p className="minigames-footnote">
        Scores and ranks come from Old School Hiscores. Missing scores remain
        unavailable and are excluded from score-gap ranking. Rank labels reflect
        Hiscores rank availability.
      </p>
    </div>
  );
}

function GapRow({ row, names }: { row: MinigameRow; names: [string, string] }) {
  const leader = leaderLabel(row.score.leader, names);
  const trailingScore =
    row.score.leader === "left" ? row.score.right : row.score.left;
  const leadingScore =
    row.score.leader === "left" ? row.score.left : row.score.right;
  const percent =
    trailingScore === null || leadingScore === null || leadingScore === 0
      ? 0
      : Math.min(100, Math.round((trailingScore / leadingScore) * 100));

  return (
    <article className="minigames-gap-row">
      <div className="minigames-gap-topline">
        <div>
          <strong>{row.name}</strong>
          <small>{leader} leads</small>
        </div>
        <span className={leaderClass(row.score.leader)}>
          {formatDelta(row.score.delta)}
        </span>
      </div>
      <div
        className="minigames-gap-meter"
        role="progressbar"
        aria-label={`${percent}% to match`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <ResponsiveContainer
          width="100%"
          height={16}
          minWidth={0}
          minHeight={0}
          initialDimension={{ width: 1, height: 1 }}
        >
          <BarChart
            data={[{ value: percent }]}
            layout="vertical"
            margin={{ top: 3, right: 0, bottom: 3, left: 0 }}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="name" hide />
            <Bar
              dataKey="value"
              fill={
                row.score.leader === "left" ? "var(--blue)" : "var(--green)"
              }
              background={{ fill: "var(--chart-track)", radius: 3 }}
              radius={[3, 3, 3, 3]}
            />
          </BarChart>
        </ResponsiveContainer>
        <small>{percent}% to match</small>
      </div>
    </article>
  );
}

export default MinigamesPage;
