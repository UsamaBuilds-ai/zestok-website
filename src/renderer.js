const state = {
  entries: [],
  activeTab: "dashboard"
};

const currency = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0
});

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));

const normalize = (value) => String(value || "").trim();
const keyFor = (value) => normalize(value).toLowerCase();
const formatQty = (value) => Number(value || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });
const formatRate = (value) => currency.format(Number(value || 0)).replace("PKR", "Rs");

const todayValue = () => new Date().toISOString().slice(0, 10);

const getBalances = () => {
  const items = new Map();

  for (const entry of state.entries) {
    const itemKey = keyFor(entry.item);
    const current = items.get(itemKey) || {
      item: entry.item,
      category: entry.category || "-",
      inQty: 0,
      outQty: 0,
      balance: 0,
      latestRate: 0,
      value: 0
    };

    if (entry.type === "in") {
      current.inQty += entry.quantity;
      current.latestRate = entry.rate;
    } else {
      current.outQty += entry.quantity;
    }

    current.category = entry.category || current.category;
    current.balance = current.inQty - current.outQty;
    current.value = current.balance * current.latestRate;
    items.set(itemKey, current);
  }

  return Array.from(items.values()).sort((a, b) => a.item.localeCompare(b.item));
};

const save = async () => {
  await window.stockApi.save({ entries: state.entries });
};

