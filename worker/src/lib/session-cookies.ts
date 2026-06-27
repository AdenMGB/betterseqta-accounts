import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  WEBSITE_ACCESS_EXPIRES_IN,
  WEBSITE_REFRESH_EXPIRY_DAYS,
} from "../constants";
import { clearCookie, createCookie } from "./cookies";

export function createAccessTokenCookie(accessToken: string): string {
  return createCookie(ACCESS_COOKIE_NAME, accessToken, { maxAge: WEBSITE_ACCESS_EXPIRES_IN });
}

export function createRefreshTokenCookie(refreshToken: string): string {
  return createCookie(REFRESH_COOKIE_NAME, refreshToken, {
    maxAge: WEBSITE_REFRESH_EXPIRY_DAYS * 24 * 60 * 60,
  });
}

export function websiteSessionCookies(accessToken: string, refreshToken: string): string[] {
  return [createAccessTokenCookie(accessToken), createRefreshTokenCookie(refreshToken)];
}

export function clearWebsiteSessionCookies(): string[] {
  return [clearCookie(ACCESS_COOKIE_NAME), clearCookie(REFRESH_COOKIE_NAME)];
}
