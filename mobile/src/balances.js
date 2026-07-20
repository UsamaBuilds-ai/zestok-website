const keyFor = (value) => String(value || '').trim().toLowerCase();

export function getBalances(entries) {
  const items = new Map();

  for (const entry of entries) {
    const itemKey = `${keyFor(entry.item)}|${keyFor(entry.category || '')}`;
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

export { keyFor };
