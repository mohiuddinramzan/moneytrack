/* ===== Settings module: currency, backup/restore, reset ===== */
const CURRENCY_OPTIONS = [
  { code: "BDT", symbol: "৳", locale: "en-BD", label: "BDT — Bangladeshi Taka (৳)" },
  { code: "USD", symbol: "$", locale: "en-US", label: "USD — US Dollar ($)" },
  { code: "EUR", symbol: "€", locale: "en-IE", label: "EUR — Euro (€)" },
  { code: "GBP", symbol: "£", locale: "en-GB", label: "GBP — British Pound (£)" },
  { code: "INR", symbol: "₹", locale: "en-IN", label: "INR — Indian Rupee (₹)" },
];

const Settings = (() => {
  const $ = Utils.byId;

  function dataCounts() {
    return {
      transactions: Storage.get(STORAGE_KEYS.transactions, []).length,
      accounts: Storage.get(STORAGE_KEYS.accounts, []).length,
      investments: Storage.get(STORAGE_KEYS.investments, []).length,
      assets: Storage.get(STORAGE_KEYS.assets, []).length,
      debts: Storage.get(STORAGE_KEYS.debts, []).length,
      goals: Storage.get(STORAGE_KEYS.goals, []).length,
    };
  }

  function handleCurrencyChange(e) {
    const opt = CURRENCY_OPTIONS.find((c) => c.code === e.target.value) || CURRENCY_OPTIONS[0];
    const s = Utils.getSettings();
    s.currency = opt.code;
    s.currencySymbol = opt.symbol;
    s.locale = opt.locale;
    Storage.set(STORAGE_KEYS.settings, s);
    Utils.applyCurrencySymbol();
    Utils.toast(`Currency set to ${opt.code}.`, "success");
    Router.refresh();
  }

  function downloadBackup() {
    const payload = Storage.exportData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moneytrack-backup-${Utils.todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    Utils.toast("Backup downloaded.", "success");
  }

  function handleRestoreFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let payload;
      try {
        payload = JSON.parse(reader.result);
      } catch (err) {
        Utils.toast("That file isn't valid JSON.", "error");
        return;
      }
      if (!Storage.validateImportPayload(payload)) {
        Utils.toast("That file isn't a valid MoneyTrack backup.", "error");
        return;
      }
      const ok = await Utils.confirmDialog({
        title: "Restore backup?",
        message: "This replaces all current data in this browser with the contents of the backup file. This can't be undone.",
        confirmLabel: "Restore",
        danger: true,
      });
      if (!ok) return;
      try {
        Storage.importData(payload);
      } catch (err) {
        Utils.toast("Restore failed: " + err.message, "error");
        return;
      }
      Accounts.recalcAll();
      NetWorth.snapshot();
      Utils.applyCurrencySymbol();
      render();
      Router.refresh();
      Utils.toast("Backup restored.", "success");
    };
    reader.onerror = () => Utils.toast("Couldn't read that file.", "error");
    reader.readAsText(file);
  }

  async function handleReset() {
    const ok = await Utils.confirmDialog({
      title: "Erase all data?",
      message: "This permanently deletes every account, transaction, investment, asset, debt and goal stored in this browser. Consider downloading a backup first.",
      confirmLabel: "Erase everything",
      danger: true,
    });
    if (!ok) return;
    Storage.clearAll();
    Utils.applyCurrencySymbol();
    render();
    Router.refresh();
    Utils.toast("All data erased.", "success");
  }

  function render() {
    const settings = Utils.getSettings();
    const view = Utils.byId("view-settings");
    const counts = dataCounts();
    view.innerHTML = `
      <div class="card" style="margin-bottom:var(--sp-4);">
        <div class="card__header"><h3 class="card__title">Currency</h3></div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="settingsCurrency">Display currency</label>
          <select class="form-control" id="settingsCurrency" style="max-width:360px;"></select>
          <span class="form-hint">Changes how amounts are displayed. Stored values aren't converted.</span>
        </div>
      </div>

      <div class="card" style="margin-bottom:var(--sp-4);">
        <div class="card__header"><h3 class="card__title">Backup &amp; Restore</h3></div>
        <p class="form-hint" style="margin-bottom:var(--sp-4);">
          All data lives only in this browser's local storage. Download a backup regularly, especially before clearing site data or switching browsers.
          Currently storing ${counts.transactions} transaction(s), ${counts.accounts} account(s), ${counts.investments} investment(s), ${counts.assets} asset(s), ${counts.debts} debt(s) and ${counts.goals} goal(s).
        </p>
        <div class="quick-actions">
          <button class="btn btn-primary btn-sm" id="settingsExportBtn">${icon("box")} Download backup</button>
          <button type="button" class="btn btn-secondary btn-sm" id="settingsImportBtn">${icon("list")} Restore from backup</button>
          <input type="file" id="settingsImportFile" accept="application/json" style="display:none;">
        </div>
      </div>

      <div class="card">
        <div class="card__header"><h3 class="card__title">Danger Zone</h3></div>
        <p class="form-hint" style="margin-bottom:var(--sp-4);">Permanently erase all MoneyTrack data stored in this browser. This cannot be undone.</p>
        <button type="button" class="btn btn-danger btn-sm" id="settingsResetBtn">${icon("trash")} Erase all data</button>
      </div>
    `;

    const sel = $("settingsCurrency");
    sel.innerHTML = CURRENCY_OPTIONS.map((c) => `<option value="${c.code}" ${c.code === settings.currency ? "selected" : ""}>${c.label}</option>`).join("");
    sel.addEventListener("change", handleCurrencyChange);
    $("settingsExportBtn").addEventListener("click", downloadBackup);
    $("settingsImportBtn").addEventListener("click", () => $("settingsImportFile").click());
    $("settingsImportFile").addEventListener("change", handleRestoreFile);
    $("settingsResetBtn").addEventListener("click", handleReset);
  }

  return { render };
})();
