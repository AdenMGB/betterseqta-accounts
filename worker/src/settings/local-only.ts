import type { LocalOnlyConfig } from "../lib/settings-patch";

export const desqtaLocalOnly: LocalOnlyConfig = {
  hiddenKeys: [
    "cloud_settings_server_revision",
    "cloud_settings_server_updated_at",
    "last_synced_cloud_pfp_url",
    "dashboard_widgets_layout",
    "sidebar_recent_activity",
    "ok",
    "server",
  ],
};

export const bsplusLocalOnly: LocalOnlyConfig = {
  hiddenKeys: [
    "bsplus_token",
    "bsplus_refresh_token",
    "bsplus_client_id",
    "bsplus_user",
    "cloudAccessToken",
    "cloudUsername",
    "plugin.assessments-average.storage.assessments",
    "plugin.assessments-average.storage.weightings",
    "bsplus_cloud_settings_known_remote_updated_at",
    "bsplus_lastCloudPoll",
    "bsplus_pending_theme_ensure_after_cloud",
    "ok",
    "server",
  ],
  hiddenKeyPrefixes: ["plugin.global-search.storage.", "bsplus.analytics."],
};
