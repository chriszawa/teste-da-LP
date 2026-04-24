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
  const nome = lead.nome.split(" ")[0];
  return (
    `Oi, ${nome}! Aqui é o time da Nexus. 👋\n\n` +
    `Vi que você pediu o diagnóstico gratuito, ótima decisão!\n\n` +
    `Me conta uma coisa: hoje, seu maior desafio é atrair clientes novos, fazer os que já têm voltarem mais, ou aumentar o valor médio de cada pedido?\n\n` +
    `Pergunto porque cada restaurante tem um ponto de alavancagem diferente e quero entender o seu antes de falar com você. 😊`
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

async function sendGroupMessage(groupId, message) {
  if (!isWhatsAppEnabled()) return { ok: false, skipped: true };

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
    body: JSON.stringify({ phone: groupId, message }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data };
  return { ok: true, data };
}

async function sendWhatsAppRaw(phone, message) {
  if (!isWhatsAppEnabled()) return { ok: false, skipped: true };

  const formatted = formatPhone(phone);
  if (!formatted) return { ok: false, error: "invalid_phone" };

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
    body: JSON.stringify({ phone: formatted, message }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data };
  return { ok: true, data };
}

module.exports = { sendWhatsApp, sendWhatsAppRaw, sendGroupMessage, isWhatsAppEnabled };
