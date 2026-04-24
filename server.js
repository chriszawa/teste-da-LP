const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { appendLeadToSheets, readLeadsFromSheets, appendReplyToSheets, readRepliesFromSheets, isSheetsEnabled } = require("./googleSheets");
const { sendWhatsApp, sendGroupMessage, isWhatsAppEnabled } = require("./whatsapp");

// Simple in-memory rate limiter: max 5 lead submissions per IP per 60 s
const rateLimitStore = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    if (now >= entry.resetAt) rateLimitStore.delete(ip);
  }
}, 5 * 60_000).unref();

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.ndjson");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self' https: data:",
      "script-src 'self' https: 'unsafe-inline'",
      "style-src 'self' https: 'unsafe-inline'",
      "img-src 'self' https: data:",
      "font-src 'self' https: data:",
      "connect-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );
}

function loadEnvFileIfPresent() {
  const envPath = path.join(ROOT_DIR, ".env");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (!key) continue;
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

loadEnvFileIfPresent();

const PORT = Number(process.env.PORT || 3000);

// Ensure data directory exists at startup
fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
const CORS_ORIGIN = typeof process.env.CORS_ORIGIN === "string" ? process.env.CORS_ORIGIN.trim() : "";

function applyCorsHeaders(req, res) {
  if (!CORS_ORIGIN) return;
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "600");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

function safeJoinPublic(requestPathname) {
  const decoded = decodeURIComponent(requestPathname);
  const cleaned = decoded.replaceAll("\\", "/");
  const withoutQuery = cleaned.split("?")[0];
  const normalized = path.posix.normalize(withoutQuery);
  const rel = normalized.replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(PUBLIC_DIR, rel);
}

function readBodyJson(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error("body_too_large"), { code: "body_too_large" }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        const parsed = JSON.parse(raw || "{}");
        resolve(parsed);
      } catch (err) {
        reject(Object.assign(new Error("invalid_json"), { code: "invalid_json" }));
      }
    });

    req.on("error", (err) => reject(err));
  });
}

function normalizeString(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function validateLead(payload) {
  const nome = normalizeString(payload.nome);
  const telefone = normalizeString(payload.telefone);
  const email = normalizeString(payload.email);
  const empresa = normalizeString(payload.empresa);
  const segmento = normalizeString(payload.segmento);
  const faturamento = normalizeString(payload.faturamento);

  const errors = {};

  if (nome.length < 3) errors.nome = "Informe seu nome completo.";
  if (empresa.length < 2) errors.empresa = "Informe o nome do restaurante.";
  if (segmento.length < 2) errors.segmento = "Informe o segmento.";
  if (!faturamento) errors.faturamento = "Selecione a faixa de faturamento.";

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) errors.email = "Informe um e-mail válido.";

  const phoneDigits = telefone.replace(/\D/g, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    errors.telefone = "Informe um WhatsApp válido.";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    lead: { nome, telefone, email, empresa, segmento, faturamento },
  };
}

async function handleCreateLead(req, res) {
  const ip = req.socket.remoteAddress || "unknown";
  if (isRateLimited(ip)) {
    return sendJson(res, 429, { ok: false, error: "too_many_requests" });
  }

  let payload;
  try {
    payload = await readBodyJson(req);
  } catch (err) {
    if (err && err.code === "body_too_large") {
      return sendJson(res, 413, { ok: false, error: "payload_too_large" });
    }
    return sendJson(res, 400, { ok: false, error: "invalid_json" });
  }

  // Honeypot: bots fill this field, humans don't — silently accept to not reveal detection
  if (typeof payload.hp_website === "string" && payload.hp_website.trim().length > 0) {
    return sendJson(res, 200, { ok: true, id: crypto.randomUUID() });
  }

  const { ok, errors, lead } = validateLead(payload);
  if (!ok) return sendJson(res, 422, { ok: false, error: "validation_error", fields: errors });

  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...lead,
    meta: {
      ip,
      userAgent: req.headers["user-agent"] || null,
      referer: req.headers.referer || null,
      utm: typeof payload.utm === "object" && payload.utm ? payload.utm : null,
    },
  };

  fs.appendFileSync(LEADS_FILE, `${JSON.stringify(record)}\n`, "utf8");

  // Melhor esforço: tenta enviar ao Google Sheets, sem perder o lead local.
  // Se falhar, o lead continua salvo em `data/leads.ndjson`.
  if (isSheetsEnabled()) {
    appendLeadToSheets(record).catch(() => {});
  }

  if (isWhatsAppEnabled()) {
    sendWhatsApp(record).catch(() => {});
  }

  return sendJson(res, 200, { ok: true, id: record.id });
}

