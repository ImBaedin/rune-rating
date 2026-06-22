import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server.js";
import { getRefreshCooldownMs } from "./lib/config";
import { REFRESH_COOLDOWN_CONFIG_KEY } from "./policies/refresh";

export const get = query({
  args: {},
  returns: v.object({ refreshCooldownMs: v.number() }),
  handler: async (ctx) => ({
    refreshCooldownMs: await getRefreshCooldownMs(ctx),
  }),
});

export const setRefreshCooldown = internalMutation({
  args: { refreshCooldownMs: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (
      !Number.isFinite(args.refreshCooldownMs) ||
      args.refreshCooldownMs < 60_000
    ) {
      throw new Error("Refresh cooldown must be at least one minute.");
    }

    const existing = await ctx.db
      .query("runtimeConfig")
      .withIndex("by_key", (query) =>
        query.eq("key", REFRESH_COOLDOWN_CONFIG_KEY),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { numberValue: args.refreshCooldownMs });
    } else {
      await ctx.db.insert("runtimeConfig", {
        key: REFRESH_COOLDOWN_CONFIG_KEY,
        numberValue: args.refreshCooldownMs,
      });
    }
    return null;
  },
});
