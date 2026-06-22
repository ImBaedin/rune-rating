import { api } from "@rune-rating/backend/convex/_generated/api";
import { normalizeRsn } from "@rune-rating/domain";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bolt,
  BookOpen,
  Boxes,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Database,
  Gauge,
  History,
  Info,
  LayoutDashboard,
  ListChecks,
  Medal,
  Menu,
  Mountain,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  createContext,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ageBucket,
  captureAnalytics,
  capturePageView,
  hashRsnPair,
} from "./analytics";
import {
  ComparisonKpiCard,
  SourceChip as HeaderSourceChip,
  PageHeader,
  PlayerPairLine,
  type PlayerSide,
  SegmentedControl,
} from "./components/comparison-ui";
import { HeatmapRow, heatmapValues } from "./components/XpActivityHeatmap";
import { type Player, players } from "./mockData";
import {
  agilityIcon,
  attackIcon,
  constructionIcon,
  cookingIcon,
  craftingIcon,
  defenceIcon,
  farmingIcon,
  firemakingIcon,
  fishingIcon,
  fletchingIcon,
  herbloreIcon,
  hitpointsIcon,
  hunterIcon,
  magicIcon,
  miningIcon,
  prayerIcon,
  rangedIcon,
  runecraftIcon,
  sailingWorldIcon,
  skillsIcon,
  slayerIcon,
  smithingIcon,
  strengthIcon,
  thievingIcon,
  toDataUrl,
  woodcuttingIcon,
} from "./osrsIcons";
import XpTimelinePage from "./XpTimelinePage";

const fmt = new Intl.NumberFormat("en-US");
type SkillsComparison = FunctionReturnType<typeof api.comparisons.getSkills>;
type EfficiencyComparison = FunctionReturnType<
  typeof api.comparisons.getEfficiency
>;
type PlayerProfile = FunctionReturnType<typeof api.players.getProfile>;
type RuneProfileDashboard = FunctionReturnType<
  typeof api.runeProfile.getDashboard
>;
type OverviewHistory = FunctionReturnType<
  typeof api.wiseOldMan.getOverviewHistory
>;
type SkillGains = FunctionReturnType<typeof api.wiseOldMan.getSkillGains>;
type SkillTimeline = FunctionReturnType<typeof api.wiseOldMan.getSkillTimeline>;
type EfficiencyTimelines = FunctionReturnType<
  typeof api.wiseOldMan.getEfficiencyTimelines
>;
type ActivityDashboard = FunctionReturnType<typeof api.xpTimeline.getDashboard>;
type TimelineComparison = {
  left: { timeline: OverviewHistory["left"]["timeline"] };
  right: { timeline: OverviewHistory["right"]["timeline"] };
};
type HistoryPeriod = "week" | "month" | "quarter" | "year";
export type AppView =
  | "overview"
  | "skills"
  | "timeline"
  | "efficiency"
  | "activity"
  | "quests"
  | "achievement-diaries"
  | "combat-achievements"
  | "bossing"
  | "clues"
  | "minigames"
  | "collections";
type ComparisonShellContextValue = {
  names: [string, string];
  comparison: SkillsComparison | undefined;
  efficiency: EfficiencyComparison | undefined;
  leftProfile: PlayerProfile | undefined;
  rightProfile: PlayerProfile | undefined;
  runeProfile: RuneProfileDashboard | undefined;
  runeProfileUnavailableMessage: string | null;
  overviewHistory: OverviewHistory | null;
  overviewHistoryError: string | null;
  isOverviewHistoryLoading: boolean;
  historyPeriod: HistoryPeriod;
  setHistoryPeriod: (period: HistoryPeriod) => void;
};
const activeRefreshStatuses = new Set(["scheduled", "refreshing"]);
const lookupHistoryKey = "rune-rating:player-lookups";
const maxLookupHistory = 12;
export const defaultRsns: [string, string] = ["Lynx Titan", "Hey Jase"];
const skillIconUrls: Record<string, string> = toDataUrl({
  Attack: attackIcon,
  Strength: strengthIcon,
  Defence: defenceIcon,
  Hitpoints: hitpointsIcon,
  Ranged: rangedIcon,
  Prayer: prayerIcon,
  Magic: magicIcon,
  Cooking: cookingIcon,
  Woodcutting: woodcuttingIcon,
  Fletching: fletchingIcon,
  Fishing: fishingIcon,
  Firemaking: firemakingIcon,
  Crafting: craftingIcon,
  Smithing: smithingIcon,
  Mining: miningIcon,
  Herblore: herbloreIcon,
  Agility: agilityIcon,
  Thieving: thievingIcon,
  Slayer: slayerIcon,
  Farming: farmingIcon,
  Runecraft: runecraftIcon,
  Hunter: hunterIcon,
  Construction: constructionIcon,
  Sailing: sailingWorldIcon,
});
const skillsIconUrl = toDataUrl(skillsIcon);

const readLookupHistory = () => {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(lookupHistoryKey) ?? "[]",
    );
    return Array.isArray(stored)
      ? stored.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
};

const addToLookupHistory = (history: string[], rsns: string[]) => {
  const next = [...history];
  for (const rsn of [...rsns].reverse()) {
    const existing = next.findIndex(
      (value) => value.toLocaleLowerCase() === rsn.toLocaleLowerCase(),
    );
    if (existing !== -1) next.splice(existing, 1);
    next.unshift(rsn);
  }
  return next.slice(0, maxLookupHistory);
};

const profileSourceStatusSummary = (
  profile: PlayerProfile | null | undefined,
) =>
  [
    `skills:${profile?.skillsState?.status ?? "unknown"}`,
    `activities:${profile?.activitiesState?.status ?? "unknown"}`,
    `efficiency:${profile?.efficiencyState?.status ?? "unknown"}`,
    `quests:${profile?.questsState?.status ?? "unknown"}`,
    `diaries:${profile?.diariesState?.status ?? "unknown"}`,
    `combat:${profile?.combatAchievementsState?.status ?? "unknown"}`,
    `collection:${profile?.collectionState?.status ?? "unknown"}`,
  ].join("|");

const comparisonAgeBucket = (
  comparison: SkillsComparison | null | undefined,
) =>
  comparison
    ? ageBucket(Math.min(comparison.left.fetchedAt, comparison.right.fetchedAt))
    : comparison === null
      ? "missing"
      : "loading";

const profileRefreshStates = (profile: PlayerProfile | undefined) => [
  profile?.skillsState,
  profile?.activitiesState,
  profile?.efficiencyState,
  profile?.questsState,
  profile?.diariesState,
  profile?.combatAchievementsState,
  profile?.collectionState,
];

const hasActiveRefresh = (profile: PlayerProfile | undefined) =>
  profileRefreshStates(profile).some((state) =>
    activeRefreshStatuses.has(state?.status ?? ""),
  );

const snapshotRefreshKey = (
  rsn: string,
  profile: PlayerProfile | undefined,
  now: number,
) => {
  if (
    !profile ||
    profile.lastSnapshotAt === null ||
    profile.snapshotStaleAt === null ||
    profile.snapshotStaleAt > now ||
    profile.refreshAllowedAt > now ||
    hasActiveRefresh(profile)
  ) {
    return null;
  }

  return `${rsn.trim().toLocaleLowerCase()}:${profile.lastSnapshotAt}`;
};

const formatValue = (value: number | null) =>
  value === null ? "—" : fmt.format(value);
const formatDelta = (value: number | null) =>
  value === null
    ? "—"
    : `${value > 0 ? "+" : ""}${fmt.format(Object.is(value, -0) ? 0 : value)}`;
const formatCompact = (value: number | null) => {
  if (value === null) return "—";
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 1_000_000_000)
    return `${sign}${(absolute / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000)
    return `${sign}${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}${Math.round(absolute / 1_000)}K`;
  return `${value}`;
};
const formatCompactDelta = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${formatCompact(value)}`;
const formatAge = (timestamp: number) => {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  return minutes < 1 ? "just now" : `${minutes}m ago`;
};
const periodLabels: Record<HistoryPeriod, string> = {
  week: "7d",
  month: "30d",
  quarter: "90d",
  year: "1y",
};
const questPercentage = (value: number, total: number | undefined) =>
  `${total ? (value / total) * 100 : 0}%`;

const navGroups: { label?: string; items: [string, LucideIcon][] }[] = [
  {
    items: [
      ["Overview", LayoutDashboard],
      ["Skills", BarChart3],
      ["XP Timeline", Activity],
      ["EHP / Efficiency", Gauge],
      ["Activity", Zap],
    ],
  },
  {
    items: [
      ["Quests", BookOpen],
      ["Achievement Diaries", ListChecks],
      ["Combat Achievements", ShieldCheck],
      ["Bossing", Swords],
      ["Clues", Search],
      ["Minigames", Target],
      ["Collections", Boxes],
    ],
  },
];
const navViewByLabel: Record<string, AppView> = {
  Overview: "overview",
  Skills: "skills",
  "XP Timeline": "timeline",
  "EHP / Efficiency": "efficiency",
  Activity: "activity",
  Quests: "quests",
  "Achievement Diaries": "achievement-diaries",
  "Combat Achievements": "combat-achievements",
  Bossing: "bossing",
  Clues: "clues",
  Minigames: "minigames",
  Collections: "collections",
};
const pageTitles: Record<AppView, string> = {
  overview: "Overview",
  skills: "Skills",
  timeline: "XP Timeline",
  efficiency: "EHP / Efficiency",
  activity: "Activity",
  quests: "Quests",
  "achievement-diaries": "Achievement Diaries",
  "combat-achievements": "Combat Achievements",
  bossing: "Bossing",
  clues: "Clues",
  minigames: "Minigames",
  collections: "Collections",
};
const routeViewBySegment: Record<string, AppView> = {
  skills: "skills",
  "xp-timeline": "timeline",
  efficiency: "efficiency",
  activity: "activity",
  quests: "quests",
  "achievement-diaries": "achievement-diaries",
  "combat-achievements": "combat-achievements",
  bossing: "bossing",
  clues: "clues",
  minigames: "minigames",
  collections: "collections",
};
const ComparisonShellContext =
  createContext<ComparisonShellContextValue | null>(null);

const highlights: [LucideIcon, string, string, string][] = [
  [
    Activity,
    "More active recently",
    "Recent Wise Old Man snapshots show the stronger XP trend.",
    "blue",
  ],
  [
    Gauge,
    "More efficient",
    "Efficiency is based on current Wise Old Man EHP and EHB.",
    "green",
  ],
  [
    BookOpen,
    "Ahead in questing",
    "RuneProfile quest points decide this comparison.",
    "blue",
  ],
  [
    Swords,
    "Stronger combat profile",
    "Combat level comes from Wise Old Man.",
    "blue",
  ],
];

export function comparisonPath(view: AppView, rsns: [string, string]) {
  const base = `/compare/${encodeURIComponent(rsns[0])}/${encodeURIComponent(rsns[1])}`;
  if (view === "overview") return base;
  if (view === "timeline") return `${base}/xp-timeline`;
  if (view === "efficiency") return `${base}/efficiency`;
  return `${base}/${view}`;
}

function viewFromPathname(pathname: string): AppView {
  const segment = pathname.split("/").filter(Boolean).at(-1);
  return segment ? (routeViewBySegment[segment] ?? "overview") : "overview";
}

export function useComparisonShell() {
  const context = useContext(ComparisonShellContext);
  if (context === null) {
    throw new Error("useComparisonShell must be used inside ComparisonShell.");
  }
  return context;
}

