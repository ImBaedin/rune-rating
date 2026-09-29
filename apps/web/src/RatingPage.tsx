import { api } from "@rune-rating/backend/convex/_generated/api";
import { normalizeRsn, rsnLookupKey } from "@rune-rating/domain";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Share2,
  Shield,
  Sparkles,
} from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ageBucket,
  captureAnalytics,
  capturePageView,
  hashRsn,
  lookupRsnHashField,
  scoreBucket,
} from "./analytics";
import { AppHeader } from "./components/AppHeader";
import { BaseDialog } from "./components/BaseDialog";
import { ratingDisplayPrestigeStats } from "./features/ratingDisplay";
import {
  ratingSystemImage,
  tierColorsFor,
  tierImage,
} from "./runeRatingAssets";

type RuneRatingResult = FunctionReturnType<typeof api.runeRating.get>;
type RuneRatingCard = Extract<RuneRatingResult, { status: "ready" }>["card"];
type RuneRatingPillar = RuneRatingCard["pillars"][number];
type RuneRatingPrestigeStat = RuneRatingCard["prestigeStats"][number];
type RuneRatingSource = Extract<
  RuneRatingResult,
  { status: "refreshing" } | { status: "unavailable" }
>["sources"][number];

const activeStatuses = new Set(["scheduled", "refreshing"]);

const ratingSourceStatusSummary = (sources: RuneRatingSource[]) =>
  sources
    .map((source) => `${source.source}:${source.status ?? "unknown"}`)
    .join("|");

const tierThresholds = [
  ["Bronze", "0-149"],
  ["Iron", "150-274"],
  ["Steel", "275-399"],
  ["Black", "400-524"],
  ["Mithril", "525-649"],
  ["Adamant", "650-774"],
  ["Rune", "775-874"],
  ["Dragon", "875+"],
] as const;

const pillarFormulaNotes: Record<string, string> = {
  skills:
    "Total XP, 99s, and level breadth from Hiscores. Broad skill progress matters more than one isolated spike.",
  combat:
    "Boss KC breadth, best boss scores, Combat Achievement completion, and combat level.",
  unlocks:
    "Quest point completion and achievement diary completion from RuneProfile snapshots.",
  collections:
    "Collection log completion, clue score, and minigame breadth from RuneProfile/WOM data.",
  efficiency:
    "Wise Old Man EHP, EHB, and combat level. This rewards efficient account progression.",
  balance:
    "A consistency bonus for accounts that are strong across pillars instead of only one category.",
};

const improvementCopy: Record<string, { title: string; body: string }> = {
  skills: {
    title: "Train your lower-level skills",
    body: "Raise your lower levels, work toward more 99s, and increase total XP.",
  },
  combat: {
    title: "Build your boss KC",
    body: "Increase boss kill counts and complete more Combat Achievement tasks.",
  },
  unlocks: {
    title: "Complete quests and diaries",
    body: "Earn more quest points and finish achievement diary tiers.",
  },
  collections: {
    title: "Fill more collection log slots",
    body: "Add missing items and increase your clue and minigame scores.",
  },
  efficiency: {
    title: "Increase EHP and EHB",
    body: "Gain skilling XP and boss kills to increase these totals.",
  },
  balance: {
    title: "Improve your lowest categories",
    body: "A more even spread of category scores increases your balance bonus.",
  },
};

const optionalRsn = (value: unknown) => {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  try {
    return normalizeRsn(value);
  } catch {
    return undefined;
  }
};

function escapeSvg(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatAge(timestamp: number) {
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function scorePercent(pillar: RuneRatingPillar) {
  return pillar.score / Math.max(1, pillar.maxScore);
}

function improvementTips(card: RuneRatingCard) {
  return [...card.pillars]
    .sort((left, right) => scorePercent(left) - scorePercent(right))
    .slice(0, 3)
    .map((pillar) => ({
      pillar,
      copy: improvementCopy[pillar.key] ?? {
        title: `Improve ${pillar.label.toLowerCase()}`,
        body: pillar.detail,
      },
    }));
}

async function imageUrlToDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to load rank image.");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to encode rank image."));
    reader.readAsDataURL(blob);
  });
}

