import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { createProxyMiddleware } from "http-proxy-middleware";
import { initializeDatabase, pool } from "./db.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const isProduction = process.env.NODE_ENV === "production";
const sessionDays = 30;
const sessionCookie = "syllabic_session";
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const distDirectory = path.join(projectRoot, "dist");
const viteUrl = process.env.VITE_URL ?? "http://localhost:5173";

app.use(express.json({ limit: "32kb" }));

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function setSessionCookie(response: Response, token: string) {
  const maxAge = sessionDays * 24 * 60 * 60 * 1000;
  response.cookie(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge,
    path: "/",
  });
}

function readCookie(request: Request, name: string) {
  const cookies =
    request.headers.cookie?.split(";").map((part) => part.trim()) ?? [];
  return cookies
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function getUser(request: Request) {
  const token = readCookie(request, sessionCookie);
  if (!token) return null;
  const result = await pool.query<{ id: string; email: string }>(
    `SELECT users.id, users.email
		 FROM sessions
		 JOIN users ON users.id = sessions.user_id
		 WHERE sessions.token_hash = $1 AND sessions.expires_at > NOW()`,
    [hashToken(token)],
  );
  return result.rows[0] ?? null;
}

function validCredentials(email: unknown, password: unknown) {
  return (
    typeof email === "string" &&
    email.includes("@") &&
    typeof password === "string" &&
    password.length >= 8
  );
}

app.post("/api/auth/register", async (request, response) => {
  const { email, password } = request.body as {
    email?: unknown;
    password?: unknown;
  };
  if (!validCredentials(email, password)) {
    response.status(400).json({
      error:
        "Email invalide ou mot de passe trop court (8 caractères minimum).",
    });
    return;
  }
  try {
    const passwordHash = await bcrypt.hash(password as string, 12);
    const result = await pool.query<{ id: string; email: string }>(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [(email as string).trim().toLowerCase(), passwordHash],
    );
    const token = await createSession(result.rows[0].id);
    setSessionCookie(response, token);
    response.status(201).json({ user: result.rows[0] });
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      response
        .status(409)
        .json({ error: "Cette adresse email est déjà utilisée." });
      return;
    }
    console.error(error);
    response.status(500).json({ error: "Impossible de créer le compte." });
  }
});

app.post("/api/auth/login", async (request, response) => {
  const { email, password } = request.body as {
    email?: unknown;
    password?: unknown;
  };
  if (!validCredentials(email, password)) {
    response.status(400).json({ error: "Email ou mot de passe invalide." });
    return;
  }
  const result = await pool.query<{
    id: string;
    email: string;
    password_hash: string;
  }>("SELECT id, email, password_hash FROM users WHERE email = $1", [
    (email as string).trim().toLowerCase(),
  ]);
  const user = result.rows[0];
  if (
    !user ||
    !(await bcrypt.compare(password as string, user.password_hash))
  ) {
    response.status(401).json({ error: "Email ou mot de passe incorrect." });
    return;
  }
  const token = await createSession(user.id);
  setSessionCookie(response, token);
  response.json({ user: { id: user.id, email: user.email } });
});

app.post("/api/auth/logout", async (request, response) => {
  const token = readCookie(request, sessionCookie);
  if (token)
    await pool.query("DELETE FROM sessions WHERE token_hash = $1", [
      hashToken(token),
    ]);
  response.clearCookie(sessionCookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
  });
  response.status(204).end();
});

app.get("/api/auth/me", async (request, response) => {
  const user = await getUser(request);
  if (!user) {
    response.status(401).json({ error: "Non authentifié." });
    return;
  }
  response.json({ user });
});

app.get("/api/save", async (request, response) => {
  const user = await getUser(request);
  if (!user) {
    response.status(401).json({ error: "Non authentifié." });
    return;
  }
  const result = await pool.query<{ data: unknown }>(
    "SELECT data FROM saves WHERE user_id = $1",
    [user.id],
  );
  response.json({ save: result.rows[0]?.data ?? null });
});

app.put("/api/save", async (request, response) => {
  const user = await getUser(request);
  if (!user) {
    response.status(401).json({ error: "Non authentifié." });
    return;
  }
  if (
    !request.body ||
    typeof request.body !== "object" ||
    Array.isArray(request.body)
  ) {
    response.status(400).json({ error: "Sauvegarde invalide." });
    return;
  }
  await pool.query(
    `INSERT INTO saves (user_id, data) VALUES ($1, $2)
		 ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [user.id, JSON.stringify(request.body)],
  );
  response.status(204).end();
});

async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days')",
    [hashToken(token), userId],
  );
  return token;
}

function configureWebsiteProxy() {
  if (isProduction) {
    app.use(express.static(distDirectory));
    app.use((request, response, next) => {
      if (request.method !== "GET" && request.method !== "HEAD") {
        next();
        return;
      }
      if (request.path.startsWith("/api")) {
        next();
        return;
      }
      response.sendFile(path.join(distDirectory, "index.html"));
    });
    return;
  }

  app.use(
    createProxyMiddleware({
      target: viteUrl,
      changeOrigin: true,
      ws: true,
      pathFilter: (pathname) => !pathname.startsWith("/api"),
    }),
  );
}

configureWebsiteProxy();

initializeDatabase()
  .then(() => {
    app.listen(port, () =>
      console.log(`API prête sur http://localhost:${port}`),
    );
  })
  .catch((error) => {
    console.error("Impossible d'initialiser PostgreSQL", error);
    process.exitCode = 1;
  });
