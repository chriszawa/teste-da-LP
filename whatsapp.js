function isWhatsAppEnabled() {
  return (
    typeof process.env.ZAPI_INSTANCE_ID === "string" &&
    process.env.ZAPI_INSTANCE_ID.trim().length > 0 &&
    typeof process.env.ZAPI_TOKEN === "string" &&
    process.env.ZAPI_TOKEN.trim().length > 0
  );
}

function formatPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length >= 10) return "55" + digits;
  return null;
}

function buildMessage(lead) {
  return (
    `Olá, ${lead.nome.split(" ")[0]}! 👋\n\n` +
    `Recebemos seu contato aqui na *Nexus Assessoria*. ✅\n\n` +
    `Em breve um dos nossos especialistas em marketing para restaurantes entrará em contato para agendar seu *diagnóstico gratuito*. 🚀\n\n` +
    `Qualquer dúvida, estamos por aqui!`
  );
}

async function sendWhatsApp(lead) {
  if (!isWhatsAppEnabled()) return { ok: false, skipped: true };

  const phone = formatPhone(lead.telefone);
  if (!phone) return { ok: false, error: "invalid_phone" };

  const instanceId = process.env.ZAPI_INSTANCE_ID.trim();
  const token = process.env.ZAPI_TOKEN.trim();
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

  const clientToken = process.env.ZAPI_CLIENT_TOKEN ? process.env.ZAPI_CLIENT_TOKEN.trim() : "";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(clientToken ? { "Client-Token": clientToken } : {}),
    },
    body: JSON.stringify({ phone, message: buildMessage(lead) }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data };
  return { ok: true, data };
}

module.exports = { sendWhatsApp, isWhatsAppEnabled };
