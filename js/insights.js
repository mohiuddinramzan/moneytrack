/* ===== Smart insights: descriptive statements about recorded data only ===== */
const Insights = (() => {
  const fmt = (n) => Utils.formatCurrency(n);
  const esc = Utils.escapeHTML;
  const b = (s) => `<strong class="num">${s}</strong>`;

  function monthRange(offset) {
    const [y0, m0] = Utils.todayISO().split("-").map(Number);
    const d = new Date(y0, m0 - 1 + offset, 1), y = d.getFullYear(), m = d.getMonth();
    const p = (n) => String(n).padStart(2, "0");
    return {
      from: `${y}-${p(m + 1)}-01`,
      to: `${y}-${p(m + 1)}-${p(new Date(y, m + 1, 0).getDate())}`,
      label: d.toLocaleDateString(Utils.getSettings().locale || "en-BD", { month: "long" }),
    };
  }

  function compute() {
    const out = [];
    const add = (icon, html) => out.push({ icon, html });
    const txs = Storage.get(STORAGE_KEYS.transactions, []);
    const cur = monthRange(0), prev = monthRange(-1);
    const c = Calc.totalsForRange(txs, cur.from, cur.to), p = Calc.totalsForRange(txs, prev.from, prev.to);

    // Expenses / income vs previous month
    const compare = (label, curV, prevV, plural) => {
      const be = plural ? "are" : "is", eq = plural ? "match" : "matches";
      if (!curV && !prevV) return;
      if (!prevV) return add("trending-up", `${label} so far this month: ${b(fmt(curV))}. None were recorded in ${prev.label}.`);
      if (!curV) return add("trending-down", `No ${label.toLowerCase()} recorded so far this month, compared with ${b(fmt(prevV))} in ${prev.label}.`);
      const diff = curV - prevV;
      if (diff === 0) return add("bar-chart", `${label} so far this month ${eq} ${prev.label}: ${b(fmt(curV))}.`);
      const pct = Math.round((Math.abs(diff) / prevV) * 100);
      add(diff > 0 ? "trending-up" : "trending-down", `${label} so far this month ${be} ${b(fmt(curV))}, ${b(pct + "%")} ${diff > 0 ? "higher" : "lower"} than ${prev.label} (${fmt(prevV)}).`);
    };
    compare("Expenses", c.expense, p.expense, true);
    compare("Income", c.income, p.income, false);

    // Savings rate
    if (c.income > 0) {
      const rate = Math.round(((c.income - c.expense) / c.income) * 100);
      add("wallet", `Savings rate this month: ${b(rate + "%")} (${fmt(c.income)} income, ${fmt(c.expense)} expenses).`);
    } else if (c.expense > 0) {
      add("wallet", `No income recorded this month; expenses so far total ${b(fmt(c.expense))}.`);
    }

    // Categories
    if (c.categories.length) {
      const top = c.categories[0];
      add("bar-chart", `Largest expense category this month: ${b(esc(top.name))}, ${fmt(top.value)} (${Math.round((top.value / c.expense) * 100)}% of expenses).`);
      const prevMap = Object.fromEntries(p.categories.map((x) => [x.name, x.value]));
      const curMap = Object.fromEntries(c.categories.map((x) => [x.name, x.value]));
      const names = new Set([...Object.keys(prevMap), ...Object.keys(curMap)]);
      let best = null;
      names.forEach((n) => {
        const d = (curMap[n] || 0) - (prevMap[n] || 0);
        if (p.expense > 0 && (!best || Math.abs(d) > Math.abs(best.d))) best = { n, d };
      });
      if (best && best.d !== 0) {
        add(best.d > 0 ? "trending-up" : "trending-down", `Biggest category change vs ${prev.label}: ${b(esc(best.n))}, ${best.d > 0 ? "up" : "down"} ${fmt(Math.abs(best.d))} (${fmt(prevMap[best.n] || 0)} to ${fmt(curMap[best.n] || 0)}).`);
      }
    }

    // Investments
    const inv = Investments.summary();
    if (inv.list.length) {
      add("trending-up", `Investments are worth ${b(fmt(inv.current))} against ${fmt(inv.invested)} invested: a ${inv.netPL >= 0 ? "profit" : "loss"} of ${b(fmt(Math.abs(inv.netPL)))} (ROI ${inv.roi >= 0 ? "+" : ""}${inv.roi}%, fees included).`);
      const alloc = Investments.allocationByType(inv.list);
      if (alloc.length > 1) add("bar-chart", `Largest investment allocation by current value: ${b(Investments.typeLabel(alloc[0].type))}, ${alloc[0].pct}%.`);
      if (inv.list.length > 1) {
        const ranked = inv.list.map((i) => ({ n: i.name, roi: Calc.investmentROI(i) })).sort((x, y) => y.roi - x.roi);
        const hi = ranked[0], lo = ranked[ranked.length - 1];
        const s = (r) => `${r >= 0 ? "+" : ""}${r}%`;
        add("bar-chart", `Highest ROI holding: ${b(esc(hi.n))} (${s(hi.roi)}). Lowest: ${b(esc(lo.n))} (${s(lo.roi)}).`);
      }
    }

    // Net worth
    const nw = Calc.netWorthBreakdown();
    if (nw.totalAssets > 0 || nw.liabilities > 0) {
      const ch = NetWorth.change(nw.netWorth);
      if (ch && ch.diff !== 0) {
        add("layers", `Net worth is ${b(fmt(nw.netWorth))}, ${ch.diff > 0 ? "up" : "down"} ${fmt(Math.abs(ch.diff))}${ch.pct === null ? "" : ` (${Math.abs(ch.pct)}%)`} since ${Utils.formatDate(ch.base.date)}.`);
      } else {
        add("layers", `Net worth is ${b(fmt(nw.netWorth))}${ch ? `, unchanged since ${Utils.formatDate(ch.base.date)}` : ""}.`);
      }
    }

    // Debts
    const debts = Storage.get(STORAGE_KEYS.debts, []);
    const open = debts.map((d) => ({ d, rem: Calc.debtRemaining(d, txs) })).filter((x) => x.rem > 0);
    if (open.length) {
      const today = Utils.todayISO();
      const total = Utils.round2(open.reduce((s, x) => s + x.rem, 0));
      add("credit-card", `Remaining debt totals ${b(fmt(total))} across ${open.length} debt${open.length === 1 ? "" : "s"}.`);
      const dated = open.filter((x) => x.d.dueDate).sort((x, y) => x.d.dueDate.localeCompare(y.d.dueDate));
      const overdue = dated.filter((x) => x.d.dueDate < today);
      const next = dated.find((x) => x.d.dueDate >= today);
      if (overdue.length) add("credit-card", `${b(overdue.length)} debt${overdue.length === 1 ? " is" : "s are"} past the due date: ${overdue.map((x) => esc(x.d.name)).join(", ")}.`);
      if (next) add("credit-card", `Next debt due date: ${b(esc(next.d.name))} on ${Utils.formatDate(next.d.dueDate)}.`);
    }

    // Goals
    const goals = Goals.getAll();
    if (goals.length) {
      const s = Goals.summary(goals);
      const reached = goals.filter((g) => Calc.goalProgress(g).done).length;
      add("target", `${b(`${reached} of ${goals.length}`)} goal${goals.length === 1 ? "" : "s"} reached; overall progress ${b(s.pct + "%")} (${fmt(s.saved)} of ${fmt(s.target)}).`);
    }
    return out;
  }

  function html(limit = 0) {
    let list = compute();
    if (!list.length) return `<div class="empty-state" style="padding:var(--sp-6) var(--sp-2);"><p>Insights appear once you record transactions, investments, debts or goals.</p></div>`;
    if (limit) list = list.slice(0, limit);
    return list.map((i) => `<div class="mini-list__row"><div class="mini-list__icon">${icon(i.icon)}</div><div class="insight__text">${i.html}</div></div>`).join("");
  }

  return { compute, html };
})();
