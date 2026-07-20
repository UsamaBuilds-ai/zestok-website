import { keyFor } from './balances.js';
import { formatRate, formatQty } from './dashboard.js';
import { escapeHtml } from './utils.js';

let _entries = [];
let _balances = [];
let _debounceTimer = null;
let _dropdownTimer = null;

function computeBalances(entries) {
  const items = new Map();
  for (const entry of entries) {
    const itemKey = keyFor(entry.item);
    const current = items.get(itemKey) || {
      item: entry.item,
      category: entry.category || '-',
      inQty: 0,
      outQty: 0,
      balance: 0,
      latestRate: 0,
      value: 0,
    };
    const qty = Number(entry.quantity) || 0;
    if (entry.type === 'in') {
      current.inQty += qty;
      current.latestRate = Number(entry.rate) || 0;
    } else {
      current.outQty += qty;
    }
    current.category = entry.category || current.category;
    current.balance = current.inQty - current.outQty;
    current.value = current.balance * current.latestRate;
    items.set(itemKey, current);
  }
  return Array.from(items.values()).sort((a, b) => a.item.localeCompare(b.item));
}

function updateSummaryCards(balances) {
  const totalBalance = balances.reduce((sum, item) => sum + item.balance, 0);
  document.getElementById('reports-balance-card-value').textContent = formatQty(totalBalance);

  const rateEl = document.getElementById('reports-rate-card-value');
  if (balances.length === 1) {
    rateEl.textContent = formatRate(balances[0].latestRate);
  } else {
    rateEl.textContent = `${balances.length} item${balances.length !== 1 ? 's' : ''}`;
  }
}

function renderEntriesTable(filterTerm) {
  const tbody = document.getElementById('reports-entries-body');

  let filtered = _entries;
  if (filterTerm) {
    const term = keyFor(filterTerm);
    filtered = _entries.filter((entry) =>
      keyFor(`${entry.item} ${entry.category}`).includes(term)
    );
  }

  const sorted = [...filtered].sort((a, b) => {
    const dateCmp = (b.date || '').localeCompare(a.date || '');
    if (dateCmp !== 0) return dateCmp;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  const latest = sorted.slice(0, 20);

  if (latest.length === 0) {
    tbody.innerHTML =
      '<tr><td class="reports-empty-row" colspan="6">No entries found</td></tr>';
    return;
  }

  tbody.innerHTML = latest
    .map((entry) => {
      const typeLabel = entry.type === 'in' ? 'Stock In' : 'Stock Out';
      const typeClass = entry.type === 'in' ? 'type-in' : 'type-out';
      const dateStr = entry.date
        ? new Date(entry.date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }).replace(/ /g, '-')
        : '-';
      return `
        <tr data-entry-id="${escapeHtml(entry.id)}">
          <td>${escapeHtml(dateStr)}</td>
          <td class="${typeClass}">${typeLabel}</td>
          <td><strong>${escapeHtml(entry.item)}</strong></td>
          <td>${escapeHtml(entry.category || '-')}</td>
          <td>${formatQty(entry.quantity)}</td>
          <td>${formatRate(entry.rate)}</td>
        </tr>`;
    })
    .join('');

  tbody.querySelectorAll('tr[data-entry-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const entry = _entries.find((e) => e.id === row.dataset.entryId);
      if (entry) showItemDetail(entry);
    });
  });
}

function showItemDetail(entry) {
  const detailEl = document.getElementById('reports-detail');
  const entriesWrapper = document.getElementById('reports-entries-wrapper');
  const countEl = document.getElementById('reports-count');
  const summaryCards = document.getElementById('reports-summary-cards');
  const searchEl = document.getElementById('reports-search');

  const balance = _balances.find((b) => b.item === entry.item);

  document.getElementById('reports-detail-name').textContent = entry.item;
  document.getElementById('reports-detail-category').textContent = entry.category || '-';
  document.getElementById('reports-rate-value').textContent = formatRate(
    balance ? balance.latestRate : entry.rate
  );
  document.getElementById('reports-balance-value').textContent = formatQty(
    balance ? balance.balance : 0
  );

  if (entriesWrapper) entriesWrapper.style.display = 'none';
  if (countEl) countEl.style.display = 'none';
  if (summaryCards) summaryCards.style.display = 'none';
  if (searchEl) searchEl.style.display = 'none';
  if (detailEl) detailEl.classList.remove('hidden');
}

