import { corsHeaders } from "../constants";
import { authError, getUser } from "../lib/auth";
import { getBsplusBaseUrl } from "../lib/env-util";
import type { RequestContext } from "../types/context";

export async function handleFoundingSurveyStatus({
  env,
  request,
  jwtSecret,
}: RequestContext): Promise<Response> {
  const headers = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };
  const sessionUser = await getUser(request, jwtSecret);
  if (!sessionUser) {
    return authError("Unauthorized", 401, headers);
  }

  const userRow = await env.DB.prepare("SELECT signup_number FROM users WHERE id = ?")
    .bind(sessionUser.id)
    .first<{ signup_number: number | null }>();

  const signupNumber = userRow?.signup_number ?? null;
  const eligible = signupNumber != null && signupNumber >= 1 && signupNumber <= 2500;

  let completed = false;
  let surveyActive = true;

  const apiKey = env.BSPLUS_API_KEY?.trim();
  const baseUrl = getBsplusBaseUrl(env);

  if (apiKey && eligible) {
    try {
      const statusResponse = await fetch(`${baseUrl}/api/v1/surveys/founding-2500/status`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (statusResponse.ok) {
        const statusJson = (await statusResponse.json()) as { active?: boolean };
        surveyActive = statusJson.active !== false;
      }

      const responseLookup = await fetch(
        `${baseUrl}/api/v1/surveys/founding-2500/responses/${encodeURIComponent(sessionUser.id)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (responseLookup.ok) {
        const responseJson = (await responseLookup.json()) as { completed?: boolean };
        completed = Boolean(responseJson.completed);
      }
    } catch (error) {
      console.warn("[founding-survey-status] bsplus lookup failed:", error);
    }
  }

  return new Response(
    JSON.stringify({
      eligible,
      completed,
      survey_active: surveyActive,
      signup_number: signupNumber,
    }),
    { headers },
  );
}
