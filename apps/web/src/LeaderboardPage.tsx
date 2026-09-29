import { api } from "@rune-rating/backend/convex/_generated/api";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronDown, Info, Search, Shield, Trophy } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { capturePageView } from "./analytics";
import { AppHeader } from "./components/AppHeader";
import { SegmentedControl } from "./components/comparison-ui";
import { InfoPopover } from "./components/primitives/InfoPopover";
import { useDecorativeMotionPaused } from "./features/decorativeMotion";
import { leaderboardSearchInput } from "./features/leaderboardSearch";
import { formatAccountSummary } from "./features/ratingDisplay";
import {
  type LeaderboardFeaturedRank,
  leaderboardEffectSettingsForRank,
} from "./LeaderboardRowEffectSettings";
import { LeaderboardRowEffect } from "./LeaderboardTableEffects";
import { tierColorsFor, tierImage } from "./runeRatingAssets";

type LeaderboardPageResult = FunctionReturnType<typeof api.leaderboard.list>;
type LeaderboardEntry = LeaderboardPageResult["page"][number];

type AccountTypeFilter = {
  label: string;
  value: string | undefined;
};

const accountTypeFilters: AccountTypeFilter[] = [
  { label: "All", value: undefined },
  { label: "Regular", value: "normal" },
  { label: "Ironman", value: "ironman" },
  { label: "Hardcore", value: "hardcore_ironman" },
  { label: "Ultimate", value: "ultimate_ironman" },
  { label: "Group", value: "group_ironman" },
];
const allAccountTypes = accountTypeFilters[0] as AccountTypeFilter;

function compactNumber(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString("en-US");
}

function hours(value: number) {
  return value >= 1_000
    ? `${(value / 1_000).toFixed(1)}k`
    : Math.round(value).toLocaleString("en-US");
}

