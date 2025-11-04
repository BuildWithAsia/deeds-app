async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch (error) {
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
  if (!pathname) {
    return "/";
  }
  if (pathname === "/") {
    return pathname;
  }
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
  } catch (error) {
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

  if (cachedSessionSecret) {
    return cachedSessionSecret;
  }

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
      "SESSION_SECRET is not configured. Generated an ephemeral secret for development. Configure SESSION_SECRET to persist sessions.",
    );
    sessionSecretWarningIssued = true;
  }

  return generatedSecret;
}

function base64UrlEncode(input) {
  const base64 = btoa(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return base64;
}

function base64UrlEncodeFromArrayBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}

function base64UrlDecodeToString(value) {
  let input = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const pad = input.length % 4;
  if (pad) {
    input += "=".repeat(4 - pad);
  }
  return atob(input);
}

function base64UrlToUint8Array(value) {
  const binary = base64UrlDecodeToString(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function createSessionToken(userId, isAdmin, secret) {
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: String(userId),
    admin: !!isAdmin,
    iat: Math.floor(Date.now() / 1000),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(unsignedToken),
  );

  const encodedSignature = base64UrlEncodeFromArrayBuffer(signature);
  return `${unsignedToken}.${encodedSignature}`;
}

async function verifySessionToken(token, secret) {
  if (!secret || !token) {
    return null;
  }

  const parts = String(token).split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["verify"],
    );

    const signatureValid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToUint8Array(encodedSignature),
      encoder.encode(unsignedToken),
    );

    if (!signatureValid) {
      return null;
    }

    const payloadJson = base64UrlDecodeToString(encodedPayload);
    const payload = JSON.parse(payloadJson);

    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

    return {
      userId,
      isAdmin: !!payload.admin,
    };
  } catch (error) {
    console.error("Failed to verify session token", error);
    return null;
  }
}

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

