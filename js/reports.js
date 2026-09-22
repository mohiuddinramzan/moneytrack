/* ===== Reports module ===== */
const Reports = (() => {
  const $ = Utils.byId;
  const state = { range: "month", from: "", to: "" };
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m is 0-based
  const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return { y, m: m - 1, d }; };
  const signed = (n) => (n >= 0 ? "+" : "") + Utils.formatCurrency(n);
  const COLORS = ALLOCATION_COLORS;

  function getRange() {
    const t = parse(Utils.todayISO());
    if (state.range === "month") return { from: ymd(t.y, t.m, 1), to: ymd(t.y, t.m, new Date(t.y, t.m + 1, 0).getDate()) };
    if (state.range === "last") {
      const d = new Date(t.y, t.m - 1, 1);
      return { from: ymd(d.getFullYear(), d.getMonth(), 1), to: ymd(d.getFullYear(), d.getMonth(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()) };
    }
    if (state.range === "year") return { from: ymd(t.y, 0, 1), to: ymd(t.y, 11, 31) };
    return { from: state.from, to: state.to };
  }

  // Weekly buckets inside a single month, monthly buckets otherwise.
  function buckets(txs, from, to) {
    const f = parse(from), t = parse(to);
    const sameMonth = f.y === t.y && f.m === t.m;
    let list = [], idxOf;
    if (sameMonth) {
      const n = Math.floor((t.d - f.d) / 7) + 1;
      for (let i = 0; i < n; i++) list.push({ label: `${f.d + i * 7}–${Math.min(t.d, f.d + i * 7 + 6)}`, income: 0, expense: 0 });
      idxOf = (iso) => Math.floor((parse(iso).d - f.d) / 7);
    } else {
      const n = (t.y - f.y) * 12 + (t.m - f.m) + 1, multiYear = t.y !== f.y;
      for (let i = 0; i < n; i++) {
        const d = new Date(f.y, f.m + i, 1);
        const label = d.toLocaleDateString(Utils.getSettings().locale || "en-BD", { month: "short" }) + (multiYear ? ` ’${String(d.getFullYear()).slice(2)}` : "");
        list.push({ label, income: 0, expense: 0 });
      }
      idxOf = (iso) => { const p = parse(iso); return (p.y - f.y) * 12 + (p.m - f.m); };
    }
    txs.forEach((tx) => {
      if (!tx.date || tx.date < from || tx.date > to) return;
      const b = list[idxOf(tx.date)];
      if (!b) return;
      const a = Number(tx.amount) || 0;
      if (tx.type === "income" || tx.type === "dividend" || tx.type === "interest") b.income += a;
      else if (tx.type === "expense") b.expense += a;
    });
    return list;
  }

  function barChartHTML(list) {
    if (!list.some((b) => b.income || b.expense)) return `<div class="chart-placeholder">No income or expenses in this period.</div>`;
    const max = Math.max(...list.map((b) => Math.max(b.income, b.expense)), 1), H = 160;
    const bar = (v, color, tip) => `<i style="height:${((v / max) * H).toFixed(1)}px;background:${color}" title="${tip}"></i>`;
    const cols = list.map((b) => `<div class="bars__col" role="img" aria-label="${b.label}: income ${Utils.formatCurrency(b.income)}, expense ${Utils.formatCurrency(b.expense)}">
      <div class="bars__pair" style="height:${H}px">${bar(b.income, "var(--color-success)", `${b.label} income: ${Utils.formatCurrency(b.income)}`)}${bar(b.expense, "var(--color-danger)", `${b.label} expense: ${Utils.formatCurrency(b.expense)}`)}</div>
      <span class="bars__label">${b.label}</span></div>`).join("");
    return `<div class="chart-scroll"><div class="bars" style="min-width:${list.length * 48}px">${cols}</div></div>
      <div class="chart-legend"><span><i style="background:var(--color-success)"></i>Income</span><span><i style="background:var(--color-danger)"></i>Expense</span></div>`;
  }

  function categoriesHTML(cats, total) {
    if (!cats.length) return `<div class="empty-state" style="padding:var(--sp-6) var(--sp-2);"><p>No expenses in this period.</p></div>`;
    let rows = cats.slice(0, 7);
    const rest = cats.slice(7).reduce((s, c) => s + c.value, 0);
    if (rest > 0) rows.push({ name: "Others", value: Utils.round2(rest) });
    return rows.map((c, i) => {
      const pct = total > 0 ? Math.round((c.value / total) * 100) : 0;
      return `<div class="cat-row"><div class="cat-row__top"><span>${Utils.escapeHTML(c.name)}</span><span class="num">${Utils.formatCurrency(c.value)} · ${pct}%</span></div>
        <div class="progress"><div class="progress__fill" style="width:${pct}%;background:${COLORS[i % COLORS.length]}"></div></div></div>`;
    }).join("");
  }

  function renderAllocation() {
    const alloc = Investments.allocationByType(Investments.getAll());
    const donut = $("reportDonut"), legend = $("reportAllocation");
    if (!alloc.length) {
      donut.style.display = "none";
      legend.innerHTML = `<div class="empty-state" style="padding:var(--sp-6) var(--sp-2);"><p>No investments yet.</p></div>`;
      return;
    }
    let acc = 0;
    donut.style.display = "block";
    donut.style.background = `conic-gradient(${alloc.map((a) => { const s = acc; acc += a.pct; return `${a.color} ${s}% ${acc}%`; }).join(", ")})`;
    legend.innerHTML = alloc.map((a) => `<div class="mini-list__row"><span style="width:10px;height:10px;border-radius:50%;background:${a.color};flex-shrink:0;"></span><div class="mini-list__body"><div class="mini-list__title">${Investments.typeLabel(a.type)}</div></div><div class="mini-list__amount num">${a.pct}%</div></div>`).join("");
  }

  function render() {
    $("reportInsights").innerHTML = Insights.html();
    const { from, to } = getRange();
    Utils.qsa("#reportRange .segmented__btn").forEach((b) => {
      const on = b.dataset.range === state.range;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    $("reportCustom").style.display = state.range === "custom" ? "grid" : "none";
    $("reportFrom").value = state.from;
    $("reportTo").value = state.to;
    const bad = !from || !to || from > to;
    $("reportRangeError").style.display = state.range === "custom" && from && to && from > to ? "block" : "none";
    if (bad) {
      $("reportRangeLabel").textContent = "Choose a start and end date.";
      return;
    }
    $("reportRangeLabel").textContent = `${Utils.formatDate(from)} – ${Utils.formatDate(to)}`;

    const txs = Storage.get(STORAGE_KEYS.transactions, []);
    const r = Calc.totalsForRange(txs, from, to);
    const savings = Utils.round2(r.income - r.expense);
    const rate = r.income > 0 ? Math.round((savings / r.income) * 100) : null;
    const inv = Investments.summary();
    const today = Utils.todayISO();
    const endSnap = NetWorth.getHistory().filter((h) => h.date <= to).pop();
    const nwValue = to >= today ? Calc.netWorthBreakdown().netWorth : endSnap ? endSnap.netWorth : null;
    const nwChange = NetWorth.rangeChange(from, to);

    const stat = (label, value, hint = "", cls = "") => `<div class="stat-card"><span class="stat-card__label">${label}</span><span class="stat-card__value num ${cls}">${value}</span>${hint ? `<span class="form-hint">${hint}</span>` : ""}</div>`;
    const pn = (n) => (n >= 0 ? "amount-positive" : "amount-negative");
    $("reportStatGrid").innerHTML =
      stat("Income", Utils.formatCurrency(r.income), "", "amount-positive") +
      stat("Expenses", Utils.formatCurrency(r.expense), "", r.expense > 0 ? "amount-negative" : "") +
      stat("Savings", signed(savings), rate === null ? "No income in period" : `Savings rate ${rate}%`, pn(savings)) +
      stat("Investment P/L", signed(inv.netPL), `ROI ${inv.roi >= 0 ? "+" : ""}${inv.roi}% · current holdings`, pn(inv.netPL)) +
      stat("Net Worth", nwValue === null ? "—" : Utils.formatCurrency(nwValue), nwChange ? `${signed(nwChange.diff)} in period` : "Change needs more history");

    $("reportBarChart").innerHTML = barChartHTML(buckets(txs, from, to));
    $("reportCategories").innerHTML = categoriesHTML(r.categories, r.expense);
    renderAllocation();
    const hist = NetWorth.getHistory().filter((h) => h.date >= from && h.date <= to);
    $("reportNwChart").innerHTML = NetWorth.chartHTML(hist);
  }

  function init() {
    $("reportRange").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-range]");
      if (!btn) return;
      state.range = btn.dataset.range;
      if (state.range === "custom" && (!state.from || !state.to)) {
        const t = parse(Utils.todayISO());
        state.from = ymd(t.y, t.m, 1);
        state.to = Utils.todayISO();
      }
      render();
    });
    $("reportFrom").addEventListener("change", (e) => { state.from = e.target.value; render(); });
    $("reportTo").addEventListener("change", (e) => { state.to = e.target.value; render(); });
  }

  return { init, render };
})();
