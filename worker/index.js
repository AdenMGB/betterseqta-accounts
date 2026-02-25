import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const jwtSecret = new TextEncoder().encode(env.JWT_SECRET);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-ID',
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- Helper: Verify Auth ---
    async function getUser(req) {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
        const token = authHeader.split(" ")[1];
        try {
            const { payload } = await jwtVerify(token, jwtSecret);
            return payload;
        } catch (e) {
            return null;
        }
    }

    // --- Helper: Get User Admin Level ---
    async function getUserAdminLevel(userId) {
        const user = await env.DB.prepare("SELECT admin_level FROM users WHERE id = ?").bind(userId).first();
        return user ? (user.admin_level || 0) : 0;
    }

    // --- Helper: Verify Admin (any level) ---
    async function getAdminUser(req) {
        const payload = await getUser(req);
        if (!payload) return null;
        // Check DB for latest admin status
        const user = await env.DB.prepare("SELECT admin_level FROM users WHERE id = ?").bind(payload.id).first();
        if (user && (user.admin_level || 0) > 0) return payload;
        return null;
    }

    // --- Helper: Get Admin User with Level ---
    async function getAdminUserWithLevel(req) {
        const payload = await getUser(req);
        if (!payload) return null;
        const user = await env.DB.prepare("SELECT admin_level FROM users WHERE id = ?").bind(payload.id).first();
        if (user && (user.admin_level || 0) > 0) {
            return { ...payload, adminLevel: user.admin_level || 0 };
        }
        return null;
    }

    // --- Helper: Get Maximum Admin Level ---
    async function getMaxAdminLevel() {
        const result = await env.DB.prepare("SELECT MAX(admin_level) as max_level FROM users WHERE admin_level > 0").first();
        // Use the highest admin level that exists in the database
        // Default to 3 if no admins exist yet (for backward compatibility with existing systems)
        const maxLevel = result?.max_level || 3;
        // Ensure we return at least 3 as the minimum maximum (for systems that haven't migrated yet)
        return Math.max(maxLevel, 3);
    }

    // --- API: Register ---
    if (url.pathname === "/api/auth/register" && request.method === "POST") {
      try {
        const { email, password, username, displayName } = await request.json();
        if (!email || !password || !username) {
             return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Normalize email to lowercase for case-insensitive handling
        const normalizedEmail = email.toLowerCase().trim();

        const id = crypto.randomUUID();
        const hashedPassword = await bcrypt.hash(password, 10);

        try {
            // Default admin_level is handled by DB default (0), but we can be explicit if needed.
            await env.DB.prepare(
                "INSERT INTO users (id, email, password, username, displayName, admin_level) VALUES (?, ?, ?, ?, ?, ?)"
            ).bind(id, normalizedEmail, hashedPassword, username, displayName || username, 0).run();
        } catch (e) {
            return new Response(JSON.stringify({ error: "User already exists" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const token = await new SignJWT({ id, email: normalizedEmail, username })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('7d')
            .sign(jwtSecret);

        return new Response(JSON.stringify({ token, user: { id, email: normalizedEmail, username, displayName, admin_level: 0 } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (err) {
        return new Response(err.message, { status: 500, headers: corsHeaders });
      }
    }

    // --- API: Login ---
    if (url.pathname === "/api/auth/login" && request.method === "POST") {
        try {
            const { login, password } = await request.json();
            // Normalize login to lowercase if it's an email (contains @), otherwise keep as-is for username
            const normalizedLogin = login.includes('@') ? login.toLowerCase().trim() : login;
            const user = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR username = ?").bind(normalizedLogin, login).first();

            if (!user || !(await bcrypt.compare(password, user.password))) {
                return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const token = await new SignJWT({ id: user.id, email: user.email, username: user.username })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('7d')
                .sign(jwtSecret);

            return new Response(JSON.stringify({ token, user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, pfpUrl: user.pfpUrl, admin_level: user.admin_level || 0 } }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        } catch (err) {
            return new Response(err.message, { status: 500, headers: corsHeaders });
        }
    }

    // --- API: Me ---
    if (url.pathname === "/api/auth/me" && request.method === "GET") {
        const payload = await getUser(request);
        if (!payload) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

        const user = await env.DB.prepare("SELECT id, email, username, displayName, pfpUrl, admin_level FROM users WHERE id = ?").bind(payload.id).first();
        return new Response(JSON.stringify(user), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- API: Change Password ---
    if (url.pathname === "/api/auth/change-password" && request.method === "POST") {
        const userPayload = await getUser(request);
        if (!userPayload) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

        try {
            const { currentPassword, newPassword } = await request.json();
            if (!currentPassword || !newPassword) {
                return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // Get current user password hash
            const user = await env.DB.prepare("SELECT password FROM users WHERE id = ?").bind(userPayload.id).first();
            if (!user) return new Response("User not found", { status: 404, headers: corsHeaders });

            // Verify current password
            const valid = await bcrypt.compare(currentPassword, user.password);
            if (!valid) {
                 return new Response(JSON.stringify({ error: "Invalid current password" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password
            await env.DB.prepare("UPDATE users SET password = ? WHERE id = ?").bind(hashedPassword, userPayload.id).run();

            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        } catch (e) {
            return new Response(e.message, { status: 500, headers: corsHeaders });
        }
    }

    // --- API: Change Email ---
    if (url.pathname === "/api/auth/change-email" && request.method === "POST") {
        const userPayload = await getUser(request);
        if (!userPayload) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

        try {
            const { newEmail, password } = await request.json();
            if (!newEmail || !password) {
                return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(newEmail)) {
                return new Response(JSON.stringify({ error: "Invalid email format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // Normalize email to lowercase for case-insensitive handling
            const normalizedNewEmail = newEmail.toLowerCase().trim();

            // Get current user password hash
            const user = await env.DB.prepare("SELECT password, email FROM users WHERE id = ?").bind(userPayload.id).first();
            if (!user) return new Response("User not found", { status: 404, headers: corsHeaders });

            // Verify password
            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
                return new Response(JSON.stringify({ error: "Invalid password" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // Check if new email is different from current (case-insensitive comparison)
            if (user.email.toLowerCase() === normalizedNewEmail) {
                return new Response(JSON.stringify({ error: "New email must be different from current email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // Check if new email already exists (case-insensitive)
            const existingUser = await env.DB.prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?)").bind(normalizedNewEmail).first();
            if (existingUser) {
                return new Response(JSON.stringify({ error: "Email already in use" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // Update email
            await env.DB.prepare("UPDATE users SET email = ? WHERE id = ?").bind(normalizedNewEmail, userPayload.id).run();

            return new Response(JSON.stringify({ success: true, email: normalizedNewEmail }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        } catch (e) {
            // Handle unique constraint violation
            if (e.message && e.message.includes("UNIQUE constraint")) {
                return new Response(JSON.stringify({ error: "Email already in use" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            return new Response(e.message, { status: 500, headers: corsHeaders });
        }
    }

    // --- Helper: Send Password Reset Email via SMTP2GO ---
    async function sendPasswordResetEmail(email, token, env, displayName = null) {
        const resetUrl = `${env.APP_URL || 'https://accounts.betterseqta.org'}/reset-password?token=${token}`;
        const greeting = displayName ? `Hello ${displayName},` : 'Hello,';
        
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

        const smtp2goUrl = 'https://api.smtp2go.com/v3/email/send';
        const requestBody = {
            sender: env.SMTP2GO_FROM_EMAIL || 'noreply@betterseqta.org',
            to: [email],
            subject: 'Reset Your Password - BetterSEQTA+',
            html_body: emailHtml,
            text_body: emailText
        };

        const response = await fetch(smtp2goUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Smtp2go-Api-Key': env.SMTP2GO_API_KEY
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SMTP2GO API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        if (result.data && result.data.error) {
            throw new Error(`SMTP2GO API error: ${result.data.error}`);
        }

        return result;
    }

    // --- API: Forgot Password (Request Reset) ---
    if (url.pathname === "/api/auth/forgot-password" && request.method === "POST") {
        try {
            const { login } = await request.json();
            if (!login) {
                return new Response(JSON.stringify({ error: "Missing email or username" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // Normalize login to lowercase if it's an email (contains @), otherwise keep as-is for username
            const normalizedLogin = login.includes('@') ? login.toLowerCase().trim() : login;
            // Look up user by email or username (case-insensitive for email)
            const user = await env.DB.prepare("SELECT id, email, displayName FROM users WHERE LOWER(email) = LOWER(?) OR username = ?").bind(normalizedLogin, login).first();

            // Check for rate limiting: 5-minute cooldown
            if (user) {
                const recentToken = await env.DB.prepare(
                    "SELECT created_at FROM password_reset_tokens WHERE user_id = ? AND used = 0 ORDER BY created_at DESC LIMIT 1"
                ).bind(user.id).first();

                if (recentToken) {
                    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300; // 5 minutes in seconds
                    if (recentToken.created_at > fiveMinutesAgo) {
                        const secondsRemaining = recentToken.created_at - fiveMinutesAgo;
                        return new Response(JSON.stringify({ 
                            error: "Please wait before requesting another reset email", 
                            retryAfter: secondsRemaining 
                        }), { 
                            status: 429, 
                            headers: { ...corsHeaders, "Content-Type": "application/json" } 
                        });
                    }
                }
            }

            // If user exists, generate reset token and send email
            if (user) {
                // Invalidate any existing unused tokens for this user
                await env.DB.prepare("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0").bind(user.id).run();

                // Generate secure token
                const token = crypto.randomUUID();
                const hashedToken = await bcrypt.hash(token, 10);
                const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

                // Store token in database
                await env.DB.prepare(
                    "INSERT INTO password_reset_tokens (token, user_id, expires_at, used) VALUES (?, ?, ?, 0)"
                ).bind(hashedToken, user.id, expiresAt).run();

                // Send email via SMTP2GO
                try {
                    await sendPasswordResetEmail(user.email, token, env, user.displayName || null);
                } catch (emailError) {
                    console.error("Failed to send reset email:", emailError);
                    // Don't expose email sending errors to client for security
                }
            }

            // Always return success to prevent email enumeration
            return new Response(JSON.stringify({ 
                success: true, 
                message: "If an account exists, a reset email has been sent. Please check your inbox, spam, and other folders." 
            }), { 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });

        } catch (err) {
            console.error("Forgot password error:", err);
            return new Response(JSON.stringify({ error: "An error occurred" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
    }

    // --- API: Verify Reset Token ---
    if (url.pathname === "/api/auth/verify-reset-token" && request.method === "GET") {
        try {
            const token = url.searchParams.get("token");
            if (!token) {
                return new Response(JSON.stringify({ valid: false, reason: "missing" }), { 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            // Get all tokens for this user (we need to check against hashed tokens)
            const tokens = await env.DB.prepare(
                "SELECT token, expires_at, used FROM password_reset_tokens WHERE expires_at > ? AND used = 0"
            ).bind(Math.floor(Date.now() / 1000)).all();

            let validToken = null;
            for (const dbToken of tokens.results) {
                if (await bcrypt.compare(token, dbToken.token)) {
                    validToken = dbToken;
                    break;
                }
            }

            if (!validToken) {
                return new Response(JSON.stringify({ valid: false, reason: "invalid" }), { 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            if (validToken.expires_at < Math.floor(Date.now() / 1000)) {
                return new Response(JSON.stringify({ valid: false, reason: "expired" }), { 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            if (validToken.used) {
                return new Response(JSON.stringify({ valid: false, reason: "used" }), { 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            return new Response(JSON.stringify({ valid: true }), { 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });

        } catch (err) {
            return new Response(JSON.stringify({ valid: false, reason: "error" }), { 
                status: 500, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
    }

    // --- API: Reset Password ---
    if (url.pathname === "/api/auth/reset-password" && request.method === "POST") {
        try {
            const { token, newPassword } = await request.json();
            if (!token || !newPassword) {
                return new Response(JSON.stringify({ error: "Missing token or password" }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            // Validate password strength
            if (newPassword.length < 8) {
                return new Response(JSON.stringify({ error: "Password must be at least 8 characters long" }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            // Get all unused, non-expired tokens
            const tokens = await env.DB.prepare(
                "SELECT token, user_id, expires_at, used FROM password_reset_tokens WHERE expires_at > ? AND used = 0"
            ).bind(Math.floor(Date.now() / 1000)).all();

            let validToken = null;
            let userId = null;
            for (const dbToken of tokens.results) {
                if (await bcrypt.compare(token, dbToken.token)) {
                    validToken = dbToken;
                    userId = dbToken.user_id;
                    break;
                }
            }

            if (!validToken) {
                return new Response(JSON.stringify({ error: "Invalid or expired reset token" }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            if (validToken.expires_at < Math.floor(Date.now() / 1000)) {
                return new Response(JSON.stringify({ error: "Reset token has expired" }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            if (validToken.used) {
                return new Response(JSON.stringify({ error: "This reset token has already been used" }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update user password
            await env.DB.prepare("UPDATE users SET password = ? WHERE id = ?").bind(hashedPassword, userId).run();

            // Mark token as used
            await env.DB.prepare("UPDATE password_reset_tokens SET used = 1 WHERE token = ?").bind(validToken.token).run();

            return new Response(JSON.stringify({ success: true }), { 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });

        } catch (err) {
            console.error("Reset password error:", err);
            return new Response(JSON.stringify({ error: "An error occurred" }), { 
                status: 500, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
    }

    // --- API: OAuth Endpoints ---
    
    // Check Client (public)
    if (url.pathname === "/api/oauth/client" && request.method === "GET") {
        const clientId = url.searchParams.get("client_id");
        if (!clientId) return new Response("Missing client_id", { status: 400, headers: corsHeaders });

        const client = await env.DB.prepare("SELECT name, redirect_uri FROM oauth_clients WHERE id = ?").bind(clientId).first();
        if (!client) return new Response("Invalid Client", { status: 404, headers: corsHeaders });

        return new Response(JSON.stringify(client), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Approve & Generate Code (Authenticated)
    if (url.pathname === "/api/oauth/approve" && request.method === "POST") {
        const user = await getUser(request);
        if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

        const { client_id, redirect_uri } = await request.json();
        const client = await env.DB.prepare("SELECT id FROM oauth_clients WHERE id = ? AND redirect_uri = ?").bind(client_id, redirect_uri).first();
        
        if (!client) return new Response("Invalid Client or Redirect URI", { status: 400, headers: corsHeaders });

        const code = crypto.randomUUID();
        const expiresAt = Math.floor(Date.now() / 1000) + 600; // 10 minutes

        await env.DB.prepare("INSERT INTO oauth_codes (code, client_id, user_id, expires_at) VALUES (?, ?, ?, ?)")
            .bind(code, client_id, user.id, expiresAt).run();

        // Construct redirect URL
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set("code", code);

        return new Response(JSON.stringify({ redirectUrl: redirectUrl.toString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Exchange Token (Public/Server-to-Server)
    if (url.pathname === "/api/oauth/token" && request.method === "POST") {
        const { code, client_id, client_secret } = await request.json();

        // Verify Client Secret
        const client = await env.DB.prepare("SELECT id FROM oauth_clients WHERE id = ? AND secret = ?").bind(client_id, client_secret).first();
        if (!client) return new Response(JSON.stringify({ error: "invalid_client" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        // Verify Code
        const oauthCode = await env.DB.prepare("SELECT user_id, expires_at FROM oauth_codes WHERE code = ? AND client_id = ?").bind(code, client_id).first();
        if (!oauthCode) return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        if (oauthCode.expires_at < Math.floor(Date.now() / 1000)) {
            return new Response(JSON.stringify({ error: "code_expired" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Delete code (single use)
        await env.DB.prepare("DELETE FROM oauth_codes WHERE code = ?").bind(code).run();

        // Generate Access Token (JWT)
        const user = await env.DB.prepare("SELECT id, email, username FROM users WHERE id = ?").bind(oauthCode.user_id).first();
        
        const access_token = await new SignJWT({ id: user.id, email: user.email, username: user.username })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('1h')
            .sign(jwtSecret);

        return new Response(JSON.stringify({ 
            access_token, 
            token_type: "Bearer", 
            expires_in: 3600,
            user: { id: user.id, username: user.username } // Optional but helpful
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // User Info (Authenticated with Access Token)
    if (url.pathname === "/api/oauth/userinfo" && request.method === "GET") {
        const user = await getUser(request);
        if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

        const userData = await env.DB.prepare("SELECT id, email, username, displayName, pfpUrl, admin_level FROM users WHERE id = ?").bind(user.id).first();
        return new Response(JSON.stringify(userData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- Desqta API Endpoints ---

    const DESQTA_CLIENT_TTL_DAYS = 7;

    // Helper: Validate Desqta client_id (checks oauth_clients OR desqta_reserved_clients)
    async function getDesqtaClient(clientId, redirectUri) {
        const oauth = await env.DB.prepare("SELECT id, redirect_uri FROM oauth_clients WHERE id = ?").bind(clientId).first();
        if (oauth) return { valid: true, redirect_uri: oauth.redirect_uri, isReserved: false };
        const reserved = await env.DB.prepare("SELECT id, redirect_uri, expires_at FROM desqta_reserved_clients WHERE id = ?").bind(clientId).first();
        if (reserved) {
            const now = Math.floor(Date.now() / 1000);
            if (reserved.expires_at != null && reserved.expires_at < now) {
                return { valid: false };
            }
            return { valid: true, redirect_uri: reserved.redirect_uri, isReserved: true };
        }
        return { valid: false };
    }

    async function validateDesqtaClient(clientId, redirectUri) {
        const client = await getDesqtaClient(clientId, redirectUri);
        if (!client.valid) return false;
        return redirectUri ? client.redirect_uri === redirectUri : true;
    }

    async function touchDesqtaReservedClient(clientId) {
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + (DESQTA_CLIENT_TTL_DAYS * 24 * 60 * 60);
        await env.DB.prepare("UPDATE desqta_reserved_clients SET expires_at = ? WHERE id = ?").bind(expiresAt, clientId).run();
    }

    // POST /api/desqta/client/reserve - Reserve a client_id (public, no auth required)
    if (url.pathname === "/api/desqta/client/reserve" && request.method === "POST") {
        try {
            const body = await request.json().catch(() => ({}));
            const redirectUri = body?.redirect_uri || 'desqta://auth/callback';
            if (typeof redirectUri !== 'string' || !redirectUri.trim()) {
                return new Response(JSON.stringify({ error: "redirect_uri must be a non-empty string" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }
            const clientId = crypto.randomUUID();
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = now + (DESQTA_CLIENT_TTL_DAYS * 24 * 60 * 60);
            await env.DB.prepare(
                "INSERT INTO desqta_reserved_clients (id, redirect_uri, expires_at) VALUES (?, ?, ?)"
            ).bind(clientId, redirectUri.trim(), expiresAt).run();

            const baseUrl = env.APP_URL || 'https://accounts.betterseqta.org';
            return new Response(JSON.stringify({
                client_id: clientId,
                redirect_uri: redirectUri.trim(),
                api_url: baseUrl,
                config_url: `${baseUrl}/api/desqta/config`,
                refresh_url: `${baseUrl}/api/desqta/refresh`,
                login_url: `${baseUrl}/api/desqta/login`,
                discord_auth_url: `${baseUrl}/api/oauth/desqta/discord`
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (err) {
            console.error("Desqta reserve client error:", err);
            return new Response(JSON.stringify({ error: "Failed to reserve client" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }
    }

    // GET /api/desqta/config - Returns client config for Desqta (public)
    if (url.pathname === "/api/desqta/config" && request.method === "GET") {
        const clientId = url.searchParams.get("client_id");
        if (!clientId) {
            return new Response(JSON.stringify({ error: "Missing client_id" }), { 
                status: 400, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
        const client = await getDesqtaClient(clientId);
        if (!client.valid) {
            return new Response(JSON.stringify({ error: "Invalid client_id" }), { 
                status: 404, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
        await touchDesqtaReservedClient(clientId);
        const baseUrl = env.APP_URL || 'https://accounts.betterseqta.org';
        return new Response(JSON.stringify({
            client_id: clientId,
            api_url: baseUrl,
            refresh_url: `${baseUrl}/api/desqta/refresh`,
            discord_auth_url: `${baseUrl}/api/oauth/desqta/discord`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /api/desqta/refresh - Exchange refresh token for new access token
    if (url.pathname === "/api/desqta/refresh" && request.method === "POST") {
        try {
            const body = await request.json();
            const { refresh_token, client_id } = body || {};
            if (!refresh_token) {
                return new Response(JSON.stringify({ error: "Missing refresh_token" }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
            const colonIdx = refresh_token.indexOf(':');
            if (colonIdx < 1) {
                return new Response(JSON.stringify({ error: "Invalid refresh_token format" }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
            const sessionId = refresh_token.substring(0, colonIdx);
            const secret = refresh_token.substring(colonIdx + 1);

            const session = await env.DB.prepare("SELECT * FROM desqta_sessions WHERE id = ?").bind(sessionId).first();
            if (!session) {
                return new Response(JSON.stringify({ error: "Invalid refresh_token" }), { 
                    status: 401, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
            // Allow refresh from any client_id to support multi-device (e.g. tokens synced across DesQTA instances)
            const effectiveClientId = client_id || session.client_id;
            const now = Math.floor(Date.now() / 1000);
            if (session.expires_at < now) {
                return new Response(JSON.stringify({ error: "Refresh token expired" }), { 
                    status: 401, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
            const valid = await bcrypt.compare(secret, session.refresh_token_hash);
            if (!valid) {
                return new Response(JSON.stringify({ error: "Invalid refresh_token" }), { 
                    status: 401, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            const user = await env.DB.prepare("SELECT id, email, username, displayName, pfpUrl, admin_level FROM users WHERE id = ?").bind(session.user_id).first();
            if (!user) {
                return new Response(JSON.stringify({ error: "User not found" }), { 
                    status: 401, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
            await touchDesqtaReservedClient(effectiveClientId);

            // Generate new access token (1h)
            const accessToken = await new SignJWT({ id: user.id, email: user.email, username: user.username })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('1h')
                .sign(jwtSecret);

            // Rolling: rotate refresh token (keep session bound to original client_id for multi-device compatibility)
            const newSessionId = crypto.randomUUID();
            const newSecret = crypto.getRandomValues(new Uint8Array(32));
            const newSecretB64 = btoa(String.fromCharCode(...newSecret));
            const newRefreshTokenHash = await bcrypt.hash(newSecretB64, 10);
            const REFRESH_EXPIRY_DAYS = 90;
            const newExpiresAt = now + (REFRESH_EXPIRY_DAYS * 24 * 60 * 60);

            await env.DB.prepare("DELETE FROM desqta_sessions WHERE id = ?").bind(sessionId).run();
            await env.DB.prepare(
                "INSERT INTO desqta_sessions (id, user_id, client_id, refresh_token_hash, expires_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)"
            ).bind(newSessionId, user.id, effectiveClientId, newRefreshTokenHash, newExpiresAt, now).run();

            const newRefreshToken = `${newSessionId}:${newSecretB64}`;

            return new Response(JSON.stringify({
                access_token: accessToken,
                token_type: "Bearer",
                expires_in: 3600,
                refresh_token: newRefreshToken,
                user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, pfpUrl: user.pfpUrl, admin_level: user.admin_level || 0 }
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (err) {
            console.error("Desqta refresh error:", err);
            return new Response(JSON.stringify({ error: "Refresh failed" }), { 
                status: 500, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
    }

    // POST /api/desqta/login - Email/password login for Desqta (returns access + refresh tokens)
    if (url.pathname === "/api/desqta/login" && request.method === "POST") {
        try {
            const body = await request.json();
            const { client_id, redirect_uri, login, password } = body || {};
            if (!client_id || !redirect_uri || !login || !password) {
                return new Response(JSON.stringify({ error: "Missing client_id, redirect_uri, login, or password" }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            const clientValid = await validateDesqtaClient(client_id, redirect_uri);
            if (!clientValid) {
                return new Response(JSON.stringify({ error: "Invalid client_id or redirect_uri" }), { 
                    status: 401, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
            await touchDesqtaReservedClient(client_id);

            const normalizedLogin = login.includes('@') ? login.toLowerCase().trim() : login;
            const user = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR username = ?").bind(normalizedLogin, login).first();

            if (!user || !(await bcrypt.compare(password, user.password))) {
                return new Response(JSON.stringify({ error: "Invalid credentials" }), { 
                    status: 401, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            // Generate access token (24h)
            const accessToken = await new SignJWT({ id: user.id, email: user.email, username: user.username })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('24h')
                .sign(jwtSecret);

            // Create desqta session for refresh token
            const sessionId = crypto.randomUUID();
            const secret = crypto.getRandomValues(new Uint8Array(32));
            const secretB64 = btoa(String.fromCharCode(...secret));
            const refreshTokenHash = await bcrypt.hash(secretB64, 10);
            const REFRESH_EXPIRY_DAYS = 90;
            const expiresAt = Math.floor(Date.now() / 1000) + (REFRESH_EXPIRY_DAYS * 24 * 60 * 60);

            await env.DB.prepare(
                "INSERT INTO desqta_sessions (id, user_id, client_id, refresh_token_hash, expires_at) VALUES (?, ?, ?, ?, ?)"
            ).bind(sessionId, user.id, client_id, refreshTokenHash, expiresAt).run();

            const refreshToken = `${sessionId}:${secretB64}`;

            return new Response(JSON.stringify({
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_in: 86400,
                user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, pfpUrl: user.pfpUrl, admin_level: user.admin_level || 0 }
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (err) {
            console.error("Desqta login error:", err);
            return new Response(JSON.stringify({ error: "Login failed" }), { 
                status: 500, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
    }

    // --- BetterSEQTA Plus API Endpoints (same flow as DesQTA, dedicated for browser extension) ---

    // POST /api/bsplus/client/reserve - Reserve a client_id for BetterSEQTA Plus (public)
    if (url.pathname === "/api/bsplus/client/reserve" && request.method === "POST") {
        try {
            const body = await request.json().catch(() => ({}));
            const redirectUri = body?.redirect_uri || 'https://accounts.betterseqta.org/auth/bsplus/callback';
            if (typeof redirectUri !== 'string' || !redirectUri.trim()) {
                return new Response(JSON.stringify({ error: "redirect_uri must be a non-empty string" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }
            const clientId = crypto.randomUUID();
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = now + (DESQTA_CLIENT_TTL_DAYS * 24 * 60 * 60);
            await env.DB.prepare(
                "INSERT INTO desqta_reserved_clients (id, redirect_uri, expires_at) VALUES (?, ?, ?)"
            ).bind(clientId, redirectUri.trim(), expiresAt).run();

            const baseUrl = env.APP_URL || 'https://accounts.betterseqta.org';
            return new Response(JSON.stringify({
                client_id: clientId,
                redirect_uri: redirectUri.trim(),
                api_url: baseUrl,
                config_url: `${baseUrl}/api/bsplus/config`,
                refresh_url: `${baseUrl}/api/bsplus/refresh`,
                login_url: `${baseUrl}/api/bsplus/login`,
                discord_auth_url: `${baseUrl}/api/oauth/bsplus/discord`
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (err) {
            console.error("BS Plus reserve client error:", err);
            return new Response(JSON.stringify({ error: "Failed to reserve client" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }
    }

    // GET /api/bsplus/config - Returns client config for BetterSEQTA Plus (public)
    if (url.pathname === "/api/bsplus/config" && request.method === "GET") {
        const clientId = url.searchParams.get("client_id");
        if (!clientId) {
            return new Response(JSON.stringify({ error: "Missing client_id" }), { 
                status: 400, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
        const client = await getDesqtaClient(clientId);
        if (!client.valid) {
            return new Response(JSON.stringify({ error: "Invalid client_id" }), { 
                status: 404, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
        await touchDesqtaReservedClient(clientId);
        const baseUrl = env.APP_URL || 'https://accounts.betterseqta.org';
        return new Response(JSON.stringify({
            client_id: clientId,
            api_url: baseUrl,
            refresh_url: `${baseUrl}/api/bsplus/refresh`,
            login_url: `${baseUrl}/api/bsplus/login`,
            discord_auth_url: `${baseUrl}/api/oauth/bsplus/discord`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /api/bsplus/refresh - Exchange refresh token for new access token
    if (url.pathname === "/api/bsplus/refresh" && request.method === "POST") {
        try {
            const body = await request.json();
            const { refresh_token, client_id } = body || {};
            if (!refresh_token) {
                return new Response(JSON.stringify({ error: "Missing refresh_token" }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
            const colonIdx = refresh_token.indexOf(':');
            if (colonIdx < 1) {
                return new Response(JSON.stringify({ error: "Invalid refresh_token format" }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
            const sessionId = refresh_token.substring(0, colonIdx);
            const secret = refresh_token.substring(colonIdx + 1);

            const session = await env.DB.prepare("SELECT * FROM desqta_sessions WHERE id = ?").bind(sessionId).first();
            if (!session) {
                return new Response(JSON.stringify({ error: "Invalid refresh_token" }), { 
                    status: 401, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
            // Allow refresh from any client_id to support multi-device (e.g. tokens synced across extension instances)
            const effectiveClientId = client_id || session.client_id;
            const now = Math.floor(Date.now() / 1000);
            if (session.expires_at < now) {
                return new Response(JSON.stringify({ error: "Refresh token expired" }), { 
                    status: 401, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
            const valid = await bcrypt.compare(secret, session.refresh_token_hash);
            if (!valid) {
                return new Response(JSON.stringify({ error: "Invalid refresh_token" }), { 
                    status: 401, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            const user = await env.DB.prepare("SELECT id, email, username, displayName, pfpUrl, admin_level FROM users WHERE id = ?").bind(session.user_id).first();
            if (!user) {
                return new Response(JSON.stringify({ error: "User not found" }), { 
                    status: 401, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
            await touchDesqtaReservedClient(effectiveClientId);

            const accessToken = await new SignJWT({ id: user.id, email: user.email, username: user.username })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('1h')
                .sign(jwtSecret);

            const newSessionId = crypto.randomUUID();
            const newSecret = crypto.getRandomValues(new Uint8Array(32));
            const newSecretB64 = btoa(String.fromCharCode(...newSecret));
            const newRefreshTokenHash = await bcrypt.hash(newSecretB64, 10);
            const REFRESH_EXPIRY_DAYS = 90;
            const newExpiresAt = now + (REFRESH_EXPIRY_DAYS * 24 * 60 * 60);

            await env.DB.prepare("DELETE FROM desqta_sessions WHERE id = ?").bind(sessionId).run();
            await env.DB.prepare(
                "INSERT INTO desqta_sessions (id, user_id, client_id, refresh_token_hash, expires_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)"
            ).bind(newSessionId, user.id, effectiveClientId, newRefreshTokenHash, newExpiresAt, now).run();

            const newRefreshToken = `${newSessionId}:${newSecretB64}`;

            return new Response(JSON.stringify({
                access_token: accessToken,
                token_type: "Bearer",
                expires_in: 3600,
                refresh_token: newRefreshToken,
                user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, pfpUrl: user.pfpUrl, admin_level: user.admin_level || 0 }
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (err) {
            console.error("BS Plus refresh error:", err);
            return new Response(JSON.stringify({ error: "Refresh failed" }), { 
                status: 500, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
    }

    // POST /api/bsplus/login - Email/username + password login for BetterSEQTA Plus (returns access + refresh tokens)
    if (url.pathname === "/api/bsplus/login" && request.method === "POST") {
        try {
            const body = await request.json();
            const { client_id, redirect_uri, login, password } = body || {};
            if (!client_id || !redirect_uri || !login || !password) {
                return new Response(JSON.stringify({ error: "Missing client_id, redirect_uri, login, or password" }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            const clientValid = await validateDesqtaClient(client_id, redirect_uri);
            if (!clientValid) {
                return new Response(JSON.stringify({ error: "Invalid client_id or redirect_uri" }), { 
                    status: 401, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
            await touchDesqtaReservedClient(client_id);

            const normalizedLogin = login.includes('@') ? login.toLowerCase().trim() : login;
            const user = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR username = ?").bind(normalizedLogin, login).first();

            if (!user || !(await bcrypt.compare(password, user.password))) {
                return new Response(JSON.stringify({ error: "Invalid credentials" }), { 
                    status: 401, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            const accessToken = await new SignJWT({ id: user.id, email: user.email, username: user.username })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('24h')
                .sign(jwtSecret);

            const sessionId = crypto.randomUUID();
            const secret = crypto.getRandomValues(new Uint8Array(32));
            const secretB64 = btoa(String.fromCharCode(...secret));
            const refreshTokenHash = await bcrypt.hash(secretB64, 10);
            const REFRESH_EXPIRY_DAYS = 90;
            const expiresAt = Math.floor(Date.now() / 1000) + (REFRESH_EXPIRY_DAYS * 24 * 60 * 60);

            await env.DB.prepare(
                "INSERT INTO desqta_sessions (id, user_id, client_id, refresh_token_hash, expires_at) VALUES (?, ?, ?, ?, ?)"
            ).bind(sessionId, user.id, client_id, refreshTokenHash, expiresAt).run();

            const refreshToken = `${sessionId}:${secretB64}`;

            return new Response(JSON.stringify({
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_in: 86400,
                user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, pfpUrl: user.pfpUrl, admin_level: user.admin_level || 0 }
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (err) {
            console.error("BS Plus login error:", err);
            return new Response(JSON.stringify({ error: "Login failed" }), { 
                status: 500, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
    }

    // --- Helper: Clean Environment Variable ---
    function cleanEnvVar(value) {
        if (!value) return null;
        let cleaned = String(value).trim();
        
        // Remove variable name prefix if present (e.g., "DISCORD_CLIENT_ID=")
        cleaned = cleaned.replace(/^[A-Z_]+=/, '');
        
        // Remove quotes from start and end
        cleaned = cleaned.replace(/^["']|["']$/g, '');
        
        // If still contains quotes, try to extract value between quotes
        const quotedMatch = cleaned.match(/["']([^"']+)["']/);
        if (quotedMatch) {
            cleaned = quotedMatch[1];
        }
        
        return cleaned.trim() || null;
    }

    // --- Discord OAuth Endpoints ---
    
    // Initiate Discord OAuth
    if (url.pathname === "/api/oauth/discord" && request.method === "GET") {
        // Clean environment variables with robust parsing
        const discordClientId = cleanEnvVar(env.DISCORD_CLIENT_ID);
        const discordRedirectUri = cleanEnvVar(env.DISCORD_REDIRECT_URI) 
            || `${env.APP_URL || 'https://accounts.betterseqta.org'}/api/oauth/discord/callback`;
        
        if (!discordClientId) {
            return new Response("Discord OAuth not configured", { status: 500, headers: corsHeaders });
        }

        // Build Discord OAuth URL
        const discordAuthUrl = new URL("https://discord.com/api/oauth2/authorize");
        discordAuthUrl.searchParams.set("client_id", discordClientId);
        discordAuthUrl.searchParams.set("redirect_uri", discordRedirectUri);
        discordAuthUrl.searchParams.set("response_type", "code");
        discordAuthUrl.searchParams.set("scope", "identify email");

        return Response.redirect(discordAuthUrl.toString(), 302);
    }

    // Discord OAuth Callback
    if (url.pathname === "/api/oauth/discord/callback" && request.method === "GET") {
        try {
            const code = url.searchParams.get("code");
            const error = url.searchParams.get("error");

            if (error) {
                return Response.redirect(`${env.APP_URL || 'https://accounts.betterseqta.org'}/login?error=${encodeURIComponent(error)}`, 302);
            }

            if (!code) {
                return Response.redirect(`${env.APP_URL || 'https://accounts.betterseqta.org'}/login?error=no_code`, 302);
            }

            // Clean environment variables with robust parsing
            const discordClientId = cleanEnvVar(env.DISCORD_CLIENT_ID);
            const discordClientSecret = cleanEnvVar(env.DISCORD_CLIENT_SECRET);
            const discordRedirectUri = cleanEnvVar(env.DISCORD_REDIRECT_URI) 
                || `${env.APP_URL || 'https://accounts.betterseqta.org'}/api/oauth/discord/callback`;

            if (!discordClientId || !discordClientSecret) {
                return Response.redirect(`${env.APP_URL || 'https://accounts.betterseqta.org'}/login?error=not_configured`, 302);
            }

            // Exchange code for access token
            const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    client_id: discordClientId,
                    client_secret: discordClientSecret,
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: discordRedirectUri,
                }),
            });

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                console.error("Discord token exchange failed:", errorText);
                return Response.redirect(`${env.APP_URL || 'https://accounts.betterseqta.org'}/login?error=token_exchange_failed`, 302);
            }

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            // Get user info from Discord
            const userResponse = await fetch("https://discord.com/api/users/@me", {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!userResponse.ok) {
                return Response.redirect(`${env.APP_URL || 'https://accounts.betterseqta.org'}/login?error=user_fetch_failed`, 302);
            }

            const discordUser = await userResponse.json();
            
            // Normalize email to lowercase, or use Discord ID as fallback
            let normalizedEmail = discordUser.email ? discordUser.email.toLowerCase().trim() : null;
            
            // If no email, create a placeholder using Discord ID
            if (!normalizedEmail) {
                normalizedEmail = `discord_${discordUser.id}@discord.local`;
            }

            // Check if user exists by email (case-insensitive)
            let user = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)").bind(normalizedEmail).first();

            if (!user) {
                // Create new user
                const userId = crypto.randomUUID();
                const username = discordUser.username || `discord_${discordUser.id}`;
                const displayName = discordUser.global_name || discordUser.username || username;
                const pfpUrl = discordUser.avatar 
                    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                    : null;

                // Generate a random password (users can reset it later if needed)
                const randomPassword = crypto.randomUUID();
                const hashedPassword = await bcrypt.hash(randomPassword, 10);

                await env.DB.prepare(
                    "INSERT INTO users (id, email, password, username, displayName, pfpUrl, admin_level) VALUES (?, ?, ?, ?, ?, ?, ?)"
                ).bind(userId, normalizedEmail, hashedPassword, username, displayName, pfpUrl, 0).run();

                user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
            } else {
                // Update existing user's Discord info if needed
                const pfpUrl = discordUser.avatar 
                    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                    : user.pfpUrl;
                const displayName = discordUser.global_name || discordUser.username || user.displayName || user.username;

                await env.DB.prepare(
                    "UPDATE users SET displayName = ?, pfpUrl = ? WHERE id = ?"
                ).bind(displayName, pfpUrl, user.id).run();
            }

            // Generate JWT token
            const token = await new SignJWT({ id: user.id, email: user.email, username: user.username })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('7d')
                .sign(jwtSecret);

            // Redirect to frontend callback page with token
            const frontendCallbackUrl = new URL(`${env.APP_URL || 'https://accounts.betterseqta.org'}/auth/discord/callback`);
            frontendCallbackUrl.searchParams.set("token", token);

            return Response.redirect(frontendCallbackUrl.toString(), 302);

        } catch (err) {
            console.error("Discord OAuth callback error:", err);
            return Response.redirect(`${env.APP_URL || 'https://accounts.betterseqta.org'}/login?error=oauth_error`, 302);
        }
    }

    // --- DesQTA Discord OAuth Endpoints ---
    
    // BS Plus Discord OAuth - forwards to same flow as DesQTA (client_id + redirect_uri in query)
    if (url.pathname === "/api/oauth/bsplus/discord" && request.method === "GET") {
        const baseUrl = env.APP_URL || 'https://accounts.betterseqta.org';
        const redirectUrl = new URL(`${baseUrl}/api/oauth/desqta/discord`);
        url.searchParams.forEach((v, k) => redirectUrl.searchParams.set(k, v));
        return Response.redirect(redirectUrl.toString(), 302);
    }

    // Initiate Discord OAuth for DesQTA (requires client_id - from reserve or admin dashboard)
    if (url.pathname === "/api/oauth/desqta/discord" && request.method === "GET") {
        try {
            const clientId = url.searchParams.get("client_id");
            const redirectUri = url.searchParams.get("redirect_uri");

            if (!clientId || !redirectUri) {
                return new Response(JSON.stringify({ error: "Missing client_id or redirect_uri" }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            // Verify client exists (oauth_clients or desqta_reserved_clients) and redirect_uri matches
            const clientValid = await validateDesqtaClient(clientId, redirectUri);
            if (!clientValid) {
                return new Response(JSON.stringify({ error: "Invalid client_id or redirect_uri does not match" }), { 
                    status: 401, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
            await touchDesqtaReservedClient(clientId);

            // Clean Discord environment variables
            const discordClientId = cleanEnvVar(env.DISCORD_CLIENT_ID);
            // Always use the DesQTA callback URL for DesQTA Discord OAuth flow
            const discordRedirectUri = `${env.APP_URL || 'https://accounts.betterseqta.org'}/api/oauth/desqta/discord/callback`;

            if (!discordClientId) {
                return new Response(JSON.stringify({ error: "Discord OAuth not configured" }), { 
                    status: 500, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            // Create state parameter with client_id and redirect_uri (base64 encoded JSON)
            const state = btoa(JSON.stringify({ client_id: clientId, redirect_uri: redirectUri }));

            // Build Discord OAuth URL
            const discordAuthUrl = new URL("https://discord.com/api/oauth2/authorize");
            discordAuthUrl.searchParams.set("client_id", discordClientId);
            discordAuthUrl.searchParams.set("redirect_uri", discordRedirectUri);
            discordAuthUrl.searchParams.set("response_type", "code");
            discordAuthUrl.searchParams.set("scope", "identify email");
            discordAuthUrl.searchParams.set("state", state);

            return Response.redirect(discordAuthUrl.toString(), 302);
        } catch (err) {
            console.error("DesQTA Discord OAuth initiation error:", err);
            return new Response(JSON.stringify({ error: "Internal server error" }), { 
                status: 500, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
    }

    // DesQTA Discord OAuth Callback
    if (url.pathname === "/api/oauth/desqta/discord/callback" && request.method === "GET") {
        try {
            const code = url.searchParams.get("code");
            const error = url.searchParams.get("error");
            const state = url.searchParams.get("state");

            if (error) {
                // Redirect to DesQTA with error, or return JSON error
                return new Response(JSON.stringify({ error: `Discord OAuth error: ${error}` }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            if (!code || !state) {
                return new Response(JSON.stringify({ error: "Missing code or state parameter" }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            // Decode state to get client_id and redirect_uri
            let stateData;
            try {
                stateData = JSON.parse(atob(state));
            } catch (e) {
                return new Response(JSON.stringify({ error: "Invalid state parameter" }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            const { client_id, redirect_uri } = stateData;

            if (!client_id || !redirect_uri) {
                return new Response(JSON.stringify({ error: "Invalid state data" }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            // Verify client exists (oauth_clients or desqta_reserved_clients) and redirect_uri matches
            const clientValid = await validateDesqtaClient(client_id, redirect_uri);
            if (!clientValid) {
                return new Response(JSON.stringify({ error: "Invalid client or redirect URI mismatch" }), { 
                    status: 401, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
            await touchDesqtaReservedClient(client_id);

            // Clean Discord environment variables
            const discordClientId = cleanEnvVar(env.DISCORD_CLIENT_ID);
            const discordClientSecret = cleanEnvVar(env.DISCORD_CLIENT_SECRET);
            // Always use the DesQTA callback URL for DesQTA Discord OAuth flow
            const discordRedirectUri = `${env.APP_URL || 'https://accounts.betterseqta.org'}/api/oauth/desqta/discord/callback`;

            if (!discordClientId || !discordClientSecret) {
                return new Response(JSON.stringify({ error: "Discord OAuth not configured" }), { 
                    status: 500, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            // Exchange code for access token
            const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    client_id: discordClientId,
                    client_secret: discordClientSecret,
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: discordRedirectUri,
                }),
            });

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                console.error("Discord token exchange failed:", errorText);
                return new Response(JSON.stringify({ error: "Failed to exchange Discord code for token" }), { 
                    status: 500, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            // Get user info from Discord
            const userResponse = await fetch("https://discord.com/api/users/@me", {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!userResponse.ok) {
                return new Response(JSON.stringify({ error: "Failed to fetch Discord user info" }), { 
                    status: 500, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }

            const discordUser = await userResponse.json();
            
            // Normalize email to lowercase, or use Discord ID as fallback
            let normalizedEmail = discordUser.email ? discordUser.email.toLowerCase().trim() : null;
            
            // If no email, create a placeholder using Discord ID
            if (!normalizedEmail) {
                normalizedEmail = `discord_${discordUser.id}@discord.local`;
            }

            // Check if user exists by email (case-insensitive)
            let user = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)").bind(normalizedEmail).first();

            if (!user) {
                // Create new user
                const userId = crypto.randomUUID();
                const username = discordUser.username || `discord_${discordUser.id}`;
                const displayName = discordUser.global_name || discordUser.username || username;
                const pfpUrl = discordUser.avatar 
                    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                    : null;

                // Generate a random password (users can reset it later if needed)
                const randomPassword = crypto.randomUUID();
                const hashedPassword = await bcrypt.hash(randomPassword, 10);

                await env.DB.prepare(
                    "INSERT INTO users (id, email, password, username, displayName, pfpUrl, admin_level) VALUES (?, ?, ?, ?, ?, ?, ?)"
                ).bind(userId, normalizedEmail, hashedPassword, username, displayName, pfpUrl, 0).run();

                user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
            } else {
                // Update existing user's Discord info if needed
                const pfpUrl = discordUser.avatar 
                    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                    : user.pfpUrl;
                const displayName = discordUser.global_name || discordUser.username || user.displayName || user.username;

                await env.DB.prepare(
                    "UPDATE users SET displayName = ?, pfpUrl = ? WHERE id = ?"
                ).bind(displayName, pfpUrl, user.id).run();
            }

            // Generate JWT token for API access (24h - refresh flow handles longevity)
            const apiToken = await new SignJWT({ id: user.id, email: user.email, username: user.username })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('24h')
                .sign(jwtSecret);

            // Create desqta session for refresh token flow
            const sessionId = crypto.randomUUID();
            const secret = crypto.getRandomValues(new Uint8Array(32));
            const secretB64 = btoa(String.fromCharCode(...secret));
            const refreshTokenHash = await bcrypt.hash(secretB64, 10);
            const REFRESH_EXPIRY_DAYS = 90;
            const expiresAt = Math.floor(Date.now() / 1000) + (REFRESH_EXPIRY_DAYS * 24 * 60 * 60);

            await env.DB.prepare(
                "INSERT INTO desqta_sessions (id, user_id, client_id, refresh_token_hash, expires_at) VALUES (?, ?, ?, ?, ?)"
            ).bind(sessionId, user.id, client_id, refreshTokenHash, expiresAt).run();

            const refreshToken = `${sessionId}:${secretB64}`;

            // Redirect to DesQTA's redirect_uri with token and refresh_token
            const desqtaCallbackUrl = new URL(redirect_uri);
            desqtaCallbackUrl.searchParams.set("token", apiToken);
            desqtaCallbackUrl.searchParams.set("user_id", user.id);
            desqtaCallbackUrl.searchParams.set("refresh_token", refreshToken);

            return Response.redirect(desqtaCallbackUrl.toString(), 302);

        } catch (err) {
            console.error("DesQTA Discord OAuth callback error:", err);
            return new Response(JSON.stringify({ error: "OAuth callback error" }), { 
                status: 500, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
    }

    // --- API: Admin Endpoints ---

    // Search Users
    if (url.pathname === "/api/admin/users" && request.method === "GET") {
        const admin = await getAdminUser(request);
        if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

        const query = url.searchParams.get("q") || "";
        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const pageSize = 50;
        const offset = (page - 1) * pageSize;

        // Get total count
        const countResult = await env.DB.prepare("SELECT COUNT(*) as total FROM users WHERE username LIKE ? OR email LIKE ?")
            .bind(`%${query}%`, `%${query}%`).first();
        const total = countResult.total || 0;

        // Get paginated users
        const users = await env.DB.prepare("SELECT id, email, username, displayName, admin_level FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY username LIMIT ? OFFSET ?")
            .bind(`%${query}%`, `%${query}%`, pageSize, offset).all();
        
        // Get maximum admin level
        const maxAdminLevel = await getMaxAdminLevel();
        
        return new Response(JSON.stringify({
            users: users.results,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
            maxAdminLevel
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Promote/Demote User (with hierarchy enforcement)
    if (url.pathname === "/api/admin/promote" && request.method === "POST") {
        const admin = await getAdminUserWithLevel(request);
        if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

        const { userId, adminLevel } = await request.json();
        
        // Get maximum admin level from database
        const maxAdminLevel = await getMaxAdminLevel();
        
        // Validate adminLevel (0 to maxAdminLevel)
        if (adminLevel < 0 || adminLevel > maxAdminLevel) {
            return new Response(JSON.stringify({ error: `Invalid admin level. Must be between 0 and ${maxAdminLevel}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Get target user's current level
        const targetUser = await env.DB.prepare("SELECT admin_level FROM users WHERE id = ?").bind(userId).first();
        if (!targetUser) {
            return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const currentTargetLevel = targetUser.admin_level || 0;
        const adminLevelNum = admin.adminLevel || 0;

        // Hierarchy rules:
        // 1. Only Senior Admins (highest level) can promote regular users (level 0) to admin
        // 2. Other admins can only promote existing admins (level 1+) up to their own level
        // 3. Can only demote users at your level or below
        // 4. Cannot change users at or above your level

        if (adminLevel > currentTargetLevel) {
            // Promotion
            // Rule: Only Senior Admins (highest level) can promote regular users (level 0) to admin
            if (currentTargetLevel === 0 && adminLevelNum < maxAdminLevel) {
                return new Response(JSON.stringify({ error: "Only Senior Admins can promote regular users to admin" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            // Rule: Can only promote to level at or below admin's level (but not higher)
            if (adminLevel > adminLevelNum) {
                return new Response(JSON.stringify({ error: "Cannot promote user to a level higher than your own" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
        } else if (adminLevel < currentTargetLevel) {
            // Demotion: Can only demote users at your level or below
            if (currentTargetLevel >= adminLevelNum) {
                return new Response(JSON.stringify({ error: "Cannot demote users at your level or higher" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
        }

        // Update the user's admin level
        await env.DB.prepare("UPDATE users SET admin_level = ? WHERE id = ?").bind(adminLevel, userId).run();
        
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Admin: Send Password Reset to User (any admin level)
    if (url.pathname === "/api/admin/send-password-reset" && request.method === "POST") {
        const admin = await getAdminUser(request);
        if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

        const { userId } = await request.json();
        if (!userId) {
            return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const user = await env.DB.prepare("SELECT id, email, displayName FROM users WHERE id = ?").bind(userId).first();
        if (!user) {
            return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        try {
            await env.DB.prepare("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0").bind(user.id).run();
            const token = crypto.randomUUID();
            const hashedToken = await bcrypt.hash(token, 10);
            const expiresAt = Math.floor(Date.now() / 1000) + 3600;
            await env.DB.prepare(
                "INSERT INTO password_reset_tokens (token, user_id, expires_at, used) VALUES (?, ?, ?, 0)"
            ).bind(hashedToken, user.id, expiresAt).run();
            await sendPasswordResetEmail(user.email, token, env, user.displayName || null);
        } catch (emailError) {
            console.error("Admin send password reset email error:", emailError);
            return new Response(JSON.stringify({ error: "Failed to send reset email" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ success: true, message: "Password reset email sent" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Admin: Delete User (Senior Admin only)
    if (url.pathname === "/api/admin/delete-user" && request.method === "POST") {
        const admin = await getAdminUserWithLevel(request);
        if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

        const maxAdminLevel = await getMaxAdminLevel();
        if ((admin.adminLevel || 0) < maxAdminLevel) {
            return new Response(JSON.stringify({ error: "Only Senior Admins can delete users" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { userId } = await request.json();
        if (!userId) {
            return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (userId === admin.id) {
            return new Response(JSON.stringify({ error: "You cannot delete your own account" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const targetUser = await env.DB.prepare("SELECT id, admin_level FROM users WHERE id = ?").bind(userId).first();
        if (!targetUser) {
            return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if ((targetUser.admin_level || 0) >= maxAdminLevel) {
            return new Response(JSON.stringify({ error: "Cannot delete Senior Admin users" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        try {
            await env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").bind(userId).run();
            await env.DB.prepare("DELETE FROM settings WHERE user_id = ?").bind(userId).run();
            await env.DB.prepare("DELETE FROM oauth_codes WHERE user_id = ?").bind(userId).run();
            const desqtaSessions = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='desqta_sessions'").first();
            if (desqtaSessions) {
                await env.DB.prepare("DELETE FROM desqta_sessions WHERE user_id = ?").bind(userId).run();
            }
            await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
        } catch (err) {
            console.error("Delete user error:", err);
            return new Response(JSON.stringify({ error: "Failed to delete user" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // List Clients
    if (url.pathname === "/api/admin/clients" && request.method === "GET") {
        const admin = await getAdminUser(request);
        if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

        const clients = await env.DB.prepare("SELECT * FROM oauth_clients ORDER BY created_at DESC").all();
        return new Response(JSON.stringify(clients.results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DesQTA Reserved Clients Count
    if (url.pathname === "/api/admin/desqta-clients-count" && request.method === "GET") {
        const admin = await getAdminUser(request);
        if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

        const result = await env.DB.prepare("SELECT COUNT(*) as count FROM desqta_reserved_clients").first();
        return new Response(JSON.stringify({ count: result?.count ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create Client
    if (url.pathname === "/api/admin/clients" && request.method === "POST") {
        const admin = await getAdminUser(request);
        if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

        const { name, redirect_uri } = await request.json();
        const id = crypto.randomUUID(); // Client ID
        const secret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''); // Simple secret generation

        await env.DB.prepare("INSERT INTO oauth_clients (id, name, secret, redirect_uri) VALUES (?, ?, ?, ?)")
            .bind(id, name, secret, redirect_uri).run();

        return new Response(JSON.stringify({ id, name, secret, redirect_uri }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update User Profile (Moderator Control - Level 2+ Admins Only)
    if (url.pathname === "/api/admin/update-user" && request.method === "POST") {
        const admin = await getAdminUserWithLevel(request);
        if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

        // Require admin level 2 or higher (Middle Admin and above)
        if ((admin.adminLevel || 0) < 2) {
            return new Response(JSON.stringify({ error: "Moderator controls require Middle Admin level (2) or higher" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { userId, email, username, displayName } = await request.json();
        
        if (!userId) {
            return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Verify target user exists
        const targetUser = await env.DB.prepare("SELECT id, email, username FROM users WHERE id = ?").bind(userId).first();
        if (!targetUser) {
            return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (email !== undefined && email !== null) {
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return new Response(JSON.stringify({ error: "Invalid email format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            // Normalize email to lowercase for case-insensitive handling
            const normalizedEmail = email.toLowerCase().trim();
            // Check if email is different from current (case-insensitive comparison)
            if (normalizedEmail !== targetUser.email.toLowerCase()) {
                // Check if new email already exists (case-insensitive)
                const existingUser = await env.DB.prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?").bind(normalizedEmail, userId).first();
                if (existingUser) {
                    return new Response(JSON.stringify({ error: "Email already in use" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
                updates.push("email = ?");
                values.push(normalizedEmail);
            }
        }

        if (username !== undefined && username !== null) {
            // Check if username is different from current
            if (username !== targetUser.username) {
                // Check if new username already exists
                const existingUser = await env.DB.prepare("SELECT id FROM users WHERE username = ? AND id != ?").bind(username, userId).first();
                if (existingUser) {
                    return new Response(JSON.stringify({ error: "Username already in use" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
                updates.push("username = ?");
                values.push(username);
            }
        }

        if (displayName !== undefined && displayName !== null) {
            updates.push("displayName = ?");
            values.push(displayName);
        }

        if (updates.length === 0) {
            return new Response(JSON.stringify({ error: "No fields to update" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Execute update
        values.push(userId);
        await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`)
            .bind(...values).run();

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- API Route: Handle Settings ---
    if (url.pathname === "/api/settings") {
      // SECURITY: Always require JWT token - never trust client-provided user IDs
      const payload = await getUser(request);
      if (!payload) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      
      const userId = payload.id;

      try {
        // GET: Retrieve Settings
        if (request.method === "GET") {
          const result = await env.DB.prepare("SELECT data FROM settings WHERE user_id = ?")
            .bind(userId)
            .first();
          
          return new Response(result ? result.data : "{}", {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // POST: Merge & Save Settings
        if (request.method === "POST") {
          const newSettings = await request.json();

          // 1. Get existing settings
          const existing = await env.DB.prepare("SELECT data FROM settings WHERE user_id = ?")
            .bind(userId)
            .first();
          
          const currentData = existing ? JSON.parse(existing.data) : {};
          
          // 2. Merge (New settings overwrite old ones)
          const mergedData = { ...currentData, ...newSettings };
          const mergedString = JSON.stringify(mergedData);

          // 3. Save back to DB
          await env.DB.prepare(
            "INSERT OR REPLACE INTO settings (user_id, data) VALUES (?, ?)"
          )
            .bind(userId, mergedString)
            .run();

          return new Response(mergedString, {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      } catch (err) {
        return new Response(err.message, { status: 500, headers: corsHeaders });
      }
    }

    // --- API: User Update (Profile) ---
    if (url.pathname === "/api/user/update" && request.method === "POST") {
        const user = await getUser(request);
        if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

        try {
            const { displayName, username, pfpUrl } = await request.json();
            
            // Build query dynamically based on provided fields
            const updates = [];
            const values = [];

            if (displayName !== undefined) {
                updates.push("displayName = ?");
                values.push(displayName);
            }
            if (username !== undefined) {
                updates.push("username = ?");
                values.push(username);
            }
            if (pfpUrl !== undefined) {
                updates.push("pfpUrl = ?");
                values.push(pfpUrl);
            }

            if (updates.length === 0) {
                 return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            values.push(user.id);
            await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`)
                .bind(...values).run();

            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (e) {
            return new Response(e.message, { status: 500, headers: corsHeaders });
        }
    }

    // --- API: PFP Upload ---
    if (url.pathname === "/api/user/pfp" && request.method === "POST") {
        const user = await getUser(request);
        if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

        try {
            const formData = await request.formData();
            const file = formData.get('file');

            if (!file || !(file instanceof File)) {
                return new Response("No file uploaded", { status: 400, headers: corsHeaders });
            }

            // Simple validation
            if (!file.type.startsWith("image/")) {
                 return new Response("Invalid file type", { status: 400, headers: corsHeaders });
            }
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                 return new Response("File too large (max 5MB)", { status: 400, headers: corsHeaders });
            }

            // Upload to ImgBB
            const imgbbForm = new FormData();
            imgbbForm.append('image', file);
            imgbbForm.append('key', env.IMGBB_API_KEY);

            const imgbbRes = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: imgbbForm
            });

            const imgbbData = await imgbbRes.json();

            if (!imgbbData.success) {
                console.error("ImgBB Error:", imgbbData);
                return new Response("Failed to upload image to provider", { status: 502, headers: corsHeaders });
            }

            const pfpUrl = imgbbData.data.url;

            // Update DB
            await env.DB.prepare("UPDATE users SET pfpUrl = ? WHERE id = ?").bind(pfpUrl, user.id).run();

            return new Response(JSON.stringify({ pfpUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        } catch (e) {
             return new Response(e.message, { status: 500, headers: corsHeaders });
        }
    }

    // --- Fallback: Serve Vue App ---
    // If the request isn't for /api, serve the frontend
    return env.ASSETS.fetch(request);
  },
};
