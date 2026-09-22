/* ===== Investments module ===== */
const INVESTMENT_TYPES = [
  { value: "stock", label: "Stock" },
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "gold", label: "Gold" },
  { value: "crypto", label: "Crypto" },
  { value: "business", label: "Business" },
  { value: "dps", label: "DPS/Deposit" },
  { value: "other", label: "Other" },
];

const ALLOCATION_COLORS = ["#0F6E5C", "#B8860B", "#2461A8", "#8E5FD9", "#C0392B", "#2F9E7A", "#6E8A81"];

const Investments = (() => {
  let editingId = null;
  let investedTouched = false;

  function typeLabel(value) {
    return (INVESTMENT_TYPES.find((t) => t.value === value) || {}).label || value;
  }

  function getAll() {
    return Storage.get(STORAGE_KEYS.investments, []);
  }
  function getById(id) {
    return getAll().find((i) => i.id === id) || null;
  }

  function typeOptionsHTML(selected) {
    return INVESTMENT_TYPES.map((t) => `<option value="${t.value}" ${t.value === selected ? "selected" : ""}>${t.label}</option>`).join("");
  }

  function autoFillInvested() {
    if (investedTouched) return;
    const qty = Number(Utils.byId("invQuantity").value) || 0;
    const buy = Number(Utils.byId("invBuyPrice").value) || 0;
    if (qty > 0 && buy > 0) Utils.byId("invInvestedAmount").value = Utils.round2(qty * buy);
  }

  function openModal(id = null) {
    editingId = id;
    investedTouched = !!id;
    const inv = id ? getById(id) : null;
    Utils.byId("invModalTitle").textContent = inv ? "Edit Investment" : "Add Investment";
    Utils.byId("invForm").reset();
    Utils.byId("invId").value = inv ? inv.id : "";
    Utils.byId("invType").innerHTML = typeOptionsHTML(inv ? inv.type : "stock");
    Utils.byId("invName").value = inv ? inv.name : "";
    Utils.byId("invQuantity").value = inv ? inv.quantity : 1;
    Utils.byId("invBuyPrice").value = inv ? inv.buyPrice : "";
    Utils.byId("invInvestedAmount").value = inv ? inv.investedAmount : "";
    Utils.byId("invCurrentPrice").value = inv ? inv.currentPrice : "";
    Utils.byId("invFees").value = inv ? inv.fees : 0;
    Utils.byId("invDate").value = inv ? inv.date : Utils.todayISO();
    Utils.byId("invNotes").value = inv ? inv.notes || "" : "";
    Utils.qsa(".form-error", Utils.byId("invForm")).forEach((e) => (e.style.display = "none"));
    Utils.qsa(".form-control", Utils.byId("invForm")).forEach((e) => e.classList.remove("is-invalid"));
    Utils.byId("invModalBackdrop").classList.add("is-open");
    Utils.byId("invName").focus();
  }

  function closeModal() {
    Utils.byId("invModalBackdrop").classList.remove("is-open");
    editingId = null;
  }

  function validate() {
    let valid = true;
    const mark = (el, ok) => { el.classList.toggle("is-invalid", !ok); valid = valid && ok; };
    mark(Utils.byId("invName"), !!Utils.byId("invName").value.trim());
    mark(Utils.byId("invQuantity"), Number(Utils.byId("invQuantity").value) > 0);
    mark(Utils.byId("invInvestedAmount"), Number(Utils.byId("invInvestedAmount").value) >= 0);
    mark(Utils.byId("invCurrentPrice"), Utils.byId("invCurrentPrice").value !== "" && Number(Utils.byId("invCurrentPrice").value) >= 0);
    mark(Utils.byId("invDate"), !!Utils.byId("invDate").value);
    return valid;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    const record = {
      type: Utils.byId("invType").value,
      name: Utils.byId("invName").value.trim(),
      quantity: Utils.round2(Number(Utils.byId("invQuantity").value)),
      buyPrice: Utils.round2(Number(Utils.byId("invBuyPrice").value) || 0),
      investedAmount: Utils.round2(Number(Utils.byId("invInvestedAmount").value)),
      currentPrice: Utils.round2(Number(Utils.byId("invCurrentPrice").value)),
      fees: Utils.round2(Number(Utils.byId("invFees").value) || 0),
      date: Utils.byId("invDate").value,
      notes: Utils.byId("invNotes").value.trim(),
    };
    const list = getAll();
    if (editingId) {
      const idx = list.findIndex((i) => i.id === editingId);
      if (idx > -1) list[idx] = { ...list[idx], ...record, updatedAt: Utils.nowISO() };
    } else {
      list.push({ id: Utils.generateId("inv"), ...record, createdAt: Utils.nowISO(), updatedAt: Utils.nowISO() });
    }
    Storage.set(STORAGE_KEYS.investments, list);
    closeModal();
    Utils.toast(editingId ? "Investment updated." : "Investment added.", "success");
    render();
    App.refreshDependents();
  }

  async function handleDelete(id) {
    const ok = await Utils.confirmDialog({
      title: "Delete investment?",
      message: "This investment record will be permanently removed.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    Storage.set(STORAGE_KEYS.investments, getAll().filter((i) => i.id !== id));
    Utils.toast("Investment deleted.", "success");
    render();
    App.refreshDependents();
  }

  function summary() {
    const list = getAll();
    let invested = 0, current = 0, fees = 0, profit = 0, loss = 0;
    list.forEach((inv) => {
      invested += Number(inv.investedAmount) || 0;
      current += Calc.investmentCurrentValue(inv);
      fees += Number(inv.fees) || 0;
      const pl = Calc.investmentProfitLoss(inv);
      if (pl >= 0) profit += pl; else loss += pl;
    });
    const netPL = Utils.round2(current - invested - fees);
    const roi = invested > 0 ? Utils.round2((netPL / invested) * 100) : 0;
    return {
      invested: Utils.round2(invested),
      current: Utils.round2(current),
      profit: Utils.round2(profit),
      loss: Utils.round2(loss),
      netPL, roi, list,
    };
  }

  function allocationByType(list) {
    const map = {};
    list.forEach((inv) => {
      const cv = Calc.investmentCurrentValue(inv);
      map[inv.type] = (map[inv.type] || 0) + cv;
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .map(([type, value], i) => ({
        type, value, pct: total > 0 ? Utils.round2((value / total) * 100) : 0,
        color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }

  function renderAllocationChart(allocation, chartId = "allocationChart", legendId = "allocationLegend") {
    const chartEl = Utils.byId(chartId);
    const legendEl = Utils.byId(legendId);
    if (!allocation.length) {
      chartEl.style.background = "var(--bg-subtle)";
      legendEl.innerHTML = "";
      return;
    }
    let acc = 0;
    const stops = allocation
      .map((a) => {
        const start = acc;
        acc += a.pct;
        return `${a.color} ${start}% ${acc}%`;
      })
      .join(", ");
    chartEl.style.background = `conic-gradient(${stops})`;
    legendEl.innerHTML = allocation
      .map(
        (a) => `<div class="mini-list__row">
          <span style="width:10px;height:10px;border-radius:50%;background:${a.color};flex-shrink:0;"></span>
          <div class="mini-list__body">
            <div class="mini-list__title">${typeLabel(a.type)}</div>
          </div>
          <div class="mini-list__amount num">${a.pct}%</div>
        </div>`
      )
      .join("");
  }

  function row(inv) {
    const cv = Calc.investmentCurrentValue(inv);
    const pl = Calc.investmentProfitLoss(inv);
    const roi = Calc.investmentROI(inv);
    const plClass = pl >= 0 ? "amount-positive" : "amount-negative";
    return `<tr>
      <td>${Utils.escapeHTML(inv.name)}</td>
      <td><span class="badge badge-neutral">${typeLabel(inv.type)}</span></td>
      <td class="num">${inv.quantity}</td>
      <td class="num">${Utils.formatCurrency(inv.currentPrice, { decimals: 2 })}</td>
      <td class="num">${Utils.formatCurrency(inv.investedAmount)}</td>
      <td class="num">${Utils.formatCurrency(cv)}</td>
      <td class="num ${plClass}">${pl >= 0 ? "+" : ""}${Utils.formatCurrency(pl)}</td>
      <td class="num ${plClass}">${roi >= 0 ? "+" : ""}${roi}%</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-icon btn-ghost btn-sm" data-edit-inv="${inv.id}" aria-label="Edit">${icon("edit")}</button>
          <button class="btn btn-icon btn-ghost btn-sm" data-delete-inv="${inv.id}" aria-label="Delete">${icon("trash")}</button>
        </div>
      </td>
    </tr>`;
  }

  function statCardHTML(label, value, cls = "") {
    return `<div class="stat-card"><span class="stat-card__label">${label}</span><span class="stat-card__value num ${cls}">${value}</span></div>`;
  }

  function render() {
    const view = Utils.byId("view-investments");
    const s = summary();

    Utils.byId("invStatGrid").innerHTML = [
      statCardHTML("Total Invested", Utils.formatCurrency(s.invested)),
      statCardHTML("Current Value", Utils.formatCurrency(s.current)),
      statCardHTML("Total Profit", "+" + Utils.formatCurrency(s.profit), "amount-positive"),
      statCardHTML("Total Loss", Utils.formatCurrency(s.loss), s.loss < 0 ? "amount-negative" : ""),
      statCardHTML("Net P/L", (s.netPL >= 0 ? "+" : "") + Utils.formatCurrency(s.netPL), s.netPL >= 0 ? "amount-positive" : "amount-negative"),
      statCardHTML("ROI", (s.roi >= 0 ? "+" : "") + s.roi + "%", s.roi >= 0 ? "amount-positive" : "amount-negative"),
    ].join("");

    renderAllocationChart(allocationByType(s.list));

    const tableWrap = Utils.byId("invTableWrap");
    const emptyWrap = Utils.byId("invEmptyState");
    if (!s.list.length) {
      tableWrap.style.display = "none";
      emptyWrap.style.display = "flex";
    } else {
      tableWrap.style.display = "block";
      emptyWrap.style.display = "none";
      Utils.byId("invTableBody").innerHTML = s.list
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(row)
        .join("");
    }

    Utils.qsa("[data-edit-inv]", view).forEach((btn) => btn.addEventListener("click", () => openModal(btn.dataset.editInv)));
    Utils.qsa("[data-delete-inv]", view).forEach((btn) => btn.addEventListener("click", () => handleDelete(btn.dataset.deleteInv)));
  }

  function recentForDashboard(limit = 5) {
    return getAll().slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  }

  function init() {
    Utils.byId("invForm").addEventListener("submit", handleSubmit);
    Utils.byId("addInvestmentBtn").addEventListener("click", () => openModal());
    Utils.byId("invModalCloseBtn").addEventListener("click", closeModal);
    Utils.byId("invModalCancelBtn").addEventListener("click", closeModal);
    Utils.byId("invModalBackdrop").addEventListener("click", (e) => {
      if (e.target === Utils.byId("invModalBackdrop")) closeModal();
    });
    Utils.byId("invQuantity").addEventListener("input", autoFillInvested);
    Utils.byId("invBuyPrice").addEventListener("input", autoFillInvested);
    Utils.byId("invInvestedAmount").addEventListener("input", () => { investedTouched = true; });
  }

  return { init, render, openModal, getAll, typeLabel, summary, allocationByType, renderAllocationChart, recentForDashboard };
})();
