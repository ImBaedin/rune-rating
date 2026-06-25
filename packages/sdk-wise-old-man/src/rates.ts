import { z } from "zod";
import { WiseOldManRequestError } from "./player";

const DEFAULT_BASE_URL = "https://api.wiseoldman.net/v2";
const DEFAULT_TIMEOUT_MS = 10_000;

const efficiencyRateTypeSchema = z.enum(["main", "ironman", "ultimate"]);
const efficiencyRateMetricSchema = z.enum(["ehp", "ehb"]);

const ehpRateSchema = z.array(
  z.object({
    skill: z.string(),
    methods: z.array(
      z.object({
        startExp: z.number(),
        rate: z.number(),
      }),
    ),
    bonuses: z.array(
      z.object({
        originSkill: z.string(),
        bonusSkill: z.string(),
        startExp: z.number(),
        endExp: z.number(),
        end: z.boolean(),
        ratio: z.number(),
      }),
    ),
  }),
);

const ehbRateSchema = z.array(
  z.object({
    boss: z.string(),
    rate: z.number(),
  }),
);

export type WiseOldManEfficiencyRateType = z.infer<
  typeof efficiencyRateTypeSchema
>;
export type WiseOldManEfficiencyRateMetric = z.infer<
  typeof efficiencyRateMetricSchema
>;
export type WiseOldManEhpSkillRate = z.infer<typeof ehpRateSchema>[number];
export type WiseOldManEhbBossRate = z.infer<typeof ehbRateSchema>[number];

export type WiseOldManRatesClientOptions = {
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

async function fetchEfficiencyRates(
  type: WiseOldManEfficiencyRateType,
  metric: WiseOldManEfficiencyRateMetric,
  options: WiseOldManRatesClientOptions = {},
): Promise<unknown> {
  const fetcher = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const params = new URLSearchParams({ type, metric });
  const url = `${baseUrl}/efficiency/rates?${params.toString()}`;

  try {
    const response = await fetcher(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": options.userAgent ?? "RuneRating/0.1",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

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

    return await response.json();
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

export async function fetchWiseOldManEhpRates(
  type: WiseOldManEfficiencyRateType,
  options: WiseOldManRatesClientOptions = {},
): Promise<WiseOldManEhpSkillRate[]> {
  return ehpRateSchema.parse(await fetchEfficiencyRates(type, "ehp", options));
}

export async function fetchWiseOldManEhbRates(
  type: WiseOldManEfficiencyRateType,
  options: WiseOldManRatesClientOptions = {},
): Promise<WiseOldManEhbBossRate[]> {
  return ehbRateSchema.parse(await fetchEfficiencyRates(type, "ehb", options));
}
