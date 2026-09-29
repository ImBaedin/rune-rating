import type { AchievementSourceFreshness } from "@rune-rating/domain/achievements";
import { useEffect, useState } from "react";

const labels = {
  fresh: "Current",
  stale: "Out of date",
  refreshing: "Refreshing",
  failed: "Refresh failed",
  missing: "Unavailable",
};

export function AtlasSourceFreshness({
  sources,
}: {
  sources: AchievementSourceFreshness[];
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const next = Math.min(
      ...sources.flatMap((source) =>
        source.status === "fresh" &&
        source.staleAt !== null &&
        source.staleAt > now
          ? [source.staleAt]
          : [],
      ),
    );
    if (!Number.isFinite(next)) return;
    const timeout = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(0, next - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [sources, now]);
  if (!sources.length) return null;
  return (
    <details
      className="atlas-source-freshness"
      open={sources.some(
        (source) =>
          source.status !== "fresh" ||
          (source.staleAt !== null && source.staleAt <= now),
      )}
    >
      <summary>Source data</summary>
      <p>
        These sources support this milestone and its prerequisite checks. Saved
        progress remains visible when a refresh fails.
      </p>
      <ul>
        {sources.map((source) => {
          const status =
            source.status === "fresh" &&
            source.staleAt !== null &&
            source.staleAt <= now
              ? "stale"
              : source.status;
          return (
            <li key={source.key} data-status={status}>
              <strong>{source.label}</strong>
              <span>
                {source.provider} · {labels[status]}
              </span>
              <small>
                {source.fetchedAt === null
                  ? "No saved snapshot"
                  : `Retrieved ${new Date(source.fetchedAt).toLocaleString()}`}
              </small>
              {source.reason && <small>{source.reason}</small>}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
