import { z } from "zod";
import { type WiseOldManClientOptions, WiseOldManRequestError } from "./player";

const DEFAULT_BASE_URL = "https://api.wiseoldman.net/v2";
const DEFAULT_TIMEOUT_MS = 10_000;

export const wiseOldManPeriods = ["week", "month", "quarter", "year"] as const;
export type WiseOldManPeriod = (typeof wiseOldManPeriods)[number];
export type WiseOldManTimelinePoint = { value: number; date: number };
export type WiseOldManSkillTimeline = {
  metric: string;
  timeline: WiseOldManTimelinePoint[];
};

const timelinePointSchema = z.object({
  value: z.number(),
  rank: z.number(),
  date: z.string(),
});
const timelinePointWithMetricSchema = timelinePointSchema.extend({
  metric: z.string(),
});

const skillExperienceSchema = z.object({
  experience: z.object({
    gained: z.number(),
    start: z.number(),
    end: z.number(),
  }),
});

const gainsSchema = z.object({
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  data: z.object({
    skills: z.record(z.string(), skillExperienceSchema),
  }),
});

async function fetchJson(
  path: string,
  options: WiseOldManClientOptions,
): Promise<unknown> {
  const fetcher = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");

  try {
    const response = await fetcher(`${baseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": options.userAgent ?? "RuneRating/0.1",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 404) {
      throw new WiseOldManRequestError(
        "notConnected",
        "Wise Old Man history is unavailable.",
      );
    }
    if (response.status === 429) {
      throw new WiseOldManRequestError(
        "rateLimited",
        "Wise Old Man rate limit exceeded.",
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

function normalizeTimeline(
  timeline: Array<z.infer<typeof timelinePointSchema>>,
  period: WiseOldManPeriod,
) {
  const points: WiseOldManTimelinePoint[] = timeline
    .map((point) => ({ value: point.value, date: Date.parse(point.date) }))
    .filter((point) => Number.isFinite(point.date));
  const sorted = points.sort((left, right) => left.date - right.date);
  if (period !== "quarter") return sorted;

  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1_000;
  return sorted.filter((point) => point.date >= cutoff);
}

function parseSkillTimelines(
  raw: unknown,
  metrics: string[],
  period: WiseOldManPeriod,
): WiseOldManSkillTimeline[] {
  const keyedSchema = z.record(z.string(), timelinePointSchema.array());
  const keyed = keyedSchema.safeParse(raw);
  if (keyed.success) {
    return Object.entries(keyed.data).map(([metric, timeline]) => ({
      metric,
      timeline: normalizeTimeline(timeline, period),
    }));
  }

  const nestedData = z.object({ data: keyedSchema }).safeParse(raw);
  if (nestedData.success) {
    return Object.entries(nestedData.data.data).map(([metric, timeline]) => ({
      metric,
      timeline: normalizeTimeline(timeline, period),
    }));
  }

  const metricRows = timelinePointWithMetricSchema.array().safeParse(raw);
  if (metricRows.success) {
    const byMetric = new Map<
      string,
      Array<z.infer<typeof timelinePointSchema>>
    >();
    for (const row of metricRows.data) {
      const rows = byMetric.get(row.metric) ?? [];
      rows.push(row);
      byMetric.set(row.metric, rows);
    }
    return [...byMetric.entries()].map(([metric, timeline]) => ({
      metric,
      timeline: normalizeTimeline(timeline, period),
    }));
  }

  if (metrics.length === 1) {
    const single = timelinePointSchema.array().parse(raw);
    return [
      { metric: metrics[0] ?? "", timeline: normalizeTimeline(single, period) },
    ];
  }

  timelinePointSchema.array().parse(raw);
  return [];
}

export async function fetchSkillXpTimelines(
  rsn: string,
  metrics: string[],
  period: WiseOldManPeriod,
  options: WiseOldManClientOptions = {},
) {
  if (metrics.length === 0) return [];

  const params = new URLSearchParams({ metric: metrics.join(",") });
  if (period === "quarter") {
    params.set("period", "year");
  } else {
    params.set("period", period);
  }
  return parseSkillTimelines(
    await fetchJson(
      `/players/${encodeURIComponent(rsn)}/snapshots/timeline?${params}`,
      options,
    ),
    metrics,
    period,
  );
}

export async function fetchSkillXpTimeline(
  rsn: string,
  metric: string,
  period: WiseOldManPeriod,
  options: WiseOldManClientOptions = {},
) {
  const timelines = await fetchSkillXpTimelines(rsn, [metric], period, options);
  return (
    timelines.find((timeline) => timeline.metric === metric)?.timeline ?? []
  );
}

export async function fetchSkillXpGains(
  rsn: string,
  period: WiseOldManPeriod,
  options: WiseOldManClientOptions = {},
) {
  const params = new URLSearchParams({ period });
  const result = gainsSchema.parse(
    await fetchJson(
      `/players/${encodeURIComponent(rsn)}/gained?${params}`,
      options,
    ),
  );
  const hasBoundaries = result.startsAt !== null && result.endsAt !== null;
  return {
    startsAt: result.startsAt === null ? null : Date.parse(result.startsAt),
    endsAt: result.endsAt === null ? null : Date.parse(result.endsAt),
    skills: Object.entries(result.data.skills).map(([metric, value]) => ({
      metric,
      gained: hasBoundaries ? value.experience.gained : null,
      start: hasBoundaries ? value.experience.start : null,
      end: hasBoundaries ? value.experience.end : null,
    })),
  };
}

export async function fetchOverallXpTimeline(
  rsn: string,
  period: WiseOldManPeriod,
  options: WiseOldManClientOptions = {},
) {
  return await fetchSkillXpTimeline(rsn, "overall", period, options);
}

export async function fetchOverallXpGains(
  rsn: string,
  period: WiseOldManPeriod,
  options: WiseOldManClientOptions = {},
) {
  const gains = await fetchSkillXpGains(rsn, period, options);
  return {
    startsAt: gains.startsAt,
    endsAt: gains.endsAt,
    gained:
      gains.skills.find((skill) => skill.metric === "overall")?.gained ?? null,
  };
}
