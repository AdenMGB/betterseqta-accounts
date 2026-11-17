/** OAuth clients may POST JSON (BetterSEQTA website) or application/x-www-form-urlencoded (RFC 6749). */
export async function readOAuthTokenFields(
  request: Request,
): Promise<{ code?: string; client_id?: string; client_secret?: string; refresh_token?: string }> {
  const contentType = request.headers.get("Content-Type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as {
      code?: string;
      client_id?: string;
      client_secret?: string;
      refresh_token?: string;
    };
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    return {
      code: params.get("code") ?? undefined,
      client_id: params.get("client_id") ?? undefined,
      client_secret: params.get("client_secret") ?? undefined,
      refresh_token: params.get("refresh_token") ?? undefined,
    };
  }

  // Fallback: try JSON, then form
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as {
      code?: string;
      client_id?: string;
      client_secret?: string;
      refresh_token?: string;
    };
  } catch {
    const params = new URLSearchParams(text);
    return {
      code: params.get("code") ?? undefined,
      client_id: params.get("client_id") ?? undefined,
      client_secret: params.get("client_secret") ?? undefined,
      refresh_token: params.get("refresh_token") ?? undefined,
    };
  }
}