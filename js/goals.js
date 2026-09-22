/* ===== Financial goals module ===== */
const Goals = (() => {
  let editingId = null;
  const $ = Utils.byId;
  const getAll = () => Storage.get(STORAGE_KEYS.goals, []);
  const getById = (id) => getAll().find((g) => g.id === id) || null;
  const daysUntil = (iso) => Math.round((new Date(`${iso}T00:00:00`) - new Date(`${Utils.todayISO()}T00:00:00`)) / 864e5);

  // Open goals first (soonest target date first), completed goals last.
  function sorted(list = getAll()) {
    return list.slice().sort((a, b) => {
      const da = Calc.goalProgress(a).done, db = Calc.goalProgress(b).done;
      if (da !== db) return da ? 1 : -1;
      return (a.targetDate || "9999").localeCompare(b.targetDate || "9999");
    });
  }

  function summary(list = getAll()) {
    const target = Utils.round2(list.reduce((s, g) => s + (Number(g.targetAmount) || 0), 0));
    const saved = Utils.round2(list.reduce((s, g) => s + Math.min(Number(g.savedAmount) || 0, Number(g.targetAmount) || 0), 0));
    return { target, saved, remaining: Utils.round2(target - saved), pct: target > 0 ? Math.round((saved / target) * 100) : 0, count: list.length };
  }

  function statusBadge(g, p) {
    if (p.done) return `<span class="badge badge-success">Completed</span>`;
    if (!g.targetDate) return "";
    const n = daysUntil(g.targetDate);
    if (n < 0) return `<span class="badge badge-danger">Overdue ${-n}d</span>`;
    if (n === 0) return `<span class="badge badge-warning">Due today</span>`;
    if (n <= 30) return `<span class="badge badge-warning">${n} day${n === 1 ? "" : "s"} left</span>`;
    return `<span class="badge badge-info">${Utils.formatDate(g.targetDate)}</span>`;
  }

  function bar(pct) {
    return `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="progress__fill" style="width:${pct}%"></div></div>`;
  }

  function dashboardHTML() {
    const list = sorted().slice(0, 4);
    if (!list.length) return `<div class="empty-state">${icon("target")}<div class="empty-state__title">No goals yet</div><p>Set a savings target to track your progress.</p></div>`;
    return list.map((g) => {
      const p = Calc.goalProgress(g);
      return `<div class="goal-item">
        <div class="goal-item__top"><span>${Utils.escapeHTML(g.name)}</span><span class="num">${p.pct}%</span></div>
        <div class="mini-list__meta num">${Utils.formatCurrency(p.saved)} / ${Utils.formatCurrency(p.target)}</div>
        ${bar(p.pct)}
      </div>`;
    }).join("");
  }

  function openModal(id = null) {
    editingId = id;
    const g = id ? getById(id) : null;
    $("goalModalTitle").textContent = g ? "Edit Goal" : "Add Goal";
    $("goalForm").reset();
    $("goalId").value = g ? g.id : "";
    $("goalName").value = g ? g.name : "";
    $("goalTarget").value = g ? g.targetAmount : "";
    $("goalSaved").value = g ? g.savedAmount : 0;
    $("goalDate").value = g ? g.targetDate || "" : "";
    $("goalNotes").value = g ? g.notes || "" : "";
    Utils.qsa(".form-control", $("goalForm")).forEach((e) => e.classList.remove("is-invalid"));
    $("goalModalBackdrop").classList.add("is-open");
    $("goalName").focus();
  }

  function closeModal() {
    $("goalModalBackdrop").classList.remove("is-open");
    editingId = null;
  }

  function validate() {
    let valid = true;
    const mark = (el, ok) => { el.classList.toggle("is-invalid", !ok); valid = valid && ok; };
    mark($("goalName"), !!$("goalName").value.trim());
    mark($("goalTarget"), Number($("goalTarget").value) > 0);
    mark($("goalSaved"), $("goalSaved").value === "" || Number($("goalSaved").value) >= 0);
    return valid;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    const record = {
      name: $("goalName").value.trim(),
      targetAmount: Utils.round2(Number($("goalTarget").value)),
      savedAmount: Utils.round2(Number($("goalSaved").value) || 0),
      targetDate: $("goalDate").value,
      notes: $("goalNotes").value.trim(),
    };
    const list = getAll();
    const wasEditing = !!editingId;
    if (wasEditing) {
      const idx = list.findIndex((g) => g.id === editingId);
      if (idx > -1) list[idx] = { ...list[idx], ...record, updatedAt: Utils.nowISO() };
    } else {
      list.push({ id: Utils.generateId("goal"), ...record, createdAt: Utils.nowISO(), updatedAt: Utils.nowISO() });
    }
    Storage.set(STORAGE_KEYS.goals, list);
    closeModal();
    Utils.toast(wasEditing ? "Goal updated." : "Goal added.", "success");
    App.refreshDependents();
  }

  async function handleDelete(id) {
    const ok = await Utils.confirmDialog({ title: "Delete goal?", message: "This goal will be permanently removed.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    Storage.set(STORAGE_KEYS.goals, getAll().filter((g) => g.id !== id));
    Utils.toast("Goal deleted.", "success");
    App.refreshDependents();
  }

  function card(g) {
    const p = Calc.goalProgress(g);
    return `<div class="card">
      <div class="card__header" style="margin-bottom:var(--sp-2);">
        <div>
          <h3 class="card__title">${Utils.escapeHTML(g.name)}</h3>
          <div class="debt-card__badges">${statusBadge(g, p)}</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-icon btn-ghost btn-sm" data-edit-goal="${g.id}" aria-label="Edit goal">${icon("edit")}</button>
          <button class="btn btn-icon btn-ghost btn-sm" data-delete-goal="${g.id}" aria-label="Delete goal">${icon("trash")}</button>
        </div>
      </div>
      <div class="stat-card__value num">${Utils.formatCurrency(p.saved)} <span class="form-hint" style="font-size:var(--fs-sm);">/ ${Utils.formatCurrency(p.target)}</span></div>
      <div style="margin-top:var(--sp-3);">${bar(p.pct)}</div>
      <div class="debt-card__row"><span>${p.pct}% complete</span><span>${p.done ? "Goal reached" : `${Utils.formatCurrency(p.remaining)} to go`}</span></div>
      ${g.targetDate ? `<div class="debt-card__meta"><span>Target date ${Utils.formatDate(g.targetDate)}</span></div>` : ""}
      ${g.notes ? `<p class="form-hint">${Utils.escapeHTML(g.notes)}</p>` : ""}
    </div>`;
  }

  function render() {
    const list = getAll(), s = summary(list);
    const stat = (label, value, cls = "") => `<div class="stat-card"><span class="stat-card__label">${label}</span><span class="stat-card__value num ${cls}">${value}</span></div>`;
    $("goalStatGrid").innerHTML =
      stat("Total Target", Utils.formatCurrency(s.target)) +
      stat("Total Saved", Utils.formatCurrency(s.saved), "amount-positive") +
      stat("Remaining", Utils.formatCurrency(s.remaining)) +
      stat("Overall Progress", `${s.pct}%`);
    const empty = $("goalEmptyState");
    empty.style.display = list.length ? "none" : "flex";
    empty.innerHTML = `${icon("target")}<div class="empty-state__title">No goals yet</div><p>Set a savings target, like a laptop or an emergency fund, and track your progress.</p>`;
    $("goalGrid").innerHTML = sorted(list).map(card).join("");
  }

  function init() {
    $("goalForm").addEventListener("submit", handleSubmit);
    $("addGoalBtn").addEventListener("click", () => openModal());
    $("goalModalCloseBtn").addEventListener("click", closeModal);
    $("goalModalCancelBtn").addEventListener("click", closeModal);
    $("goalModalBackdrop").addEventListener("click", (e) => { if (e.target === $("goalModalBackdrop")) closeModal(); });
    $("view-goals").addEventListener("click", (e) => {
      const ed = e.target.closest("[data-edit-goal]"), del = e.target.closest("[data-delete-goal]");
      if (ed) openModal(ed.dataset.editGoal);
      else if (del) handleDelete(del.dataset.deleteGoal);
    });
  }

  return { init, render, openModal, getAll, summary, dashboardHTML };
})();
