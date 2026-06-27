export const BSPLUS_SYNC_SCHEMA_VERSION = 1;
export const BSPLUS_SYNC_MAX_BYTES = 2 * 1024 * 1024;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-ID, X-API-Key",
} as const;

export const ACCESS_TOKEN_TTL = "1h";
export const WEBSITE_ACCESS_EXPIRES_IN = 60 * 60;
export const WEBSITE_REFRESH_EXPIRY_DAYS = 180;
export const APP_REFRESH_EXPIRY_DAYS = 180;
export const DESQTA_CLIENT_TTL_DAYS = 7;
export const ACCESS_COOKIE_NAME = "bs_access_token";
export const REFRESH_COOKIE_NAME = "bs_refresh_token";
