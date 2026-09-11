import type { HiscoresSnapshot } from "@rune-rating/domain";
import { HiscoresContractError, parseHiscoresResponse } from "./parser";

const DEFAULT_BASE_URL =
  "https://secure.runescape.com/m=hiscore_oldschool/index_lite.json";
const DEFAULT_TIMEOUT_MS = 10_000;

export type HiscoresErrorCode =
  | "notFound"
  | "rateLimited"
  | "timeout"
  | "invalidResponse"
  | "failed";

export class HiscoresRequestError extends Error {
  constructor(
    readonly code: HiscoresErrorCode,
    message: string,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "HiscoresRequestError";
  }
}

export type HiscoresClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  userAgent?: string;
};

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;

  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1_000 : null;
}

export async function fetchHiscores(
  rsn: string,
  options: HiscoresClientOptions = {},
): Promise<HiscoresSnapshot> {
  const fetcher = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = new URL(options.baseUrl ?? DEFAULT_BASE_URL);
  url.searchParams.set("player", rsn);

  try {
    const response = await fetcher(url, {
      headers: { "User-Agent": options.userAgent ?? "RuneRating" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status === 404) {
      throw new HiscoresRequestError(
        "notFound",
        `No Hiscores profile found for "${rsn}".`,
      );
    }
    if (response.status === 429) {
      throw new HiscoresRequestError(
        "rateLimited",
        "Hiscores rate limit exceeded.",
        retryAfterMs(response),
      );
    }
    if (!response.ok) {
      throw new HiscoresRequestError(
        "failed",
        `Hiscores returned HTTP ${response.status}.`,
      );
    }

    return parseHiscoresResponse(await response.json());
  } catch (error) {
    if (error instanceof HiscoresRequestError) throw error;
    if (error instanceof HiscoresContractError) {
      throw new HiscoresRequestError("invalidResponse", error.message);
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new HiscoresRequestError(
        "timeout",
        `Hiscores timed out after ${timeoutMs}ms.`,
      );
    }
    throw new HiscoresRequestError(
      "failed",
      error instanceof Error
        ? error.message
        : "Unknown Hiscores request failure.",
    );
  }
}
