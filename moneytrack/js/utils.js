/* ===== Shared utility helpers ===== */
const Utils = (() => {
  function generateId(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function todayISO() {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 10);
  }

  function getSettings() {
    return Storage.get(STORAGE_KEYS.settings, { ...DEFAULT_SETTINGS });
  }

  function formatCurrency(amount, opts = {}) {
    const settings = getSettings();
    const value = Number(amount) || 0;
    const symbol = opts.symbol ?? settings.currencySymbol ?? "৳";
    const formatted = Math.abs(value).toLocaleString(settings.locale || "en-BD", {
      minimumFractionDigits: opts.decimals ?? 0,
      maximumFractionDigits: opts.decimals ?? 2,
    });
    const sign = value < 0 ? "-" : "";
    return `${sign}${symbol}${formatted}`;
  }

  function formatDate(isoDate, style = "medium") {
    if (!isoDate) return "\u2014";
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return "\u2014";
    const settings = getSettings();
    const opts =
      style === "short"
        ? { day: "2-digit", month: "short" }
        : style === "long"
        ? { day: "2-digit", month: "long", year: "numeric" }
        : { day: "2-digit", month: "short", year: "numeric" };
    return d.toLocaleDateString(settings.locale || "en-BD", opts);
  }

  function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function debounce(fn, wait = 250) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function toast(message, type = "default", duration = 3200) {
    const region = document.getElementById("toastRegion");
    if (!region) return;
    const el = document.createElement("div");
    el.className = `toast${type === "success" ? " is-success" : type === "error" ? " is-error" : ""}`;
    el.textContent = message;
    region.appendChild(el);
    setTimeout(() => {
      el.classList.add("is-leaving");
      setTimeout(() => el.remove(), 200);
    }, duration);
  }

  function confirmDialog({ title = "Are you sure?", message = "", confirmLabel = "Confirm", danger = false } = {}) {
    return new Promise((resolve) => {
      const backdrop = document.getElementById("confirmBackdrop");
      const titleEl = document.getElementById("confirmTitle");
      const msgEl = document.getElementById("confirmMessage");
      const okBtn = document.getElementById("confirmOkBtn");
      const cancelBtn = document.getElementById("confirmCancelBtn");
      titleEl.textContent = title;
      msgEl.textContent = message;
      okBtn.textContent = confirmLabel;
      okBtn.className = `btn ${danger ? "btn-danger" : "btn-primary"}`;
      backdrop.classList.add("is-open");

      function cleanup(result) {
        backdrop.classList.remove("is-open");
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        backdrop.removeEventListener("click", onBackdrop);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onBackdrop(e) { if (e.target === backdrop) cleanup(false); }

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      backdrop.addEventListener("click", onBackdrop);
    });
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  return {
    generateId, nowISO, todayISO, getSettings, formatCurrency, formatDate,
    escapeHTML, debounce, round2, toast, confirmDialog, byId, qs, qsa,
  };
})();
