import {
  analyticsDistinctIdForRsn,
  capturePostHogEvent,
  durationMs,
} from "./lib/analytics";
import type { Operation, Provider } from "./providerQueueTypes";

export async function captureQueuedRefreshResult({
  rsn,
  provider,
  operation,
  startedAt,
  status,
  errorCode,
}: {
  rsn: string;
  provider: Provider;
  operation: Operation;
  startedAt: number;
  status: "fresh" | "notConnected" | "rateLimited" | "failed";
  errorCode: string | null;
}) {
  try {
    await capturePostHogEvent({
      event: "refresh_result",
      distinctId: await analyticsDistinctIdForRsn(rsn),
      properties: {
        source: provider,
        category: operation,
        status,
        duration_ms: durationMs(startedAt),
        error_code: errorCode,
        queued: true,
      },
    });
  } catch (error) {
    console.warn("Failed to capture queued provider analytics.", error);
  }
}