function cardSvg(card: RuneRatingCard, rankImageDataUrl: string) {
  const colors = tierColorsFor(card.tier);
  const stats = ratingDisplayPrestigeStats(card).slice(0, 4);
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#071012"/>
          <stop offset=".58" stop-color="#0c1618"/>
          <stop offset="1" stop-color="#111b1e"/>
        </linearGradient>
        <linearGradient id="metal" x1="250" y1="120" x2="950" y2="920">
          <stop offset="0" stop-color="${colors.light}"/>
          <stop offset=".5" stop-color="${colors.base}"/>
          <stop offset="1" stop-color="${colors.dark}"/>
        </linearGradient>
        <radialGradient id="flare" cx="75%" cy="13%" r="55%">
          <stop offset="0" stop-color="${colors.light}" stop-opacity=".55"/>
          <stop offset=".42" stop-color="${colors.base}" stop-opacity=".18"/>
          <stop offset="1" stop-color="${colors.dark}" stop-opacity="0"/>
        </radialGradient>
        <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M56 0H0V56" fill="none" stroke="#f4efe4" stroke-opacity=".035" stroke-width="2"/>
        </pattern>
      </defs>
      <rect width="1200" height="1600" fill="url(#bg)"/>
      <rect width="1200" height="1600" fill="url(#grid)"/>
      <rect width="1200" height="1600" fill="url(#flare)" opacity=".7"/>
      <path d="M920 1120a300 300 0 1 0 0 600 300 300 0 0 0 0-600Z" fill="none" stroke="${colors.base}" stroke-width="48" opacity=".22"/>
      <line x1="88" y1="154" x2="1112" y2="154" stroke="#2b3d40" stroke-width="2"/>
      <text x="88" y="126" fill="#f4efe4" font-size="48" font-weight="900" font-family="Arial Narrow, Impact, sans-serif" letter-spacing="6">RUNERATING</text>
      <image href="${rankImageDataUrl}" x="328" y="150" width="544" height="544" preserveAspectRatio="xMidYMid meet"/>
      <text x="600" y="790" fill="#f4efe4" font-size="188" font-weight="900" font-family="Arial Narrow, Impact, sans-serif" text-anchor="middle">${card.score}</text>
      <text x="600" y="866" fill="${colors.light}" font-size="50" font-weight="900" font-family="Arial Narrow, Impact, sans-serif" text-anchor="middle" letter-spacing="7">${escapeSvg(card.tier).toUpperCase()}</text>
      <text x="600" y="960" fill="#f4efe4" font-size="84" font-weight="900" font-family="Arial Narrow, Impact, sans-serif" text-anchor="middle">${escapeSvg(card.displayRsn).toUpperCase()}</text>
      <text x="600" y="1017" fill="#9aa8a8" font-size="28" font-weight="700" font-family="monospace" text-anchor="middle">${escapeSvg(card.percentileLabel).toUpperCase()}</text>
      <g transform="translate(88 1060)">
        ${stats
          .map(
            (stat: RuneRatingPrestigeStat, index: number) => `
              <g transform="translate(${(index % 2) * 520} ${Math.floor(index / 2) * 190})">
                <rect width="480" height="150" fill="#0c1618" stroke="#2b3d40" stroke-width="2"/>
                <text x="30" y="48" fill="#6f7f80" font-size="20" font-family="monospace" font-weight="700" letter-spacing="4">${escapeSvg(stat.label).toUpperCase()}</text>
                <text x="30" y="108" fill="#f4efe4" font-size="54" font-family="Arial Narrow, Impact, sans-serif" font-weight="900">${escapeSvg(stat.value)}</text>
              </g>
            `,
          )
          .join("")}
      </g>
      <g transform="translate(88 1430)">
        ${card.pillars
          .slice(0, 6)
          .map((pillar: RuneRatingPillar, index: number) => {
            const width = Math.round((pillar.score / pillar.maxScore) * 148);
            return `
              <g transform="translate(${index * 170} 0)">
                <rect width="148" height="14" fill="#213134"/>
                <rect width="${width}" height="14" fill="${colors.light}"/>
              </g>
            `;
          })
          .join("")}
      </g>
      <line x1="88" y1="1464" x2="1112" y2="1464" stroke="#2b3d40" stroke-width="2"/>
      <text x="1112" y="1512" fill="#6f7f80" font-size="22" font-weight="700" font-family="monospace" text-anchor="end">RUNERATING.APP</text>
    </svg>
  `;
}

async function downloadCardPng(card: RuneRatingCard) {
  const rankImageDataUrl = await imageUrlToDataUrl(tierImage(card.tier));
  const svg = cardSvg(card, rankImageDataUrl);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to render rating card."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas rendering is unavailable.");
    ctx.drawImage(image, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error("Unable to export rating card."));
      }, "image/png");
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(png);
    link.download = `${card.displayRsn.replaceAll(" ", "-")}-rune-rating.png`;
    link.click();
    URL.revokeObjectURL(link.href);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function RatingPage() {
  const search = useSearch({ from: "/rating" });
  const rsn = optionalRsn(search.rsn);
  const requestRefresh = useMutation(api.refresh.request);
  const requestedRsns = useRef(new Set<string>());
  const [refreshError, setRefreshError] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const refresh = useCallback(
    (name: string, automatic = false) => {
      const key = rsnLookupKey(name);
      if (automatic && requestedRsns.current.has(key)) return;
      requestedRsns.current.add(key);
      setRefreshError(null);
      void requestRefresh({ rsns: [name] }).catch((error) => {
        setRefreshError({
          key,
          message:
            error instanceof Error
              ? error.message
              : "RuneRating refresh failed.",
        });
      });
    },
    [requestRefresh],
  );
  const visibleError =
    rsn && refreshError?.key === rsnLookupKey(rsn)
      ? refreshError.message
      : null;
  return (
    <RatingWorkbench
      key={rsn ?? "empty"}
      initialRsn={rsn}
      refresh={refresh}
      refreshError={visibleError}
    />
  );
}

function RatingWorkbench({
  initialRsn,
  refresh,
  refreshError,
}: {
  initialRsn: string | undefined;
  refresh: (rsn: string, automatic?: boolean) => void;
  refreshError: string | null;
}) {
  const navigate = useNavigate();
  const [draftRsn, setDraftRsn] = useState(initialRsn ?? "");
  const submittedRsn = initialRsn ?? "";
  const [requestError, setRequestError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const readyAnalyticsKeys = useRef(new Set<string>());
  const initialPageRsn = useRef(initialRsn ?? "empty");
  const rating = useQuery(
    api.runeRating.get,
    submittedRsn ? { rsn: submittedRsn } : "skip",
  );

  const cardUrl = useMemo(() => {
    if (typeof window === "undefined" || !submittedRsn) return "";
    const url = new URL(window.location.href);
    url.pathname = "/rating";
    url.search = "";
    url.searchParams.set("rsn", submittedRsn);
    return url.toString();
  }, [submittedRsn]);

  const card = rating?.status === "ready" ? rating.card : null;
  const colors = tierColorsFor(card?.tier ?? "Dragon");
  const ratingSources: RuneRatingSource[] =
    rating && "sources" in rating && rating.sources ? rating.sources : [];
  const isRefreshing =
    rating?.status === "refreshing" ||
    ratingSources.some((source: RuneRatingSource) =>
      activeStatuses.has(source.status ?? ""),
    ) ||
    false;

  useEffect(() => {
    let ignored = false;
    void hashRsn(initialPageRsn.current).then((rsnHash) => {
      if (ignored) return;
      capturePageView({
        page: "rating",
        rsn_hash: rsnHash,
        ...lookupRsnHashField(rsnHash),
        status: "initial",
      });
    });
    return () => {
      ignored = true;
    };
  }, []);

  useEffect(() => {
    if (!submittedRsn || rating?.status !== "notRequested") return;
    refresh(submittedRsn, true);
  }, [rating?.status, refresh, submittedRsn]);

  useEffect(() => {
    if (!submittedRsn || rating?.status !== "ready") return;
    const key = `${submittedRsn.toLocaleLowerCase()}:${rating.card.formulaVersion}:${rating.card.score}`;
    if (readyAnalyticsKeys.current.has(key)) return;
    readyAnalyticsKeys.current.add(key);
    void hashRsn(submittedRsn).then((rsnHash) => {
      captureAnalytics("rune_rating_ready", {
        rsn_hash: rsnHash,
        ...lookupRsnHashField(rsnHash),
        score_bucket: scoreBucket(rating.card.score),
        tier: rating.card.tier,
        formula_version: rating.card.formulaVersion,
        source_statuses: ratingSourceStatusSummary(rating.card.sources),
        missing_source_count: rating.card.sources.filter(
          (source) => source.status !== "fresh",
        ).length,
        data_age_bucket: ageBucket(rating.card.fetchedAt),
      });
    });
  }, [rating, submittedRsn]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    let next: string;
    try {
      next = normalizeRsn(draftRsn);
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Enter a valid RuneScape name.",
      );
      return;
    }
    setRequestError(null);
    void hashRsn(next).then((rsnHash) => {
      captureAnalytics("rune_rating_requested", {
        rsn_hash: rsnHash,
        ...lookupRsnHashField(rsnHash),
        entry_source: initialRsn ? "url" : "form",
        prior_status: rating?.status ?? "idle",
        source_statuses: ratingSourceStatusSummary(ratingSources),
      });
    });
    // Track before navigation remounts the workbench; failures still reach the
    // requested URL and its matching error state without a duplicate auto-request.
    refresh(next);
    void navigate({ to: "/rating", search: { rsn: next } });
  };

  const copyLink = async () => {
    if (!cardUrl) return;
    try {
      await navigator.clipboard.writeText(cardUrl);
    } catch {
      setRequestError(
        "Could not copy the link. Copy the page address from your browser instead.",
      );
      return;
    }
    if (submittedRsn) {
      void hashRsn(submittedRsn).then((rsnHash) => {
        captureAnalytics("share_or_copy_clicked", {
          surface: "rating_card",
          view: "rating",
          action: "copy_link",
          status: rating?.status ?? "idle",
          score_tier_if_available: card?.tier ?? null,
          rsn_hash: rsnHash,
          ...lookupRsnHashField(rsnHash),
        });
      });
    }
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1_600);
  };

  const shareCard = async () => {
    if (!cardUrl) return;
    if (submittedRsn) {
      void hashRsn(submittedRsn).then((rsnHash) => {
        captureAnalytics("share_or_copy_clicked", {
          surface: "rating_card",
          view: "rating",
          action: "share" in navigator ? "native_share" : "copy_link_fallback",
          status: rating?.status ?? "idle",
          score_tier_if_available: card?.tier ?? null,
          rsn_hash: rsnHash,
          ...lookupRsnHashField(rsnHash),
        });
      });
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: "RuneRating card",
          text: card
            ? `${card.displayRsn} is ${card.tier} with a RuneRating of ${card.score}.`
            : "RuneRating card",
          url: cardUrl,
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setRequestError(
            "Could not share this card. Try copying its link instead.",
          );
        }
      }
      return;
    }
    await copyLink();
  };

  return (
    <main className="rating-page">
      <AppHeader active="rating" />

      <section className="rating-intro" id="public-content" tabIndex={-1}>
        <div>
          <h1>One score for the whole account.</h1>
        </div>
        <p>
          RuneRating weighs skills, combat, unlocks, collections, and efficiency
          into a single current profile.
        </p>
      </section>

      <section className="rating-workbench" aria-label="Player rating">
        <div className="rating-control-panel">
          <div className="rating-control-heading">
            <strong>Look up a player</strong>
          </div>
          <form className="rating-form" onSubmit={submit}>
            <label>
              <span>RuneScape name</span>
              <div className="rating-input-shell">
                <Search size={18} />
                <input
                  value={draftRsn}
                  onChange={(event) => setDraftRsn(event.target.value)}
                  maxLength={12}
                  name="rating-rsn"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="RuneScape name"
                />
              </div>
            </label>
            <button type="submit" className="rating-primary-button">
              {isRefreshing ? (
                <Loader2 size={18} className="spin" />
              ) : (
                <Sparkles size={18} />
              )}
              Rate player
            </button>
          </form>

          {requestError || refreshError ? (
            <StatusCallout tone="error" title="Action could not be completed">
              {requestError ?? refreshError}
            </StatusCallout>
          ) : null}

          {rating === undefined && submittedRsn ? (
            <StatusCallout tone="pending" title="Loading rating">
              Loading RuneRating data for {submittedRsn}.
            </StatusCallout>
          ) : null}

          {rating?.status === "refreshing" ? (
            <StatusCallout tone="pending" title="Refreshing sources">
              {rating.message}
            </StatusCallout>
          ) : null}

          {rating?.status === "unavailable" ? (
            <StatusCallout tone="error" title="Rating unavailable">
              {rating.message}
            </StatusCallout>
          ) : null}

          {card ? (
            <div className="rating-ready-summary">
              <div>
                <span>Rating</span>
                <strong>{card.score}</strong>
              </div>
              <div>
                <span>Tier</span>
                <strong>{card.tier}</strong>
              </div>
              <div>
                <span>Updated</span>
                <strong>{formatAge(card.fetchedAt)}</strong>
              </div>
            </div>
          ) : (
            <div className="rating-system-card">
              <img src={ratingSystemImage()} width={1024} height={512} alt="" />
              <div>
                <p>Bronze to Dragon</p>
                <span>
                  Full ratings require Hiscores, Wise Old Man, and RuneProfile
                  data.
                </span>
              </div>
            </div>
          )}

          <SourceChecklist result={rating} />

          {card ? (
            <div className="rating-analysis">
              <ImprovementTips card={card} />
              <CalculationDialog card={card} />
            </div>
          ) : null}
        </div>

        <div
          id="card"
          className="rating-card-stage"
          style={
            {
              "--tier-base": colors.base,
              "--tier-light": colors.light,
              "--tier-dark": colors.dark,
            } as CSSProperties
          }
        >
          {card ? (
            <RuneRatingCardPreview card={card} />
          ) : (
            <EmptyCardPreview rsn={submittedRsn || draftRsn || "Player"} />
          )}
          <div className="rating-card-actions">
            <span className="rating-actions-label">Share profile</span>
            <span className="sr-only" role="status">
              {copyState === "copied" ? "Link copied" : ""}
            </span>
            <button
              type="button"
              className="rating-secondary-button"
              disabled={!card}
              onClick={() => {
                if (!card) return;
                void hashRsn(submittedRsn).then((rsnHash) => {
                  captureAnalytics("share_or_copy_clicked", {
                    surface: "rating_card",
                    view: "rating",
                    action: "export_png",
                    status: rating?.status ?? "idle",
                    score_tier_if_available: card.tier,
                    rsn_hash: rsnHash,
                    ...lookupRsnHashField(rsnHash),
                  });
                });
                void downloadCardPng(card).catch(() => {
                  setRequestError(
                    "Could not export the card. Please try again.",
                  );
                });
              }}
            >
              <Download size={17} />
              Export PNG
            </button>
            <button
              type="button"
              className="rating-secondary-button"
              disabled={!card || !cardUrl}
              onClick={() => void copyLink()}
            >
              <Copy size={17} />
              {copyState === "copied" ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              className="rating-secondary-button"
              disabled={!card || !cardUrl}
              onClick={() => void shareCard()}
            >
              <Share2 size={17} />
              Share
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function StatusCallout({
  tone,
  title,
  children,
}: {
  tone: "pending" | "error" | "ok";
  title: string;
  children: React.ReactNode;
}) {
  const Icon =
    tone === "error" ? AlertTriangle : tone === "ok" ? CheckCircle2 : RefreshCw;
  return (
    <div
      className={`rating-callout ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon size={18} className={tone === "pending" ? "spin" : ""} />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

function SourceChecklist({ result }: { result: RuneRatingResult | undefined }) {
  const sources: RuneRatingSource[] =
    result && "sources" in result && result.sources ? result.sources : [];
  if (sources.length === 0) return null;
  return (
    <div className="rating-source-list">
      {sources.map((source: RuneRatingSource) => {
        const ready = source.status === "fresh";
        const active = activeStatuses.has(source.status ?? "");
        return (
          <div className="rating-source-row" key={source.label}>
            <span className={ready ? "ready" : active ? "active" : "blocked"} />
            <div>
              <strong>{source.label}</strong>
              <small>
                {ready
                  ? source.lastSuccessAt
                    ? `Ready, ${formatAge(source.lastSuccessAt)}`
                    : "Ready"
                  : active
                    ? "Refreshing"
                    : (source.status ?? "Waiting")}
              </small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ImprovementTips({ card }: { card: RuneRatingCard }) {
  const tips = improvementTips(card);
  return (
    <section className="rating-tips" aria-labelledby="rating-tips-title">
      <div className="rating-section-heading">
        <span>Next gains</span>
        <strong id="rating-tips-title">Improve your RuneRating</strong>
      </div>
      <div className="rating-tip-list">
        {tips.map(({ pillar, copy }) => (
          <article className="rating-tip" key={pillar.key}>
            <div>
              <strong>{copy.title}</strong>
              <span>
                {pillar.score}/{pillar.maxScore}
              </span>
            </div>
            <p>{copy.body}</p>
            <small>{pillar.detail}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function CalculationDialog({ card }: { card: RuneRatingCard }) {
  const totalMax = card.pillars.reduce(
    (total, pillar) => total + pillar.maxScore,
    0,
  );
  return (
    <BaseDialog
      title="How RuneRating is calculated"
      description="Your score combines six categories. The total determines your tier."
      trigger={
        <>
          <Info size={17} />
          How this is calculated
        </>
      }
    >
      <div className="calculation-summary">
        <div>
          <span>Current score</span>
          <strong>{card.score}</strong>
        </div>
        <div>
          <span>Current tier</span>
          <strong>{card.tier}</strong>
        </div>
      </div>

      <section className="calculation-section">
        <h3>Score breakdown</h3>
        <div className="calculation-pillars">
          {card.pillars.map((pillar) => (
            <article className="calculation-pillar" key={pillar.key}>
              <div>
                <strong>{pillar.label}</strong>
                <span>
                  {pillar.score}/{pillar.maxScore}
                </span>
              </div>
              <meter
                min={0}
                max={pillar.maxScore}
                value={pillar.score}
                aria-label={`${pillar.label} score`}
              />
              <p>{pillarFormulaNotes[pillar.key] ?? pillar.detail}</p>
              <small>{pillar.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="calculation-section">
        <h3>Total and tiers</h3>
        <p>
          The displayed rating is the rounded sum of the six pillar scores. This
          card is currently {card.score}/{totalMax}, and the tier is chosen from
          these thresholds.
        </p>
        <div className="tier-threshold-grid">
          {tierThresholds.map(([tier, range]) => (
            <div
              className={tier === card.tier ? "active" : ""}
              key={tier}
              style={
                {
                  "--tier-chip": tierColorsFor(tier).base,
                } as CSSProperties
              }
            >
              <span>{tier}</span>
              <strong>{range}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="calculation-section">
        <h3>Source rules</h3>
        <ul>
          <li>
            Hiscores is authoritative for metrics it shares with another source.
          </li>
          <li>
            RuneProfile supplies quests, diaries, Combat Achievements, and
            collection-log completion.
          </li>
          <li>
            Wise Old Man supplies efficiency and activity signals such as EHP,
            EHB, and boss/minigame context.
          </li>
        </ul>
      </section>
    </BaseDialog>
  );
}

function RuneRatingCardPreview({ card }: { card: RuneRatingCard }) {
  const colors = tierColorsFor(card.tier);
  const stats = ratingDisplayPrestigeStats(card).slice(0, 4);
  return (
    <article className="share-card-preview">
      <div className="share-card-topline">
        <div>
          <span>RuneRating</span>
        </div>
        <strong>{card.tier}</strong>
      </div>
      <div className="share-card-identity">
        <img src={tierImage(card.tier)} width={512} height={512} alt="" />
        <div>
          <span>Current RSN</span>
          <h2>{card.displayRsn}</h2>
          <p>{card.percentileLabel}</p>
        </div>
      </div>
      <div className="share-card-score">
        <span>Account rating</span>
        <strong>{card.score}</strong>
        <div>
          <i style={{ width: `${Math.round(card.tierProgress * 100)}%` }} />
        </div>
      </div>
      <div className="share-card-stats">
        {stats.map((stat: RuneRatingPrestigeStat) => (
          <div className="share-stat" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.detail}</small>
          </div>
        ))}
      </div>
      <div className="share-card-pillars">
        {card.pillars.map((pillar: RuneRatingPillar) => (
          <div className="share-pillar" key={pillar.key}>
            <span>{pillar.label}</span>
            <strong>
              {pillar.score}/{pillar.maxScore}
            </strong>
            <div>
              <i
                style={{
                  width: `${Math.round((pillar.score / pillar.maxScore) * 100)}%`,
                  background: colors.light,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="share-card-footer">
        <span>runerating.app</span>
      </div>
    </article>
  );
}

function EmptyCardPreview({ rsn }: { rsn: string }) {
  return (
    <article className="share-card-preview empty">
      <div className="share-card-topline">
        <div>
          <span>RuneRating</span>
        </div>
        <strong>Pending</strong>
      </div>
      <div className="empty-card-mark">
        <Shield size={70} />
      </div>
      <h2>{rsn}</h2>
      <p>Waiting for player data.</p>
    </article>
  );
}
