import { api } from "@rune-rating/backend/convex/_generated/api";
import { normalizeRsn } from "@rune-rating/domain";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowRight, Search, Swords, Trophy } from "lucide-react";
import { type FormEvent, memo, useEffect, useRef, useState } from "react";
import { capturePageView } from "./analytics";
import { AppHeader } from "./components/AppHeader";
import { FaultyTerminal } from "./components/FaultyTerminal";
import { fallbackCompareRsns, fallbackExampleRsn } from "./exampleRsns";
import { comparisonPath } from "./features/comparison/navigation";
import { formatAccountSummary } from "./features/ratingDisplay";

type RuneRatingResult = FunctionReturnType<typeof api.runeRating.get>;
type RuneRatingCard = Extract<RuneRatingResult, { status: "ready" }>["card"];

const featuredStats = [
  ["Dragon", "875+"],
  ["Rune", "775"],
  ["Adamant", "650"],
] as const;

const landingTerminalGrid: [number, number] = [2.4, 1.05];
const activeStatuses = new Set(["scheduled", "refreshing"]);
const featuredComparisonHref = comparisonPath("overview", fallbackCompareRsns);

function hasActiveRefresh(result: RuneRatingResult | undefined) {
  if (!result || !("sources" in result)) return false;
  if (!Array.isArray(result.sources)) return false;
  return result.sources.some((source) =>
    activeStatuses.has(source.status ?? ""),
  );
}

export function LandingPage() {
  useEffect(() => {
    capturePageView({ page: "landing" });
  }, []);

  return (
    <main className="landing-page">
      <AppHeader compareHref={featuredComparisonHref} />

      <div className="landing-shell" id="public-content" tabIndex={-1}>
        <section className="landing-stage" aria-labelledby="landing-title">
          <LandingBackground />

          <div className="landing-hero">
            <div className="landing-copy">
              <p className="rating-kicker">Old School RuneScape player stats</p>
              <h1 className="landing-title" id="landing-title">
                See the whole account.
              </h1>
              <p>Look up a player’s rating, stats, and account progress.</p>
            </div>

            <LandingSearch />

            <nav className="landing-actions" aria-label="Explore RuneRating">
              <Link className="landing-action-link" to="/leaderboard">
                <Trophy aria-hidden="true" size={16} />
                Leaderboard
                <ArrowRight aria-hidden="true" size={14} />
              </Link>
              <Link className="landing-action-link" to={featuredComparisonHref}>
                <Swords aria-hidden="true" size={16} />
                Compare players
                <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </nav>
          </div>

          <LandingPreview />
        </section>
      </div>
    </main>
  );
}

const LandingBackground = memo(function LandingBackground() {
  return (
    <div className="landing-background" aria-hidden="true">
      <FaultyTerminal
        scale={1.08}
        gridMul={landingTerminalGrid}
        digitSize={1.56}
        timeScale={0.16}
        scanlineIntensity={0.32}
        glitchAmount={0.46}
        flickerAmount={0.3}
        noiseAmp={0.52}
        chromaticAberration={0.18}
        dither={0.42}
        curvature={0.08}
        tint="#e7b957"
        mouseReact={false}
        dpr={0.68}
        maxFps={20}
        pageLoadAnimation={false}
        brightness={0.48}
      />
    </div>
  );
});

function LandingSearch() {
  const navigate = useNavigate();
  const [rsn, setRsn] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const normalizedRsn = normalizeRsn(rsn);
      setError(null);
      void navigate({
        to: "/rating",
        search: { rsn: normalizedRsn },
      });
    } catch {
      setError("Enter a valid RSN.");
    }
  };

  return (
    <form className="landing-search" onSubmit={handleSubmit}>
      <label htmlFor="landing-rsn">
        <strong className="landing-search-title">Look up a player</strong>
      </label>
      <div className="landing-search-row">
        <Search aria-hidden="true" size={18} />
        <input
          id="landing-rsn"
          value={rsn}
          onChange={(event) => {
            setRsn(event.target.value);
            if (error) setError(null);
          }}
          placeholder="RuneScape name"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit">
          <span>Rate player</span>
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </div>
      {error ? (
        <p className="landing-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function LandingPreview() {
  const exampleRsn = fallbackExampleRsn;
  const requestedRsns = useRef<Set<string> | null>(null);
  const requestRefresh = useMutation(api.refresh.request);
  const rating = useQuery(api.runeRating.get, { rsn: exampleRsn });
  const card = rating?.status === "ready" ? rating.card : null;

  useEffect(() => {
    if (rating?.status !== "notRequested") return;
    const key = exampleRsn.toLocaleLowerCase();
    requestedRsns.current ??= new Set<string>();
    if (requestedRsns.current.has(key)) return;
    requestedRsns.current.add(key);
    void requestRefresh({ rsns: [exampleRsn] }).catch(() => {
      // The preview remains optional; the main lookup is still available.
    });
  }, [rating?.status, requestRefresh]);

  let stateLabel: string | null = null;
  if (rating === undefined) {
    stateLabel = "Loading";
  } else if (
    rating.status !== "ready" &&
    (rating.status === "refreshing" || hasActiveRefresh(rating))
  ) {
    stateLabel = "Refreshing";
  }

  return (
    <aside className="landing-preview" aria-label="RuneRating preview">
      <div className="landing-preview-heading">
        <span className="landing-preview-label">Example player</span>
        {stateLabel ? (
          <strong className="landing-preview-state">{stateLabel}</strong>
        ) : null}
      </div>
      <div className="landing-rating-card">
        <div className="landing-rating-meta">
          <span className="landing-rating-label">RuneRating</span>
          <strong>{card?.tier ?? "Pending"}</strong>
        </div>
        {card ? (
          <LiveRatingCard card={card} />
        ) : (
          <PendingRatingCard rsn={exampleRsn} rating={rating} />
        )}
      </div>
      <div className="landing-tier-strip">
        {featuredStats.map(([tier, floor]) => (
          <div key={tier}>
            <span className="landing-tier-label">{tier}</span>
            <strong>{floor}</strong>
          </div>
        ))}
      </div>
    </aside>
  );
}

function LiveRatingCard({ card }: { card: RuneRatingCard }) {
  return (
    <>
      <div className="landing-score">
        <p>{card.score}</p>
        <span>/ 1,000</span>
      </div>
      <small>
        <strong>{card.displayRsn}</strong>
        <span>{formatAccountSummary(card.accountType, card.accountBuild)}</span>
        <span>{card.percentileLabel}</span>
      </small>
    </>
  );
}

function PendingRatingCard({
  rsn,
  rating,
}: {
  rsn: string;
  rating: RuneRatingResult | undefined;
}) {
  const message =
    rating?.status === "unavailable"
      ? rating.message
      : rating?.status === "refreshing"
        ? rating.message
        : "Loading rating.";

  return (
    <>
      <div className="landing-score">
        <p className="landing-rating-pending">--</p>
        <span>/ 1,000</span>
      </div>
      <small>
        <strong>{rsn}</strong>
        <span>{message}</span>
      </small>
    </>
  );
}
