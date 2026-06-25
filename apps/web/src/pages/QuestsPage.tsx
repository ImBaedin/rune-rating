import { api } from "@rune-rating/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Circle,
  Trophy,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  captureAnalytics,
  countBucket,
  hashRsnPair,
  lookupRsnPairHashField,
} from "../analytics";
import {
  CheckboxField,
  ComparisonKpiCard,
  DataNotice,
  EmptyState,
  PageHeader,
  Pagination,
  PairChartTooltip,
  PanelHeader,
  PlayerPairLine,
  SearchField,
  SegmentedControl,
  SelectField,
  SourceChip,
} from "../components/comparison-ui";
import { useComparisonShell } from "../features/comparison/context";
import {
  formatValue as formatNumber,
  formatDelta as signed,
} from "../features/comparison/formatters";
import "./QuestsPage.css";

type QuestCategory = FunctionReturnType<typeof api.runeProfile.getCategory>;
type QuestItem = NonNullable<QuestCategory>["items"][number];
type StatusFilter = "all" | "completed" | "incomplete" | "different";
type PointFilter = "all" | "0" | "1" | "2" | "3" | "4" | "5";

type QuestRow = {
  key: string;
  label: string;
  group: string;
  points: number | null;
  left: QuestItem | null;
  right: QuestItem | null;
};

const pageSize = 25;
const groupLabels: Record<string, string> = {
  free: "Free",
  members: "Members",
  mini: "Miniquest",
};
const statusLabels: Record<string, string> = {
  finished: "Completed",
  in_progress: "Started",
  not_started: "Not started",
};
const pointBands = [
  { key: "0", label: "0 pt" },
  { key: "1", label: "1 pt" },
  { key: "2", label: "2 pts" },
  { key: "3", label: "3 pts" },
  { key: "4", label: "4 pts" },
  { key: "5", label: "5+ pts" },
];

const isComplete = (item: QuestItem | null) => item?.completed === true;
const isIncomplete = (item: QuestItem | null) => item?.completed === false;
const stateLabel = (state: string | null | undefined) =>
  state ? (statusLabels[state] ?? state.replaceAll("_", " ")) : "Unavailable";
const groupLabel = (group: string) => groupLabels[group] ?? group;
const pointBandKey = (points: number | null) =>
  points === null ? "0" : (String(Math.min(points, 5)) as PointFilter);

function buildRows(
  left: QuestCategory | undefined,
  right: QuestCategory | undefined,
): QuestRow[] {
  const rows = new Map<string, QuestRow>();
  for (const [side, category] of [
    ["left", left],
    ["right", right],
  ] as const) {
    for (const item of category?.items ?? []) {
      const existing = rows.get(item.key);
      rows.set(item.key, {
        key: item.key,
        label: existing?.label ?? item.label,
        group: existing?.group ?? item.group,
        points: existing?.points ?? item.points,
        left: side === "left" ? item : (existing?.left ?? null),
        right: side === "right" ? item : (existing?.right ?? null),
      });
    }
  }
  return [...rows.values()].sort((a, b) => {
    const pointDelta = (b.points ?? -1) - (a.points ?? -1);
    return pointDelta || a.label.localeCompare(b.label);
  });
}

function questPointSummary(category: QuestCategory | undefined) {
  return category?.summary.type === "quests" ? category.summary : null;
}

