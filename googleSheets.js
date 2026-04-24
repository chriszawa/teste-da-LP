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

module.exports = {
  appendLeadToSheets,
  isSheetsEnabled,
};

