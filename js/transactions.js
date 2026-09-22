/* ===== Transactions module ===== */
const TRANSACTION_TYPES = [
  { value: "income", label: "Income", flow: "in", categoryGroup: "income" },
  { value: "expense", label: "Expense", flow: "out", categoryGroup: "expense" },
  { value: "investment_contribution", label: "Investment Contribution", flow: "out", categoryGroup: "investment" },
  { value: "withdrawal", label: "Withdrawal", flow: "in", categoryGroup: "investment" },
  { value: "transfer", label: "Account Transfer", flow: "transfer", categoryGroup: "transfer" },
  { value: "debt_payment", label: "Debt Payment", flow: "out", categoryGroup: "debt" },
  { value: "dividend", label: "Dividend", flow: "in", categoryGroup: "income" },
  { value: "interest", label: "Interest", flow: "in", categoryGroup: "income" },
  { value: "other", label: "Other", flow: "neutral", categoryGroup: "other" },
];

const FALLBACK_CATEGORIES = {
  investment: ["Stocks", "Mutual Fund", "Gold", "Crypto", "Business", "DPS/Deposit"],
  transfer: ["Account Transfer"],
  debt: ["Loan Repayment", "Credit Card Payment"],
  other: ["Miscellaneous"],
};

const Transactions = (() => {
  let editingId = null;
  const filters = { search: "", type: "", accountId: "", from: "", to: "", sort: "date_desc" };

  function typeInfo(value) {
    return TRANSACTION_TYPES.find((t) => t.value === value) || TRANSACTION_TYPES[0];
  }
  function typeLabel(value) {
    return typeInfo(value).label;
  }

  function categoriesForType(typeValue) {
    const cats = Storage.get(STORAGE_KEYS.categories, DEFAULT_CATEGORIES);
    const group = typeInfo(typeValue).categoryGroup;
    if (group === "income") return cats.income || [];
    if (group === "expense") return cats.expense || [];
    return FALLBACK_CATEGORIES[group] || [];
  }

  function getAll() {
    return Storage.get(STORAGE_KEYS.transactions, []);
  }

  function typeOptionsHTML(selected) {
    return TRANSACTION_TYPES.map(
      (t) => `<option value="${t.value}" ${t.value === selected ? "selected" : ""}>${t.label}</option>`
    ).join("");
  }

  function refreshCategoryOptions(selectedCategory) {
    const typeValue = Utils.byId("txType").value;
    const list = Utils.byId("txCategoryList");
    list.innerHTML = categoriesForType(typeValue)
      .map((c) => `<option value="${Utils.escapeHTML(c)}"></option>`)
      .join("");
    if (selectedCategory) Utils.byId("txCategory").value = selectedCategory;
  }

  function toggleToAccountField() {
    const isTransfer = Utils.byId("txType").value === "transfer";
    Utils.byId("txToAccountGroup").style.display = isTransfer ? "block" : "none";
    Utils.byId("txToAccount").required = isTransfer;
    Utils.byId("txCategoryGroup").style.display = isTransfer ? "none" : "block";
    Utils.byId("txDebtGroup").style.display = Utils.byId("txType").value === "debt_payment" ? "block" : "none";
  }

  function prefillDebtCategory() {
    const catEl = Utils.byId("txCategory");
    const debt = Debts.getById(Utils.byId("txDebt").value);
    if (debt && !catEl.value.trim()) catEl.value = debt.type === "credit_card" ? "Credit Card Payment" : "Loan Repayment";
  }

  function openModal(id = null, presetType = null, presetDebtId = null) {
    editingId = id;
    const tx = id ? getAll().find((t) => t.id === id) : null;
    Utils.byId("txModalTitle").textContent = tx ? "Edit Transaction" : "Add Transaction";
    Utils.byId("txForm").reset();
    Utils.byId("txId").value = tx ? tx.id : "";
    Utils.byId("txType").innerHTML = typeOptionsHTML(tx ? tx.type : presetType || "expense");
    Utils.byId("txAmount").value = tx ? tx.amount : "";
    Utils.byId("txAccount").innerHTML = Accounts.accountOptionsHTML(tx ? tx.accountId : (Accounts.getAll()[0] || {}).id || "");
    Utils.byId("txToAccount").innerHTML = Accounts.accountOptionsHTML(tx ? tx.toAccountId : "");
    Utils.byId("txDate").value = tx ? tx.date : Utils.todayISO();
    Utils.byId("txNote").value = tx ? tx.note || "" : "";
    Utils.byId("txDebt").innerHTML = Debts.optionsHTML(tx ? tx.debtId : presetDebtId);
    refreshCategoryOptions(tx ? tx.category : "");
    toggleToAccountField();
    if (presetDebtId) prefillDebtCategory();
    Utils.qsa(".form-error", Utils.byId("txForm")).forEach((e) => (e.style.display = "none"));
    Utils.qsa(".form-control", Utils.byId("txForm")).forEach((e) => e.classList.remove("is-invalid"));

    if (!Accounts.getAll().length) {
      Utils.toast("Add an account first before recording transactions.", "error");
      return;
    }
    Utils.byId("txModalBackdrop").classList.add("is-open");
    Utils.byId("txAmount").focus();
  }

  function closeModal() {
    Utils.byId("txModalBackdrop").classList.remove("is-open");
    editingId = null;
  }

  function validate() {
    let valid = true;
    const mark = (el, ok) => el.classList.toggle("is-invalid", !ok);

    const amountEl = Utils.byId("txAmount");
    const amountOk = Number(amountEl.value) > 0;
    mark(amountEl, amountOk);
    valid = valid && amountOk;

    const accEl = Utils.byId("txAccount");
    const accOk = !!accEl.value;
    mark(accEl, accOk);
    valid = valid && accOk;

    const dateEl = Utils.byId("txDate");
    const dateOk = !!dateEl.value;
    mark(dateEl, dateOk);
    valid = valid && dateOk;

    const typeValue = Utils.byId("txType").value;
    if (typeValue === "transfer") {
      const toEl = Utils.byId("txToAccount");
      const toOk = !!toEl.value && toEl.value !== accEl.value;
      mark(toEl, toOk);
      valid = valid && toOk;
    } else {
      const catEl = Utils.byId("txCategory");
      const catOk = !!catEl.value.trim();
      mark(catEl, catOk);
      valid = valid && catOk;
    }
    return valid;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    const type = Utils.byId("txType").value;
    const record = {
      type,
      category: type === "transfer" ? "Account Transfer" : Utils.byId("txCategory").value.trim(),
      amount: Utils.round2(Number(Utils.byId("txAmount").value)),
      accountId: Utils.byId("txAccount").value,
      toAccountId: type === "transfer" ? Utils.byId("txToAccount").value : "",
      debtId: type === "debt_payment" ? Utils.byId("txDebt").value : "",
      date: Utils.byId("txDate").value,
      note: Utils.byId("txNote").value.trim(),
    };
    const list = getAll();
    if (editingId) {
      const idx = list.findIndex((t) => t.id === editingId);
      if (idx > -1) list[idx] = { ...list[idx], ...record, updatedAt: Utils.nowISO() };
    } else {
      list.push({ id: Utils.generateId("tx"), ...record, createdAt: Utils.nowISO(), updatedAt: Utils.nowISO() });
    }
    Storage.set(STORAGE_KEYS.transactions, list);
    Accounts.recalcAll();
    closeModal();
    Utils.toast(editingId ? "Transaction updated." : "Transaction added.", "success");
    render();
    App.refreshDependents("transactions");
  }

  async function handleDelete(id) {
    const ok = await Utils.confirmDialog({
      title: "Delete transaction?",
      message: "This will remove the transaction and update affected account balances.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    Storage.set(STORAGE_KEYS.transactions, getAll().filter((t) => t.id !== id));
    Accounts.recalcAll();
    Utils.toast("Transaction deleted.", "success");
    render();
    App.refreshDependents("transactions");
  }

  function applyFilters(list, f = filters) {
    let result = [...list];
    if (f.search) {
      const q = f.search.toLowerCase();
      result = result.filter(
        (t) => (t.category || "").toLowerCase().includes(q) || (t.note || "").toLowerCase().includes(q)
      );
    }
    if (f.type) result = result.filter((t) => t.type === f.type);
    if (f.accountId) result = result.filter((t) => t.accountId === f.accountId || t.toAccountId === f.accountId);
    if (f.from) result = result.filter((t) => t.date >= f.from);
    if (f.to) result = result.filter((t) => t.date <= f.to);

    const [field, dir] = f.sort.split("_");
    result.sort((a, b) => {
      let cmp = 0;
      if (field === "date") cmp = a.date.localeCompare(b.date) || (a.createdAt || "").localeCompare(b.createdAt || "");
      else if (field === "amount") cmp = Number(a.amount) - Number(b.amount);
      return dir === "desc" ? -cmp : cmp;
    });
    return result;
  }

  function signedAmountHTML(t) {
    const info = typeInfo(t.type);
    if (info.flow === "in") return `<span class="amount-positive">+${Utils.formatCurrency(t.amount)}</span>`;
    if (info.flow === "out") return `<span class="amount-negative">-${Utils.formatCurrency(t.amount)}</span>`;
    return `<span>${Utils.formatCurrency(t.amount)}</span>`;
  }

  function accountName(id) {
    const a = Accounts.getById(id);
    return a ? Utils.escapeHTML(a.name) : "\u2014";
  }

  function row(t) {
    const info = typeInfo(t.type);
    const badgeClass = info.flow === "in" ? "badge-success" : info.flow === "out" ? "badge-danger" : "badge-neutral";
    const accountText = t.type === "transfer" ? `${accountName(t.accountId)} → ${accountName(t.toAccountId)}` : accountName(t.accountId);
    return `<tr>
      <td>${Utils.formatDate(t.date, "short")}</td>
      <td><span class="badge ${badgeClass}">${info.label}</span></td>
      <td>${Utils.escapeHTML(t.category)}</td>
      <td>${accountText}</td>
      <td class="num">${signedAmountHTML(t)}</td>
      <td>${Utils.escapeHTML(t.note) || "\u2014"}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-icon btn-ghost btn-sm" data-edit-tx="${t.id}" aria-label="Edit">${icon("edit")}</button>
          <button class="btn btn-icon btn-ghost btn-sm" data-delete-tx="${t.id}" aria-label="Delete">${icon("trash")}</button>
        </div>
      </td>
    </tr>`;
  }

  function renderFilterBar() {
    Utils.byId("txFilterType").innerHTML = `<option value="">All types</option>` + typeOptionsHTML();
    Utils.byId("txFilterAccount").innerHTML = `<option value="">All accounts</option>` + Accounts.accountOptionsHTML("", { includeEmpty: false });
  }

  function render() {
    const view = Utils.byId("view-transactions");
    renderFilterBar();
    Utils.byId("txFilterType").value = filters.type;
    Utils.byId("txFilterAccount").value = filters.accountId;
    Utils.byId("txFilterFrom").value = filters.from;
    Utils.byId("txFilterTo").value = filters.to;
    Utils.byId("txFilterSort").value = filters.sort;
    Utils.byId("txSearchInput").value = filters.search;

    const all = getAll();
    const filtered = applyFilters(all);
    const tbody = Utils.byId("txTableBody");
    const emptyWrap = Utils.byId("txEmptyState");
    const tableWrap = Utils.byId("txTableWrap");

    if (!all.length) {
      tableWrap.style.display = "none";
      emptyWrap.style.display = "flex";
      emptyWrap.innerHTML = `${icon("list")}<div class="empty-state__title">No transactions yet</div><p>Record your first income, expense or transfer.</p>`;
    } else if (!filtered.length) {
      tableWrap.style.display = "none";
      emptyWrap.style.display = "flex";
      emptyWrap.innerHTML = `${icon("list")}<div class="empty-state__title">No matching transactions</div><p>Try adjusting your filters.</p>`;
    } else {
      tableWrap.style.display = "block";
      emptyWrap.style.display = "none";
      tbody.innerHTML = filtered.map(row).join("");
    }

    Utils.qsa("[data-edit-tx]", view).forEach((btn) => btn.addEventListener("click", () => openModal(btn.dataset.editTx)));
    Utils.qsa("[data-delete-tx]", view).forEach((btn) => btn.addEventListener("click", () => handleDelete(btn.dataset.deleteTx)));
  }

  function recentForDashboard(limit = 5) {
    return applyFilters(getAll(), { search: "", type: "", accountId: "", from: "", to: "", sort: "date_desc" }).slice(0, limit);
  }

  function init() {
    Utils.byId("txForm").addEventListener("submit", handleSubmit);
    Utils.byId("addTransactionBtn").addEventListener("click", () => openModal());
    Utils.byId("txModalCloseBtn").addEventListener("click", closeModal);
    Utils.byId("txModalCancelBtn").addEventListener("click", closeModal);
    Utils.byId("txModalBackdrop").addEventListener("click", (e) => {
      if (e.target === Utils.byId("txModalBackdrop")) closeModal();
    });
    Utils.byId("txType").addEventListener("change", () => {
      refreshCategoryOptions("");
      toggleToAccountField();
    });
    Utils.byId("txDebt").addEventListener("change", prefillDebtCategory);

    Utils.byId("txSearchInput").addEventListener(
      "input",
      Utils.debounce((e) => {
        filters.search = e.target.value;
        render();
      }, 200)
    );
    Utils.byId("txFilterType").addEventListener("change", (e) => { filters.type = e.target.value; render(); });
    Utils.byId("txFilterAccount").addEventListener("change", (e) => { filters.accountId = e.target.value; render(); });
    Utils.byId("txFilterFrom").addEventListener("change", (e) => { filters.from = e.target.value; render(); });
    Utils.byId("txFilterTo").addEventListener("change", (e) => { filters.to = e.target.value; render(); });
    Utils.byId("txFilterSort").addEventListener("change", (e) => { filters.sort = e.target.value; render(); });
    Utils.byId("txFilterClearBtn").addEventListener("click", () => {
      Object.assign(filters, { search: "", type: "", accountId: "", from: "", to: "", sort: "date_desc" });
      render();
    });
  }

  return { init, render, openModal, getAll, typeLabel, typeInfo, recentForDashboard };
})();
