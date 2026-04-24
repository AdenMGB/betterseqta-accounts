import type { Env } from "../types/env";

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  env: Env,
  displayName: string | null = null,
): Promise<unknown> {
  const resetUrl = `${env.APP_URL || "https://accounts.betterseqta.org"}/reset-password?token=${token}`;
  const greeting = displayName ? `Hello ${displayName},` : "Hello,";

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #18181b;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #27272a; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #FF6B00 0%, #E66000 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Password Reset Request</h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 32px; background-color: #27272a;">
            <p style="font-size: 16px; margin-bottom: 20px; color: #e4e4e7;">${greeting}</p>
            <p style="font-size: 16px; margin-bottom: 24px; color: #e4e4e7;">We received a request to reset your password for your BetterSEQTA+ Account. Click the button below to reset your password:</p>
            
            <!-- Reset Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: #FF6B00; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">Reset Password</a>
            </div>
            
            <!-- Link Fallback -->
            <p style="font-size: 14px; color: #a1a1aa; margin-top: 24px;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #71717a; word-break: break-all; background: #18181b; padding: 12px; border-radius: 6px; border: 1px solid #3f3f46; margin: 8px 0 24px 0;">${resetUrl}</p>
            
            <!-- Warning Box -->
            <div style="background: #3f3f46; border-left: 4px solid #FF6B00; padding: 16px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0; font-size: 14px; color: #e4e4e7;"><strong style="color: #FF6B00;">Important:</strong> This link will expire in 1 hour. If you didn't request this password reset, you may safely ignore this email.</p>
            </div>
            
            <!-- Footer -->
            <p style="font-size: 14px; color: #a1a1aa; margin-top: 32px; padding-top: 24px; border-top: 1px solid #3f3f46;">Best regards,<br><span style="color: #FF6B00; font-weight: 600;">The BetterSEQTA+ Team</span></p>
        </div>
    </div>
</body>
</html>
        `;

  const emailText = `
Password Reset Request

${greeting}

We received a request to reset your password for your BetterSEQTA+ Account. Click the link below to reset your password:

${resetUrl}

Important: This link will expire in 1 hour. If you didn't request this password reset, you may safely ignore this email.

Best regards,
The BetterSEQTA+ Team
        `;

  const smtp2goUrl = "https://api.smtp2go.com/v3/email/send";
  const requestBody = {
    sender: env.SMTP2GO_FROM_EMAIL || "noreply@betterseqta.org",
    to: [email],
    subject: "Reset Your Password - BetterSEQTA+",
    html_body: emailHtml,
    text_body: emailText,
  };

  const response = await fetch(smtp2goUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Smtp2go-Api-Key": env.SMTP2GO_API_KEY as string,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SMTP2GO API error: ${response.status} - ${errorText}`);
  }

  const result = (await response.json()) as { data?: { error?: string } };
  if (result.data && result.data.error) {
    throw new Error(`SMTP2GO API error: ${result.data.error}`);
  }

  return result;
}
