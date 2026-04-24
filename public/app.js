function getNavbarHeight() {
  const nav = document.getElementById("navbar");
  if (!nav) return 0;
  return Math.round(nav.getBoundingClientRect().height);
}

function scrollToWithOffset(target) {
  const navHeight = getNavbarHeight();
  const top = window.scrollY + target.getBoundingClientRect().top - navHeight - 18;
  window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
}

function setToast({ message, variant }) {
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toastText");
  const toastIcon = document.getElementById("toastIcon");
  if (!toast || !toastText) return;

  toastText.textContent = message;
  toast.classList.toggle("error", variant === "error");
  if (toastIcon) {
    toastIcon.className = variant === "error" ? "fas fa-triangle-exclamation" : "fas fa-check-circle";
  }

  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 4500);
}

function phoneMaskBR(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function collectUtm() {
  const params = new URLSearchParams(window.location.search);
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  const utm = {};
  for (const k of keys) {
    const v = params.get(k);
    if (v) utm[k] = v;
  }
  return Object.keys(utm).length ? utm : null;
}

function setFieldError(form, fieldName, message) {
  const input = form.elements[fieldName];
  const wrapper = input?.closest?.(".form-group") || null;
  const help = form.querySelector(`.field-help[data-for="${CSS.escape(fieldName)}"]`);

  if (wrapper) wrapper.classList.toggle("field-error", Boolean(message));
  if (help) help.textContent = message || "";
}

function clearFieldErrors(form) {
  form.querySelectorAll(".form-group").forEach((g) => g.classList.remove("field-error"));
  form.querySelectorAll(".field-help").forEach((h) => (h.textContent = ""));
}

function getFormPayload(form) {
  return {
    nome: String(form.elements.nome.value || "").trim(),
    telefone: String(form.elements.telefone.value || "").trim(),
    email: String(form.elements.email.value || "").trim(),
    empresa: String(form.elements.empresa.value || "").trim(),
    segmento: String(form.elements.segmento.value || "").trim(),
    faturamento: String(form.elements.faturamento.value || "").trim(),
    hp_website: String(form.elements.hp_website?.value || ""),
    utm: collectUtm() || undefined,
  };
}

function localValidate(payload) {
  const errors = {};
  if (!payload.nome || payload.nome.length < 3) errors.nome = "Informe seu nome completo.";
  if (!payload.telefone || payload.telefone.replace(/\D/g, "").length < 10) errors.telefone = "Informe um WhatsApp válido.";
  if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) errors.email = "Informe um e-mail válido.";
  if (!payload.empresa || payload.empresa.length < 2) errors.empresa = "Informe o nome do restaurante.";
  if (!payload.segmento || payload.segmento.length < 2) errors.segmento = "Informe o segmento.";
  if (!payload.faturamento) errors.faturamento = "Selecione a faixa de faturamento.";
  return errors;
}

function initNavbarScroll() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;
  const onScroll = () => navbar.classList.toggle("scrolled", window.scrollY > 60);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function initReveal() {
  const revealItems = () => {
    document.querySelectorAll(".reveal").forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight - 80) el.classList.add("active");
    });
  };
  window.addEventListener("scroll", revealItems, { passive: true });
  revealItems();
}

function initFaqAccordion() {
  document.querySelectorAll(".faq-item").forEach((item) => {
    const q = item.querySelector(".faq-question");
    if (!q) return;
    q.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item").forEach((i) => i.classList.remove("open"));
      if (!isOpen) item.classList.add("open");
    });
  });
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const href = anchor.getAttribute("href") || "";
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      scrollToWithOffset(target);
    });
  });
}

