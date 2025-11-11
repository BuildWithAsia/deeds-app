var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-ae18cH/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// _worker.js
async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
__name(parseJsonBody, "parseJsonBody");
function sanitizeText(value) {
  if (!value && value !== 0) return "";
  return String(value).replace(/\s+/g, " ").trim();
}
__name(sanitizeText, "sanitizeText");
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
__name(normalizeUrl, "normalizeUrl");
var cachedSessionSecret = null;
var sessionSecretWarningIssued = false;
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
  const secret = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  cachedSessionSecret = secret;
  if (!sessionSecretWarningIssued) {
    console.warn("SESSION_SECRET not set \u2014 ephemeral secret generated.");
    sessionSecretWarningIssued = true;
  }
  return secret;
}
__name(resolveSessionSecret, "resolveSessionSecret");
function createSessionCookie(token, maxAge, request) {
  const isLocalhost = request.url.includes("localhost") || request.url.includes("127.0.0.1");
  const secure = isLocalhost ? "" : " Secure;";
  return `deeds_session=${token}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${maxAge}`;
}
__name(createSessionCookie, "createSessionCookie");
function base64UrlEncode(input) {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlEncodeFromArrayBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return base64UrlEncode(binary);
}
__name(base64UrlEncodeFromArrayBuffer, "base64UrlEncodeFromArrayBuffer");
function base64UrlDecodeToString(value) {
  let input = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = input.length % 4;
  if (pad) input += "=".repeat(4 - pad);
  return atob(input);
}
__name(base64UrlDecodeToString, "base64UrlDecodeToString");
function base64UrlToUint8Array(value) {
  const binary = base64UrlDecodeToString(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(base64UrlToUint8Array, "base64UrlToUint8Array");
async function createSessionToken(userId, role, secret) {
  if (!secret) throw new Error("SESSION_SECRET missing");
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { sub: String(userId), role: role || "user", iat: Math.floor(Date.now() / 1e3) };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(unsigned));
  return `${unsigned}.${base64UrlEncodeFromArrayBuffer(signature)}`;
}
__name(createSessionToken, "createSessionToken");
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
__name(verifySessionToken, "verifySessionToken");
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
function responseWithMessage(message, status = 200, extra = {}) {
  return Response.json({ message, ...extra }, { status });
}
__name(responseWithMessage, "responseWithMessage");
function requireRole(session, role) {
  if (!session || session.role !== role) {
    return responseWithMessage(`${role} access required.`, 403);
  }
  return null;
}
__name(requireRole, "requireRole");
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
  const created = (/* @__PURE__ */ new Date()).toISOString();
  const res = await db.prepare("INSERT INTO users (name,email,password_hash,role,verification_status,created_at) VALUES (?1,?2,?3,'user','pending',?4)").bind(name, email, hash, created).run();
  const token = await createSessionToken(res.meta.last_row_id, "user", resolveSessionSecret(env));
  const response = responseWithMessage("Signup successful.", 201, {
    profile: { id: res.meta.last_row_id, name, email, role: "user", sessionToken: token }
  });
  response.headers.set(
    "Set-Cookie",
    createSessionCookie(token, 30 * 24 * 60 * 60, request)
  );
  return response;
}
__name(handleSignup, "handleSignup");
async function handleLogin(request, env) {
  const db = env.DEEDS_DB;
  const body = await parseJsonBody(request);
  if (!db || !body) return responseWithMessage("Invalid request.", 400);
  const email = sanitizeText(body.email).toLowerCase();
  const password = String(body.password || "");
  const user = await db.prepare(
    `SELECT u.id,u.name,u.email,u.password_hash,u.role,u.credits,
       COALESCE(SUM(CASE WHEN d.status='verified' THEN 1 ELSE 0 END),0) AS completed
       FROM users u LEFT JOIN deeds d ON d.user_id=u.id WHERE u.email=?1 GROUP BY u.id`
  ).bind(email).first();
  if (!user) return responseWithMessage("Account not found.", 404);
  if (await hashPassword(password) !== user.password_hash)
    return responseWithMessage("Invalid credentials.", 401);
  const token = await createSessionToken(user.id, user.role, resolveSessionSecret(env));
  const response = responseWithMessage(`Welcome back, ${user.name}!`, 200, {
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      credits: user.credits,
      completed: user.completed,
      sessionToken: token
    }
  });
  response.headers.set(
    "Set-Cookie",
    createSessionCookie(token, 30 * 24 * 60 * 60, request)
  );
  return response;
}
__name(handleLogin, "handleLogin");
async function handleLogout(request, env) {
  const response = responseWithMessage("Logged out successfully.", 200);
  response.headers.set(
    "Set-Cookie",
    createSessionCookie("", 0, request)
  );
  return response;
}
__name(handleLogout, "handleLogout");
async function handleCreateDeed(request, env) {
  const db = env.DEEDS_DB;
  const auth = request.headers.get("authorization") || "";
  const token = (auth.match(/^Bearer\s+(.+)$/i) || [])[1];
  const session = await verifySessionToken(token, resolveSessionSecret(env));
  if (!session) return responseWithMessage("Authentication required.", 401);
  const body = await parseJsonBody(request);
  if (!db || !body) return responseWithMessage("Invalid request.", 400);
  const userId = Number(body.user_id);
  const title = sanitizeText(body.title);
  const proof = normalizeUrl(body.proof_url);
  if (!userId || !title || !proof) return responseWithMessage("Missing deed data.", 400);
  if (userId !== session.userId) {
    return responseWithMessage("Cannot submit deeds for other users.", 403);
  }
  try {
    await db.prepare(
      "INSERT INTO deeds (user_id,title,description,proof_url,impact,duration,status,created_at) VALUES (?1,?2,?3,?4,?5,?6,'pending',datetime('now'))"
    ).bind(userId, title, body.description || "", proof, body.impact || "", body.duration || "").run();
    return responseWithMessage("Deed submitted for review.", 201, { success: true });
  } catch (error) {
    console.error("Database error creating deed (attempting with all columns):", error);
    try {
      console.log("Retrying with base schema columns only...");
      await db.prepare(
        "INSERT INTO deeds (user_id,title,proof_url,status,created_at) VALUES (?1,?2,?3,'pending',datetime('now'))"
      ).bind(userId, title, proof).run();
      return responseWithMessage("Deed submitted for review.", 201, { success: true });
    } catch (fallbackError) {
      console.error("Database error creating deed (base columns):", fallbackError);
      try {
        console.log("Final attempt: INSERT with explicit NULL id...");
        await db.prepare(
          "INSERT INTO deeds (id,user_id,title,proof_url,status,created_at) VALUES (NULL,?1,?2,?3,'pending',datetime('now'))"
        ).bind(userId, title, proof).run();
        return responseWithMessage("Deed submitted for review.", 201, { success: true });
      } catch (finalError) {
        console.error("All INSERT attempts failed:", finalError);
        return responseWithMessage(`Database error: ${finalError.message}. Please contact support - database schema may need repair.`, 500);
      }
    }
  }
}
__name(handleCreateDeed, "handleCreateDeed");
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
  await db.prepare("UPDATE deeds SET status='verified',verified_at=datetime('now') WHERE id=?1").bind(deedId).run();
  await db.prepare("UPDATE users SET credits=credits+1 WHERE id=?1").bind(deed.user_id).run();
  return Response.json({ success: true, deed_id: deedId });
}
__name(handleVerifyDeed, "handleVerifyDeed");
async function handleGetDeeds(request, env) {
  const db = env.DEEDS_DB;
  const auth = request.headers.get("authorization") || "";
  const token = (auth.match(/^Bearer\s+(.+)$/i) || [])[1];
  const session = await verifySessionToken(token, resolveSessionSecret(env));
  console.log("GET /api/deeds - session:", session);
  if (!session) return responseWithMessage("Authentication required.", 401);
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  let userId = url.searchParams.get("user_id");
  if (session.role !== "admin") {
    if (userId && Number(userId) !== session.userId) {
      return responseWithMessage("Cannot view other users' deeds.", 403);
    }
    userId = String(session.userId);
  }
  let query = `SELECT d.id, d.user_id, d.title, d.description, d.category, d.proof_url,
    d.impact, d.duration, d.status, d.verified_at, d.created_at,
    u.name as user_name, u.email as user_email
    FROM deeds d
    LEFT JOIN users u ON d.user_id = u.id
    WHERE 1=1`;
  const params = [];
  if (status && status !== "all") {
    query += ` AND d.status = ?`;
    params.push(status);
  }
  if (userId) {
    query += ` AND d.user_id = ?`;
    params.push(Number(userId));
  }
  query += ` ORDER BY d.created_at DESC LIMIT 100`;
  console.log("GET /api/deeds - query:", query);
  console.log("GET /api/deeds - params:", params);
  console.log("GET /api/deeds - role:", session.role, "userId filter:", userId);
  try {
    let stmt = db.prepare(query);
    params.forEach((param) => {
      stmt = stmt.bind(param);
    });
    const res = await stmt.all();
    console.log("GET /api/deeds - results count:", res.results?.length || 0);
    const deeds = (res.results || []).map((d) => ({
      id: d.id,
      user_id: d.user_id,
      user_name: d.user_name || "Unknown",
      user_email: d.user_email || "",
      title: sanitizeText(d.title),
      description: sanitizeText(d.description),
      category: d.category || "general",
      proof_url: d.proof_url,
      impact: d.impact || "",
      duration: d.duration || "",
      status: d.status,
      verified_at: d.verified_at,
      created_at: d.created_at
    }));
    return Response.json(deeds);
  } catch (error) {
    console.error("Error fetching deeds:", error);
    return responseWithMessage("Failed to fetch deeds.", 500);
  }
}
__name(handleGetDeeds, "handleGetDeeds");
async function handleLeaderboard(env) {
  const db = env.DEEDS_DB;
  const res = await db.prepare(
    `SELECT u.id,u.name,u.region,u.sector,u.credits,
        COUNT(d.id) AS total_deeds,
        COUNT(CASE WHEN d.status='verified' THEN 1 END) AS deeds_verified
      FROM users u
      LEFT JOIN deeds d ON u.id=d.user_id
      GROUP BY u.id
      ORDER BY u.credits DESC,deeds_verified DESC,u.name ASC
      LIMIT 50`
  ).all();
  const board = (res.results || []).map((r) => ({
    id: r.id,
    name: r.name || "Neighbor",
    region: r.region || "\u2014",
    sector: r.sector || "General",
    credits: Number(r.credits ?? 0),
    verified: Number(r.deeds_verified ?? 0),
    total: Number(r.total_deeds ?? 0)
  }));
  return Response.json(board);
}
__name(handleLeaderboard, "handleLeaderboard");
async function handleDeedCatalog(env) {
  const db = env.DEEDS_DB;
  const res = await db.prepare("SELECT id,title,description,impact,duration FROM deed_catalog ORDER BY id ASC").all();
  return Response.json(res.results || []);
}
__name(handleDeedCatalog, "handleDeedCatalog");
async function handleProfile(request, env) {
  const db = env.DEEDS_DB;
  const id = Number(new URL(request.url).searchParams.get("user_id"));
  if (!id) return responseWithMessage("Invalid user_id", 400);
  const res = await db.prepare(
    `SELECT u.id,u.name,u.email,u.credits,
      COUNT(d.id) AS total_deeds,
      COUNT(CASE WHEN d.status='verified' THEN 1 END) AS verified_deeds
      FROM users u
      LEFT JOIN deeds d ON u.id=d.user_id
      WHERE u.id=?1 GROUP BY u.id`
  ).bind(id).all();
  return Response.json(res.results[0] || { message: "User not found" });
}
__name(handleProfile, "handleProfile");
var worker_default = {
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
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    if (method === "GET" && (path.startsWith("/admin/") || path === "/admin")) {
      const cookieHeader = request.headers.get("Cookie") || "";
      const sessionCookie = cookieHeader.split(";").find((c) => c.trim().startsWith("deeds_session="));
      const token = sessionCookie ? sessionCookie.split("=")[1].trim() : null;
      const session = await verifySessionToken(token, resolveSessionSecret(env));
      if (!session || session.role !== "admin") {
        return new Response(
          `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Access Denied</title>
  <script>
    // Store intended destination
    sessionStorage.setItem('returnUrl', '${path}');
    // Redirect to login
    window.location.href = '/login.html';
  <\/script>
</head>
<body>
  <p>Redirecting to login...</p>
</body>
</html>`,
          {
            status: 403,
            headers: {
              "Content-Type": "text/html"
            }
          }
        );
      }
    }
    if (path === "/api/auth/signup" && method === "POST")
      return handleSignup(request, env);
    if (path === "/api/auth/login" && method === "POST")
      return handleLogin(request, env);
    if (path === "/api/auth/logout" && method === "POST")
      return handleLogout(request, env);
    if (path === "/api/deeds" && method === "POST")
      return handleCreateDeed(request, env);
    if (path === "/api/deeds" && method === "GET")
      return handleGetDeeds(request, env);
    if (path === "/api/verify" && method === "POST")
      return handleVerifyDeed(request, env);
    if (path === "/api/deed_catalog" && method === "GET")
      return handleDeedCatalog(env);
    if (path === "/api/leaderboard" && method === "GET")
      return handleLeaderboard(env);
    if (path === "/api/profile" && method === "GET")
      return handleProfile(request, env);
    return new Response("Not found", { status: 404 });
  }
};

// ../../usr/local/share/nvm/versions/node/v22.17.0/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../usr/local/share/nvm/versions/node/v22.17.0/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-ae18cH/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../usr/local/share/nvm/versions/node/v22.17.0/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-ae18cH/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=_worker.js.map
