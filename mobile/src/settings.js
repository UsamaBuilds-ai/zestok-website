import { getCompanyName, signOut, isBiometricEnabled, setBiometricEnabled } from './auth.js';
import { getSavedServerIp, setServerIp, clearServerIp, autoConfigure } from './config.js';
import { discoverServers } from './discovery.js';
import { Preferences } from '@capacitor/preferences';

const APP_VERSION = '1.0.0';
const THEME_KEY = 'themePreference';

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

  const bioEnabled = await isBiometricEnabled();
  const bioToggle = document.getElementById('biometric-toggle');
  const bioStatus = document.getElementById('settings-bio-status');
  if (bioToggle) bioToggle.checked = bioEnabled;
  if (bioStatus) {
    bioStatus.textContent = bioEnabled ? 'On' : 'Off';
    bioStatus.className = 'settings-bio-status' + (bioEnabled ? '' : ' disabled');
  }

  const { value: themePref } = await Preferences.get({ key: THEME_KEY });
  const isDark = themePref !== 'light';
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.checked = isDark;

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

  const findBtn = document.getElementById('settings-find-btn');
  if (findBtn) {
    const newBtn = findBtn.cloneNode(true);
    findBtn.parentNode.replaceChild(newBtn, findBtn);
    let _isScanning = false;
    newBtn.addEventListener('click', async () => {
      if (_isScanning) return;
      const resultsEl = document.getElementById('settings-discovery-results');
      if (!resultsEl) return;
      _isScanning = true;
      newBtn.disabled = true;
      newBtn.textContent = 'Scanning...';
      resultsEl.classList.remove('hidden');
      resultsEl.innerHTML = '<div class="discovery-item">Searching for servers...</div>';
      const servers = await discoverServers();
      _isScanning = false;
      newBtn.disabled = false;
      newBtn.textContent = 'Find';
      if (servers.length === 0) {
        resultsEl.innerHTML = '<div class="discovery-item discovery-empty">No servers found. Verify the desktop app is running and on the same network.</div>';
        return;
      }
      resultsEl.innerHTML = '';
      const ipInput = document.getElementById('settings-server-ip');
      servers.forEach((s) => {
        const item = document.createElement('div');
        item.className = 'discovery-item';
        item.textContent = `${s.ip}:${s.port}`;
        item.addEventListener('click', async () => {
          if (_isScanning) return;
          if (ipInput) ipInput.value = s.ip;
          resultsEl.classList.add('hidden');
          await setServerIp(s.ip);
          updateHealthStatus();
        });
        resultsEl.appendChild(item);
      });
    });
  }

  const bioToggle = document.getElementById('biometric-toggle');
  if (bioToggle) {
    const newToggle = bioToggle.cloneNode(true);
    bioToggle.parentNode.replaceChild(newToggle, bioToggle);
    newToggle.addEventListener('change', async () => {
      const bioStatus = document.getElementById('settings-bio-status');
      if (newToggle.checked) {
        const result = await setBiometricEnabled(true);
        if (!result.ok) {
          newToggle.checked = false;
          if (bioStatus) {
            bioStatus.textContent = result.reason === 'unavailable' ? 'Not available' : 'Off';
            bioStatus.className = 'settings-bio-status disabled';
          }
          return;
        }
        if (bioStatus) {
          bioStatus.textContent = 'On';
          bioStatus.className = 'settings-bio-status';
        }
      } else {
        await setBiometricEnabled(false);
        if (bioStatus) {
          bioStatus.textContent = 'Off';
          bioStatus.className = 'settings-bio-status disabled';
        }
      }
    });
  }

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const newToggle = themeToggle.cloneNode(true);
    themeToggle.parentNode.replaceChild(newToggle, themeToggle);
    newToggle.addEventListener('change', async () => {
      const isDark = newToggle.checked;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      await Preferences.set({ key: THEME_KEY, value: isDark ? 'dark' : 'light' });
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

async function updateHealthStatus() {
  try {
    const indicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    if (!indicator || !statusText) return;
    const { getHealth } = await import('./api.js');
    const result = await getHealth();
    if (result.ok) {
      indicator.className = 'connected';
      statusText.textContent = 'Connected';
    } else {
      indicator.className = 'error';
      statusText.textContent = 'Disconnected';
    }
  } catch {
    const indicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    if (indicator) indicator.className = 'error';
    if (statusText) statusText.textContent = 'Disconnected';
  }
}

export function hideSettings() {
  document.getElementById('settings-view').classList.add('hidden');
}