function initLeadForm() {
  const form = document.getElementById("leadForm");
  const submitBtn = document.getElementById("submitBtn");
  const phone = document.getElementById("telefone");
  if (!form || !submitBtn) return;

  const apiBaseUrl =
    (window.NEXUS_CONFIG && typeof window.NEXUS_CONFIG.apiBaseUrl === "string"
      ? window.NEXUS_CONFIG.apiBaseUrl
      : "") || "";

  if (phone) {
    phone.addEventListener("input", () => {
      const next = phoneMaskBR(phone.value);
      if (next !== phone.value) phone.value = next;
    });
    phone.value = phoneMaskBR(phone.value);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldErrors(form);

    const payload = getFormPayload(form);
    const clientErrors = localValidate(payload);
    for (const [field, msg] of Object.entries(clientErrors)) setFieldError(form, field, msg);

    if (Object.keys(clientErrors).length) {
      const firstField = Object.keys(clientErrors)[0];
      const firstEl = form.elements[firstField];
      if (firstEl?.focus) firstEl.focus();
      setToast({ message: "Revise os campos destacados.", variant: "error" });
      return;
    }

    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `Enviando… <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>`;

    try {
      const res = await fetch(`${apiBaseUrl}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429) throw Object.assign(new Error("rate_limited"), { status: 429 });
        if (data?.fields && typeof data.fields === "object") {
          for (const [field, msg] of Object.entries(data.fields)) setFieldError(form, field, msg);
        }
        throw new Error(data?.error || "request_failed");
      }

      const formCard = form.closest(".form-card");
      if (formCard) {
        formCard.innerHTML = `
          <div class="form-success">
            <div class="form-success-icon"><i class="fas fa-check-circle" aria-hidden="true"></i></div>
            <h3>Recebemos seu contato!</h3>
            <p>Um especialista da Nexus entrará em contato pelo WhatsApp em até 5 minutos em horário comercial.</p>
            <a href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Acabei%20de%20solicitar%20um%20diagn%C3%B3stico%20gratuito%20pela%20Nexus." class="btn-primary" target="_blank" rel="noopener noreferrer">
              Falar agora no WhatsApp <i class="fab fa-whatsapp"></i>
            </a>
          </div>
        `;
      }
    } catch (err) {
      const msg = err?.status === 429
        ? "Muitas tentativas. Aguarde um momento e tente novamente."
        : "Não foi possível enviar agora. Tente novamente.";
      setToast({ message: msg, variant: "error" });
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }
  });
}

function initMouseLight() {
  const isTouch = window.matchMedia("(pointer: coarse)").matches;

  const light = document.createElement("div");
  light.id = "mouse-light";
  document.body.appendChild(light);

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;
  let t = 0;

  if (isTouch) {
    // Mobile: luz ambiente que flutua autonomamente
    light.style.opacity = "0.7";
    targetX = window.innerWidth / 2;
    targetY = window.innerHeight / 2;

    document.addEventListener("touchmove", (e) => {
      const touch = e.touches[0];
      targetX = touch.clientX;
      targetY = touch.clientY;
    }, { passive: true });

  } else {
    // Desktop: segue o mouse
    document.addEventListener("mousemove", (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      light.style.opacity = "1";
    });
    document.addEventListener("mouseleave", () => { light.style.opacity = "0"; });
    document.addEventListener("mouseenter", () => { light.style.opacity = "1"; });

    // Luz reativa nos cards
    const cardSelectors = [
      ".testimonial-card",
      ".service-card",
      ".stat-box",
      ".form-card",
      ".pillar-row",
      ".step-item",
    ].join(", ");

    document.querySelectorAll(cardSelectors).forEach((card) => {
      card.classList.add("reactive-card");
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--card-x", (e.clientX - rect.left) + "px");
        card.style.setProperty("--card-y", (e.clientY - rect.top) + "px");
      });
      card.addEventListener("mouseleave", () => {
        card.style.setProperty("--card-x", "-9999px");
        card.style.setProperty("--card-y", "-9999px");
      });
    });
  }

  (function animate() {
    t += 0.004;

    currentX += (targetX - currentX) * (isTouch ? 0.04 : 0.06);
    currentY += (targetY - currentY) * (isTouch ? 0.04 : 0.06);

    // Deriva orgânica com múltiplas frequências
    const driftX = Math.sin(t * 1.3) * 55 + Math.cos(t * 0.6) * 30 + Math.sin(t * 2.1) * 12;
    const driftY = Math.cos(t * 1.0) * 45 + Math.sin(t * 0.8) * 35 + Math.cos(t * 1.8) * 18;

    // Em mobile, a deriva é maior para compensar a falta de mouse
    const driftScale = isTouch ? 2.5 : 1;

    light.style.setProperty("--x", (currentX + driftX * driftScale) + "px");
    light.style.setProperty("--y", (currentY + driftY * driftScale) + "px");

    requestAnimationFrame(animate);
  })();
}

initNavbarScroll();
initReveal();
initFaqAccordion();
initSmoothScroll();
initLeadForm();
initMouseLight();
