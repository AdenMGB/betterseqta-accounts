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
