import type { EfficiencySnapshot } from "@rune-rating/domain";
import { z } from "zod";

const DEFAULT_BASE_URL = "https://api.wiseoldman.net/v2";
const DEFAULT_TIMEOUT_MS = 10_000;

const playerDetailsSchema = z.object({
  displayName: z.string(),
  type: z.string(),
  build: z.string(),
  combatLevel: z.number(),
  ehp: z.number(),
  ehb: z.number(),
  ttm: z.number(),
  tt200m: z.number(),
});

export type WiseOldManErrorCode =
  | "notConnected"
  | "rateLimited"
  | "timeout"
  | "failed";

export class WiseOldManRequestError extends Error {
  constructor(
    readonly code: WiseOldManErrorCode,
    message: string,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "WiseOldManRequestError";
  }
}

export type WiseOldManClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  userAgent?: string;
};

function retryAfterMs(response: Response): number | null {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
  }

  const reset = Number(response.headers.get("ratelimit-reset"));
  return Number.isFinite(reset) ? reset * 1_000 : null;
}

export async function fetchWiseOldManPlayer(
  rsn: string,
  options: WiseOldManClientOptions = {},
): Promise<EfficiencySnapshot> {
  const fetcher = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const url = `${baseUrl}/players/${encodeURIComponent(rsn)}`;

  try {
    const response = await fetcher(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": options.userAgent ?? "RuneRating/0.1",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status === 404) {
      throw new WiseOldManRequestError(
        "notConnected",
        `No Wise Old Man profile found for "${rsn}".`,
      );
    }
    if (response.status === 429) {
      throw new WiseOldManRequestError(
        "rateLimited",
        "Wise Old Man rate limit exceeded.",
        retryAfterMs(response),
      );
    }
    if (!response.ok) {
      throw new WiseOldManRequestError(
        "failed",
        `Wise Old Man returned HTTP ${response.status}.`,
      );
    }

    const player = playerDetailsSchema.parse(await response.json());
    return {
      source: "wiseOldMan",
      displayRsn: player.displayName,
      fetchedAt: Date.now(),
      accountType: player.type,
      accountBuild: player.build,
      combatLevel: player.combatLevel,
      ehp: player.ehp,
      ehb: player.ehb,
      timeToMax: player.ttm,
      timeTo200m: player.tt200m,
    };
  } catch (error) {
    if (error instanceof WiseOldManRequestError) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new WiseOldManRequestError(
        "timeout",
        `Wise Old Man timed out after ${timeoutMs}ms.`,
      );
    }
    throw new WiseOldManRequestError(
      "failed",
      error instanceof Error ? error.message : "Unknown Wise Old Man failure.",
    );
  }
}
