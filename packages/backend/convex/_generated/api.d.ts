/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as comparisons from "../comparisons.js";
import type * as lib_analytics from "../lib/analytics.js";
import type * as lib_config from "../lib/config.js";
import type * as lib_keys from "../lib/keys.js";
import type * as lib_players from "../lib/players.js";
import type * as players from "../players.js";
import type * as policies_refresh from "../policies/refresh.js";
import type * as providerQueue from "../providerQueue.js";
import type * as providerQueueAnalytics from "../providerQueueAnalytics.js";
import type * as providerQueueConfig from "../providerQueueConfig.js";
import type * as providerQueueErrors from "../providerQueueErrors.js";
import type * as providerQueueOperations from "../providerQueueOperations.js";
import type * as providerQueueScheduling from "../providerQueueScheduling.js";
import type * as providerQueueTypes from "../providerQueueTypes.js";
import type * as providerQueueViews from "../providerQueueViews.js";
import type * as refresh from "../refresh.js";
import type * as runeProfile from "../runeProfile.js";
import type * as runeProfileCollectionTransforms from "../runeProfileCollectionTransforms.js";
import type * as runeRating from "../runeRating.js";
import type * as runtimeConfig from "../runtimeConfig.js";
import type * as sources_hiscores from "../sources/hiscores.js";
import type * as sources_runeProfile from "../sources/runeProfile.js";
import type * as sources_wiseOldMan from "../sources/wiseOldMan.js";
import type * as validators from "../validators.js";
import type * as wiseOldMan from "../wiseOldMan.js";
import type * as xpTimeline from "../xpTimeline.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  comparisons: typeof comparisons;
  "lib/analytics": typeof lib_analytics;
  "lib/config": typeof lib_config;
  "lib/keys": typeof lib_keys;
  "lib/players": typeof lib_players;
  players: typeof players;
  "policies/refresh": typeof policies_refresh;
  providerQueue: typeof providerQueue;
  providerQueueAnalytics: typeof providerQueueAnalytics;
  providerQueueConfig: typeof providerQueueConfig;
  providerQueueErrors: typeof providerQueueErrors;
  providerQueueOperations: typeof providerQueueOperations;
  providerQueueScheduling: typeof providerQueueScheduling;
  providerQueueTypes: typeof providerQueueTypes;
  providerQueueViews: typeof providerQueueViews;
  refresh: typeof refresh;
  runeProfile: typeof runeProfile;
  runeProfileCollectionTransforms: typeof runeProfileCollectionTransforms;
  runeRating: typeof runeRating;
  runtimeConfig: typeof runtimeConfig;
  "sources/hiscores": typeof sources_hiscores;
  "sources/runeProfile": typeof sources_runeProfile;
  "sources/wiseOldMan": typeof sources_wiseOldMan;
  validators: typeof validators;
  wiseOldMan: typeof wiseOldMan;
  xpTimeline: typeof xpTimeline;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
