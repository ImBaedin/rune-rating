import { api } from "@rune-rating/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  BarChart3,
  Crown,
  ExternalLink,
  Info,
  Swords,
  Target,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
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
import { getBossIconUrls } from "../bossIcons";
import {
  ComparisonKpiCard,
  PageHeader,
  Pagination,
  PairChartTooltip,
  PanelHeader,
  PlayerPairLine,
  SegmentedControl,
  SelectField,
  SourceChip,
} from "../components/comparison-ui";
import "./BossingPage.css";

type ActivitiesComparison = FunctionReturnType<
  typeof api.comparisons.getActivities
>;
type ActivityComparison =
  NonNullable<ActivitiesComparison>["activities"][number];
type ActivityLeader = ActivityComparison["score"]["leader"];
type BossTab = "bosses" | "raids" | "all";
type RankFilter = "all" | "ranked" | "unranked";
type SortMode = "gap" | "total" | "name";

type BossRow = ActivityComparison & {
  isRaid: boolean;
  isRanked: boolean;
  absGap: number | null;
  totalScore: number;
};

type Kpi = {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  icon: ReactNode;
  tone: "blue" | "green" | "purple" | "orange";
};

const fmt = new Intl.NumberFormat("en-US");
const raidNamePatterns = [
  "Chambers of Xeric",
  "Theatre of Blood",
  "Tombs of Amascut",
];
const chartLimitOptions = [8, 10, 15];
const pageSize = 16;

const formatNumber = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : fmt.format(value);

const formatSigned = (value: number | null | undefined, suffix = "") =>
  value === null || value === undefined
    ? "—"
    : `${value > 0 ? "+" : ""}${fmt.format(value)}${suffix}`;

const formatRank = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "Unranked"
    : `Rank ${fmt.format(value)}`;

const isRaidName = (name: string) =>
  raidNamePatterns.some((pattern) => name.includes(pattern));

const leaderName = (leader: ActivityLeader, names: [string, string]) => {
  if (leader === "left") return names[0];
  if (leader === "right") return names[1];
  if (leader === "tie") return "Tie";
  return "—";
};

const leaderClass = (leader: ActivityLeader) =>
  leader === "left" ? "blue" : leader === "right" ? "green" : "muted";

function buildRows(result: ActivitiesComparison | undefined): BossRow[] {
  return (result?.activities ?? [])
    .filter((activity) => activity.category === "bossing")
    .map((activity) => ({
      ...activity,
      isRaid: isRaidName(activity.name),
      isRanked: activity.rank.left !== null || activity.rank.right !== null,
      absGap:
        activity.score.delta === null ? null : Math.abs(activity.score.delta),
      totalScore: (activity.score.left ?? 0) + (activity.score.right ?? 0),
    }))
    .sort((a, b) => {
      const gapDelta = (b.absGap ?? -1) - (a.absGap ?? -1);
      return (
        gapDelta || b.totalScore - a.totalScore || a.name.localeCompare(b.name)
      );
    });
}

