import { v } from "convex/values";
import { internalAction } from "./_generated/server.js";
import { capturePostHogEvent } from "./lib/analytics";

const analyticsValueValidator = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.null(),
);

export const capture = internalAction({
  args: {
    event: v.string(),
    distinctId: v.string(),
    properties: v.optional(v.record(v.string(), analyticsValueValidator)),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    await capturePostHogEvent(args);
    return null;
  },
});