async async function handleWebhook(req, res) {
  res.writeHead(200);
  res.end("ok");

  let payload;
  try { payload = await readBodyJson(req); } catch { return; }

  if (payload.fromMe || payload.isGroup) return;

  const message = (payload.text?.message || payload.caption || "").trim();
  if (!message) return;

  const phone = payload.phone || "";
  const senderName = payload.senderName || payload.chatName || "Lead";

  const reply = { createdAt: new Date().toISOString(), phone, senderName, message };

  if (isSheetsEnabled()) appendReplyToSheets(reply).catch(() => {});

  const groupId = process.env.ZAPI_NOTIFY_GROUP;
  if (groupId && isWhatsAppEnabled()) {
    const notification =
      `🔔 *Lead respondeu!*\n\n` +
      `*Nome:* ${senderName}\n` +
      `*Mensagem:* ${message}`;
    sendGroupMessage(groupId, notification).catch(() => {});
  }
}

async function handleAdminReplies(req, res) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return sendJson(res, 503, { ok: false, error: "admin_not_configured" });

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== adminPassword) return sendJson(res, 401, { ok: false, error: "unauthorized" });

  try {
    const replies = isSheetsEnabled() ? await readRepliesFromSheets() : [];
    return sendJson(res, 200, { ok: true, replies: replies || [] });
  } catch {
    return sendJson(res, 200, { ok: true, replies: [] });
  }
}

async function handleAdminLeads(req, res) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return sendJson(res, 503, { ok: false, error: "admin_not_configured" });
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== adminPassword) {
    return sendJson(res, 401, { ok: false, error: "unauthorized" });
  }

  // Lê do Google Sheets se disponível (persistente), senão cai no arquivo local
  if (isSheetsEnabled()) {
    try {
      const leads = await readLeadsFromSheets();
      if (leads !== null) return sendJson(res, 200, { ok: true, leads });
    } catch { /* cai no fallback local */ }
  }

  if (!fs.existsSync(LEADS_FILE)) {
    return sendJson(res, 200, { ok: true, leads: [] });
  }

  const raw = fs.readFileSync(LEADS_FILE, "utf8");
  const leads = raw
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean)
    .reverse();

  return sendJson(res, 200, { ok: true, leads });
}

function serveStatic(req, res, pathname) {
  let filePath = safeJoinPublic(pathname);

  if (pathname === "/") filePath = path.join(PUBLIC_DIR, "index.html");

  const isInPublic = filePath.startsWith(PUBLIC_DIR);
  if (!isInPublic) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const maybeHtml = path.join(PUBLIC_DIR, "index.html");
    if (pathname === "/" && fs.existsSync(maybeHtml)) filePath = maybeHtml;
    else {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  const cacheControl =
    ext === ".html" ? "no-store" : "public, max-age=0, must-revalidate";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
  });

  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname || "/";

  if (pathname === "/healthz" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end("ok");
    return;
  }

  if (pathname.startsWith("/api/")) {
    if (applyCorsHeaders(req, res)) return;
  }

  if (pathname === "/api/leads" && req.method === "POST") {
    return handleCreateLead(req, res);
  }

  if (pathname === "/api/admin/leads" && req.method === "GET") {
    return handleAdminLeads(req, res);
  }

  if (pathname === "/api/admin/replies" && req.method === "GET") {
    return handleAdminReplies(req, res);
  }

  if (pathname === "/api/webhook/zapi" && req.method === "POST") {
    return handleWebhook(req, res);
  }

  if (pathname === "/admin") {
    return serveStatic(req, res, "/admin.html");
  }

  if (pathname.startsWith("/api/")) {
    return sendJson(res, 404, { ok: false, error: "not_found" });
  }

  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Nexus site rodando em http://localhost:${PORT}`);
});
