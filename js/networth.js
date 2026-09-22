/* ===== Net Worth module: history snapshots + view ===== */
const NetWorth = (() => {
  const $ = Utils.byId;
  const MAX_SNAPSHOTS = 730;
  const SNAP_KEYS = ["accounts", "otherAssets", "investments", "totalAssets", "liabilities", "netWorth"];
  const localISO = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const signed = (n) => (n >= 0 ? "+" : "") + Utils.formatCurrency(n);

  function getHistory() {
    const h = Storage.get(STORAGE_KEYS.netWorthHistory, []);
    return (Array.isArray(h) ? h : []).filter((x) => x && x.date).sort((a, b) => a.date.localeCompare(b.date));
  }

  // One snapshot per day; today's is refreshed whenever data changes.
  function snapshot() {
    const b = Calc.netWorthBreakdown();
    const snap = { date: Utils.todayISO() };
    SNAP_KEYS.forEach((k) => (snap[k] = b[k]));
    const hist = getHistory();
    const i = hist.findIndex((h) => h.date === snap.date);
    if (i > -1) {
      if (SNAP_KEYS.every((k) => hist[i][k] === snap[k])) return;
      hist[i] = snap;
    } else hist.push(snap);
    Storage.set(STORAGE_KEYS.netWorthHistory, hist.slice(-MAX_SNAPSHOTS));
  }

  // Change vs. the snapshot closest to one month ago (or the earliest earlier one).
  function change(current = Calc.netWorthBreakdown().netWorth) {
    const today = Utils.todayISO();
    const prior = getHistory().filter((h) => h.date < today);
    if (!prior.length) return null;
    const d = new Date(`${today}T00:00:00`);
    d.setMonth(d.getMonth() - 1);
    const target = localISO(d);
    const older = prior.filter((h) => h.date <= target);
    const base = older.length ? older[older.length - 1] : prior[0];
    const diff = Utils.round2(current - base.netWorth);
    return { base, diff, pct: base.netWorth !== 0 ? Utils.round2((diff / Math.abs(base.netWorth)) * 100) : null };
  }

  // Snapshot-based change over [from, to]; null when history doesn't cover the period.
  function rangeChange(from, to) {
    const h = getHistory();
    const end = h.filter((x) => x.date <= to).pop();
    if (!end) return null;
    const base = h.filter((x) => x.date < from).pop() || h.find((x) => x.date >= from && x.date < end.date);
    if (!base || base.date >= end.date) return null;
    return { base, end, diff: Utils.round2(end.netWorth - base.netWorth) };
  }

  function chartHTML(hist = getHistory()) {
    if (hist.length < 2) {
      return `<div class="chart-placeholder" style="text-align:center;padding:var(--sp-4);">History builds automatically: one snapshot per day you use the app.</div>`;
    }
    const W = 600, H = 200, pad = { l: 8, r: 8, t: 12, b: 12 };
    const vals = hist.map((h) => h.netWorth);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / (hist.length - 1);
    const y = (v) => pad.t + ((max - v) / (max - min)) * (H - pad.t - pad.b);
    const pts = hist.map((h, i) => `${x(i).toFixed(1)},${y(h.netWorth).toFixed(1)}`);
    const area = `M${x(0).toFixed(1)},${H - pad.b} L${pts.join(" L")} L${x(hist.length - 1).toFixed(1)},${H - pad.b} Z`;
    const dots = hist.length <= 40
      ? hist.map((h, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(h.netWorth).toFixed(1)}" r="3.5" style="fill:var(--color-primary)"><title>${Utils.formatDate(h.date)}: ${Utils.formatCurrency(h.netWorth)}</title></circle>`).join("")
      : "";
    const last = hist[hist.length - 1];
    return `<svg class="line-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Net worth from ${Utils.formatDate(hist[0].date)} to ${Utils.formatDate(last.date)}">
      <path d="${area}" style="fill:var(--color-primary-light)"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" style="stroke:var(--color-primary)"/>
      ${dots}
    </svg>
    <div class="line-chart__caption"><span>${Utils.formatDate(hist[0].date, "short")}</span><span>Low ${Utils.formatCurrency(Math.min(...vals))} · High ${Utils.formatCurrency(Math.max(...vals))}</span><span>${Utils.formatDate(last.date, "short")}</span></div>`;
  }

  function duplicateNames() {
    const norm = (s) => String(s || "").trim().toLowerCase();
    const names = new Set(Assets.getAll().map((a) => norm(a.name)));
    return Investments.getAll().filter((i) => names.has(norm(i.name))).map((i) => i.name);
  }

  function render() {
    const b = Calc.netWorthBreakdown();
    const cls = (n) => (n >= 0 ? "amount-positive" : "amount-negative");

    $("nwValue").textContent = Utils.formatCurrency(b.netWorth);
    $("nwValue").className = `nw-hero__value num ${b.netWorth < 0 ? "amount-negative" : ""}`;
    const ch = change(b.netWorth);
    $("nwChange").innerHTML = ch
      ? `<span class="stat-card__delta ${ch.diff >= 0 ? "is-positive" : "is-negative"}">${signed(ch.diff)}${ch.pct === null ? "" : ` (${ch.pct >= 0 ? "+" : ""}${ch.pct}%)`}</span> <span class="form-hint">since ${Utils.formatDate(ch.base.date)}</span>`
      : `<span class="form-hint">Tracking started today — change appears from your next visit.</span>`;

    const stat = (label, value, hint = "") => `<div class="stat-card"><span class="stat-card__label">${label}</span><span class="stat-card__value num">${value}</span>${hint ? `<span class="form-hint">${hint}</span>` : ""}</div>`;
    const n = (c, w) => `${c} ${w}${c === 1 ? "" : "s"}`;
    $("nwStatGrid").innerHTML =
      stat("Total Assets", Utils.formatCurrency(b.totalAssets), "Accounts + other assets + investments") +
      stat("Account Balances", Utils.formatCurrency(b.accounts), n(b.counts.accounts, "account")) +
      stat("Other Assets", Utils.formatCurrency(b.otherAssets), n(b.counts.assets, "asset")) +
      stat("Investments", Utils.formatCurrency(b.investments), `Current value · ${n(b.counts.investments, "holding")}`) +
      stat("Total Liabilities", Utils.formatCurrency(b.liabilities), n(b.counts.debts, "debt"));

    const dup = duplicateNames();
    $("nwWarning").innerHTML = dup.length
      ? `<div class="card nw-warning"><strong>Possible double counting</strong><span class="form-hint">${dup.map((d) => `“${Utils.escapeHTML(d)}”`).join(", ")} appear${dup.length === 1 ? "s" : ""} in both Assets and Investments. If it's the same holding, remove one so it's counted once.</span></div>`
      : "";

    const parts = [
      { label: "Account balances", value: b.accounts, color: ALLOCATION_COLORS[0] },
      { label: "Other assets", value: b.otherAssets, color: ALLOCATION_COLORS[1] },
      { label: "Investments", value: b.investments, color: ALLOCATION_COLORS[2] },
    ];
    const pos = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
    $("nwBar").innerHTML = pos > 0
      ? parts.map((p) => `<span style="width:${(Math.max(0, p.value) / pos) * 100}%;background:${p.color}" title="${p.label}"></span>`).join("")
      : "";
    const row = (dot, label, value, valueCls = "") => `<div class="mini-list__row">${dot}<div class="mini-list__body"><div class="mini-list__title">${label}</div></div><div class="mini-list__amount num ${valueCls}">${value}</div></div>`;
    const dot = (c) => `<span style="width:10px;height:10px;border-radius:50%;background:${c};flex-shrink:0;"></span>`;
    $("nwLegend").innerHTML =
      parts.map((p) => row(dot(p.color), p.label, `${Utils.formatCurrency(p.value)}${pos > 0 ? ` · ${Math.round((Math.max(0, p.value) / pos) * 100)}%` : ""}`)).join("") +
      row(dot(ALLOCATION_COLORS[4]), "Liabilities", `−${Utils.formatCurrency(b.liabilities)}`, b.liabilities > 0 ? "amount-negative" : "") +
      row("", "<strong>Net worth</strong>", Utils.formatCurrency(b.netWorth), cls(b.netWorth));

    const hist = getHistory();
    $("nwChart").innerHTML = chartHTML(hist);
    $("nwHistoryBody").innerHTML = hist.length
      ? hist.slice(-12).reverse().map((h) => {
          const prev = hist[hist.indexOf(h) - 1];
          const d = prev ? Utils.round2(h.netWorth - prev.netWorth) : null;
          return `<tr><td>${Utils.formatDate(h.date)}</td><td class="num">${Utils.formatCurrency(h.totalAssets)}</td><td class="num">${Utils.formatCurrency(h.liabilities)}</td><td class="num">${Utils.formatCurrency(h.netWorth)}</td><td class="num ${d === null ? "" : cls(d)}">${d === null ? "—" : signed(d)}</td></tr>`;
        }).join("")
      : `<tr><td colspan="5" class="form-hint">No snapshots yet.</td></tr>`;
  }

  return { snapshot, change, rangeChange, chartHTML, getHistory, render };
})();
