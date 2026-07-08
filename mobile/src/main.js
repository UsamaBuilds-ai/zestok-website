import { getHealth } from './api.js';
import { initConnectivity, isConnected, onStatusChange } from './connectivity.js';

const indicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const retryBtn = document.getElementById('retry-btn');
const networkBadge = document.getElementById('network-badge');
const retryBar = document.getElementById('retry-bar');
const retryBarBtn = document.getElementById('retry-bar-btn');
const inlineError = document.getElementById('inline-error');
const inlineRetryBtn = document.getElementById('inline-retry-btn');

let _healthCheckRunning = false;
let _lastErrorType = null;

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

async function init() {
  await initConnectivity();

  updateNetworkBadge(isConnected());

  onStatusChange((status) => {
    updateNetworkBadge(status.connected);
    if (status.connected && _lastErrorType === 'offline') {
      showInlineError(false);
      checkHealth();
    }
  });

  checkHealth();
}

document.addEventListener('DOMContentLoaded', init);
