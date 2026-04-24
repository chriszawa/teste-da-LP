const crypto = require("crypto");
const { appendLeadToSheets, isSheetsEnabled } = require("../googleSheets");

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
  }

  let payload = req.body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return sendJson(res, 400, { ok: false, error: "invalid_json" });
    }
  }
  if (!payload || typeof payload !== "object") payload = {};

  const { ok, errors, lead } = validateLead(payload);
  if (!ok) return sendJson(res, 422, { ok: false, error: "validation_error", fields: errors });

  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...lead,
    meta: {
      ip:
        (req.headers["x-forwarded-for"] && String(req.headers["x-forwarded-for"]).split(",")[0].trim()) ||
        req.socket?.remoteAddress ||
        null,
      userAgent: req.headers["user-agent"] || null,
      referer: req.headers.referer || null,
      utm: typeof payload.utm === "object" && payload.utm ? payload.utm : null,
    },
  };

  // Em Vercel o filesystem não é persistente, então o "site real" depende do Sheets (ou DB).
  if (!isSheetsEnabled()) {
    return sendJson(res, 500, { ok: false, error: "sheets_not_configured" });
  }

  try {
    await appendLeadToSheets(record);
    return sendJson(res, 200, { ok: true, id: record.id });
  } catch {
    return sendJson(res, 502, { ok: false, error: "sheets_append_failed" });
  }
};

