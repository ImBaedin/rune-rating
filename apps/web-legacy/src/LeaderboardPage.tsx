import { Popover } from "@base-ui-components/react/popover";
import { api } from "@rune-rating/backend/convex/_generated/api";
import { Link } from "@tanstack/react-router";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronDown, Info, Search, Shield, Trophy } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { capturePageView } from "./analytics";
import {
  formatAccountBuild,
  formatAccountType,
} from "./features/ratingDisplay";
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
  { label: "Regular", value: "regular" },
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
  const accountType = formatAccountType(entry.accountType);
  const build = entry.accountBuild.trim();
  if (!build || build.toLocaleLowerCase() === "main") return accountType;
  return `${accountType} / ${formatAccountBuild(build)}`;
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
  const [queryText, setQueryText] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<AccountTypeFilter>(allAccountTypes);
  const trimmedQuery = queryText.trim();
  const listArgs =
    activeFilter.value === undefined
      ? {}
      : { accountTypeKey: activeFilter.value };
  const searchArgs = !trimmedQuery
    ? ("skip" as const)
    : activeFilter.value === undefined
      ? { query: trimmedQuery, limit: 25 }
      : {
          query: trimmedQuery,
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
    trimmedQuery && searchResults === undefined
      ? true
      : !trimmedQuery && leaderboard.status === "LoadingFirstPage";
  const canLoadMore = !trimmedQuery && leaderboard.status === "CanLoadMore";
  const totalProfiles =
    profileCount?.totalProfiles ?? leaderboard.results.length;

  return (
    <main className="leaderboard-page">
      <section className="leaderboard-toolbar">
        <Link className="rating-brand-link" to="/">
          <span className="brand-mark rating-brand-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <span>RuneRating</span>
        </Link>
        <div className="rating-toolbar-actions">
          <a className="rating-nav-link" href="/rating">
            Rating card
          </a>
        </div>
      </section>

      <section className="leaderboard-shell">
        <header className="leaderboard-hero">
          <div>
            <p className="rating-kicker">Live ratings / Formula v1</p>
            <h1>Leaderboard</h1>
          </div>
          <div className="leaderboard-hero-stat">
            <Trophy size={20} />
            <span>{totalProfiles.toLocaleString("en-US")}</span>
            <strong>rated profiles</strong>
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
              onChange={(event) => setQueryText(event.target.value)}
              aria-label="Search RSN"
              placeholder="Search RSN"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <fieldset className="leaderboard-tabs">
            <legend className="sr-only">Account type</legend>
            {accountTypeFilters.map((filter) => (
              <button
                type="button"
                className={filter.value === activeFilter.value ? "active" : ""}
                key={filter.label}
                onClick={() => setActiveFilter(filter)}
              >
                {filter.label}
              </button>
            ))}
          </fieldset>
        </section>

        <section
          className="leaderboard-panel"
          aria-labelledby="leaderboard-title"
        >
          <div className="leaderboard-panel-heading">
            <div>
              <span>{trimmedQuery ? "Search results" : "Global rank"}</span>
              <strong id="leaderboard-title">
                {activeFilter.label} RuneRating
              </strong>
            </div>
            {trimmedQuery ? (
              <small>
                {entries.length} matches for "{trimmedQuery}"
              </small>
            ) : (
              <small>Sorted by score</small>
            )}
          </div>

          <div className="leaderboard-table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Score</th>
                  <th>Tier</th>
                  <th>Account</th>
                  <th>Total</th>
                  <th>XP</th>
                  <th>Collection</th>
                  <th>EHP</th>
                  <th>EHB</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <LeaderboardRow
                    entry={entry}
                    key={entry._id}
                    fallbackRank={index + 1}
                  />
                ))}
              </tbody>
            </table>
            {isLoading ? <EmptyState label="Loading leaderboard data" /> : null}
            {!isLoading && entries.length === 0 ? (
              <EmptyState label="No matching rated profiles yet" />
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

function LeaderboardRow({
  entry,
  fallbackRank,
}: {
  entry: LeaderboardEntry;
  fallbackRank: number;
}) {
  const colors = tierColorsFor(entry.tier);
  const shownEhp = entry.adjustedEhp ?? entry.ehp;
  const shownEhb = entry.adjustedEhb ?? entry.ehb;
  const rowRank = entry.leaderboardRank ?? fallbackRank;
  const featuredRank = featuredRankFor(rowRank);
  const featuredSlot =
    featuredRank === null
      ? null
      : (featuredRankFor(fallbackRank) ?? featuredRank);
  const effectSettings =
    featuredSlot === null
      ? null
      : leaderboardEffectSettingsForRank(featuredSlot);
  return (
    <tr
      className={
        featuredRank === null
          ? undefined
          : `leaderboard-row-featured leaderboard-row-featured-${featuredRank}`
      }
      data-featured-rank={featuredRank ?? undefined}
      style={
        {
          "--tier-base": colors.base,
          "--tier-light": colors.light,
        } as CSSProperties
      }
    >
      <td>
        {featuredSlot !== null && effectSettings !== null ? (
          <LeaderboardRowEffect
            rank={featuredSlot}
            settings={effectSettings}
            tierColor={colors.light}
          />
        ) : null}
        <span className="leaderboard-rank">
          {entry.leaderboardRank === null
            ? `#${fallbackRank}`
            : rankText(entry)}
        </span>
      </td>
      <td>
        <a className="leaderboard-player" href={ratingPath(entry)}>
          <img src={tierImage(entry.tier)} alt="" />
          <span>
            <strong>{entry.displayRsn}</strong>
            <small>{rankDetail(entry)}</small>
          </span>
        </a>
      </td>
      <td>
        <strong className="leaderboard-score">{entry.score}</strong>
      </td>
      <td>
        <span className="leaderboard-tier">{entry.tier}</span>
      </td>
      <td>
        <span className="leaderboard-build">
          <Shield size={13} />
          {accountSummary(entry)}
        </span>
      </td>
      <td>{entry.totalLevel.toLocaleString("en-US")}</td>
      <td>{compactNumber(entry.totalXp)}</td>
      <td>{percent(entry.collectionObtained, entry.collectionTotal)}</td>
      <td>
        <span className="leaderboard-efficiency-value">
          {hours(shownEhp)}
          {entry.adjustedEhp !== null ? (
            <AdjustedEfficiencyInfo metric="EHP" />
          ) : null}
        </span>
      </td>
      <td>
        <span className="leaderboard-efficiency-value">
          {hours(shownEhb)}
          {entry.adjustedEhb !== null ? (
            <AdjustedEfficiencyInfo metric="EHB" />
          ) : null}
        </span>
      </td>
      <td>{formatAge(entry.fetchedAt)}</td>
    </tr>
  );
}

function AdjustedEfficiencyInfo({ metric }: { metric: "EHP" | "EHB" }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className="leaderboard-efficiency-info"
        aria-label={`${metric} is adjusted for group players`}
        openOnHover
        delay={0}
        closeDelay={120}
      >
        <Info size={13} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="center" sideOffset={8}>
          <Popover.Popup className="leaderboard-efficiency-popover">
            <Popover.Title className="leaderboard-efficiency-popover-title">
              Adjusted {metric}
            </Popover.Title>
            <Popover.Description className="leaderboard-efficiency-popover-copy">
              Group player efficiency is adjusted with Wise Old Man ironman
              rates before ranking, so shared group progress is compared against
              an ironman baseline.
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="leaderboard-empty">
      <Trophy size={22} />
      <span>{label}</span>
    </div>
  );
}
