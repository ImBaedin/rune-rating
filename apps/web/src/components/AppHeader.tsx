import { Link } from "@tanstack/react-router";
import brandMark from "../assets/brand/rune-rating.svg";
import { fallbackCompareRsns } from "../exampleRsns";
import { comparisonPath } from "../features/comparison/navigation";
import { MotionToggle } from "../features/decorativeMotion";

type AppHeaderProps = {
  active?: "compare" | "rating" | "leaderboard" | "achievements";
  ratingRsn?: string;
  contentId?: string;
  compareHref?: string;
};

export function AppHeader({
  active,
  ratingRsn,
  contentId = "public-content",
  compareHref = comparisonPath("overview", fallbackCompareRsns),
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <a className="skip-link" href={`#${contentId}`}>
        Skip to content
      </a>
      <div className="app-header-inner">
        <Link
          className="scoreboard-brand app-brand"
          to="/"
          aria-label="RuneRating home"
        >
          <img
            className="brand-mark"
            src={brandMark}
            width={30}
            height={30}
            alt=""
          />
          <strong>RuneRating</strong>
        </Link>

        <nav className="app-nav" aria-label="Primary navigation">
          <Link
            className="app-nav-link"
            to={compareHref}
            aria-current={active === "compare" ? "page" : undefined}
          >
            Compare
          </Link>
          <Link
            className="app-nav-link"
            to="/rating"
            search={{ rsn: ratingRsn }}
            aria-current={active === "rating" ? "page" : undefined}
          >
            Rating
          </Link>
          <Link
            className="app-nav-link"
            to="/leaderboard"
            aria-current={active === "leaderboard" ? "page" : undefined}
          >
            Leaderboard
          </Link>
          <Link
            className="app-nav-link"
            to="/achievements"
            aria-current={active === "achievements" ? "page" : undefined}
          >
            Achievements
          </Link>
        </nav>
        <MotionToggle />
      </div>
    </header>
  );
}
