import { keyFor } from './balances.js';
import { formatRate, formatQty } from './dashboard.js';

let _balances = [];
let _selectedItem = null;
let _debounceTimer = null;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function showRateCheck(balancesData) {
  _balances = balancesData || [];
  document.getElementById('ratecheck-view').classList.remove('hidden');

  const resultEl = document.getElementById('ratecheck-result');
  const emptyEl = document.getElementById('ratecheck-empty');
  const input = document.getElementById('ratecheck-input');

  // Reset input state
  if (input) input.value = '';
  _selectedItem = null;

  if (_balances.length === 0) {
    if (resultEl) resultEl.classList.add('hidden');
    if (emptyEl) {
      emptyEl.textContent = 'No data available. Please visit Dashboard first.';
      emptyEl.classList.remove('hidden');
    }
    return;
  }

  // Show prompt state
  if (resultEl) resultEl.classList.add('hidden');
  if (emptyEl) {
    emptyEl.textContent = 'Type an item name above to check its latest rate and balance.';
    emptyEl.classList.remove('hidden');
  }

  // Initialize input handler (idempotent — guard against double init)
  if (input && !input._rateCheckInitialized) {
    input._rateCheckInitialized = true;

    input.addEventListener('input', (e) => {
      clearTimeout(_debounceTimer);
      const term = e.target.value.trim();
      const dropdown = document.getElementById('ratecheck-dropdown');
      const result = document.getElementById('ratecheck-result');
      const empty = document.getElementById('ratecheck-empty');

      if (!term) {
        if (dropdown) dropdown.classList.add('hidden');
        if (result) result.classList.add('hidden');
        if (empty) {
          empty.textContent = 'Type an item name above to check its latest rate and balance.';
          empty.classList.remove('hidden');
        }
        _selectedItem = null;
        return;
      }

      _debounceTimer = setTimeout(() => {
        const matches = _balances.filter((item) =>
          keyFor(item.item).includes(keyFor(term))
        );
        renderDropdown(dropdown, matches, input, result, empty);
      }, 300);
    });

    // Close dropdown on tap outside
    document.addEventListener('touchstart', (e) => {
      const dropdown = document.getElementById('ratecheck-dropdown');
      if (dropdown && !e.target.closest('#ratecheck-input') && !e.target.closest('#ratecheck-dropdown')) {
        dropdown.classList.add('hidden');
      }
    });
  }
}

export function hideRateCheck() {
  document.getElementById('ratecheck-view').classList.add('hidden');
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
  _selectedItem = null;
}

function renderDropdown(dropdown, matches, input, result, empty) {
  if (!dropdown) return;

  if (matches.length === 0) {
    dropdown.innerHTML = '<div class="ratecheck-dropdown-item ratecheck-no-match">No items found</div>';
    dropdown.classList.remove('hidden');
    return;
  }

  dropdown.innerHTML = matches
    .map((item) => `<div class="ratecheck-dropdown-item" data-item="${escapeHtml(item.item)}">
      <strong>${escapeHtml(item.item)}</strong>
      <span class="ratecheck-dropdown-category">${escapeHtml(item.category)}</span>
    </div>`)
    .join('');
  dropdown.classList.remove('hidden');

  // Tap to select
  dropdown.querySelectorAll('.ratecheck-dropdown-item').forEach((el) => {
    el.addEventListener('click', () => {
      const selected = matches.find((m) => m.item === el.dataset.item);
      if (selected) {
        selectItem(selected, input, dropdown, result, empty);
      }
    });
  });
}

function selectItem(item, input, dropdown, result, empty) {
  _selectedItem = item;
  if (input) input.value = item.item;
  if (dropdown) dropdown.classList.add('hidden');
  if (empty) empty.classList.add('hidden');

  const rateValue = document.getElementById('ratecheck-rate-value');
  const balanceValue = document.getElementById('ratecheck-balance-value');
  const itemName = document.getElementById('ratecheck-item-name');
  const itemCategory = document.getElementById('ratecheck-item-category');

  if (rateValue) rateValue.textContent = formatRate(item.latestRate);
  if (balanceValue) balanceValue.textContent = formatQty(item.balance);
  if (itemName) itemName.textContent = item.item;
  if (itemCategory) itemCategory.textContent = item.category;

  if (result) result.classList.remove('hidden');
}