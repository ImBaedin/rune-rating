import { ArrowRight, Clock3, Menu, RefreshCw } from "lucide-react";
import type { FormEvent } from "react";
import { formatAge } from "../formatters";
import { PlayerSearchCombobox } from "./PlayerSearchCombobox";
import { ShellSourceChip } from "./ShellSourceChip";

const playerSides = [
  { id: "a", accent: "blue" },
  { id: "b", accent: "green" },
] as const;

export function Topbar({
  onOpenNavigation,
  rsns,
  displayRsns,
  lookupHistory,
  onRsnChange,
  onCompare,
  onRefresh,
  isRefreshing,
  comparison,
  womStatus,
  runeProfileStatus,
  womDetail,
  runeProfileDetail,
}: {
  onOpenNavigation: () => void;
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
  womStatus: "live" | "delayed" | "off";
  runeProfileStatus: "live" | "delayed" | "off";
  womDetail: string | null;
  runeProfileDetail: string | null;
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
        <PlayerSearchCombobox
          side={playerSides[0]}
          value={rsns[0]}
          displayValue={displayRsns[0]}
          options={lookupHistory}
          onChange={(value) => onRsnChange(0, value)}
        />
        <div className="versus">VS</div>
        <PlayerSearchCombobox
          side={playerSides[1]}
          value={rsns[1]}
          displayValue={displayRsns[1]}
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
            <ShellSourceChip label="Hiscores" status="live" />
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