export function ComparisonShell({
  routeRsns,
  children,
}: {
  routeRsns: [string, string];
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const activeView = viewFromPathname(pathname);
  const rsns = routeRsns;
  const leftTheme = playerAvatar(rsns[0], "blue");
  const rightTheme = playerAvatar(rsns[1], "green");
  const playerThemeStyle = {
    "--blue": leftTheme.primary,
    "--blue-soft": leftTheme.soft,
    "--green": rightTheme.primary,
    "--green-soft": rightTheme.soft,
    "--player-left": leftTheme.primary,
    "--player-left-soft": leftTheme.soft,
    "--player-right": rightTheme.primary,
    "--player-right-soft": rightTheme.soft,
  } as React.CSSProperties;
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [draftRsns, setDraftRsns] = useState<[string, string]>(rsns);
  const [lookupHistory, setLookupHistory] =
    useState<string[]>(readLookupHistory);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const autoRefreshKeys = useRef(new Set<string>());
  const [staleCheckNow, setStaleCheckNow] = useState(() => Date.now());
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>("month");
  const [historyResult, setHistoryResult] = useState<{
    data: OverviewHistory | null;
    error: string | null;
    isLoading: boolean;
  }>({ data: null, error: null, isLoading: true });
  const history = historyResult.data;
  const historyError = historyResult.error;
  const comparison = useQuery(api.comparisons.getSkills, {
    leftRsn: rsns[0],
    rightRsn: rsns[1],
  });
  const efficiency = useQuery(api.comparisons.getEfficiency, {
    leftRsn: rsns[0],
    rightRsn: rsns[1],
  });
  const leftProfile = useQuery(api.players.getProfile, { rsn: rsns[0] });
  const rightProfile = useQuery(api.players.getProfile, { rsn: rsns[1] });
  const runeProfile = useQuery(api.runeProfile.getDashboard, {
    leftRsn: rsns[0],
    rightRsn: rsns[1],
  });
  const requestRefresh = useMutation(api.refresh.request);
  const getOverviewHistory = useAction(api.wiseOldMan.getOverviewHistory);
  const isRefreshing = [leftProfile, rightProfile].some((profile) =>
    hasActiveRefresh(profile),
  );
  const womStatus = [leftProfile, rightProfile].every(
    (profile) => profile?.efficiencyState?.status === "fresh",
  )
    ? "live"
    : [leftProfile, rightProfile].every(
          (profile) => profile?.efficiencyState?.status === "notConnected",
        )
      ? "off"
      : "delayed";
  const runeProfileStatus = [leftProfile, rightProfile].every(
    (profile) => profile?.questsState?.status === "fresh",
  )
    ? "live"
    : [leftProfile, rightProfile].every(
          (profile) => profile?.questsState?.status === "notConnected",
        )
      ? "off"
      : "delayed";
  const runeProfileUnavailable =
    runeProfile === undefined
      ? null
      : [
          runeProfile.left === null ? rsns[0] : null,
          runeProfile.right === null ? rsns[1] : null,
        ].filter((rsn): rsn is string => rsn !== null);
  const runeProfileUnavailableMessage =
    runeProfileUnavailable && runeProfileUnavailable.length > 0
      ? runeProfileUnavailable.length === 2
        ? `${runeProfileUnavailable[0]} and ${runeProfileUnavailable[1]} do not have RuneProfile data available.`
        : `${runeProfileUnavailable[0]} does not have RuneProfile data available.`
      : null;
  const shellContext = useMemo<ComparisonShellContextValue>(
    () => ({
      names: rsns,
      comparison,
      efficiency,
      leftProfile,
      rightProfile,
      runeProfile,
      runeProfileUnavailableMessage,
      overviewHistory: history,
      overviewHistoryError: historyError,
      isOverviewHistoryLoading: historyResult.isLoading,
      historyPeriod,
      setHistoryPeriod,
    }),
    [
      comparison,
      efficiency,
      history,
      historyError,
      historyPeriod,
      historyResult.isLoading,
      leftProfile,
      rightProfile,
      rsns,
      runeProfile,
      runeProfileUnavailableMessage,
    ],
  );

  useEffect(() => {
    setDraftRsns(rsns);
  }, [rsns[0], rsns[1]]);

  useEffect(() => {
    let ignored = false;
    void hashRsnPair(rsns).then(([leftRsnHash, rightRsnHash]) => {
      if (ignored) return;
      capturePageView({
        page: "comparison",
        view: activeView,
        left_rsn_hash: leftRsnHash,
        right_rsn_hash: rightRsnHash,
      });
    });
    return () => {
      ignored = true;
    };
  }, [activeView, rsns[0], rsns[1]]);

  useEffect(() => {
    const profiles = [leftProfile, rightProfile];
    if (profiles.some((profile) => profile === undefined)) return;

    const nextCheckAt = profiles.reduce<number | null>((earliest, profile) => {
      if (
        !profile ||
        profile.snapshotStaleAt === null ||
        hasActiveRefresh(profile)
      ) {
        return earliest;
      }
      const eligibleAt = Math.max(
        profile.snapshotStaleAt,
        profile.refreshAllowedAt,
      );
      if (eligibleAt <= staleCheckNow) return earliest;
      return earliest === null ? eligibleAt : Math.min(earliest, eligibleAt);
    }, null);

    if (nextCheckAt === null) return;
    const timeout = window.setTimeout(
      () => setStaleCheckNow(Date.now()),
      Math.max(0, nextCheckAt - staleCheckNow),
    );
    return () => window.clearTimeout(timeout);
  }, [leftProfile, rightProfile, staleCheckNow]);

  useEffect(() => {
    if (leftProfile === undefined || rightProfile === undefined) return;

    const profileEntries = [
      { rsn: rsns[0], profile: leftProfile },
      { rsn: rsns[1], profile: rightProfile },
    ];
    const staleEntries = profileEntries
      .map((entry) => ({
        ...entry,
        key: snapshotRefreshKey(entry.rsn, entry.profile, staleCheckNow),
      }))
      .filter(
        (entry): entry is (typeof profileEntries)[number] & { key: string } =>
          entry.key !== null,
      );
    if (staleEntries.length === 0) return;

    const requestKey = staleEntries
      .map((entry) => entry.key)
      .sort()
      .join("|");
    if (autoRefreshKeys.current.has(requestKey)) return;

    autoRefreshKeys.current.add(requestKey);
    setRefreshError(null);
    void requestRefresh({ rsns: staleEntries.map((entry) => entry.rsn) }).catch(
      (error) => {
        setRefreshError(
          error instanceof Error ? error.message : "Refresh failed",
        );
      },
    );
  }, [leftProfile, requestRefresh, rightProfile, rsns, staleCheckNow]);

  useEffect(() => {
    if (activeView !== "overview") {
      setHistoryResult({ data: null, error: null, isLoading: false });
      return;
    }
    let ignored = false;
    setHistoryResult({ data: null, error: null, isLoading: true });
    void getOverviewHistory({
      leftRsn: rsns[0],
      rightRsn: rsns[1],
      period: historyPeriod,
    })
      .then((result) => {
        if (!ignored)
          setHistoryResult({ data: result, error: null, isLoading: false });
      })
      .catch((error) => {
        if (!ignored) {
          setHistoryResult({
            data: null,
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : "WOM history unavailable",
          });
        }
      });
    return () => {
      ignored = true;
    };
  }, [activeView, getOverviewHistory, historyPeriod, rsns]);

  const refresh = async (nextRsns = rsns) => {
    setRefreshError(null);
    try {
      await requestRefresh({ rsns: nextRsns });
    } catch (error) {
      setRefreshError(
        error instanceof Error ? error.message : "Refresh failed",
      );
    }
  };

  const handleManualRefresh = () => {
    void hashRsnPair(rsns).then(([leftRsnHash, rightRsnHash]) => {
      captureAnalytics("manual_refresh_clicked", {
        page: "comparison",
        view: activeView,
        left_rsn_hash: leftRsnHash,
        right_rsn_hash: rightRsnHash,
        left_source_statuses: profileSourceStatusSummary(leftProfile),
        right_source_statuses: profileSourceStatusSummary(rightProfile),
        data_age_bucket: comparisonAgeBucket(comparison),
      });
    });
    void refresh();
  };

  const handleCompare = (event: FormEvent) => {
    event.preventDefault();
    let next: [string, string];
    try {
      next = draftRsns.map((rsn) => normalizeRsn(rsn)) as [string, string];
    } catch (error) {
      setRefreshError(
        error instanceof Error
          ? error.message
          : "Enter valid RuneScape names before comparing.",
      );
      return;
    }
    const usedRecentLookup = next.some((rsn) =>
      lookupHistory.some(
        (value) => value.toLocaleLowerCase() === rsn.toLocaleLowerCase(),
      ),
    );
    void hashRsnPair(next).then(([leftRsnHash, rightRsnHash]) => {
      captureAnalytics("comparison_submitted", {
        entry_view: activeView,
        left_rsn_hash: leftRsnHash,
        right_rsn_hash: rightRsnHash,
        used_recent_lookup: usedRecentLookup,
      });
    });
    setLookupHistory((history) => {
      const updated = addToLookupHistory(history, next);
      window.localStorage.setItem(lookupHistoryKey, JSON.stringify(updated));
      return updated;
    });
    void navigate({
      to: comparisonPath(activeView, next),
    });
    void refresh(next);
  };

  return (
    <div className="app-shell" style={playerThemeStyle}>
      <Sidebar
        isOpen={isNavigationOpen}
        onClose={() => setIsNavigationOpen(false)}
        activeView={activeView}
        skillCount={
          comparison?.skills.filter((skill) => skill.key !== "skill.overall")
            .length ?? null
        }
        getPath={(view) => comparisonPath(view, rsns)}
        onNavigate={() => setIsNavigationOpen(false)}
      />
      {isNavigationOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setIsNavigationOpen(false)}
        />
      )}
      <main
        className="workspace"
        aria-hidden={isNavigationOpen ? true : undefined}
        inert={isNavigationOpen ? true : undefined}
      >
        <Topbar
          onOpenNavigation={() => setIsNavigationOpen(true)}
          rsns={draftRsns}
          lookupHistory={lookupHistory}
          onRsnChange={(index, value) =>
            setDraftRsns(
              (current) =>
                current.map((rsn, itemIndex) =>
                  itemIndex === index ? value : rsn,
                ) as [string, string],
            )
          }
          onCompare={handleCompare}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
          comparison={comparison}
          womStatus={womStatus}
          runeProfileStatus={runeProfileStatus}
        />
        <div
          className={`content ${activeView === "skills" ? "skills-content" : ""} ${activeView === "timeline" ? "xp-content" : ""} ${activeView === "efficiency" ? "efficiency-content" : ""}`}
        >
          {refreshError ? (
            <div className="data-banner error">{refreshError}</div>
          ) : null}
          {comparison === null ? (
            <div className="data-banner">
              Fetching current Hiscores snapshots for <strong>{rsns[0]}</strong>{" "}
              and <strong>{rsns[1]}</strong>. This updates automatically when
              both are ready.
            </div>
          ) : null}
          <ComparisonShellContext.Provider value={shellContext}>
            {children}
          </ComparisonShellContext.Provider>
        </div>
        <footer>
          <span>All times in your local timezone</span>
        </footer>
      </main>
    </div>
  );
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

export function SkillsRoutePage() {
  const { comparison, names } = useComparisonShell();
  return <SkillsPage comparison={comparison} names={names} />;
}

export function XpTimelineRoutePage() {
  const { comparison, names } = useComparisonShell();
  return (
    <XpTimelinePage
      names={names}
      skills={
        comparison?.skills.filter((skill) => skill.key !== "skill.overall") ??
        []
      }
      currentXp={{
        left:
          comparison?.skills.find((skill) => skill.key === "skill.overall")?.xp
            .left ?? null,
        right:
          comparison?.skills.find((skill) => skill.key === "skill.overall")?.xp
            .right ?? null,
      }}
    />
  );
}

export function EfficiencyRoutePage() {
  const { efficiency, names } = useComparisonShell();
  return (
    <EfficiencyPage
      comparison={efficiency}
      isCurrentLoading={efficiency === undefined}
      names={names}
    />
  );
}

export function ActivityRoutePage() {
  const { names } = useComparisonShell();
  return <ActivityPage names={names} />;
}

export function PlaceholderRoutePage({ view }: { view: AppView }) {
  const { names } = useComparisonShell();
  return <PagePlaceholder title={pageTitles[view]} names={names} view={view} />;
}

