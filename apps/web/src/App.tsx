import { api } from "@rune-rating/backend/convex/_generated/api";
import { normalizeRsn } from "@rune-rating/domain";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ageBucket,
  captureAnalytics,
  capturePageView,
  hashRsnPair,
} from "./analytics";
import { Sidebar } from "./features/comparison/components/Sidebar";
import { Topbar } from "./features/comparison/components/Topbar";
import {
  ComparisonShellContext,
  type ComparisonShellContextValue,
  type HistoryPeriod,
  type OverviewHistory,
  type PlayerProfile,
  type SkillsComparison,
} from "./features/comparison/context";
import {
  addToLookupHistory,
  lookupHistoryKey,
  readLookupHistory,
} from "./features/comparison/lookupHistory";
import {
  comparisonPath,
  viewFromPathname,
} from "./features/comparison/navigation";
import { playerAvatar } from "./features/comparison/playerIdentity";

const activeRefreshStatuses = new Set(["scheduled", "refreshing"]);
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
  const displayRsns: [string, string] = [
    leftProfile?.displayRsn ?? rsns[0],
    rightProfile?.displayRsn ?? rsns[1],
  ];
  const leftTheme = playerAvatar(displayRsns[0], "blue");
  const rightTheme = playerAvatar(displayRsns[1], "green");
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
          displayRsns={displayRsns}
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
