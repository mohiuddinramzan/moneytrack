/* ===== Debts module ===== */
const DEBT_TYPES = [
  { value: "personal_loan", label: "Personal Loan" },
  { value: "credit_card", label: "Credit Card" },
  { value: "borrowed", label: "Borrowed Money" },
  { value: "other", label: "Other" },
];

const Debts = (() => {
  let editingId = null;
  const $ = Utils.byId;

  const typeLabel = (v) => (DEBT_TYPES.find((t) => t.value === v) || {}).label || v;
  const getAll = () => Storage.get(STORAGE_KEYS.debts, []);
  const getById = (id) => getAll().find((d) => d.id === id) || null;
  const txs = () => Storage.get(STORAGE_KEYS.transactions, []);
  const linkedPaid = (d) => Utils.round2(txs().reduce((s, t) => s + (t.type === "debt_payment" && t.debtId === d.id ? Number(t.amount) || 0 : 0), 0));
  const daysUntil = (iso) => Math.round((new Date(`${iso}T00:00:00`) - new Date(`${Utils.todayISO()}T00:00:00`)) / 864e5);

  function optionsHTML(selectedId) {
    return `<option value="">No debt</option>` + getAll()
      .map((d) => `<option value="${d.id}" ${d.id === selectedId ? "selected" : ""}>${Utils.escapeHTML(d.name)} · ${Utils.formatCurrency(Calc.debtRemaining(d, txs()))} left</option>`)
      .join("");
  }

  function summary() {
    const list = getAll(), t = txs();
    const total = Utils.round2(list.reduce((s, d) => s + (Number(d.originalAmount) || 0), 0));
    const remaining = Utils.round2(list.reduce((s, d) => s + Calc.debtRemaining(d, t), 0));
    return { total, remaining, paid: Utils.round2(total - remaining), count: list.length };
  }

  function dueBadge(d, remaining) {
    if (remaining <= 0) return `<span class="badge badge-success">Paid off</span>`;
    if (!d.dueDate) return "";
    const n = daysUntil(d.dueDate);
    if (n < 0) return `<span class="badge badge-danger">Overdue ${-n}d</span>`;
    if (n === 0) return `<span class="badge badge-warning">Due today</span>`;
    if (n <= 7) return `<span class="badge badge-warning">Due in ${n}d</span>`;
    return `<span class="badge badge-info">Due ${Utils.formatDate(d.dueDate)}</span>`;
  }

  function updateRemainingField() {
    const o = Number($("debtOriginal").value) || 0, p = Number($("debtPaid").value) || 0;
    $("debtRemaining").value = Math.max(0, Utils.round2(o - p));
  }

  function openModal(id = null) {
    editingId = id;
    const d = id ? getById(id) : null;
    const linked = d ? linkedPaid(d) : 0;
    $("debtModalTitle").textContent = d ? "Edit Debt" : "Add Debt";
    $("debtForm").reset();
    $("debtId").value = d ? d.id : "";
    $("debtType").innerHTML = DEBT_TYPES.map((t) => `<option value="${t.value}" ${d && d.type === t.value ? "selected" : ""}>${t.label}</option>`).join("");
    $("debtName").value = d ? d.name : "";
    $("debtOriginal").value = d ? d.originalAmount : "";
    $("debtPaid").value = d ? Utils.round2((Number(d.paidBase) || 0) + linked) : 0;
    $("debtInterest").value = d ? d.interestRate ?? "" : "";
    $("debtMonthly").value = d ? d.monthlyPayment ?? "" : "";
    $("debtDue").value = d ? d.dueDate || "" : "";
    $("debtNotes").value = d ? d.notes || "" : "";
    const hint = $("debtPaidHint");
    hint.style.display = linked > 0 ? "block" : "none";
    hint.textContent = linked > 0 ? `Includes ${Utils.formatCurrency(linked)} from recorded payments.` : "";
    updateRemainingField();
    Utils.qsa(".form-control", $("debtForm")).forEach((e) => e.classList.remove("is-invalid"));
    $("debtModalBackdrop").classList.add("is-open");
    $("debtName").focus();
  }

  function closeModal() {
    $("debtModalBackdrop").classList.remove("is-open");
    editingId = null;
  }

  function validate(linked) {
    let valid = true;
    const mark = (el, ok) => { el.classList.toggle("is-invalid", !ok); valid = valid && ok; };
    const optMoney = (el) => el.value === "" || Number(el.value) >= 0;
    const orig = Number($("debtOriginal").value), paid = Number($("debtPaid").value) || 0;
    mark($("debtName"), !!$("debtName").value.trim());
    mark($("debtOriginal"), orig > 0);
    let paidMsg = "";
    if (paid < 0) paidMsg = "Enter a valid amount.";
    else if (paid > orig) paidMsg = "Paid amount can't exceed the original amount.";
    else if (paid < linked) paidMsg = `Can't be less than ${Utils.formatCurrency(linked)} already recorded as payments.`;
    $("debtPaidError").textContent = paidMsg;
    mark($("debtPaid"), !paidMsg);
    mark($("debtInterest"), optMoney($("debtInterest")));
    mark($("debtMonthly"), optMoney($("debtMonthly")));
    return valid;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const existing = editingId ? getById(editingId) : null;
    const linked = existing ? linkedPaid(existing) : 0;
    if (!validate(linked)) return;
    const record = {
      name: $("debtName").value.trim(),
      type: $("debtType").value,
      originalAmount: Utils.round2(Number($("debtOriginal").value)),
      paidBase: Utils.round2((Number($("debtPaid").value) || 0) - linked),
      interestRate: Number($("debtInterest").value) || 0,
      monthlyPayment: Utils.round2(Number($("debtMonthly").value) || 0),
      dueDate: $("debtDue").value,
      notes: $("debtNotes").value.trim(),
    };
    const list = getAll();
    const wasEditing = !!existing;
    if (wasEditing) {
      const idx = list.findIndex((d) => d.id === editingId);
      if (idx > -1) list[idx] = { ...list[idx], ...record, updatedAt: Utils.nowISO() };
    } else {
      list.push({ id: Utils.generateId("debt"), ...record, createdAt: Utils.nowISO(), updatedAt: Utils.nowISO() });
    }
    Storage.set(STORAGE_KEYS.debts, list);
    closeModal();
    Utils.toast(wasEditing ? "Debt updated." : "Debt added.", "success");
    App.refreshDependents();
  }

  async function handleDelete(id) {
    const linked = txs().filter((t) => t.debtId === id).length;
    const ok = await Utils.confirmDialog({
      title: "Delete debt?",
      message: linked
        ? `This debt will be removed. Its ${linked} recorded payment(s) stay in Transactions but are unlinked.`
        : "This debt will be permanently removed.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    if (linked) Storage.set(STORAGE_KEYS.transactions, txs().map((t) => (t.debtId === id ? { ...t, debtId: "" } : t)));
    Storage.set(STORAGE_KEYS.debts, getAll().filter((d) => d.id !== id));
    Utils.toast("Debt deleted.", "success");
    App.refreshDependents();
  }

  function recordPayment(id) {
    if (!Accounts.getAll().length) return Utils.toast("Add an account first before recording payments.", "error");
    Transactions.openModal(null, "debt_payment", id);
  }

  function card(d, t) {
    const paid = Calc.debtPaid(d, t), rem = Calc.debtRemaining(d, t), orig = Number(d.originalAmount) || 0;
    const pct = orig > 0 ? Math.min(100, Math.round((paid / orig) * 100)) : 0;
    return `<div class="card">
      <div class="card__header" style="margin-bottom:var(--sp-2);">
        <div>
          <h3 class="card__title">${Utils.escapeHTML(d.name)}</h3>
          <div class="debt-card__badges"><span class="badge badge-neutral">${typeLabel(d.type)}</span>${dueBadge(d, rem)}</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-icon btn-ghost btn-sm" data-edit-debt="${d.id}" aria-label="Edit debt">${icon("edit")}</button>
          <button class="btn btn-icon btn-ghost btn-sm" data-delete-debt="${d.id}" aria-label="Delete debt">${icon("trash")}</button>
        </div>
      </div>
      <div class="stat-card__label">Remaining</div>
      <div class="stat-card__value num ${rem > 0 ? "amount-negative" : "amount-positive"}">${Utils.formatCurrency(rem)}</div>
      <div class="progress" style="margin-top:var(--sp-3);" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="progress__fill" style="width:${pct}%"></div></div>
      <div class="debt-card__row"><span>Paid ${Utils.formatCurrency(paid)} (${pct}%)</span><span>of ${Utils.formatCurrency(orig)}</span></div>
      <div class="debt-card__meta">
        ${d.interestRate ? `<span>Interest ${d.interestRate}%</span>` : ""}
        ${d.monthlyPayment ? `<span>Monthly ${Utils.formatCurrency(d.monthlyPayment)}</span>` : ""}
        ${d.dueDate && (rem <= 0 || daysUntil(d.dueDate) <= 7) ? `<span>Due ${Utils.formatDate(d.dueDate)}</span>` : ""}
      </div>
      ${d.notes ? `<p class="form-hint" style="margin-bottom:var(--sp-3);">${Utils.escapeHTML(d.notes)}</p>` : ""}
      ${rem > 0 ? `<button class="btn btn-secondary btn-sm" data-pay-debt="${d.id}">+ Record payment</button>` : ""}
    </div>`;
  }

  function render() {
    const list = getAll(), t = txs(), s = summary();
    const stat = (label, value, cls = "") => `<div class="stat-card"><span class="stat-card__label">${label}</span><span class="stat-card__value num ${cls}">${value}</span></div>`;
    $("debtStatGrid").innerHTML =
      stat("Total Debt", Utils.formatCurrency(s.total)) +
      stat("Total Paid", Utils.formatCurrency(s.paid), "amount-positive") +
      stat("Total Remaining", Utils.formatCurrency(s.remaining), s.remaining > 0 ? "amount-negative" : "");

    const empty = $("debtEmptyState");
    empty.style.display = list.length ? "none" : "flex";
    empty.innerHTML = `${icon("credit-card")}<div class="empty-state__title">No debts yet</div><p>Add a loan, credit card or borrowed money to track what you owe.</p>`;
    $("debtGrid").innerHTML = list
      .slice()
      .sort((a, b) => Calc.debtRemaining(b, t) - Calc.debtRemaining(a, t))
      .map((d) => card(d, t))
      .join("");

    const upcoming = list
      .filter((d) => d.dueDate && Calc.debtRemaining(d, t) > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 6);
    $("debtUpcomingList").innerHTML = upcoming.length
      ? upcoming.map((d) => `<div class="mini-list__row">
          <div class="mini-list__icon">${icon("credit-card")}</div>
          <div class="mini-list__body">
            <div class="mini-list__title">${Utils.escapeHTML(d.name)}</div>
            <div class="mini-list__meta">${Utils.formatDate(d.dueDate)}${d.monthlyPayment ? ` · ${Utils.formatCurrency(d.monthlyPayment)}/mo` : ""}</div>
          </div>
          ${dueBadge(d, 1)}
        </div>`).join("")
      : `<div class="empty-state" style="padding:var(--sp-6) var(--sp-2);"><p>No upcoming due dates.</p></div>`;
  }

  function init() {
    $("debtForm").addEventListener("submit", handleSubmit);
    $("addDebtBtn").addEventListener("click", () => openModal());
    $("debtModalCloseBtn").addEventListener("click", closeModal);
    $("debtModalCancelBtn").addEventListener("click", closeModal);
    $("debtModalBackdrop").addEventListener("click", (e) => { if (e.target === $("debtModalBackdrop")) closeModal(); });
    $("debtOriginal").addEventListener("input", updateRemainingField);
    $("debtPaid").addEventListener("input", updateRemainingField);
    $("view-debts").addEventListener("click", (e) => {
      const ed = e.target.closest("[data-edit-debt]"), del = e.target.closest("[data-delete-debt]"), pay = e.target.closest("[data-pay-debt]");
      if (ed) openModal(ed.dataset.editDebt);
      else if (del) handleDelete(del.dataset.deleteDebt);
      else if (pay) recordPayment(pay.dataset.payDebt);
    });
  }

  return { init, render, openModal, getAll, getById, optionsHTML, summary, typeLabel };
})();
