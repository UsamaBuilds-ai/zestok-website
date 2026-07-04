window.onerror = (msg, url, line, col, err) => {
  console.error('Uncaught error:', err || msg);
  return true;
};
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason);
  e.preventDefault();
});

const state = {
  entries: [],
  activeTab: "dashboard",
  companyName: ""
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

let API = "http://localhost:3000/api";
let _currentPin = null;
let _deviceToken = null;
let _unlock;
let _prevServerOk = false;
let _dirty = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let splashGen = 0;

const runSplash = async (configured, companyName) => {
  const el = qs("#pinSplashText");
  if (!el) return;
  const gen = ++splashGen;
  el.innerHTML = "";

  const companyEl = qs("#pinSplashCompany");
  if (companyEl) {
    companyEl.textContent = companyName || "";
  }

  const line1 = "Welcome!";
  for (let c = 0; c < line1.length; c++) {
    if (splashGen !== gen) return;
    el.innerHTML += line1[c];
    await sleep(25);
  }
  await sleep(400);
  if (splashGen !== gen) return;

  el.innerHTML += "<br>";
  const line2 = companyName ? `This is ${companyName}` : "This is Stock Management App";
  for (let c = 0; c < line2.length; c++) {
    if (splashGen !== gen) return;
    el.innerHTML += line2[c];
    await sleep(25);
  }
  await sleep(400);
  if (splashGen !== gen) return;

  el.innerHTML += "<br>";
  const line3 = configured ? "Enter your PIN to Continue\u2026" : "Create a NEW PIN to Continue\u2026";
  for (let c = 0; c < line3.length; c++) {
    if (splashGen !== gen) return;
    el.innerHTML += line3[c];
    await sleep(25);
  }
};

const showPinGate = () => {
  qs("#pinGate").style.display = "flex";

  qs("#pinSetup").classList.add("hidden");
  qs("#pinLogin").classList.add("hidden");
  qs("#totpSetup").classList.add("hidden");

  let gateTimer = setTimeout(() => {
    qs("#pinLogin").classList.remove("hidden");
    qs("#pinGateTitle").textContent = "Enter your PIN";
    qs("#loginPin").focus();
  }, 8000);

  const showForm = (configured) => {
    clearTimeout(gateTimer);
    const show = configured ? "pinLogin" : "pinSetup";
    qs(`#${show}`).classList.remove("hidden");
    qs("#pinGateTitle").textContent = configured ? "Enter your PIN" : "Set up your PIN";
    qs(`#${show === "pinLogin" ? "loginPin" : "setupPin"}`).focus();
  };

  const pollStatus = async (retries) => {
    for (let i = 0; i < retries; i++) {
      try {
        const r = await fetch(`${API}/pin/status`);
        if (r.ok) {
          const d = await r.json();
          return { configured: d.configured, companyName: d.company_name || "" };
        }
      } catch {}
      await new Promise(r => setTimeout(r, 1000));
    }
    const local = await window.stockApi.checkPinStatus().catch(() => ({ configured: false }));
    return { configured: local.configured, companyName: "" };
  };

  const statusPromise = pollStatus(3);

  Promise.all([statusPromise]).then(([status]) => {
    state.companyName = status.companyName || state.companyName;
    showForm(status.configured);
    runSplash(status.configured, state.companyName);
  });

  qs("#pinSetupBtn").onclick = handlePinSetup;
  qs("#pinLoginBtn").onclick = handlePinLogin;
  qs("#loginPin").onkeydown = (e) => { if (e.key === "Enter") handlePinLogin(); };
  qs("#setupPinConfirm").onkeydown = (e) => { if (e.key === "Enter") handlePinSetup(); };

  return new Promise((r) => { _unlock = r; });
};

const showTotpForm = async () => {
  qs("#pinLogin").classList.add("hidden");
  qs("#pinSetup").classList.add("hidden");
  qs("#totpSetup").classList.remove("hidden");
  qs("#pinGateTitle").textContent = "Verify Your Device";
  qs("#totpCode").focus();

  return new Promise((resolve, reject) => {
    qs("#totpVerifyBtn").onclick = async () => {
      const code = qs("#totpCode").value.trim();
      const msg = qs("#totpMsg");
      if (!code) { msg.textContent = "Enter verification code from Google Authenticator"; return; }

      msg.textContent = "";
      try {
        const res = await fetch(`${API}/auth/totp-verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-access-pin": _currentPin
          },
          body: JSON.stringify({ code, deviceName: `Laptop-${Math.random().toString(36).slice(2, 8)}` })
        });
        if (res.ok) {
          const data = await res.json();
          _deviceToken = data.deviceToken;
          await window.stockApi.saveConfig({ deviceToken: data.deviceToken });
          state.companyName = data.company_name || state.companyName;
          resolve(true);
        } else {
          const err = await res.json().catch(() => ({}));
          msg.textContent = err.error || "Verification failed";
        }
      } catch (e) {
        msg.textContent = "Server not reachable";
      }
    };
    qs("#totpCode").onkeydown = (e) => {
      if (e.key === "Enter") qs("#totpVerifyBtn").click();
    };
    qs("#totpCancelBtn").onclick = () => {
      qs("#totpSetup").classList.add("hidden");
      qs("#pinLogin").classList.remove("hidden");
      qs("#pinGateTitle").textContent = "Enter your PIN";
      resolve(false);
    };
  });
};

const showTotpSetup = async (qrCodeDataUrl) => {
  qs("#pinSetup").classList.add("hidden");
  qs("#pinLogin").classList.add("hidden");
  qs("#totpSetup").classList.remove("hidden");
  qs("#totpCode").value = "";
  qs("#totpMsg").textContent = "";
  qs("#pinGateTitle").textContent = "Set Up 2-Step Verification";

  const qrImg = qs("#totpQrCode");
  if (qrImg) {
    qrImg.src = qrCodeDataUrl;
    qrImg.style.display = "block";
  }

  const manualSection = qs("#totpManual");
  if (manualSection) manualSection.style.display = "none";

  qs("#totpCode").focus();
};

const handlePinSetup = async () => {
  const pin = qs("#setupPin").value;
  const confirm = qs("#setupPinConfirm").value;
  const msg = qs("#pinSetupMsg");

  if (!pin || pin.length < 4) { msg.textContent = "PIN must be at least 4 digits"; return; }
  if (pin !== confirm) { msg.textContent = "PINs do not match"; return; }

  msg.textContent = "";
  try {
    const res = await fetch(`${API}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, company_name: state.companyName })
    });
    if (res.status === 409) {
      qs("#pinSetup").classList.add("hidden");
      qs("#pinLogin").classList.remove("hidden");
      qs("#pinGateTitle").textContent = "Enter your PIN";
      qs("#pinLoginMsg").textContent = "PIN already exists — enter it to sign in";
      qs("#loginPin").focus();
      qs("#setupPin").value = "";
      qs("#setupPinConfirm").value = "";
      return;
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      msg.textContent = errData.message || "Failed to save PIN";
      return;
    }
    const data = await res.json();
    state.companyName = data.company_name || state.companyName;
    _currentPin = pin;

    if (data.totpQrCode) {
      await showTotpSetup(data.totpQrCode);

      qs("#totpVerifyBtn").onclick = async () => {
        const code = qs("#totpCode").value.trim();
        const tmsg = qs("#totpMsg");
        if (!code) { tmsg.textContent = "Enter the 6-digit code from Google Authenticator"; return; }
        tmsg.textContent = "";
        try {
          const tres = await fetch(`${API}/auth/totp-verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-access-pin": _currentPin
            },
            body: JSON.stringify({ code, deviceName: `Laptop-${Math.random().toString(36).slice(2, 8)}` })
          });
          if (tres.ok) {
            const tdata = await tres.json();
            _deviceToken = tdata.deviceToken;
            await window.stockApi.saveConfig({ deviceToken: tdata.deviceToken });
            await window.stockApi.savePinLocal({ pin, company_name: state.companyName, tenant_id: data.tenant_id });
            unlockApp();
          } else {
            const terr = await tres.json().catch(() => ({}));
            tmsg.textContent = terr.error || "Invalid code";
          }
        } catch (e) {
          tmsg.textContent = "Server not reachable";
        }
      };
      qs("#totpCode").onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          qs("#totpVerifyBtn").click();
        }
      };
      return;
    }

    _currentPin = pin;
    await window.stockApi.savePinLocal({ pin, company_name: state.companyName, tenant_id: data.tenant_id });
    unlockApp();
  } catch (e) {
    await window.stockApi.savePinLocal({ pin, company_name: state.companyName });
    _currentPin = pin;
    unlockApp();
  }
};

const handlePinLogin = async () => {
  const pin = qs("#loginPin").value;
  const msg = qs("#pinLoginMsg");

  if (!pin) { msg.textContent = "Please enter your PIN"; return; }

  msg.textContent = "";
  try {
    const cfg = await window.stockApi.getConfig();
    _deviceToken = cfg?.deviceToken || null;

    const headers = { "x-access-pin": pin };
    if (_deviceToken) {
      headers["x-device-token"] = _deviceToken;
    }

    const res = await fetch(`${API}/pin/verify`, { headers });
    if (res.ok) {
      const data = await res.json();
      state.companyName = data.company_name || "";

      if (data.totpRequired) {
        _currentPin = pin;
        const totpResult = await showTotpForm();
        if (totpResult) {
          await window.stockApi.savePinLocal({ pin, company_name: state.companyName, tenant_id: data.tenant_id });
          unlockApp();
        }
        return;
      }

      _currentPin = pin;
      await window.stockApi.savePinLocal({ pin, company_name: state.companyName, tenant_id: data.tenant_id });
      unlockApp();
      return;
    }

    const local = await window.stockApi.verifyPin(pin);
    if (local && local.valid) {
      _currentPin = pin;
      unlockApp();
      return;
    }
    const localStatus = await window.stockApi.checkPinStatus();
    if (!localStatus.configured) {
      msg.textContent = "No PIN configured and server unavailable";
    } else {
      msg.textContent = "Invalid PIN";
    }
    qs("#loginPin").value = "";
  } catch (e) {
    const local = await window.stockApi.verifyPin(pin);
    if (local && local.valid) {
      _currentPin = pin;
      unlockApp();
      return;
    }
    msg.textContent = "Server not connected";
  }
};

const unlockApp = () => {
  qs("#pinGate").style.display = "none";
  qs("#appShell").style.display = "grid";

  const headerName = qs("#headerCompanyName");
  if (headerName) {
    headerName.textContent = state.companyName ? `|| ${state.companyName}` : "";
  }

  _unlock();
};

const setDot = (id, status, label) => {
  const el = qs(id);
  if (!el) return;
  el.classList.remove("connected", "stopped", "warning");
  el.classList.add(status);
  if (label !== undefined) {
    const labelEl = el.querySelector(".status-label");
    if (labelEl) labelEl.textContent = label;
  }
};

const updateStatus = async () => {
  let serverOk = false;
  try {
    const res = await fetch(`${API}/health`);
    const data = await res.json();
    serverOk = data.status === "ok";
    setDot("#serverStatus", serverOk ? "connected" : "stopped", serverOk ? "Server Running" : "Server Stopped");
  } catch {
    setDot("#serverStatus", "stopped", "Server Stopped");
  }

  if (serverOk && !_prevServerOk && _dirty) {
    _dirty = false;
    try {
      const headers = { "Content-Type": "application/json", "x-access-pin": _currentPin };
      if (_deviceToken) headers["x-device-token"] = _deviceToken;
      await fetch(`${API}/entries`, {
        method: "POST",
        headers,
        body: JSON.stringify({ entries: state.entries })
      });
    } catch {}
  }
  _prevServerOk = serverOk;

  try {
    const res = await fetch(`${API}/pin/status`);
    if (res.ok) {
      const data = await res.json();
      setDot("#pinStatus", data.configured ? "connected" : "warning", data.configured ? "PIN Active" : "PIN Not Set");
    } else {
      throw new Error('PIN status failed');
    }
  } catch {
    const local = await window.stockApi.checkPinStatus();
    setDot("#pinStatus", local.configured ? "connected" : "warning", local.configured ? "PIN Active" : "PIN Not Set");
  }

  setDot("#sessionStatus", "connected", "Session Active");
};

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
  _dirty = true;
  try {
    const headers = { "Content-Type": "application/json", "x-access-pin": _currentPin };
    if (_deviceToken) headers["x-device-token"] = _deviceToken;
    const res = await fetch(`${API}/entries`, {
      method: "POST",
      headers,
      body: JSON.stringify({ entries: state.entries })
    });
    if (res.ok) _dirty = false;
  } catch {}
};

window.__saveBeforeQuit = async () => {
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
    if (itemDetails) {
      categoryField.value = itemDetails.category;
      rateField.value = itemDetails.latestRate || 0;
    }
    rateField.disabled = true;
    rateField.style.opacity = "0.6";
  } else {
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
    rate: Number(qs("#rate").value),
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
  setTab(state.activeTab);
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

const setupUpdater = () => {
  const banner = document.getElementById("updateBanner");
  const message = document.getElementById("updateMessage");
  const progress = document.getElementById("updateProgress");
  const downloadBtn = document.getElementById("updateDownloadBtn");
  const installBtn = document.getElementById("updateInstallBtn");
  const dismissBtn = document.getElementById("updateDismissBtn");

  const show = (show = true) => banner.classList.toggle("hidden", !show);

  window.stockApi.onUpdateChecking(() => {
    message.textContent = "Checking for updates\u2026";
    progress.classList.add("hidden");
    downloadBtn.style.display = "none";
    installBtn.style.display = "none";
    show(true);
  });

  window.stockApi.onUpdateAvailable((info) => {
    message.textContent = `New version ${info.version} available`;
    progress.classList.add("hidden");
    downloadBtn.style.display = "";
    installBtn.style.display = "none";
    show(true);
  });

  window.stockApi.onUpdateNotAvailable(() => {
    show(false);
  });

  window.stockApi.onUpdateDownloadProgress((p) => {
    message.textContent = "Downloading update\u2026";
    progress.classList.remove("hidden");
    progress.textContent = `${Math.round(p.percent)}%`;
    downloadBtn.style.display = "none";
    installBtn.style.display = "none";
    show(true);
  });

  window.stockApi.onUpdateDownloaded(() => {
    message.textContent = "Update downloaded";
    progress.classList.add("hidden");
    downloadBtn.style.display = "none";
    installBtn.style.display = "";
    show(true);
  });

  window.stockApi.onUpdateError((err) => {
    message.textContent = `Update failed: ${err}`;
    progress.classList.add("hidden");
    downloadBtn.style.display = "none";
    installBtn.style.display = "none";
    show(true);
    setTimeout(() => show(false), 6000);
  });

  downloadBtn.addEventListener("click", () => window.stockApi.downloadUpdate());
  installBtn.addEventListener("click", () => window.stockApi.installUpdate());
  dismissBtn.addEventListener("click", () => show(false));

  window.stockApi.checkForUpdates();
};

const init = async () => {
  try {
    const cfg = await window.stockApi.getConfig();
    API = cfg?.apiUrl || await window.stockApi.getApiUrl() || "http://localhost:3000/api";
    _deviceToken = cfg?.deviceToken || null;

    await showPinGate();

    try {
      const headers = { "x-access-pin": _currentPin };
      if (_deviceToken) headers["x-device-token"] = _deviceToken;
      const res = await fetch(`${API}/entries`, { headers });
      if (res.ok) {
        const data = await res.json();
        state.entries = Array.isArray(data.entries) ? data.entries : [];
      } else {
        throw new Error("API entries unavailable");
      }
    } catch {
      const data = await window.stockApi.load();
      state.entries = Array.isArray(data.entries) ? data.entries : [];
      _dirty = true;
    }

    qs("#date").value = todayValue();
    qs("#appVersion").textContent = await window.stockApi.getVersion();
    setupUpdater();
    bindEvents();
    render();
    updateEntryFormState();
    updateStatus();
    setInterval(updateStatus, 30000);
  } catch (err) {
    console.error("Initialization error:", err);
    document.body.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:12px;text-align:center;padding:40px;">' +
      '<h2 style="color:#f59e0b;margin:0;">Something went wrong</h2>' +
      '<p style="color:#94a3b8;margin:0;">Please restart the application.</p>' +
      '<pre style="color:#64748b;font-size:12px;margin-top:8px;">' +
      (err.message || "Unknown error") +
      "</pre></div>";
  }
};

init();