function BossingPage() {
  const { names } = useComparisonShell();
  const result = useQuery(api.comparisons.getActivities, {
    leftRsn: names[0],
    rightRsn: names[1],
  });
  const [bossTab, setBossTab] = useState<BossTab>("bosses");
  const [rankFilter, setRankFilter] = useState<RankFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("gap");
  const [chartLimit, setChartLimit] = useState(10);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => buildRows(result), [result]);
  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (bossTab === "bosses" && row.isRaid) return false;
      if (bossTab === "raids" && !row.isRaid) return false;
      if (rankFilter === "ranked" && !row.isRanked) return false;
      if (rankFilter === "unranked" && row.isRanked) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "total")
        return b.totalScore - a.totalScore || a.name.localeCompare(b.name);
      return (
        (b.absGap ?? -1) - (a.absGap ?? -1) ||
        b.totalScore - a.totalScore ||
        a.name.localeCompare(b.name)
      );
    });
  }, [bossTab, rankFilter, rows, sortMode]);

  const chartRows = useMemo(
    () =>
      visibleRows.slice(0, chartLimit).map((row) => ({
        name: row.name,
        left: row.score.left ?? 0,
        right: row.score.right ?? 0,
      })),
    [chartLimit, visibleRows],
  );

  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visibleRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const stats = useMemo(() => {
    const ranked = rows.filter((row) => row.isRanked);
    const raids = rows.filter((row) => row.isRaid);
    const leftRanked = ranked.filter((row) => row.rank.left !== null).length;
    const rightRanked = ranked.filter((row) => row.rank.right !== null).length;
    const leftRaidScore = raids.reduce(
      (sum, row) => sum + (row.score.left ?? 0),
      0,
    );
    const rightRaidScore = raids.reduce(
      (sum, row) => sum + (row.score.right ?? 0),
      0,
    );
    const topGap = rows.find((row) => row.absGap !== null);
    const leftLead = rows.reduce(
      (sum, row) => sum + Math.max(row.score.delta ?? 0, 0),
      0,
    );
    const rightLead = rows.reduce(
      (sum, row) => sum + Math.max(-(row.score.delta ?? 0), 0),
      0,
    );

    return {
      ranked,
      raids,
      leftRanked,
      rightRanked,
      leftRaidScore,
      rightRaidScore,
      topGap,
      scoreLead: leftLead - rightLead,
    };
  }, [rows]);

  const opportunities = useMemo(
    () =>
      rows
        .filter((row) => row.absGap !== null && row.score.leader !== "tie")
        .slice(0, 6),
    [rows],
  );

  const isLoading = result === undefined;
  const kpis: Kpi[] = [
    {
      label: "Boss KC lead",
      value: formatSigned(stats.scoreLead, " KC"),
      detail:
        stats.scoreLead >= 0 ? `${names[0]} is ahead` : `${names[1]} is ahead`,
      icon: <Swords size={25} />,
      tone: stats.scoreLead >= 0 ? "blue" : "green",
    },
    {
      label: "Ranked bosses",
      value: `${formatNumber(Math.max(stats.leftRanked, stats.rightRanked))} ranked`,
      detail: (
        <PlayerPairLine
          names={names}
          left={formatNumber(stats.leftRanked)}
          right={formatNumber(stats.rightRanked)}
        />
      ),
      icon: <BarChart3 size={25} />,
      tone: "blue",
    },
    {
      label: "Raid completions",
      value: `${formatNumber(
        Math.max(stats.leftRaidScore, stats.rightRaidScore),
      )} completions`,
      detail: (
        <PlayerPairLine
          names={names}
          left={formatNumber(stats.leftRaidScore)}
          right={formatNumber(stats.rightRaidScore)}
        />
      ),
      icon: <Crown size={25} />,
      tone: "purple",
    },
    {
      label: "Top gap",
      value: formatSigned(stats.topGap?.score.delta, " KC"),
      detail: stats.topGap?.name ?? "No ranked gap yet",
      icon: <Target size={25} />,
      tone: "orange",
    },
  ];

  return (
    <section className="bossing-page" aria-busy={isLoading}>
      <PageHeader
        title="Bossing"
        meta={<SourceChip label="Hiscores" />}
        controls={
          <>
            <SegmentedControl
              label="Boss category"
              value={bossTab}
              options={[
                ["bosses", "Bosses"],
                ["raids", "Raids"],
                ["all", "All"],
              ]}
              onChange={(value) => {
                setBossTab(value);
                setPage(1);
              }}
            />
            <SegmentedControl
              label="Rank filter"
              value={rankFilter}
              options={[
                ["all", "All"],
                ["ranked", "Ranked"],
                ["unranked", "Unranked"],
              ]}
              onChange={(value) => {
                setRankFilter(value);
                setPage(1);
              }}
            />
            <SelectField
              label="Sort"
              value={sortMode}
              options={[
                ["gap", "Largest gap"],
                ["total", "Highest total"],
                ["name", "Name"],
              ]}
              onChange={(value) => {
                setSortMode(value);
                setPage(1);
              }}
            />
          </>
        }
      />

      <section className="bossing-kpi-grid" aria-label="Bossing summary">
        {kpis.map((kpi) => (
          <ComparisonKpiCard
            label={kpi.label}
            value={kpi.value}
            detail={kpi.detail}
            tone={kpi.tone}
            icon={kpi.icon}
            isLoading={isLoading}
            key={kpi.label}
          />
        ))}
      </section>

      <section className="bossing-layout">
        <main className="bossing-main">
          <article className="bossing-panel bossing-chart-panel">
            <PanelHeader
              title="Top boss kill counts"
              subtitle="Grouped KC and completions for the current filter."
              action={
                <label className="bossing-chart-limit">
                  <span>Top</span>
                  <select
                    value={chartLimit}
                    onChange={(event) =>
                      setChartLimit(Number(event.target.value))
                    }
                  >
                    {chartLimitOptions.map((option) => (
                      <option value={option} key={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              }
            />
            <div className="bossing-chart-wrap">
              <ResponsiveContainer
                width="100%"
                height={Math.max(260, chartRows.length * 31)}
              >
                <BarChart
                  data={chartRows}
                  layout="vertical"
                  margin={{ top: 6, right: 30, bottom: 4, left: 12 }}
                  barCategoryGap={8}
                >
                  <CartesianGrid horizontal={false} stroke="#e7ebef" />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#74808d", fontSize: 11 }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={150}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#17202a", fontSize: 11 }}
                  />
                  <Tooltip
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
            </div>
          </article>

          <BossTable
            isLoading={isLoading}
            names={names}
            rows={pageRows}
            total={visibleRows.length}
          />
          <Pagination
            total={visibleRows.length}
            pageSize={pageSize}
            currentPage={currentPage}
            pageCount={pageCount}
            itemLabel="bosses"
            variant="text"
            onPrevious={() => setPage((value) => Math.max(1, value - 1))}
            onNext={() => setPage((value) => Math.min(pageCount, value + 1))}
          />
        </main>

        <aside className="bossing-side">
          <OpportunityPanel rows={opportunities} names={names} />
          <article className="bossing-panel bossing-data-card">
            <h2>
              <Info size={15} />
              About this data
            </h2>
            <p>
              Boss KC and raid completions come from Old School Hiscores.
              Missing scores or ranks are treated as unavailable, not zero.
            </p>
            <a
              href="https://secure.runescape.com/m=hiscore_oldschool/overall"
              target="_blank"
              rel="noreferrer"
            >
              View data source <ExternalLink size={13} />
            </a>
          </article>
        </aside>
      </section>
    </section>
  );
}

function BossTable({
  isLoading,
  names,
  rows,
  total,
}: {
  isLoading: boolean;
  names: [string, string];
  rows: BossRow[];
  total: number;
}) {
  return (
    <article className="bossing-panel bossing-table-panel">
      <div className="bossing-table-scroll">
        <table className="bossing-table">
          <thead>
            <tr>
              <th>Boss</th>
              <th>{names[0]} KC / Rank</th>
              <th>{names[1]} KC / Rank</th>
              <th>Delta</th>
              <th>Leader</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <span className="bossing-boss-name">
                    <BossBadge name={row.name} />
                    <span>
                      <strong>{row.name}</strong>
                      <small>
                        {row.isRaid
                          ? "Raid"
                          : row.isRanked
                            ? "Ranked"
                            : "Unranked"}
                      </small>
                    </span>
                  </span>
                </td>
                <td>
                  <ScoreCell side="left" row={row} />
                </td>
                <td>
                  <ScoreCell side="right" row={row} />
                </td>
                <td className={leaderClass(row.score.leader)}>
                  {formatSigned(row.score.delta, " KC")}
                </td>
                <td>
                  <span
                    className={`bossing-leader ${leaderClass(row.score.leader)}`}
                  >
                    {leaderName(row.score.leader, names)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading || total === 0 ? (
          <div className="bossing-table-state">
            {isLoading
              ? "Loading bossing comparison..."
              : "No bosses match these filters."}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ScoreCell({ row, side }: { row: BossRow; side: "left" | "right" }) {
  const color = side === "left" ? "blue" : "green";
  return (
    <span className="bossing-score-cell">
      <i className={color} />
      <b>{formatNumber(row.score[side])}</b>
      <small>{formatRank(row.rank[side])}</small>
    </span>
  );
}

function OpportunityPanel({
  rows,
  names,
}: {
  rows: BossRow[];
  names: [string, string];
}) {
  return (
    <article className="bossing-panel bossing-opportunities">
      <div className="bossing-panel-header">
        <div>
          <h2>
            <Target size={16} />
            Fastest progress opportunities
          </h2>
          <p>
            Bosses where the trailing player could gain the most KC fastest.
          </p>
        </div>
      </div>
      <div className="bossing-opportunity-list">
        {rows.map((row) => {
          const trailing =
            row.score.leader === "left"
              ? names[1]
              : row.score.leader === "right"
                ? names[0]
                : "Either player";
          const estimatedHours =
            row.absGap === null ? null : Math.max(0.5, row.absGap / 20);
          return (
            <div className="bossing-opportunity" key={row.key}>
              <BossBadge name={row.name} />
              <div>
                <strong>{row.name}</strong>
                <span>{trailing} target</span>
              </div>
              <dl>
                <div>
                  <dt>Gap</dt>
                  <dd>{formatNumber(row.absGap)} KC</dd>
                </div>
                <div>
                  <dt>Est. hrs</dt>
                  <dd>{estimatedHours?.toFixed(1) ?? "—"}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function BossBadge({ name }: { name: string }) {
  const iconUrls = getBossIconUrls(name);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={`bossing-badge ${iconUrls.length > 0 ? "has-icon" : ""} ${
        iconUrls.length > 1 ? "has-icon-pair" : ""
      }`}
      aria-hidden="true"
    >
      {iconUrls.length > 0 ? (
        <span className="bossing-badge-icon-set">
          {iconUrls.map((iconUrl) => (
            <img
              src={iconUrl}
              alt=""
              loading="lazy"
              decoding="async"
              key={iconUrl}
              onError={(event) => {
                event.currentTarget
                  .closest(".bossing-badge")
                  ?.classList.add("bossing-badge-missing");
              }}
            />
          ))}
        </span>
      ) : null}
      <span className="bossing-badge-fallback">{initials}</span>
    </span>
  );
}

export default BossingPage;
