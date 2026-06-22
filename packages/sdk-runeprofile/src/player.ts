import { z } from "zod";

const DEFAULT_BASE_URL = "https://api.runeprofile.com/v1";
const DEFAULT_TIMEOUT_MS = 15_000;

const runeProfileDateTimeSchema = z
  .string()
  .refine(
    (value) => Number.isFinite(Date.parse(value)),
    "Invalid RuneProfile datetime.",
  );

const questSchema = z.object({
  id: z.number(),
  name: z.string(),
  points: z.number(),
  type: z.enum(["free", "members", "mini"]),
  state: z.enum(["not_started", "in_progress", "finished"]),
});

const diaryAreaSchema = z.object({
  areaId: z.number(),
  area: z.string(),
  tiers: z.array(
    z.object({
      tier: z.string(),
      completed: z.number(),
      total: z.number(),
    }),
  ),
});

const combatTierSchema = z.object({
  id: z.number(),
  name: z.string(),
  completed: z.number(),
  total: z.number(),
});

const combatTaskSchema = z.object({
  index: z.number(),
  tierId: z.number(),
  tierName: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.string(),
  monster: z.string(),
  completed: z.boolean(),
});

const summarySchema = z.object({
  username: z.string(),
  quests: z.object({
    completed: z.number(),
    started: z.number(),
    notStarted: z.number(),
    total: z.number(),
    totalPoints: z.number(),
    earnedPoints: z.number(),
  }),
  collectionLog: z.object({
    obtained: z.number(),
    total: z.number(),
  }),
  combatAchievements: z.array(combatTierSchema),
  achievementDiaries: z.array(
    z.object({
      areaId: z.number(),
      area: z.string(),
      completed: z.number(),
      total: z.number(),
    }),
  ),
  updatedAt: runeProfileDateTimeSchema,
});

const questsResponseSchema = z.object({ data: z.array(questSchema) });
const diariesResponseSchema = z.object({ data: z.array(diaryAreaSchema) });
const combatTasksResponseSchema = z.object({
  totalPoints: z.number(),
  tierReached: z.string().nullable(),
  data: z.array(combatTaskSchema),
});
const collectionLogItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  quantity: z.number(),
});
const collectionLogPageSchema = z.object({
  name: z.string(),
  obtained: z.number(),
  total: z.number(),
  items: z.array(collectionLogItemSchema),
});
const collectionLogTabSchema = z.object({
  name: z.string(),
  obtained: z.number(),
  total: z.number(),
  pages: z.array(collectionLogPageSchema),
});
const collectionLogResponseSchema = z.object({
  obtained: z.number(),
  total: z.number(),
  tabs: z.array(collectionLogTabSchema),
});

export type RuneProfileErrorCode =
  | "notConnected"
  | "rateLimited"
  | "timeout"
  | "invalidResponse"
  | "failed";

export class RuneProfileRequestError extends Error {
  constructor(
    readonly code: RuneProfileErrorCode,
    message: string,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "RuneProfileRequestError";
  }
}

export type RuneProfileClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  userAgent?: string;
};

export type RuneProfileSnapshot = {
  displayRsn: string;
  fetchedAt: number;
  providerUpdatedAt: number;
  quests: z.infer<typeof questSchema>[];
  questSummary: z.infer<typeof summarySchema>["quests"];
  diaries: z.infer<typeof diaryAreaSchema>[];
  diarySummary: z.infer<typeof summarySchema>["achievementDiaries"];
  combatAchievementTasks: z.infer<typeof combatTaskSchema>[];
  combatAchievementTiers: z.infer<typeof combatTierSchema>[];
  combatAchievementPoints: number;
  combatAchievementTierReached: string | null;
  collectionSummary: z.infer<typeof summarySchema>["collectionLog"];
};
export type RuneProfileCollectionLog = z.infer<
  typeof collectionLogResponseSchema
>;

function retryAfterMs(response: Response): number | null {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return null;
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) ? seconds * 1_000 : null;
}

async function fetchJson(
  path: string,
  options: RuneProfileClientOptions,
): Promise<unknown> {
  const fetcher = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": options.userAgent ?? "RuneRating/0.1",
  };
  if (options.apiKey) headers["X-API-Key"] = options.apiKey;

  try {
    const response = await fetcher(`${baseUrl}${path}`, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 404) {
      throw new RuneProfileRequestError(
        "notConnected",
        "RuneProfile account is unavailable.",
      );
    }
    if (response.status === 429) {
      throw new RuneProfileRequestError(
        "rateLimited",
        "RuneProfile rate limit exceeded.",
        retryAfterMs(response),
      );
    }
    if (!response.ok) {
      throw new RuneProfileRequestError(
        "failed",
        `RuneProfile returned HTTP ${response.status}.`,
      );
    }
    return await response.json();
  } catch (error) {
    if (error instanceof RuneProfileRequestError) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new RuneProfileRequestError(
        "timeout",
        `RuneProfile timed out after ${timeoutMs}ms.`,
      );
    }
    throw new RuneProfileRequestError(
      "failed",
      error instanceof Error ? error.message : "Unknown RuneProfile failure.",
    );
  }
}

export async function fetchRuneProfilePlayer(
  rsn: string,
  options: RuneProfileClientOptions = {},
): Promise<RuneProfileSnapshot> {
  const encodedRsn = encodeURIComponent(rsn);
  const [summaryValue, questsValue, diariesValue, combatTasksValue] =
    await Promise.all([
      fetchJson(`/accounts/${encodedRsn}`, options),
      fetchJson(`/accounts/${encodedRsn}/quests`, options),
      fetchJson(`/accounts/${encodedRsn}/achievement-diaries`, options),
      fetchJson(`/accounts/${encodedRsn}/combat-achievements/tasks`, options),
    ]);
  let summary: z.infer<typeof summarySchema>;
  let quests: z.infer<typeof questsResponseSchema>;
  let diaries: z.infer<typeof diariesResponseSchema>;
  let combatTasks: z.infer<typeof combatTasksResponseSchema>;
  try {
    summary = summarySchema.parse(summaryValue);
    quests = questsResponseSchema.parse(questsValue);
    diaries = diariesResponseSchema.parse(diariesValue);
    combatTasks = combatTasksResponseSchema.parse(combatTasksValue);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new RuneProfileRequestError(
        "invalidResponse",
        "RuneProfile response did not match the expected schema.",
      );
    }
    throw error;
  }

  return {
    displayRsn: summary.username,
    fetchedAt: Date.now(),
    providerUpdatedAt: Date.parse(summary.updatedAt),
    quests: quests.data,
    questSummary: summary.quests,
    diaries: diaries.data,
    diarySummary: summary.achievementDiaries,
    combatAchievementTasks: combatTasks.data,
    combatAchievementTiers: summary.combatAchievements,
    combatAchievementPoints: combatTasks.totalPoints,
    combatAchievementTierReached: combatTasks.tierReached,
    collectionSummary: summary.collectionLog,
  };
}

export async function fetchRuneProfileCollectionLog(
  rsn: string,
  options: RuneProfileClientOptions = {},
): Promise<RuneProfileCollectionLog & { fetchedAt: number }> {
  const encodedRsn = encodeURIComponent(rsn);
  const value = await fetchJson(
    `/accounts/${encodedRsn}/collection-log`,
    options,
  );
  try {
    return {
      ...collectionLogResponseSchema.parse(value),
      fetchedAt: Date.now(),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new RuneProfileRequestError(
        "invalidResponse",
        "RuneProfile collection log response did not match the expected schema.",
      );
    }
    throw error;
  }
}
