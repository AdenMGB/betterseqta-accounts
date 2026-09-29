import type { Env } from "../types/env";

export function getBsplusBaseUrl(env: Env): string {
  const cfDev = env.CF_DEV === "1" || env.CF_DEV === "true";
  if (cfDev && env.DEV_BSPLUS_URL?.trim()) {
    return env.DEV_BSPLUS_URL.trim().replace(/\/$/, "");
  }
  return (env.BSPLUS_URL?.trim() || "https://betterseqta.org").replace(/\/$/, "");
}

export function cleanEnvVar(value: string | undefined): string | null {
  if (!value) return null;
  let cleaned = String(value).trim();
  cleaned = cleaned.replace(/^[A-Z_]+=/, "");
  cleaned = cleaned.replace(/^["']|["']$/g, "");
  const quotedMatch = cleaned.match(/["']([^"']+)["']/);
  if (quotedMatch) {
    cleaned = quotedMatch[1];
  }
  return cleaned.trim() || null;
}
