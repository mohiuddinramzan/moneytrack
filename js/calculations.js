/* ===== Derived financial calculations ===== */
const Calc = (() => {
  function getAll() {
    return {
      accounts: Storage.get(STORAGE_KEYS.accounts, []),
      transactions: Storage.get(STORAGE_KEYS.transactions, []),
      investments: Storage.get(STORAGE_KEYS.investments, []),
      assets: Storage.get(STORAGE_KEYS.assets, []),
      debts: Storage.get(STORAGE_KEYS.debts, []),
      goals: Storage.get(STORAGE_KEYS.goals, []),
    };
  }

  function investmentCurrentValue(inv) {
    return Utils.round2((Number(inv.quantity) || 0) * (Number(inv.currentPrice) || 0));
  }
  function investmentProfitLoss(inv) {
    const cv = investmentCurrentValue(inv);
    return Utils.round2(cv - (Number(inv.investedAmount) || 0) - (Number(inv.fees) || 0));
  }
  function investmentROI(inv) {
    const invested = Number(inv.investedAmount) || 0;
    if (invested === 0) return 0;
    return Utils.round2((investmentProfitLoss(inv) / invested) * 100);
  }

  // Paid = amount paid before tracking (paidBase) + debt_payment transactions linked to the debt.
  function debtPaid(d, txs) {
    const linked = txs.reduce((s, t) => s + (t.type === "debt_payment" && t.debtId === d.id ? Number(t.amount) || 0 : 0), 0);
    return Utils.round2((Number(d.paidBase) || 0) + linked);
  }
  function debtRemaining(d, txs) {
    return Math.max(0, Utils.round2((Number(d.originalAmount) || 0) - debtPaid(d, txs)));
  }

  // Income = income/dividend/interest; expense = expense. Transfers, debt payments and
  // investment contributions are excluded (they move money, they aren't spending).
  function totalsForRange(transactions, from, to) {
    let income = 0, expense = 0;
    const cats = {};
    transactions.forEach((t) => {
      if (!t.date || t.date < from || t.date > to) return;
      const amt = Number(t.amount) || 0;
      if (t.type === "income" || t.type === "dividend" || t.type === "interest") income += amt;
      else if (t.type === "expense") {
        expense += amt;
        const c = (t.category || "Uncategorized").trim() || "Uncategorized";
        cats[c] = (cats[c] || 0) + amt;
      }
    });
    return {
      income: Utils.round2(income), expense: Utils.round2(expense),
      categories: Object.entries(cats).map(([name, value]) => ({ name, value: Utils.round2(value) })).sort((a, b) => b.value - a.value),
    };
  }

  function goalProgress(g) {
    const target = Number(g.targetAmount) || 0, saved = Number(g.savedAmount) || 0;
    const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    return { target, saved, pct, remaining: Math.max(0, Utils.round2(target - saved)), done: target > 0 && saved >= target };
  }

  function totalsForMonth(transactions, monthKey) {
    let income = 0, expense = 0;
    transactions.forEach((t) => {
      if (!t.date || !t.date.startsWith(monthKey)) return;
      if (t.type === "transfer") return;
      if (t.type === "income" || t.type === "dividend" || t.type === "interest") income += Number(t.amount) || 0;
      else if (t.type === "expense") expense += Number(t.amount) || 0;
    });
    return { income: Utils.round2(income), expense: Utils.round2(expense) };
  }

  // Returns a map of { accountId: balanceDelta } for a single transaction.
  function transactionAccountEffects(t) {
    const amount = Number(t.amount) || 0;
    const effects = {};
    const add = (accId, delta) => {
      if (!accId) return;
      effects[accId] = (effects[accId] || 0) + delta;
    };
    switch (t.type) {
      case "income":
      case "withdrawal":
      case "dividend":
      case "interest":
        add(t.accountId, amount);
        break;
      case "expense":
      case "investment_contribution":
      case "debt_payment":
        add(t.accountId, -amount);
        break;
      case "transfer":
        add(t.accountId, -amount);
        add(t.toAccountId, amount);
        break;
      default:
        break; // "other" does not move money by default
    }
    return effects;
  }

  function recalculateAccountBalances(accounts, transactions) {
    const totals = {};
    transactions.forEach((t) => {
      const effects = transactionAccountEffects(t);
      Object.entries(effects).forEach(([accId, delta]) => {
        totals[accId] = (totals[accId] || 0) + delta;
      });
    });
    return accounts.map((a) => ({
      ...a,
      currentBalance: Utils.round2((Number(a.openingBalance) || 0) + (totals[a.id] || 0)),
    }));
  }

  // Single source of truth for net worth. Each thing is counted once:
  // account balances + other assets + investment current value - remaining debt.
  // (Money moved into an investment already left the account, so no overlap.)
  function netWorthBreakdown(data = getAll()) {
    const { accounts, transactions, investments, assets, debts } = data;
    const sum = (arr, fn) => Utils.round2(arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0));
    const accountsTotal = sum(recalculateAccountBalances(accounts, transactions), (a) => a.currentBalance);
    const otherAssets = sum(assets, (a) => a.currentValue);
    const investmentsValue = sum(investments, investmentCurrentValue);
    const liabilities = sum(debts, (d) => debtRemaining(d, transactions));
    const totalAssets = Utils.round2(accountsTotal + otherAssets + investmentsValue);
    return {
      accounts: accountsTotal, otherAssets, investments: investmentsValue, totalAssets, liabilities,
      netWorth: Utils.round2(totalAssets - liabilities),
      counts: { accounts: accounts.length, assets: assets.length, investments: investments.length, debts: debts.length },
    };
  }

  function dashboardSummary() {
    const data = getAll();
    const { transactions, investments } = data;
    const nw = netWorthBreakdown(data);
    const { income: totalIncome, expense: totalExpense } = totalsForMonth(transactions, Utils.todayISO().slice(0, 7));
    const totalInvested = Utils.round2(investments.reduce((s, i) => s + (Number(i.investedAmount) || 0), 0));
    const investmentPL = Utils.round2(nw.investments - totalInvested - investments.reduce((s, i) => s + (Number(i.fees) || 0), 0));
    const savingsRate = totalIncome > 0 ? Utils.round2(((totalIncome - totalExpense) / totalIncome) * 100) : 0;
    return {
      totalBalance: nw.accounts, totalIncome, totalExpense, totalInvested, investmentCurrent: nw.investments, investmentPL,
      totalAssets: nw.totalAssets, otherAssets: nw.otherAssets, totalLiabilities: nw.liabilities, netWorth: nw.netWorth, savingsRate,
      ...data,
    };
  }

  return {
    getAll, investmentCurrentValue, investmentProfitLoss, investmentROI, debtPaid, debtRemaining, goalProgress, totalsForRange, totalsForMonth, netWorthBreakdown, dashboardSummary,
    transactionAccountEffects, recalculateAccountBalances,
  };
})();
