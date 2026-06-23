import { RuneProfileRequestError } from "@rune-rating/sdk-runeprofile";
import { WiseOldManRequestError } from "@rune-rating/sdk-wise-old-man";

function runeProfileError(error: unknown) {
  if (error instanceof RuneProfileRequestError) {
    return {
      code: error.code,
      retryAfterMs: error.retryAfterMs,
      retryable:
        error.code === "rateLimited" ||
        error.code === "timeout" ||
        error.code === "failed",
    };
  }
  return { code: "failed", retryAfterMs: null, retryable: true };
}

export function providerError(error: unknown) {
  if (error instanceof WiseOldManRequestError) {
    return {
      code: error.code,
      retryAfterMs: error.retryAfterMs,
      retryable:
        error.code === "rateLimited" ||
        error.code === "timeout" ||
        error.code === "failed",
    };
  }
  return runeProfileError(error);
}
