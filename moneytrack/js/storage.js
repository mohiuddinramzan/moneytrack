/* ===== Centralized LocalStorage layer ===== */
const STORAGE_KEYS = Object.freeze({
  settings: "moneytrack_settings",
  accounts: "moneytrack_accounts",
  transactions: "moneytrack_transactions",
  investments: "moneytrack_investments",
  assets: "moneytrack_assets",
  debts: "moneytrack_debts",
  goals: "moneytrack_goals",
  categories: "moneytrack_categories",
});

const DEFAULT_SETTINGS = Object.freeze({
  currency: "BDT",
  currencySymbol: "৳",
  locale: "en-BD",
  theme: "system",
  demoDataLoaded: false,
});

const DEFAULT_CATEGORIES = Object.freeze({
  income: ["Salary", "Freelance", "Business", "Gift", "Interest", "Dividend", "Other Income"],
  expense: ["Food", "Transport", "Rent", "Utilities", "Health", "Education", "Shopping", "Entertainment", "Family", "Other Expense"],
});

const Storage = (() => {
  function get(key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.error(`Storage.get failed for ${key}`, err);
      return fallback;
    }
  }

  function set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`Storage.set failed for ${key}`, err);
      return false;
    }
  }

  function remove(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (err) {
      console.error(`Storage.remove failed for ${key}`, err);
      return false;
    }
  }

  function ensureDefaults() {
    if (get(STORAGE_KEYS.settings) === null) set(STORAGE_KEYS.settings, { ...DEFAULT_SETTINGS });
    if (get(STORAGE_KEYS.categories) === null) set(STORAGE_KEYS.categories, JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)));
    [
      STORAGE_KEYS.accounts,
      STORAGE_KEYS.transactions,
      STORAGE_KEYS.investments,
      STORAGE_KEYS.assets,
      STORAGE_KEYS.debts,
      STORAGE_KEYS.goals,
    ].forEach((key) => {
      if (get(key) === null) set(key, []);
    });
  }

  function exportData() {
    const payload = { exportedAt: new Date().toISOString(), version: 1, data: {} };
    Object.values(STORAGE_KEYS).forEach((key) => {
      payload.data[key] = get(key, null);
    });
    return payload;
  }

  function validateImportPayload(payload) {
    if (!payload || typeof payload !== "object") return false;
    if (!payload.data || typeof payload.data !== "object") return false;
    const requiredArrayKeys = [
      STORAGE_KEYS.accounts,
      STORAGE_KEYS.transactions,
      STORAGE_KEYS.investments,
      STORAGE_KEYS.assets,
      STORAGE_KEYS.debts,
      STORAGE_KEYS.goals,
    ];
    for (const key of requiredArrayKeys) {
      if (key in payload.data && !Array.isArray(payload.data[key])) return false;
    }
    return true;
  }

  function importData(payload) {
    if (!validateImportPayload(payload)) {
      throw new Error("Invalid backup file format.");
    }
    Object.values(STORAGE_KEYS).forEach((key) => {
      if (key in payload.data) set(key, payload.data[key]);
    });
    return true;
  }

  function clearAll() {
    Object.values(STORAGE_KEYS).forEach((key) => remove(key));
    ensureDefaults();
  }

  return { get, set, remove, ensureDefaults, exportData, importData, validateImportPayload, clearAll };
})();
