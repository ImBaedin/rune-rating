import { api } from "@rune-rating/backend/convex/_generated/api";
import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Boxes,
  CheckCircle2,
  Layers3,
  PackageSearch,
  Target,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { captureAnalytics, countBucket, hashRsnPair } from "../analytics";
import {
  ComparisonKpiCard,
  DataNotice,
  EmptyState,
  PageHeader,
  PanelHeader,
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
import "./CollectionsPage.css";

type CollectionComparison = FunctionReturnType<
  typeof api.runeProfile.getCollectionComparison
>;
type CollectionItemsComparison = FunctionReturnType<
  typeof api.runeProfile.getCollectionItemsComparison
>;
type CollectionTab = CollectionComparison["tabs"][number];
type CollectionPage = CollectionTab["pages"][number] & { tab: string };
type CollectionItem = CollectionItemsComparison["items"][number];
type StatusFilter = "all" | "different" | "one-sided" | "left" | "right";

const itemPreviewLimit = 5;
const tabColors = [
  "#3976e8",
  "#43a66a",
  "#d29536",
  "#6f8398",
  "#b15c45",
  "#3f9f9b",
  "#8b6bb8",
  "#52717f",
];
const tabColor = (index: number) =>
  tabColors[index % tabColors.length] ?? "#6f8398";

const mutedTabColor = (color: string) => {
  const hex = color.replace("#", "");
  const value = Number.parseInt(hex, 16);
  if (hex.length !== 6 || Number.isNaN(value)) return color;
  const blend = (channel: number) =>
    Math.round(channel + (255 - channel) * 0.78);
  return `rgb(${blend((value >> 16) & 255)}, ${blend((value >> 8) & 255)}, ${blend(value & 255)})`;
};

const ownedLabel = (owned: boolean | null) =>
  owned === null ? "Unavailable" : owned ? "Owned" : "Missing";

const formatQueueWait = (targetAt: number | null, now: number) => {
  if (targetAt === null) return "soon";
  const seconds = Math.max(0, Math.ceil((targetAt - now) / 1_000));
  if (seconds < 60) return `~${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `~${minutes}m`;
};

const wikiItemIconUrl = (label: string) =>
  `https://oldschool.runescape.wiki/w/Special:Redirect/file/${encodeURIComponent(
    `${label.trim()}.png`,
  )}`;

const jagexItemIconUrl = (itemId: number) =>
  `https://secure.runescape.com/m=itemdb_oldschool/obj_sprite.gif?id=${itemId}`;

