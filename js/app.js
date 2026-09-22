/* ===== App shell: nav, theme, dashboard skeleton ===== */
const NAV_ITEMS = [
  { route: "dashboard", label: "Dashboard", icon: "grid" },
  { route: "transactions", label: "Transactions", icon: "list" },
  { route: "investments", label: "Investments", icon: "trending-up" },
  { route: "accounts", label: "Accounts", icon: "wallet" },
  { route: "assets", label: "Assets", icon: "box" },
  { route: "debts", label: "Debts", icon: "credit-card" },
  { route: "networth", label: "Net Worth", icon: "layers" },
  { route: "goals", label: "Goals", icon: "target" },
  { route: "reports", label: "Reports", icon: "bar-chart" },
  { route: "settings", label: "Settings", icon: "settings" },
];

const ICONS = {
  grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  "trending-up": '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  wallet: '<path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-4a2 2 0 0 1 0-4h4z"/>',
  box: '<path d="M21 8L12 3 3 8l9 5 9-5z"/><path d="M3 8v9l9 5 9-5V8"/><path d="M12 13v9"/>',
  "credit-card": '<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  "bar-chart": '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  "trending-down": '<path d="M23 18l-9.5-9.5-5 5L1 6"/><path d="M17 18h6v-6"/>',
  layers: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
};

function icon(name, cls = "icon") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

