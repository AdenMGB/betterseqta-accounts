export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  PFP_BUCKET: R2Bucket;
  JWT_SECRET: string;
  /** Shared secret for `POST /internal/tq-relay/revoke` on bs-edge-api */
  EDGE_RELAY_SECRET?: string;
  APP_URL?: string;
  SMTP2GO_FROM_EMAIL?: string;
  /** Worker secret only — never stored in D1 */
  SMTP2GO_API_KEY?: string;
  /** Comma-separated chrome-extension IDs allowed for BS+ OAuth redirect_uri */
  ALLOWED_CHROME_EXTENSION_IDS?: string;
  /** Comma-separated Firefox AMO add-on IDs (guid) for moz-extension OAuth redirect_uri */
  ALLOWED_MOZ_EXTENSION_IDS?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  DISCORD_REDIRECT_URI?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  MICROSOFT_CALENDAR_CLIENT_ID?: string;
  MICROSOFT_CALENDAR_CLIENT_SECRET?: string;
  MICROSOFT_CALENDAR_REDIRECT_URI?: string;
  BSPLUS_API_KEY?: string;
  BSPLUS_URL?: string;
  DEV_BSPLUS_URL?: string;
  CF_DEV?: string;
  /** Set to 1/true/yes/on to skip verification emails and login checks (temporary dev/staging only) */
  DISABLE_EMAIL_VERIFICATION?: string;
  /** Set to 0/false/off to silence temporary timetable relay observability logs */
  TQ_RELAY_OBS?: string;
  /** When set (e.g. https://bsapi.adenmgb.com), hot paths proxy to the Ubuntu edge API */
  BS_EDGE_API_URL?: string;
}
