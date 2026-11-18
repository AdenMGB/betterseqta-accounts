export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  PFP_BUCKET: R2Bucket;
  JWT_SECRET: string;
  /** Shared secret for `POST /internal/tq-relay/revoke` on bs-edge-api */
  EDGE_RELAY_SECRET?: string;
  APP_URL?: string;
  SMTP2GO_FROM_EMAIL?: string;
  SMTP2GO_API_KEY?: string;
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
  /** Set to 0/false/off to silence temporary timetable relay observability logs */
  TQ_RELAY_OBS?: string;
  /** When set (e.g. https://bsapi.adenmgb.com), hot paths proxy to the Ubuntu edge API */
  BS_EDGE_API_URL?: string;
}
