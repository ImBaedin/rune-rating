import posthog from "posthog-js";
import { analyticsPrivacyConfig } from "../../src/features/analyticsPrivacy";

document.documentElement.dataset.analyticsHarness = "loaded";
posthog.init("test-project-token", {
  ...analyticsPrivacyConfig,
  api_host: location.origin,
  defaults: "2026-05-30",
  disable_external_dependency_loading: true,
  advanced_disable_flags: true,
  disable_compression: true,
  opt_out_useragent_filter: true,
  request_batching: false,
  loaded(client) {
    document.documentElement.dataset.analyticsHarness = "initialized";
    client.register({
      $initial_current_url: location.href,
      $initial_referrer: "https://example.test/SecretPlayer",
      arbitrary: "SecretPlayer",
    });
    client.capture("$pageview", {
      page: "rating",
      rsn_hash: "hashed-name",
      $set_once: { name: "SecretPlayer" },
    });
    client.capture("share_or_copy_clicked", {
      page: "rating",
      action: "copy_link",
      rsn_hash: "hashed-name",
    });
    window.dispatchEvent(new Event("pagehide"));
  },
});
