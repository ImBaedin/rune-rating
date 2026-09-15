import { api } from "@rune-rating/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { BadgeCheck, Medal, Swords, Target, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  captureAnalytics,
  countBucket,
  hashRsnPair,
  lookupRsnPairHashField,
} from "../analytics";
import {
  ComparisonKpiCard,
  DataNotice,
  EmptyState,
  PageHeader,
  PanelHeader,
  PlayerPairLine,
  SearchField,
  SegmentedControl,
  SelectField,
  SourceChip,
  sideLabel,
  sideTone,
} from "../components/comparison-ui";
import { useComparisonShell } from "../features/comparison/context";
import {
  formatValue as formatNumber,
  formatPercent,
  formatSigned,
} from "../features/comparison/formatters";
import "./CombatAchievementsPage.css";

type CategoryResult = FunctionReturnType<typeof api.runeProfile.getCategory>;
type CombatCategory = NonNullable<CategoryResult>;
type CombatItem = CombatCategory["items"][number];
type CombatSummary = Extract<
  CombatCategory["summary"],
  { type: "combatAchievements" }
>;
type PlayerSide = "left" | "right";
type TierName = "Easy" | "Medium" | "Hard" | "Elite" | "Master" | "Grandmaster";
type TierFilter = "all" | TierName;
type TaskStatusFilter = "gaps" | "incomplete" | "all";
type CompletionGrouping = "tier" | "type";

type TaskPair = {
  key: string;
  label: string;
  tier: TierName;
  tierValue: number;
  type: string;
  group: string;
  leftCompleted: boolean | null;
  rightCompleted: boolean | null;
};
type TypeGapRow = {
  type: string;
  delta: number | null;
  absDelta: number;
  leftOnly: number;
  rightOnly: number;
};
type CompletionRow = {
  key: string;
  label: string;
  color: string;
  total: number;
  leftCompleted: number | null;
  rightCompleted: number | null;
  leftRemaining: number | null;
  rightRemaining: number | null;
  leftPercent: number | null;
  rightPercent: number | null;
  delta: number | null;
};

const combatTiers: TierName[] = [
  "Easy",
  "Medium",
  "Hard",
  "Elite",
  "Master",
  "Grandmaster",
];
const tierValues: Record<TierName, number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
  Elite: 4,
  Master: 5,
  Grandmaster: 6,
};
const tierColors: Record<TierName, string> = {
  Easy: "#8b5e34",
  Medium: "#8b96a4",
  Hard: "#d6a321",
  Elite: "#2f9c9c",
  Master: "#7655c7",
  Grandmaster: "#c03536",
};
const typeColors = [
  "#3976e8",
  "#43a66a",
  "#d29536",
  "#3f9f9b",
  "#b15c45",
  "#6f8398",
  "#8b6bb8",
  "#52717f",
];
const tierByValue = Object.fromEntries(
  combatTiers.map((tier) => [tierValues[tier], tier]),
) as Record<number, TierName>;
const typeColor = (index: number) =>
  typeColors[index % typeColors.length] ?? "#6f8398";

const mutedGroupColor = (color: string) => {
  const hex = color.replace("#", "");
  const value = Number.parseInt(hex, 16);
  if (hex.length !== 6 || Number.isNaN(value)) return color;
  const blend = (channel: number) =>
    Math.round(channel + (255 - channel) * 0.78);
  return `rgb(${blend((value >> 16) & 255)}, ${blend((value >> 8) & 255)}, ${blend(value & 255)})`;
};

const deltaClass = (value: number | null | undefined) =>
  value === null || value === undefined || value === 0
    ? "tie"
    : value > 0
      ? "left"
      : "right";