const setTab = (tabName) => {
  state.activeTab = tabName;
  qsa(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  qsa(".view").forEach((view) => view.classList.toggle("active", view.id === tabName));
  render();
};

const renderMetrics = (balances) => {
  const totalBalance = balances.reduce((sum, item) => sum + item.balance, 0);
  const value = balances.reduce((sum, item) => sum + item.value, 0);
  const today = todayValue();
  const todayMovement = state.entries
    .filter((entry) => entry.date === today)
    .reduce((sum, entry) => sum + (entry.type === "in" ? entry.quantity : -entry.quantity), 0);

  qs("#totalItems").textContent = balances.length;
  qs("#totalBalance").textContent = formatQty(totalBalance);
  qs("#stockValue").textContent = formatRate(value);
  qs("#todayMovement").textContent = formatQty(todayMovement);
  qs("#todaySummary").textContent = `${state.entries.length} Entries`;
};

const renderDatalist = (balances) => {
  qs("#itemOptions").innerHTML = balances
    .map((item) => `<option value="${escapeHtml(item.item)}"></option>`)
    .join("");
  
  // Populate category options, removing duplicates
  const categories = [...new Set(balances.map(item => item.category).filter(cat => cat && cat !== "-"))];
  qs("#categoryOptions").innerHTML = categories
    .map((cat) => `<option value="${escapeHtml(cat)}"></option>`)
    .join("");
};

const renderBalanceRows = (balances) => {
  const search = keyFor(qs("#dashboardSearch").value);
  const filtered = balances.filter((item) => keyFor(`${item.item} ${item.category}`).includes(search));

  qs("#balanceRows").innerHTML = filtered.length
    ? filtered
        .map(
          (item) => `
            <tr>
              <td><strong>${escapeHtml(item.item)}</strong></td>
              <td>${escapeHtml(item.category)}</td>
              <td>${formatQty(item.inQty)}</td>
              <td>${formatQty(item.outQty)}</td>
              <td><strong>${formatQty(item.balance)}</strong></td>
              <td>${formatRate(item.latestRate)}</td>
              <td>${formatRate(item.value)}</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td class="empty-row" colspan="7">No stock balance found</td></tr>`;
};

const renderRateCheck = (balances) => {
  const selected = keyFor(qs("#rateSearch").value);
  const item = balances.find((balance) => keyFor(balance.item) === selected);

  qs("#latestRate").textContent = item ? formatRate(item.latestRate) : "Rs 0";
  qs("#rateMeta").textContent = item
    ? `${item.item} balance: ${formatQty(item.balance)}`
    : "No item selected";
};

const renderReportRows = () => {
  const search = keyFor(qs("#reportSearch").value);
  const type = qs("#reportType").value;
  const rows = state.entries
    .filter((entry) => type === "all" || entry.type === type)
    .filter((entry) => keyFor(`${entry.item} ${entry.category} ${entry.note}`).includes(search))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  qs("#reportRows").innerHTML = rows.length
    ? rows
        .map(
          (entry) => `
            <tr>
              <td>${escapeHtml(entry.date)}</td>
              <td><span class="type-badge ${entry.type}">${entry.type}</span></td>
              <td><strong>${escapeHtml(entry.item)}</strong></td>
              <td>${escapeHtml(entry.category || "-")}</td>
              <td>${formatQty(entry.quantity)}</td>
              <td>${formatRate(entry.rate)}</td>
              <td>${formatRate(entry.quantity * entry.rate)}</td>
              <td>${escapeHtml(entry.note || "-")}</td>
              <td><button class="danger-btn" data-delete="${entry.id}" type="button">Delete</button></td>
            </tr>
          `
        )
        .join("")
    : `<tr><td class="empty-row" colspan="9">No report entries found</td></tr>`;
};

const getReportRows = () => {
  const search = keyFor(qs("#reportSearch").value);
  const type = qs("#reportType").value;
  return state.entries
    .filter((entry) => type === "all" || entry.type === type)
    .filter((entry) => keyFor(`${entry.item} ${entry.category} ${entry.note}`).includes(search))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

const renderReportHeading = () => {
  const search = qs("#reportSearch").value.trim();
  const type = qs("#reportType").value;
  const heading = search
    ? `Report for "${search}"`
    : type === "all"
    ? "All Stock Transactions"
    : type === "in"
    ? "Stock In Transactions"
    : "Stock Out Transactions";

  const subtitle = type === "all"
    ? "Showing all entries"
    : type === "in"
    ? "Showing stock in entries"
    : "Showing stock out entries";

  qs("#reportHeading").textContent = heading;
  qs("#reportSubtitle").textContent = subtitle;
};

const render = () => {
  const balances = getBalances();
  renderMetrics(balances);
  renderDatalist(balances);
  renderBalanceRows(balances);
  renderRateCheck(balances);
  renderReportHeading();
  renderReportRows();
};

const getItemDetails = (itemName) => {
  const balances = getBalances();
  return balances.find((item) => keyFor(item.item) === keyFor(itemName));
};

const updateEntryFormState = () => {
  const type = qs("#type").value;
  const itemName = qs("#item").value;
  const itemDetails = getItemDetails(itemName);
  const rateField = qs("#rate");
  const categoryField = qs("#category");

  if (type === "out") {
    // For Stock Out: auto-populate category and rate
    if (itemDetails) {
      categoryField.value = itemDetails.category;
      rateField.value = itemDetails.latestRate || 0;
    }
    rateField.disabled = true;
    rateField.style.opacity = "0.6";
  } else {
    // For Stock In: enable rate field
    rateField.disabled = false;
    rateField.style.opacity = "1";
  }
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const handleSubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const entry = {
    id: crypto.randomUUID(),
    date: formData.get("date"),
    type: formData.get("type"),
    item: normalize(formData.get("item")),
    category: normalize(formData.get("category")),
    quantity: Number(formData.get("quantity")),
    rate: Number(qs("#rate").value), // Get directly from field since it may be disabled
    note: normalize(formData.get("note")),
    createdAt: new Date().toISOString()
  };

  if (!entry.item || !entry.category || !entry.note || entry.quantity <= 0 || entry.rate < 0) {
    return;
  }

  state.entries.push(entry);
  await save();
  form.reset();
  qs("#date").value = todayValue();
  updateEntryFormState();
  setTab("dashboard");
};

const deleteEntry = async (id) => {
  state.entries = state.entries.filter((entry) => entry.id !== id);
  await save();
  render();
};

const exportCsv = () => {
  const headers = ["Date", "Type", "Item", "Category", "Quantity", "Rate", "Amount", "Note"];
  const rows = state.entries.map((entry) => [
    entry.date,
    entry.type,
    entry.item,
    entry.category,
    entry.quantity,
    entry.rate,
    entry.quantity * entry.rate,
    entry.note
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `stock-report-${todayValue()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const exportPdf = async () => {
  const rows = getReportRows();
  if (!rows.length) {
    alert("No report entries found to export.");
    return;
  }

  const title = qs("#reportHeading").textContent;
  const subtitle = qs("#reportSubtitle").textContent;
  const filterType = qs("#reportType").value;
  const searchValue = qs("#reportSearch").value.trim();

  try {
    const filePath = await window.stockApi.exportReportPdf({ title, subtitle, rows, filterType, searchValue });
    alert(`PDF saved to: ${filePath}`);
  } catch (error) {
    console.error("Failed to export PDF:", error);
    alert("Unable to export PDF. Check the app logs.");
  }
};

const bindEvents = () => {
  qsa(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setTab(tab.dataset.tab));
  });

  qs("#entryForm").addEventListener("submit", handleSubmit);
  qs("#resetForm").addEventListener("click", () => {
    qs("#entryForm").reset();
    qs("#date").value = todayValue();
    updateEntryFormState();
  });

  // Listen to type and item changes to update form state
  qs("#type").addEventListener("change", updateEntryFormState);
  qs("#item").addEventListener("input", updateEntryFormState);

  ["#dashboardSearch", "#rateSearch", "#reportSearch", "#reportType"].forEach((selector) => {
    qs(selector).addEventListener("input", render);
  });

  qs("#reportRows").addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete]");
    if (button) {
      deleteEntry(button.dataset.delete);
    }
  });

  qs("#exportCsv").addEventListener("click", exportCsv);
  qs("#exportPdf").addEventListener("click", exportPdf);
};

const init = async () => {
  const data = await window.stockApi.load();
  state.entries = Array.isArray(data.entries) ? data.entries : [];
  qs("#date").value = todayValue();
  bindEvents();
  render();
  updateEntryFormState();
};

init();
