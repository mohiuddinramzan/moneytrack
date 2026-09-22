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

  function dashboardSummary() {
    const { accounts, transactions, investments, assets, debts, goals } = getAll();
    const totalBalance = Utils.round2(accounts.reduce((s, a) => s + (Number(a.currentBalance) || 0), 0));

    const monthKey = Utils.todayISO().slice(0, 7);
    const { income: totalIncome, expense: totalExpense } = totalsForMonth(transactions, monthKey);

    const totalInvested = Utils.round2(investments.reduce((s, i) => s + (Number(i.investedAmount) || 0), 0));
    const investmentCurrent = Utils.round2(investments.reduce((s, i) => s + investmentCurrentValue(i), 0));
    const investmentPL = Utils.round2(investmentCurrent - totalInvested - investments.reduce((s, i) => s + (Number(i.fees) || 0), 0));

    const totalAssets = Utils.round2(assets.reduce((s, a) => s + (Number(a.currentValue) || 0), 0));
    const totalLiabilities = Utils.round2(debts.reduce((s, d) => s + (Number(d.remainingAmount) || 0), 0));

    const netWorth = Utils.round2(totalAssets + totalBalance + investmentCurrent - totalLiabilities);
    const savingsRate = totalIncome > 0 ? Utils.round2(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

    return {
      totalBalance, totalIncome, totalExpense, totalInvested, investmentCurrent, investmentPL,
      totalAssets, totalLiabilities, netWorth, savingsRate,
      accounts, transactions, investments, assets, debts, goals,
    };
  }

  return {
    getAll, investmentCurrentValue, investmentProfitLoss, investmentROI, totalsForMonth, dashboardSummary,
    transactionAccountEffects, recalculateAccountBalances,
  };
})();
