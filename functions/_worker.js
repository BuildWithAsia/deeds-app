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

function normalizePathname(pathname) {
  if (!pathname) return "/";
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

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

let cachedSessionSecret = null;
let sessionSecretWarningIssued = false;

function resolveSessionSecret(env) {
  const rawSecret = env && "SESSION_SECRET" in env ? env.SESSION_SECRET : "";
  const normalizedSecret = sanitizeText(rawSecret);

  if (normalizedSecret) {
    cachedSessionSecret = normalizedSecret;
    return normalizedSecret;
  }

  if (cachedSessionSecret) return cachedSessionSecret;

  let generatedSecret = "";
  if (crypto && typeof crypto.getRandomValues === "function") {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    generatedSecret = Array.from(randomBytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } else if (crypto && typeof crypto.randomUUID === "function") {
    generatedSecret = crypto.randomUUID().replace(/-/g, "");
  } else {
    generatedSecret = "development-session-secret";
  }

  cachedSessionSecret = generatedSecret;

  if (!sessionSecretWarningIssued) {
    console.warn(
      "SESSION_SECRET is not configured. Generated an ephemeral secret for development."
    );
    sessionSecretWarningIssued = true;
  }

  return generatedSecret;
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
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
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
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------- SESSION TOKEN ----------

async function createSessionToken(userId, role, secret) {
  if (!secret) throw new Error("SESSION_SECRET is not configured");

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: String(userId),
    role: role || "user",
    iat: Math.floor(Date.now() / 1000),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(unsignedToken)
  );

  const encodedSignature = base64UrlEncodeFromArrayBuffer(signature);
  return `${unsignedToken}.${encodedSignature}`;
}

async function verifySessionToken(token, secret) {
  if (!secret || !token) return null;

  const parts = String(token).split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureValid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToUint8Array(encodedSignature),
      encoder.encode(unsignedToken)
    );

    if (!signatureValid) return null;

    const payloadJson = base64UrlDecodeToString(encodedPayload);
    const payload = JSON.parse(payloadJson);

    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) return null;

    return { userId, role: payload.role || "user" };
  } catch (err) {
    console.error("Token verification failed", err);
    return null;
  }
}

// ---------- HELPERS ----------

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

// ---------- AUTH ----------

async function handleSignup(request, env) {
  const db = env.DEEDS_DB;
  if (!db) return responseWithMessage("Missing DB binding.", 500);

  const payload = await parseJsonBody(request);
  if (!payload) return responseWithMessage("Invalid JSON.", 400);

  const sessionSecret = resolveSessionSecret(env);
  const name = sanitizeText(payload.name);
  const email = sanitizeText(payload.email).toLowerCase();
  const password = String(payload.password || "");

  if (!name || !email || !password)
    return responseWithMessage("All fields required.", 400);
  if (password.length < 8)
    return responseWithMessage("Password too short.", 400);

  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ?1")
    .bind(email)
    .first();
  if (existing) return responseWithMessage("Email already exists.", 409);

  const hash = await hashPassword(password);
  const now = new Date().toISOString();

  const res = await db
    .prepare(
      "INSERT INTO users (name, email, password_hash, verification_status, created_at) VALUES (?1, ?2, ?3, 'pending', ?4)"
    )
    .bind(name, email, hash, now)
    .run();

  const token = await createSessionToken(res.meta.last_row_id, "user", sessionSecret);

  return responseWithMessage("Signup successful.", 201, {
    profile: { id: res.meta.last_row_id, name, email, role: "user", token },
  });
}

async function handleLogin(request, env) {
  const db = env.DEEDS_DB;
  if (!db) return responseWithMessage("Missing DB binding.", 500);

  const payload = await parseJsonBody(request);
  if (!payload) return responseWithMessage("Invalid JSON.", 400);

  const email = sanitizeText(payload.email).toLowerCase();
  const password = String(payload.password || "");
  if (!email || !password)
    return responseWithMessage("Email and password required.", 400);

  const user = await db
    .prepare(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.credits,
        COALESCE(SUM(CASE WHEN d.status='verified' THEN 1 ELSE 0 END),0) AS completed
       FROM users u
       LEFT JOIN deeds d ON d.user_id=u.id
       WHERE u.email=?1 GROUP BY u.id`
    )
    .bind(email)
    .first();

  if (!user)
    return responseWithMessage("No account found. Please sign up.", 404);

  const hash = await hashPassword(password);
  if (hash !== user.password_hash)
    return responseWithMessage("Invalid credentials.", 401);

  const secret = resolveSessionSecret(env);
  const token = await createSessionToken(user.id, user.role, secret);

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

// ---------- DEED ROUTES ----------

async function handleVerifyDeed(request, env) {
  const db = env.DEEDS_DB;
  if (!db) return responseWithMessage("Missing DB binding.", 500);

  const authHeader = request.headers.get("authorization") || "";
  const token = (authHeader.match(/^Bearer\s+(.+)$/i) || [])[1];
  const session = await verifySessionToken(token, resolveSessionSecret(env));
  const roleCheck = requireRole(session, "admin");
  if (roleCheck) return roleCheck;

  const payload = await parseJsonBody(request);
  if (!payload) return responseWithMessage("Invalid JSON.", 400);

  const deedId = Number(payload.deed_id);
  if (!deedId) return responseWithMessage("Missing deed_id.", 400);

  const deed = await db
    .prepare("SELECT id, user_id, status FROM deeds WHERE id=?1")
    .bind(deedId)
    .first();
  if (!deed) return responseWithMessage("Deed not found.", 404);
  if (deed.status === "verified")
    return responseWithMessage("Already verified.", 409);

  await db
    .prepare(
      "UPDATE deeds SET status='verified', verified_at=datetime('now') WHERE id=?1"
    )
    .bind(deedId)
    .run();

  await db
    .prepare("UPDATE users SET credits=credits+1 WHERE id=?1")
    .bind(deed.user_id)
    .run();

  return Response.json({ success: true, deedId });
}

// ---------- FETCH HANDLER ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Auth
    if (url.pathname === "/api/auth/signup" && method === "POST")
      return handleSignup(request, env);
    if (url.pathname === "/api/auth/login" && method === "POST")
      return handleLogin(request, env);

    // Verify
    if (url.pathname === "/api/verify" && method === "POST")
      return handleVerifyDeed(request, env);

    // Default fallback
    return new Response("Not found", { status: 404 });
  },
};
