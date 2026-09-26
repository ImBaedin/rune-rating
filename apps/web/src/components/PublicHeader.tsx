import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { fallbackCompareRsns } from "../exampleRsns";
import { comparisonPath } from "../features/comparison/navigation";
import { MotionToggle } from "../features/decorativeMotion";

type PublicHeaderProps = {
  active?: "rating" | "leaderboard";
  compareHref?: string;
};

export function PublicHeader({
  active,
  compareHref = comparisonPath("overview", fallbackCompareRsns),
}: PublicHeaderProps) {
  return (
    <header className="public-header">
      <a className="skip-link" href="#public-content">
        Skip to content
      </a>
      <div className="public-header-inner">
        <Link
          className="scoreboard-brand public-brand"
          to="/"
          aria-label="RuneRating home"
        >
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <strong>RuneRating</strong>
        </Link>

        <nav className="public-nav" aria-label="Primary navigation">
          <Link
            className="public-nav-link"
            to="/rating"
            search={{ rsn: undefined }}
            aria-current={active === "rating" ? "page" : undefined}
          >
            Rating
          </Link>
          <Link
            className="public-nav-link"
            to="/leaderboard"
            aria-current={active === "leaderboard" ? "page" : undefined}
          >
            Leaderboard
          </Link>
          <Link className="public-compare-link" to={compareHref}>
            Compare
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          <MotionToggle />
        </nav>
      </div>
    </header>
  );
}
