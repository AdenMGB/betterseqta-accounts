const SHA256_HEX = /^[a-f0-9]{64}$/i;

export function isSha256Hex(value: string): boolean {
  return SHA256_HEX.test(value);
}

export async function hashOpaqueSecret(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Compare plaintext credential to stored SHA-256 hex or legacy plaintext row. */
export async function opaqueSecretMatches(plaintext: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  if (isSha256Hex(stored)) {
    const hashed = await hashOpaqueSecret(plaintext);
    return timingSafeEqualString(hashed.toLowerCase(), stored.toLowerCase());
  }
  return timingSafeEqualString(plaintext, stored);
}

export async function shouldUpgradeStoredSecret(stored: string): Promise<boolean> {
  return Boolean(stored) && !isSha256Hex(stored);
}