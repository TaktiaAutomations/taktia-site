import { type Express } from "express";
import { nanoid } from "nanoid";
import { Pool } from "pg";

type LinkedInOAuthToken = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: "Bearer";
};

type LinkedInUserInfo = {
  sub: string;
  aud: string;
  name: string;
  picture?: string;
  email: string;
  email_verified: boolean;
  iss: string;
  iat: number;
  exp: number;
};

let dbPool: Pool | null = null;
const oauthStateStore = new Map<string, number>();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function createOauthState(): string {
  const state = nanoid(32);
  oauthStateStore.set(state, Date.now() + OAUTH_STATE_TTL_MS);
  return state;
}

function validateAndConsumeOauthState(state: string): boolean {
  const expiresAt = oauthStateStore.get(state);
  oauthStateStore.delete(state);

  if (!expiresAt) {
    return false;
  }

  return Date.now() <= expiresAt;
}

function purgeExpiredOauthStates() {
  const now = Date.now();
  oauthStateStore.forEach((expiresAt, key) => {
    if (expiresAt < now) {
      oauthStateStore.delete(key);
    }
  });
}

function getDbPool(): Pool {
  if (dbPool) {
    return dbPool;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não configurada.");
  }

  const sslDisabled = process.env.DATABASE_SSL === "false";

  dbPool = new Pool({
    connectionString: databaseUrl,
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
    max: 10,
  });

  return dbPool;
}

async function ensureOAuthSchema() {
  const pool = getDbPool();

  // Create OAuth tokens table (app_users is created by linkedinDiagnostics)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS linkedin_oauth_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      scope TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function getLinkedinAuthConfig() {
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("LinkedIn OAuth credentials not configured (LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI)");
  }

  return { clientId, clientSecret, redirectUri };
}

function buildLinkedinAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getLinkedinAuthConfig();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "openid profile email",
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

async function exchangeCodeForToken(code: string): Promise<LinkedInOAuthToken> {
  const { clientId, clientSecret, redirectUri } = getLinkedinAuthConfig();

  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }).toString(),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`LinkedIn token exchange failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as LinkedInOAuthToken;
  return data;
}

async function fetchLinkedinUserInfo(accessToken: string): Promise<LinkedInUserInfo> {
  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`LinkedIn userinfo API failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as LinkedInUserInfo;
  return data;
}

export async function registerLinkedinOAuthRoutes(app: Express) {
  await ensureOAuthSchema();
  setInterval(purgeExpiredOauthStates, 60 * 1000).unref();

  // Step 1: Redirect user to LinkedIn authorization
  app.get("/api/auth/linkedin/authorize", (_req, res) => {
    try {
      const state = createOauthState();
      const authUrl = buildLinkedinAuthorizationUrl(state);

      res.redirect(authUrl);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Falha ao iniciar autorização LinkedIn: ${details}` });
    }
  });

  // Step 2: Handle OAuth callback
  app.get("/api/auth/linkedin/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
    const state = typeof req.query.state === "string" ? req.query.state.trim() : "";
    const error = typeof req.query.error === "string" ? req.query.error : null;

    if (error) {
      res.status(400).json({ error: `Autorização LinkedIn recusada: ${error}` });
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Código de autorização não recebido do LinkedIn." });
      return;
    }

    if (!state) {
      res.status(400).json({ error: "Estado de segurança ausente no callback." });
      return;
    }

    try {
      if (!validateAndConsumeOauthState(state)) {
        res.status(400).json({ error: "Estado de segurança inválido. Tente novamente." });
        return;
      }

      // Exchange code for token
      const tokenData = await exchangeCodeForToken(code);

      // Fetch user info
      const userInfo = await fetchLinkedinUserInfo(tokenData.access_token);

      // Save/update user in database
      const pool = getDbPool();
      const userId = `usr_${nanoid(12)}`;

      await pool.query(
        `INSERT INTO app_users (id, email, full_name, auth_provider)
         VALUES ($1, $2, $3, 'linkedin')
         ON CONFLICT (email)
         DO UPDATE SET full_name = COALESCE(EXCLUDED.full_name, app_users.full_name),
                       auth_provider = EXCLUDED.auth_provider,
                       updated_at = NOW()`,
        [userId, userInfo.email, userInfo.name],
      );

      const finalUser = await pool.query<{ id: string }>(`SELECT id FROM app_users WHERE email = $1`, [userInfo.email]);
      const finalUserId = finalUser.rows[0]?.id;

      // Save OAuth token
      const tokenId = `tok_${nanoid(14)}`;
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      await pool.query(
        `INSERT INTO linkedin_oauth_tokens (id, user_id, access_token, expires_at, scope)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id)
         DO UPDATE SET access_token = EXCLUDED.access_token,
                       expires_at = EXCLUDED.expires_at,
                       scope = EXCLUDED.scope,
                       updated_at = NOW()`,
        [tokenId, finalUserId, tokenData.access_token, expiresAt.toISOString(), tokenData.scope],
      );

      // Redirect to frontend with success (adjust URL based on your frontend)
      res.redirect(`/?auth=success&email=${encodeURIComponent(userInfo.email)}&name=${encodeURIComponent(userInfo.name)}`);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.redirect(`/?auth=error&message=${encodeURIComponent(details)}`);
    }
  });

  // Endpoint to get authenticated user's LinkedIn profile (optional)
  app.get("/api/auth/linkedin/profile", async (req, res) => {
    const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";

    if (!email) {
      res.status(400).json({ error: "Email não fornecido." });
      return;
    }

    try {
      const pool = getDbPool();

      const result = await pool.query<{
        access_token: string;
        expires_at: string;
      }>(
        `SELECT lat.access_token, lat.expires_at
         FROM linkedin_oauth_tokens lat
         JOIN app_users u ON u.id = lat.user_id
         WHERE u.email = $1`,
        [email],
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: "Perfil LinkedIn não encontrado. Faça login primeiro." });
        return;
      }

      const row = result.rows[0];
      const now = new Date();
      const expiresAt = new Date(row.expires_at);

      if (now > expiresAt) {
        res.status(401).json({ error: "Token expirou. Faça login novamente." });
        return;
      }

      // Fetch fresh user info
      const userInfo = await fetchLinkedinUserInfo(row.access_token);

      res.json({
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Falha ao obter perfil LinkedIn: ${details}` });
    }
  });

  // Endpoint to logout
  app.post("/api/auth/linkedin/logout", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";

    try {
      if (email) {
        const pool = getDbPool();
        await pool.query(
          `DELETE FROM linkedin_oauth_tokens
           WHERE user_id = (SELECT id FROM app_users WHERE email = $1)`,
          [email],
        );
      }

      res.json({ success: true });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Falha ao fazer logout: ${details}` });
    }
  });
}