export default function CombatAchievementsPage() {
  const { names, runeProfile, runeProfileUnavailableMessage } =
    useComparisonShell();
  const leftCategory = useQuery(api.runeProfile.getCategory, {
    rsn: names[0],
    category: "combatAchievements",
  });
  const rightCategory = useQuery(api.runeProfile.getCategory, {
    rsn: names[1],
    category: "combatAchievements",
  });
  const [lookupTierFilter, setLookupTierFilter] = useState<TierFilter>("all");
  const [lookupTypeFilter, setLookupTypeFilter] = useState("all");
  const [lookupStatusFilter, setLookupStatusFilter] =
    useState<TaskStatusFilter>("all");
  const [completionGrouping, setCompletionGrouping] =
    useState<CompletionGrouping>("tier");
  const [search, setSearch] = useState("");
  const [isTaskSearchExpanded, setIsTaskSearchExpanded] = useState(false);

  const model = useMemo(
    () => buildCombatModel(leftCategory, rightCategory),
    [leftCategory, rightCategory],
  );
  const focusedTypeGapRows = model.typeGapRows;
  const completionRows = useMemo(
    () =>
      buildCompletionRows(
        model.taskPairs,
        completionGrouping,
        model.summaryCompletionRows,
      ),
    [completionGrouping, model.summaryCompletionRows, model.taskPairs],
  );
  const isLoading =
    runeProfile === undefined ||
    leftCategory === undefined ||
    rightCategory === undefined;
  const filteredLookupTasks = useMemo(
    () =>
      model.taskPairs.filter((task) => {
        const query = search.trim().toLocaleLowerCase();
        if (lookupTierFilter !== "all" && task.tier !== lookupTierFilter)
          return false;
        if (lookupTypeFilter !== "all" && task.type !== lookupTypeFilter)
          return false;
        if (
          query &&
          !`${task.label} ${task.group} ${task.type} ${task.tier}`
            .toLocaleLowerCase()
            .includes(query)
        ) {
          return false;
        }
        if (lookupStatusFilter === "gaps") {
          return (
            task.leftCompleted !== null &&
            task.rightCompleted !== null &&
            task.leftCompleted !== task.rightCompleted
          );
        }
        if (lookupStatusFilter === "incomplete")
          return task.leftCompleted === false || task.rightCompleted === false;
        return true;
      }),
    [
      lookupStatusFilter,
      lookupTierFilter,
      lookupTypeFilter,
      model.taskPairs,
      search,
    ],
  );
  const hasTaskSearch = search.trim().length > 0;
  const displayedLookupTasks = isTaskSearchExpanded
    ? filteredLookupTasks
    : filteredLookupTasks.slice(0, 6);
  const hiddenLookupTaskCount = Math.max(0, filteredLookupTasks.length - 6);
  const pointLeader =
    model.pointDelta === null
      ? "indeterminate"
      : model.pointDelta > 0
        ? "left"
        : model.pointDelta < 0
          ? "right"
          : "tie";
  const completedDelta =
    model.leftSummary && model.rightSummary
      ? model.leftSummary.completed - model.rightSummary.completed
      : null;
  const completedLeader =
    completedDelta === null
      ? "indeterminate"
      : completedDelta > 0
        ? "left"
        : completedDelta < 0
          ? "right"
          : "tie";
  const tierLeader = tierLeaderFromSummaries(
    model.leftSummary,
    model.rightSummary,
  );
  const swingLeader =
    model.oneSidedDelta === null
      ? "indeterminate"
      : model.oneSidedDelta > 0
        ? "left"
        : model.oneSidedDelta < 0
          ? "right"
          : "tie";

  useEffect(() => {
    if (
      !search.trim() &&
      lookupTierFilter === "all" &&
      lookupTypeFilter === "all" &&
      lookupStatusFilter === "all"
    ) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void hashRsnPair(names).then(([leftRsnHash, rightRsnHash]) => {
        captureAnalytics("rich_search_applied", {
          category: "combatAchievements",
          query_length_bucket: countBucket(search.trim().length),
          result_count_bucket: countBucket(filteredLookupTasks.length),
          filters: `status:${lookupStatusFilter}|tier:${lookupTierFilter}|type:${lookupTypeFilter}`,
          expanded_results: isTaskSearchExpanded,
          left_rsn_hash: leftRsnHash,
          right_rsn_hash: rightRsnHash,
          ...lookupRsnPairHashField(leftRsnHash, rightRsnHash),
        });
      });
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [
    filteredLookupTasks.length,
    isTaskSearchExpanded,
    lookupStatusFilter,
    lookupTierFilter,
    lookupTypeFilter,
    names,
    search,
  ]);

  return (
    <section className="combat-achievements-page" aria-busy={isLoading}>
      <PageHeader
        title="Combat Achievements"
        meta={<SourceChip label="RuneProfile" href="https://runeprofile.com" />}
      />

      {runeProfileUnavailableMessage ? (
        <DataNotice>{runeProfileUnavailableMessage}</DataNotice>
      ) : null}

      <section className="ca-kpi-grid" aria-label="Combat achievement summary">
        <ComparisonKpiCard
          icon={<Medal size={22} />}
          label="Points lead"
          value={formatSigned(model.pointDelta, " pts")}
          detail={`${sideLabel(pointLeader, names)} ahead`}
          tone={sideTone(pointLeader)}
          isLoading={isLoading}
        />
        <ComparisonKpiCard
          icon={<Trophy size={22} />}
          label="Tier reached"
          value={bestTierLabel(model.leftSummary, model.rightSummary)}
          detail={
            <PlayerPairLine
              names={names}
              left={model.leftSummary?.tierReached ?? "Unranked"}
              right={model.rightSummary?.tierReached ?? "Unranked"}
            />
          }
          tone={sideTone(tierLeader)}
          isLoading={isLoading}
        />
        <ComparisonKpiCard
          icon={<BadgeCheck size={22} />}
          label="Completed tasks"
          value={formatSigned(completedDelta, " tasks")}
          detail={
            <PlayerPairLine
              names={names}
              left={`${formatNumber(model.leftSummary?.completed)} / ${formatNumber(model.leftSummary?.total)}`}
              right={`${formatNumber(model.rightSummary?.completed)} / ${formatNumber(model.rightSummary?.total)}`}
            />
          }
          tone={sideTone(completedLeader)}
          isLoading={isLoading}
        />
        <ComparisonKpiCard
          icon={<Target size={22} />}
          label="One-sided swing"
          value={formatSigned(model.oneSidedDelta, " tasks")}
          detail={
            <PlayerPairLine
              names={names}
              left={formatNumber(model.leftOnlyTasks)}
              right={formatNumber(model.rightOnlyTasks)}
              leftLabel="Only completed"
              rightLabel="Only completed"
            />
          }
          tone={sideTone(swingLeader)}
          isLoading={isLoading}
        />
      </section>

      <article className="ca-panel ca-lookup-panel">
        <PanelHeader
          title="Task lookup"
          subtitle="Search a combat achievement task to compare status, tier, type, and boss grouping."
          help={false}
        />
        <div className="ca-lookup-toolbar">
          <SearchField
            value={search}
            placeholder="Search combat tasks..."
            onChange={(value) => {
              setSearch(value);
              setIsTaskSearchExpanded(false);
            }}
          />
          <SegmentedControl
            label="Task status"
            value={lookupStatusFilter}
            options={[
              ["all", "All"],
              ["gaps", "Gaps"],
              ["incomplete", "Incomplete"],
            ]}
            onChange={(value) => {
              setLookupStatusFilter(value);
              setIsTaskSearchExpanded(false);
            }}
          />
          <SelectField
            label="Tier"
            value={lookupTierFilter}
            options={[
              ["all", "All tiers"],
              ...combatTiers.map(
                (tier) => [tier, tier] as [TierFilter, string],
              ),
            ]}
            onChange={(value) => {
              setLookupTierFilter(value);
              setIsTaskSearchExpanded(false);
            }}
          />
          <SelectField
            label="Type"
            value={lookupTypeFilter}
            options={[
              ["all", "All categories"],
              ...model.taskTypes.map(
                (type) => [type, type] as [string, string],
              ),
            ]}
            onChange={(value) => {
              setLookupTypeFilter(value);
              setIsTaskSearchExpanded(false);
            }}
          />
          <span className="ca-lookup-count">
            {hasTaskSearch
              ? `${filteredLookupTasks.length} matches`
              : "Search to compare tasks"}
          </span>
        </div>
        {hasTaskSearch ? (
          <>
            <TaskLookupTable rows={displayedLookupTasks} names={names} />
            {hiddenLookupTaskCount > 0 ? (
              <button
                type="button"
                className="ca-expand-button"
                onClick={() => setIsTaskSearchExpanded((current) => !current)}
              >
                {isTaskSearchExpanded
                  ? "Show fewer"
                  : `Show ${hiddenLookupTaskCount} more`}
              </button>
            ) : null}
          </>
        ) : null}
      </article>

      <section className="ca-main-grid">
        <article className="ca-panel ca-radial-panel">
          <PanelHeader
            title="Completion wheel"
            subtitle="Outer ring is left player, inner ring is right player. Muted segments are still open."
            action={
              <SegmentedControl
                label="Completion grouping"
                value={completionGrouping}
                options={[
                  ["tier", "Tier"],
                  ["type", "Type"],
                ]}
                onChange={setCompletionGrouping}
              />
            }
          />
          <CompletionWheel rows={completionRows} names={names} />
        </article>

        <aside className="ca-side-column">
          <article className="ca-panel">
            <PanelHeader
              title="Point gap by tier"
              subtitle="Compact tier-level swing summary."
              names={names}
            />
            <TierSwingTable tiers={model.tierRows} names={names} compact />
          </article>

          <article className="ca-panel ca-signals-panel">
            <h2>Difference signals</h2>
            <div className="ca-signal-list">
              {model.signals.map((signal) => (
                <SignalRow key={signal.label} signal={signal} />
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="ca-lower-grid">
        <article className="ca-panel">
          <PanelHeader
            title="Highest-value swings"
            subtitle="Tasks completed by exactly one player, sorted by point value."
            names={names}
          />
          <SwingTaskList rows={model.swingTasks.slice(0, 8)} names={names} />
        </article>

        <article className="ca-panel">
          <PanelHeader
            title="Point gap breakdown"
            subtitle="Which task categories create the current point gap."
            names={names}
          />
          <PointGapBreakdown rows={focusedTypeGapRows} names={names} />
        </article>

        <article className="ca-panel">
          <PanelHeader
            title="Shared blockers"
            subtitle="High-tier tasks neither player has completed."
            names={names}
          />
          <SharedBlockerList rows={model.sharedBlockers.slice(0, 8)} />
        </article>
      </section>
    </section>
  );
}

function buildCombatModel(
  left: CategoryResult | undefined,
  right: CategoryResult | undefined,
) {
  const leftSummary = combatSummary(left);
  const rightSummary = combatSummary(right);
  const leftDetailAvailable = (left?.items.length ?? 0) > 0;
  const rightDetailAvailable = (right?.items.length ?? 0) > 0;
  const hasComparableTasks = leftDetailAvailable && rightDetailAvailable;
  const taskPairs = normalizeTaskPairs(
    buildTaskPairs(left?.items ?? [], right?.items ?? []),
    leftDetailAvailable,
    rightDetailAvailable,
  );
  const taskTierRows = combatTiers.map((tier) =>
    summarizeTier(tier, taskPairs, leftDetailAvailable, rightDetailAvailable),
  );
  const summaryTierRows = buildSummaryTierRows(
    leftSummary,
    rightSummary,
    taskTierRows,
  );
  const tierRows = summaryTierRows ?? taskTierRows;
  const summaryCompletionRows = summaryTierRows?.map((tier) =>
    completionRowFromTierSummary(tier),
  );
  const pointDelta =
    leftSummary && rightSummary
      ? leftSummary.points - rightSummary.points
      : null;
  const taskTypes = Array.from(
    new Set(taskPairs.map((task) => task.type).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const typeGapRows = buildTypeGapRows(taskPairs, taskTypes);
  const typeGapRowsByTier = Object.fromEntries(
    combatTiers.map((tier) => [
      tier,
      buildTypeGapRows(
        taskPairs.filter((task) => task.tier === tier),
        taskTypes,
      ),
    ]),
  ) as Record<TierName, TypeGapRow[]>;
  const grandmaster = tierRows.find((tier) => tier.tier === "Grandmaster");
  const masterPlus = tierRows.filter(
    (tier) => tier.tier === "Master" || tier.tier === "Grandmaster",
  );
  const swingTasks = taskPairs
    .map((task) => ({ ...task, pointDelta: taskPointDelta(task) }))
    .filter((task) => task.pointDelta !== null && task.pointDelta !== 0)
    .sort(
      (a, b) =>
        b.tierValue - a.tierValue ||
        Math.abs(b.pointDelta ?? 0) - Math.abs(a.pointDelta ?? 0) ||
        a.label.localeCompare(b.label),
    );
  const sharedBlockers = taskPairs
    .filter(
      (task) => task.leftCompleted === false && task.rightCompleted === false,
    )
    .sort(
      (a, b) =>
        b.tierValue - a.tierValue ||
        a.type.localeCompare(b.type) ||
        a.label.localeCompare(b.label),
    );
  const leftOnlyTasks = hasComparableTasks
    ? taskPairs.filter(
        (task) => task.leftCompleted === true && task.rightCompleted === false,
      ).length
    : null;
  const rightOnlyTasks = hasComparableTasks
    ? taskPairs.filter(
        (task) => task.rightCompleted === true && task.leftCompleted === false,
      ).length
    : null;
  const leftPercent = percent(
    leftSummary?.completed ?? null,
    leftSummary?.total ?? null,
  );
  const rightPercent = percent(
    rightSummary?.completed ?? null,
    rightSummary?.total ?? null,
  );

  return {
    leftSummary,
    rightSummary,
    taskPairs,
    taskTypes,
    tierRows,
    summaryCompletionRows,
    typeGapRows,
    typeGapRowsByTier,
    swingTasks,
    sharedBlockers,
    leftOnlyTasks,
    rightOnlyTasks,
    oneSidedDelta:
      leftOnlyTasks === null || rightOnlyTasks === null
        ? null
        : leftOnlyTasks - rightOnlyTasks,
    pointDelta,
    signals: [
      {
        label: "Grandmaster points",
        detail: "Highest tier point gap",
        delta:
          grandmaster?.leftPoints === null ||
          grandmaster?.leftPoints === undefined ||
          grandmaster?.rightPoints === null ||
          grandmaster?.rightPoints === undefined
            ? null
            : grandmaster.leftPoints - grandmaster.rightPoints,
        suffix: " pts",
      },
      {
        label: "Master+ points",
        detail: "Late-tier point swing",
        delta: masterPlus.some((tier) => tier.pointDelta === null)
          ? null
          : masterPlus.reduce((sum, tier) => sum + (tier.pointDelta ?? 0), 0),
        suffix: " pts",
      },
      {
        label: "Biggest type gap",
        detail: typeGapRows[0]?.type ?? "No type gap",
        delta: typeGapRows[0]?.delta ?? null,
        suffix: " pts",
      },
      {
        label: "Total completion",
        detail: "Overall task completion gap",
        delta:
          leftPercent === null || rightPercent === null
            ? null
            : leftPercent - rightPercent,
        suffix: "%",
        percent: true,
      },
    ],
  };
}

function combatSummary(category: CategoryResult | undefined) {
  return category?.summary.type === "combatAchievements"
    ? category.summary
    : null;
}

function combatTierSummary(summary: CombatSummary | null, tier: TierName) {
  return summary?.tiers?.find((entry) => entry.name === tier) ?? null;
}

function buildSummaryTierRows(
  left: CombatSummary | null,
  right: CombatSummary | null,
  fallbackRows: ReturnType<typeof summarizeTier>[],
) {
  const hasTierSummaries = Boolean(left?.tiers?.length || right?.tiers?.length);
  if (!hasTierSummaries) return null;

  return combatTiers.map((tier, index) => {
    const leftTier = combatTierSummary(left, tier);
    const rightTier = combatTierSummary(right, tier);
    const fallback = fallbackRows[index];
    const tierValue = tierValues[tier];
    const totalTasks = Math.max(
      leftTier?.total ?? 0,
      rightTier?.total ?? 0,
      fallback?.totalTasks ?? 0,
    );
    const totalPoints = totalTasks * tierValue;
    const leftCompleted = leftTier
      ? leftTier.completed
      : (fallback?.leftCompleted ?? null);
    const rightCompleted = rightTier
      ? rightTier.completed
      : (fallback?.rightCompleted ?? null);
    const leftPoints = leftTier
      ? leftTier.completed * tierValue
      : (fallback?.leftPoints ?? null);
    const rightPoints = rightTier
      ? rightTier.completed * tierValue
      : (fallback?.rightPoints ?? null);
    const hasOnlyTaskDetail = !leftTier && !rightTier;

    return {
      tier,
      tierValue,
      totalTasks,
      totalPoints,
      leftOnlyTasks: hasOnlyTaskDetail
        ? (fallback?.leftOnlyTasks ?? null)
        : null,
      rightOnlyTasks: hasOnlyTaskDetail
        ? (fallback?.rightOnlyTasks ?? null)
        : null,
      leftCompleted,
      rightCompleted,
      leftRemaining:
        leftCompleted === null ? null : Math.max(0, totalTasks - leftCompleted),
      rightRemaining:
        rightCompleted === null
          ? null
          : Math.max(0, totalTasks - rightCompleted),
      leftPoints,
      rightPoints,
      pointDelta:
        leftPoints === null || rightPoints === null
          ? null
          : leftPoints - rightPoints,
      leftPercent: percent(leftCompleted, totalTasks),
      rightPercent: percent(rightCompleted, totalTasks),
    };
  });
}

function completionRowFromTierSummary(
  tier: NonNullable<ReturnType<typeof buildSummaryTierRows>>[number],
): CompletionRow {
  return {
    key: tier.tier,
    label: tier.tier,
    color: tierColors[tier.tier],
    total: tier.totalTasks,
    leftCompleted: tier.leftCompleted,
    rightCompleted: tier.rightCompleted,
    leftRemaining: tier.leftRemaining,
    rightRemaining: tier.rightRemaining,
    leftPercent: tier.leftPercent,
    rightPercent: tier.rightPercent,
    delta:
      tier.leftCompleted === null || tier.rightCompleted === null
        ? null
        : tier.leftCompleted - tier.rightCompleted,
  };
}

function taskPointDelta(task: TaskPair) {
  if (task.leftCompleted === null || task.rightCompleted === null) return null;
  return (
    (task.leftCompleted ? task.tierValue : 0) -
    (task.rightCompleted ? task.tierValue : 0)
  );
}

function sumKnownDeltas(tasks: TaskPair[]) {
  let total = 0;
  let hasKnownTask = false;
  for (const task of tasks) {
    const delta = taskPointDelta(task);
    if (delta === null) continue;
    hasKnownTask = true;
    total += delta;
  }
  return hasKnownTask ? total : null;
}

function buildTypeGapRows(
  tasks: TaskPair[],
  taskTypes: string[],
): TypeGapRow[] {
  return taskTypes
    .map((type) => {
      const typeTasks = tasks.filter((task) => task.type === type);
      const delta = sumKnownDeltas(typeTasks);
      const leftOnly = typeTasks.filter(
        (task) => task.leftCompleted === true && task.rightCompleted === false,
      ).length;
      const rightOnly = typeTasks.filter(
        (task) => task.rightCompleted === true && task.leftCompleted === false,
      ).length;
      return {
        type,
        delta,
        leftOnly,
        rightOnly,
        absDelta: delta === null ? 0 : Math.abs(delta),
      };
    })
    .filter((row) => row.delta !== null && row.delta !== 0)
    .sort((a, b) => b.absDelta - a.absDelta || a.type.localeCompare(b.type));
}

function buildCompletionRows(
  tasks: TaskPair[],
  grouping: CompletionGrouping,
  summaryRows: CompletionRow[] | undefined,
): CompletionRow[] {
  if (summaryRows && (grouping === "tier" || tasks.length === 0)) {
    return summaryRows.filter((row) => row.total > 0);
  }

  if (grouping === "tier") {
    return combatTiers
      .map((tier) =>
        buildCompletionRow({
          key: tier,
          label: tier,
          color: tierColors[tier],
          tasks: tasks.filter((task) => task.tier === tier),
        }),
      )
      .filter((row) => row.total > 0);
  }

  return Array.from(new Set(tasks.map((task) => task.type || "Other")))
    .sort((a, b) => a.localeCompare(b))
    .map((type, index) =>
      buildCompletionRow({
        key: type,
        label: type,
        color: typeColor(index),
        tasks: tasks.filter((task) => task.type === type),
      }),
    )
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

function buildCompletionRow({
  key,
  label,
  color,
  tasks,
}: {
  key: string;
  label: string;
  color: string;
  tasks: TaskPair[];
}): CompletionRow {
  const total = tasks.length;
  const leftKnown = tasks.some((task) => task.leftCompleted !== null);
  const rightKnown = tasks.some((task) => task.rightCompleted !== null);
  const leftCompleted = leftKnown
    ? tasks.filter((task) => task.leftCompleted === true).length
    : null;
  const rightCompleted = rightKnown
    ? tasks.filter((task) => task.rightCompleted === true).length
    : null;
  return {
    key,
    label,
    color,
    total,
    leftCompleted,
    rightCompleted,
    leftRemaining:
      leftCompleted === null ? null : Math.max(0, total - leftCompleted),
    rightRemaining:
      rightCompleted === null ? null : Math.max(0, total - rightCompleted),
    leftPercent: percent(leftCompleted, total),
    rightPercent: percent(rightCompleted, total),
    delta:
      leftCompleted === null || rightCompleted === null
        ? null
        : leftCompleted - rightCompleted,
  };
}

function buildTaskPairs(leftItems: CombatItem[], rightItems: CombatItem[]) {
  const pairs = new Map<string, TaskPair>();
  const add = (side: PlayerSide, item: CombatItem) => {
    const existing = pairs.get(item.key);
    const base =
      existing ??
      ({
        key: item.key,
        label: item.label,
        tier: tierFromItem(item),
        tierValue: item.points ?? tierValues.Easy,
        type: item.state ?? "Other",
        group: item.group || "Unlisted",
        leftCompleted: null,
        rightCompleted: null,
      } satisfies TaskPair);
    pairs.set(item.key, {
      ...base,
      label: base.label || item.label,
      group: base.group || item.group,
      type: base.type || item.state || "Other",
      [side === "left" ? "leftCompleted" : "rightCompleted"]: item.completed,
    });
  };
  leftItems.forEach((item) => {
    add("left", item);
  });
  rightItems.forEach((item) => {
    add("right", item);
  });
  return Array.from(pairs.values()).sort((a, b) => {
    const tierDelta = combatTiers.indexOf(b.tier) - combatTiers.indexOf(a.tier);
    return (
      tierDelta ||
      a.type.localeCompare(b.type) ||
      a.label.localeCompare(b.label)
    );
  });
}

function normalizeTaskPairs(
  pairs: TaskPair[],
  leftAvailable: boolean,
  rightAvailable: boolean,
) {
  return pairs.map((pair) => ({
    ...pair,
    leftCompleted: leftAvailable ? pair.leftCompleted === true : null,
    rightCompleted: rightAvailable ? pair.rightCompleted === true : null,
  }));
}

function tierFromItem(item: CombatItem): TierName {
  const matchedTier = item.points ? tierByValue[item.points] : undefined;
  if (matchedTier) return matchedTier;
  const labelMatch = combatTiers.find((tier) => item.label.includes(tier));
  return labelMatch ?? "Easy";
}

function summarizeTier(
  tier: TierName,
  taskPairs: TaskPair[],
  leftAvailable: boolean,
  rightAvailable: boolean,
) {
  const tasks = taskPairs.filter((task) => task.tier === tier);
  const tierValue = tierValues[tier];
  const totalTasks = tasks.length;
  const totalPoints = totalTasks * tierValue;
  const leftCompleted = leftAvailable
    ? tasks.filter((task) => task.leftCompleted === true).length
    : null;
  const rightCompleted = rightAvailable
    ? tasks.filter((task) => task.rightCompleted === true).length
    : null;
  const leftPoints = leftCompleted === null ? null : leftCompleted * tierValue;
  const rightPoints =
    rightCompleted === null ? null : rightCompleted * tierValue;
  return {
    tier,
    tierValue,
    totalTasks,
    totalPoints,
    leftOnlyTasks:
      leftAvailable && rightAvailable
        ? tasks.filter(
            (task) =>
              task.leftCompleted === true && task.rightCompleted === false,
          ).length
        : null,
    rightOnlyTasks:
      leftAvailable && rightAvailable
        ? tasks.filter(
            (task) =>
              task.rightCompleted === true && task.leftCompleted === false,
          ).length
        : null,
    leftCompleted,
    rightCompleted,
    leftRemaining:
      leftCompleted === null ? null : Math.max(0, totalTasks - leftCompleted),
    rightRemaining:
      rightCompleted === null ? null : Math.max(0, totalTasks - rightCompleted),
    leftPoints,
    rightPoints,
    pointDelta:
      leftPoints === null || rightPoints === null
        ? null
        : leftPoints - rightPoints,
    leftPercent: percent(leftCompleted, totalTasks),
    rightPercent: percent(rightCompleted, totalTasks),
  };
}

function percent(value: number | null, total: number | null) {
  if (value === null || total === null || total === 0) return null;
  return (value / total) * 100;
}

function tierLeaderFromSummaries(
  left: CombatSummary | null,
  right: CombatSummary | null,
) {
  const leftRank = tierRank(left?.tierReached);
  const rightRank = tierRank(right?.tierReached);
  if (leftRank === null || rightRank === null) return "indeterminate";
  if (leftRank > rightRank) return "left";
  if (rightRank > leftRank) return "right";
  return "tie";
}

function tierRank(tier: string | null | undefined) {
  if (!tier) return null;
  const index = combatTiers.indexOf(tier as TierName);
  return index === -1 ? null : index;
}

function bestTierLabel(
  left: CombatSummary | null,
  right: CombatSummary | null,
) {
  const leftRank = tierRank(left?.tierReached);
  const rightRank = tierRank(right?.tierReached);
  if (leftRank === null && rightRank === null) return "Unranked";
  return combatTiers[Math.max(leftRank ?? 0, rightRank ?? 0)] ?? "Unranked";
}

function TierSwingTable({
  tiers,
  names,
  compact = false,
}: {
  tiers: ReturnType<typeof summarizeTier>[];
  names: [string, string];
  compact?: boolean;
}) {
  if (tiers.every((tier) => tier.totalTasks === 0)) {
    return (
      <EmptyState>Combat achievement snapshots are still loading.</EmptyState>
    );
  }

  return (
    <div className="ca-table-wrap">
      <table className={`ca-tier-table ${compact ? "compact" : ""}`.trim()}>
        <thead>
          <tr>
            <th>Tier</th>
            <th>Point swing</th>
            {compact ? null : (
              <>
                <th>Only {names[0]}</th>
                <th>Only {names[1]}</th>
              </>
            )}
            <th>Leader</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => (
            <tr key={tier.tier}>
              <td>
                <span className="ca-tier-name">
                  <i style={{ background: tierColors[tier.tier] }} />
                  <strong>{tier.tier}</strong>
                </span>
              </td>
              <td>
                <b className={deltaClass(tier.pointDelta)}>
                  {formatSigned(tier.pointDelta, " pts")}
                </b>
              </td>
              {compact ? null : (
                <>
                  <td>
                    <b className="ca-left">
                      {formatNumber(tier.leftOnlyTasks)}
                    </b>
                  </td>
                  <td>
                    <b className="ca-right">
                      {formatNumber(tier.rightOnlyTasks)}
                    </b>
                  </td>
                </>
              )}
              <td>
                <span
                  className={`ca-leader-label ${deltaClass(tier.pointDelta)}`}
                >
                  {tier.pointDelta === null
                    ? "Unavailable"
                    : tier.pointDelta > 0
                      ? names[0]
                      : tier.pointDelta < 0
                        ? names[1]
                        : "Tie"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompletionWheel({
  rows,
  names,
}: {
  rows: CompletionRow[];
  names: [string, string];
}) {
  if (rows.length === 0)
    return (
      <EmptyState>No combat achievement tasks for this filter.</EmptyState>
    );
  const leftSlices = rows
    .flatMap((row) => [
      {
        ...row,
        key: `${row.key}-left-completed`,
        value: row.leftCompleted ?? 0,
        isRemaining: false,
      },
      {
        ...row,
        key: `${row.key}-left-remaining`,
        value: row.leftRemaining ?? 0,
        isRemaining: true,
      },
    ])
    .filter((row) => row.value > 0);
  const rightSlices = rows
    .flatMap((row) => [
      {
        ...row,
        key: `${row.key}-right-completed`,
        value: row.rightCompleted ?? 0,
        isRemaining: false,
      },
      {
        ...row,
        key: `${row.key}-right-remaining`,
        value: row.rightRemaining ?? 0,
        isRemaining: true,
      },
    ])
    .filter((row) => row.value > 0);
  const leftTotal = sumNullable(rows.map((row) => row.leftCompleted));
  const rightTotal = sumNullable(rows.map((row) => row.rightCompleted));
  const taskTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const leftPercent = percent(leftTotal, taskTotal);
  const rightPercent = percent(rightTotal, taskTotal);

  if (leftSlices.length === 0 && rightSlices.length === 0) {
    return (
      <EmptyState>
        Completion wheel unavailable until at least one player has RuneProfile
        combat achievement data.
      </EmptyState>
    );
  }

  return (
    <div className="ca-wheel-layout">
      <div className="ca-wheel">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={leftSlices}
              dataKey="value"
              nameKey="label"
              innerRadius="68%"
              outerRadius="86%"
              paddingAngle={0.5}
              stroke="#fff"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {leftSlices.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={
                    entry.isRemaining
                      ? mutedGroupColor(entry.color)
                      : entry.color
                  }
                  opacity={entry.isRemaining ? 1 : 0.94}
                />
              ))}
            </Pie>
            <Pie
              data={rightSlices}
              dataKey="value"
              nameKey="label"
              innerRadius="44%"
              outerRadius="62%"
              paddingAngle={0.5}
              stroke="#fff"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {rightSlices.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={
                    entry.isRemaining
                      ? mutedGroupColor(entry.color)
                      : entry.color
                  }
                  opacity={entry.isRemaining ? 1 : 0.94}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0]?.payload as
                  | (typeof leftSlices)[number]
                  | (typeof rightSlices)[number];
                if (!entry) return null;
                return (
                  <div className="ca-wheel-tooltip">
                    <strong>{entry.label}</strong>
                    <span>
                      {entry.isRemaining ? "Uncompleted" : "Completed"}{" "}
                      {formatNumber(entry.value)} / {formatNumber(entry.total)}
                    </span>
                    <small>
                      {names[0]} {formatPercent(entry.leftPercent)} · {names[1]}{" "}
                      {formatPercent(entry.rightPercent)}
                    </small>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="ca-wheel-center" aria-hidden="true">
          <span>Outer</span>
          <strong>{names[0]}</strong>
          <span>Inner</span>
          <strong>{names[1]}</strong>
        </div>
      </div>
      <div className="ca-wheel-list">
        <PlayerCompletionTotal
          side="left"
          name={names[0]}
          completed={leftTotal}
          total={leftTotal === null ? null : taskTotal}
          percent={leftPercent}
        />
        <PlayerCompletionTotal
          side="right"
          name={names[1]}
          completed={rightTotal}
          total={rightTotal === null ? null : taskTotal}
          percent={rightPercent}
        />
        {rows.map((row) => (
          <CompletionWheelRow key={row.key} row={row} names={names} />
        ))}
      </div>
    </div>
  );
}

function sumNullable(values: Array<number | null>) {
  let total = 0;
  let hasValue = false;
  for (const value of values) {
    if (value === null) continue;
    hasValue = true;
    total += value;
  }
  return hasValue ? total : null;
}

function PlayerCompletionTotal({
  side,
  name,
  completed,
  total,
  percent,
}: {
  side: PlayerSide;
  name: string;
  completed: number | null;
  total: number | null;
  percent: number | null;
}) {
  return (
    <div className="ca-wheel-total">
      <span>
        <i className={side === "left" ? "blue" : "green"} />
        {name}
      </span>
      <b>
        {formatNumber(completed)} / {formatNumber(total)}
        <small>{formatPercent(percent)}</small>
      </b>
    </div>
  );
}

function CompletionWheelRow({
  row,
  names,
}: {
  row: CompletionRow;
  names: [string, string];
}) {
  return (
    <div className="ca-wheel-row ca-completion-row">
      <i style={{ background: row.color }} />
      <span>
        <strong>{row.label}</strong>
        <small>{formatNumber(row.total)} tasks</small>
      </span>
      <div className="ca-wheel-bars">
        <CompletionBar
          side="left"
          name={names[0]}
          completed={row.leftCompleted}
          total={row.total}
          percent={row.leftPercent}
        />
        <CompletionBar
          side="right"
          name={names[1]}
          completed={row.rightCompleted}
          total={row.total}
          percent={row.rightPercent}
        />
      </div>
      <b className={deltaClass(row.delta)}>
        {formatSigned(row.delta, " tasks")}
      </b>
    </div>
  );
}

function CompletionBar({
  side,
  name,
  completed,
  total,
  percent: completionPercent,
}: {
  side: PlayerSide;
  name: string;
  completed: number | null;
  total: number;
  percent: number | null;
}) {
  return (
    <div className="ca-wheel-bar">
      <span>
        <i className={side === "left" ? "blue" : "green"} />
        {name}
      </span>
      <div>
        <i
          className={side === "left" ? "blue" : "green"}
          style={{
            width: `${Math.max(0, Math.min(100, completionPercent ?? 0))}%`,
          }}
        />
      </div>
      <b>
        {formatNumber(completed)} /{" "}
        {formatNumber(completed === null ? null : total)}
      </b>
    </div>
  );
}

function PointGapBreakdown({
  rows,
  names,
}: {
  rows: TypeGapRow[];
  names: [string, string];
}) {
  if (rows.length === 0)
    return <EmptyState>No point gap by type for this tier filter.</EmptyState>;
  const max = Math.max(...rows.map((row) => row.absDelta), 1);
  return (
    <div className="ca-gap-breakdown">
      {rows.slice(0, 7).map((row) => (
        <div className="ca-gap-row" key={row.type}>
          <span>
            <strong>{row.type}</strong>
            <small>
              {formatNumber(row.leftOnly)} {names[0]} only /{" "}
              {formatNumber(row.rightOnly)} {names[1]} only
            </small>
          </span>
          <div>
            <i
              className={deltaClass(row.delta)}
              style={{ width: `${(row.absDelta / max) * 100}%` }}
            />
          </div>
          <b className={deltaClass(row.delta)}>
            {formatSigned(row.delta, " pts")}
          </b>
        </div>
      ))}
    </div>
  );
}

function SwingTaskList({
  rows,
  names,
}: {
  rows: Array<TaskPair & { pointDelta: number | null }>;
  names: [string, string];
}) {
  if (rows.length === 0)
    return <EmptyState>No one-sided combat task completions.</EmptyState>;
  return (
    <div className="ca-compact-list">
      {rows.map((row) => {
        const leader = (row.pointDelta ?? 0) > 0 ? "left" : "right";
        return (
          <div className="ca-compact-row" key={row.key}>
            <span className="ca-tier-pill">
              <i style={{ background: tierColors[row.tier] }} />
              {row.tier}
            </span>
            <strong>{row.label}</strong>
            <small>
              {row.type} · {row.group}
            </small>
            <b className={deltaClass(row.pointDelta)}>
              {leader === "left" ? names[0] : names[1]}{" "}
              {formatSigned(Math.abs(row.pointDelta ?? 0), " pts")}
            </b>
          </div>
        );
      })}
    </div>
  );
}

function SharedBlockerList({ rows }: { rows: TaskPair[] }) {
  if (rows.length === 0)
    return <EmptyState>No shared incomplete combat tasks.</EmptyState>;
  return (
    <div className="ca-compact-list">
      {rows.map((row) => (
        <div className="ca-compact-row" key={row.key}>
          <span className="ca-tier-pill">
            <i style={{ background: tierColors[row.tier] }} />
            {row.tier}
          </span>
          <strong>{row.label}</strong>
          <small>
            {row.type} · {row.group}
          </small>
          <b className="ca-muted">{formatNumber(row.tierValue)} pts</b>
        </div>
      ))}
    </div>
  );
}

function SignalRow({
  signal,
}: {
  signal: {
    label: string;
    detail: string;
    delta: number | null;
    suffix: string;
    percent?: boolean;
  };
}) {
  const tone =
    signal.delta === null || signal.delta === 0
      ? "tie"
      : signal.delta > 0
        ? "left"
        : "right";
  return (
    <div className="ca-signal-row">
      <span>
        <Swords size={15} />
      </span>
      <strong>{signal.label}</strong>
      <small>{signal.detail}</small>
      <b className={tone}>
        {signal.delta === null
          ? "—"
          : signal.percent
            ? formatSigned(Number(signal.delta.toFixed(1)), signal.suffix)
            : formatSigned(signal.delta, signal.suffix)}
      </b>
    </div>
  );
}

function TaskLookupTable({
  rows,
  names,
}: {
  rows: TaskPair[];
  names: [string, string];
}) {
  if (rows.length === 0)
    return <EmptyState>No matching combat tasks.</EmptyState>;
  return (
    <div className="ca-table-wrap">
      <table className="ca-task-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Tier</th>
            <th>Type</th>
            <th>Swing</th>
            <th>{names[0]}</th>
            <th>{names[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <strong>{row.label}</strong>
                <small>{row.group}</small>
              </td>
              <td>
                <span className="ca-tier-pill">
                  <i style={{ background: tierColors[row.tier] }} />
                  {row.tier}
                </span>
              </td>
              <td>{row.type}</td>
              <td>{formatSigned(taskPointDelta(row), " pts")}</td>
              <td>
                <StatusPill completed={row.leftCompleted} />
              </td>
              <td>
                <StatusPill completed={row.rightCompleted} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ completed }: { completed: boolean | null }) {
  return (
    <span
      className={`ca-status-pill ${
        completed === true
          ? "complete"
          : completed === false
            ? "incomplete"
            : ""
      }`.trim()}
    >
      {completed === true
        ? "Complete"
        : completed === false
          ? "Incomplete"
          : "Unknown"}
    </span>
  );
}
