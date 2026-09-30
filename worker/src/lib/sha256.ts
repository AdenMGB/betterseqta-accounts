export async function sha256HexBytes(bytes: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256HexUtf8(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  return sha256HexBytes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
