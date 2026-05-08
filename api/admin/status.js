const { updateLeadStatus, isSheetsEnabled } = require("../../googleSheets");

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
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
  }
  if (!checkAuth(req, res)) return;

  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { return sendJson(res, 400, { ok: false, error: "invalid_json" }); }
  }
  if (!payload || typeof payload !== "object") payload = {};

  const phone = (typeof payload.phone === "string" ? payload.phone : "").trim();
  const status = (typeof payload.status === "string" ? payload.status : "").trim();
  const validStatuses = ["Novo", "Em contato", "Fechado", "Perdido"];
  if (!phone || !validStatuses.includes(status)) {
    return sendJson(res, 422, { ok: false, error: "invalid_input" });
  }

  try {
    if (isSheetsEnabled()) await updateLeadStatus(phone, status);
    return sendJson(res, 200, { ok: true });
  } catch {
    return sendJson(res, 500, { ok: false, error: "sheets_error" });
  }
};
