import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRight, Clock3, RefreshCw, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useRef } from "react";
import { formatAge } from "../formatters";
import { type AppView, navGroups, navViewByLabel } from "../navigation";
import { PlayerSearchCombobox } from "./PlayerSearchCombobox";
import { ShellSourceChip } from "./ShellSourceChip";

const playerSides = [
  { id: "a", accent: "blue" },
  { id: "b", accent: "green" },
] as const;

type ComparisonHeaderProps = {
  skillCount: number | null;
  primaryRsn: string;
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
  primaryRsn,
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
    <header className="comparison-header">
      <a className="skip-link" href="#main-content">
        Skip to comparison
      </a>

      <div className="comparison-header-main">
        <Link className="scoreboard-brand" to="/" aria-label="RuneRating home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <strong>RuneRating</strong>
        </Link>

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
          <fieldset className="header-sources" aria-label="Data source health">
            <ShellSourceChip
              label="Hiscores"
              status={hiscoresStatus}
              detail={hiscoresDetail}
            />
            <ShellSourceChip
              label="Wise Old Man"
              status={womStatus}
              detail={womDetail}
            />
            <ShellSourceChip
              label="RuneProfile"
              status={runeProfileStatus}
              detail={runeProfileDetail}
            />
          </fieldset>
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
        <Link
          to="/rating"
          search={{ rsn: primaryRsn }}
          className="rating-shortcut"
        >
          <Sparkles size={14} aria-hidden="true" />
          <span>Rating</span>
        </Link>
      </div>
    </header>
  );
}