const App = (() => {
  function renderSidebar() {
    const navList = Utils.byId("sidebarNav");
    navList.innerHTML = NAV_ITEMS.map(
      (item) => `<button class="nav-link" data-route="${item.route}" data-label="${item.label}">${icon(item.icon)}<span>${item.label}</span></button>`
    ).join("");
    navList.addEventListener("click", (e) => {
      const btn = e.target.closest(".nav-link");
      if (btn) Router.navigate(btn.dataset.route);
    });
  }

  function renderBottomNav() {
    const primary = ["dashboard", "transactions", "investments", "accounts"];
    const more = NAV_ITEMS.filter((n) => !primary.includes(n.route));
    const list = Utils.byId("bottomNavList");
    const sheet = Utils.byId("moreSheet");
    list.innerHTML =
      primary
        .map((route) => {
          const item = NAV_ITEMS.find((n) => n.route === route);
          return `<button class="bottom-nav__item" data-route="${item.route}" data-label="${item.label}">${icon(item.icon)}<span>${item.label}</span></button>`;
        })
        .join("") +
      `<button class="bottom-nav__item" id="moreNavBtn" data-routes="${more.map((m) => m.route).join(",")}" aria-haspopup="true" aria-expanded="false">${icon("more")}<span>More</span></button>`;
    sheet.innerHTML = more
      .map((m) => `<button class="nav-link" role="menuitem" data-route="${m.route}" data-label="${m.label}">${icon(m.icon)}<span>${m.label}</span></button>`)
      .join("");

    const setSheet = (open) => {
      sheet.classList.toggle("is-open", open);
      Utils.byId("moreNavBtn").setAttribute("aria-expanded", String(open));
    };
    list.addEventListener("click", (e) => {
      const btn = e.target.closest(".bottom-nav__item");
      if (!btn) return;
      if (btn.id === "moreNavBtn") { setSheet(!sheet.classList.contains("is-open")); return; }
      setSheet(false);
      Router.navigate(btn.dataset.route);
    });
    sheet.addEventListener("click", (e) => {
      const btn = e.target.closest(".nav-link");
      if (!btn) return;
      setSheet(false);
      Router.navigate(btn.dataset.route);
    });
    document.addEventListener("click", (e) => {
      if (!sheet.contains(e.target) && !e.target.closest("#moreNavBtn")) setSheet(false);
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setSheet(false); });
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "light" || theme === "dark") root.setAttribute("data-theme", theme);
    else root.removeAttribute("data-theme");
  }

  function initTheme() {
    const settings = Utils.getSettings();
    applyTheme(settings.theme || "system");
    Utils.byId("themeToggleBtn").addEventListener("click", () => {
      const panel = Utils.byId("themeMenuPanel");
      panel.classList.toggle("is-open");
    });
    Utils.qsa("[data-theme-choice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const choice = btn.dataset.themeChoice;
        const s = Utils.getSettings();
        s.theme = choice;
        Storage.set(STORAGE_KEYS.settings, s);
        applyTheme(choice);
        Utils.byId("themeMenuPanel").classList.remove("is-open");
      });
    });
    document.addEventListener("click", (e) => {
      const menu = Utils.byId("themeMenu");
      if (menu && !menu.contains(e.target)) Utils.byId("themeMenuPanel").classList.remove("is-open");
    });
  }

  const QUICK_ACTION_TYPE = {
    Income: "income",
    Expense: "expense",
    Investment: "investment_contribution",
    Transfer: "transfer",
    "Debt Payment": "debt_payment",
    "Add Transaction": null,
  };

  function initQuickActions() {
    Utils.qsa("[data-quick-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.quickAction === "Investment") {
          Investments.openModal();
          return;
        }
        if (!Accounts.getAll().length) {
          Utils.toast("Add an account first before recording transactions.", "error");
          return;
        }
        Transactions.openModal(null, QUICK_ACTION_TYPE[btn.dataset.quickAction] || null);
      });
    });
    const fab = Utils.byId("fabAdd");
    if (fab) fab.addEventListener("click", () => {
      if (!Accounts.getAll().length) {
        Utils.toast("Add an account first before recording transactions.", "error");
        return;
      }
      Transactions.openModal();
    });
  }

  function incomeExpenseChartHTML(income, expense) {
    if (!income && !expense) return `<div class="chart-placeholder">No income or expenses recorded this month.</div>`;
    const max = Math.max(income, expense, 1), H = 160;
    const col = (v, color, label) => `<div class="bars__col"><div class="bars__pair" style="height:${H}px"><i style="height:${((v / max) * H).toFixed(1)}px;background:${color}" title="${label}: ${Utils.formatCurrency(v)}"></i></div><span class="bars__label">${label}</span></div>`;
    return `<div class="bars" style="max-width:220px;">${col(income, "var(--color-success)", "Income")}${col(expense, "var(--color-danger)", "Expense")}</div>
      <div class="chart-legend"><span><i style="background:var(--color-success)"></i>${Utils.formatCurrency(income)}</span><span><i style="background:var(--color-danger)"></i>${Utils.formatCurrency(expense)}</span></div>`;
  }

  function statCard(label, value, deltaHTML = "") {
    return `<div class="stat-card">
      <span class="stat-card__label">${label}</span>
      <span class="stat-card__value num">${value}</span>
      ${deltaHTML}
    </div>`;
  }

  function renderDashboard() {
    const s = Calc.dashboardSummary();
    const grid = Utils.byId("dashStatGrid");
    grid.innerHTML = [
      statCard("Total Balance", Utils.formatCurrency(s.totalBalance)),
      statCard("Total Income (this month)", Utils.formatCurrency(s.totalIncome)),
      statCard("Total Expense (this month)", Utils.formatCurrency(s.totalExpense)),
      statCard("Total Investment", Utils.formatCurrency(s.totalInvested)),
      statCard(
        "Investment Current Value",
        Utils.formatCurrency(s.investmentCurrent),
        `<span class="stat-card__delta ${s.investmentPL >= 0 ? "is-positive" : "is-negative"}">${s.investmentPL >= 0 ? "+" : ""}${Utils.formatCurrency(s.investmentPL)}</span>`
      ),
      statCard("Total Assets", Utils.formatCurrency(s.totalAssets)),
      statCard("Total Liabilities", Utils.formatCurrency(s.totalLiabilities)),
      statCard("Net Worth", Utils.formatCurrency(s.netWorth)),
      statCard("Savings Rate", `${s.savingsRate}%`),
    ].join("");

    Utils.byId("dashNetWorthChart").innerHTML = NetWorth.chartHTML();
    Utils.byId("dashIncomeExpenseChart").innerHTML = incomeExpenseChartHTML(s.totalIncome, s.totalExpense);
    Investments.renderAllocationChart(Investments.allocationByType(s.investments), "dashAllocationChart", "dashAllocationLegend");
    Utils.byId("dashInsights").innerHTML = Insights.html(4);

    const txList = Utils.byId("recentTransactionsList");
    const recentTx = Transactions.recentForDashboard(5);
    txList.innerHTML = recentTx.length
      ? recentTx
          .map((t) => {
            const info = Transactions.typeInfo(t.type);
            const sign = info.flow === "in" ? "amount-positive" : info.flow === "out" ? "amount-negative" : "";
            const prefix = info.flow === "in" ? "+" : info.flow === "out" ? "-" : "";
            return `<div class="mini-list__row">
              <div class="mini-list__icon">${icon(info.flow === "in" ? "trending-up" : "wallet")}</div>
              <div class="mini-list__body">
                <div class="mini-list__title">${Utils.escapeHTML(t.category)}</div>
                <div class="mini-list__meta">${Utils.formatDate(t.date, "short")} · ${info.label}</div>
              </div>
              <div class="mini-list__amount num ${sign}">${prefix}${Utils.formatCurrency(t.amount)}</div>
            </div>`;
          })
          .join("")
      : `<div class="empty-state">${icon("list", "icon")}<div class="empty-state__title">No transactions yet</div><p>Add your first income or expense to see it here.</p></div>`;

    const invList = Utils.byId("recentInvestmentsList");
    const recentInv = Investments.recentForDashboard(5);
    invList.innerHTML = recentInv.length
      ? recentInv
          .map((inv) => {
            const pl = Calc.investmentProfitLoss(inv);
            const sign = pl >= 0 ? "amount-positive" : "amount-negative";
            return `<div class="mini-list__row">
              <div class="mini-list__icon">${icon("trending-up")}</div>
              <div class="mini-list__body">
                <div class="mini-list__title">${Utils.escapeHTML(inv.name)}</div>
                <div class="mini-list__meta">${Investments.typeLabel(inv.type)}</div>
              </div>
              <div class="mini-list__amount num ${sign}">${pl >= 0 ? "+" : ""}${Utils.formatCurrency(pl)}</div>
            </div>`;
          })
          .join("")
      : `<div class="empty-state">${icon("trending-up", "icon")}<div class="empty-state__title">No investments yet</div><p>Track stocks, funds, gold, crypto and more.</p></div>`;

    Utils.byId("goalsProgressList").innerHTML = Goals.dashboardHTML();
  }

  function initRoutes() {
    Router.register("dashboard", renderDashboard);
    Router.register("transactions", () => Transactions.render());
    Router.register("investments", () => Investments.render());
    Router.register("accounts", () => Accounts.render());
    Router.register("assets", () => Assets.render());
    Router.register("debts", () => Debts.render());
    Router.register("networth", () => NetWorth.render());
    Router.register("goals", () => Goals.render());
    Router.register("reports", () => Reports.render());
    Router.register("settings", () => Settings.render());
  }

  // Called by other modules after they mutate data, so the visible view stays in sync.
  function refreshDependents() {
    NetWorth.snapshot();
    Router.refresh();
  }

  function init() {
    Storage.ensureDefaults();
    renderSidebar();
    renderBottomNav();
    initTheme();
    Accounts.init();
    Transactions.init();
    Investments.init();
    Assets.init();
    Debts.init();
    Goals.init();
    Reports.init();
    Utils.applyCurrencySymbol();
    initQuickActions();
    initRoutes();
    NetWorth.snapshot();
    Router.init();
  }

  return { init, refreshDependents };
})();

document.addEventListener("DOMContentLoaded", App.init);
