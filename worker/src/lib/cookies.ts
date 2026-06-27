export function getRequestIp(req: Request): string | null {
  return req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For") || null;
}

export function parseCookies(req: Request): Record<string, string> {
  const cookieHeader = req.headers.get("Cookie") || "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const separatorIndex = cookie.indexOf("=");
        if (separatorIndex === -1) {
          return [cookie, ""];
        }
        const name = cookie.slice(0, separatorIndex).trim();
        const value = cookie.slice(separatorIndex + 1).trim();
        return [name, decodeURIComponent(value)];
      }),
  );
}

type CookieOptions = {
  maxAge?: number;
  expires?: Date;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
};

export function createCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  parts.push(`Path=${options.path || "/"}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.secure !== false) parts.push("Secure");
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  return parts.join("; ");
}

export function clearCookie(name: string): string {
  return createCookie(name, "", { maxAge: 0, expires: new Date(0) });
}

export function appendSetCookieHeaders(headers: Headers, cookies: string | string[]): void {
  const list = Array.isArray(cookies) ? cookies : [cookies];
  for (const cookie of list) {
    headers.append("Set-Cookie", cookie);
  }
}
