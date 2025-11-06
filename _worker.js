// ========== UTILITIES ==========

async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

const STATIC_PAGE_ROUTES = new Map([
  ["/choose", "/choose.html"],
  ["/leaderboard", "/leaderboard.html"],
  ["/profile", "/profile.html"],
  ["/submit", "/submit.html"],
  ["/verify", "/verify.html"],
]);

function sanitizeText(value) {
  if (!value && value !== 0) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeUrl(value) {
  const sanitized = sanitizeText(value);
  if (!sanitized) return "";
  try {
    const url = new URL(sanitized);
    return url.toString();
  } catch {
    return null;
  }
}

// ========== SESSION / TOKENS ==========

let cachedSessionSecret = null;
let sessionSecretWarningIssued = false;

function resolveSessionSecret(env) {
  const raw = env && "SESSION_SECRET" in env ? env.SESSION_SECRET : "";
  const normalized = sanitizeText(raw);
  if (normalized) {
    cachedSessionSecret = normalized;
    return normalized;
  }
  if (cachedSessionSecret) return cachedSessionSecret;

  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const secret = Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  cachedSessionSecret = secret;
  if (!sessionSecretWarningIssued) {
    console.warn("SESSION_SECRET not set — ephemeral secret generated.");
    sessionSecretWarningIssued = true;
  }
  return secret;
}

function base64UrlEncode(input) {
  return btoa(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlEncodeFromArrayBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return base64UrlEncode(binary);
}

function base64UrlDecodeToString(value) {
  let input = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const pad = input.length % 4;
  if (pad) input += "=".repeat(4 - pad);
  return atob(input);
}

function base64UrlToUint8Array(value) {
  const binary = base64UrlDecodeToString(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function createSessionToken(userId, role, secret) {
  if (!secret) throw new Error("SESSION_SECRET missing");
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { sub: String(userId), role: role || "user", iat: Math.floor(Date.now() / 1000) };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(unsigned));
  return `${unsigned}.${base64UrlEncodeFromArrayBuffer(signature)}`;
}

async function verifySessionToken(token, secret) {
  if (!secret || !token) return null;
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const unsigned = `${header}.${payload}`;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("HMAC", key, base64UrlToUint8Array(sig), encoder.encode(unsigned));
    if (!ok) return null;
    const body = JSON.parse(base64UrlDecodeToString(payload));
    return { userId: Number(body.sub), role: body.role || "user" };
  } catch (e) {
    console.error("verify token failed", e);
    return null;
  }
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function responseWithMessage(message, status = 200, extra = {}) {
  return Response.json({ message, ...extra }, { status });
}

function requireRole(session, role) {
  if (!session || session.role !== role) {
    return responseWithMessage(`${role} access required.`, 403);
  }
  return null;
}

// ========== AUTH ROUTES ==========

async function handleSignup(request, env) {
  const db = env.DEEDS_DB;
  const body = await parseJsonBody(request);
  if (!db || !body) return responseWithMessage("Invalid request.", 400);
  const name = sanitizeText(body.name);
  const email = sanitizeText(body.email).toLowerCase();
  const password = String(body.password || "");
  if (!name || !email || password.length < 8)
    return responseWithMessage("Missing or weak credentials.", 400);
  const exists = await db.prepare("SELECT id FROM users WHERE email=?1").bind(email).first();
  if (exists) return responseWithMessage("Email already registered.", 409);
  const hash = await hashPassword(password);
  const created = new Date().toISOString();
  const res = await db
    .prepare("INSERT INTO users (name,email,password_hash,role,verification_status,created_at) VALUES (?1,?2,?3,'user','pending',?4)")
    .bind(name, email, hash, created)
    .run();
  const token = await createSessionToken(res.meta.last_row_id, "user", resolveSessionSecret(env));
  return responseWithMessage("Signup successful.", 201, {
    profile: { id: res.meta.last_row_id, name, email, role: "user", sessionToken: token },
  });
}

async function handleLogin(request, env) {
  const db = env.DEEDS_DB;
  const body = await parseJsonBody(request);
  if (!db || !body) return responseWithMessage("Invalid request.", 400);
  const email = sanitizeText(body.email).toLowerCase();
  const password = String(body.password || "");
  const user = await db
    .prepare(
      `SELECT u.id,u.name,u.email,u.password_hash,u.role,u.credits,
       COALESCE(SUM(CASE WHEN d.status='verified' THEN 1 ELSE 0 END),0) AS completed
       FROM users u LEFT JOIN deeds d ON d.user_id=u.id WHERE u.email=?1 GROUP BY u.id`
    )
    .bind(email)
    .first();
  if (!user) return responseWithMessage("Account not found.", 404);
  if (await hashPassword(password) !== user.password_hash)
    return responseWithMessage("Invalid credentials.", 401);
  const token = await createSessionToken(user.id, user.role, resolveSessionSecret(env));
  return responseWithMessage(`Welcome back, ${user.name}!`, 200, {
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      credits: user.credits,
      completed: user.completed,
      sessionToken: token,
    },
  });
}

// ========== DEEDS ROUTES ==========

async function handleCreateDeed(request, env) {
  const db = env.DEEDS_DB;
  const body = await parseJsonBody(request);
  if (!db || !body) return responseWithMessage("Invalid request.", 400);
  const userId = Number(body.user_id);
  const title = sanitizeText(body.title);
  const proof = normalizeUrl(body.proof_url);
  if (!userId || !title || !proof) return responseWithMessage("Missing deed data.", 400);

  try {
    // First, try with all columns (if migrations 0010 and 0013 have been run)
    await db
      .prepare(
        "INSERT INTO deeds (user_id,title,description,proof_url,impact,duration,status,created_at) VALUES (?1,?2,?3,?4,?5,?6,'pending',datetime('now'))"
      )
      .bind(userId, title, body.description || "", proof, body.impact || "", body.duration || "")
      .run();
    return responseWithMessage("Deed submitted for review.", 201, { success: true });
  } catch (error) {
    console.error("Database error creating deed (attempting with all columns):", error);

    // If that fails, try with just the base columns (user_id, title, proof_url, status, created_at)
    try {
      console.log("Retrying with base schema columns only...");
      await db
        .prepare(
          "INSERT INTO deeds (user_id,title,proof_url,status,created_at) VALUES (?1,?2,?3,'pending',datetime('now'))"
        )
        .bind(userId, title, proof)
        .run();
      return responseWithMessage("Deed submitted for review.", 201, { success: true });
    } catch (fallbackError) {
      console.error("Database error creating deed (base columns):", fallbackError);

      // Last resort: try with explicit NULL for id to force autoincrement
      try {
        console.log("Final attempt: INSERT with explicit NULL id...");
        await db
          .prepare(
            "INSERT INTO deeds (id,user_id,title,proof_url,status,created_at) VALUES (NULL,?1,?2,?3,'pending',datetime('now'))"
          )
          .bind(userId, title, proof)
          .run();
        return responseWithMessage("Deed submitted for review.", 201, { success: true });
      } catch (finalError) {
        console.error("All INSERT attempts failed:", finalError);
        return responseWithMessage(`Database error: ${finalError.message}. Please contact support - database schema may need repair.`, 500);
      }
    }
  }
}

async function handleVerifyDeed(request, env) {
  const db = env.DEEDS_DB;
  const auth = request.headers.get("authorization") || "";
  const token = (auth.match(/^Bearer\s+(.+)$/i) || [])[1];
  const session = await verifySessionToken(token, resolveSessionSecret(env));
  const check = requireRole(session, "admin");
  if (check) return check;
  const body = await parseJsonBody(request);
  const deedId = Number(body.deed_id);
  if (!deedId) return responseWithMessage("Missing deed_id.", 400);
  const deed = await db.prepare("SELECT id,user_id,status FROM deeds WHERE id=?1").bind(deedId).first();
  if (!deed) return responseWithMessage("Not found.", 404);
  if (deed.status === "verified") return responseWithMessage("Already verified.", 409);
  await db
    .prepare("UPDATE deeds SET status='verified',verified_at=datetime('now') WHERE id=?1")
    .bind(deedId)
    .run();
  await db.prepare("UPDATE users SET credits=credits+1 WHERE id=?1").bind(deed.user_id).run();
  return Response.json({ success: true, deed_id: deedId });
}

// ========== OTHER ROUTES ==========

async function handleLeaderboard(env) {
  const db = env.DEEDS_DB;
  const res = await db
    .prepare(
      `SELECT u.id,u.name,u.region,u.sector,u.credits,
        COUNT(d.id) AS total_deeds,
        COUNT(CASE WHEN d.status='verified' THEN 1 END) AS deeds_verified
      FROM users u
      LEFT JOIN deeds d ON u.id=d.user_id
      GROUP BY u.id
      ORDER BY u.credits DESC,deeds_verified DESC,u.name ASC
      LIMIT 50`
    )
    .all();
  const board = (res.results || []).map((r) => ({
    id: r.id,
    name: r.name || "Neighbor",
    region: r.region || "—",
    sector: r.sector || "General",
    credits: Number(r.credits ?? 0),
    verified: Number(r.deeds_verified ?? 0),
    total: Number(r.total_deeds ?? 0),
  }));
  return Response.json(board);
}

async function handleDeedCatalog(env) {
  const db = env.DEEDS_DB;
  const res = await db
    .prepare("SELECT id,title,description,impact,duration FROM deed_catalog ORDER BY id ASC")
    .all();
  return Response.json(res.results || []);
}

async function handleProfile(request, env) {
  const db = env.DEEDS_DB;
  const id = Number(new URL(request.url).searchParams.get("user_id"));
  if (!id) return responseWithMessage("Invalid user_id", 400);
  const res = await db
    .prepare(
      `SELECT u.id,u.name,u.email,u.credits,
      COUNT(d.id) AS total_deeds,
      COUNT(CASE WHEN d.status='verified' THEN 1 END) AS verified_deeds
      FROM users u
      LEFT JOIN deeds d ON u.id=d.user_id
      WHERE u.id=?1 GROUP BY u.id`
    )
    .bind(id)
    .all();
  return Response.json(res.results[0] || { message: "User not found" });
}

// ========== FETCH HANDLER ==========

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });

    // AUTH
    if (path === "/api/auth/signup" && method === "POST")
      return handleSignup(request, env);
    if (path === "/api/auth/login" && method === "POST")
      return handleLogin(request, env);

    // DEEDS
    if (path === "/api/deeds" && method === "POST")
      return handleCreateDeed(request, env);
    if (path === "/api/verify" && method === "POST")
      return handleVerifyDeed(request, env);

    // CATALOG / LEADERBOARD / PROFILE
    if (path === "/api/deed_catalog" && method === "GET")
      return handleDeedCatalog(env);
    if (path === "/api/leaderboard" && method === "GET")
      return handleLeaderboard(env);
    if (path === "/api/profile" && method === "GET")
      return handleProfile(request, env);

    // fallback
    return new Response("Not found", { status: 404 });
  },
};