function percent(value: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function formatAge(timestamp: number) {
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hoursElapsed = Math.floor(minutes / 60);
  if (hoursElapsed < 24) return `${hoursElapsed}h ago`;
  return `${Math.floor(hoursElapsed / 24)}d ago`;
}

function ratingPath(entry: LeaderboardEntry) {
  return `/rating?rsn=${encodeURIComponent(entry.displayRsn)}`;
}

function accountSummary(entry: LeaderboardEntry) {
  return formatAccountSummary(entry.accountType, entry.accountBuild);
}

function rankText(entry: LeaderboardEntry) {
  return entry.leaderboardRank === null ? "-" : `#${entry.leaderboardRank}`;
}

function rankDetail(entry: LeaderboardEntry) {
  if (entry.leaderboardRank === null || entry.leaderboardRankedCount === 0) {
    return "Ranking pending";
  }
  return `${entry.leaderboardLabel} of ${entry.leaderboardRankedCount.toLocaleString("en-US")}`;
}

function featuredRankFor(rank: number): LeaderboardFeaturedRank | null {
  if (rank === 1 || rank === 2 || rank === 3) return rank;
  return null;
}

export function LeaderboardPage() {
  const motionPaused = useDecorativeMotionPaused();
  const [queryText, setQueryText] = useState("");
  const search = useSearch({ from: "/leaderboard" });
  const navigate = useNavigate({ from: "/leaderboard" });
  const activeFilter =
    accountTypeFilters.find((filter) => filter.value === search.account) ??
    allAccountTypes;
  const trimmedQuery = queryText.trim();
  const validatedSearch = leaderboardSearchInput(queryText);
  const listArgs =
    activeFilter.value === undefined
      ? {}
      : { accountTypeKey: activeFilter.value };
  const searchArgs = !validatedSearch.query
    ? ("skip" as const)
    : activeFilter.value === undefined
      ? { query: validatedSearch.query, limit: 25 }
      : {
          query: validatedSearch.query,
          limit: 25,
          accountTypeKey: activeFilter.value,
        };
  const leaderboard = usePaginatedQuery(api.leaderboard.list, listArgs, {
    initialNumItems: 25,
  });
  const profileCount = useQuery(api.leaderboard.totalProfiles, {});
  const searchResults = useQuery(api.leaderboard.search, searchArgs);

  useEffect(() => {
    capturePageView({
      page: "leaderboard",
      account_type_filter: activeFilter.value ?? "all",
    });
  }, [activeFilter.value]);

  const entries = trimmedQuery ? (searchResults ?? []) : leaderboard.results;
  const isLoading =
    trimmedQuery && !validatedSearch.error && searchResults === undefined
      ? true
      : !trimmedQuery && leaderboard.status === "LoadingFirstPage";
  const canLoadMore = !trimmedQuery && leaderboard.status === "CanLoadMore";
  const totalProfiles =
    profileCount?.totalProfiles ?? leaderboard.results.length;
  const showPodium = !trimmedQuery && activeFilter.value === undefined;
  const podiumEntries = showPodium ? entries.slice(0, 3) : [];
  const standingEntries = showPodium ? entries.slice(3) : entries;

  return (
    <main className={`leaderboard-page${motionPaused ? " motion-paused" : ""}`}>
      <AppHeader active="leaderboard" />

      <section className="leaderboard-shell" id="public-content" tabIndex={-1}>
        <header className="leaderboard-hero">
          <div>
            <h1>RuneRating leaderboard</h1>
            <p>Players ranked by RuneRating.</p>
          </div>
          <div className="leaderboard-hero-stat">
            <Trophy size={20} />
            <span>{totalProfiles.toLocaleString("en-US")}</span>
            <strong>Profiles rated</strong>
          </div>
        </header>

        <section
          className="leaderboard-controls"
          aria-label="Leaderboard controls"
        >
          <div className="leaderboard-search">
            <Search size={17} />
            <input
              value={queryText}
              aria-invalid={Boolean(validatedSearch.error)}
              aria-describedby={
                validatedSearch.error ? "leaderboard-search-error" : undefined
              }
              onChange={(event) => setQueryText(event.target.value)}
              aria-label="Search RSN"
              placeholder="Search RSN"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <SegmentedControl
            label="Account type"
            className="leaderboard-tabs"
            value={activeFilter.label}
            options={accountTypeFilters.map((filter) => [
              filter.label,
              filter.label,
            ])}
            onChange={(value) => {
              const filter = accountTypeFilters.find(
                (filter) => filter.label === value,
              );
              if (filter) void navigate({ search: { account: filter.value } });
            }}
          />
        </section>

        {validatedSearch.error ? (
          <p id="leaderboard-search-error" role="status">
            {validatedSearch.error}
          </p>
        ) : null}

        {showPodium && podiumEntries.length > 0 ? (
          <section
            className="leaderboard-podium"
            aria-labelledby="podium-title"
          >
            <div className="leaderboard-section-heading">
              <div>
                <span id="podium-title">Top three</span>
              </div>
              <small>Live global rank</small>
            </div>
            <div className="leaderboard-podium-grid">
              {podiumEntries.map((entry, index) => (
                <LeaderboardPodiumCard
                  entry={entry}
                  fallbackRank={index + 1}
                  key={entry._id}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section
          className="leaderboard-panel"
          aria-labelledby="leaderboard-title"
        >
          <div className="leaderboard-panel-heading">
            <div>
              <span id={showPodium ? "leaderboard-title" : undefined}>
                {trimmedQuery ? "Search results" : "Standings"}
              </span>
              {!showPodium ? (
                <h2 id="leaderboard-title">{activeFilter.label} RuneRating</h2>
              ) : null}
            </div>
            {trimmedQuery ? (
              <small>
                {entries.length} matches for "{trimmedQuery}"
              </small>
            ) : (
              <small>Sorted by score</small>
            )}
          </div>

          <div className="leaderboard-ledger-head" aria-hidden="true">
            <span>Rank</span>
            <span>Player</span>
            <span>Rating</span>
            <span>Account</span>
            <span>Total / XP</span>
            <span>Collection</span>
            <span>Efficiency</span>
            <span>Updated</span>
          </div>
          <ol className="leaderboard-ledger">
            {standingEntries.map((entry, index) => (
              <LeaderboardStanding
                entry={entry}
                key={entry._id}
                fallbackRank={index + 1 + (showPodium ? 3 : 0)}
              />
            ))}
          </ol>
          <div className="leaderboard-table-wrap">
            {isLoading ? <EmptyState label="Loading leaderboard data" /> : null}
            {!isLoading && !validatedSearch.error && entries.length === 0 ? (
              <EmptyState label="No matching rated profiles yet" />
            ) : null}
            {!isLoading &&
            entries.length > 0 &&
            standingEntries.length === 0 ? (
              <EmptyState label="All rated players are shown above" />
            ) : null}
          </div>

          {canLoadMore ? (
            <button
              className="leaderboard-load-more"
              type="button"
              onClick={() => leaderboard.loadMore(25)}
            >
              <ChevronDown size={17} />
              Load more
            </button>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function LeaderboardPodiumCard({
  entry,
  fallbackRank,
}: {
  entry: LeaderboardEntry;
  fallbackRank: number;
}) {
  const colors = tierColorsFor(entry.tier);
  const shownEhp = entry.adjustedEhp ?? entry.ehp;
  const rowRank = entry.leaderboardRank ?? fallbackRank;
  const featuredSlot = featuredRankFor(fallbackRank) ?? 3;
  const effectSettings = leaderboardEffectSettingsForRank(featuredSlot);
  return (
    <article
      className={`leaderboard-podium-card leaderboard-podium-card-${featuredSlot}`}
      style={
        {
          "--tier-base": colors.base,
          "--tier-light": colors.light,
        } as CSSProperties
      }
    >
      <LeaderboardRowEffect
        rank={featuredSlot}
        settings={effectSettings}
        tierColor={colors.light}
      />
      <div className="leaderboard-podium-shimmer" aria-hidden="true" />
      <Link className="leaderboard-podium-link" to={ratingPath(entry)}>
        <div className="leaderboard-podium-topline">
          <span>Global rank</span>
          <strong>#{rowRank}</strong>
        </div>
        <div className="leaderboard-podium-player">
          <img src={tierImage(entry.tier)} width={512} height={512} alt="" />
          <div>
            <span>{entry.tier} tier</span>
            <h3>{entry.displayRsn}</h3>
            <p>{accountSummary(entry)}</p>
          </div>
        </div>
        <div className="leaderboard-podium-score">
          <span>RuneRating</span>
          <strong>{entry.score}</strong>
        </div>
        <div className="leaderboard-podium-stats">
          <span>
            <small>Total</small>
            <strong>
              <span className="sr-only">Total level </span>
              {entry.totalLevel.toLocaleString("en-US")}
            </strong>
          </span>
          <span>
            <small>Collection</small>
            <strong>
              {percent(entry.collectionObtained, entry.collectionTotal)}
            </strong>
          </span>
          <span>
            <small>EHP</small>
            <strong>{hours(shownEhp)}</strong>
          </span>
        </div>
      </Link>
    </article>
  );
}

function LeaderboardStanding({
  entry,
  fallbackRank,
}: {
  entry: LeaderboardEntry;
  fallbackRank: number;
}) {
  const colors = tierColorsFor(entry.tier);
  const shownEhp = entry.adjustedEhp ?? entry.ehp;
  const shownEhb = entry.adjustedEhb ?? entry.ehb;
  return (
    <li
      className="leaderboard-standing"
      style={
        {
          "--tier-base": colors.base,
          "--tier-light": colors.light,
        } as CSSProperties
      }
    >
      <span className="leaderboard-rank">
        <span className="sr-only">Rank </span>
        {entry.leaderboardRank === null ? `#${fallbackRank}` : rankText(entry)}
      </span>
      <Link className="leaderboard-player" to={ratingPath(entry)}>
        <img src={tierImage(entry.tier)} width={512} height={512} alt="" />
        <span>
          <strong>{entry.displayRsn}</strong>
          <small>
            {entry.tier} · {rankDetail(entry)}
          </small>
        </span>
      </Link>
      <strong className="leaderboard-score">
        <span className="sr-only">RuneRating </span>
        {entry.score}
      </strong>
      <span className="leaderboard-build">
        <Shield size={13} />
        {accountSummary(entry)}
      </span>
      <span className="leaderboard-dual-stat">
        <strong>
          <span className="sr-only">Total level </span>
          {entry.totalLevel.toLocaleString("en-US")}
        </strong>
        <small>{compactNumber(entry.totalXp)} XP</small>
      </span>
      <span>
        <span className="leaderboard-mobile-label">Collection </span>
        <span className="sr-only leaderboard-desktop-label">Collection </span>
        {percent(entry.collectionObtained, entry.collectionTotal)}
      </span>
      <span className="leaderboard-dual-stat">
        <span className="leaderboard-efficiency-value">
          <strong>{hours(shownEhp)} EHP</strong>
          {entry.adjustedEhp !== null ? (
            <AdjustedEfficiencyInfo metric="EHP" />
          ) : null}
        </span>
        <span className="leaderboard-efficiency-value">
          <small>{hours(shownEhb)} EHB</small>
          {entry.adjustedEhb !== null ? (
            <AdjustedEfficiencyInfo metric="EHB" />
          ) : null}
        </span>
      </span>
      <span className="leaderboard-updated">
        <span className="sr-only">Updated </span>
        {formatAge(entry.fetchedAt)}
      </span>
    </li>
  );
}

function AdjustedEfficiencyInfo({ metric }: { metric: "EHP" | "EHB" }) {
  return (
    <InfoPopover
      trigger={<Info size={13} />}
      className="leaderboard-efficiency-info"
      label={`${metric} is adjusted for group players`}
      title={`Adjusted ${metric}`}
    >
      Group player efficiency is adjusted with Wise Old Man ironman rates before
      ranking, so shared group progress is compared against an ironman baseline.
    </InfoPopover>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="leaderboard-empty" role="status">
      <Trophy size={22} />
      <span>{label}</span>
    </div>
  );
}
