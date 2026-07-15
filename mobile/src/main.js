import { getHealth } from './api.js';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { initConnectivity, isConnected, onStatusChange } from './connectivity.js';
import { verifyPin, onAuthChange, handleSessionExpiry, checkSessionTimeout, tryBiometricAuth } from './auth.js';
import { showDashboard, hideDashboard, loadDashboard, getBalancesState } from './dashboard.js';
import { showSettings, hideSettings } from './settings.js';
import { getSavedServerIp, setServerIp } from './config.js';
import { showRateCheck, hideRateCheck } from './ratecheck.js';
import { discoverServers } from './discovery.js';

const indicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const retryBtn = document.getElementById('retry-btn');
const networkBadge = document.getElementById('network-badge');
const inlineError = document.getElementById('inline-error');
const inlineRetryBtn = document.getElementById('inline-retry-btn');
const pinGateOverlay = document.getElementById('pin-gate-overlay');
const pinInput = document.querySelector('.pin-input');
const pinError = document.getElementById('pin-error');
const spinnerOverlay = document.getElementById('spinner-overlay');
const sessionExpiredBanner = document.getElementById('session-expired-banner');

let _healthCheckRunning = false;
let _lastErrorType = null;
let _sessionExpiredTimer = null;

async function switchTab(tabName) {
  // Hide all views
  const views = ['dashboard-view', 'ratecheck-view', 'settings-view'];
  views.forEach((id) => document.getElementById(id)?.classList.add('hidden'));

  // Cleanup background timers in hidden views
  hideDashboard();
  hideRateCheck();
  hideSettings();

  // Show selected view
  const viewMap = {
    dashboard: 'dashboard-view',
    ratecheck: 'ratecheck-view',
    settings: 'settings-view',
  };
  const target = document.getElementById(viewMap[tabName]);
  if (target) target.classList.remove('hidden');

  // Update header tab text (preserve network badge — textContent not innerHTML)
  const headerTab = document.getElementById('header-tab-name');
  if (headerTab) {
    const labels = { dashboard: 'Dashboard', ratecheck: 'Rate Check', settings: 'Settings' };
    headerTab.textContent = labels[tabName] || '';
  }

  // Update nav active state
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Call view-specific show function
  if (tabName === 'dashboard') {
    showDashboard();
  } else if (tabName === 'ratecheck') {
    showRateCheck(getBalancesState());
  } else if (tabName === 'settings') {
    await showSettings();
  }
}

function setStatus(state, text) {
  indicator.className = state;
  statusText.textContent = text;
}

function updateNetworkBadge(connected) {
  networkBadge.className = connected ? 'network-online' : 'network-offline';
  networkBadge.textContent = connected ? 'Online' : 'Offline';
}

function showInlineError(show, message) {
  inlineError.classList.toggle('hidden', !show);
  if (message) {
    inlineError.querySelector('p').textContent = message;
  }
}

async function showPinGate() {
  pinGateOverlay.style.display = 'flex';
  pinError.textContent = '';
  pinError.className = 'pin-error';
  pinInput.className = 'pin-input';
  pinInput.disabled = false;

  const { value: savedPin } = await Preferences.get({ key: 'accessPin' });
  if (savedPin) {
    pinInput.value = savedPin;
    setTimeout(() => handlePinSubmit(), 50);
  } else {
    pinInput.value = '';
    setTimeout(() => pinInput.focus(), 100);
  }
}

function hidePinGate() {
  pinGateOverlay.style.display = 'none';
}

function showSpinner(show) {
  spinnerOverlay.style.display = show ? 'flex' : 'none';
}

function showSessionExpired(message) {
  if (_sessionExpiredTimer) {
    clearTimeout(_sessionExpiredTimer);
  }
  sessionExpiredBanner.textContent = message || 'Session expired';
  sessionExpiredBanner.classList.remove('hidden');
  _sessionExpiredTimer = setTimeout(() => {
    sessionExpiredBanner.classList.add('hidden');
    _sessionExpiredTimer = null;
  }, 5000);
}

async function handlePinSubmit() {
  const pin = pinInput.value.trim();
  if (!pin || pin.length < 4) {
    pinError.textContent = 'PIN must be at least 4 digits';
    pinError.className = 'pin-error';
    pinInput.classList.add('shake');
    setTimeout(() => pinInput.classList.remove('shake'), 400);
    return;
  }

  pinError.textContent = '';
  pinError.className = 'pin-error';
  pinInput.classList.remove('error', 'shake');
  showSpinner(true);
  pinInput.disabled = true;

  const result = await verifyPin(pin);

  showSpinner(false);

  if (result.ok) {
    hidePinGate();
    // Auth subscriber handles view switching — do NOT call showDashboard() here
    return;
  }

  pinInput.value = '';
  pinInput.disabled = false;

  if (result.error === 'rate_limited') {
    // TODO: Read Retry-After header from server response instead of hardcoding 5s
    let countdown = 5;
    pinError.textContent = `Too many attempts. Try again in ${countdown}s`;
    pinError.className = 'pin-error rate-limit';
    pinInput.disabled = true;
    const interval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        pinError.textContent = `Too many attempts. Try again in ${countdown}s`;
      } else {
        clearInterval(interval);
        pinError.textContent = '';
        pinError.className = 'pin-error';
        pinInput.disabled = false;
        pinInput.focus();
      }
    }, 1000);
  } else if (result.error === 'network_error') {
    pinError.textContent = 'Could not connect to server';
    pinInput.classList.add('shake');
    setTimeout(() => pinInput.classList.remove('shake'), 400);
  } else {
    pinError.textContent = 'Invalid PIN. Try again.';
    pinInput.classList.add('shake');
    setTimeout(() => pinInput.classList.remove('shake'), 400);
  }
}