function QuestsPage() {
  const { names, runeProfile, runeProfileUnavailableMessage } =
    useComparisonShell();
  const leftCategory = useQuery(api.runeProfile.getCategory, {
    rsn: names[0],
    category: "quests",
  });
  const rightCategory = useQuery(api.runeProfile.getCategory, {
    rsn: names[1],
    category: "quests",
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [group, setGroup] = useState("all");
  const [points, setPoints] = useState<PointFilter>("all");
  const [hideZeroPoint, setHideZeroPoint] = useState(false);
  const [page, setPage] = useState(1);

  const isLoading =
    runeProfile === undefined ||
    leftCategory === undefined ||
    rightCategory === undefined;
  const leftSummary = questPointSummary(leftCategory);
  const rightSummary = questPointSummary(rightCategory);
  const rows = useMemo(
    () => buildRows(leftCategory, rightCategory),
    [leftCategory, rightCategory],
  );
  const groups = useMemo(
    () => [...new Set(rows.map((row) => row.group))].sort(),
    [rows],
  );
  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      if (query && !row.label.toLocaleLowerCase().includes(query)) return false;
      if (group !== "all" && row.group !== group) return false;
      if (hideZeroPoint && (row.points ?? 0) === 0) return false;
      if (points !== "all" && pointBandKey(row.points) !== points) return false;
      if (status === "completed")
        return isComplete(row.left) || isComplete(row.right);
      if (status === "incomplete")
        return isIncomplete(row.left) || isIncomplete(row.right);
      if (status === "different")
        return row.left?.completed !== row.right?.completed;
      return true;
    });
  }, [group, hideZeroPoint, points, rows, search, status]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const stats = useMemo(() => {
    const left = runeProfile?.left?.quests ?? leftSummary;
    const right = runeProfile?.right?.quests ?? rightSummary;
    const pointGap =
      left && right ? left.earnedPoints - right.earnedPoints : null;
    const leftMissing = left ? left.total - left.completed : null;
    const rightMissing = right ? right.total - right.completed : null;
    return {
      points: {
        left: left?.earnedPoints ?? null,
        right: right?.earnedPoints ?? null,
        delta: pointGap,
      },
      completed: {
        left: left?.completed ?? null,
        right: right?.completed ?? null,
        delta: left && right ? left.completed - right.completed : null,
      },
      missing: {
        left: leftMissing,
        right: rightMissing,
        delta:
          leftMissing !== null && rightMissing !== null
            ? leftMissing - rightMissing
            : null,
      },
      gap: pointGap,
    };
  }, [leftSummary, rightSummary, runeProfile]);

  const chartData = useMemo(
    () =>
      pointBands.map((band) => ({
        band: band.label,
        left: rows.filter(
          (row) =>
            pointBandKey(row.points) === band.key && isComplete(row.left),
        ).length,
        right: rows.filter(
          (row) =>
            pointBandKey(row.points) === band.key && isComplete(row.right),
        ).length,
      })),
    [rows],
  );
  const notableMissing = useMemo(
    () =>
      rows
        .filter((row) => isComplete(row.left) !== isComplete(row.right))
        .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
        .slice(0, 6),
    [rows],
  );
  const completionEdges = useMemo(
    () =>
      rows
        .filter((row) => isComplete(row.left) !== isComplete(row.right))
        .slice(0, 6),
    [rows],
  );

  useEffect(() => {
    if (
      !search.trim() &&
      status === "all" &&
      group === "all" &&
      points === "all" &&
      !hideZeroPoint
    ) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void hashRsnPair(names).then(([leftRsnHash, rightRsnHash]) => {
        captureAnalytics("rich_search_applied", {
          category: "quests",
          query_length_bucket: countBucket(search.trim().length),
          result_count_bucket: countBucket(filteredRows.length),
          filters: `status:${status}|group:${group}|points:${points}|hide_zero:${hideZeroPoint}`,
          expanded_results: false,
          left_rsn_hash: leftRsnHash,
          right_rsn_hash: rightRsnHash,
          ...lookupRsnPairHashField(leftRsnHash, rightRsnHash),
        });
      });
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [
    filteredRows.length,
    group,
    hideZeroPoint,
    names,
    points,
    search,
    status,
  ]);

  return (
    <div className="quests-page">
      <PageHeader
        title="Quests"
        meta={
          <SourceChip
            label="RuneProfile"
            status={runeProfileUnavailableMessage ? "warn" : "ok"}
          />
        }
        controls={
          <>
            <SearchField
              value={search}
              placeholder="Search quests..."
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
            />
            <SegmentedControl
              label="Status"
              value={status}
              options={[
                ["all", "All"],
                ["completed", "Completed"],
                ["incomplete", "Incomplete"],
                ["different", "Different"],
              ]}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
            <SelectField
              label="Category"
              value={group}
              options={[
                ["all", "All"],
                ...groups.map(
                  (itemGroup) =>
                    [itemGroup, groupLabel(itemGroup)] as [string, string],
                ),
              ]}
              onChange={(value) => {
                setGroup(value);
                setPage(1);
              }}
            />
            <SelectField
              label="Points"
              value={points}
              compact
              options={[
                ["all", "All"] as [PointFilter, string],
                ...pointBands.map(
                  (band) => [band.key, band.label] as [PointFilter, string],
                ),
              ]}
              onChange={(value) => {
                setPoints(value);
                setPage(1);
              }}
            />
            <CheckboxField
              checked={hideZeroPoint}
              onChange={(checked) => {
                setHideZeroPoint(checked);
                setPage(1);
              }}
            >
              Hide zero-point
            </CheckboxField>
            <span className="quests-count">{filteredRows.length} quests</span>
          </>
        }
      />

      {runeProfileUnavailableMessage ? (
        <DataNotice>{runeProfileUnavailableMessage}</DataNotice>
      ) : null}

      <section className="quests-kpis" aria-label="Quest summary">
        <ComparisonKpiCard
          icon={<BookOpenCheck size={22} />}
          label="Quest points"
          value={signed(stats.points.delta)}
          detail={
            <PlayerPairLine
              names={names}
              left={formatNumber(stats.points.left)}
              right={formatNumber(stats.points.right)}
            />
          }
          tone="slate"
          isLoading={isLoading}
        />
        <ComparisonKpiCard
          icon={<CheckCircle2 size={22} />}
          label="Completed"
          value={signed(stats.completed.delta)}
          detail={
            <PlayerPairLine
              names={names}
              left={formatNumber(stats.completed.left)}
              right={formatNumber(stats.completed.right)}
            />
          }
          tone="slate"
          isLoading={isLoading}
        />
        <ComparisonKpiCard
          icon={<XCircle size={22} />}
          label="Missing"
          value={signed(stats.missing.delta)}
          detail={
            <PlayerPairLine
              names={names}
              left={formatNumber(stats.missing.left)}
              right={formatNumber(stats.missing.right)}
            />
          }
          tone="slate"
          isLoading={isLoading}
        />
        <ComparisonKpiCard
          icon={<Trophy size={22} />}
          label="Point leader"
          value={
            stats.gap === null
              ? "—"
              : stats.gap === 0
                ? "Tied"
                : stats.gap > 0
                  ? names[0]
                  : names[1]
          }
          detail={
            <PlayerPairLine
              names={names}
              left={signed(stats.gap)}
              right={signed(stats.gap === null ? null : -stats.gap)}
              leftLabel="Point gap"
              rightLabel="Point gap"
            />
          }
          isLoading={isLoading}
          tone="slate"
        />
      </section>

      <section className="quests-main-grid">
        <div className="quests-workspace-panel">
          <QuestTable rows={pageRows} names={names} isLoading={isLoading} />

          <Pagination
            total={filteredRows.length}
            pageSize={pageSize}
            currentPage={currentPage}
            pageCount={pageCount}
            itemLabel="quests"
            onPrevious={() => setPage((value) => Math.max(1, value - 1))}
            onNext={() => setPage((value) => Math.min(pageCount, value + 1))}
          />
        </div>

        <aside className="quests-side">
          <SignalCard
            title="Quest signals"
            rows={pointBands
              .slice()
              .reverse()
              .map((band) => ({
                label: band.label,
                left: chartData.find((item) => item.band === band.label)?.left,
                right: chartData.find((item) => item.band === band.label)
                  ?.right,
              }))}
            names={names}
          />
          <EdgeCard
            title="Completion edges"
            rows={completionEdges}
            names={names}
          />
          <BlockersCard rows={notableMissing} names={names} />
        </aside>
      </section>

      <section className="quests-lower-grid">
        <div className="quests-chart-card">
          <PanelHeader
            title="Quest completions by points"
            subtitle="Current completed quest count in each point band."
            names={names}
          />
          <div className="quests-rechart">
            <ResponsiveContainer width="100%" height={236}>
              <BarChart data={chartData} barCategoryGap={18}>
                <CartesianGrid vertical={false} stroke="#e7ebef" />
                <XAxis
                  dataKey="band"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#74808d", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#74808d", fontSize: 11 }}
                  width={34}
                />
                <Tooltip
                  content={
                    <PairChartTooltip names={names} formatter={formatNumber} />
                  }
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
        </div>

        <div className="quests-missing-card">
          <PanelHeader
            title="Notable missing quests"
            subtitle="Highest-point quests completed by only one player."
            help={false}
          />
          <div className="quests-missing-list">
            {notableMissing.length > 0 ? (
              notableMissing.map((row) => (
                <MissingRow row={row} names={names} key={row.key} />
              ))
            ) : (
              <EmptyState>
                Both players match on visible quest completions.
              </EmptyState>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function QuestTable({
  rows,
  names,
  isLoading,
}: {
  rows: QuestRow[];
  names: [string, string];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="quests-table-state">
        <BookOpenCheck size={20} />
        Loading RuneProfile quest snapshots...
      </div>
    );
  }
  if (rows.length === 0)
    return <EmptyState>No quests match these filters.</EmptyState>;
  return (
    <div className="quests-table-wrap">
      <table className="quests-table">
        <thead>
          <tr>
            <th>Quest</th>
            <th>Category</th>
            <th>
              <span className="player-dot blue" />
              {names[0]}
            </th>
            <th>
              <span className="player-dot green" />
              {names[1]}
            </th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <div className="quest-name">
                  {(row.points ?? 0) >= 4 ? (
                    <Trophy size={13} />
                  ) : (
                    <Circle size={9} />
                  )}
                  <span>{row.label}</span>
                </div>
              </td>
              <td>{groupLabel(row.group)}</td>
              <QuestStatusCell item={row.left} accent="blue" />
              <QuestStatusCell item={row.right} accent="green" />
              <td>{formatNumber(row.points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuestStatusCell({
  item,
  accent,
}: {
  item: QuestItem | null;
  accent: "blue" | "green";
}) {
  const completed = item?.completed;
  return (
    <td>
      <span
        className={`quests-status ${completed === true ? accent : completed === false ? "muted" : "unknown"}`}
      >
        {completed === true ? (
          <CheckCircle2 size={14} />
        ) : completed === false ? (
          <XCircle size={14} />
        ) : (
          <Circle size={14} />
        )}
        {stateLabel(item?.state)}
      </span>
    </td>
  );
}

function SignalCard({
  title,
  rows,
  names,
}: {
  title: string;
  rows: Array<{
    label: string;
    left: number | undefined;
    right: number | undefined;
  }>;
  names: [string, string];
}) {
  return (
    <section className="quests-side-card">
      <h2>{title}</h2>
      <div className="quests-signal-list">
        {rows.map((row) => (
          <div className="quests-signal-row" key={row.label}>
            <strong>{row.label}</strong>
            <span className="blue">{row.left ?? "—"}</span>
            <span>{names[0]}</span>
            <span className="green">{row.right ?? "—"}</span>
            <span>{names[1]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EdgeCard({
  title,
  rows,
  names,
}: {
  title: string;
  rows: QuestRow[];
  names: [string, string];
}) {
  return (
    <section className="quests-side-card">
      <h2>{title}</h2>
      {rows.length > 0 ? (
        rows.map((row) => {
          const side = isComplete(row.left) ? "left" : "right";
          return (
            <div className="quests-edge-row" key={row.key}>
              <span className={side === "left" ? "blue-dot" : "green-dot"} />
              <div>
                <strong>{row.label}</strong>
                <small>
                  {side === "left" ? names[0] : names[1]} only ·{" "}
                  {formatNumber(row.points)} pts
                </small>
              </div>
            </div>
          );
        })
      ) : (
        <EmptyState>No one-sided completions in the current data.</EmptyState>
      )}
    </section>
  );
}

function BlockersCard({
  rows,
  names,
}: {
  rows: QuestRow[];
  names: [string, string];
}) {
  return (
    <section className="quests-side-card">
      <h2>Requirement blockers</h2>
      {rows.length > 0 ? (
        rows.slice(0, 4).map((row) => {
          const missingName = isComplete(row.left) ? names[1] : names[0];
          return (
            <div className="quests-blocker-row" key={row.key}>
              <AlertTriangle size={14} />
              <span>{row.label}</span>
              <small>{missingName} missing</small>
            </div>
          );
        })
      ) : (
        <EmptyState>No visible blockers from quest completion.</EmptyState>
      )}
    </section>
  );
}

function MissingRow({
  row,
  names,
}: {
  row: QuestRow;
  names: [string, string];
}) {
  const missing = isComplete(row.left) ? names[1] : names[0];
  return (
    <div className="quests-missing-row">
      <AlertTriangle size={15} />
      <strong>{row.label}</strong>
      <span>{groupLabel(row.group)}</span>
      <span>{formatNumber(row.points)} pts</span>
      <em>{missing} missing</em>
    </div>
  );
}

export default QuestsPage;
