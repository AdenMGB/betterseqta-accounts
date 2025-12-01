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

    // --- Helper: Verify Admin ---
    async function getAdminUser(req) {
        const payload = await getUser(req);
        if (!payload) return null;
        // Check DB for latest admin status
        const user = await env.DB.prepare("SELECT is_admin FROM users WHERE id = ?").bind(payload.id).first();
        if (user && user.is_admin) return payload;
        return null;
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
            // Default is_admin is handled by DB default (0), but we can be explicit if needed.
            await env.DB.prepare(
                "INSERT INTO users (id, email, password, username, displayName, is_admin) VALUES (?, ?, ?, ?, ?, ?)"
            ).bind(id, email, hashedPassword, username, displayName || username, 0).run();
        } catch (e) {
            return new Response(JSON.stringify({ error: "User already exists" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const token = await new SignJWT({ id, email, username })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('7d')
            .sign(jwtSecret);

        return new Response(JSON.stringify({ token, user: { id, email, username, displayName, is_admin: 0 } }), {
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

            return new Response(JSON.stringify({ token, user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, pfpUrl: user.pfpUrl, is_admin: user.is_admin } }), {
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

        const user = await env.DB.prepare("SELECT id, email, username, displayName, pfpUrl, is_admin FROM users WHERE id = ?").bind(payload.id).first();
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

        const userData = await env.DB.prepare("SELECT id, email, username, displayName, pfpUrl, is_admin FROM users WHERE id = ?").bind(user.id).first();
        return new Response(JSON.stringify(userData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- API: Admin Endpoints ---

    // Search Users
    if (url.pathname === "/api/admin/users" && request.method === "GET") {
        const admin = await getAdminUser(request);
        if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

        const query = url.searchParams.get("q") || "";
        const users = await env.DB.prepare("SELECT id, email, username, displayName, is_admin FROM users WHERE username LIKE ? OR email LIKE ? LIMIT 50")
            .bind(`%${query}%`, `%${query}%`).all();
        
        return new Response(JSON.stringify(users.results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Promote/Demote User
    if (url.pathname === "/api/admin/promote" && request.method === "POST") {
        const admin = await getAdminUser(request);
        if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

        const { userId, isAdmin } = await request.json();
        await env.DB.prepare("UPDATE users SET is_admin = ? WHERE id = ?").bind(isAdmin ? 1 : 0, userId).run();
        
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

    // --- API Route: Handle Settings ---
    if (url.pathname === "/api/settings") {
      // Try to get user from token first, fallback to header if needed (but prefer token)
      let userId = request.headers.get("X-User-ID");
      
      const payload = await getUser(request);
      if (payload) {
          userId = payload.id;
      }

      if (!userId) return new Response("Missing User ID or Token", { status: 401, headers: corsHeaders });

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
