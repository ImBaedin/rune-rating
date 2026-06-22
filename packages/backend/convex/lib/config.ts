import type { MutationCtx, QueryCtx } from "../_generated/server.js";
import {
  DEFAULT_REFRESH_COOLDOWN_MS,
  REFRESH_COOLDOWN_CONFIG_KEY,
} from "../policies/refresh";

export async function getRefreshCooldownMs(
  ctx: QueryCtx | MutationCtx,
): Promise<number> {
  const config = await ctx.db
    .query("runtimeConfig")
    .withIndex("by_key", (query) =>
      query.eq("key", REFRESH_COOLDOWN_CONFIG_KEY),
    )
    .unique();

  return config?.numberValue ?? DEFAULT_REFRESH_COOLDOWN_MS;
}
