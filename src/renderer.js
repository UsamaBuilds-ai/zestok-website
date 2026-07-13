// Named constants (replaces magic numbers)
const PIN_GATE_DELAY_MS = 8000;
const STATUS_POLL_RETRIES = 3;
const STATUS_POLL_INTERVAL_MS = 1000;
const STATUS_REFRESH_INTERVAL_MS = 30000;

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
const formatQty = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString("en-PK", { maximumFractionDigits: 2 }) : "0.00";
};
const formatRate = (value) => currency.format(Number(value || 0)).replace("PKR", "Rs");

const todayValue = () => new Date().toISOString().slice(0, 10);

let API = "http://localhost:3000";
let _currentPin = null;
let _deviceToken = null;
let _unlock;
let _dirty = false;
let _unlocked = false;
let _syncing = false;
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
  const line2 = companyName ? `This is ${companyName}` : "This is Inventory Management App";
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
  }, PIN_GATE_DELAY_MS);

  const showForm = (configured) => {
    clearTimeout(gateTimer);
    const show = configured ? "pinLogin" : "pinSetup";
    qs(`#${show}`).classList.remove("hidden");
    qs("#pinGateTitle").textContent = configured ? "Enter your PIN" : "Set up your PIN";
    if (!configured) {
      qs("#signUpCompanyName").value = state.companyName || "";
      qs("#signUpCompanyName").focus();
    } else {
      qs("#loginPin").focus();
    }
  };

  const pollStatus = async (retries) => {
    for (let i = 0; i < retries; i++) {
      try {
        const r = await fetch(`${API}/api/pin/status`);
        if (r.ok) {
          const d = await r.json();
          return { configured: d.configured, companyName: d.company_name || '' };
        }
      } catch {}
      await new Promise(r => setTimeout(r, STATUS_POLL_INTERVAL_MS));
    }
    const local = await window.stockApi.checkPinStatus().catch(() => ({ configured: false }));
    return { configured: local.configured, companyName: "" };
  };

  const statusPromise = pollStatus(STATUS_POLL_RETRIES);

  const localCompanyName = (typeof localStorage !== 'undefined' ? localStorage.getItem('zestokCompanyName') : null) || '';
  Promise.all([statusPromise]).then(([status]) => {
    state.companyName = status.companyName || localCompanyName || state.companyName;
    showForm(status.configured);
    runSplash(status.configured, state.companyName);
  });

  qs("#pinSetupBtn").onclick = handlePinSetup;
  qs("#pinLoginBtn").onclick = handlePinLogin;  qs("#loginPin").onkeydown = (e) => { if (e.key === "Enter") handlePinLogin(); };
  let _pinDebounce;
  qs("#loginPin").oninput = () => {
    if (_pinDebounce) clearTimeout(_pinDebounce);
    _pinDebounce = setTimeout(() => {
      if (qs("#loginPin").value.length >= 4) handlePinLogin();
    }, 350);
  };
  qs("#setupPinConfirm").onkeydown = (e) => { if (e.key === "Enter") handlePinSetup(); };
  qs("#pinLoginLink").onclick = (e) => { e.preventDefault(); showForm(true); };

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
        const res = await fetch(`${API}/api/auth/totp-verify`, {
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
  const companyName = qs("#signUpCompanyName").value.trim();
  if (companyName) {
    state.companyName = companyName;
    localStorage.setItem("zestokCompanyName", companyName);
  }

  if (!pin || pin.length < 4) { msg.textContent = "PIN must be at least 4 digits"; return; }
  if (pin !== confirm) { msg.textContent = "PINs do not match"; return; }

  msg.textContent = "";
  try {
    const res = await fetch(`${API}/api/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, company_name: state.companyName })
    });
    if (res.status === 409) {
      qs("#pinSetup").classList.add("hidden");
      qs("#pinLogin").classList.remove("hidden");
      qs("#pinGateTitle").textContent = "Enter your PIN";
      qs("#pinLoginMsg").textContent = "PIN already exists enter it to sign in";
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
          const tres = await fetch(`${API}/api/auth/totp-verify`, {
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
    const msg = qs("#pinSetupMsg");
    if (msg) {
      msg.textContent = "Server unreachable. Please try again when connected.";
    }
    qs("#setupPin").value = "";
    qs("#setupPinConfirm").value = "";
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

    const res = await fetch(`${API}/api/pin/verify`, { headers });
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
  if (_unlocked) return;
  _unlocked = true;
  qs("#pinGate").classList.add("fade-out");

  const headerName = qs("#headerCompanyName");
  if (headerName) {
    headerName.textContent = state.companyName ? `|| ${state.companyName}` : "";
  }

  setTimeout(() => {
    qs("#pinGate").style.display = "none";
    qs("#appShell").style.display = "grid";
    void qs("#appShell").offsetWidth;
    qs("#appShell").classList.add("unlocked");
  }, 350);
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
    const res = await fetch(`${API}/api/health`);
    serverOk = (await res.json()).status === "ok";
  } catch { serverOk = false; }

  if (serverOk && _dirty) {
    await syncToServer();
  }

  try {
    const res = await fetch(`${API}/api/pin/status`);
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
    const itemKey = `${keyFor(entry.item)}|${keyFor(entry.category || "")}`;
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

    current.balance = current.inQty - current.outQty;
    current.value = current.balance * current.latestRate;
    items.set(itemKey, current);
  }

  return Array.from(items.values()).sort((a, b) => a.item.localeCompare(b.item));
};

const syncToServer = async () => {
  if (_syncing) return;
  _syncing = true;
  try {
    const headers = { "Content-Type": "application/json", "x-access-pin": _currentPin };
    if (_deviceToken) headers["x-device-token"] = _deviceToken;
    const res = await fetch(`${API}/api/entries`, {
      method: "POST",
      headers,
      body: JSON.stringify({ entries: state.entries })
    });
    if (res.ok) _dirty = false;
  } finally {
    _syncing = false;
  }
};

const save = async () => {
  await window.stockApi.saveDataLocal({ entries: state.entries });
  _dirty = true;
  await syncToServer();
};

window.__saveBeforeQuit = async () => {
  await window.stockApi.saveDataLocal({ entries: state.entries });
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
    .reduce((sum, entry) => sum + (entry.type === "in" ? Number(entry.quantity || 0) : -Number(entry.quantity || 0)), 0);

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

const updateRateFormState = () => {
  const itemName = qs("#rateSearch").value;
  const categoryField = qs("#rateCategory");
  if (itemName) {
    const balances = getBalances();
    const matching = balances.filter(b => keyFor(b.item) === keyFor(itemName));
    const uniqueCats = [...new Set(matching.map(b => b.category).filter(c => c && c !== "-"))];
    if (uniqueCats.length === 1) {
      categoryField.value = uniqueCats[0];
      categoryField.readOnly = true;
      categoryField.style.opacity = "0.6";
    } else {
      categoryField.readOnly = false;
      categoryField.style.opacity = "1";
    }
  } else {
    categoryField.readOnly = false;
    categoryField.style.opacity = "1";
  }
};

const renderRateCheck = (balances) => {
  const selected = keyFor(qs("#rateSearch").value);
  const category = keyFor(qs("#rateCategory").value);

  if (!category) {
    qs("#latestRate").textContent = "Rs 0";
    qs("#rateMeta").textContent = selected ? "Select a category" : "No item selected";
    return;
  }

  const item = balances.find(b =>
    keyFor(b.item) === selected && keyFor(b.category) === category
  );

  qs("#latestRate").textContent = item ? formatRate(item.latestRate) : "Rs 0";
  qs("#rateMeta").textContent = item
    ? `${item.item} (${item.category}) balance: ${formatQty(item.balance)}`
    : "No data for this combination";
};

const renderReportRows = () => {
  const search = keyFor(qs("#reportSearch").value);
  const type = qs("#reportType").value;
  const rows = state.entries
    .filter((entry) => type === "all" || entry.type === type)
    .filter((entry) => keyFor(`${entry.item} ${entry.category} ${entry.note}`).includes(search))
    .slice().sort((a, b) => {
      const aDate = a.date || '1970-01-01';
      const bDate = b.date || '1970-01-01';
      const dateCmp = bDate.localeCompare(aDate);
      if (dateCmp !== 0) return dateCmp;
      const aTime = a.createdAt || '';
      const bTime = b.createdAt || '';
      return bTime.localeCompare(aTime);
    });

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
    .sort((a, b) => {
      const aDate = a.date || '1970-01-01';
      const bDate = b.date || '1970-01-01';
      const dateCmp = bDate.localeCompare(aDate);
      if (dateCmp !== 0) return dateCmp;
      const aTime = a.createdAt || '';
      const bTime = b.createdAt || '';
      return bTime.localeCompare(aTime);
    });
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
  updateRateFormState();
  renderRateCheck(balances);
  renderReportHeading();
  renderReportRows();
  renderItemPreview();
};

const renderItemPreview = () => {
  const itemName = qs("#item").value;
  const el = qs("#itemPreview");
  if (!el) return;
  if (!itemName) {
    el.innerHTML = `<p class="preview-placeholder">Type an item name to see balance</p>`;
    return;
  }
  const balances = getBalances();
  const category = qs("#category").value;
  const item = balances.find(b => keyFor(b.item) === keyFor(itemName) && keyFor(b.category) === keyFor(category));
  if (!item) {
    el.innerHTML = `<p class="preview-placeholder">No data found for "${escapeHtml(itemName)}"</p>`;
    return;
  }
  el.innerHTML = `
    <div class="preview-row">
      <span class="preview-label">Item</span>
      <span class="preview-value">${escapeHtml(item.item)}</span>
    </div>
    <div class="preview-row">
      <span class="preview-label">Category</span>
      <span class="preview-value">${escapeHtml(item.category)}</span>
    </div>
    <div class="preview-row">
      <span class="preview-label">Balance</span>
      <span class="preview-value">${formatQty(item.balance)}</span>
    </div>
    <div class="preview-row">
      <span class="preview-label">Latest Rate</span>
      <span class="preview-value">${formatRate(item.latestRate)}</span>
    </div>
    <div class="preview-row">
      <span class="preview-label">Stock Value</span>
      <span class="preview-value">${formatRate(item.value)}</span>
    </div>`;
};

const getItemDetails = (itemName, category) => {
  const balances = getBalances();
  if (category) {
    return balances.find((item) => keyFor(item.item) === keyFor(itemName) && keyFor(item.category) === keyFor(category));
  }
  return null;
};

const updateEntryFormState = () => {
  const type = qs("#type").value;
  const itemName = qs("#item").value;
  const rateField = qs("#rate");
  const categoryField = qs("#category");

  if (itemName) {
    const balances = getBalances();
    const matching = balances.filter(b => keyFor(b.item) === keyFor(itemName));
    const uniqueCats = [...new Set(matching.map(b => b.category).filter(c => c && c !== "-"))];
    if (uniqueCats.length === 1) {
      categoryField.value = uniqueCats[0];
      categoryField.readOnly = true;
      categoryField.style.opacity = "0.6";
    } else {
      categoryField.readOnly = false;
      categoryField.style.opacity = "1";
    }
  } else {
    categoryField.readOnly = false;
    categoryField.style.opacity = "1";
  }

  const itemDetails = itemName && categoryField.value ? getItemDetails(itemName, categoryField.value) : null;

  if (type === "out") {
    if (itemDetails) {
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

let _ddSkip = false;

const renderDD = (listId, filter, getItems, state) => {
  const el = qs(listId);
  if (!el) return;
  let items = getItems();
  if (filter) {
    const key = keyFor(filter);
    items = items.filter(i => keyFor(i).includes(key));
  }
  if (!items.length) {
    el.innerHTML = '<div class="dropdown-item empty">No items found</div>';
    el.classList.add("open");
    state.index = -1;
    return;
  }
  el.innerHTML = items.map((item, i) =>
    `<div class="dropdown-item${i === state.index ? " active" : ""}" data-value="${escapeHtml(item)}">${escapeHtml(item)}</div>`
  ).join("");
  el.classList.add("open");
};

const showDD = (inputId, listId, showAll, getItems, state) => {
  if (_ddSkip) return;
  const input = qs(inputId);
  renderDD(listId, showAll ? "" : input.value, getItems, state);
};

const hideDD = (listId, state) => {
  const el = qs(listId);
  if (el) el.classList.remove("open");
  state.index = -1;
};

const selectDD = (inputId, listId, value, state) => {
  _ddSkip = true;
  qs(inputId).value = value;
  hideDD(listId, state);
  qs(inputId).dispatchEvent(new Event("input", { bubbles: true }));
  _ddSkip = false;
};

const handleDDKeydown = (e, listId, inputId, getItems, state) => {
  const items = qs(listId).querySelectorAll(".dropdown-item:not(.empty)");
  if (!items.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    state.index = Math.min(state.index + 1, items.length - 1);
    renderDD(listId, keyFor(qs(inputId).value), getItems, state);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    state.index = Math.max(state.index - 1, 0);
    renderDD(listId, keyFor(qs(inputId).value), getItems, state);
  } else if (e.key === "Enter" && state.index >= 0) {
    e.preventDefault();
    selectDD(inputId, listId, items[state.index].dataset.value, state);
  } else if (e.key === "Escape") {
    hideDD(listId, state);
  }
};

const bindDD = (inputId, listId, getItems) => {
  const state = { index: -1 };
  qs(inputId).addEventListener("input", () => showDD(inputId, listId, false, getItems, state));
  qs(inputId).addEventListener("focus", () => showDD(inputId, listId, true, getItems, state));
  qs(inputId).addEventListener("blur", () => setTimeout(() => hideDD(listId, state), 150));
  qs(inputId).addEventListener("keydown", (e) => handleDDKeydown(e, listId, inputId, getItems, state));
  qs(listId).addEventListener("mousedown", (e) => {
    const item = e.target.closest(".dropdown-item:not(.empty)");
    if (item) selectDD(inputId, listId, item.dataset.value, state);
  });
};

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
  qs("#item").focus();
};

const deleteEntry = async (id) => {
  state.entries = state.entries.filter((entry) => entry.id !== id);
  await save();
  render();
};

const exportCsv = () => {
  const rows = getReportRows();
  if (!rows.length) {
    alert("No report entries found to export.");
    return;
  }

  const totalAmount = rows.reduce((sum, entry) => {
    const qty = Number(entry.quantity) || 0;
    const rate = Number(entry.rate) || 0;
    return sum + qty * rate;
  }, 0);

  const headers = ["Date", "Type", "Item", "Category", "Quantity", "Rate", "Amount", "Note"];
  const dataRows = rows.map((entry) => [
    entry.date,
    entry.type,
    entry.item,
    entry.category || "-",
    formatQty(entry.quantity),
    formatRate(entry.rate),
    formatRate(entry.quantity * entry.rate),
    entry.note || "-"
  ]);
  const totalRow = ["", "", "Total", "", "", "", formatRate(totalAmount), ""];

  const csv = [headers, ...dataRows, totalRow]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filterType = qs("#reportType").value;
  const searchValue = qs("#reportSearch").value.trim();
  const label = searchValue ? searchValue.replace(/\s+/g, '-') : (filterType !== "all" ? filterType : "all");
  link.href = url;
  link.download = `zestok-report-${label}-${todayValue()}.csv`;
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
  const totalAmount = rows.reduce((sum, entry) => {
    const qty = Number(entry.quantity) || 0;
    const rate = Number(entry.rate) || 0;
    return sum + qty * rate;
  }, 0);

  try {
    const filePath = await window.stockApi.exportReportPdf({ title, subtitle, rows, filterType, searchValue, totalAmount });
    if (filePath) {
      alert(`PDF saved to: ${filePath}`);
    }
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
  qs("#item").addEventListener("input", () => {
    updateEntryFormState();
    renderItemPreview();
  });
  qs("#category").addEventListener("input", () => {
    updateEntryFormState();
    renderItemPreview();
  });

  bindDD("#item", "#itemDropdown", () => [...new Set(getBalances().map(b => b.item))].sort());
  bindDD("#category", "#categoryDropdown", () => {
    const selectedItem = keyFor(qs("#item").value);
    if (!selectedItem) {
      return [...new Set(getBalances().map(b => b.category).filter(c => c && c !== "-"))].sort();
    }
    return [...new Set(
      getBalances()
        .filter(b => keyFor(b.item) === selectedItem)
        .map(b => b.category)
        .filter(c => c && c !== "-")
    )].sort();
  });
  bindDD("#rateSearch", "#rateSearchDropdown", () => [...new Set(getBalances().map(b => b.item))].sort());
  bindDD("#rateCategory", "#rateCategoryDropdown", () => {
    const selectedItem = keyFor(qs("#rateSearch").value);
    if (!selectedItem) return [];
    return [...new Set(
      getBalances()
        .filter(b => keyFor(b.item) === selectedItem)
        .map(b => b.category)
        .filter(c => c && c !== "-")
    )].sort();
  });
  qs("#rateSearch").addEventListener("input", () => {
    updateRateFormState();
    render();
  });
  qs("#rateCategory").addEventListener("input", render);

  ["#dashboardSearch", "#reportSearch", "#reportType"].forEach((selector) => {
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

  qs("#resetAppLink").addEventListener("click", async (e) => {
    e.preventDefault();
    if (!confirm("Reset all local data?\n\nThis will clear all entries, PIN, and settings. Server data will NOT be affected.")) return;
    if (!confirm("Are you sure? This cannot be undone.")) return;
    try {
      await window.stockApi.resetAllData();
      localStorage.clear();
      state.entries = [];
      render();
      alert("Local data has been reset. Restart the app to set up again.");
    } catch (err) {
      alert("Failed to reset data: " + (err.message || "Unknown error"));
    }
  });
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
    API = cfg?.apiUrl || await window.stockApi.getApiUrl() || "http://localhost:3000";
    _deviceToken = cfg?.deviceToken || null;

    await showPinGate();

    try {
      const headers = { "x-access-pin": _currentPin };
      if (_deviceToken) headers["x-device-token"] = _deviceToken;
      const res = await fetch(`${API}/api/entries`, { headers });
      if (res.ok) {
        const data = await res.json();
        state.entries = Array.isArray(data.entries) ? data.entries : [];
      } else {
        throw new Error("API entries unavailable");
      }
    } catch {
      const data = await window.stockApi.loadDataLocal();
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
    setInterval(updateStatus, STATUS_REFRESH_INTERVAL_MS);
  } catch (err) {
    console.error("Initialization error:", err);
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:12px;text-align:center;padding:40px;';
    errorDiv.innerHTML =
      '<h2 style="color:#f59e0b;margin:0;">Something went wrong</h2>' +
      '<p style="color:#94a3b8;margin:0;">Please restart the application.</p>';
    const pre = document.createElement('pre');
    pre.style.cssText = 'color:#64748b;font-size:12px;margin-top:8px;';
    pre.textContent = err.message || "Unknown error";
    errorDiv.appendChild(pre);
    document.body.innerHTML = '';
    document.body.appendChild(errorDiv);
  }
};

init();





