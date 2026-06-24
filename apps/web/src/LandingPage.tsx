import { api } from "@rune-rating/backend/convex/_generated/api";
import { normalizeRsn } from "@rune-rating/domain";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowRight, Search, Swords } from "lucide-react";
import { type FormEvent, memo, useEffect, useRef, useState } from "react";
import { capturePageView } from "./analytics";
import { FaultyTerminal } from "./components/FaultyTerminal";
import {
  fallbackExampleRsn,
  randomCompareRsns,
  randomExampleRsn,
} from "./exampleRsns";
import { comparisonPath } from "./features/comparison/navigation";

type RuneRatingResult = FunctionReturnType<typeof api.runeRating.get>;
type RuneRatingCard = Extract<RuneRatingResult, { status: "ready" }>["card"];

const featuredStats = [
  ["Dragon", "875+"],
  ["Rune", "775"],
  ["Adamant", "650"],
] as const;

const landingTerminalGrid: [number, number] = [2.4, 1.05];
const activeStatuses = new Set(["scheduled", "refreshing"]);

function hasActiveRefresh(result: RuneRatingResult | undefined) {
  if (!result || !("sources" in result)) return false;
  if (!Array.isArray(result.sources)) return false;
  return result.sources.some((source) =>
    activeStatuses.has(source.status ?? ""),
  );
}

export function LandingPage() {
  const [compareHref] = useState(() =>
    comparisonPath("overview", randomCompareRsns()),
  );

  useEffect(() => {
    capturePageView({ page: "landing" });
  }, []);

  return (
    <main className="landing-page">
      <LandingBackground />
      <div className="landing-vignette" aria-hidden="true" />

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-brand">
          <span className="brand-mark landing-brand-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <strong>RuneRating</strong>
        </div>

        <div className="landing-copy">
          <p className="landing-kicker">Account signal / live snapshots</p>
          <h1 id="landing-title">RuneRating</h1>
          <p>
            Check the current shape of an OSRS account, then jump straight into
            the categories that move the score.
          </p>
        </div>

        <LandingSearch />

        <Link className="landing-compare" to={compareHref}>
          <Swords aria-hidden="true" size={17} />
          Compare players
        </Link>
      </section>

      <LandingPreview />
    </main>
  );
}

const LandingBackground = memo(function LandingBackground() {
  return (
    <div className="landing-background" aria-hidden="true">
      <FaultyTerminal
        scale={1.16}
        gridMul={landingTerminalGrid}
        digitSize={1.42}
        timeScale={0.22}
        scanlineIntensity={0.42}
        glitchAmount={0.74}
        flickerAmount={0.58}
        noiseAmp={0.86}
        chromaticAberration={0.9}
        dither={0.52}
        curvature={0.11}
        tint="#e6a375"
        mouseReact={false}
        dpr={0.72}
        maxFps={24}
        pageLoadAnimation={false}
        brightness={0.62}
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
      <label htmlFor="landing-rsn">Check your RuneRating</label>
      <div className="landing-search-row">
        <Search aria-hidden="true" size={18} />
        <input
          id="landing-rsn"
          value={rsn}
          onChange={(event) => {
            setRsn(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Search RSN"
          autoComplete="off"
        />
        <button type="submit" aria-label="Check RuneRating">
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </div>
      {error ? <p className="landing-error">{error}</p> : null}
    </form>
  );
}

function LandingPreview() {
  const [exampleRsn, setExampleRsn] = useState<string>(fallbackExampleRsn);
  const requestedRsns = useRef<Set<string> | null>(null);
  const requestRefresh = useMutation(api.refresh.request);
  const rating = useQuery(api.runeRating.get, { rsn: exampleRsn });
  const card = rating?.status === "ready" ? rating.card : null;

  useEffect(() => {
    setExampleRsn(randomExampleRsn());
  }, []);

  useEffect(() => {
    if (rating?.status !== "notRequested") return;
    const key = exampleRsn.toLocaleLowerCase();
    requestedRsns.current ??= new Set<string>();
    if (requestedRsns.current.has(key)) return;
    requestedRsns.current.add(key);
    void requestRefresh({ rsns: [exampleRsn] });
  }, [exampleRsn, rating?.status, requestRefresh]);

  const stateLabel =
    rating === undefined
      ? "Loading"
      : rating.status === "ready"
        ? "Live rating"
        : rating.status === "refreshing" || hasActiveRefresh(rating)
          ? "Refreshing"
          : "Live example";

  return (
    <aside className="landing-preview" aria-label="RuneRating preview">
      <div className="landing-rating-card">
        <div>
          <span>{stateLabel}</span>
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
            <span>{tier}</span>
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
      <p>{card.score}</p>
      <small>
        {card.displayRsn} / {card.accountBuild} / {card.percentileLabel}
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
        : "Fetching the current RuneRating snapshot.";

  return (
    <>
      <p className="landing-rating-pending">--</p>
      <small>
        {rsn} / {message}
      </small>
    </>
  );
}