function Sidebar({
  isOpen,
  onClose,
  activeView,
  skillCount,
  getPath,
  onNavigate,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeView: AppView;
  skillCount: number | null;
  getPath: (view: AppView) => string;
  onNavigate: () => void;
}) {
  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="brand">
        <div className="brand-mark">
          <span />
          <span />
        </div>
        <div>
          <strong>RuneRating</strong>
          <small>COMPARE INTELLIGENCE</small>
        </div>
        <button
          type="button"
          className="sidebar-close"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>

      <nav>
        {navGroups.map((group, groupIndex) => (
          <div
            className="nav-group"
            key={group.label ?? `primary-${groupIndex}`}
          >
            {group.label && <p className="nav-label">{group.label}</p>}
            {group.items.map(([label, Icon]) => {
              const view = navViewByLabel[label];
              if (!view) return null;
              return (
                <Link
                  to={getPath(view)}
                  className={`nav-item ${view === activeView ? "active" : ""}`}
                  key={label}
                  onClick={onNavigate}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span>{label}</span>
                  {label === "Skills" && <small>{skillCount ?? "—"}</small>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

const skillCategories = {
  Combat: new Set([
    "Attack",
    "Strength",
    "Defence",
    "Hitpoints",
    "Ranged",
    "Prayer",
    "Magic",
  ]),
  Gathering: new Set(["Mining", "Fishing", "Woodcutting", "Hunter", "Farming"]),
  Artisan: new Set([
    "Cooking",
    "Smithing",
    "Fletching",
    "Firemaking",
    "Crafting",
    "Herblore",
    "Construction",
    "Runecraft",
  ]),
  Support: new Set(["Agility", "Thieving", "Slayer"]),
};

const skillCategory = (name: string) =>
  Object.entries(skillCategories).find(([, skills]) => skills.has(name))?.[0] ??
  "Other";
const skillCategoryNames = Object.keys(skillCategories);
const skillCategoryOrder = [...skillCategoryNames, "Other"];
type MilestoneMode = "next" | "99" | "milestones";
const xpForLevel = (level: number) => {
  let points = 0;
  for (let current = 1; current < level; current += 1) {
    points += Math.floor(current + 300 * 2 ** (current / 7));
  }
  return Math.floor(points / 4);
};
const maxVirtualLevel = 126;
const virtualLevelForXp = (level: number | null, xp: number | null) => {
  if ((level ?? 1) < 99 || xp === null) return level ?? 1;
  let virtualLevel = 99;
  while (virtualLevel < maxVirtualLevel && xp >= xpForLevel(virtualLevel + 1)) {
    virtualLevel += 1;
  }
  return virtualLevel;
};
const nextMajorMilestoneLevel = (level: number) =>
  [50, 75, 90, 99, 100, 110, 120, 126].find((milestone) => milestone > level) ??
  maxVirtualLevel;

type EfficiencyMetricMode = "ehp" | "ehb";
type EfficiencyChartMode = "total" | "daily";
type EfficiencyRange = "7d" | "30d" | "90d" | "1y";
type EfficiencyTimelinePoint = {
  date: number;
  dateLabel: string;
  left: number;
  right: number;
  gap: number;
};
type ChartCoordinate = {
  x: number;
  y: number;
};
type EfficiencySignalRow = {
  label: string;
  leftValue: string;
  leftTrend: string;
  rightValue: string;
  rightTrend: string;
  difference: string;
  differenceTrend: string;
  direction: "up" | "down";
};
type ActivityRange = EfficiencyRange;
type ActivityPoint = ActivityDashboard["points"][number];
type ActivitySide = "left" | "right";
type ActivitySignal = {
  label: string;
  value: string;
  detail: ReactNode;
  accent: "blue" | "green" | "amber" | "muted";
};

const efficiencyRanges: EfficiencyRange[] = ["7d", "30d", "90d", "1y"];
const efficiencyRangePeriods: Record<EfficiencyRange, HistoryPeriod> = {
  "7d": "week",
  "30d": "month",
  "90d": "quarter",
  "1y": "year",
};
const efficiencyDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const efficiencyDayMs = 24 * 60 * 60 * 1_000;
const efficiencyDailySmoothingDays = 14;
const efficiencyChartFrame = {
  width: 1120,
  height: 230,
  pad: { top: 14, right: 16, bottom: 27, left: 44 },
} as const;

const formatHours = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined
    ? "—"
    : `${value > 0 ? "+" : ""}${fmt.format(Number(value.toFixed(digits)))} hrs`;
const formatUnsignedHours = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined
    ? "—"
    : `${fmt.format(Number(value.toFixed(digits)))} hrs`;
const formatTrend = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
const activitySideName = (
  side: ActivitySide | null,
  names: [string, string],
) =>
  side === "left" ? names[0] : side === "right" ? names[1] : "Both players";
const activitySideClass = (side: ActivitySide | null) =>
  side === "left" ? "blue" : side === "right" ? "green" : "muted";

function timelineForMetric(
  timelines: EfficiencyTimelines | null,
  side: "left" | "right",
  metric: EfficiencyMetricMode,
) {
  return (
    timelines?.[side].timelines.find((timeline) => timeline.metric === metric)
      ?.timeline ?? []
  );
}

function valueAtTimeline(
  points: Array<{ date: number; value: number }>,
  timestamp: number,
) {
  let value: number | null = null;
  for (const point of points) {
    if (point.date > timestamp) break;
    value = point.value;
  }
  return value;
}

function gainBetweenTimeline(
  points: Array<{ date: number; value: number }>,
  start: number,
  end: number,
) {
  const startValue = valueAtTimeline(points, start);
  const endValue = valueAtTimeline(points, end);
  return startValue === null || endValue === null
    ? null
    : Math.max(0, endValue - startValue);
}

function timelineGain(points: Array<{ date: number; value: number }>) {
  const first = points[0]?.value;
  const last = points.at(-1)?.value;
  return first === undefined || last === undefined
    ? null
    : Math.max(0, last - first);
}

function timelineVelocity(points: Array<{ date: number; value: number }>) {
  const gained = timelineGain(points);
  const first = points[0]?.date;
  const last = points.at(-1)?.date;
  if (gained === null || first === undefined || last === undefined) return null;
  const days = Math.max(1, (last - first) / efficiencyDayMs);
  return gained / days;
}

function buildSmoothedDailyGainTimeline(
  points: Array<{ date: number; value: number }>,
) {
  const firstDate = points[0]?.date;
  const lastDate = points.at(-1)?.date;
  if (firstDate === undefined || lastDate === undefined) return [];
  const samples: Array<{ date: number; value: number }> = [];
  for (
    let date = firstDate + efficiencyDayMs;
    date <= lastDate;
    date += efficiencyDayMs
  ) {
    const endValue = valueAtTimeline(points, date);
    const startDate = Math.max(
      firstDate,
      date - efficiencyDailySmoothingDays * efficiencyDayMs,
    );
    const startValue = valueAtTimeline(points, startDate);
    if (endValue === null || startValue === null) continue;
    if (date <= startDate) continue;
    samples.push({
      date,
      value: Math.max(0, endValue - startValue) / efficiencyDailySmoothingDays,
    });
  }
  return samples;
}

function sevenDayTrend(points: Array<{ date: number; value: number }>) {
  const end = points.at(-1)?.date;
  if (end === undefined) return null;
  const current = gainBetweenTimeline(points, end - 7 * efficiencyDayMs, end);
  const previous = gainBetweenTimeline(
    points,
    end - 14 * efficiencyDayMs,
    end - 7 * efficiencyDayMs,
  );
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function buildEfficiencyChartData(
  leftTimeline: Array<{ date: number; value: number }>,
  rightTimeline: Array<{ date: number; value: number }>,
  chartMode: EfficiencyChartMode,
): EfficiencyTimelinePoint[] {
  const leftPoints =
    chartMode === "daily"
      ? buildSmoothedDailyGainTimeline(leftTimeline)
      : leftTimeline;
  const rightPoints =
    chartMode === "daily"
      ? buildSmoothedDailyGainTimeline(rightTimeline)
      : rightTimeline;
  const dates = [
    ...new Set([...leftPoints, ...rightPoints].map((point) => point.date)),
  ].sort((left, right) => left - right);
  return dates.flatMap((date) => {
    const left = valueAtTimeline(leftPoints, date);
    const right = valueAtTimeline(rightPoints, date);
    return left === null || right === null
      ? []
      : [
          {
            date,
            dateLabel: efficiencyDateFormatter.format(date),
            left,
            right,
            gap: left - right,
          },
        ];
  });
}

function buildEfficiencySignals(
  timelines: EfficiencyTimelines | null,
  comparison: EfficiencyComparison | undefined,
): EfficiencySignalRow[] {
  const metricRows = (["ehp", "ehb"] as const).flatMap((metric) => {
    const left = timelineForMetric(timelines, "left", metric);
    const right = timelineForMetric(timelines, "right", metric);
    const leftGained = timelineGain(left);
    const rightGained = timelineGain(right);
    const leftVelocity = timelineVelocity(left);
    const rightVelocity = timelineVelocity(right);
    const difference =
      leftGained === null || rightGained === null
        ? null
        : leftGained - rightGained;
    const velocityDifference =
      leftVelocity === null || rightVelocity === null
        ? null
        : leftVelocity - rightVelocity;
    return [
      {
        label: `Recent ${metric.toUpperCase()} gained`,
        leftValue: formatHours(leftGained),
        leftTrend: formatTrend(sevenDayTrend(left)),
        rightValue: formatHours(rightGained),
        rightTrend: formatTrend(sevenDayTrend(right)),
        difference: formatHours(difference),
        differenceTrend: formatTrend(
          difference === null || leftGained === null || leftGained === 0
            ? null
            : (difference / leftGained) * 100,
        ),
        direction: "up" as const,
      },
      {
        label: `${metric.toUpperCase()} velocity (hrs/day)`,
        leftValue:
          leftVelocity === null
            ? "—"
            : Number(leftVelocity.toFixed(1)).toString(),
        leftTrend: formatTrend(sevenDayTrend(left)),
        rightValue:
          rightVelocity === null
            ? "—"
            : Number(rightVelocity.toFixed(1)).toString(),
        rightTrend: formatTrend(sevenDayTrend(right)),
        difference:
          velocityDifference === null
            ? "—"
            : `${velocityDifference > 0 ? "+" : ""}${Number(
                velocityDifference.toFixed(1),
              )}`,
        differenceTrend: "—",
        direction: "up" as const,
      },
    ];
  });

  return [
    ...metricRows,
    {
      label: "Hours to max",
      leftValue: formatUnsignedHours(comparison?.efficiency.timeToMax.left),
      leftTrend: "—",
      rightValue: formatUnsignedHours(comparison?.efficiency.timeToMax.right),
      rightTrend: "—",
      difference: formatHours(comparison?.efficiency.timeToMax.delta),
      differenceTrend: "—",
      direction: "down",
    },
    {
      label: "Hours to 200m",
      leftValue: formatUnsignedHours(comparison?.efficiency.timeTo200m.left),
      leftTrend: "—",
      rightValue: formatUnsignedHours(comparison?.efficiency.timeTo200m.right),
      rightTrend: "—",
      difference: formatHours(comparison?.efficiency.timeTo200m.delta),
      differenceTrend: "—",
      direction: "down",
    },
  ];
}

function activityGain(point: ActivityPoint, side: ActivitySide) {
  return side === "left" ? point.leftGained : point.rightGained;
}

function activityObservedDays(points: ActivityPoint[], side: ActivitySide) {
  return points.filter((point) => activityGain(point, side) !== null).length;
}

function activityActiveDays(points: ActivityPoint[], side: ActivitySide) {
  return points.filter((point) => (activityGain(point, side) ?? 0) > 0).length;
}

function longestQuietStretch(points: ActivityPoint[]) {
  let currentStart: number | null = null;
  let currentDays = 0;
  let longest = {
    start: null as number | null,
    end: null as number | null,
    days: 0,
  };

  for (const point of points) {
    const isQuiet = point.leftGained === 0 && point.rightGained === 0;
    if (!isQuiet) {
      currentStart = null;
      currentDays = 0;
      continue;
    }
    currentStart ??= point.date;
    currentDays += 1;
    if (currentDays > longest.days) {
      longest = { start: currentStart, end: point.date, days: currentDays };
    }
  }

  return longest;
}

function activitySignals(
  dashboard: ActivityDashboard | null,
  names: [string, string],
): ActivitySignal[] {
  if (dashboard === null) {
    return [
      {
        label: "Daily rhythm",
        value: "Waiting",
        detail: "Cached WOM overview is loading.",
        accent: "muted",
      },
    ];
  }

  const quiet = longestQuietStretch(dashboard.points);
  const spike = dashboard.summaries.biggestSingleDayGain;
  const leadChange = dashboard.summaries.biggestLeadChange;
  const activeWindow = dashboard.summaries.mostActivePeriod;

  return [
    {
      label: "Daily rhythm",
      value:
        dashboard.summaries.leftAveragePerDay === null ||
        dashboard.summaries.rightAveragePerDay === null
          ? "Partial"
          : "Avg XP/day",
      detail: (
        <PlayerPairLine
          names={names}
          left={formatCompact(dashboard.summaries.leftAveragePerDay)}
          right={formatCompact(dashboard.summaries.rightAveragePerDay)}
        />
      ),
      accent: "blue",
    },
    {
      label: "Biggest spike",
      value: formatCompact(spike?.value ?? null),
      detail:
        spike === null
          ? "No XP spike in this range."
          : `${activitySideName(spike.side, names)} on ${efficiencyDateFormatter.format(spike.date)}.`,
      accent: spike === null ? "muted" : activitySideClass(spike.side),
    },
    {
      label: "Quiet stretch",
      value: quiet.days === 0 ? "None" : `${quiet.days}d`,
      detail:
        quiet.days === 0 || quiet.start === null || quiet.end === null
          ? "No shared inactive streak detected."
          : `${efficiencyDateFormatter.format(quiet.start)} to ${efficiencyDateFormatter.format(quiet.end)}.`,
      accent: quiet.days >= 3 ? "amber" : "muted",
    },
    {
      label: "Active block",
      value: formatCompact(activeWindow.value),
      detail:
        activeWindow.startDate === null || activeWindow.endDate === null
          ? "No active window available."
          : `${activeWindow.days}d from ${efficiencyDateFormatter.format(activeWindow.startDate)}.`,
      accent: "green",
    },
    {
      label: "Lead pressure",
      value: formatCompact(leadChange?.value ?? null),
      detail:
        leadChange === null
          ? "No meaningful lead movement."
          : `${activitySideName(leadChange.side, names)} moved the gap on ${efficiencyDateFormatter.format(leadChange.date)}.`,
      accent:
        leadChange === null ? "muted" : activitySideClass(leadChange.side),
    },
  ];
}

function ActivityPage({ names }: { names: [string, string] }) {
  const getDashboard = useAction(api.xpTimeline.getDashboard);
  const [range, setRange] = useState<ActivityRange>("30d");
  const [result, setResult] = useState<{
    data: ActivityDashboard | null;
    error: string | null;
    key: string;
    isLoading: boolean;
  }>({ data: null, error: null, key: "", isLoading: true });
  const requestKey = `${names[0]}:${names[1]}:${range}:activity`;

  useEffect(() => {
    let ignored = false;
    setResult((current) => ({
      data: current.key === requestKey ? current.data : null,
      error: null,
      key: requestKey,
      isLoading: true,
    }));
    void getDashboard({
      leftRsn: names[0],
      rightRsn: names[1],
      range: efficiencyRangePeriods[range],
    })
      .then((data) => {
        if (!ignored) {
          setResult({ data, error: null, key: requestKey, isLoading: false });
        }
      })
      .catch((error) => {
        if (!ignored) {
          setResult({
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "Activity data unavailable",
            key: requestKey,
            isLoading: false,
          });
        }
      });
    return () => {
      ignored = true;
    };
  }, [getDashboard, names, range, requestKey]);

  const dashboard = result.key === requestKey ? result.data : null;
  const points = dashboard?.points ?? [];
  const heatmapPoints = dashboard?.heatmapPoints ?? [];
  const leftActive = activityActiveDays(points, "left");
  const rightActive = activityActiveDays(points, "right");
  const leftObserved = activityObservedDays(points, "left");
  const rightObserved = activityObservedDays(points, "right");
  const quiet = longestQuietStretch(points);
  const biggestSpike = dashboard?.summaries.biggestSingleDayGain ?? null;
  const heatA = useMemo(
    () => heatmapValues(heatmapPoints, "leftGained", "activity-left"),
    [heatmapPoints],
  );
  const heatB = useMemo(
    () => heatmapValues(heatmapPoints, "rightGained", "activity-right"),
    [heatmapPoints],
  );
  const chartData = points.map((point) => ({
    timestamp: point.date,
    date: efficiencyDateFormatter.format(point.date),
    left: point.leftGained ?? 0,
    right: point.rightGained ?? 0,
  }));
  const signals = activitySignals(dashboard, names);
  const fetchedAtValues = [
    dashboard?.left.fetchedAt ?? null,
    dashboard?.right.fetchedAt ?? null,
  ].filter((value): value is number => value !== null);
  const oldestFetch =
    fetchedAtValues.length === 0 ? null : Math.min(...fetchedAtValues);

  return (
    <div className="activity-page">
      <PageHeader
        title="Activity"
        meta={<HeaderSourceChip label="Wise Old Man" />}
        controls={
          <SegmentedControl
            label="Activity range"
            value={range}
            options={efficiencyRanges.map((item) => [item, item])}
            onChange={setRange}
          />
        }
      />

      {result.error ? (
        <div className="data-banner error">{result.error}</div>
      ) : null}
      {result.isLoading && dashboard === null ? (
        <div className="data-banner">Loading cached WOM overview…</div>
      ) : null}

      <section className="activity-kpi-grid">
        <ActivityKpi
          icon={CalendarDays}
          label="Active days"
          value={`${Math.max(leftActive, rightActive)} active`}
          detail={
            <PlayerPairLine
              names={names}
              left={`${leftActive} active, ${leftObserved || "—"} observed`}
              right={`${rightActive} active, ${rightObserved || "—"} observed`}
            />
          }
          accent="blue"
        />
        <ActivityKpi
          icon={Bolt}
          label="Biggest spike"
          value={formatCompact(biggestSpike?.value ?? null)}
          detail={
            biggestSpike === null
              ? "No spike detected"
              : activitySideName(biggestSpike.side, names)
          }
          accent={activitySideClass(biggestSpike?.side ?? null)}
        />
        <ActivityKpi
          icon={Clock3}
          label="Quiet stretch"
          value={quiet.days === 0 ? "None" : `${quiet.days}d`}
          detail="Shared zero-gain days"
          accent={quiet.days >= 3 ? "amber" : "muted"}
        />
        <ActivityKpi
          icon={Info}
          label="Source freshness"
          value={oldestFetch === null ? "Waiting" : formatAge(oldestFetch)}
          detail="Cached WOM overview"
          accent="green"
        />
      </section>

      <section className="activity-main-grid">
        <article className="panel activity-heatmap-panel">
          <PanelHeader
            title="Daily rhythm"
            eyebrow="One-year cached activity map"
            action={
              <span className="activity-panel-note">
                Darker days indicate larger XP gain.
              </span>
            }
          />
          <div className="activity-heatmap">
            <HeatmapRow name={names[0]} values={heatA} accent="blue" />
            <HeatmapRow name={names[1]} values={heatB} accent="green" />
          </div>
          <LoadingOverlay
            isLoading={result.isLoading}
            label="Loading activity heatmap"
          />
        </article>

        <article className="panel activity-signals-panel">
          <PanelHeader title="Activity signals" eyebrow={range} />
          <div className="activity-signal-list">
            {signals.map((signal) => (
              <div
                className={`activity-signal ${signal.accent}`}
                key={signal.label}
              >
                <i />
                <span>
                  <small>{signal.label}</small>
                  <strong>{signal.value}</strong>
                  <div className="activity-signal-detail">{signal.detail}</div>
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel activity-bars-panel">
          <PanelHeader
            title="Daily gains"
            eyebrow={`${range} comparison`}
            action={
              <div className="xp-chart-legend">
                <span>
                  <i className="blue" />
                  {names[0]}
                </span>
                <span>
                  <i className="green" />
                  {names[1]}
                </span>
              </div>
            }
          />
          <div className="activity-bars-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={1} barCategoryGap="18%">
                <CartesianGrid stroke="#e8edf1" vertical={false} />
                <XAxis
                  dataKey="date"
                  interval="preserveStartEnd"
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatCompact}
                  width={42}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => formatCompact(Number(value))}
                  labelFormatter={(label) => `Daily gain: ${label}`}
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
        </article>

        <article className="panel activity-events-panel">
          <PanelHeader title="Notable days" eyebrow="Recent signals" />
          <div className="activity-event-list">
            {(dashboard?.events ?? []).length === 0 ? (
              <p>No notable activity events in this range.</p>
            ) : (
              dashboard?.events.map((event) => (
                <div
                  className="activity-event"
                  key={`${event.kind}-${event.date}`}
                >
                  <i className={activitySideClass(event.side)} />
                  <span>
                    <strong>
                      {event.kind === "spike"
                        ? "Biggest spike"
                        : event.kind === "leadChange"
                          ? "Lead change"
                          : "Quiet stretch"}
                    </strong>
                    <small>
                      {efficiencyDateFormatter.format(event.date)}
                      {event.endDate
                        ? ` to ${efficiencyDateFormatter.format(event.endDate)}`
                        : ""}
                    </small>
                  </span>
                  <b>{formatCompact(event.value)}</b>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

function ActivityKpi({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: ReactNode;
  accent: "blue" | "green" | "amber" | "muted";
}) {
  return (
    <article className={`panel activity-kpi ${accent}`}>
      <Icon size={22} strokeWidth={1.8} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <div className="activity-kpi-detail">{detail}</div>
      </div>
    </article>
  );
}

function buildStraightPath(points: ChartCoordinate[]) {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function buildSmoothPath(points: ChartCoordinate[]) {
  if (points.length < 3) return buildStraightPath(points);
  return points
    .map((point, index) => {
      if (index === 0) return `M${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      const previous = points[index - 1] ?? point;
      const next = points[index + 1] ?? point;
      const beforePrevious = points[index - 2] ?? previous;
      const controlOneX = previous.x + (point.x - beforePrevious.x) / 6;
      const controlOneY = previous.y + (point.y - beforePrevious.y) / 6;
      const controlTwoX = point.x - (next.x - previous.x) / 6;
      const controlTwoY = point.y - (next.y - previous.y) / 6;
      return `C${controlOneX.toFixed(1)},${controlOneY.toFixed(1)} ${controlTwoX.toFixed(1)},${controlTwoY.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function EfficiencyPage({
  comparison,
  isCurrentLoading,
  names,
}: {
  comparison: EfficiencyComparison | undefined;
  isCurrentLoading: boolean;
  names: [string, string];
}) {
  const getEfficiencyTimelines = useAction(
    api.wiseOldMan.getEfficiencyTimelines,
  );
  const [metricMode, setMetricMode] = useState<EfficiencyMetricMode>("ehp");
  const [chartMode, setChartMode] = useState<EfficiencyChartMode>("total");
  const [range, setRange] = useState<EfficiencyRange>("90d");
  const [hoursPerWeek, setHoursPerWeek] = useState(20);
  const [timelineResult, setTimelineResult] = useState<{
    data: EfficiencyTimelines | null;
    error: string | null;
    key: string;
    isLoading: boolean;
  }>({ data: null, error: null, key: "", isLoading: true });
  const requestKey = `${names[0]}:${names[1]}:${range}`;

  useEffect(() => {
    let ignored = false;
    setTimelineResult((current) => ({
      data: current.key === requestKey ? current.data : null,
      error: null,
      key: requestKey,
      isLoading: true,
    }));
    void getEfficiencyTimelines({
      leftRsn: names[0],
      rightRsn: names[1],
      metrics: ["ehp", "ehb"],
      period: efficiencyRangePeriods[range],
    })
      .then((data) => {
        if (!ignored) {
          setTimelineResult({
            data,
            error: null,
            key: requestKey,
            isLoading: false,
          });
        }
      })
      .catch((error) => {
        if (!ignored) {
          setTimelineResult({
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "Efficiency timeline unavailable",
            key: requestKey,
            isLoading: false,
          });
        }
      });
    return () => {
      ignored = true;
    };
  }, [getEfficiencyTimelines, names, range, requestKey]);

  const timelines =
    timelineResult.key === requestKey ? timelineResult.data : null;
  const leftTimeline = timelineForMetric(timelines, "left", metricMode);
  const rightTimeline = timelineForMetric(timelines, "right", metricMode);
  const ehpGap = comparison?.efficiency.ehp.delta ?? null;
  const hasEhpGap = ehpGap !== null && Math.abs(ehpGap) >= 0.05;
  const behindSide =
    !hasEhpGap || ehpGap === null ? null : ehpGap > 0 ? "right" : "left";
  const closingWeeks =
    !hasEhpGap || ehpGap === null
      ? null
      : Math.abs(ehpGap) / Math.max(1, hoursPerWeek);
  const closingProgress = Math.min(100, (hoursPerWeek / 40) * 100);
  const chartData = useMemo(
    () => buildEfficiencyChartData(leftTimeline, rightTimeline, chartMode),
    [leftTimeline, rightTimeline, chartMode],
  );
  const signals = useMemo(
    () => buildEfficiencySignals(timelines, comparison),
    [timelines, comparison],
  );
  const accountTypes = comparison?.accountTypes ?? null;
  const accountTypeMismatch =
    accountTypes !== null && accountTypes.left !== accountTypes.right;
  const ratio = (side: "left" | "right") => {
    const ehp = comparison?.efficiency.ehp[side];
    const ehb = comparison?.efficiency.ehb[side];
    return ehp === null ||
      ehp === undefined ||
      ehb === null ||
      ehb === undefined ||
      ehb === 0
      ? null
      : ehp / ehb;
  };
  const efficiencyStyle = (side: "left" | "right") => {
    const value = ratio(side);
    if (value === null) return "—";
    if (value >= 1.25) return "Skilling-weighted";
    if (value <= 0.9) return "PvM-weighted";
    return "Balanced";
  };
  const maxTargetWeeks =
    comparison?.efficiency.timeToMax.left == null
      ? null
      : comparison.efficiency.timeToMax.left / Math.max(1, hoursPerWeek);
  const maxTargetDate =
    maxTargetWeeks === null
      ? "—"
      : efficiencyDateFormatter.format(
          Date.now() + maxTargetWeeks * 7 * efficiencyDayMs,
        );

  return (
    <div className="efficiency-page">
      <PageHeader
        title="EHP / Efficiency"
        meta={<HeaderSourceChip label="Wise Old Man" />}
      />

      {timelineResult.error ? (
        <div className="data-banner error">{timelineResult.error}</div>
      ) : null}
      {timelineResult.isLoading && timelines === null ? (
        <div className="data-banner">
          Loading cached WOM efficiency timeline…
        </div>
      ) : null}

      <section className="efficiency-kpi-grid">
        <EfficiencyKpiCard
          icon={BarChart3}
          label="EHP lead"
          value={formatHours(comparison?.efficiency.ehp.delta)}
          detail="Higher is better"
          accent="blue"
        />
        <EfficiencyKpiCard
          icon={Activity}
          label="EHB lead"
          value={formatHours(comparison?.efficiency.ehb.delta)}
          detail="Higher is better"
          accent="blue"
        />
        <EfficiencyKpiCard
          icon={Clock3}
          label="Time to max gap"
          value={formatHours(comparison?.efficiency.timeToMax.delta)}
          detail="Lower is better"
          accent="green"
        />
        <EfficiencyKpiCard
          icon={Target}
          label="Time to 200m gap"
          value={formatHours(comparison?.efficiency.timeTo200m.delta, 0)}
          detail="Lower is better"
          accent="green"
        />
      </section>

      <section className="efficiency-main-grid">
        <article className="panel efficiency-chart-panel">
          <PanelHeader
            title="Effective hours timeline"
            eyebrow="Wise Old Man historical snapshots"
            action={
              <div className="efficiency-chart-actions">
                <fieldset
                  className="segmented"
                  aria-label="Effective hours metric"
                >
                  {(["ehp", "ehb"] as const).map((mode) => (
                    <button
                      type="button"
                      className={metricMode === mode ? "active" : ""}
                      key={mode}
                      onClick={() => setMetricMode(mode)}
                    >
                      {mode.toUpperCase()}
                    </button>
                  ))}
                </fieldset>
                <fieldset className="segmented" aria-label="Chart value">
                  {(
                    [
                      ["total", "Total"],
                      ["daily", "Gained/day"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      type="button"
                      className={chartMode === mode ? "active" : ""}
                      key={mode}
                      onClick={() => setChartMode(mode)}
                    >
                      {label}
                    </button>
                  ))}
                </fieldset>
                <fieldset className="xp-range" aria-label="Efficiency range">
                  {efficiencyRanges.map((item) => (
                    <button
                      type="button"
                      className={range === item ? "active" : ""}
                      key={item}
                      onClick={() => setRange(item)}
                    >
                      {item}
                    </button>
                  ))}
                </fieldset>
              </div>
            }
          />
          <div className="efficiency-rechart-wrap">
            <EfficiencyLineChart
              data={chartData}
              mode={chartMode}
              names={names}
            />
            {chartData.length === 0 ? (
              <div className="efficiency-empty-chart">
                No {metricMode.toUpperCase()}{" "}
                {chartMode === "daily" ? "gain" : "timeline"} points for both
                players.
              </div>
            ) : null}
          </div>
          <div className="efficiency-chart-footer">
            <span>
              {chartMode === "daily"
                ? "Daily gain shows a smoothed 14-day average from WOM snapshots."
                : "All times in game time (UTC)."}
            </span>
            <div className="xp-chart-legend">
              <span>
                <i className="blue" />
                {names[0]}
              </span>
              <span>
                <i className="green" />
                {names[1]}
              </span>
              <span>
                <i className="muted" />
                {chartMode === "daily" ? "14d avg hrs/day" : "effective hours"}
              </span>
            </div>
          </div>
          <LoadingOverlay
            isLoading={timelineResult.isLoading || isCurrentLoading}
            label="Loading efficiency timeline"
          />
        </article>

        <EfficiencyProfile
          accountTypes={accountTypes}
          accountTypeMismatch={accountTypeMismatch}
          combatLevel={comparison?.efficiency.combatLevel}
          efficiencyStyle={efficiencyStyle}
          names={names}
          ratio={ratio}
        />

        <article className="panel efficiency-planner">
          <PanelHeader
            title="Time debt planner"
            eyebrow="Projected from current gap"
          />
          <div className="efficiency-slider-row">
            <label htmlFor="effective-hours">
              <span>Efficient hours per week</span>
              <strong>{hoursPerWeek} hrs</strong>
            </label>
            <input
              id="effective-hours"
              type="range"
              min="5"
              max="40"
              step="1"
              value={hoursPerWeek}
              onChange={(event) => setHoursPerWeek(Number(event.target.value))}
            />
            <div className="efficiency-slider-ticks">
              <span>5</span>
              <span>10</span>
              <span>20</span>
              <span>30</span>
              <span>40</span>
            </div>
          </div>
          <div className="efficiency-forecast-list">
            <EfficiencyForecast
              icon={Clock3}
              text={
                closingWeeks === null || behindSide === null
                  ? "Current EHP gap is tied or unavailable."
                  : `At ${hoursPerWeek} efficient hrs/week, ${behindSide === "left" ? names[0] : names[1]} closes the EHP gap in ${closingWeeks.toFixed(1)} weeks.`
              }
              value={
                closingWeeks === null ? "—" : `${closingWeeks.toFixed(1)} weeks`
              }
              accent="green"
              progress={closingProgress}
            />
            <EfficiencyForecast
              icon={Target}
              text={`${names[0]} reaches max efficiency target around ${maxTargetDate}.`}
              value={
                maxTargetWeeks === null
                  ? "—"
                  : `~${Math.max(1, Math.round(maxTargetWeeks / 4.345))} months`
              }
              accent="blue"
              progress={
                comparison?.efficiency.timeToMax.left == null
                  ? 0
                  : Math.max(
                      8,
                      100 -
                        Math.min(
                          100,
                          (comparison.efficiency.timeToMax.left / 3_000) * 100,
                        ),
                    )
              }
            />
          </div>
        </article>
      </section>

      <article className="panel efficiency-signals-panel">
        <PanelHeader
          title="Efficiency signals"
          eyebrow={`${periodLabels[efficiencyRangePeriods[range]]} WOM timeline`}
        />
        <div className="table-scroll efficiency-signals-scroll">
          <table className="skills-detail-table efficiency-signals-table">
            <thead>
              <tr>
                <th>Signal</th>
                <th>{names[0]}</th>
                <th>{names[1]}</th>
                <th>Delta</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((row) => (
                <tr key={row.label}>
                  <td>
                    <span className="efficiency-signal-name">
                      <Zap size={13} />
                      {row.label}
                    </span>
                  </td>
                  <td>
                    <EfficiencySignalValue
                      trend={row.leftTrend}
                      trendClass={
                        row.direction === "down" ? "green-text" : "blue-text"
                      }
                      value={row.leftValue}
                    />
                  </td>
                  <td>
                    <EfficiencySignalValue
                      trend={row.rightTrend}
                      trendClass="green-text"
                      value={row.rightValue}
                    />
                  </td>
                  <td>
                    <EfficiencySignalValue
                      trend={row.differenceTrend}
                      trendClass={
                        row.direction === "down" ? "green-text" : "blue-text"
                      }
                      value={row.difference}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

function EfficiencySignalValue({
  trend,
  trendClass,
  value,
}: {
  trend: string;
  trendClass: string;
  value: string;
}) {
  return (
    <span className="efficiency-signal-value">
      <strong>{value}</strong>
      <em className={trendClass}>{trend}</em>
    </span>
  );
}

function EfficiencyKpiCard({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  accent: "blue" | "green";
}) {
  return (
    <article className={`panel efficiency-kpi ${accent}`}>
      <Icon size={22} strokeWidth={1.8} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>
          {accent === "green" ? "↓" : "↑"} {detail}
        </small>
      </div>
    </article>
  );
}

function EfficiencyLineChart({
  data,
  mode,
  names,
}: {
  data: EfficiencyTimelinePoint[];
  mode: EfficiencyChartMode;
  names: [string, string];
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const { width, height, pad } = efficiencyChartFrame;
  const values = data.flatMap((point) => [point.left, point.right]);
  const max = Math.max(...values, 1);
  const top =
    mode === "daily"
      ? Math.max(1, Math.ceil(max * 2) / 2)
      : Math.ceil(max / 1_000) * 1_000;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    key: `tick-${ratio}`,
    value:
      mode === "daily"
        ? Number((top * ratio).toFixed(1))
        : Math.round((top * ratio) / 1_000) * 1_000,
  }));
  const xLabelStep = Math.max(1, Math.ceil(data.length / 7));
  const x = (index: number) =>
    pad.left +
    (index / Math.max(1, data.length - 1)) * (width - pad.left - pad.right);
  const y = (value: number) =>
    pad.top + (1 - value / top) * (height - pad.top - pad.bottom);
  const coordinates = (side: "left" | "right") =>
    data.map((point, index) => ({
      x: x(index),
      y: y(point[side]),
    }));
  const path = (side: "left" | "right") => {
    const points = coordinates(side);
    return mode === "daily"
      ? buildSmoothPath(points)
      : buildStraightPath(points);
  };
  const areaPath = (side: "left" | "right") => {
    if (data.length === 0) return "";
    return `${path(side)} L${x(data.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  };
  const formatChartValue = (value: number) =>
    mode === "daily"
      ? `${value.toLocaleString("en-US", {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        })} hrs/day`
      : formatUnsignedHours(value);
  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (data.length === 0) {
      setHoverIndex(null);
      return;
    }
    const matrix = event.currentTarget.getScreenCTM();
    if (matrix === null) {
      setHoverIndex(null);
      return;
    }
    const svgX = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    ).x;
    const plotLeft = pad.left;
    const plotWidth = width - pad.left - pad.right;
    const ratio = Math.min(1, Math.max(0, (svgX - plotLeft) / plotWidth));
    setHoverIndex(Math.round(ratio * (data.length - 1)));
  };
  const hoveredPoint = hoverIndex === null ? null : (data[hoverIndex] ?? null);
  const hoverX = hoverIndex === null ? null : x(hoverIndex);
  const tooltipLeft =
    hoverX === null
      ? "50%"
      : `${Math.min(92, Math.max(8, (hoverX / width) * 100))}%`;

  return (
    <>
      <svg
        className="efficiency-svg-chart"
        role="img"
        aria-label="Effective hours comparison timeline"
        onPointerLeave={() => setHoverIndex(null)}
        onPointerMove={handlePointerMove}
        viewBox={`0 0 ${width} ${height}`}
      >
        {ticks.map((tick) => (
          <g key={tick.key}>
            <line
              className="xp-grid-line"
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick.value)}
              y2={y(tick.value)}
            />
            <text x={pad.left - 10} y={y(tick.value) + 3} textAnchor="end">
              {mode === "daily"
                ? tick.value.toLocaleString("en-US", {
                    maximumFractionDigits: 1,
                  })
                : `${Math.round(tick.value / 1_000)}k`}
            </text>
          </g>
        ))}
        {data.map((point, index) =>
          index % xLabelStep === 0 || index === data.length - 1 ? (
            <text
              className="efficiency-svg-x"
              key={point.date}
              x={x(index)}
              y={height - 6}
              textAnchor="middle"
            >
              {point.dateLabel}
            </text>
          ) : null,
        )}
        <path className="xp-area blue" d={areaPath("left")} />
        <path className="xp-area green" d={areaPath("right")} />
        <path className="xp-line blue" d={path("left")} />
        <path className="xp-line green" d={path("right")} />
        {mode === "total"
          ? data.map((point, index) => (
              <g key={`${point.date}-dots`}>
                <circle
                  className="xp-dot blue"
                  cx={x(index)}
                  cy={y(point.left)}
                  r="2.8"
                />
                <circle
                  className="xp-dot green"
                  cx={x(index)}
                  cy={y(point.right)}
                  r="2.8"
                />
              </g>
            ))
          : null}
        {hoveredPoint !== null && hoverX !== null ? (
          <g className="efficiency-hover-layer">
            <line
              className="efficiency-hover-line"
              x1={hoverX}
              x2={hoverX}
              y1={pad.top}
              y2={height - pad.bottom}
            />
            <circle
              className="efficiency-hover-dot blue"
              cx={hoverX}
              cy={y(hoveredPoint.left)}
              r="4"
            />
            <circle
              className="efficiency-hover-dot green"
              cx={hoverX}
              cy={y(hoveredPoint.right)}
              r="4"
            />
          </g>
        ) : null}
      </svg>
      {hoveredPoint !== null ? (
        <div className="efficiency-chart-tooltip" style={{ left: tooltipLeft }}>
          <strong>{hoveredPoint.dateLabel}</strong>
          <small>
            <i className="blue" />
            <span>{names[0]}</span>
            <b>{formatChartValue(hoveredPoint.left)}</b>
          </small>
          <small>
            <i className="green" />
            <span>{names[1]}</span>
            <b>{formatChartValue(hoveredPoint.right)}</b>
          </small>
          <em>{mode === "daily" ? "14-day average" : "Effective hours"}</em>
        </div>
      ) : null}
    </>
  );
}

function EfficiencyProfile({
  accountTypes,
  accountTypeMismatch,
  combatLevel,
  efficiencyStyle,
  names,
  ratio,
}: {
  accountTypes: { left: string; right: string } | null;
  accountTypeMismatch: boolean;
  combatLevel:
    | NonNullable<EfficiencyComparison>["efficiency"]["combatLevel"]
    | undefined;
  efficiencyStyle: (side: "left" | "right") => string;
  names: [string, string];
  ratio: (side: "left" | "right") => number | null;
}) {
  const leftStyle = efficiencyStyle("left");
  const rightStyle = efficiencyStyle("right");
  return (
    <article className="panel efficiency-profile-panel">
      <PanelHeader title="Efficiency profile" eyebrow="Account comparison" />
      <div className="efficiency-profile-grid">
        <span />
        <strong className="blue-text">{names[0]}</strong>
        <strong className="green-text">{names[1]}</strong>
        <span>Account type</span>
        <b>{accountTypes?.left ?? "—"}</b>
        <b>{accountTypes?.right ?? "—"}</b>
        {accountTypeMismatch ? (
          <p className="efficiency-profile-warning">
            Different account types: compare rates carefully.
          </p>
        ) : null}
        <span>Primary build</span>
        <b className="blue-text">{leftStyle}</b>
        <b className="green-text">{rightStyle}</b>
        <span>Combat level</span>
        <b>{formatValue(combatLevel?.left ?? null)}</b>
        <b>{formatValue(combatLevel?.right ?? null)}</b>
        <span>EHP / EHB ratio</span>
        <b>{ratio("left")?.toFixed(2) ?? "—"}</b>
        <b>{ratio("right")?.toFixed(2) ?? "—"}</b>
        <span>Efficiency style</span>
        <b>
          <em className="efficiency-pill blue">{leftStyle}</em>
        </b>
        <b>
          <em className="efficiency-pill green">{rightStyle}</em>
        </b>
      </div>
    </article>
  );
}

function EfficiencyForecast({
  icon: Icon,
  text,
  value,
  accent,
  progress,
}: {
  icon: LucideIcon;
  text: string;
  value: string;
  accent: "blue" | "green";
  progress: number;
}) {
  return (
    <div className={`efficiency-forecast ${accent}`}>
      <Icon size={16} />
      <div>
        <span>{text}</span>
        <i>
          <b style={{ width: `${progress}%` }} />
        </i>
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function SkillsPage({
  comparison,
  names,
}: {
  comparison: SkillsComparison | undefined;
  names: [string, string];
}) {
  const getSkillGains = useAction(api.wiseOldMan.getSkillGains);
  const getSkillTimeline = useAction(api.wiseOldMan.getSkillTimeline);
  const [skillPeriod, setSkillPeriod] = useState<HistoryPeriod>("month");
  const [selectedSkillKeys, setSelectedSkillKeys] = useState(["skill.attack"]);
  const [skillGainsResult, setSkillGainsResult] = useState<{
    data: SkillGains | null;
    error: string | null;
    requestKey: string | null;
    isLoading: boolean;
  }>({ data: null, error: null, requestKey: null, isLoading: true });
  const [skillTimelineResults, setSkillTimelineResults] = useState<
    Record<
      string,
      { data: SkillTimeline | null; error: string | null; isLoading: boolean }
    >
  >({});
  const skillRows = useMemo(
    () =>
      comparison?.skills.filter((skill) => skill.key !== "skill.overall") ?? [],
    [comparison],
  );
  const overall = comparison?.skills.find(
    (skill) => skill.key === "skill.overall",
  );
  const leftLeads = skillRows.filter(
    (skill) => skill.level.leader === "left",
  ).length;
  const rightLeads = skillRows.filter(
    (skill) => skill.level.leader === "right",
  ).length;
  const totalSkills = skillRows.length;
  const leftXp = overall?.xp.left ?? null;
  const rightXp = overall?.xp.right ?? null;
  const strongest = skillRows
    .filter((skill) => skill.xp.delta !== null && skill.xp.delta !== 0)
    .reduce<(typeof skillRows)[number] | null>(
      (best, skill) =>
        best === null ||
        Math.abs(skill.xp.delta ?? 0) > Math.abs(best.xp.delta ?? 0)
          ? skill
          : best,
      null,
    );
  const visibleSkillKeys = useMemo(() => {
    const activeSkillKeys = selectedSkillKeys.filter((key) =>
      skillRows.some((skill) => skill.key === key),
    );
    return activeSkillKeys.length > 0
      ? activeSkillKeys
      : skillRows[0]
        ? [skillRows[0].key]
        : selectedSkillKeys;
  }, [selectedSkillKeys, skillRows]);
  const gainsRequestKey = `${names[0]}:${names[1]}:week`;
  const skillGains =
    skillGainsResult.requestKey === gainsRequestKey
      ? skillGainsResult.data
      : null;
  const skillGainsError =
    skillGainsResult.requestKey === gainsRequestKey
      ? skillGainsResult.error
      : null;

  useEffect(() => {
    let ignored = false;
    setSkillGainsResult({
      data: null,
      error: null,
      requestKey: gainsRequestKey,
      isLoading: true,
    });
    void getSkillGains({
      leftRsn: names[0],
      rightRsn: names[1],
      period: "week",
    })
      .then((data) => {
        if (!ignored) {
          setSkillGainsResult({
            data,
            error: null,
            requestKey: gainsRequestKey,
            isLoading: false,
          });
        }
      })
      .catch((error) => {
        if (!ignored) {
          setSkillGainsResult({
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "Skill gains unavailable",
            requestKey: gainsRequestKey,
            isLoading: false,
          });
        }
      });
    return () => {
      ignored = true;
    };
  }, [gainsRequestKey, getSkillGains, names]);

  useEffect(() => {
    if (visibleSkillKeys.length === 0) return;
    let ignored = false;
    void hashRsnPair(names).then(([leftRsnHash, rightRsnHash]) => {
      captureAnalytics("timeline_requested", {
        timeline_type: "skill_xp",
        period: skillPeriod,
        skill_keys_count: visibleSkillKeys.length,
        left_rsn_hash: leftRsnHash,
        right_rsn_hash: rightRsnHash,
      });
    });
    for (const skillKey of visibleSkillKeys) {
      const requestKey = `${names[0]}:${names[1]}:${skillKey}:${skillPeriod}`;
      setSkillTimelineResults((results) => ({
        ...results,
        [requestKey]: {
          data: results[requestKey]?.data ?? null,
          error: null,
          isLoading: true,
        },
      }));
      void getSkillTimeline({
        leftRsn: names[0],
        rightRsn: names[1],
        skillKey,
        period: skillPeriod,
      })
        .then((data) => {
          if (!ignored) {
            setSkillTimelineResults((results) => ({
              ...results,
              [requestKey]: { data, error: null, isLoading: false },
            }));
          }
        })
        .catch((error) => {
          if (!ignored) {
            setSkillTimelineResults((results) => ({
              ...results,
              [requestKey]: {
                data: null,
                isLoading: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "Skill timeline unavailable",
              },
            }));
          }
        });
    }
    return () => {
      ignored = true;
    };
  }, [getSkillTimeline, names, skillPeriod, visibleSkillKeys]);

  const skillTimelines = Object.fromEntries(
    visibleSkillKeys.map((skillKey) => {
      const requestKey = `${names[0]}:${names[1]}:${skillKey}:${skillPeriod}`;
      return [skillKey, skillTimelineResults[requestKey]?.data ?? null];
    }),
  );
  const skillTimelineError =
    visibleSkillKeys
      .map((skillKey) => {
        const requestKey = `${names[0]}:${names[1]}:${skillKey}:${skillPeriod}`;
        return skillTimelineResults[requestKey]?.error;
      })
      .find((error) => error !== null && error !== undefined) ?? null;
  const isComparisonLoading = comparison === undefined;
  const isSkillGainsLoading =
    skillGainsResult.requestKey !== gainsRequestKey ||
    skillGainsResult.isLoading;
  const isSkillTimelineLoading = visibleSkillKeys.some((skillKey) => {
    const requestKey = `${names[0]}:${names[1]}:${skillKey}:${skillPeriod}`;
    return skillTimelineResults[requestKey]?.isLoading !== false;
  });

  return (
    <div className="skills-page">
      <PageHeader
        title="Skills"
        meta={
          <>
            <HeaderSourceChip label="Hiscores" />
            <span>{totalSkills} skills compared</span>
          </>
        }
      />

      <section className="skills-summary-grid" aria-label="Skills summary">
        <SkillSummaryCard
          icon={Trophy}
          label="Overall leader"
          value={
            leftLeads === rightLeads
              ? "Tied"
              : `${Math.max(leftLeads, rightLeads)} of ${totalSkills}`
          }
          accent={leftLeads >= rightLeads ? "blue" : "green"}
        >
          <PlayerPairLine
            names={names}
            left={leftLeads}
            right={rightLeads}
            leftLabel="Skills led"
            rightLabel="Skills led"
          />
        </SkillSummaryCard>
        <SkillSummaryCard
          icon={BarChart3}
          label="Total level difference"
          value={formatDelta(overall?.level.delta ?? null)}
          accent={(overall?.level.delta ?? 0) >= 0 ? "blue" : "green"}
        >
          <PlayerPairLine
            names={names}
            left={formatValue(overall?.level.left ?? null)}
            right={formatValue(overall?.level.right ?? null)}
          />
        </SkillSummaryCard>
        <SkillSummaryCard
          icon={Zap}
          label="Total XP difference"
          value={formatCompactDelta(overall?.xp.delta ?? null)}
          accent={(overall?.xp.delta ?? 0) >= 0 ? "blue" : "green"}
        >
          <PlayerPairLine
            names={names}
            left={`${formatCompact(leftXp)} XP`}
            right={`${formatCompact(rightXp)} XP`}
          />
        </SkillSummaryCard>
        <SkillSummaryCard
          icon={Mountain}
          label="Skill lead count"
          value={`${Math.max(leftLeads, rightLeads)} skills`}
          accent="split"
        >
          <PlayerPairLine
            names={names}
            left={leftLeads}
            right={rightLeads}
            leftLabel="Leads"
            rightLabel="Leads"
          />
        </SkillSummaryCard>
      </section>

      <section className="skills-overview-grid">
        <article
          className="panel skills-composition-panel"
          aria-busy={isComparisonLoading}
        >
          <PanelHeader title="XP composition" eyebrow="Share of total XP" />
          <div className="composition-body">
            <CompositionRow
              name={names[0]}
              accent="blue"
              total={leftXp}
              skills={skillRows}
              side="left"
            />
            <CompositionRow
              name={names[1]}
              accent="green"
              total={rightXp}
              skills={skillRows}
              side="right"
            />
            <div className="composition-legend">
              {Object.keys(skillCategories).map((category) => (
                <span key={category}>
                  <i className={category.toLowerCase()} />
                  {category}
                </span>
              ))}
            </div>
          </div>
          <LoadingOverlay
            isLoading={isComparisonLoading}
            label="Loading XP composition"
          />
        </article>
      </section>

      <section className="skills-dashboard-grid">
        <SkillsDetailTable
          names={names}
          comparison={comparison}
          isLoading={isComparisonLoading}
        />
        <SkillProgressChart
          names={names}
          skills={skillRows}
          selectedSkillKeys={visibleSkillKeys}
          onSkillChange={setSelectedSkillKeys}
          histories={skillTimelines}
          period={skillPeriod}
          onPeriodChange={setSkillPeriod}
          error={skillTimelineError}
          isLoading={isSkillTimelineLoading}
        />
        <SkillHighlights
          names={names}
          skills={skillRows}
          strongest={strongest}
          isLoading={isComparisonLoading}
        />
      </section>

      <section className="skills-bottom-grid">
        <RecentSkillMomentum
          names={names}
          skills={skillRows}
          gains={skillGains}
          error={skillGainsError}
          isLoading={isSkillGainsLoading}
        />
        <SkillMilestones
          names={names}
          skills={skillRows}
          isLoading={isComparisonLoading}
        />
        <CategorySummary
          names={names}
          comparison={comparison}
          isLoading={isComparisonLoading}
        />
      </section>
    </div>
  );
}

function SkillSummaryCard({
  icon: Icon,
  label,
  value,
  accent,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent: "blue" | "green" | "split";
  children: ReactNode;
}) {
  return (
    <ComparisonKpiCard
      className="skill-summary-card"
      icon={<Icon size={18} />}
      label={label}
      tone={accent === "split" ? "slate" : accent}
    >
      <div className="skill-summary-card-body">
        <strong>{value}</strong>
        {children}
      </div>
    </ComparisonKpiCard>
  );
}

function SkillProgressChart({
  names,
  skills,
  selectedSkillKeys,
  onSkillChange,
  histories,
  period,
  onPeriodChange,
  error,
  isLoading,
}: {
  names: [string, string];
  skills: NonNullable<SkillsComparison>["skills"];
  selectedSkillKeys: string[];
  onSkillChange: (skillKeys: string[]) => void;
  histories: Record<string, SkillTimeline | null>;
  period: HistoryPeriod;
  onPeriodChange: (period: HistoryPeriod) => void;
  error: string | null;
  isLoading: boolean;
}) {
  const selectedSkills = selectedSkillKeys
    .map((key) => skills.find((skill) => skill.key === key))
    .filter((skill): skill is (typeof skills)[number] => skill !== undefined);
  const chartSeries = selectedSkills.map((skill) => ({
    skill,
    timeline: buildTimeline(histories[skill.key] ?? null),
  }));
  const max = Math.max(
    1,
    ...chartSeries.flatMap(({ timeline }) =>
      timeline.flatMap((item) => [item.a, item.b]),
    ),
  );
  const sampleTimeline =
    chartSeries.find(({ timeline }) => timeline.length)?.timeline ?? [];
  const chartData = sampleTimeline.map((item, index) => {
    const row: Record<string, number | string> = {
      index,
      label: new Date(item.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    };
    for (const { skill, timeline } of chartSeries) {
      row[`${skill.key}-left`] = timeline[index]?.a ?? 0;
      row[`${skill.key}-right`] = timeline[index]?.b ?? 0;
    }
    return row;
  });
  const chartTitle =
    selectedSkills.length === 1
      ? `${selectedSkills[0]?.name ?? "Skill"} XP gained over time`
      : `${selectedSkills.length} skills XP gained over time`;

  return (
    <article className="panel skill-progress-panel" aria-busy={isLoading}>
      <PanelHeader
        title={chartTitle}
        eyebrow="Live Wise Old Man timeline"
        action={
          <div className="skill-progress-actions">
            <SkillMultiSelect
              skills={skills}
              selectedSkillKeys={selectedSkillKeys}
              onChange={onSkillChange}
            />
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
          </div>
        }
      />
      <div className="progress-legend">
        <span>
          <i />
          {names[0]}
        </span>
        <span className="dashed">
          <i />
          {names[1]}
        </span>
        {selectedSkills.map((skill, index) => (
          <span
            className="skill-series-key"
            style={{ color: skillChartColors[index % skillChartColors.length] }}
            key={skill.key}
          >
            <OsrsSkillIcon name={skill.name} />
            {skill.name}
          </span>
        ))}
      </div>
      <div className="skill-progress-chart">
        <ResponsiveContainer
          height="100%"
          initialDimension={{ width: 520, height: 280 }}
          minHeight={0}
          minWidth={0}
          width="100%"
        >
          <LineChart
            data={chartData}
            margin={{ top: 12, right: 12, bottom: 4, left: 0 }}
          >
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
                String(name).endsWith("-left") ? names[0] : names[1],
              ]}
            />
            {chartSeries.flatMap(({ skill }, index) => {
              const color = skillChartColors[index % skillChartColors.length];
              return [
                <Line
                  dataKey={`${skill.key}-left`}
                  dot={false}
                  isAnimationActive={false}
                  key={`${skill.key}-left`}
                  stroke={color}
                  strokeWidth={2}
                  type="monotone"
                />,
                <Line
                  dataKey={`${skill.key}-right`}
                  dot={false}
                  isAnimationActive={false}
                  key={`${skill.key}-right`}
                  stroke={color}
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  type="monotone"
                />,
              ];
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-note">
        {error ?? "Selected skill XP sampled from Wise Old Man snapshots."}
      </p>
      <LoadingOverlay
        isLoading={isLoading}
        label="Loading selected skill timeline"
      />
    </article>
  );
}

const skillChartColors = [
  "#3975d5",
  "#2b9b66",
  "#c77b22",
  "#8a5fc7",
  "#c4516c",
  "#238a9b",
  "#8c7424",
  "#5b6f87",
];

function SkillMultiSelect({
  skills,
  selectedSkillKeys,
  onChange,
}: {
  skills: NonNullable<SkillsComparison>["skills"];
  selectedSkillKeys: string[];
  onChange: (skillKeys: string[]) => void;
}) {
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const toggleSkill = (skillKey: string) => {
    if (selectedSkillKeys.includes(skillKey)) {
      if (selectedSkillKeys.length === 1) return;
      onChange(selectedSkillKeys.filter((key) => key !== skillKey));
      return;
    }
    onChange([...selectedSkillKeys, skillKey]);
  };

  return (
    <fieldset
      className="skill-multi-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setIsOpen(false);
      }}
    >
      <button
        type="button"
        className={isOpen ? "active" : ""}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="skill-select-icons">
          {selectedSkillKeys.slice(0, 3).map((key) => {
            const skill = skills.find((item) => item.key === key);
            return skill ? <OsrsSkillIcon name={skill.name} key={key} /> : null;
          })}
        </span>
        <b className="skill-select-trigger-label">
          {selectedSkillKeys.length === 1
            ? (skills.find((skill) => skill.key === selectedSkillKeys[0])
                ?.name ?? "Choose skill")
            : `${selectedSkillKeys.length} skills`}
        </b>
        <ChevronDown size={11} />
      </button>
      {isOpen ? (
        <div className="skill-select-menu" id={listboxId} role="listbox">
          <span>Chart skills</span>
          <div>
            {skills.map((skill) => {
              const selected = selectedSkillKeys.includes(skill.key);
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? "selected" : ""}
                  onClick={() => toggleSkill(skill.key)}
                  key={skill.key}
                >
                  <OsrsSkillIcon name={skill.name} />
                  <b className="skill-select-option-label">{skill.name}</b>
                  <i>{selected ? <Check size={9} /> : null}</i>
                </button>
              );
            })}
          </div>
          <small>Select multiple skills to layer their XP gains.</small>
        </div>
      ) : null}
    </fieldset>
  );
}

function SkillHighlights({
  names,
  skills,
  strongest,
  isLoading,
}: {
  names: [string, string];
  skills: NonNullable<SkillsComparison>["skills"];
  strongest: NonNullable<SkillsComparison>["skills"][number] | null;
  isLoading: boolean;
}) {
  const comparableXp = skills.filter((skill) => skill.xp.delta !== null);
  const xpGaps = comparableXp.filter((skill) => skill.xp.delta !== 0);
  const levelGaps = skills.filter(
    (skill) => skill.level.delta !== null && skill.level.delta !== 0,
  );
  const ranked = [...xpGaps].sort(
    (left, right) =>
      Math.abs(right.xp.delta ?? 0) - Math.abs(left.xp.delta ?? 0),
  );
  const closest = comparableXp.reduce<(typeof skills)[number] | undefined>(
    (best, skill) =>
      !best || Math.abs(skill.xp.delta ?? 0) < Math.abs(best.xp.delta ?? 0)
        ? skill
        : best,
    undefined,
  );
  const biggestLevelGap = levelGaps.reduce<(typeof skills)[number] | undefined>(
    (best, skill) =>
      !best ||
      Math.abs(skill.level.delta ?? 0) > Math.abs(best.level.delta ?? 0)
        ? skill
        : best,
    undefined,
  );
  const items = [
    { label: "Strongest advantage", skill: strongest, icon: Trophy },
    { label: "Closest contest", skill: closest, icon: Target },
    { label: "Biggest level gap", skill: biggestLevelGap, icon: BarChart3 },
    { label: "Second-largest XP gap", skill: ranked[1], icon: Sparkles },
  ];
  return (
    <aside className="panel skills-highlights-panel" aria-busy={isLoading}>
      <PanelHeader title="Highlights" eyebrow="Current snapshot" />
      <div className="skills-highlight-list">
        {items.map(({ label, skill, icon: Icon }) => (
          <div className="skills-highlight-item" key={label}>
            <span
              className={`skills-highlight-icon ${skill?.xp.leader === "right" ? "green" : "blue"}`}
            >
              {skill ? <OsrsSkillIcon name={skill.name} /> : <Icon size={16} />}
            </span>
            <div>
              <small>{label}</small>
              <strong>{skill?.name ?? "Waiting for data"}</strong>
              <b
                className={
                  skill?.xp.leader === "right" ? "green-text" : "blue-text"
                }
              >
                {skill
                  ? `${skill.xp.leader === "tie" ? "Tied" : skill.xp.leader === "right" ? names[1] : names[0]} · ${formatDelta(Math.abs(skill.xp.delta ?? 0))} XP`
                  : "—"}
              </b>
            </div>
          </div>
        ))}
      </div>
      <LoadingOverlay isLoading={isLoading} label="Loading skill highlights" />
    </aside>
  );
}

function RecentSkillMomentum({
  names,
  skills,
  gains,
  error,
  isLoading,
}: {
  names: [string, string];
  skills: NonNullable<SkillsComparison>["skills"];
  gains: SkillGains | null;
  error: string | null;
  isLoading: boolean;
}) {
  const leftByKey = new Map(
    gains?.left.gains.map((gain) => [gain.key, gain.gained]) ?? [],
  );
  const rightByKey = new Map(
    gains?.right.gains.map((gain) => [gain.key, gain.gained]) ?? [],
  );
  const rows = skills
    .map((skill) => ({
      skill,
      left: leftByKey.get(skill.key) ?? null,
      right: rightByKey.get(skill.key) ?? null,
    }))
    .filter((row) => row.left !== null || row.right !== null)
    .sort(
      (left, right) =>
        Math.max(right.left ?? 0, right.right ?? 0) -
        Math.max(left.left ?? 0, left.right ?? 0),
    )
    .slice(0, 5);
  const max = Math.max(
    1,
    ...rows.flatMap((row) => [row.left ?? 0, row.right ?? 0]),
  );

  return (
    <article className="panel recent-momentum-panel" aria-busy={isLoading}>
      <PanelHeader title="Recent skill momentum" eyebrow="7 day XP profile" />
      <div className="recent-momentum-labels">
        <span />
        <span />
        <b className="blue-text">{names[0]}</b>
        <b className="green-text">{names[1]}</b>
      </div>
      {rows.map((row, index) => (
        <div className="recent-momentum-row" key={row.skill.key}>
          <span>{index + 1}</span>
          <strong>
            <OsrsSkillIcon name={row.skill.name} />
            {row.skill.name}
          </strong>
          <MomentumBar value={row.left} max={max} accent="blue" />
          <MomentumBar value={row.right} max={max} accent="green" />
        </div>
      ))}
      {error ? <p className="source-note">{error}</p> : null}
      {!error && gains && rows.length === 0 ? (
        <p className="source-note">No per-skill gains are available.</p>
      ) : null}
      <LoadingOverlay
        isLoading={isLoading}
        label="Loading recent skill gains"
      />
    </article>
  );
}

function MomentumBar({
  value,
  max,
  accent,
}: {
  value: number | null;
  max: number;
  accent: "blue" | "green";
}) {
  return (
    <div className={`momentum-value ${accent}-text`}>
      <i>
        <b
          className={`${accent}-bar`}
          style={{ width: `${value === null ? 0 : (value / max) * 100}%` }}
        />
      </i>
      <span>{value === null ? "—" : `+${formatCompact(value)}`}</span>
    </div>
  );
}

function SkillMilestones({
  names,
  skills,
  isLoading,
}: {
  names: [string, string];
  skills: NonNullable<SkillsComparison>["skills"];
  isLoading: boolean;
}) {
  const [mode, setMode] = useState<MilestoneMode>("next");
  const rows = [...skills]
    .sort(
      (left, right) =>
        Math.max(right.level.left ?? 0, right.level.right ?? 0) -
        Math.max(left.level.left ?? 0, left.level.right ?? 0),
    )
    .slice(0, 4);
  return (
    <article className="panel skill-milestones-panel" aria-busy={isLoading}>
      <PanelHeader
        title="Milestones & completion"
        eyebrow={
          mode === "next"
            ? "Progress toward next level"
            : mode === "99"
              ? "Progress toward level 99"
              : "Progress toward next major milestone"
        }
        action={
          <div className="segmented milestone-selector">
            {[
              ["next", "Next level"],
              ["99", "99 progress"],
              ["milestones", "Milestones"],
            ].map(([value, label]) => (
              <button
                type="button"
                className={mode === value ? "active" : ""}
                onClick={() => setMode(value as MilestoneMode)}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      <div className="milestone-head">
        <span />
        <b className="blue-text">{names[0]}</b>
        <b className="green-text">{names[1]}</b>
      </div>
      {rows.map((skill) => (
        <div className="milestone-row" key={skill.key}>
          <strong>
            <OsrsSkillIcon name={skill.name} />
            {skill.name}
            <small>
              {formatValue(virtualLevelForXp(skill.level.left, skill.xp.left))}{" "}
              /{" "}
              {formatValue(
                virtualLevelForXp(skill.level.right, skill.xp.right),
              )}
              {(skill.level.left ?? 0) >= 99 || (skill.level.right ?? 0) >= 99
                ? " virtual"
                : ""}
            </small>
          </strong>
          <MilestoneBar
            level={skill.level.left}
            xp={skill.xp.left}
            mode={mode}
            accent="blue"
          />
          <MilestoneBar
            level={skill.level.right}
            xp={skill.xp.right}
            mode={mode}
            accent="green"
          />
        </div>
      ))}
      <LoadingOverlay isLoading={isLoading} label="Loading skill milestones" />
    </article>
  );
}

function MilestoneBar({
  level,
  xp,
  mode,
  accent,
}: {
  level: number | null;
  xp: number | null;
  mode: MilestoneMode;
  accent: "blue" | "green";
}) {
  const currentLevel = virtualLevelForXp(level, xp);
  const currentXp = xp ?? 0;
  const targetLevel =
    mode === "99"
      ? 99
      : mode === "milestones"
        ? nextMajorMilestoneLevel(currentLevel)
        : Math.min(maxVirtualLevel, currentLevel + 1);
  const startXp = mode === "next" ? xpForLevel(currentLevel) : 0;
  const targetXp = xpForLevel(targetLevel);
  const progress =
    targetXp <= startXp
      ? 100
      : Math.min(100, ((currentXp - startXp) / (targetXp - startXp)) * 100);
  return (
    <div className="milestone-progress">
      <span>
        {formatCompact(currentXp)} / {formatCompact(targetXp)} XP
        <b>{progress.toFixed(1)}%</b>
      </span>
      <i>
        <b className={accent} style={{ width: `${Math.max(1, progress)}%` }} />
      </i>
    </div>
  );
}

function CompositionRow({
  name,
  accent,
  total,
  skills,
  side,
}: {
  name: string;
  accent: "blue" | "green";
  total: number | null;
  skills: NonNullable<SkillsComparison>["skills"];
  side: "left" | "right";
}) {
  const categoryTotals = skillCategoryNames.map((category) =>
    skills
      .filter((skill) => skillCategory(skill.name) === category)
      .reduce((sum, skill) => sum + (skill.xp[side] ?? 0), 0),
  );
  const visibleTotal =
    categoryTotals.reduce((sum, value) => sum + value, 0) || 1;
  return (
    <div className="composition-row">
      <div>
        <strong className={`${accent}-text`}>{name}</strong>
        <span>{formatValue(total)} XP</span>
      </div>
      <div className="composition-track">
        {categoryTotals.map((value, index) => {
          const category = skillCategoryNames[index] ?? "Other";
          return (
            <i
              className={category.toLowerCase()}
              style={{ width: `${(value / visibleTotal) * 100}%` }}
              key={category}
            />
          );
        })}
      </div>
    </div>
  );
}

function SkillsDetailTable({
  names,
  comparison,
  isLoading,
}: {
  names: [string, string];
  comparison: SkillsComparison | undefined;
  isLoading: boolean;
}) {
  const displayedNames: [string, string] = [
    comparison?.left.displayRsn ?? names[0],
    comparison?.right.displayRsn ?? names[1],
  ];
  const rows = [
    ...(comparison?.skills.filter((skill) => skill.key !== "skill.overall") ??
      []),
  ].sort(
    (left, right) =>
      skillCategoryOrder.indexOf(skillCategory(left.name)) -
      skillCategoryOrder.indexOf(skillCategory(right.name)),
  );
  return (
    <article className="panel skills-detail-panel" aria-busy={isLoading}>
      <PanelHeader
        title="Skill comparison"
        eyebrow="Levels and current XP"
        action={
          <span className="skills-table-badge">{rows.length} skills</span>
        }
      />
      <div className="table-scroll skills-detail-scroll">
        <table className="skills-detail-table">
          <thead>
            <tr>
              <th>Skill</th>
              <th className="blue-text">{displayedNames[0]}</th>
              <th className="green-text">{displayedNames[1]}</th>
              <th>Lvl Δ</th>
              <th>XP Δ</th>
              <th>Ahead</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((skill, index) => {
              const previousCategory =
                index > 0 ? skillCategory(rows[index - 1]?.name ?? "") : null;
              const category = skillCategory(skill.name);
              return (
                <SkillDetailRow
                  skill={skill}
                  category={category}
                  names={displayedNames}
                  showCategory={category !== previousCategory}
                  key={skill.key}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <LoadingOverlay isLoading={isLoading} label="Loading skill comparison" />
    </article>
  );
}

function SkillDetailRow({
  skill,
  category,
  names,
  showCategory,
}: {
  skill: NonNullable<SkillsComparison>["skills"][number];
  category: string;
  names: [string, string];
  showCategory: boolean;
}) {
  const winnerLabel = sideBadgeLabel(skill.xp.leader, names);
  return (
    <>
      {showCategory ? (
        <tr className="skill-category-row">
          <td colSpan={6}>{category}</td>
        </tr>
      ) : null}
      <tr>
        <td>
          <span className={`skill-icon ${category.toLowerCase()}`}>
            <OsrsSkillIcon name={skill.name} />
          </span>
          {skill.name}
        </td>
        <td>
          <strong className="blue-text">{formatValue(skill.level.left)}</strong>
          <small>{formatCompact(skill.xp.left)} XP</small>
        </td>
        <td>
          <strong className="green-text">
            {formatValue(skill.level.right)}
          </strong>
          <small>{formatCompact(skill.xp.right)} XP</small>
        </td>
        <td
          className={
            skill.level.leader === "right" ? "green-text" : "blue-text"
          }
        >
          {formatDelta(skill.level.delta)}
        </td>
        <td
          className={skill.xp.leader === "right" ? "green-text" : "blue-text"}
        >
          {skill.xp.delta === null
            ? "—"
            : `${(skill.xp.delta ?? 0) > 0 ? "+" : ""}${formatCompact(skill.xp.delta)}`}
        </td>
        <td>
          <span
            className={`winner ${skill.xp.leader === "right" ? "green" : "blue"}`}
          >
            {winnerLabel}
          </span>
        </td>
      </tr>
    </>
  );
}

function OsrsSkillIcon({
  name,
  className = "",
}: {
  name: string | undefined;
  className?: string;
}) {
  return (
    <img
      className={`osrs-skill-icon ${className}`}
      src={name ? (skillIconUrls[name] ?? skillsIconUrl) : skillsIconUrl}
      alt=""
    />
  );
}

function compactName(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toLocaleUpperCase() || "—"
  );
}

function sideBadgeLabel(
  side: PlayerSide | "tie" | "indeterminate" | null | undefined,
  names: [string, string],
) {
  if (side === "left") return compactName(names[0]);
  if (side === "right") return compactName(names[1]);
  return "—";
}

function CategorySummary({
  names,
  comparison,
  isLoading,
}: {
  names: [string, string];
  comparison: SkillsComparison | undefined;
  isLoading: boolean;
}) {
  const labels = names.map(compactName) as [string, string];
  const rows = skillCategoryOrder.map((category) => {
    const skills =
      comparison?.skills.filter(
        (skill) =>
          skill.key !== "skill.overall" &&
          skillCategory(skill.name) === category,
      ) ?? [];
    const left = skills.reduce((sum, skill) => sum + (skill.xp.left ?? 0), 0);
    const right = skills.reduce((sum, skill) => sum + (skill.xp.right ?? 0), 0);
    const leftLevels = skills
      .map((skill) => skill.level.left)
      .filter((level): level is number => level !== null);
    const rightLevels = skills
      .map((skill) => skill.level.right)
      .filter((level): level is number => level !== null);
    return {
      category,
      left,
      right,
      leftAverage:
        leftLevels.length > 0
          ? leftLevels.reduce((sum, level) => sum + level, 0) /
            leftLevels.length
          : 0,
      rightAverage:
        rightLevels.length > 0
          ? rightLevels.reduce((sum, level) => sum + level, 0) /
            rightLevels.length
          : 0,
    };
  });
  const overall = comparison?.skills.find(
    (skill) => skill.key === "skill.overall",
  );
  const totalRow = {
    category: "Total",
    left: overall?.xp.left ?? rows.reduce((sum, row) => sum + row.left, 0),
    right: overall?.xp.right ?? rows.reduce((sum, row) => sum + row.right, 0),
    leftAverage:
      (overall?.level.left ?? 0) /
      Math.max(
        1,
        comparison?.skills.filter((skill) => skill.key !== "skill.overall")
          .length ?? 1,
      ),
    rightAverage:
      (overall?.level.right ?? 0) /
      Math.max(
        1,
        comparison?.skills.filter((skill) => skill.key !== "skill.overall")
          .length ?? 1,
      ),
  };
  return (
    <article className="panel category-summary-panel" aria-busy={isLoading}>
      <PanelHeader
        title="Category summary"
        eyebrow="Combined XP and average level"
      />
      <div className="category-summary-head">
        <span>Category</span>
        <span className="blue-text">
          {labels[0]}
          <br />
          <small>Total XP / Avg lvl</small>
        </span>
        <span className="green-text">
          {labels[1]}
          <br />
          <small>Total XP / Avg lvl</small>
        </span>
        <span>XP diff</span>
        <span>Ahead</span>
      </div>
      {[...rows, totalRow].map((row) => (
        <div
          className={`category-summary-row ${row.category === "Total" ? "total" : ""}`}
          key={row.category}
        >
          <strong>{row.category}</strong>
          <span>
            {formatCompact(row.left)} / {row.leftAverage.toFixed(1)}
          </span>
          <span>
            {formatCompact(row.right)} / {row.rightAverage.toFixed(1)}
          </span>
          <span className={row.left >= row.right ? "blue-text" : "green-text"}>
            {formatCompactDelta(row.left - row.right)}
          </span>
          <b className={row.left > row.right ? "blue-text" : "green-text"}>
            {row.left === row.right
              ? "—"
              : row.left > row.right
                ? labels[0]
                : labels[1]}
          </b>
        </div>
      ))}
      <LoadingOverlay isLoading={isLoading} label="Loading category summary" />
    </article>
  );
}

function Topbar({
  onOpenNavigation,
  rsns,
  lookupHistory,
  onRsnChange,
  onCompare,
  onRefresh,
  isRefreshing,
  comparison,
  womStatus,
  runeProfileStatus,
}: {
  onOpenNavigation: () => void;
  rsns: [string, string];
  lookupHistory: string[];
  onRsnChange: (index: number, value: string) => void;
  onCompare: (event: FormEvent) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  comparison: SkillsComparison | undefined;
  womStatus: "live" | "delayed" | "off";
  runeProfileStatus: "live" | "delayed" | "off";
}) {
  return (
    <header className="topbar">
      <div className="mobile-command-bar">
        <button
          type="button"
          className="icon-button"
          aria-label="Open navigation"
          onClick={onOpenNavigation}
        >
          <Menu size={17} />
        </button>
        <div className="mobile-brand">
          <div className="brand-mark">
            <span />
            <span />
          </div>
          <strong>RuneRating</strong>
        </div>
        <div className="mobile-freshness">
          <i />
          2m
        </div>
      </div>
      <form className="search-cluster" onSubmit={onCompare}>
        <SearchField
          player={players[0]}
          value={rsns[0]}
          options={lookupHistory}
          onChange={(value) => onRsnChange(0, value)}
        />
        <div className="versus">VS</div>
        <SearchField
          player={players[1]}
          value={rsns[1]}
          options={lookupHistory}
          onChange={(value) => onRsnChange(1, value)}
        />
        <button type="submit" className="compare-button">
          Compare
          <ArrowRight size={15} />
        </button>
      </form>
      <div className="topbar-status">
        <div>
          <span className="eyebrow">Source health</span>
          <div className="health-row">
            <SourceChip label="Hiscores" status="live" />
            <SourceChip label="Wise Old Man" status={womStatus} />
            <SourceChip label="RuneProfile" status={runeProfileStatus} />
          </div>
        </div>
        <div className="refresh-copy">
          <Clock3 size={14} />
          <span>
            {comparison
              ? `Updated ${formatAge(Math.min(comparison.left.fetchedAt, comparison.right.fetchedAt))}`
              : "Waiting for snapshots"}
          </span>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Refresh data"
          onClick={onRefresh}
        >
          <RefreshCw size={15} className={isRefreshing ? "spin" : ""} />
        </button>
      </div>
    </header>
  );
}

function SearchField({
  player,
  value,
  options,
  onChange,
}: {
  player: Player;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedValue = value.trim().toLocaleLowerCase();
  const avatar = playerAvatar(value, player.accent);
  const suggestions = options
    .filter((option) => option.toLocaleLowerCase() !== normalizedValue)
    .filter(
      (option) =>
        normalizedValue.length === 0 ||
        option.toLocaleLowerCase().includes(normalizedValue),
    )
    .slice(0, 6);

  const selectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(
        (index) => (index - 1 + suggestions.length) % suggestions.length,
      );
    } else if (event.key === "Enter" && isOpen && suggestions[activeIndex]) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="search-combobox">
      <label className="search-field">
        <span
          className={`mini-avatar ${player.accent}`}
          style={avatar.style}
          aria-hidden="true"
        >
          {avatar.label}
        </span>
        <span className="search-content">
          <small>Player {player.id.toUpperCase()}</small>
          <input
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setActiveIndex(0);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
            onKeyDown={handleKeyDown}
            aria-label={`Player ${player.id.toUpperCase()} RSN`}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={isOpen}
            aria-activedescendant={
              isOpen && suggestions[activeIndex]
                ? `${listboxId}-${activeIndex}`
                : undefined
            }
            role="combobox"
            autoComplete="off"
            name={`player-${player.id}-rsn`}
            spellCheck={false}
          />
        </span>
        <ChevronDown size={15} />
      </label>
      {isOpen && suggestions.length > 0 ? (
        <div className="autocomplete-menu" id={listboxId} role="listbox">
          <span className="autocomplete-heading">
            <History size={11} />
            Recent lookups
          </span>
          {suggestions.map((suggestion, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "active" : ""}
              id={`${listboxId}-${index}`}
              key={suggestion}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(suggestion)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <History size={12} />
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SourceChip({
  label,
  status,
}: {
  label: string;
  status: "live" | "delayed" | "off";
}) {
  return (
    <span className={`source-chip ${status}`}>
      <i>{status === "live" ? <Check size={9} /> : <Clock3 size={9} />}</i>
      {label}
    </span>
  );
}

function PagePlaceholder({
  names,
  title,
  view,
}: {
  names: [string, string];
  title: string;
  view: AppView;
}) {
  return (
    <section className="placeholder-page">
      <PageHeader
        title={title}
        meta={<span>{comparisonPath(view, names)}</span>}
      />
      <div>
        <p>
          {title} is ready for a page worker to build against {names[0]} and{" "}
          {names[1]}. Keep provider fetches in Convex and reuse canonical read
          models.
        </p>
      </div>
      <code>{comparisonPath(view, names)}</code>
    </section>
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
          value={
            totalLevel === null || totalLevel === undefined
              ? "—"
              : fmt.format(totalLevel)
          }
          detail="Official Hiscores"
        />
        <Metric
          label="Total XP"
          value={
            totalXp === null || totalXp === undefined
              ? "—"
              : fmt.format(totalXp)
          }
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
              ? `${fmt.format(runeProfile.quests.earnedPoints)} / ${fmt.format(runeProfile.quests.totalPoints)}`
              : "—"
          }
          unavailable={runeProfileUnavailable}
        />
        <CompactMetric
          icon={Medal}
          label="Achievement diaries"
          value={
            runeProfile
              ? `${fmt.format(runeProfile.diaries.completed)} / ${fmt.format(runeProfile.diaries.total)}`
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

function PanelHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h3>{title}</h3>
      </div>
      {action}
    </div>
  );
}

function playerAvatar(name: string, accent: Player["accent"]) {
  const trimmed = name.trim();
  const label =
    trimmed.length > 0
      ? trimmed
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toLocaleUpperCase()
      : accent === "blue"
        ? "L"
        : "R";
  const hash = [...trimmed.toLocaleLowerCase()].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) % 360,
    accent === "blue" ? 212 : 139,
  );
  const secondary = (hash + 34 + (accent === "blue" ? 0 : 18)) % 360;
  const primary = `hsl(${hash} 76% 48%)`;
  const secondaryColor = `hsl(${secondary} 63% 36%)`;
  const soft = `hsl(${hash} 78% 95%)`;

  return {
    label,
    primary,
    secondary: secondaryColor,
    soft,
    style: {
      background: `linear-gradient(145deg, hsl(${hash} 76% 63%), ${secondaryColor})`,
    } as React.CSSProperties,
  };
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
            initialDimension={{ width: 620, height: 220 }}
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
            ? `${leader} leads by ${fmt.format(difference)} ${unit}`
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

function SkillsTable({
  names,
  comparison,
  isLoading,
}: {
  names: [string, string];
  comparison: SkillsComparison | undefined;
  isLoading: boolean;
}) {
  const skillRows =
    comparison?.skills.filter((skill) => skill.key !== "skill.overall") ?? [];
  const previewRows = skillRows
    .filter((skill) => skill.xp.delta !== null && skill.xp.delta !== 0)
    .sort(
      (left, right) =>
        Math.abs(right.xp.delta ?? 0) - Math.abs(left.xp.delta ?? 0),
    )
    .slice(0, 8);
  const rows = previewRows.length > 0 ? previewRows : skillRows.slice(0, 8);
  return (
    <article className="panel skills-panel" aria-busy={isLoading}>
      <PanelHeader
        title="Largest skill gaps"
        eyebrow="Hiscores · Overview preview"
        action={
          <Link to={comparisonPath("skills", names)} className="text-button">
            Full skills page
            <ArrowRight size={13} />
          </Link>
        }
      />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Skill</th>
              <th className="blue-text">
                {comparison?.left.displayRsn ?? names[0]}
              </th>
              <th>XP</th>
              <th className="green-text">
                {comparison?.right.displayRsn ?? names[1]}
              </th>
              <th>XP</th>
              <th>Δ Level</th>
              <th>Ahead</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((skill) => (
              <tr key={skill.name}>
                <td>
                  <span className="skill-icon">
                    <OsrsSkillIcon name={skill.name} />
                  </span>
                  {skill.name}
                </td>
                <td className="blue-text">{formatValue(skill.level.left)}</td>
                <td>{formatValue(skill.xp.left)}</td>
                <td className="green-text">{formatValue(skill.level.right)}</td>
                <td>{formatValue(skill.xp.right)}</td>
                <td
                  className={
                    skill.level.leader === "right" ? "green-text" : "blue-text"
                  }
                >
                  {formatDelta(skill.level.delta)}
                </td>
                <td>
                  <span
                    className={`winner ${skill.level.leader === "right" ? "green" : "blue"}`}
                  >
                    {sideBadgeLabel(skill.level.leader, names)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LoadingOverlay isLoading={isLoading} label="Loading skills" />
    </article>
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
          : `${questPointDelta > 0 ? names[0] : names[1]} leads by ${fmt.format(Math.abs(questPointDelta))} quest points.`,
    "Stronger combat profile":
      combatDelta === null
        ? null
        : combatDelta === 0
          ? "Both players have the same current combat level."
          : `${combatDelta > 0 ? names[0] : names[1]} leads by ${Math.abs(combatDelta).toFixed(1)} combat levels.`,
  };

  return (
    <article className="panel highlights-panel" aria-busy={isLoading}>
      <PanelHeader title="Comparison highlights" eyebrow="Generated summary" />
      <div className="highlight-list">
        {highlights.map(([Icon, title, fallbackCopy, accent]) => {
          const isRuneProfileHighlight = title === "Ahead in questing";
          const isUnavailable =
            isRuneProfileHighlight && unavailableMessage !== null;
          return (
            <div
              className={`highlight ${isUnavailable ? "highlight-unavailable" : ""}`}
              key={title}
            >
              <span className={`highlight-icon ${accent}`}>
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
          initialDimension={{ width: 280, height: 98 }}
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

function DataUnavailableOverlay({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="data-unavailable-overlay" role="status">
      <span>
        <Users size={16} />
      </span>
      <strong>RuneProfile data unavailable</strong>
      <p>{message}</p>
    </div>
  );
}

function LoadingOverlay({
  isLoading,
  label,
  full = false,
}: {
  isLoading: boolean;
  label: string;
  full?: boolean;
}) {
  if (!isLoading) return null;
  return (
    <div
      className={`loading-overlay ${full ? "full" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span>
        <RefreshCw size={15} />
      </span>
      <strong>{label}</strong>
    </div>
  );
}
