import { getHealth } from './api.js';
import { App } from '@capacitor/app';
import { initConnectivity, isConnected, onStatusChange } from './connectivity.js';
import { verifyPin, onAuthChange, handleSessionExpiry, checkSessionTimeout, tryBiometricAuth } from './auth.js';
import { showDashboard, loadDashboard } from './dashboard.js';
import { signOut } from './auth.js';
import { showSettings, hideSettings } from './settings.js';
import { formatRate, formatQty, getBalancesState } from './dashboard.js';

const indicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const retryBtn = document.getElementById('retry-btn');
const networkBadge = document.getElementById('network-badge');
const retryBar = document.getElementById('retry-bar');
const retryBarBtn = document.getElementById('retry-bar-btn');
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

function switchTab(tabName) {
  // Hide all views
  const views = ['dashboard-view', 'ratecheck-view', 'settings-view'];
  views.forEach((id) => document.getElementById(id)?.classList.add('hidden'));

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
    // Rate check — Plan 2 will fill this in
  } else if (tabName === 'settings') {
    showSettings();
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

function showRetryBar(show) {
  retryBar.classList.toggle('hidden', !show);
}

function showInlineError(show, message) {
  inlineError.classList.toggle('hidden', !show);
  if (message) {
    inlineError.querySelector('p').textContent = message;
  }
}

function showPinGate() {
  pinGateOverlay.style.display = 'flex';
  pinError.textContent = '';
  pinError.className = 'pin-error';
  pinInput.value = '';
  pinInput.className = 'pin-input';
  pinInput.disabled = false;
  setTimeout(() => pinInput.focus(), 100);
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
  if (!pin || pin.length < 4) return;

  pinError.textContent = '';
  pinError.className = 'pin-error';
  pinInput.classList.remove('error', 'shake');
  showSpinner(true);
  pinInput.disabled = true;

  const result = await verifyPin(pin);

  showSpinner(false);

  if (result.ok) {
    hidePinGate();
    showDashboard();
    return;
  }

  pinInput.value = '';
  pinInput.disabled = false;

  if (result.error === 'rate_limited') {
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
    showRetryBar(false);
    _lastErrorType = null;
  } else if (!isConnected()) {
    setStatus('error', 'No network connection');
    showRetryBar(false);
    showInlineError(true, 'No internet connection. Check your device and try again.');
    _lastErrorType = 'offline';
    console.error('[health] No network connectivity');
  } else if (result.error === 'network_error') {
    setStatus('error', 'Server unreachable');
    showRetryBar(true);
    _lastErrorType = 'transient';
    console.error('[health] Server unreachable — network timeout or DNS failure');
  } else {
    setStatus('error', `Server error: ${result.status}`);
    showRetryBar(true);
    _lastErrorType = 'transient';
    console.error('[health] Server returned error status:', result.status);
  }
}

function handleRetry() {
  showRetryBar(false);
  if (!isConnected()) {
    showInlineError(true, 'No internet connection. Check your device and try again.');
    return;
  }
  checkHealth();
}

retryBtn.addEventListener('click', checkHealth);
retryBarBtn.addEventListener('click', handleRetry);
inlineRetryBtn.addEventListener('click', checkHealth);

pinInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handlePinSubmit();
  }
});

async function init() {
  await initConnectivity();

  updateNetworkBadge(isConnected());
  showPinGate();

  onStatusChange((status) => {
    updateNetworkBadge(status.connected);
    if (status.connected && _lastErrorType === 'offline') {
      showInlineError(false);
      checkHealth();
    }
  });

  onAuthChange(({ isAuthenticated: auth }) => {
    if (auth) {
      hidePinGate();
      switchTab('dashboard');
    } else {
      showPinGate();
    }
  });

  App.addListener('appStateChange', async ({ isActive }) => {
    if (isActive) {
      const bioResult = await tryBiometricAuth();
      if (bioResult.ok) {
        hidePinGate();
        return;
      }
      const timeout = await checkSessionTimeout();
      if (timeout.expired) {
        showSessionExpired('Session expired');
      }
      showPinGate();
    }
  });

  checkHealth();

  // Bottom nav tab switching
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab) switchTab(tab);
    });
  });
}

document.getElementById('dashboard-retry-btn')?.addEventListener('click', loadDashboard);

document.addEventListener('DOMContentLoaded', init);
