import { getHealth } from './api.js';
import { getCompanyName, signOut } from './auth.js';
import { isConnected } from './connectivity.js';

const APP_VERSION = '1.0.0';

let _healthTimer = null;

export function showSettings() {
  document.getElementById('settings-view').classList.remove('hidden');

  // Company name
  const companyEl = document.getElementById('settings-company');
  if (companyEl) {
    companyEl.textContent = getCompanyName() || '—';
  }

  // App version
  const versionEl = document.getElementById('settings-version');
  if (versionEl) {
    versionEl.textContent = APP_VERSION;
  }

  // Server health — fetch live
  updateHealthStatus();

  // Wire sign-out button (idempotent — use fresh listener each show)
  const signoutBtn = document.getElementById('signout-btn');
  if (signoutBtn) {
    const newBtn = signoutBtn.cloneNode(true);
    signoutBtn.parentNode.replaceChild(newBtn, signoutBtn);
    newBtn.addEventListener('click', async () => {
      await signOut();
    });
  }
}

export function hideSettings() {
  document.getElementById('settings-view').classList.add('hidden');
  if (_healthTimer) {
    clearTimeout(_healthTimer);
    _healthTimer = null;
  }
}

async function updateHealthStatus() {
  const statusEl = document.getElementById('settings-health-value');
  const spinnerEl = document.getElementById('settings-health-spinner');
  if (!statusEl) return;

  if (spinnerEl) spinnerEl.classList.remove('hidden');
  statusEl.innerHTML = '<span>Checking...</span>';
  statusEl.className = '';

  if (!isConnected()) {
    if (spinnerEl) spinnerEl.classList.add('hidden');
    statusEl.innerHTML = '<span>Offline</span>';
    statusEl.className = 'settings-health-offline';
    return;
  }

  const result = await getHealth();
  if (spinnerEl) spinnerEl.classList.add('hidden');

  if (result.ok) {
    statusEl.innerHTML = '<span>Connected</span>';
    statusEl.className = 'settings-health-ok';
  } else {
    statusEl.innerHTML = '<span>Unreachable</span>';
    statusEl.className = 'settings-health-error';
  }
}