/* ===== Lightweight hash-based SPA router ===== */
const Router = (() => {
  const routes = new Map();
  let currentRoute = null;

  function register(name, handler) {
    routes.set(name, handler);
  }

  function parseHash() {
    const hash = window.location.hash.replace(/^#\/?/, "");
    return hash || "dashboard";
  }

  function navigate(routeName) {
    window.location.hash = `/${routeName}`;
  }

  function setActiveNav(routeName) {
    Utils.qsa(".nav-link").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.route === routeName);
    });
    Utils.qsa(".bottom-nav__item").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.route === routeName);
    });
    Utils.qsa("[data-routes]").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.routes.split(",").includes(routeName));
    });
    const titleEl = Utils.byId("pageTitle");
    const activeLink = Utils.qs(`.nav-link[data-route="${routeName}"]`);
    if (titleEl) titleEl.textContent = activeLink ? activeLink.dataset.label : "Dashboard";
  }

  function resolve() {
    const routeName = parseHash();
    const view = Utils.byId(`view-${routeName}`);
    if (!view || !routes.has(routeName)) {
      navigate("dashboard");
      return;
    }
    Utils.qsa(".view").forEach((v) => v.classList.remove("is-active"));
    view.classList.add("is-active");
    setActiveNav(routeName);
    currentRoute = routeName;
    const handler = routes.get(routeName);
    if (typeof handler === "function") handler();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function init() {
    window.addEventListener("hashchange", resolve);
    resolve();
  }

  function refresh() {
    const h = routes.get(currentRoute);
    if (typeof h === "function") h();
  }

  function getCurrentRoute() {
    return currentRoute;
  }

  return { register, navigate, init, refresh, getCurrentRoute };
})();
