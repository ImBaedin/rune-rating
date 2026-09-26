import type { CaptureResult, PostHogConfig } from "posthog-js";

// Only the explicit RuneRating event contract and anonymous SDK identifiers may
// leave the browser. In particular, URLs, titles and initial/referrer properties
// contain player names even when the explicit RSN fields have been hashed.
const allowedProperties = new Set([
  "app",
  "surface",
  "environment",
  "page",
  "view",
  "entry_view",
  "action",
  "status",
  "prior_status",
  "entry_source",
  "account_type_filter",
  "category",
  "rsn_hash",
  "left_rsn_hash",
  "right_rsn_hash",
  "lookup_rsn_hashes",
  "used_recent_lookup",
  "source_statuses",
  "left_source_statuses",
  "right_source_statuses",
  "data_age_bucket",
  "score_bucket",
  "tier",
  "score_tier_if_available",
  "formula_version",
  "missing_source_count",
  "query_length_bucket",
  "result_count_bucket",
  "filters",
  "expanded_results",
  // Public project ingestion key required by PostHog, not an API secret.
  "token",
  "distinct_id",
  "$device_id",
  "$session_id",
  "$window_id",
  "$lib",
  "$lib_version",
  "$insert_id",
  "$time",
  "$is_identified",
  "$process_person_profile",
  "$pageview_id",
  "$event_type",
]);

export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown>,
) {
  return Object.fromEntries(
    Object.entries(properties).filter(
      ([key, value]) =>
        allowedProperties.has(key) &&
        (value === null ||
          ["string", "number", "boolean"].includes(typeof value)),
    ),
  );
}

export function sanitizeAnalyticsEvent(event: CaptureResult | null) {
  if (!event) return null;
  event.properties = sanitizeAnalyticsProperties(event.properties);
  delete event.$set;
  delete event.$set_once;
  delete event.$unset;
  return event;
}

export const analyticsPrivacyConfig = {
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: true,
  disable_session_recording: true,
  disable_surveys: true,
  disable_product_tours: true,
  disable_conversations: true,
  save_referrer: false,
  save_campaign_params: false,
  sanitize_properties: sanitizeAnalyticsProperties,
  before_send: sanitizeAnalyticsEvent,
  person_profiles: "identified_only",
  property_denylist: ["left_rsn", "right_rsn", "rsn", "display_rsn"],
} satisfies Partial<PostHogConfig>;
