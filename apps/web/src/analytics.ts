type AnalyticsValue = string | number | boolean | null;
type AnalyticsProperties = Record<string, AnalyticsValue>;

const posthogProjectToken =
  import.meta.env.VITE_POSTHOG_PROJECT_TOKEN ??
  import.meta.env.VITE_POSTHOG_KEY;
const posthogHost =
  import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";
const analyticsDisabled = import.meta.env.VITE_POSTHOG_DISABLED === "true";
const analyticsEnvironment =
  import.meta.env.VITE_POSTHOG_ENVIRONMENT ?? import.meta.env.MODE;

let initPromise: Promise<typeof import("posthog-js").default | null> | null =
  null;
let isInitialized = false;

function browserAnalyticsEnabled() {
  return (
    typeof window !== "undefined" &&
    Boolean(posthogProjectToken) &&
    !analyticsDisabled
  );
}

async function getPostHog() {
  if (!browserAnalyticsEnabled()) return null;
  const token = posthogProjectToken;
  if (!token) return null;
  initPromise ??= import("posthog-js").then(({ default: posthog }) => {
    if (!isInitialized) {
      posthog.init(token, {
        api_host: posthogHost,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: true,
        disable_session_recording: true,
        person_profiles: "identified_only",
        persistence: "localStorage+cookie",
        defaults: "2026-05-30",
        property_denylist: ["left_rsn", "right_rsn", "rsn", "display_rsn"],
      });
      isInitialized = true;
    }
    return posthog;
  });
  return initPromise;
}

function analyticsProperties(properties: AnalyticsProperties = {}) {
  return {
    app: "rune-rating",
    surface: "web",
    environment: analyticsEnvironment,
    ...properties,
    $process_person_profile: false,
  };
}

export function captureAnalytics(
  event: string,
  properties: AnalyticsProperties = {},
) {
  if (!browserAnalyticsEnabled()) return;
  void getPostHog()
    .then((posthog) => {
      posthog?.capture(event, analyticsProperties(properties));
    })
    .catch(() => {
      // Analytics failures must never affect the product experience.
    });
}

export function capturePageView(properties: AnalyticsProperties) {
  captureAnalytics("$pageview", properties);
}

export async function hashRsn(rsn: string) {
  const normalized = normalizeRsnForAnalytics(rsn);
  return hashString(`rsn:${normalized}`);
}

export async function hashRsns(rsns: readonly string[]) {
  return Promise.all(rsns.map(hashRsn));
}

export async function hashRsnPair(rsns: readonly [string, string]) {
  return [await hashRsn(rsns[0]), await hashRsn(rsns[1])] as const;
}

export function lookupRsnHashField(rsnHash: string) {
  return { lookup_rsn_hashes: rsnHash };
}

export function lookupRsnPairHashField(
  leftRsnHash: string,
  rightRsnHash: string,
) {
  return { lookup_rsn_hashes: `${leftRsnHash}|${rightRsnHash}` };
}

export function countBucket(value: number) {
  if (value <= 0) return "0";
  if (value <= 5) return "1-5";
  if (value <= 25) return "6-25";
  if (value <= 100) return "26-100";
  return "101+";
}

export function ageBucket(
  timestamp: number | null | undefined,
  now = Date.now(),
) {
  if (timestamp === null || timestamp === undefined) return "missing";
  const ageMs = Math.max(0, now - timestamp);
  if (ageMs < 5 * 60_000) return "0-5m";
  if (ageMs < 60 * 60_000) return "5m-1h";
  if (ageMs < 24 * 60 * 60_000) return "1h-24h";
  return "24h+";
}

export function scoreBucket(score: number) {
  if (score < 150) return "0-149";
  if (score < 275) return "150-274";
  if (score < 400) return "275-399";
  if (score < 525) return "400-524";
  if (score < 650) return "525-649";
  if (score < 775) return "650-774";
  if (score < 875) return "775-874";
  return "875+";
}

async function hashString(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeRsnForAnalytics(rsn: string) {
  return rsn.trim().replaceAll("_", " ").replace(/\s+/g, " ").toLowerCase();
}