async function checkHealth() {
  if (_healthCheckRunning) return;
  _healthCheckRunning = true;

  showInlineError(false);
  setStatus('checking', 'Checking server...');

  const result = await getHealth();

  _healthCheckRunning = false;

  if (result.ok) {
    setStatus('connected', 'Connected');
    _lastErrorType = null;
  } else if (!isConnected()) {
    setStatus('error', 'No network connection');
    showInlineError(true, 'No internet connection. Check your device and try again.');
    _lastErrorType = 'offline';
    console.error('[health] No network connectivity');
  } else if (result.error === 'network_error') {
    setStatus('error', 'Server unreachable');
    _lastErrorType = 'transient';
    console.error('[health] Server unreachable — network timeout or DNS failure');
  } else {
    setStatus('error', `Server error: ${result.status}`);
    _lastErrorType = 'transient';
    console.error('[health] Server returned error status:', result.status);
  }
}

retryBtn.addEventListener('click', checkHealth);
inlineRetryBtn.addEventListener('click', checkHealth);

pinInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handlePinSubmit();
  }
});

function registerAppListeners() {
  onStatusChange((status) => {
    updateNetworkBadge(status.connected);
    if (status.connected && _lastErrorType === 'offline') {
      showInlineError(false);
      checkHealth();
    }
  });

  onAuthChange(async ({ isAuthenticated: auth }) => {
    if (auth) {
      hidePinGate();
      await switchTab('dashboard');
    } else {
      showPinGate();
    }
  });

  App.addListener('appStateChange', async ({ isActive }) => {
    if (isActive) {
      const bioResult = await tryBiometricAuth();
      if (bioResult.ok) {
        hidePinGate();
        await switchTab('dashboard');
        return;
      }
      const timeout = await checkSessionTimeout();
      if (timeout.expired) {
        await handleSessionExpiry();
        showSessionExpired('Session expired');
      }
      showPinGate();
    }
  });

  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tab = btn.dataset.tab;
      if (tab) await switchTab(tab);
    });
  });
}

async function onServerConnected() {
  showPinGate();
  checkHealth();
}

async function init() {
  await initConnectivity();

  updateNetworkBadge(isConnected());

  const savedIp = await getSavedServerIp();
  if (!savedIp) {
    const setupOverlay = document.getElementById('server-setup-overlay');
    const applyBtn = document.getElementById('setup-apply-btn');
    const findBtn = document.getElementById('setup-find-btn');
    const ipInput = document.getElementById('setup-server-ip');
    const discoveryResults = document.getElementById('setup-discovery-results');
    if (setupOverlay) setupOverlay.style.display = 'flex';
    if (ipInput) {
      ipInput.focus();
    }
    if (applyBtn) {
      applyBtn.onclick = async () => {
        const ip = (ipInput.value || '').trim();
        if (ip) {
          await setServerIp(ip);
          if (setupOverlay) setupOverlay.style.display = 'none';
          registerAppListeners();
          onServerConnected();
        }
      };
      ipInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyBtn.click();
      });
    }
    if (findBtn) {
      findBtn.onclick = async () => {
        findBtn.disabled = true;
        findBtn.textContent = 'Scanning...';
        discoveryResults.classList.remove('hidden');
        discoveryResults.innerHTML = '<div class="discovery-item">Searching for servers...</div>';
        const servers = await discoverServers();
        findBtn.disabled = false;
        findBtn.textContent = 'Find Server';
        if (servers.length === 0) {
          discoveryResults.innerHTML = '<div class="discovery-item discovery-empty">No servers found. Make sure the desktop app is running.</div>';
          return;
        }
        discoveryResults.innerHTML = '';
        servers.forEach((s) => {
          const item = document.createElement('div');
          item.className = 'discovery-item';
          item.textContent = `${s.ip}:${s.port}`;
          item.addEventListener('click', async () => {
            ipInput.value = s.ip;
            discoveryResults.classList.add('hidden');
            await setServerIp(s.ip);
            if (setupOverlay) setupOverlay.style.display = 'none';
            registerAppListeners();
            onServerConnected();
          });
          discoveryResults.appendChild(item);
        });
      };
    }
    return;
  }

  registerAppListeners();
  onServerConnected();
}

document.getElementById('dashboard-retry-btn')?.addEventListener('click', loadDashboard);

document.addEventListener('DOMContentLoaded', init);