function CollectionsPage() {
  const {
    names,
    runeProfile,
    runeProfileUnavailableMessage,
    leftProfile,
    rightProfile,
  } = useComparisonShell();
  const comparison = useQuery(api.runeProfile.getCollectionComparison, {
    leftRsn: names[0],
    rightRsn: names[1],
  });
  const detailQueueStatuses = useQuery(
    api.providerQueue.getCollectionDetailStatuses,
    { rsns: names },
  );
  const refreshCollectionLog = useAction(api.runeProfile.refreshCollectionLog);
  const requestedDetails = useRef(new Set<string>());
  const [detailError, setDetailError] = useState<string | null>(null);
  const [queueNow, setQueueNow] = useState(() => Date.now());
  const [tabFilter, setTabFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [isItemSearchExpanded, setIsItemSearchExpanded] = useState(false);
  const itemLookupLimit = isItemSearchExpanded ? 2500 : itemPreviewLimit;
  const itemLookup = useQuery(api.runeProfile.getCollectionItemsComparison, {
    leftRsn: names[0],
    rightRsn: names[1],
    tab: tabFilter,
    status: statusFilter,
    search,
    limit: itemLookupLimit,
  });

  const hasDetailedData =
    comparison?.leftDetailAvailable === true &&
    comparison?.rightDetailAvailable === true;
  const requestKey = `${names[0].toLocaleLowerCase()}|${names[1].toLocaleLowerCase()}`;

  useEffect(() => {
    if (comparison === undefined || hasDetailedData) return;
    if (requestedDetails.current.has(requestKey)) return;
    requestedDetails.current.add(requestKey);
    setDetailError(null);
    void refreshCollectionLog({ rsns: names })
      .then((results) => {
        const failures = results.filter(
          (result) =>
            !["fresh", "queued", "running", "retrying"].includes(result.status),
        );
        setDetailError(
          failures.length === 0
            ? null
            : `Detailed collection log unavailable for ${failures
                .map((failure) => failure.rsn)
                .join(", ")}.`,
        );
      })
      .catch((error) => {
        setDetailError(
          error instanceof Error
            ? error.message
            : "Detailed collection log refresh failed.",
        );
      });
  }, [comparison, hasDetailedData, names, refreshCollectionLog, requestKey]);

  const hasActiveDetailQueue = detailQueueStatuses?.some((status) =>
    ["queued", "retrying"].includes(status.status),
  );

  useEffect(() => {
    if (!hasActiveDetailQueue) return;
    const interval = window.setInterval(() => setQueueNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [hasActiveDetailQueue]);

  const detailQueueNotice = useMemo(() => {
    if (hasDetailedData) return null;
    const active = detailQueueStatuses?.find((status) =>
      ["queued", "running", "retrying", "failed"].includes(status.status),
    );
    if (!active) return null;
    if (active.status === "running") {
      return "Refreshing detailed collection log data...";
    }
    if (active.status === "retrying") {
      return `RuneProfile collection detail retrying in ${formatQueueWait(
        active.retryAt,
        queueNow,
      )}.`;
    }
    if (active.status === "failed") {
      return `Detailed collection log refresh failed${
        active.lastErrorCode ? `: ${active.lastErrorCode}` : ""
      }.`;
    }
    return `Detailed collection log queued${
      active.position ? ` #${active.position}` : ""
    } - starts in ${formatQueueWait(active.estimatedRunAt, queueNow)}.`;
  }, [detailQueueStatuses, hasDetailedData, queueNow]);

  const detailNotice = detailError ?? detailQueueNotice;
  const detailNoticeTone = detailError
    ? "warning"
    : detailQueueNotice?.includes("failed")
      ? "warning"
      : "info";

  const isLoading =
    runeProfile === undefined ||
    comparison === undefined ||
    itemLookup === undefined;
  const sourceStatus = [leftProfile, rightProfile].some(
    (profile) => profile?.collectionState?.status === "fresh",
  )
    ? "ok"
    : "warn";
  const summary = useMemo(
    () => buildSummary(comparison, names),
    [comparison, names],
  );
  const pages = useMemo(() => {
    return (comparison?.tabs ?? [])
      .flatMap((tab) => tab.pages.map((item) => ({ ...item, tab: tab.name })))
      .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));
  }, [comparison]);
  const categories = useMemo(
    () => ["all", ...(comparison?.tabs.map((tab) => tab.name) ?? [])],
    [comparison],
  );
  const hasItemSearch = search.trim().length > 0;
  const hasItemLookup =
    hasItemSearch || tabFilter !== "all" || statusFilter !== "all";
  const displayedItems = itemLookup?.items ?? [];
  const hiddenItemCount = Math.max(
    0,
    (itemLookup?.matchCount ?? 0) - displayedItems.length,
  );

  useEffect(() => {
    if (!search.trim() && tabFilter === "all" && statusFilter === "all") return;
    const timeout = window.setTimeout(() => {
      void hashRsnPair(names).then(([leftRsnHash, rightRsnHash]) => {
        captureAnalytics("rich_search_applied", {
          category: "collection",
          query_length_bucket: countBucket(search.trim().length),
          result_count_bucket: countBucket(itemLookup?.matchCount ?? 0),
          filters: `status:${statusFilter}|tab:${tabFilter}`,
          expanded_results: isItemSearchExpanded,
          left_rsn_hash: leftRsnHash,
          right_rsn_hash: rightRsnHash,
        });
      });
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [
    itemLookup?.matchCount,
    isItemSearchExpanded,
    names,
    search,
    statusFilter,
    tabFilter,
  ]);

  return (
    <section className="collections-page" aria-busy={isLoading}>
      <PageHeader
        title="Collection Log"
        meta={
          <SourceChip
            label="RuneProfile"
            status={sourceStatus}
            href="https://runeprofile.com"
          />
        }
      />

      {runeProfileUnavailableMessage ? (
        <DataNotice>{runeProfileUnavailableMessage}</DataNotice>
      ) : null}
      {detailNotice ? (
        <DataNotice tone={detailNoticeTone}>{detailNotice}</DataNotice>
      ) : null}

      <section className="collections-kpis" aria-label="Collection log summary">
        <ComparisonKpiCard
          icon={<Boxes size={22} />}
          label="Unique item lead"
          value={formatSigned(summary.itemGap)}
          detail={`${sideLabel(summary.itemLeader, names)} ahead`}
          tone={sideTone(summary.itemLeader)}
          isLoading={isLoading}
        />
        <ComparisonKpiCard
          icon={<Layers3 size={22} />}
          label="Categories led"
          value={`${summary.leftTabsLed}-${summary.rightTabsLed}`}
          detail={`${summary.tiedTabs} tied categories`}
          tone={sideTone(summary.tabLeader)}
          isLoading={isLoading}
        />
        <ComparisonKpiCard
          icon={<Target size={22} />}
          label="Page gaps"
          value={`${summary.oneSidedPages}`}
          detail="pages led by exactly one player"
          tone="amber"
          isLoading={isLoading}
        />
        <ComparisonKpiCard
          icon={<Trophy size={22} />}
          label="Lookup matches"
          value={`${itemLookup?.matchCount ?? 0}`}
          detail={
            hasItemLookup
              ? "items matching the active filters"
              : "use item lookup filters to compare ownership"
          }
          tone="amber"
          isLoading={isLoading}
        />
      </section>

      <article className="collections-panel collections-item-panel">
        <PanelHeader
          title="Item lookup"
          subtitle="Search a collection-log item to compare ownership, quantity, and every page it appears on."
          help={false}
        />
        <div className="collections-item-toolbar">
          <SearchField
            value={search}
            placeholder="Search items..."
            onChange={(value) => {
              setSearch(value);
              setIsItemSearchExpanded(false);
            }}
          />
          <SegmentedControl
            label="Item status"
            value={statusFilter}
            options={[
              ["all", "All"],
              ["different", "Different"],
              ["one-sided", "One-sided"],
            ]}
            onChange={(value) => {
              setStatusFilter(value);
              setIsItemSearchExpanded(false);
            }}
          />
          <SelectField
            label="Category"
            value={tabFilter}
            options={categories.map((category) => [
              category,
              category === "all" ? "All categories" : category,
            ])}
            onChange={(value) => {
              setTabFilter(value);
              setIsItemSearchExpanded(false);
            }}
          />
          <span className="collections-count">
            {hasItemLookup
              ? `${itemLookup?.matchCount ?? 0} matches`
              : "Search to compare items"}
          </span>
        </div>
        {hasItemLookup ? (
          <>
            <CollectionItemTable
              rows={displayedItems}
              names={names}
              isLoading={isLoading}
            />
            {hiddenItemCount > 0 ? (
              <button
                type="button"
                className="collections-expand-button"
                onClick={() => setIsItemSearchExpanded((current) => !current)}
              >
                {isItemSearchExpanded
                  ? "Show fewer"
                  : `Show ${hiddenItemCount} more`}
              </button>
            ) : null}
          </>
        ) : null}
      </article>

      <section className="collections-main-grid">
        <article className="collections-panel collections-wheel-panel">
          <PanelHeader
            title="Category completion wheel"
            subtitle="Outer ring is left player, inner ring is right player."
            names={names}
          />
          <div className="collections-wheel-layout">
            <CategoryWheel tabs={comparison?.tabs ?? []} names={names} />
            <div className="collections-tab-list">
              {(comparison?.tabs ?? []).map((tab, index) => (
                <TabSignal
                  key={tab.name}
                  tab={tab}
                  color={tabColor(index)}
                  names={names}
                />
              ))}
            </div>
          </div>
        </article>

        <aside className="collections-side-column">
          <article className="collections-panel collections-rate-panel">
            <PanelHeader
              title="Completion rate"
              subtitle="Current detailed snapshot"
              help={false}
            />
            <div className="collections-rate-list">
              <CompletionMeter
                name={names[0]}
                value={comparison?.left?.percent ?? null}
                accent="blue"
                obtained={comparison?.left?.obtained}
                total={comparison?.left?.total}
              />
              <CompletionMeter
                name={names[1]}
                value={comparison?.right?.percent ?? null}
                accent="green"
                obtained={comparison?.right?.obtained}
                total={comparison?.right?.total}
              />
            </div>
          </article>

          <article className="collections-panel collections-pressure-panel">
            <PanelHeader
              title="High-value misses"
              subtitle="Largest category and page gaps"
              help={false}
            />
            <div className="collections-pressure-list">
              {pages.slice(0, 6).map((row) => (
                <PagePressureRow
                  row={row}
                  names={names}
                  key={`${row.tab}:${row.name}`}
                />
              ))}
            </div>
          </article>
        </aside>
      </section>

      <article className="collections-panel collections-page-gap-panel">
        <PanelHeader
          title="Page gap breakdown"
          subtitle="Largest page-level unique item differences."
          names={names}
        />
        <div className="collections-page-chart">
          {pages.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pages.slice(0, 12).map((row) => ({
                  name: row.name,
                  tab: row.tab,
                  left: row.left?.obtained ?? 0,
                  right: row.right?.obtained ?? 0,
                }))}
                layout="vertical"
                margin={{ top: 10, right: 32, bottom: 10, left: 16 }}
                barSize={13}
                barGap={6}
                barCategoryGap={10}
              >
                <CartesianGrid horizontal={false} stroke="#e7ebef" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#74808d", fontSize: 12, fontWeight: 700 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#4d5964", fontSize: 11, fontWeight: 800 }}
                  width={132}
                />
                <Tooltip
                  formatter={(value, key) => [
                    formatNumber(Number(value)),
                    key === "left" ? names[0] : names[1],
                  ]}
                  labelFormatter={(label) => String(label)}
                  cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
                />
                <Bar dataKey="left" fill="var(--blue)" radius={[0, 3, 3, 0]} />
                <Bar
                  dataKey="right"
                  fill="var(--green)"
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>Detailed page data is still loading.</EmptyState>
          )}
        </div>
      </article>
    </section>
  );
}

function buildSummary(
  comparison: CollectionComparison | undefined,
  names: [string, string],
) {
  const itemGap =
    comparison?.left && comparison.right
      ? comparison.left.obtained - comparison.right.obtained
      : null;
  const leftTabsLed =
    comparison?.tabs.filter((tab) => tab.leader === "left").length ?? 0;
  const rightTabsLed =
    comparison?.tabs.filter((tab) => tab.leader === "right").length ?? 0;
  const tiedTabs =
    comparison?.tabs.filter((tab) => tab.leader === "tie").length ?? 0;
  const pages = comparison?.tabs.flatMap((tab) => tab.pages) ?? [];
  const oneSidedPages = pages.filter(
    (page) => page.leader === "left" || page.leader === "right",
  ).length;

  return {
    itemGap,
    itemLeader:
      itemGap === null
        ? "indeterminate"
        : itemGap > 0
          ? "left"
          : itemGap < 0
            ? "right"
            : "tie",
    leftTabsLed,
    rightTabsLed,
    tiedTabs,
    tabLeader:
      leftTabsLed > rightTabsLed
        ? "left"
        : rightTabsLed > leftTabsLed
          ? "right"
          : "tie",
    oneSidedPages,
    names,
  } as const;
}

function CategoryWheel({
  tabs,
  names,
}: {
  tabs: CollectionTab[];
  names: [string, string];
}) {
  if (tabs.length === 0) {
    return <EmptyState>Detailed category data is still loading.</EmptyState>;
  }
  const data = tabs.map((tab, index) => {
    const total = Math.max(tab.left?.total ?? 0, tab.right?.total ?? 0, 1);
    const leftObtained = Math.max(0, Math.min(tab.left?.obtained ?? 0, total));
    const rightObtained = Math.max(
      0,
      Math.min(tab.right?.obtained ?? 0, total),
    );

    const color = tabColor(index);

    return {
      name: tab.name,
      total,
      color,
      remainingColor: mutedTabColor(color),
      leftObtained,
      rightObtained,
      leftRemaining: Math.max(total - leftObtained, 0),
      rightRemaining: Math.max(total - rightObtained, 0),
      leftPercent: tab.left?.percent ?? 0,
      rightPercent: tab.right?.percent ?? 0,
    };
  });
  const leftSlices = data
    .flatMap((entry) => [
      {
        ...entry,
        key: `${entry.name}-left-obtained`,
        value: entry.leftObtained,
        isRemaining: false,
      },
      {
        ...entry,
        key: `${entry.name}-left-remaining`,
        value: entry.leftRemaining,
        isRemaining: true,
      },
    ])
    .filter((entry) => entry.value > 0);
  const rightSlices = data
    .flatMap((entry) => [
      {
        ...entry,
        key: `${entry.name}-right-obtained`,
        value: entry.rightObtained,
        isRemaining: false,
      },
      {
        ...entry,
        key: `${entry.name}-right-remaining`,
        value: entry.rightRemaining,
        isRemaining: true,
      },
    ])
    .filter((entry) => entry.value > 0);

  return (
    <div className="collections-wheel">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={leftSlices}
            dataKey="value"
            nameKey="name"
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
                fill={entry.isRemaining ? entry.remainingColor : entry.color}
                opacity={entry.isRemaining ? 1 : 0.92}
              />
            ))}
          </Pie>
          <Pie
            data={rightSlices}
            dataKey="value"
            nameKey="name"
            innerRadius="46%"
            outerRadius="63%"
            paddingAngle={0.5}
            stroke="#fff"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {rightSlices.map((entry) => (
              <Cell
                key={entry.key}
                fill={entry.isRemaining ? entry.remainingColor : entry.color}
                opacity={entry.isRemaining ? 1 : 0.92}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const entry = payload[0]?.payload as
                | (typeof leftSlices)[number]
                | (typeof rightSlices)[number];
              return (
                <div className="collections-tooltip">
                  <strong>{entry.name}</strong>
                  <span>
                    <i className="blue" />
                    {names[0]}
                    <b>{formatPercent(entry.leftPercent)}</b>
                  </span>
                  <small>
                    {formatNumber(entry.leftObtained)} /{" "}
                    {formatNumber(entry.total)}
                  </small>
                  <span>
                    <i className="green" />
                    {names[1]}
                    <b>{formatPercent(entry.rightPercent)}</b>
                  </span>
                  <small>
                    {formatNumber(entry.rightObtained)} /{" "}
                    {formatNumber(entry.total)}
                  </small>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="collections-wheel-center" aria-hidden="true">
        <span>Outer</span>
        <strong>{names[0]}</strong>
        <span>Inner</span>
        <strong>{names[1]}</strong>
      </div>
    </div>
  );
}

function TabSignal({
  tab,
  color,
  names,
}: {
  tab: CollectionTab;
  color: string;
  names: [string, string];
}) {
  const leftPercent = tab.left?.percent ?? null;
  const rightPercent = tab.right?.percent ?? null;
  const leftWidth = Math.max(0, Math.min(100, leftPercent ?? 0));
  const rightWidth = Math.max(0, Math.min(100, rightPercent ?? 0));

  return (
    <div className="collections-tab-signal">
      <i style={{ background: color }} />
      <div className="collections-tab-heading">
        <strong>{tab.name}</strong>
        <b className={tab.leader === "right" ? "green" : "blue"}>
          {formatSigned(tab.delta)}
        </b>
      </div>
      <div className="collections-tab-bars">
        <div className="collections-tab-bar">
          <span>
            <em className="blue" />
            {names[0]}
          </span>
          <div>
            <i className="blue" style={{ width: `${leftWidth}%` }} />
          </div>
          <b className="blue">{formatPercent(leftPercent)}</b>
        </div>
        <div className="collections-tab-bar">
          <span>
            <em className="green" />
            {names[1]}
          </span>
          <div>
            <i className="green" style={{ width: `${rightWidth}%` }} />
          </div>
          <b className="green">{formatPercent(rightPercent)}</b>
        </div>
      </div>
    </div>
  );
}

function CompletionMeter({
  name,
  value,
  obtained,
  total,
  accent,
}: {
  name: string;
  value: number | null;
  obtained: number | null | undefined;
  total: number | null | undefined;
  accent: "blue" | "green";
}) {
  const width = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="collections-meter">
      <div className="collections-meter-track" aria-hidden="true">
        <span className={accent} style={{ width: `${width}%` }} />
      </div>
      <div className="collections-meter-copy">
        <strong>
          <i className={accent} />
          {name}
        </strong>
        <span>{formatPercent(value)}</span>
        <small>
          {formatNumber(obtained)} / {formatNumber(total)}
        </small>
      </div>
    </div>
  );
}

function PagePressureRow({
  row,
  names,
}: {
  row: CollectionPage;
  names: [string, string];
}) {
  return (
    <div className="collections-page-pressure">
      <strong>{row.name}</strong>
      <small>{row.tab}</small>
      <b className={row.leader === "right" ? "green" : "blue"}>
        {formatSigned(row.delta)}
      </b>
      <span>{sideLabel(row.leader, names, "No lead")}</span>
    </div>
  );
}

function CollectionItemTable({
  rows,
  names,
  isLoading,
}: {
  rows: CollectionItem[];
  names: [string, string];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <EmptyState>Loading collection item comparison...</EmptyState>;
  }
  if (rows.length === 0) {
    return <EmptyState>No collection items match these filters.</EmptyState>;
  }

  return (
    <div className="collections-table-wrap">
      <table className="collections-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Page</th>
            <th>
              <span className="player-dot blue" />
              {names[0]}
            </th>
            <th>
              <span className="player-dot green" />
              {names[1]}
            </th>
            <th>Gap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <div className="collections-item-name">
                  <CollectionItemIcon item={row} />
                  <span>{row.label}</span>
                  <small>{row.tab}</small>
                </div>
              </td>
              <td>
                <PageList pages={row.pages} />
              </td>
              <ItemStatusCell
                owned={row.leftOwned}
                quantity={row.leftQuantity}
              />
              <ItemStatusCell
                owned={row.rightOwned}
                quantity={row.rightQuantity}
              />
              <td>
                <span
                  className={`collections-gap ${row.leader === "right" ? "green" : row.leader === "left" ? "blue" : ""}`}
                >
                  {formatSigned(row.quantityDelta)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CollectionItemIcon({ item }: { item: CollectionItem }) {
  const [iconSource, setIconSource] = useState<"wiki" | "jagex" | "fallback">(
    "wiki",
  );
  const isOwned = item.leftOwned === true || item.rightOwned === true;

  if (iconSource === "fallback") {
    return (
      <span className="collections-item-icon fallback">
        {isOwned ? <CheckCircle2 size={13} /> : <PackageSearch size={13} />}
      </span>
    );
  }

  const src =
    iconSource === "jagex" && item.itemId !== null
      ? jagexItemIconUrl(item.itemId)
      : wikiItemIconUrl(item.label);

  return (
    <span className="collections-item-icon">
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          setIconSource((current) =>
            current === "wiki" && item.itemId !== null ? "jagex" : "fallback",
          );
        }}
      />
    </span>
  );
}

function PageList({ pages }: { pages: string[] }) {
  if (pages.length === 0) return <span>Unknown</span>;
  return (
    <div className="collections-page-list">
      {pages.map((page) => (
        <span key={page}>{page}</span>
      ))}
    </div>
  );
}

function ItemStatusCell({
  owned,
  quantity,
}: {
  owned: boolean | null;
  quantity: number | null;
}) {
  return (
    <td>
      <span className={`collections-owned ${owned ? "owned" : "missing"}`}>
        {ownedLabel(owned)}
        <small>{quantity === null ? "—" : `x${formatNumber(quantity)}`}</small>
      </span>
    </td>
  );
}

export default CollectionsPage;
