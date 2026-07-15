import { getCompanyName, signOut } from './auth.js';
import { getSavedServerIp, setServerIp, clearServerIp } from './config.js';
import { discoverServers } from './discovery.js';

const APP_VERSION = '1.0.0';

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
    newBtn.addEventListener('click', async () => {
      const resultsEl = document.getElementById('settings-discovery-results');
      if (!resultsEl) return;
      newBtn.disabled = true;
      newBtn.textContent = 'Scanning...';
      resultsEl.classList.remove('hidden');
      resultsEl.innerHTML = '<div class="discovery-item">Searching for servers...</div>';
      const servers = await discoverServers();
      newBtn.disabled = false;
      newBtn.textContent = 'Find';
      if (servers.length === 0) {
        resultsEl.innerHTML = '<div class="discovery-item discovery-empty">No servers found. Make sure the desktop app is running.</div>';
        return;
      }
      resultsEl.innerHTML = '';
      const ipInput = document.getElementById('settings-server-ip');
      servers.forEach((s) => {
        const item = document.createElement('div');
        item.className = 'discovery-item';
        item.textContent = `${s.ip}:${s.port}`;
        item.addEventListener('click', async () => {
          if (ipInput) ipInput.value = s.ip;
          resultsEl.classList.add('hidden');
          await setServerIp(s.ip);
          updateHealthStatus();
        });
        resultsEl.appendChild(item);
      });
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
}
