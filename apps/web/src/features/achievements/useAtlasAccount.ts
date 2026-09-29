import { api } from "@rune-rating/backend/convex/_generated/api";
import { normalizeRsn, rsnLookupKey } from "@rune-rating/domain";
import version from "@rune-rating/domain/achievement-version";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  hasActiveRefresh,
  nextSnapshotCheckAt,
} from "../comparison/sourceState";
import { atlasRefreshKeys } from "./atlasFreshness";
import { type AtlasStatus, atlasNodes as previewNodes } from "./atlasPreview";

const statuses: AtlasStatus[] = ["complete", "available", "locked", "unknown"];
export function useAtlasAccount() {
  const search = useSearch({ from: "/achievements" });
  const navigate = useNavigate({ from: "/achievements" });
  const rsn = search.rsn ?? null;
  const [request, setRequest] = useState<{
    rsn: string | null;
    pending: boolean;
    error: string | null;
  } | null>(null);
  const requestId = useRef(0);
  const autoRefreshKeys = useRef(new Set<string>());
  const [staleCheckNow, setStaleCheckNow] = useState(() => Date.now());
  const load = useAction(api.achievements.load);
  const refresh = useCallback(
    async (name: string) => {
      const id = ++requestId.current;
      setRequest({ rsn: name, pending: true, error: null });
      try {
        await load({ rsn: name });
        if (requestId.current === id)
          setRequest({ rsn: name, pending: false, error: null });
      } catch {
        if (requestId.current === id)
          setRequest({
            rsn: name,
            pending: false,
            error: "Could not refresh this account. Please try again.",
          });
      }
    },
    [load],
  );
  const requesting = request?.rsn === rsn && request.pending;
  const error = request?.rsn === rsn ? request.error : null;
  const progress = useQuery(api.achievements.progress, rsn ? { rsn } : "skip");
  const profile = useQuery(api.players.getProfile, rsn ? { rsn } : "skip");
  const refreshAllowedAt = Math.max(
    profile?.refreshAllowedAt ?? 0,
    progress?.refreshAllowedAt ?? 0,
  );
  const coolingDown = refreshAllowedAt > Math.max(staleCheckNow, Date.now());
  useEffect(() => {
    const now = Math.max(staleCheckNow, Date.now());
    const snapshotCheckAt = nextSnapshotCheckAt([profile], now);
    const nextCheckAt =
      refreshAllowedAt > now
        ? Math.min(snapshotCheckAt ?? refreshAllowedAt, refreshAllowedAt)
        : snapshotCheckAt;
    if (nextCheckAt === null) return;
    const timeout = window.setTimeout(
      () => setStaleCheckNow(Date.now()),
      Math.max(0, nextCheckAt - now),
    );
    return () => window.clearTimeout(timeout);
  }, [profile, staleCheckNow, refreshAllowedAt]);
  useEffect(() => {
    if (!rsn || requesting) return;
    const keys = atlasRefreshKeys(
      rsn,
      profile,
      progress,
      Math.max(staleCheckNow, Date.now()),
      autoRefreshKeys.current,
    );
    if (keys.length === 0) return;
    for (const key of keys) autoRefreshKeys.current.add(key);
    void refresh(rsn);
  }, [rsn, profile, progress, requesting, refresh, staleCheckNow]);
  const refreshing =
    requesting || hasActiveRefresh(profile) || progress?.refreshing === true;
  const states =
    progress?.version === version.version &&
    progress.states.length === previewNodes.length
      ? progress.states
      : null;
  const nodes = useMemo(
    () =>
      rsn
        ? previewNodes.map((node, i) => ({
            ...node,
            status: states
              ? (statuses[Number(states[i])] ?? "unknown")
              : ("unknown" as AtlasStatus),
          }))
        : previewNodes,
    [rsn, states],
  );
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  async function lookup(value: string) {
    let normalized: string;
    try {
      normalized = normalizeRsn(value);
    } catch (e) {
      setRequest({
        rsn,
        pending: false,
        error: e instanceof Error ? e.message : "Enter a valid RuneScape name.",
      });
      return;
    }
    if (rsn && rsnLookupKey(normalized) === rsnLookupKey(rsn)) {
      if (refreshAllowedAt > Date.now() || refreshing) return;
      await refresh(rsn);
    } else await navigate({ search: { rsn: normalized }, resetScroll: false });
  }
  function explore() {
    ++requestId.current;
    setRequest(null);
    void navigate({ search: {}, resetScroll: false });
  }
  function progressMessage(): string {
    if (error) return error;
    if (!rsn) return "Sample atlas · enter your name to see your progress.";
    if (!progress) return "Loading account…";
    if (progress.version !== version.version)
      return "The atlas has changed. Reload to see the latest milestones.";
    if (refreshing) return "Refreshing account data…";
    if (progress.availability === "requiresRuneProfile")
      return "A public RuneProfile is required. Enable the RuneProfile plugin and sync your account.";
    if (progress.availability === "failed")
      return "Account data could not be loaded. Try refreshing again.";
    if (progress.availability === "pending") return "Fetching account data…";
    if (progress.stale)
      return "Some source data is missing or out of date. See milestone details.";
    if (
      profile?.snapshotStaleAt != null &&
      profile.snapshotStaleAt <= staleCheckNow
    )
      return "Showing saved progress. Waiting to refresh account data…";
    const completed = [...progress.states].filter(
      (state) => state === "0",
    ).length;
    const timestamp = progress.fetchedAt
      ? ` · updated ${new Date(progress.fetchedAt).toLocaleString()}`
      : "";
    return `${completed} of ${nodes.length} milestones completed${timestamp}`;
  }
  const message = progressMessage();
  return {
    rsn,
    progress,
    nodes,
    nodeById,
    lookup,
    explore,
    message,
    requesting,
    refreshing,
    coolingDown,
    refreshAllowedAt,
    error,
  };
}
export type AtlasAccount = ReturnType<typeof useAtlasAccount>;