async function handleSignup(request, env) {
  if (!env.DEEDS_DB) {
    return responseWithMessage(
      "Database binding missing. Configure DEEDS_DB.",
      500,
    );
  }

  const payload = await parseJsonBody(request);
  if (!payload) {
    return responseWithMessage("Invalid JSON payload.", 400);
  }

  const sessionSecret = resolveSessionSecret(env);

  const name = String(payload.name || "").trim();
  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const password = String(payload.password || "");
  const sectorInput = sanitizeText(payload.sector ?? payload.user_sector);
  const regionInput = sanitizeText(payload.region ?? payload.user_region);

  const sector = sectorInput || null;
  const region = regionInput || null;
  const verificationStatus = "pending";

  if (!name || !email || !password) {
    return responseWithMessage("Name, email, and password are required.", 400);
  }

  if (password.length < 8) {
    return responseWithMessage(
      "Passwords must be at least 8 characters long.",
      400,
    );
  }

  try {
    const existing = await env.DEEDS_DB.prepare(
      "SELECT id FROM users WHERE email = ?1",
    )
      .bind(email)
      .first();

    if (existing) {
      return responseWithMessage(
        "An account with this email already exists. Please log in.",
        409,
      );
    }

    const hashedPassword = await hashPassword(password);
    const createdAt = new Date().toISOString();

    const result = await env.DEEDS_DB.prepare(
      "INSERT INTO users (name, email, password_hash, sector, region, verification_status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
      .bind(
        name,
        email,
        hashedPassword,
        sector,
        region,
        verificationStatus,
        createdAt,
      )
      .run();

    const userId = result.meta.last_row_id;
    const isAdmin = false;
    const sessionToken = await createSessionToken(
      userId,
      isAdmin,
      sessionSecret,
    );

    const profile = {
      id: userId,
      name,
      email,
      sector,
      region,
      verificationStatus,
      createdAt,
      credits: 0,
      completed: 0,
      is_admin: isAdmin,
      sessionToken,
    };

    return responseWithMessage(
      `Welcome to Deeds, ${name.split(" ")[0]}!`,
      201,
      { profile },
    );
  } catch (error) {
    console.error("Sign-up failed", error);
    return responseWithMessage(
      "We could not create your account. Please try again later.",
      500,
    );
  }
}

async function handleLogin(request, env) {
  if (!env.DEEDS_DB) {
    return responseWithMessage(
      "Database binding missing. Configure DEEDS_DB.",
      500,
    );
  }

  const payload = await parseJsonBody(request);
  if (!payload) {
    return responseWithMessage("Invalid JSON payload.", 400);
  }

  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const password = String(payload.password || "");

  const sessionSecret = resolveSessionSecret(env);

  if (!email || !password) {
    return responseWithMessage("Email and password are required.", 400);
  }

  try {
    const user = await env.DEEDS_DB.prepare(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.password_hash,
        u.sector,
        u.region,
        u.verification_status,
        u.created_at,
        u.credits,
        u.is_admin,
        COALESCE(SUM(CASE WHEN d.status = 'verified' THEN 1 ELSE 0 END), 0) AS completed
      FROM users u
      LEFT JOIN deeds d ON d.user_id = u.id
      WHERE u.email = ?1
      GROUP BY u.id`,
    )
      .bind(email)
      .first();

    if (!user) {
      return responseWithMessage(
        "We could not find that account. Please sign up first.",
        404,
      );
    }

    const submittedHash = await hashPassword(password);
    const storedHash = String(user.password_hash || "");

    console.log("Login hash comparison", {
      submittedHash,
      storedHash,
    });

    if (submittedHash !== storedHash) {
      return responseWithMessage("Invalid email or password.", 401);
    }

    const credits = Number(user.credits ?? 0);
    const completed = Number(
      (user.completed != null ? user.completed : undefined) ?? credits,
    );

    const isAdmin = !!user.is_admin;
    const sessionToken = await createSessionToken(
      user.id,
      isAdmin,
      sessionSecret,
    );

    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      sector: user.sector,
      region: user.region,
      verificationStatus: user.verification_status,
      createdAt: user.created_at,
      credits,
      completed,
      is_admin: isAdmin,
      sessionToken,
    };

    const greetingName = user.name?.split(" ")[0] || user.email;
    return responseWithMessage(`Welcome back, ${greetingName}!`, 200, {
      profile,
    });
  } catch (error) {
    console.error("Login failed", error);
    return responseWithMessage(
      "We could not log you in. Please try again later.",
      500,
    );
  }
}

async function handleCreateDeed(request, env) {
  if (!env.DEEDS_DB) {
    return responseWithMessage(
      "Database binding missing. Configure DEEDS_DB.",
      500,
    );
  }

  const payload = await parseJsonBody(request);
  if (!payload) {
    return responseWithMessage("Invalid JSON payload.", 400);
  }

  const userId = Number(payload.user_id ?? payload.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return responseWithMessage("A valid user_id must be provided.", 400);
  }

  const title = sanitizeText(payload.title ?? payload.deed_title);
  if (!title) {
    return responseWithMessage("A deed title is required.", 400);
  }

  const description = sanitizeText(
    payload.description ?? payload.details ?? payload.deed_description,
  );

  const categoryInput = sanitizeText(
    payload.category ?? payload.deed_category ?? payload.type,
  );
  const category = categoryInput || "general";

  const proofUrlInput =
    payload.proof_url ?? payload.proofUrl ?? payload.proof ?? "";
  const normalizedProofUrl = normalizeUrl(proofUrlInput);
  if (normalizedProofUrl === "") {
    return responseWithMessage(
      "A proof URL is required to submit your deed.",
      400,
    );
  }
  if (normalizedProofUrl === null) {
    return responseWithMessage(
      "Please provide a valid proof link, including http:// or https://.",
      400,
    );
  }

  const db = env.DEEDS_DB;

  if (!db) {
    return responseWithMessage(
      "Database binding missing. Configure DEEDS_DB.",
      500,
    );
  }

  try {
    const user = await db
      .prepare("SELECT id FROM users WHERE id = ?1")
      .bind(userId)
      .first();

    if (!user) {
      return responseWithMessage(
        "We could not find that user account. Please log in again.",
        404,
      );
    }

    const insertStmt = db.prepare(
      `INSERT INTO deeds (
        user_id,
        title,
        description,
        category,
        proof_url,
        status,
        credits,
        created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, 'pending', 0, datetime('now'))`,
    );

    const result = await insertStmt
      .bind(userId, title, description || null, category, normalizedProofUrl)
      .run();

    return Response.json(
      {
        success: true,
        deed_id: result.meta.last_row_id,
        status: "pending",
      },
      { status: 201 },
    );
  } catch (error) {
    const errorMessage =
      (error && typeof error === "object" && "message" in error
        ? error.message
        : null) || "We could not save your deed. Please try again later.";

    console.error("Deed save error:", errorMessage);

    return Response.json(
      { success: false, message: errorMessage },
      { status: 500 },
    );
  }
}

async function handleVerifyDeed(request, env) {
  if (!env.DEEDS_DB) {
    return responseWithMessage(
      "Database binding missing. Configure DEEDS_DB.",
      500,
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = tokenMatch ? tokenMatch[1].trim() : "";

  const sessionSecret = resolveSessionSecret(env);
  const session = await verifySessionToken(token, sessionSecret);
  if (!session || !session.userId) {
    return responseWithMessage("Invalid or expired session.", 403);
  }

  try {
    const adminUser = await env.DEEDS_DB.prepare(
      "SELECT id, is_admin FROM users WHERE id = ?1",
    )
      .bind(session.userId)
      .first();

    if (!adminUser || !adminUser.is_admin) {
      return responseWithMessage("Administrator access required.", 403);
    }

    const payload = await parseJsonBody(request);
    if (!payload) {
      return responseWithMessage("Invalid JSON payload.", 400);
    }

    const deedId = Number(payload.deed_id ?? payload.deedId);
    if (!Number.isInteger(deedId) || deedId <= 0) {
      return responseWithMessage("A valid deed_id must be provided.", 400);
    }

    // Step 1: Fetch deed details (including reward)
    const deed = await env.DEEDS_DB.prepare(
      "SELECT id, user_id, credits, status, reward FROM deeds WHERE id = ?1",
    )
      .bind(deedId)
      .first();

    if (!deed) {
      return responseWithMessage("We couldn't find that deed.", 404);
    }

    if (String(deed.status).toLowerCase() === "verified") {
      return responseWithMessage("This deed is already verified.", 409);
    }

    // Step 2: Determine reward
    const rewardValue = Number(deed.reward ?? 1);

    // Step 3: Mark deed as verified
    const updateDeed = await env.DEEDS_DB.prepare(
      `UPDATE deeds 
       SET status = 'verified', 
           credits = ?2, 
           verified_at = COALESCE(verified_at, datetime('now')) 
       WHERE id = ?1`,
    )
      .bind(deedId, rewardValue)
      .run();

    if (!updateDeed.meta || updateDeed.meta.changes === 0) {
      return responseWithMessage("Failed to update deed.", 404);
    }

    // Step 4: Add reward to user credits
    await env.DEEDS_DB.prepare(
      "UPDATE users SET credits = COALESCE(credits, 0) + ?2 WHERE id = ?1",
    )
      .bind(deed.user_id, rewardValue)
      .run();

    // Step 5: Fetch updated profile summary
    const summary = await env.DEEDS_DB.prepare(
      `SELECT 
         u.id,
         u.name,
         u.credits,
         COUNT(d.id) AS total_deeds,
         COUNT(CASE WHEN d.status = 'verified' THEN 1 END) AS verified_deeds
       FROM users u
       LEFT JOIN deeds d ON u.id = d.user_id
       WHERE u.id = ?1
       GROUP BY u.id`,
    )
      .bind(deed.user_id)
      .first();

    return Response.json({
      success: true,
      deed: {
        id: deed.id,
        status: "verified",
        reward: rewardValue,
      },
      profile: {
        id: summary.id,
        name: summary.name,
        credits: Number(summary.credits ?? 0),
        total_deeds: Number(summary.total_deeds ?? 0),
        verified_deeds: Number(summary.verified_deeds ?? 0),
      },
    });
  } catch (error) {
    console.error("Failed to verify deed", error);
    return responseWithMessage(
      "We could not verify the deed. Please try again later.",
      500,
    );
  }
}

const DEFAULT_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Deeds App</title>
    <link
      rel="preconnect"
      href="https://fonts.googleapis.com"
      crossorigin
    />
    <link
      rel="preconnect"
      href="https://fonts.gstatic.com"
      crossorigin
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      body {
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
        background: #0f172a;
        color: #f8fafc;
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 3rem 1.5rem;
        text-align: center;
      }
      main {
        max-width: 32rem;
        background: rgba(15, 118, 110, 0.12);
        border-radius: 1.5rem;
        padding: 2.75rem 2.25rem;
        box-shadow: 0 30px 60px -25px rgba(15, 118, 110, 0.8);
        border: 1px solid rgba(148, 163, 184, 0.2);
      }
      h1 {
        font-size: clamp(1.85rem, 2.2vw + 1.4rem, 2.75rem);
        margin-bottom: 1rem;
      }
      p {
        margin: 0.5rem 0;
        color: rgba(226, 232, 240, 0.88);
      }
      .cta {
        margin-top: 2rem;
        display: inline-flex;
        align-items: center;
        gap: 0.75rem;
        background: #0f766e;
        color: #f8fafc;
        padding: 0.85rem 1.8rem;
        border-radius: 999px;
        font-weight: 600;
        text-decoration: none;
        box-shadow: 0 12px 30px -18px rgba(45, 212, 191, 0.9);
        transition: transform 120ms ease, box-shadow 120ms ease;
      }
      .cta:hover {
        transform: translateY(-2px);
        box-shadow: 0 18px 36px -20px rgba(45, 212, 191, 1);
      }
      .links {
        margin-top: 2rem;
        display: flex;
        justify-content: center;
        gap: 1.25rem;
        flex-wrap: wrap;
        font-size: 0.95rem;
      }
      .links a {
        color: #22d3ee;
        text-decoration: none;
        font-weight: 600;
        transition: color 120ms ease;
      }
      .links a:hover {
        color: #5eead4;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Deeds App is getting things ready</h1>
      <p>Our updated experience is deploying now.</p>
      <p>Refresh in a moment to see the new landing page.</p>
      <a class="cta" href="/" rel="nofollow">Refresh</a>
      <p class="links">
        <a href="https://github.com/asiakay/deeds-app" target="_blank" rel="noopener">View on GitHub</a>
      </p>
    </main>
  </body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (url.pathname === "/api/auth/signup" && request.method === "POST") {
      const response = await handleSignup(request, env);
      response.headers.set("Access-Control-Allow-Origin", "*");
      return response;
    }

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const response = await handleLogin(request, env);
      response.headers.set("Access-Control-Allow-Origin", "*");
      return response;
    }

    //deeds start

    if (url.pathname === "/api/deeds" && request.method === "GET") {
      if (!env.DEEDS_DB) {
        const response = responseWithMessage(
          "Database binding missing. Configure DEEDS_DB.",
          500,
        );
        response.headers.set("Access-Control-Allow-Origin", "*");
        return response;
      }

      const sessionSecret = resolveSessionSecret(env);
      const authHeader = request.headers.get("Authorization") || "";
      const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      const token = tokenMatch ? tokenMatch[1].trim() : "";
      const session = await verifySessionToken(token, sessionSecret);

      if (!session) {
        const response = responseWithMessage(
          "A valid session token is required to view deeds.",
          403,
        );
        response.headers.set("Access-Control-Allow-Origin", "*");
        return response;
      }

      try {
        const statusParam = (url.searchParams.get("status") || "")
          .trim()
          .toLowerCase();
        const userIdParam = url.searchParams.get("user_id");
        const params = [];
        const conditions = [];

        // Build base query
        let query = `
      SELECT
        id, user_id, title, description, category, proof_url, status, credits, reward, created_at, verified_at
      FROM deeds
    `;

        // Optional filtering
        if (statusParam && statusParam !== "all") {
          conditions.push("status = ?");
          params.push(statusParam);
        }

        let requestedUserId = null;
        if (userIdParam) {
          const parsed = Number(userIdParam);
          if (Number.isInteger(parsed) && parsed > 0) {
            requestedUserId = parsed;
          }
        }

        if (session.isAdmin) {
          if (requestedUserId) {
            conditions.push("user_id = ?");
            params.push(requestedUserId);
          }
        } else {
          if (requestedUserId && requestedUserId !== session.userId) {
            const response = responseWithMessage(
              "You can only view your own deeds.",
              403,
            );
            response.headers.set("Access-Control-Allow-Origin", "*");
            return response;
          }

          conditions.push("user_id = ?");
          params.push(session.userId);
        }

        if (conditions.length > 0) {
          query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY datetime(created_at) DESC, id DESC";

        const { results } = await env.DEEDS_DB.prepare(query)
          .bind(...params)
          .all();

        const response = Response.json(results || []);
        response.headers.set("Access-Control-Allow-Origin", "*");
        return response;
      } catch (error) {
        console.error("Failed to load deeds", error.message || error);
        const response = responseWithMessage("Error fetching deeds.", 500, {
          error: error.message,
        });
        response.headers.set("Access-Control-Allow-Origin", "*");
        return response;
      }
    }

    //deeds get end

    if (url.pathname === "/api/deeds" && request.method === "POST") {
      const response = await handleCreateDeed(request, env);
      response.headers.set("Access-Control-Allow-Origin", "*");
      return response;
    }

    if (url.pathname === "/api/verify" && request.method === "POST") {
      const response = await handleVerifyDeed(request, env);
      response.headers.set("Access-Control-Allow-Origin", "*");
      return response;
    }

    if (url.pathname === "/api/leaderboard" && request.method === "GET") {
      if (!env.DEEDS_DB) {
        const response = responseWithMessage(
          "Database binding missing. Configure DEEDS_DB.",
          500,
        );
        response.headers.set("Access-Control-Allow-Origin", "*");
        return response;
      }

      try {
        const results = await env.DEEDS_DB.prepare(
          `
      WITH verified_counts AS (
        SELECT user_id, COUNT(*) AS deed_count
        FROM deeds
        WHERE status = ?1
        GROUP BY user_id
      )
      SELECT
        u.id AS user_id,
        u.name AS name,
        u.region AS region,
        u.credits AS stored_credits,
        COALESCE(vc.deed_count, 0) AS deed_count
      FROM users u
      LEFT JOIN verified_counts vc
        ON u.id = vc.user_id
      ORDER BY COALESCE(u.credits, vc.deed_count) DESC, vc.deed_count DESC, u.name ASC
      LIMIT 10;
    `,
        )
          .bind("verified")
          .all();
        const leaderboard = (results.results || []).map((row) => {
          const deedCount = Number(row.deed_count ?? 0);
          const credits = Number(
            row.stored_credits != null ? row.stored_credits : deedCount,
          );

          return {
            name: row.name ?? "Neighbor",
            credits,
            deedCount,
            region: row.region ?? null,
          };
        });

        const response = Response.json(leaderboard);
        response.headers.set("Access-Control-Allow-Origin", "*");
        return response;
      } catch (error) {
        console.error("Failed to load leaderboard", error);
        const response = responseWithMessage(
          "Unable to load leaderboard at this time.",
          500,
        );
        response.headers.set("Access-Control-Allow-Origin", "*");
        return response;
      }
    }

    // insert
    if (url.pathname === "/api/profile" && request.method === "GET") {
      const userId = Number(url.searchParams.get("user_id"));
      if (!userId || userId <= 0) {
        const response = Response.json(
          { message: "Missing or invalid user_id" },
          { status: 400 },
        );
        response.headers.set("Access-Control-Allow-Origin", "*");
        return response;
      }

      const { results } = await env.DEEDS_DB.prepare(
        `
    SELECT 
      u.id, 
      u.name, 
      u.email, 
      u.credits,
      COUNT(d.id) AS total_deeds,
      COUNT(CASE WHEN d.status = 'verified' THEN 1 END) AS verified_deeds
    FROM users u
    LEFT JOIN deeds d ON u.id = d.user_id
    WHERE u.id = ?
    GROUP BY u.id;
  `,
      )
        .bind(userId)
        .all();

      const profile = results[0] || null;

      const response = Response.json(profile || { message: "User not found" });
      response.headers.set("Access-Control-Allow-Origin", "*");
      return response;
    }
    // end

    if (env.ASSETS) {
      let assetRequest = request;

      if (request.method === "GET") {
        const normalizedPath = normalizePathname(url.pathname);
        const assetPath = STATIC_PAGE_ROUTES.get(normalizedPath);
        if (assetPath) {
          const assetUrl = new URL(assetPath, url.origin);
          assetRequest = new Request(assetUrl.toString(), {
            method: "GET",
            headers: new Headers(request.headers),
          });
        }
      }

      let assetResponse = await env.ASSETS.fetch(assetRequest);

      if (assetResponse.status === 404 && request.method === "GET") {
        const indexUrl = new URL("/index.html", url.origin);
        const indexRequest = new Request(indexUrl.toString(), {
          method: "GET",
          headers: request.headers,
        });
        assetResponse = await env.ASSETS.fetch(indexRequest);
      }

      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    if (request.method === "GET") {
      const acceptsHTML = String(request.headers.get("accept") || "").includes(
        "text/html",
      );
      if (acceptsHTML) {
        return new Response(DEFAULT_HTML, {
          headers: { "Content-Type": "text/html; charset=UTF-8" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
