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

      const isAteh30k = payload.faturamento === "Até R$ 30 mil";
      window.location.href = isAteh30k ? "/obrigado-b" : "/obrigado";
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

function initVideoCarousel() {
  const carousel = document.querySelector(".testimonials-carousel");
  if (!carousel) return;

  const track = carousel.querySelector(".carousel-track");
  const dotsEl = Array.from(carousel.querySelectorAll(".carousel-dot"));
  if (!track) return;

  const realSlides = Array.from(track.querySelectorAll(".carousel-slide"));
  const n = realSlides.length;
  if (n === 0) return;

  // Clona último slide no início e primeiro no fim para loop infinito
  const cloneHead = realSlides[n - 1].cloneNode(true);
  const cloneTail = realSlides[0].cloneNode(true);
  cloneHead.classList.add("clone");
  cloneTail.classList.add("clone");
  track.insertBefore(cloneHead, realSlides[0]);
  track.appendChild(cloneTail);

  // allSlides: [cloneHead, slide0, slide1, ..., cloneTail]  — slides reais: índices 1..n
  const allSlides = Array.from(track.querySelectorAll(".carousel-slide"));
  let idx = 1;

  function centerOffset(i) {
    const s = allSlides[i];
    if (!s) return 0;
    return (carousel.offsetWidth / 2) - (s.offsetLeft + s.offsetWidth / 2);
  }

  function updateDots() {
    const ri = ((idx - 1) % n + n) % n;
    dotsEl.forEach((d, i) => d.classList.toggle("active", i === ri));
  }

  function setPos(i, animate) {
    track.style.transition = animate ? "transform 0.45s cubic-bezier(0.4,0,0.2,1)" : "none";
    if (!animate) void track.offsetHeight;
    track.style.transform = `translateX(${centerOffset(i)}px)`;
  }

  function goTo(i, animate = true) {
    idx = i;
    setPos(idx, animate);
    updateDots();
  }

  requestAnimationFrame(() => goTo(idx, false));

  let transitioning = false;

  // Após transição: libera flag e, se estiver num clone, salta silenciosamente para o slide real
  track.addEventListener("transitionend", (e) => {
    if (e.propertyName !== "transform") return;
    transitioning = false;
    if (idx === 0)          { idx = n;     setPos(n, false); }
    else if (idx === n + 1) { idx = 1;     setPos(1, false); }
  });

  function pauseIframe(i) {
    allSlides[i]?.querySelector("iframe")?.contentWindow?.postMessage(
      '{"event":"command","func":"pauseVideo","args":""}', "*"
    );
  }

  function restoreOverlays() {
    track.querySelectorAll(".slide-overlay").forEach((o) => o.classList.remove("off"));
  }

  function navigate(dir) {
    if (transitioning) return;
    transitioning = true;
    pauseIframe(idx);
    restoreOverlays();
    goTo(idx + dir);
  }

  dotsEl.forEach((d, i) => d.addEventListener("click", () => {
    transitioning = false;
    pauseIframe(idx);
    restoreOverlays();
    goTo(i + 1);
  }));

  // Toque no overlay → libera interação com o player
  track.addEventListener("click", (e) => {
    const overlay = e.target.closest(".slide-overlay");
    if (!overlay) return;
    if (overlay.closest(".carousel-slide") === allSlides[idx]) overlay.classList.add("off");
  });

  // Swipe com detecção de direção: bloqueia scroll vertical quando o gesto é horizontal
  let startX = 0, startY = 0, isHor = null;

  carousel.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isHor = null;
  }, { passive: true });

  carousel.addEventListener("touchmove", (e) => {
    if (isHor === null) {
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > 4 || dy > 4) isHor = dx >= dy;
    }
    if (isHor) e.preventDefault();
  }, { passive: false });

  carousel.addEventListener("touchend", (e) => {
    if (!isHor) return;
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) navigate(diff > 0 ? 1 : -1);
  });

  window.addEventListener("resize", () => goTo(idx, false));
}

function initServicesCarousel() {
  const track = document.querySelector(".services-track");
  const dots = document.querySelectorAll(".svc-dot");
  const prev = document.querySelector(".svc-prev");
  const next = document.querySelector(".svc-next");
  if (!track) return;

  const pages = track.querySelectorAll(".services-page");
  let current = 0;

  function goTo(index) {
    current = (index + pages.length) % pages.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle("active", i === current));
  }

  prev?.addEventListener("click", () => goTo(current - 1));
  next?.addEventListener("click", () => goTo(current + 1));
  dots.forEach((d, i) => d.addEventListener("click", () => goTo(i)));

  let startX = 0;
  track.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener("touchend", (e) => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) goTo(diff > 0 ? current + 1 : current - 1);
  });
}

function initMethodAccordion() {
  document.querySelectorAll(".pillar-row").forEach((row) => {
    row.addEventListener("click", () => {
      const isOpen = row.classList.contains("open");
      document.querySelectorAll(".pillar-row").forEach((r) => r.classList.remove("open"));
      if (!isOpen) row.classList.add("open");
    });
  });
}

function initInvestQuestion() {
  const select = document.getElementById("faturamento");
  const field = document.getElementById("investQuestion");
  if (!select || !field) return;

  select.addEventListener("change", () => {
    const show = select.value === "Até R$ 30 mil";
    field.classList.toggle("visible", show);
    if (!show) field.querySelectorAll('input[type="radio"]').forEach((r) => (r.checked = false));
  });
}

initReveal();
initFaqAccordion();
initSmoothScroll();
initLeadForm();
initMouseLight();
initVideoCarousel();
initServicesCarousel();
initMethodAccordion();
initInvestQuestion();
