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
            await env.DB.prepare(
                "INSERT INTO users (id, email, password, username, displayName) VALUES (?, ?, ?, ?, ?)"
            ).bind(id, email, hashedPassword, username, displayName || username).run();
        } catch (e) {
            return new Response(JSON.stringify({ error: "User already exists" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const token = await new SignJWT({ id, email, username })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('7d')
            .sign(jwtSecret);

        return new Response(JSON.stringify({ token, user: { id, email, username, displayName } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (err) {
        return new Response(err.message, { status: 500, headers: corsHeaders });
      }
    }

    // --- API: Login ---
    if (url.pathname === "/api/auth/login" && request.method === "POST") {
        try {
            const { email, password } = await request.json();
            const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

            if (!user || !(await bcrypt.compare(password, user.password))) {
                return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const token = await new SignJWT({ id: user.id, email: user.email, username: user.username })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('7d')
                .sign(jwtSecret);

            return new Response(JSON.stringify({ token, user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, pfpUrl: user.pfpUrl } }), {
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

        const user = await env.DB.prepare("SELECT id, email, username, displayName, pfpUrl FROM users WHERE id = ?").bind(payload.id).first();
        return new Response(JSON.stringify(user), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    // --- Fallback: Serve Vue App ---
    // If the request isn't for /api, serve the frontend
    return env.ASSETS.fetch(request);
  },
};
