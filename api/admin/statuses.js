const { readAllStatuses, isSheetsEnabled } = require("../../googleSheets");

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

function checkAuth(req, res) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) { sendJson(res, 503, { ok: false, error: "admin_not_configured" }); return false; }
  const auth = req.headers.authorization || "";
  const tok = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (tok !== adminPassword) { sendJson(res, 401, { ok: false, error: "unauthorized" }); return false; }
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
  }
  if (!checkAuth(req, res)) return;

  try {
    const statuses = isSheetsEnabled() ? await readAllStatuses() : [];
    return sendJson(res, 200, { ok: true, statuses: statuses || [] });
  } catch {
    return sendJson(res, 200, { ok: true, statuses: [] });
  }
};
