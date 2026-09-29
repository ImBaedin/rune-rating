import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRight, Clock3, Database, RefreshCw } from "lucide-react";
import { type FormEvent, useEffect, useRef } from "react";
import { InfoPopover } from "../../../components/primitives/InfoPopover";
import { formatAge } from "../formatters";
import { type AppView, navGroups, navViewByLabel } from "../navigation";
import { PlayerSearchCombobox } from "./PlayerSearchCombobox";

const sourceStatusLabels = {
  live: "Live",
  delayed: "Delayed",
  off: "Unavailable",
};

const playerSides = [
  { id: "a", accent: "blue" },
  { id: "b", accent: "green" },
] as const;

type ComparisonHeaderProps = {
  skillCount: number | null;
  getPath: (view: AppView) => string;
  rsns: [string, string];
  displayRsns: [string, string];
  lookupHistory: string[];
  onRsnChange: (index: number, value: string) => void;
  onCompare: (event: FormEvent) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  comparison:
    | {
        left: { fetchedAt: number };
        right: { fetchedAt: number };
      }
    | null
    | undefined;
  hiscoresStatus: "live" | "delayed" | "off";
  hiscoresDetail: string;
  womStatus: "live" | "delayed" | "off";
  runeProfileStatus: "live" | "delayed" | "off";
  womDetail: string | null;
  runeProfileDetail: string | null;
};

export function ComparisonHeader({
  skillCount,
  getPath,
  rsns,
  displayRsns,
  lookupHistory,
  onRsnChange,
  onCompare,
  onRefresh,
  isRefreshing,
  comparison,
  hiscoresStatus,
  hiscoresDetail,
  womStatus,
  runeProfileStatus,
  womDetail,
  runeProfileDetail,
}: ComparisonHeaderProps) {
  const sources = [
    { label: "Hiscores", status: hiscoresStatus, detail: hiscoresDetail },
    { label: "Wise Old Man", status: womStatus, detail: womDetail },
    {
      label: "RuneProfile",
      status: runeProfileStatus,
      detail: runeProfileDetail,
    },
  ];
  const liveSourceCount = sources.filter(
    (source) => source.status === "live",
  ).length;
  const navItems = navGroups.flatMap((group) => group.items);
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation || pathname.length === 0) return;

    const centerCurrentLink = () => {
      const currentLink = navigation.querySelector<HTMLElement>(
        '[aria-current="page"]',
      );
      if (currentLink && navigation.scrollWidth > navigation.clientWidth) {
        navigation.scrollTo({
          behavior: "auto",
          left:
            currentLink.offsetLeft -
            (navigation.clientWidth - currentLink.offsetWidth) / 2,
        });
      }
    };

    centerCurrentLink();
    const observer = new ResizeObserver(centerCurrentLink);
    observer.observe(navigation);
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <div className="comparison-header">
      <div className="comparison-header-main">
        <form className="matchup-editor" onSubmit={onCompare}>
          <PlayerSearchCombobox
            side={playerSides[0]}
            value={rsns[0]}
            displayValue={displayRsns[0]}
            options={lookupHistory}
            onChange={(value) => onRsnChange(0, value)}
          />
          <span className="versus" aria-hidden="true">
            vs
          </span>
          <PlayerSearchCombobox
            side={playerSides[1]}
            value={rsns[1]}
            displayValue={displayRsns[1]}
            options={lookupHistory}
            onChange={(value) => onRsnChange(1, value)}
          />
          <button type="submit" className="compare-button">
            <span>Change</span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </form>

        <div className="header-operations">
          <InfoPopover
            className="header-sources-pill"
            label={`Data sources: ${liveSourceCount} of 3 live`}
            title="Data sources"
            trigger={
              <>
                <Database size={13} aria-hidden="true" />
                <span>Sources</span>
                <span
                  className={
                    liveSourceCount === 3
                      ? "source-count live"
                      : "source-count delayed"
                  }
                >
                  {liveSourceCount}/3
                </span>
              </>
            }
          >
            <span className="header-source-list">
              {sources.map(({ label, status, detail }) => (
                <span className="header-source-row" key={label}>
                  <span className="header-source-heading">
                    <strong>{label}</strong>
                    <span className={`header-source-status ${status}`}>
                      {sourceStatusLabels[status]}
                    </span>
                  </span>
                  {detail && <span>{detail}</span>}
                </span>
              ))}
            </span>
          </InfoPopover>
          <span className="snapshot-age">
            <Clock3 size={13} aria-hidden="true" />
            {comparison
              ? formatAge(
                  Math.min(
                    comparison.left.fetchedAt,
                    comparison.right.fetchedAt,
                  ),
                )
              : "waiting"}
          </span>
          <button
            type="button"
            className="header-icon-button"
            aria-label="Refresh comparison data"
            onClick={onRefresh}
          >
            <RefreshCw
              size={15}
              className={isRefreshing ? "spin" : ""}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <div className="comparison-nav-wrap">
        <nav
          className="comparison-nav"
          aria-label="Comparison categories"
          ref={navigationRef}
        >
          {navItems.map(([label, Icon]) => {
            const view = navViewByLabel[label];
            if (!view) return null;
            return (
              <Link
                to={getPath(view)}
                activeOptions={{ exact: true }}
                className="comparison-nav-link"
                aria-label={
                  view === "skills"
                    ? `Skills, ${skillCount ?? "unknown"} metrics`
                    : undefined
                }
                key={label}
              >
                <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
                {view === "skills" && (
                  <small aria-hidden="true">{skillCount ?? "—"}</small>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
