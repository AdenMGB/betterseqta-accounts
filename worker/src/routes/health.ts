import { corsHeaders } from "../constants";

export async function handleHealth(): Promise<Response> {
  return new Response(
    JSON.stringify({ ok: true, service: "accounts" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
