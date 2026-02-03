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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

        const id = crypto.randomUUID();
        const hashedPassword = await bcrypt.hash(password, 10);

        try {
            // Default admin_level is handled by DB default (0), but we can be explicit if needed.
            await env.DB.prepare(
                "INSERT INTO users (id, email, password, username, displayName, admin_level) VALUES (?, ?, ?, ?, ?, ?)"
            ).bind(id, email, hashedPassword, username, displayName || username, 0).run();
        } catch (e) {
            return new Response(JSON.stringify({ error: "User already exists" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const token = await new SignJWT({ id, email, username })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('7d')
            .sign(jwtSecret);

        return new Response(JSON.stringify({ token, user: { id, email, username, displayName, admin_level: 0 } }), {
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
            const user = await env.DB.prepare("SELECT * FROM users WHERE email = ? OR username = ?").bind(login, login).first();

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

            // Get current user password hash
            const user = await env.DB.prepare("SELECT password, email FROM users WHERE id = ?").bind(userPayload.id).first();
            if (!user) return new Response("User not found", { status: 404, headers: corsHeaders });

            // Verify password
            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
                return new Response(JSON.stringify({ error: "Invalid password" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // Check if new email is different from current
            if (user.email === newEmail) {
                return new Response(JSON.stringify({ error: "New email must be different from current email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // Check if new email already exists
            const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(newEmail).first();
            if (existingUser) {
                return new Response(JSON.stringify({ error: "Email already in use" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // Update email
            await env.DB.prepare("UPDATE users SET email = ? WHERE id = ?").bind(newEmail, userPayload.id).run();

            return new Response(JSON.stringify({ success: true, email: newEmail }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        } catch (e) {
            // Handle unique constraint violation
            if (e.message && e.message.includes("UNIQUE constraint")) {
                return new Response(JSON.stringify({ error: "Email already in use" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            return new Response(e.message, { status: 500, headers: corsHeaders });
        }
    }

    // --- Helper: Send Password Reset Email via Mailgun ---
    async function sendPasswordResetEmail(email, token, env) {
        const resetUrl = `${env.APP_URL || 'https://accounts.betterseqta.org'}/reset-password?token=${token}`;
        
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset Request</h1>
    </div>
    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>
        <p style="font-size: 16px; margin-bottom: 20px;">We received a request to reset your password for your BetterSEQTA+ Account. Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Reset Password</a>
        </div>
        <p style="font-size: 14px; color: #666; margin-top: 30px;">Or copy and paste this link into your browser:</p>
        <p style="font-size: 12px; color: #999; word-break: break-all; background: #fff; padding: 10px; border-radius: 4px; border: 1px solid #e0e0e0;">${resetUrl}</p>
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #856404;"><strong>Important:</strong> This link will expire in 1 hour. If you didn't request this password reset, you may safely ignore this email.</p>
        </div>
        <div style="background: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #0c5460;"><strong>Can't find the email?</strong> Please check your spam, junk, promotions, and other email folders. Sometimes emails can end up there.</p>
        </div>
        <p style="font-size: 14px; color: #666; margin-top: 30px;">Best regards,<br>The BetterSEQTA+ Team</p>
    </div>
</body>
</html>
        `;

        const emailText = `
Password Reset Request

Hello,

We received a request to reset your password for your BetterSEQTA+ Account. Click the link below to reset your password:

${resetUrl}

This link will expire in 1 hour. If you didn't request this password reset, you may safely ignore this email.

Can't find the email? Please check your spam, junk, promotions, and other email folders.

Best regards,
The BetterSEQTA+ Team
        `;

        const formData = new FormData();
        formData.append('from', env.MAILGUN_FROM_EMAIL || 'noreply@betterseqta.org');
        formData.append('to', email);
        formData.append('subject', 'Reset Your Password - BetterSEQTA+');
        formData.append('html', emailHtml);
        formData.append('text', emailText);

        const mailgunUrl = `https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`;
        const auth = btoa(`api:${env.MAILGUN_API_KEY}`);

        const response = await fetch(mailgunUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mailgun API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    // --- API: Forgot Password (Request Reset) ---
    if (url.pathname === "/api/auth/forgot-password" && request.method === "POST") {
        try {
            const { login } = await request.json();
            if (!login) {
                return new Response(JSON.stringify({ error: "Missing email or username" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // Look up user by email or username
            const user = await env.DB.prepare("SELECT id, email FROM users WHERE email = ? OR username = ?").bind(login, login).first();

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

                // Send email via Mailgun
                try {
                    await sendPasswordResetEmail(user.email, token, env);
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

    // List Clients
    if (url.pathname === "/api/admin/clients" && request.method === "GET") {
        const admin = await getAdminUser(request);
        if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

        const clients = await env.DB.prepare("SELECT * FROM oauth_clients ORDER BY created_at DESC").all();
        return new Response(JSON.stringify(clients.results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
            // Check if email is different from current
            if (email !== targetUser.email) {
                // Check if new email already exists
                const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ? AND id != ?").bind(email, userId).first();
                if (existingUser) {
                    return new Response(JSON.stringify({ error: "Email already in use" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
                updates.push("email = ?");
                values.push(email);
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
