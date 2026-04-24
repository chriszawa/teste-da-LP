const fs = require("fs");

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function readServiceAccountFromEnv() {
  const jsonPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;
  const jsonInline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (isNonEmptyString(jsonPath) && fs.existsSync(jsonPath)) {
    const raw = fs.readFileSync(jsonPath, "utf8");
    return JSON.parse(raw);
  }

  if (isNonEmptyString(jsonInline)) {
    return JSON.parse(jsonInline);
  }

  return null;
}

function getUtmValue(utm, key) {
  if (!utm || typeof utm !== "object") return "";
  const value = utm[key];
  return typeof value === "string" ? value : "";
}

function buildRow(record) {
  const utm = record?.meta?.utm || null;
  return [
    record.createdAt || "",
    record.id || "",
    record.nome || "",
    record.telefone || "",
    record.email || "",
    record.empresa || "",
    record.segmento || "",
    record.faturamento || "",
    getUtmValue(utm, "utm_source"),
    getUtmValue(utm, "utm_medium"),
    getUtmValue(utm, "utm_campaign"),
    getUtmValue(utm, "utm_term"),
    getUtmValue(utm, "utm_content"),
    record?.meta?.ip || "",
    record?.meta?.userAgent || "",
    record?.meta?.referer || "",
  ];
}

function isSheetsEnabled() {
  return (
    isNonEmptyString(process.env.GOOGLE_SHEETS_SPREADSHEET_ID) &&
    (isNonEmptyString(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH) ||
      isNonEmptyString(process.env.GOOGLE_SERVICE_ACCOUNT_JSON))
  );
}

async function appendLeadToSheets(record) {
  if (!isSheetsEnabled()) return { ok: false, skipped: true };

  // Import dinâmico para não quebrar o site caso a dependência não esteja instalada
  let google;
  try {
    ({ google } = require("googleapis"));
  } catch (err) {
    return { ok: false, error: "missing_dependency_googleapis" };
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID.trim();
  const range = (process.env.GOOGLE_SHEETS_RANGE || "Leads!A:Z").trim();
  const serviceAccount = readServiceAccountFromEnv();

  if (!serviceAccount) return { ok: false, error: "missing_service_account" };

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const values = [buildRow(record)];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });

  return { ok: true };
}

async function readLeadsFromSheets() {
  if (!isSheetsEnabled()) return null;

  let google;
  try {
    ({ google } = require("googleapis"));
  } catch {
    return null;
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID.trim();
  const range = (process.env.GOOGLE_SHEETS_RANGE || "LEADS!A:Z").trim();
  const serviceAccount = readServiceAccountFromEnv();
  if (!serviceAccount) return null;

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values || [];

  if (rows.length < 2) return [];

  const headers = rows[0];
  const colIndex = (name) => headers.findIndex((h) => h && h.toLowerCase() === name.toLowerCase());

  const idxData      = colIndex("data");
  const idxId        = colIndex("id");
  const idxNome      = colIndex("nome");
  const idxTelefone  = colIndex("telefone");
  const idxEmail     = colIndex("email");
  const idxEmpresa   = colIndex("empresa");
  const idxSegmento  = colIndex("segmento");
  const idxFaturamento = colIndex("faturamento");

  return rows
    .slice(1)
    .filter((r) => r.some(Boolean))
    .map((r) => ({
      id:          idxId >= 0        ? r[idxId]        : null,
      createdAt:   idxData >= 0      ? r[idxData]      : null,
      nome:        idxNome >= 0      ? r[idxNome]      : null,
      telefone:    idxTelefone >= 0  ? r[idxTelefone]  : null,
      email:       idxEmail >= 0     ? r[idxEmail]     : null,
      empresa:     idxEmpresa >= 0   ? r[idxEmpresa]   : null,
      segmento:    idxSegmento >= 0  ? r[idxSegmento]  : null,
      faturamento: idxFaturamento >= 0 ? r[idxFaturamento] : null,
    }))
    .reverse();
}

module.exports = {
  appendLeadToSheets,
  readLeadsFromSheets,
  isSheetsEnabled,
};

