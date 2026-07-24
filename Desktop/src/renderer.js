// Named constants (replaces magic numbers)
const PIN_GATE_DELAY_MS = 8000;
const STATUS_POLL_RETRIES = 3;
const STATUS_POLL_INTERVAL_MS = 1000;
const STATUS_REFRESH_INTERVAL_MS = 30000;
const TRIAL_LIMIT = 40;
const LICENSE_KEY_REGEX = /^ZSTK-[A-F0-9]{5}-[A-F0-9]{5}-[A-F0-9]{5}-[A-F0-9]{5}$/;
const LICENSE_STORE_KEY = 'zestok_license';
let API = "http://localhost:3000";

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

const RAILWAY_API = 'https://tender-solace-production-5226.up.railway.app/api';
let _currentPin = null;
let _deviceToken = null;
let _unlock;
let _dirty = false;
let _unlocked = false;
let _syncing = false;
let _railwayOnline = false;
let _licensed = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isValidLicenseKey(key) {
  return LICENSE_KEY_REGEX.test(key);
}

async function loadLicense() {
  try {
    const stored = localStorage.getItem(LICENSE_STORE_KEY);
    if (stored && isValidLicenseKey(stored)) {
      const result = await window.stockApi.validateLicenseServer(stored);
      if (result && result.valid) {
        _licensed = true;
        return true;
      }
      if (result && result.reason === 'offline') {
        _licensed = true;
        return true;
      }
    }
    const ipcKey = await window.stockApi.getLicenseKey();
    if (ipcKey && isValidLicenseKey(ipcKey)) {
      const result = await window.stockApi.validateLicenseServer(ipcKey);
      if (result && result.valid) {
        _licensed = true;
        localStorage.setItem(LICENSE_STORE_KEY, ipcKey);
        return true;
      }
      if (result && result.reason === 'offline') {
        _licensed = true;
        localStorage.setItem(LICENSE_STORE_KEY, ipcKey);
        return true;
      }
    }
  } catch {}
  return false;
}

