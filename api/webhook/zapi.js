const { appendReplyToSheets, readRepliesFromSheets, isSheetsEnabled } = require("../../googleSheets");
const { sendGroupMessage, isWhatsAppEnabled } = require("../../whatsapp");

module.exports = async function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("ok");

  if (req.method !== "POST") return;

  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { return; }
  }
  if (!payload || typeof payload !== "object") return;

  if (payload.fromMe || payload.isGroup) return;

  const message = (payload.text?.message || payload.caption || "").trim();
  if (!message) return;

  const phone = (payload.phone || "").replace(/\D/g, "");
  const senderName = payload.senderName || payload.chatName || "Lead";

  if (isSheetsEnabled()) {
    try {
      const existing = await readRepliesFromSheets();
      if (existing && existing.some(r => (r.phone || "").replace(/\D/g, "") === phone)) return;
    } catch {}
  }

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
};
