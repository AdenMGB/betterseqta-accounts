export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  PFP_BUCKET: R2Bucket;
  JWT_SECRET: string;
  APP_URL?: string;
  SMTP2GO_FROM_EMAIL?: string;
  SMTP2GO_API_KEY?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  DISCORD_REDIRECT_URI?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
}
