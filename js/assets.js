/* ===== Assets module ===== */
const ASSET_CATEGORIES = [
  { value: "property", label: "Property" },
  { value: "vehicle", label: "Vehicle" },
  { value: "gold", label: "Gold" },
  { value: "business", label: "Business" },
  { value: "electronics", label: "Electronics" },
  { value: "other", label: "Other" },
];

const Assets = (() => {
  let editingId = null;
  const filters = { search: "", category: "" };
  const $ = Utils.byId;

  const catLabel = (v) => (ASSET_CATEGORIES.find((c) => c.value === v) || {}).label || v;
  const getAll = () => Storage.get(STORAGE_KEYS.assets, []);
  const getById = (id) => getAll().find((a) => a.id === id) || null;
  const change = (a) => Utils.round2((Number(a.currentValue) || 0) - (Number(a.purchaseValue) || 0));
  const changePct = (a) => (Number(a.purchaseValue) > 0 ? Utils.round2((change(a) / Number(a.purchaseValue)) * 100) : 0);
  const signed = (n) => (n >= 0 ? "+" : "") + Utils.formatCurrency(n);

  function openModal(id = null) {
    editingId = id;
    const a = id ? getById(id) : null;
    $("assetModalTitle").textContent = a ? "Edit Asset" : "Add Asset";
    $("assetForm").reset();
    $("assetId").value = a ? a.id : "";
    $("assetCategory").innerHTML = ASSET_CATEGORIES.map((c) => `<option value="${c.value}" ${a && a.category === c.value ? "selected" : ""}>${c.label}</option>`).join("");
    $("assetName").value = a ? a.name : "";
    $("assetPurchaseValue").value = a ? a.purchaseValue : "";
    $("assetCurrentValue").value = a ? a.currentValue : "";
    $("assetPurchaseDate").value = a ? a.purchaseDate || "" : "";
    $("assetNotes").value = a ? a.notes || "" : "";
    Utils.qsa(".form-control", $("assetForm")).forEach((e) => e.classList.remove("is-invalid"));
    $("assetModalBackdrop").classList.add("is-open");
    $("assetName").focus();
  }

  function closeModal() {
    $("assetModalBackdrop").classList.remove("is-open");
    editingId = null;
  }

  function validate() {
    let valid = true;
    const mark = (el, ok) => { el.classList.toggle("is-invalid", !ok); valid = valid && ok; };
    const money = (el) => el.value !== "" && Number(el.value) >= 0;
    mark($("assetName"), !!$("assetName").value.trim());
    mark($("assetPurchaseValue"), money($("assetPurchaseValue")));
    mark($("assetCurrentValue"), money($("assetCurrentValue")));
    return valid;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    const record = {
      name: $("assetName").value.trim(),
      category: $("assetCategory").value,
      purchaseValue: Utils.round2(Number($("assetPurchaseValue").value)),
      currentValue: Utils.round2(Number($("assetCurrentValue").value)),
      purchaseDate: $("assetPurchaseDate").value,
      notes: $("assetNotes").value.trim(),
    };
    const list = getAll();
    const wasEditing = !!editingId;
    if (wasEditing) {
      const idx = list.findIndex((a) => a.id === editingId);
      if (idx > -1) list[idx] = { ...list[idx], ...record, updatedAt: Utils.nowISO() };
    } else {
      list.push({ id: Utils.generateId("asset"), ...record, createdAt: Utils.nowISO(), updatedAt: Utils.nowISO() });
    }
    Storage.set(STORAGE_KEYS.assets, list);
    closeModal();
    Utils.toast(wasEditing ? "Asset updated." : "Asset added.", "success");
    App.refreshDependents();
  }

  async function handleDelete(id) {
    const ok = await Utils.confirmDialog({
      title: "Delete asset?",
      message: "This asset will be permanently removed and no longer counted in net worth.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    Storage.set(STORAGE_KEYS.assets, getAll().filter((a) => a.id !== id));
    Utils.toast("Asset deleted.", "success");
    App.refreshDependents();
  }

  function applyFilters(list) {
    const q = filters.search.trim().toLowerCase();
    return list
      .filter((a) => !filters.category || a.category === filters.category)
      .filter((a) => !q || (a.name || "").toLowerCase().includes(q) || (a.notes || "").toLowerCase().includes(q))
      .sort((x, y) => (Number(y.currentValue) || 0) - (Number(x.currentValue) || 0));
  }

  function summary(list = getAll()) {
    const current = Utils.round2(list.reduce((s, a) => s + (Number(a.currentValue) || 0), 0));
    const purchase = Utils.round2(list.reduce((s, a) => s + (Number(a.purchaseValue) || 0), 0));
    const diff = Utils.round2(current - purchase);
    return { current, purchase, diff, pct: purchase > 0 ? Utils.round2((diff / purchase) * 100) : 0, count: list.length };
  }

  function row(a) {
    const ch = change(a), cls = ch >= 0 ? "amount-positive" : "amount-negative";
    return `<tr>
      <td>${Utils.escapeHTML(a.name)}${a.notes ? `<div class="form-hint">${Utils.escapeHTML(a.notes)}</div>` : ""}</td>
      <td><span class="badge badge-neutral">${catLabel(a.category)}</span></td>
      <td>${Utils.formatDate(a.purchaseDate)}</td>
      <td class="num">${Utils.formatCurrency(a.purchaseValue)}</td>
      <td class="num">${Utils.formatCurrency(a.currentValue)}</td>
      <td class="num ${cls}">${signed(ch)} (${changePct(a)}%)</td>
      <td><div class="row-actions">
        <button class="btn btn-icon btn-ghost btn-sm" data-edit-asset="${a.id}" aria-label="Edit asset">${icon("edit")}</button>
        <button class="btn btn-icon btn-ghost btn-sm" data-delete-asset="${a.id}" aria-label="Delete asset">${icon("trash")}</button>
      </div></td>
    </tr>`;
  }

  function render() {
    const all = getAll();
    const list = applyFilters(all);
    const s = summary(all);
    const stat = (label, value, cls = "") => `<div class="stat-card"><span class="stat-card__label">${label}</span><span class="stat-card__value num ${cls}">${value}</span></div>`;
    $("assetStatGrid").innerHTML =
      stat("Total Asset Value", Utils.formatCurrency(s.current)) +
      stat("Total Purchase Value", Utils.formatCurrency(s.purchase)) +
      stat("Value Change", `${signed(s.diff)} (${s.pct}%)`, s.diff >= 0 ? "amount-positive" : "amount-negative") +
      stat("Assets", s.count);

    $("assetFilterCategory").innerHTML = `<option value="">All categories</option>` + ASSET_CATEGORIES.map((c) => `<option value="${c.value}">${c.label}</option>`).join("");
    $("assetFilterCategory").value = filters.category;
    $("assetSearchInput").value = filters.search;

    const empty = $("assetEmptyState"), wrap = $("assetTableWrap");
    if (!list.length) {
      wrap.style.display = "none";
      empty.style.display = "flex";
      empty.innerHTML = all.length
        ? `${icon("box")}<div class="empty-state__title">No matching assets</div><p>Try adjusting your search or filter.</p>`
        : `${icon("box")}<div class="empty-state__title">No assets yet</div><p>Add property, a vehicle, gold, a business or other things you own.</p>`;
    } else {
      empty.style.display = "none";
      wrap.style.display = "block";
      $("assetTableBody").innerHTML = list.map(row).join("");
    }
  }

  function init() {
    $("assetForm").addEventListener("submit", handleSubmit);
    $("addAssetBtn").addEventListener("click", () => openModal());
    $("assetModalCloseBtn").addEventListener("click", closeModal);
    $("assetModalCancelBtn").addEventListener("click", closeModal);
    $("assetModalBackdrop").addEventListener("click", (e) => { if (e.target === $("assetModalBackdrop")) closeModal(); });
    $("assetSearchInput").addEventListener("input", Utils.debounce((e) => { filters.search = e.target.value; render(); }, 200));
    $("assetFilterCategory").addEventListener("change", (e) => { filters.category = e.target.value; render(); });
    $("assetFilterClearBtn").addEventListener("click", () => { Object.assign(filters, { search: "", category: "" }); render(); });
    // delegated row actions (survive re-render)
    $("assetTableBody").addEventListener("click", (e) => {
      const ed = e.target.closest("[data-edit-asset]"), del = e.target.closest("[data-delete-asset]");
      if (ed) openModal(ed.dataset.editAsset);
      else if (del) handleDelete(del.dataset.deleteAsset);
    });
  }

  return { init, render, openModal, getAll, summary, catLabel };
})();
