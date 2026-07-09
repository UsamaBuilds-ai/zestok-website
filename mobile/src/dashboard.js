import { getEntries } from './api.js';
import { getBalances, keyFor } from './balances.js';
import { Preferences } from '@capacitor/preferences';
import { isConnected } from './connectivity.js';

const CACHE_KEY = 'cachedEntries';
const TS_KEY = 'cachedTimestamp';

let _entries = [];
let _balances = [];
let _fromCache = false;
let _searchTerm = '';
let _debounceTimer = null;
let _searchInitialized = false;
let _staleBannerTimer = null;

export function formatQty(num) {
  const n = Number(num);
  return Number.isFinite(n) ? n.toLocaleString('en-PK', { maximumFractionDigits: 2 }) : '0';
}

export function formatRate(num) {
  const n = Number(num || 0);
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })
    .format(n)
    .replace('PKR', 'Rs');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMetrics() {
  const totalItems = _balances.length;
  const totalBalance = _balances.reduce((sum, item) => sum + item.balance, 0);
  const stockValue = _balances.reduce((sum, item) => sum + item.value, 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayMovement = _entries
    .filter((entry) => entry.date === today)
    .reduce((sum, entry) => sum + (entry.type === 'in' ? Number(entry.quantity || 0) : -Number(entry.quantity || 0)), 0);

  document.getElementById('metric-total-items').textContent = totalItems;
  document.getElementById('metric-balance-qty').textContent = formatQty(totalBalance);
  document.getElementById('metric-stock-value').textContent = formatRate(stockValue);
  document.getElementById('metric-today-movement').textContent = formatQty(todayMovement);
}

function setState() {
  _balances = _entries.length > 0 ? getBalances(_entries) : [];
  renderMetrics();
  renderStockTable();
}

export async function loadDashboard() {
  const result = await getEntries();

  if (result.ok && result.data?.entries) {
    await Preferences.set({ key: CACHE_KEY, value: JSON.stringify(result.data.entries) });
    await Preferences.set({ key: TS_KEY, value: new Date().toISOString() });
    _entries = result.data.entries;
    _fromCache = false;
    hideStaleDataBanner();
    setState();
    return result;
  }

  const { value: cached } = await Preferences.get({ key: CACHE_KEY });
  const { value: timestamp } = await Preferences.get({ key: TS_KEY });

  if (cached) {
    _entries = JSON.parse(cached);
    _fromCache = true;
    setState();
    showStaleDataBanner(timestamp || 'unknown');
    return { ok: true, data: { entries: _entries }, fromCache: true };
  }

  _entries = [];
  _fromCache = false;
  setState();
  showErrorMessage('No stock data available — no connection and no cached data.');
  return { ok: false, error: 'no_data' };
}

function showStaleDataBanner(timestamp) {
  const banner = document.getElementById('stale-data-banner');
  if (!banner) return;
  const formattedTime = timestamp && timestamp !== 'unknown'
    ? new Date(timestamp).toLocaleTimeString()
    : 'unknown';
  banner.textContent = `Stale data — last updated ${formattedTime}`;
  banner.classList.remove('hidden');
  if (_staleBannerTimer) clearTimeout(_staleBannerTimer);
  _staleBannerTimer = setTimeout(() => {
    banner.classList.add('hidden');
    _staleBannerTimer = null;
  }, 5000);
}

function hideStaleDataBanner() {
  const banner = document.getElementById('stale-data-banner');
  if (banner) banner.classList.add('hidden');
  if (_staleBannerTimer) {
    clearTimeout(_staleBannerTimer);
    _staleBannerTimer = null;
  }
}

function showErrorMessage(msg) {
  const err = document.getElementById('dashboard-error');
  const errText = document.getElementById('dashboard-error-text');
  if (errText) errText.textContent = msg;
  if (err) err.classList.remove('hidden');
}

export async function showDashboard() {
  document.getElementById('dashboard-view').classList.remove('hidden');
  if (!_searchInitialized) {
    initSearch();
    _searchInitialized = true;
  }
  await loadDashboard();
}

export function hideDashboard() {
  document.getElementById('dashboard-view').classList.add('hidden');
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
  if (_staleBannerTimer) {
    clearTimeout(_staleBannerTimer);
    _staleBannerTimer = null;
  }
  _searchTerm = '';
}

export function getBalancesState() {
  return _balances;
}

function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    if (_debounceTimer) clearTimeout(_debounceTimer);
    timer = setTimeout(() => fn(...args), ms);
    _debounceTimer = timer;
  };
}

export function renderStockTable() {
  const filtered = _searchTerm
    ? _balances.filter((item) =>
        keyFor(`${item.item} ${item.category}`).includes(keyFor(_searchTerm))
      )
    : _balances;

  const tbody = document.getElementById('stock-table-body');

  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td class="empty-row" colspan="7">No stock balance found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
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
        </tr>`
    )
    .join('');
}

function initSearch() {
  const input = document.getElementById('dashboard-search');
  if (!input) return;

  const debouncedFilter = debounce((searchTerm) => {
    _searchTerm = searchTerm;
    renderStockTable();
  }, 300);

  input.addEventListener('input', (e) => {
    debouncedFilter(e.target.value);
    if (!e.target.value) {
      _searchTerm = '';
      clearTimeout(_debounceTimer);
      renderStockTable();
      setTimeout(() => input.blur(), 100);
    }
  });

  document.addEventListener('touchstart', (e) => {
    if (e.target !== input) {
      input.blur();
    }
  });
}