function renderDropdown(filterTerm) {
  const dropdown = document.getElementById('reports-dropdown');
  const term = keyFor(filterTerm);

  if (!term || term.length < 1) {
    dropdown.classList.add('hidden');
    return;
  }

  const seen = new Set();
  const matches = [];

  for (const item of _balances) {
    const nameMatch = keyFor(item.item).includes(term);
    const catMatch = keyFor(item.category).includes(term);

    if (nameMatch && !seen.has('i:' + item.item)) {
      seen.add('i:' + item.item);
      matches.push({ type: 'item', label: item.item, category: item.category });
    }
    if (catMatch && !seen.has('c:' + item.category)) {
      seen.add('c:' + item.category);
      matches.push({ type: 'category', label: item.category, category: '' });
    }
  }

  if (matches.length === 0) {
    dropdown.innerHTML =
      '<div class="reports-dropdown-item reports-no-match">No matches</div>';
    dropdown.classList.remove('hidden');
    return;
  }

  dropdown.innerHTML = matches
    .slice(0, 10)
    .map((m) => {
      if (m.type === 'category') {
        return `<div class="reports-dropdown-item" data-type="category" data-value="${escapeHtml(m.label)}">
          <strong>${escapeHtml(m.label)}</strong>
          <span class="reports-dropdown-category">Category</span>
        </div>`;
      }
      return `<div class="reports-dropdown-item" data-type="item" data-value="${escapeHtml(m.label)}">
        <strong>${escapeHtml(m.label)}</strong>
        <span class="reports-dropdown-category">${escapeHtml(m.category)}</span>
      </div>`;
    })
    .join('');

  dropdown.classList.remove('hidden');

  dropdown.querySelectorAll('.reports-dropdown-item').forEach((el) => {
    el.addEventListener('click', () => {
      const value = el.dataset.value;
      const type = el.dataset.type;
      document.getElementById('reports-input').value = value;
      dropdown.classList.add('hidden');

      if (type === 'item') {
        renderEntriesTable(value);
        const balance = _balances.find((b) => b.item === value);
        if (balance) updateSummaryCards([balance]);
      } else {
        renderEntriesTable(value);
        const filtered = _balances.filter((b) => b.category === value);
        updateSummaryCards(filtered);
      }
    });
  });
}

function initInputHandlers() {
  const input = document.getElementById('reports-input');
  if (!input || input._reportsInitialized) return;
  input._reportsInitialized = true;

  input.addEventListener('input', (e) => {
    const term = e.target.value.trim();

    clearTimeout(_debounceTimer);
    clearTimeout(_dropdownTimer);

    _debounceTimer = setTimeout(() => {
      renderEntriesTable(term);
      if (term) {
        const filtered = _balances.filter((item) =>
          keyFor(`${item.item} ${item.category}`).includes(keyFor(term))
        );
        updateSummaryCards(filtered);
      } else {
        updateSummaryCards(_balances);
      }
    }, 250);

    _dropdownTimer = setTimeout(() => {
      renderDropdown(term);
    }, 100);
  });

  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('reports-dropdown');
    const searchInput = document.getElementById('reports-input');
    if (dropdown && !dropdown.contains(e.target) && e.target !== searchInput) {
      dropdown.classList.add('hidden');
    }
  });
}

export function showRateCheck(entriesData) {
  _entries = Array.isArray(entriesData) ? entriesData : [];
  _balances = computeBalances(_entries);

  document.getElementById('reports-view').classList.remove('hidden');

  const entriesWrapper = document.getElementById('reports-entries-wrapper');
  const countEl = document.getElementById('reports-count');
  const detailEl = document.getElementById('reports-detail');
  const summaryCards = document.getElementById('reports-summary-cards');
  const searchEl = document.getElementById('reports-search');

  if (entriesWrapper) entriesWrapper.style.display = '';
  if (countEl) countEl.style.display = '';
  if (summaryCards) summaryCards.style.display = '';
  if (searchEl) searchEl.style.display = '';
  if (detailEl) detailEl.classList.add('hidden');

  const input = document.getElementById('reports-input');
  if (input) {
    input.value = '';
    input._reportsInitialized = false;
  }

  updateSummaryCards(_balances);
  renderEntriesTable('');
  initInputHandlers();
}

export function hideRateCheck() {
  document.getElementById('reports-view').classList.add('hidden');
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
  if (_dropdownTimer) {
    clearTimeout(_dropdownTimer);
    _dropdownTimer = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('reports-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const input = document.getElementById('reports-input');
      const detailEl = document.getElementById('reports-detail');
      const entriesWrapper = document.getElementById('reports-entries-wrapper');
      const countEl = document.getElementById('reports-count');
      const summaryCards = document.getElementById('reports-summary-cards');
      const searchEl = document.getElementById('reports-search');

      if (input) input.value = '';
      if (entriesWrapper) entriesWrapper.style.display = '';
      if (countEl) countEl.style.display = '';
      if (summaryCards) summaryCards.style.display = '';
      if (searchEl) searchEl.style.display = '';
      if (detailEl) detailEl.classList.add('hidden');

      updateSummaryCards(_balances);
      renderEntriesTable('');
    });
  }
});
