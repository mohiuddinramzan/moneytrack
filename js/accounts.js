/* ===== Accounts module ===== */
const ACCOUNT_TYPES = [
  { value: "bank", label: "Bank Account" },
  { value: "wallet", label: "Mobile Wallet" },
  { value: "cash", label: "Cash" },
  { value: "savings", label: "Savings Account" },
  { value: "other", label: "Other" },
];

const Accounts = (() => {
  let editingId = null;

  function typeLabel(value) {
    return (ACCOUNT_TYPES.find((t) => t.value === value) || {}).label || value;
  }

  function getAll() {
    return Storage.get(STORAGE_KEYS.accounts, []);
  }

  function getById(id) {
    return getAll().find((a) => a.id === id) || null;
  }

  function recalcAll() {
    const accounts = getAll();
    const transactions = Storage.get(STORAGE_KEYS.transactions, []);
    const updated = Calc.recalculateAccountBalances(accounts, transactions);
    Storage.set(STORAGE_KEYS.accounts, updated);
    return updated;
  }

  function accountOptionsHTML(selectedId, { includeEmpty = true } = {}) {
    const accounts = getAll();
    const empty = includeEmpty ? '<option value="">Select account…</option>' : "";
    return (
      empty +
      accounts
        .map((a) => `<option value="${a.id}" ${a.id === selectedId ? "selected" : ""}>${Utils.escapeHTML(a.name)}</option>`)
        .join("")
    );
  }

  function openModal(id = null) {
    editingId = id;
    const acc = id ? getById(id) : null;
    Utils.byId("accountModalTitle").textContent = acc ? "Edit Account" : "Add Account";
    Utils.byId("accountForm").reset();
    Utils.byId("accountId").value = acc ? acc.id : "";
    Utils.byId("accountName").value = acc ? acc.name : "";
    Utils.byId("accountType").value = acc ? acc.type : "bank";
    Utils.byId("accountOpeningBalance").value = acc ? acc.openingBalance : 0;
    Utils.byId("accountOpeningBalance").disabled = !!acc;
    Utils.byId("accountOpeningBalanceHint").style.display = acc ? "block" : "none";
    Utils.byId("accountNotes").value = acc ? acc.notes || "" : "";
    Utils.qsa(".form-error", Utils.byId("accountForm")).forEach((e) => (e.style.display = "none"));
    Utils.qsa(".form-control", Utils.byId("accountForm")).forEach((e) => e.classList.remove("is-invalid"));
    Utils.byId("accountModalBackdrop").classList.add("is-open");
    Utils.byId("accountName").focus();
  }

  function closeModal() {
    Utils.byId("accountModalBackdrop").classList.remove("is-open");
    editingId = null;
  }

  function validate() {
    let valid = true;
    const nameEl = Utils.byId("accountName");
    if (!nameEl.value.trim()) {
      nameEl.classList.add("is-invalid");
      valid = false;
    } else {
      nameEl.classList.remove("is-invalid");
    }
    const balEl = Utils.byId("accountOpeningBalance");
    if (balEl.value === "" || Number.isNaN(Number(balEl.value))) {
      balEl.classList.add("is-invalid");
      valid = false;
    } else {
      balEl.classList.remove("is-invalid");
    }
    return valid;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    const accounts = getAll();
    const name = Utils.byId("accountName").value.trim();
    const type = Utils.byId("accountType").value;
    const notes = Utils.byId("accountNotes").value.trim();

    if (editingId) {
      const idx = accounts.findIndex((a) => a.id === editingId);
      if (idx > -1) {
        accounts[idx] = { ...accounts[idx], name, type, notes, updatedAt: Utils.nowISO() };
      }
    } else {
      const openingBalance = Number(Utils.byId("accountOpeningBalance").value) || 0;
      accounts.push({
        id: Utils.generateId("acc"),
        name, type, notes,
        openingBalance,
        currentBalance: openingBalance,
        createdAt: Utils.nowISO(),
        updatedAt: Utils.nowISO(),
      });
    }
    Storage.set(STORAGE_KEYS.accounts, accounts);
    recalcAll();
    closeModal();
    Utils.toast(editingId ? "Account updated." : "Account added.", "success");
    render();
    App.refreshDependents("accounts");
  }

  async function handleDelete(id) {
    const txCount = Storage.get(STORAGE_KEYS.transactions, []).filter(
      (t) => t.accountId === id || t.toAccountId === id
    ).length;
    if (txCount > 0) {
      Utils.toast(`Can't delete — ${txCount} transaction(s) use this account. Reassign or delete them first.`, "error");
      return;
    }
    const ok = await Utils.confirmDialog({
      title: "Delete account?",
      message: "This account will be permanently removed.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const accounts = getAll().filter((a) => a.id !== id);
    Storage.set(STORAGE_KEYS.accounts, accounts);
    Utils.toast("Account deleted.", "success");
    render();
    App.refreshDependents("accounts");
  }

  function accountCard(acc) {
    const positive = Number(acc.currentBalance) >= 0;
    return `<div class="card">
      <div class="card__header">
        <div>
          <h3 class="card__title">${Utils.escapeHTML(acc.name)}</h3>
          <span class="badge badge-neutral">${typeLabel(acc.type)}</span>
        </div>
        <div class="row-actions">
          <button class="btn btn-icon btn-ghost btn-sm" data-edit-account="${acc.id}" aria-label="Edit account">${icon("edit")}</button>
          <button class="btn btn-icon btn-ghost btn-sm" data-delete-account="${acc.id}" aria-label="Delete account">${icon("trash")}</button>
        </div>
      </div>
      <div class="stat-card__value num ${positive ? "" : "amount-negative"}">${Utils.formatCurrency(acc.currentBalance)}</div>
      <p class="form-hint" style="margin-top:var(--sp-2);">Opening balance ${Utils.formatCurrency(acc.openingBalance)}</p>
      ${acc.notes ? `<p class="form-hint">${Utils.escapeHTML(acc.notes)}</p>` : ""}
    </div>`;
  }

  function render() {
    recalcAll();
    const accounts = getAll();
    const view = Utils.byId("view-accounts");
    const wrap = Utils.byId("accountsGrid");
    if (!accounts.length) {
      wrap.innerHTML = `<div class="empty-state">${icon("wallet")}<div class="empty-state__title">No accounts yet</div><p>Add a bank, wallet or cash account to start tracking balances.</p></div>`;
    } else {
      wrap.innerHTML = accounts.map(accountCard).join("");
    }
    Utils.qsa("[data-edit-account]", view).forEach((btn) =>
      btn.addEventListener("click", () => openModal(btn.dataset.editAccount))
    );
    Utils.qsa("[data-delete-account]", view).forEach((btn) =>
      btn.addEventListener("click", () => handleDelete(btn.dataset.deleteAccount))
    );
  }

  function init() {
    Utils.byId("accountType").innerHTML = ACCOUNT_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join("");
    Utils.byId("accountForm").addEventListener("submit", handleSubmit);
    Utils.byId("addAccountBtn").addEventListener("click", () => openModal());
    Utils.byId("accountModalCloseBtn").addEventListener("click", closeModal);
    Utils.byId("accountModalCancelBtn").addEventListener("click", closeModal);
    Utils.byId("accountModalBackdrop").addEventListener("click", (e) => {
      if (e.target === Utils.byId("accountModalBackdrop")) closeModal();
    });
  }

  return { init, render, recalcAll, getAll, getById, accountOptionsHTML, typeLabel, openModal };
})();