async function activateLicense(key) {
  const clean = key.trim();
  if (!isValidLicenseKey(clean)) {
    return { ok: false, error: 'Invalid key format. Should be ZSTK-XXXXX-XXXXX-XXXXX-XXXXX (4 groups)' };
  }
  try {
    const fingerprint = await window.stockApi.getDeviceFingerprint();
    const res = await fetch(`${RAILWAY_API}/license/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: clean, deviceFingerprint: fingerprint, deviceName: 'Windows-PC' })
    });
    if (res.ok) {
      const data = await res.json();
      await window.stockApi.saveLicenseKey(clean);
      localStorage.setItem(LICENSE_STORE_KEY, clean);
      _licensed = true;
      return { ok: true, message: data.message };
    }
    const err = await res.json();
    return { ok: false, error: err.error || 'Activation failed' };
  } catch (e) {
    return { ok: false, error: 'Server unreachable. Check your connection.' };
  }
}

function isTrialBlocked() {
  return !_licensed && state.entries.length >= TRIAL_LIMIT;
}
function isLicensed() { return _licensed; }
let splashGen = 0;

// ── Theme System ──
const theme = {
  get saved() { return localStorage.getItem('zestok-theme'); },
  set saved(v) { localStorage.setItem('zestok-theme', v); },
  get current() { return document.documentElement.getAttribute('data-theme') || 'light'; },
  apply(name) {
    if (name === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = name === 'dark' ? '☀️' : '🌙';
  },
  toggle() {
    const next = this.current === 'dark' ? 'light' : 'dark';
    this.saved = next;
    this.apply(next);
  },
};


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

const setConnectionStatus = (railwayOnline) => {
  const el = qs("#connectionStatus");
  const icon = qs("#statusIcon");
  const text = qs("#statusText");
  if (!el || !icon || !text) return;

  el.className = "connection-status";
  if (railwayOnline) {
    el.classList.add("connected");
    icon.textContent = "✓";
    text.textContent = "Server Online";
  } else {
    el.classList.add("local");
    icon.textContent = "●";
    text.textContent = "Server Offline";
  }
};

const syncToRailway = async () => {
  if (_syncing || !_currentPin) return;
  _syncing = true;
  try {
    const headers = { "Content-Type": "application/json", "x-access-pin": _currentPin };
    if (_deviceToken) headers["x-device-token"] = _deviceToken;
    const res = await fetch(`${RAILWAY_API}/entries`, {
      method: "POST",
      headers,
      body: JSON.stringify({ entries: state.entries })
    });
    if (res.ok) _dirty = false;
  } catch {} finally {
    _syncing = false;
  }
};

const updateStatus = async () => {
  let online = false;
  try {
    const res = await fetch(`${RAILWAY_API}/health`);
    online = (await res.json()).status === "ok";
  } catch { online = false; }

  _railwayOnline = online;
  setConnectionStatus(online);

  if (online && _dirty) {
    await syncToRailway();
  }
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

function updateTrialBanner() {
  const banner = document.getElementById('trialBanner');
  const msg = document.getElementById('trialMessage');
  const licenseBanner = document.getElementById('licenseBanner');
  if (!banner || !msg) return;
  if (_licensed) {
    banner.classList.add('hidden');
    if (licenseBanner) licenseBanner.classList.add('hidden');
    return;
  }
  const count = state.entries.length;
  if (count >= TRIAL_LIMIT) {
    banner.classList.add('hidden');
    if (licenseBanner) licenseBanner.classList.remove('hidden');
    return;
  }
  msg.textContent = `Trial: ${count}/${TRIAL_LIMIT} entries`;
  banner.classList.remove('hidden');
  if (licenseBanner) licenseBanner.classList.add('hidden');
}

function updateLockedControls() {
  const resetLink = document.getElementById('resetAppLink');
  if (resetLink) {
    resetLink.classList.toggle('hidden', !_licensed);
  }
  const delCol = document.getElementById('deleteColHeader');
  if (delCol) {
    delCol.classList.toggle('hidden', !_licensed);
  }
  if (state.activeTab === 'report') renderReportRows();
}

function showUpgradeOverlay() {
  const overlay = document.getElementById('upgradeOverlay');
  if (overlay) overlay.classList.remove('hidden');
}

function hideUpgradeOverlay() {
  const overlay = document.getElementById('upgradeOverlay');
  if (overlay) overlay.classList.add('hidden');
  document.getElementById('licenseMsg').textContent = '';
  document.getElementById('licenseKeyInput').value = '';
}

function wireUpgradeEvents() {
  document.getElementById('upgradeBtn')?.addEventListener('click', showUpgradeOverlay);
  document.getElementById('topLicenseBtn')?.addEventListener('click', showUpgradeOverlay);
  document.getElementById('upgradeCloseBtn')?.addEventListener('click', hideUpgradeOverlay);

  document.getElementById('licenseActivateBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('licenseKeyInput');
    const msg = document.getElementById('licenseMsg');
    const key = input.value.trim();
    const result = await activateLicense(key);
    msg.className = 'license-msg ' + (result.ok ? 'success' : 'error');
    msg.textContent = result.ok ? 'License activated!' : result.error;
    if (result.ok) {
      updateTrialBanner();
      updateLockedControls();
      setTimeout(hideUpgradeOverlay, 1500);
    }
  });

  document.getElementById('licenseKeyInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('licenseActivateBtn').click();
  });
}

const syncToServer = async () => {
  try {
    const headers = { "Content-Type": "application/json", "x-access-pin": _currentPin };
    if (_deviceToken) headers["x-device-token"] = _deviceToken;
    await fetch(`${API}/api/entries`, {
      method: "POST",
      headers,
      body: JSON.stringify({ entries: state.entries })
    });
  } catch {}
};

const save = async () => {
  await window.stockApi.saveDataLocal({ entries: state.entries });
  _dirty = true;
  await syncToServer();
  if (_railwayOnline) await syncToRailway();
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
              <td>${_licensed ? `<button class="danger-btn" data-delete="${entry.id}" type="button">Delete</button>` : ''}</td>
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
  const allBalances = getBalances();
  const activeBalances = allBalances.filter(b => b.balance > 0);
  renderMetrics(activeBalances);
  renderDatalist(activeBalances);
  renderBalanceRows(activeBalances);
  updateRateFormState();
  renderRateCheck(allBalances);
  renderReportHeading();
  renderReportRows();
  renderItemPreview();
  updateTrialBanner();
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

const getLastEntryForItem = (itemName) => {
  const entries = state.entries
    .filter(e => keyFor(e.item) === keyFor(itemName))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return entries[0] || null;
};

let _lastAutoItem = "";

const updateEntryFormState = () => {
  const type = qs("#type").value;
  const itemName = qs("#item").value;
  const rateField = qs("#rate");
  const categoryField = qs("#category");

  if (itemName) {
    const balances = getBalances();
    const matching = balances.filter(b => keyFor(b.item) === keyFor(itemName));
    const uniqueCats = [...new Set(matching.map(b => b.category).filter(c => c && c !== "-"))];

    const lastEntry = getLastEntryForItem(itemName);

    if (keyFor(itemName) !== keyFor(_lastAutoItem) && lastEntry && uniqueCats.length > 0) {
      categoryField.value = lastEntry.category || "";
      _lastAutoItem = itemName;
    }

    if (type === "out") {
      categoryField.readOnly = true;
      categoryField.style.opacity = "0.6";
    } else {
      categoryField.readOnly = false;
      categoryField.style.opacity = "1";
    }
  } else {
    _lastAutoItem = "";
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
    if (itemDetails) {
      rateField.value = itemDetails.latestRate || "";
    }
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

  if (isTrialBlocked()) {
    showUpgradeOverlay();
    return;
  }

  if (state.entries.length >= TRIAL_LIMIT && !_licensed) {
    showUpgradeOverlay();
    return;
  }

  if (entry.type === "out") {
    const balances = getBalances();
    const balance = balances.find(b =>
      keyFor(b.item) === keyFor(entry.item) && keyFor(b.category) === keyFor(entry.category)
    );
    const currentBalance = balance ? balance.balance : 0;
    if (entry.quantity > currentBalance) {
      const err = qs("#balanceError");
      err.textContent = `Insufficient balance! Available: ${formatQty(currentBalance)}`;
      qs("#quantity").focus();
      updateEntryFormState();
      return;
    }
    qs("#balanceError").textContent = "";
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
    qs("#balanceError").textContent = "";
    updateEntryFormState();
  });

  qs("#type").addEventListener("change", () => {
    qs("#balanceError").textContent = "";
    updateEntryFormState();
  });
  qs("#quantity").addEventListener("input", () => {
    qs("#balanceError").textContent = "";
  });
  qs("#item").addEventListener("input", () => {
    qs("#balanceError").textContent = "";
    updateEntryFormState();
    renderItemPreview();
  });
  qs("#category").addEventListener("input", () => {
    qs("#balanceError").textContent = "";
    updateEntryFormState();
    renderItemPreview();
  });

  bindDD("#item", "#itemDropdown", () => {
    const balances = getBalances();
    if (qs("#type").value === "out") {
      return [...new Set(balances.filter(b => b.balance > 0).map(b => b.item))].sort();
    }
    return [...new Set(balances.map(b => b.item))].sort();
  });
  bindDD("#category", "#categoryDropdown", () => {
    const allCategories = [...new Set(getBalances().map(b => b.category).filter(c => c && c !== "-"))].sort();
    if (qs("#type").value === "in") return allCategories;
    const selectedItem = keyFor(qs("#item").value);
    if (!selectedItem) return allCategories;
    const matching = getBalances().filter(b => keyFor(b.item) === selectedItem);
    if (matching.length === 0) return allCategories;
    return [...new Set(matching.map(b => b.category).filter(c => c && c !== "-"))].sort();
  });
  bindDD("#rateSearch", "#rateSearchDropdown", () => [...new Set(getBalances().map(b => b.item))].sort());
  bindDD("#rateCategory", "#rateCategoryDropdown", () => {
    const allCategories = [...new Set(getBalances().map(b => b.category).filter(c => c && c !== "-"))].sort();
    const selectedItem = keyFor(qs("#rateSearch").value);
    if (!selectedItem) return allCategories;
    const matching = getBalances().filter(b => keyFor(b.item) === selectedItem);
    if (matching.length === 0) return allCategories;
    return [...new Set(matching.map(b => b.category).filter(c => c && c !== "-"))].sort();
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
    if (!_licensed) return;
    const button = event.target.closest("[data-delete]");
    if (button) {
      if (!confirm("Delete this entry?")) return;
      deleteEntry(button.dataset.delete);
    }
  });

  qs("#exportCsv").addEventListener("click", exportCsv);
  qs("#exportPdf").addEventListener("click", exportPdf);

  wireUpgradeEvents();

  document.getElementById('resetAppLink').addEventListener("click", async (e) => {
    e.preventDefault();
    if (!_licensed) return;
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

    await loadLicense();
    updateLockedControls();

    qs("#date").value = todayValue();
    qs("#appVersion").textContent = await window.stockApi.getVersion();

    theme.apply(theme.saved || 'light');
    document.getElementById('themeToggle')?.addEventListener('click', () => theme.toggle());

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





