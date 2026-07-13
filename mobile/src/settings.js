import { getHealth } from './api.js';
import { getCompanyName, signOut } from './auth.js';
import { isConnected } from './connectivity.js';
import { getSavedServerIp, setServerIp, clearServerIp, getServerConfig } from './config.js';

const APP_VERSION = '1.0.0';

let _healthTimer = null;

export async function showSettings() {
  document.getElementById('settings-view').classList.remove('hidden');

  const companyEl = document.getElementById('settings-company');
  if (companyEl) {
    companyEl.textContent = getCompanyName() || '—';
  }

  const versionEl = document.getElementById('settings-version');
  if (versionEl) {
    versionEl.textContent = APP_VERSION;
  }

  const ipInput = document.getElementById('settings-server-ip');
  if (ipInput) {
    const saved = await getSavedServerIp();
    ipInput.value = saved;
  }

  updateHealthStatus();
  wireSettingsEvents();
}

function wireSettingsEvents() {
  const applyBtn = document.getElementById('settings-server-apply');
  if (applyBtn) {
    const newBtn = applyBtn.cloneNode(true);
    applyBtn.parentNode.replaceChild(newBtn, applyBtn);
    newBtn.addEventListener('click', async () => {
      const ipInput = document.getElementById('settings-server-ip');
      const ip = (ipInput.value || '').trim();
      if (ip) {
        await setServerIp(ip);
      } else {
        await clearServerIp();
      }
      updateHealthStatus();
    });
  }

  const signoutBtn = document.getElementById('signout-btn');
  if (signoutBtn) {
    const newBtn = signoutBtn.cloneNode(true);
    signoutBtn.parentNode.replaceChild(newBtn, signoutBtn);
    newBtn.addEventListener('click', async () => {
      await clearServerIp();
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
