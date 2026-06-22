import { rsnLookupKey } from "@rune-rating/domain";

export type AnalyticsValue = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsValue>;

const defaultPostHogHost = "https://us.i.posthog.com";

export async function capturePostHogEvent({
  event,
  distinctId,
  properties,
}: {
  event: string;
  distinctId: string;
  properties?: AnalyticsProperties;
}) {
  const token =
    process.env.POSTHOG_PROJECT_TOKEN ?? process.env.POSTHOG_API_KEY;
  if (!token || process.env.POSTHOG_DISABLED === "true") return;

  const host = (process.env.POSTHOG_HOST?.trim() || defaultPostHogHost).replace(
    /\/+$/,
    "",
  );

  try {
    const response = await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: token,
        distinct_id: distinctId,
        event,
        properties: {
          app: "rune-rating",
          surface: "convex",
          environment: process.env.POSTHOG_ENVIRONMENT ?? "production",
          ...properties,
          $process_person_profile: false,
        },
      }),
    });
    if (!response.ok) {
      console.warn(`PostHog capture failed with status ${response.status}`);
    }
  } catch (error) {
    console.warn(
      error instanceof Error ? error.message : "PostHog capture failed",
    );
  }
}

export async function analyticsDistinctIdForRsn(rsn: string) {
  return `rsn:${await analyticsRsnHash(rsn)}`;
}

export async function analyticsRsnHash(rsn: string) {
  let normalized = rsn.trim().toLocaleLowerCase();
  try {
    normalized = rsnLookupKey(rsn);
  } catch {
    // Invalid RSNs can still produce an anonymized analytics key.
  }
  return hashString(`rsn:${normalized}`);
}

export function durationMs(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}

async function hashString(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
