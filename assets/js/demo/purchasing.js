// Purchasing page: record component purchases (each sets the component's cost from its date on),
// the weekly report of units shipped and components used, and the day-by-day inventory ledger.
(function () {
  'use strict';
  const Demo = window.Demo;
  const { D, state, pages, actions, ui, esc, fmt2, fmtDay } = Demo;
  const WINDOW = 7;
  const INCREASE_THRESHOLD = 0.2;
  const UNIT = D.COMPONENT_UNIT_LABELS;
  const ORIGINAL_COST = new Map(D.components.map((c) => [c.id, c.cost]));
  const NO_MOVEMENT = { purchases: 0, returns: 0, orders: 0, transfers: 0, adjustments: 0 };
  const DASH = '<span class="text-gray-300">—</span>';

  const TABS = [
    { key: 'recording', label: 'Recording' },
    { key: 'report', label: 'Report' },
    { key: 'inventory', label: 'Inventory' },
  ];

  const windowDays = (end) => {
    const out = [];
    for (let i = WINDOW - 1; i >= 0; i--) out.push(D.addDays(end, -i));
    return out;
  };
  const fmtQty = (n, unit) => n.toLocaleString('en-US', { maximumFractionDigits: unit === 'pcs' ? 0 : 2 });
  const fmtCount = (n) => Math.round(n).toLocaleString('en-US');
  const safeKey = (key) => key.replace(':', '-');

  state.pu = {
    tab: 'recording',
    purchases: D.initialPurchases(),
    rec: { date: D.TODAY, componentId: String(D.components[0].id), quantity: '', amount: '', description: '', error: null, confirm: null },
    reportEnd: D.TODAY,
    inv: {
      windowEnd: D.TODAY,
      screen: 'ledger', // ledger | adjust | opening | groups
      startDate: D.ACTUAL_START,
      groups: D.INVENTORY_GROUPS.map((g) => ({ ...g, componentIds: [...g.componentIds] })),
      openings: {}, // line key -> counted quantity; unset lines use about three weeks of use
      transfers: {}, // line key -> { date: quantity }
      cellErrors: {},
      adjustments: [], // { key, date, delta, note }
      adjust: null,
      opening: null,
      groupEdit: null,
      groupError: null,
    },
  };

  /* ---------------- Costs ---------------- */

  function latestPurchase(componentId) {
    let best = null;
    for (const p of state.pu.purchases) {
      if (p.componentId !== componentId) continue;
      if (!best || p.date > best.date || (p.date === best.date && p.id > best.id)) best = p;
    }
    return best;
  }
  const currentCost = (componentId) => {
    const p = latestPurchase(componentId);
    return p ? p.amount : ORIGINAL_COST.get(componentId);
  };
  // The latest purchase is each component's cost, which the Product List prices from.
  function syncComponentCosts() {
    for (const c of D.components) c.cost = currentCost(c.id);
  }
  syncComponentCosts();

  /* ---------------- Recording ---------------- */

  function recordingTab() {
    const r = state.pu.rec;
    const selected = D.componentById(Number(r.componentId));
    const groups = D.COMPONENT_TYPES.map((t) => {
      const list = D.components.filter((c) => c.type === t);
      if (!list.length) return '';
      return `<optgroup label="${D.COMPONENT_TYPE_LABELS[t]}">${list
        .map((c) => `<option value="${c.id}"${String(c.id) === String(r.componentId) ? ' selected' : ''}>${esc(c.account)} (${UNIT[c.unit]}, now ${fmt2(currentCost(c.id))}/${UNIT[c.unit]})</option>`)
        .join('')}</optgroup>`;
    }).join('');

    return `<div class="space-y-6">
      <form data-form="pu-record" class="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label for="pu-date" class="block text-xs font-medium text-gray-500">Date</label>
          <input id="pu-date" type="date" value="${r.date}" data-bind="pu.rec.date" class="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm">
        </div>
        <div class="min-w-[16rem] grow">
          <label for="pu-comp" class="block text-xs font-medium text-gray-500">Component</label>
          <select id="pu-comp" data-bind="pu.rec.componentId" data-render class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">${groups}</select>
        </div>
        <div>
          <label for="pu-qty" class="block text-xs font-medium text-gray-500">Quantity</label>
          <input id="pu-qty" type="number" min="0" step="0.001" value="${esc(r.quantity)}" data-bind="pu.rec.quantity" class="mt-1 w-24 rounded border border-gray-300 px-2 py-1.5 text-sm">
        </div>
        <div>
          <label for="pu-amt" class="block text-xs font-medium text-gray-500">Amount (cost / ${selected ? UNIT[selected.unit] : 'unit'})</label>
          <input id="pu-amt" type="number" min="0" step="0.01" value="${esc(r.amount)}" data-bind="pu.rec.amount" class="mt-1 w-28 rounded border border-gray-300 px-2 py-1.5 text-sm">
        </div>
        <div class="min-w-[12rem] grow">
          <label for="pu-desc" class="block text-xs font-medium text-gray-500">Description</label>
          <input id="pu-desc" type="text" value="${esc(r.description)}" data-bind="pu.rec.description" class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
        </div>
        <button type="submit" class="rounded bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700">Record purchase</button>
        ${r.error ? `<p class="basis-full text-xs text-red-600">${esc(r.error)}</p>` : ''}
      </form>

      <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500"><tr>
            <th class="px-3 py-2">Date</th><th class="px-3 py-2">Component</th><th class="px-3 py-2 text-right">Quantity</th>
            <th class="px-3 py-2 text-right">Amount</th><th class="px-3 py-2 text-right">Cost / unit</th><th class="px-3 py-2">Description</th><th class="px-3 py-2"></th>
          </tr></thead>
          <tbody class="divide-y divide-gray-100">
            ${state.pu.purchases
              .map(
                (p) => `<tr class="text-gray-700">
                <td class="px-3 py-2">${p.date}</td>
                <td class="px-3 py-2 text-gray-900">${esc(p.componentName)}</td>
                <td class="px-3 py-2 text-right">${p.quantity === null ? '—' : fmt2(p.quantity)}</td>
                <td class="px-3 py-2 text-right">${fmt2(p.amount)}</td>
                <td class="px-3 py-2 text-right text-gray-600">${fmt2(p.amount)} /${UNIT[p.unit]}</td>
                <td class="px-3 py-2 text-gray-500">${p.description ? esc(p.description) : '—'}</td>
                <td class="px-3 py-2 text-right"><button type="button" data-act="pu-remove" data-id="${p.id}" class="px-1 text-xs text-red-500 hover:text-red-700" title="Remove">×</button></td>
              </tr>`
              )
              .join('')}
            ${state.pu.purchases.length === 0 ? '<tr><td colspan="7" class="px-3 py-4 text-center text-gray-400">No purchases recorded yet.</td></tr>' : ''}
          </tbody>
        </table>
      </div>

      ${
        r.confirm
          ? `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div class="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" role="dialog" aria-modal="true">
            <h2 class="text-base font-semibold text-amber-700">Cost increase check</h2>
            <p class="mt-2 text-sm text-gray-700">This new cost of <span class="font-semibold">${fmt2(r.confirm.newCost)}</span> is <span class="font-semibold">${r.confirm.pct.toFixed(0)}% more</span> than the current cost of <span class="font-semibold">${fmt2(r.confirm.current)}</span>. Is this correct?</p>
            <div class="mt-5 flex justify-end gap-2">
              <button type="button" data-act="pu-confirm-cancel" class="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
              <button type="button" data-act="pu-confirm-save" class="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700">Yes, save</button>
            </div>
          </div>
        </div>`
          : ''
      }
    </div>`;
  }

  function savePurchase() {
    const r = state.pu.rec;
    const c = D.componentById(Number(r.componentId));
    const ids = state.pu.purchases.map((p) => p.id);
    state.pu.purchases.unshift({
      id: (ids.length ? Math.max(...ids) : 0) + 1,
      date: r.date,
      componentId: c.id,
      componentName: c.account,
      unit: c.unit,
      quantity: Number(r.quantity),
      amount: Number(r.amount),
      description: r.description,
    });
    state.pu.purchases.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
    syncComponentCosts();
    Object.assign(r, { quantity: '', amount: '', description: '', confirm: null, error: null });
  }

  actions['pu-tab'] = (el) => {
    state.pu.tab = el.dataset.v;
  };
  actions['pu-record'] = () => {
    const r = state.pu.rec;
    r.error = null;
    const c = D.componentById(Number(r.componentId));
    if (!c) {
      r.error = 'Pick a component.';
      return;
    }
    const amount = Number(r.amount);
    const quantity = Number(r.quantity);
    if (r.amount === '' || !Number.isFinite(amount) || amount < 0) {
      r.error = 'Enter a valid amount.';
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      r.error = 'Enter a valid quantity.';
      return;
    }
    const current = currentCost(c.id);
    if (current > 0 && amount >= current * (1 + INCREASE_THRESHOLD)) {
      r.confirm = { pct: (amount / current - 1) * 100, current, newCost: amount };
      return;
    }
    savePurchase();
  };
  actions['pu-confirm-cancel'] = () => {
    state.pu.rec.confirm = null;
  };
  actions['pu-confirm-save'] = () => savePurchase();
  actions['pu-remove'] = (el) => {
    state.pu.purchases = state.pu.purchases.filter((p) => p.id !== Number(el.dataset.id));
    syncComponentCosts();
  };

  /* ---------------- Report ---------------- */

  function reportTab() {
    const end = state.pu.reportEnd;
    const days = windowDays(end);
    const canPrev = days[0] > D.ACTUAL_START;
    const canNext = end < D.TODAY;
    const count = (fn, d) => (d < D.ACTUAL_START || d > D.TODAY ? 0 : fn(d));
    const cell = (n) => `<td class="px-3 py-1.5 text-right tabular-nums">${n > 0 ? fmtCount(n) : DASH}</td>`;
    const head = (label) => `<thead class="bg-gray-50 text-xs font-medium uppercase text-gray-500"><tr>
        <th class="px-3 py-2 text-left">${label}</th>${days.map((d) => `<th class="px-3 py-2 text-right">${fmtDay(d)}</th>`).join('')}<th class="px-3 py-2 text-right">Total</th>
      </tr></thead>`;

    const products = D.salesProducts
      .map((p) => ({ name: p.name, counts: days.map((d) => count((x) => D.shippedUnits(p, x), d)) }))
      .filter((r) => r.counts.some((n) => n > 0));
    const colTotals = days.map((_, i) => products.reduce((s, r) => s + r.counts[i], 0));
    const grand = colTotals.reduce((s, n) => s + n, 0);

    const components = D.components
      .map((c) => ({ c, counts: days.map((d) => count((x) => D.usage(c.id, x), d)) }))
      .filter((r) => r.counts.some((n) => n > 0));

    return `<div class="space-y-5">
      <div class="flex items-center justify-end gap-2 text-sm">
        <button type="button" data-act="pu-report-shift" data-d="-1" ${canPrev ? '' : 'disabled'} class="rounded border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:opacity-30" aria-label="Previous week">←</button>
        <span class="min-w-[9rem] text-center text-xs text-gray-500">${fmtDay(days[0])} – ${fmtDay(end)}</span>
        <button type="button" data-act="pu-report-shift" data-d="1" ${canNext ? '' : 'disabled'} class="rounded border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:opacity-30" aria-label="Next week">→</button>
      </div>

      <div>
        <h3 class="mb-2 text-sm font-semibold text-gray-900">Final products <span class="font-normal text-gray-400">— units shipped</span></h3>
        <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table class="w-full text-sm">
            ${head('Product')}
            <tbody class="divide-y divide-gray-100">
              ${products
                .map(
                  (r) => `<tr class="text-gray-700"><td class="px-3 py-1.5 text-gray-900">${esc(r.name)}</td>${r.counts.map(cell).join('')}<td class="px-3 py-1.5 text-right font-medium tabular-nums text-gray-900">${fmtCount(
                    r.counts.reduce((s, n) => s + n, 0)
                  )}</td></tr>`
                )
                .join('')}
              ${products.length === 0 ? `<tr><td colspan="${days.length + 2}" class="px-3 py-4 text-center text-gray-400">No products shipped in this window.</td></tr>` : ''}
            </tbody>
            ${
              products.length
                ? `<tfoot class="border-t border-gray-200 bg-gray-50 font-medium text-gray-900"><tr><td class="px-3 py-2 text-left">Total</td>${colTotals
                    .map((t) => `<td class="px-3 py-2 text-right tabular-nums">${fmtCount(t)}</td>`)
                    .join('')}<td class="px-3 py-2 text-right tabular-nums">${fmtCount(grand)}</td></tr></tfoot>`
                : ''
            }
          </table>
        </div>
      </div>

      <div>
        <h3 class="mb-2 text-sm font-semibold text-gray-900">Components <span class="font-normal text-gray-400">— quantity used (g / ml / pc)</span></h3>
        <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table class="w-full text-sm">
            ${head('Component')}
            <tbody class="divide-y divide-gray-100">
              ${D.COMPONENT_TYPES.map((t) => {
                const rows = components.filter((r) => r.c.type === t);
                if (!rows.length) return '';
                return `<tr class="bg-gray-50/60"><td colspan="${days.length + 2}" class="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">${D.COMPONENT_TYPE_LABELS[t]}</td></tr>${rows
                  .map(
                    (r) => `<tr class="text-gray-700"><td class="px-3 py-1.5 text-gray-900">${esc(r.c.account)} <span class="text-xs text-gray-400">(${D.ALLOCATION_UNIT_LABELS[r.c.unit]})</span></td>${r.counts
                      .map(cell)
                      .join('')}<td class="px-3 py-1.5 text-right font-medium tabular-nums text-gray-900">${fmtCount(r.counts.reduce((s, n) => s + n, 0))}</td></tr>`
                  )
                  .join('')}`;
              }).join('')}
              ${components.length === 0 ? `<tr><td colspan="${days.length + 2}" class="px-3 py-4 text-center text-gray-400">No components used in this window.</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  }

  actions['pu-report-shift'] = (el) => {
    const next = D.addDays(state.pu.reportEnd, WINDOW * Number(el.dataset.d));
    state.pu.reportEnd = next > D.TODAY ? D.TODAY : next;
  };

  /* ---------------- Inventory ledger ---------------- */

  function defaultOpening(componentIds, unit) {
    let need = 0;
    for (let i = 0; i < 21; i++) for (const id of componentIds) need += D.usage(id, D.addDays(D.ACTUAL_START, i));
    const priced = (need * 1.1) / D.UNIT_DIVISOR[unit];
    return unit === 'pcs' ? Math.ceil(priced / 10) * 10 : Math.round(priced * 100) / 100;
  }

  // Ledger lines: grouped components count as one line, the rest one line each.
  function ledgerLines() {
    const inv = state.pu.inv;
    const grouped = new Set(inv.groups.flatMap((g) => g.componentIds));
    const lines = [];
    for (const t of D.COMPONENT_TYPES) {
      for (const g of inv.groups) {
        const first = D.componentById(g.componentIds[0]);
        if (!first || first.type !== t) continue;
        lines.push({ key: 'g:' + g.id, type: t, name: g.name, unit: g.unit, componentIds: g.componentIds, memberNames: g.componentIds.map((id) => D.componentById(id).account) });
      }
      for (const c of D.components) {
        if (c.type !== t || grouped.has(c.id)) continue;
        lines.push({ key: 'c:' + c.id, type: t, name: c.account, unit: c.unit, componentIds: [c.id], memberNames: [] });
      }
    }
    for (const l of lines) l.opening = inv.openings[l.key] ?? defaultOpening(l.componentIds, l.unit);
    return lines;
  }

  function purchaseIndex() {
    const m = new Map();
    for (const p of state.pu.purchases) {
      const k = p.componentId + '|' + p.date;
      m.set(k, (m.get(k) || 0) + (p.quantity || 0));
    }
    return m;
  }

  // Additions are purchases and courier returns put back on the shelf; deductions are the
  // components inside orders handed to a courier, and stock sent to the branch.
  function movement(line, d, pIdx) {
    const inv = state.pu.inv;
    if (d < inv.startDate || d > D.TODAY) return NO_MOVEMENT;
    const div = D.UNIT_DIVISOR[line.unit];
    const back = D.addDays(d, -8);
    let purchases = 0;
    let returns = 0;
    let orders = 0;
    for (const id of line.componentIds) {
      purchases += pIdx.get(id + '|' + d) || 0;
      orders += D.usage(id, d) / div;
      if (back >= inv.startDate) returns += (D.usage(id, back) * 0.12) / div;
    }
    const transfers = (inv.transfers[line.key] && inv.transfers[line.key][d]) || 0;
    const adjustments = inv.adjustments.filter((a) => a.key === line.key && a.date === d).reduce((s, a) => s + a.delta, 0);
    return { purchases, returns, orders, transfers, adjustments };
  }

  const net = (m) => m.purchases + m.returns - m.orders - m.transfers + m.adjustments;

  function balanceBefore(line, day, pIdx) {
    let bal = line.opening;
    for (let d = state.pu.inv.startDate; d < day; d = D.addDays(d, 1)) bal += net(movement(line, d, pIdx));
    return bal;
  }

  function itemRows(line, days, pIdx) {
    const inv = state.pu.inv;
    const cells = [];
    let running = balanceBefore(line, days[0], pIdx);
    for (const d of days) {
      const m = movement(line, d, pIdx);
      const ending = running + net(m);
      cells.push({ begin: running, ending, ...m });
      running = ending;
    }
    const zero = (n) => (Math.abs(n) < 1e-9 ? DASH : fmtQty(n, line.unit));
    const row = (label, fn, cls) =>
      `<tr class="text-gray-600"><td class="py-1 pl-6 pr-3 text-xs">${label}</td>${cells.map((c) => `<td class="px-3 py-1 text-right text-xs tabular-nums ${cls}">${fn(c)}</td>`).join('')}</tr>`;
    const transferCell = (d, c) => {
      if (d < inv.startDate) return '<td class="px-2 py-1 text-right"><span class="block px-1 text-right text-xs text-gray-300">—</span></td>';
      const err = inv.cellErrors[line.key + '|' + d];
      return `<td class="px-2 py-1 text-right"><input id="tr-${safeKey(line.key)}-${d}" type="number" step="0.001" min="0" inputmode="decimal" value="${c.transfers ? c.transfers : ''}" data-ch="inv-transfer" data-kd="inv-transfer-kd" data-key="${line.key}" data-date="${d}" placeholder="—" title="${esc(err || `Transferred to the branch (${UNIT[line.unit]})`)}" aria-label="Transfer to Branch (${UNIT[line.unit]})" class="w-20 rounded border px-1 py-0.5 text-right text-xs tabular-nums text-red-600 placeholder:text-gray-300 focus:border-gray-400 focus:outline-none ${
        err ? 'border-red-400 bg-red-50' : 'border-transparent hover:border-gray-300'
      }"></td>`;
    };

    return `<tr class="border-t border-gray-200"><td colspan="${days.length + 1}" class="px-3 pt-2 text-sm font-medium text-gray-900">${esc(line.name)} <span class="text-xs font-normal text-gray-400">(${UNIT[line.unit]})</span>${
      line.memberNames.length ? `<span class="ml-2 text-xs font-normal text-gray-400" title="${esc(line.memberNames.join(', '))}">— ${line.memberNames.length} components counted together</span>` : ''
    }</td></tr>
      <tr class="text-gray-500"><td class="py-1 pl-6 pr-3 text-xs">Beginning</td>${cells.map((c) => `<td class="px-3 py-1 text-right text-xs tabular-nums">${fmtQty(c.begin, line.unit)}</td>`).join('')}</tr>
      ${row('Additions — purchases', (c) => zero(c.purchases), 'text-emerald-700')}
      ${row('Additions — returns', (c) => zero(c.returns), 'text-emerald-700')}
      ${row('Deductions — orders', (c) => zero(c.orders), 'text-red-600')}
      <tr class="text-gray-600"><td class="py-1 pl-6 pr-3 text-xs">Deductions — Transfer to Branch</td>${days.map((d, i) => transferCell(d, cells[i])).join('')}</tr>
      <tr class="text-gray-600"><td class="py-1 pl-6 pr-3 text-xs">Adjustments</td>${cells
        .map((c) => `<td class="px-3 py-1 text-right text-xs tabular-nums ${c.adjustments < 0 ? 'text-red-600' : 'text-emerald-700'}">${zero(c.adjustments)}</td>`)
        .join('')}</tr>
      <tr class="font-medium text-gray-900"><td class="py-1 pb-2 pl-6 pr-3 text-xs">Ending</td>${cells
        .map((c) => `<td class="px-3 py-1 pb-2 text-right text-xs tabular-nums ${c.ending < 0 ? 'text-red-600' : ''}">${fmtQty(c.ending, line.unit)}</td>`)
        .join('')}</tr>`;
  }

  function itemSelect(id, bindPath, lines, value) {
    return `<select id="${id}" data-bind="${bindPath}" data-render class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">${D.COMPONENT_TYPES.map((t) => {
      const group = lines.filter((l) => l.type === t);
      if (!group.length) return '';
      return `<optgroup label="${D.COMPONENT_TYPE_LABELS[t]}">${group
        .map((l) => `<option value="${l.key}"${l.key === value ? ' selected' : ''}>${esc(l.name)} (${UNIT[l.unit]})${l.memberNames.length ? ` — ${l.memberNames.length} together` : ''}</option>`)
        .join('')}</optgroup>`;
    }).join('')}</select>`;
  }

  function adjustmentForm(lines) {
    const a = state.pu.inv.adjust;
    const selected = lines.find((l) => l.key === a.key);
    return `<form data-form="inv-adjust" class="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label for="adj-date" class="block text-xs font-medium text-gray-500">Date</label>
          <input id="adj-date" type="date" value="${a.date}" data-bind="pu.inv.adjust.date" class="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm">
        </div>
        <div class="min-w-[14rem] grow">
          <label for="adj-item" class="block text-xs font-medium text-gray-500">Item</label>
          ${itemSelect('adj-item', 'pu.inv.adjust.key', lines, a.key)}
        </div>
        <div>
          <label for="adj-kind" class="block text-xs font-medium text-gray-500">Type</label>
          <select id="adj-kind" data-bind="pu.inv.adjust.kind" data-render class="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm">${ui.options(
            [
              { value: 'delta', label: 'Change (+/−)' },
              { value: 'count', label: 'Physical count' },
            ],
            a.kind
          )}</select>
        </div>
        <div>
          <label for="adj-qty" class="block text-xs font-medium text-gray-500">${a.kind === 'count' ? 'Counted on shelf' : 'Change'}${selected ? ` (${UNIT[selected.unit]})` : ''}</label>
          <input id="adj-qty" type="number" step="0.001" value="${esc(a.quantity)}" data-bind="pu.inv.adjust.quantity" placeholder="${a.kind === 'count' ? 'e.g. 94.15' : 'e.g. -2'}" class="mt-1 w-32 rounded border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums">
        </div>
        <div class="min-w-[12rem] grow">
          <label for="adj-note" class="block text-xs font-medium text-gray-500">Note (optional)</label>
          <input id="adj-note" type="text" value="${esc(a.note)}" data-bind="pu.inv.adjust.note" placeholder="broken in transit, sample, recount…" class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
        </div>
        <button type="submit" class="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">Record</button>
      </div>
      <p class="text-xs text-gray-400">${
        a.kind === 'count'
          ? 'Enter what is actually on the shelf. The ledger books whatever difference reconciles it, and carries the counted figure forward.'
          : 'A negative number takes stock off (breakage, samples, spillage); a positive one puts it back.'
      }</p>
      ${a.error ? `<p class="text-sm text-red-600">${esc(a.error)}</p>` : ''}
    </form>`;
  }

  function openingScreen(lines) {
    const o = state.pu.inv.opening;
    return `<form data-form="inv-opening" class="space-y-4">
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <label for="open-date" class="block text-xs font-medium text-gray-500">Inventory start date</label>
        <input id="open-date" type="date" value="${o.date}" data-bind="pu.inv.opening.date" class="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm">
        <p class="mt-2 text-xs text-gray-400">The day the ledger opens on. Purchases, returns and orders are counted from this day forward; anything shipped before it is ignored, including its later return.</p>
      </div>
      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-xs font-medium uppercase text-gray-500"><tr>
            <th class="px-3 py-2 text-left">Item</th><th class="px-3 py-2 text-left">Unit</th><th class="px-3 py-2 text-right">Opening quantity</th>
          </tr></thead>
          <tbody class="divide-y divide-gray-100">${D.COMPONENT_TYPES.map((t) => {
            const group = lines.filter((l) => l.type === t);
            if (!group.length) return '';
            return `<tr class="bg-gray-50/70"><td colspan="3" class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">${D.COMPONENT_TYPE_LABELS[t]}</td></tr>${group
              .map(
                (l) => `<tr>
                <td class="px-3 py-1.5 text-gray-900">${esc(l.name)}${l.memberNames.length ? `<span class="ml-2 text-xs text-gray-400" title="${esc(l.memberNames.join(', '))}">— ${l.memberNames.length} components counted together</span>` : ''}</td>
                <td class="px-3 py-1.5 text-gray-500">${UNIT[l.unit]}</td>
                <td class="px-3 py-1.5 text-right"><input id="open-${safeKey(l.key)}" type="number" step="0.001" min="0" value="${esc(o.values[l.key] ?? '')}" data-bind="pu.inv.opening.values.${l.key}" placeholder="0" class="w-32 rounded border border-gray-300 px-2 py-1 text-right text-sm tabular-nums"></td>
              </tr>`
              )
              .join('')}`;
          }).join('')}</tbody>
        </table>
      </div>
      ${o.error ? `<p class="text-sm text-red-600">${esc(o.error)}</p>` : ''}
      <div class="flex items-center gap-2">
        <button type="submit" class="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">Save opening balances</button>
        <button type="button" data-act="inv-screen" data-v="ledger" class="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
      </div>
    </form>`;
  }

  function groupsScreen() {
    const inv = state.pu.inv;
    const e = inv.groupEdit;
    const groupOf = (id) => inv.groups.find((g) => g.componentIds.includes(id));
    const selectable = e ? D.components.filter((c) => c.unit === e.unit && (!groupOf(c.id) || groupOf(c.id).id === e.id)) : [];
    return `<div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs text-gray-400">Components counted as one line of stock — the three fragrance oils read as a single “Fragrance oils” balance. This is a counting view only: each component keeps its own cost, purchases and BOM.</p>
        <div class="flex gap-2">
          <button type="button" data-act="grp-new" class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">+ New group</button>
          <button type="button" data-act="inv-screen" data-v="ledger" class="rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-800">Back to ledger</button>
        </div>
      </div>
      ${inv.groupError ? `<p class="text-sm text-red-600">${esc(inv.groupError)}</p>` : ''}
      <div class="space-y-2">
        ${inv.groups
          .map(
            (g) => `<div class="rounded-lg border border-gray-200 bg-white p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div><span class="text-sm font-medium text-gray-900">${esc(g.name)}</span><span class="ml-2 text-xs text-gray-400">(${UNIT[g.unit]}) — ${g.componentIds.length} components</span></div>
              <div class="flex gap-2">
                <button type="button" data-act="grp-edit" data-id="${g.id}" class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">Edit</button>
                <button type="button" data-act="grp-delete" data-id="${g.id}" class="rounded border border-gray-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50">Ungroup</button>
              </div>
            </div>
            <p class="mt-1 text-xs text-gray-500">${g.componentIds.map((id) => esc(D.componentById(id).account)).join(', ')}</p>
          </div>`
          )
          .join('')}
        ${inv.groups.length === 0 ? '<p class="rounded-lg border border-dashed border-gray-300 py-6 text-center text-sm text-gray-400">No groups — every component is counted on its own line.</p>' : ''}
      </div>
      ${
        e
          ? `<div class="space-y-3 rounded-lg border border-gray-300 bg-white p-4">
          <div class="flex flex-wrap items-end gap-3">
            <div class="min-w-[12rem] grow">
              <label for="grp-name" class="block text-xs font-medium text-gray-500">Group name</label>
              <input id="grp-name" type="text" value="${esc(e.name)}" data-bind="pu.inv.groupEdit.name" placeholder="e.g. Fragrance oils" class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
            </div>
            <div>
              <label for="grp-unit" class="block text-xs font-medium text-gray-500">Unit</label>
              <select id="grp-unit" data-ch="grp-unit" class="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm">${ui.options(
                D.COMPONENT_UNITS.map((u) => ({ value: u, label: UNIT[u] })),
                e.unit
              )}</select>
            </div>
          </div>
          <div class="max-h-64 overflow-y-auto rounded border border-gray-200" data-scroll="grp-list">
            ${selectable
              .map(
                (c) => `<label class="flex items-center gap-2 border-b border-gray-100 px-3 py-1.5 text-sm last:border-0">
                <input type="checkbox" data-ch="grp-member" data-id="${c.id}"${e.ids.includes(c.id) ? ' checked' : ''}>
                <span class="text-gray-700">${esc(c.account)}</span><span class="text-xs text-gray-400">${D.COMPONENT_TYPE_LABELS[c.type]}</span>
              </label>`
              )
              .join('')}
            ${selectable.length === 0 ? `<p class="px-3 py-4 text-center text-sm text-gray-400">No ungrouped components measured in ${UNIT[e.unit]}.</p>` : ''}
          </div>
          <div class="flex gap-2">
            <button type="button" data-act="grp-save" class="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">Save group</button>
            <button type="button" data-act="grp-cancel" class="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        </div>`
          : ''
      }
      <button type="button" data-act="inv-screen" data-v="ledger" class="text-xs text-gray-500 underline">Back without reloading</button>
    </div>`;
  }

  function inventoryTab() {
    const inv = state.pu.inv;
    const lines = ledgerLines();
    if (inv.screen === 'groups') return groupsScreen();
    if (inv.screen === 'opening') return openingScreen(lines);

    const days = windowDays(inv.windowEnd);
    const pIdx = purchaseIndex();
    const canPrev = days[0] > inv.startDate;
    const canNext = inv.windowEnd < D.TODAY;
    return `<div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs text-gray-400">Opened ${fmtDay(inv.startDate)}. Counted per whole product: additions = purchases + courier returns, deductions = orders handed to a courier, chat orders and transfers to the branch. Quantities in KG / L / Pcs.</p>
        <div class="flex items-center gap-2 text-sm">
          <button type="button" data-act="inv-screen" data-v="groups" class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">Groups</button>
          <button type="button" data-act="inv-screen" data-v="${inv.screen === 'adjust' ? 'ledger' : 'adjust'}" class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">${inv.screen === 'adjust' ? 'Close' : 'Adjust stock'}</button>
          <button type="button" data-act="inv-screen" data-v="opening" class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">Opening balances</button>
          <button type="button" data-act="inv-shift" data-d="-1" ${canPrev ? '' : 'disabled'} class="rounded border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:opacity-30" aria-label="Previous week">←</button>
          <span class="min-w-[9rem] text-center text-xs text-gray-500">${fmtDay(days[0])} – ${fmtDay(inv.windowEnd)}</span>
          <button type="button" data-act="inv-shift" data-d="1" ${canNext ? '' : 'disabled'} class="rounded border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:opacity-30" aria-label="Next week">→</button>
        </div>
      </div>
      ${inv.screen === 'adjust' ? adjustmentForm(lines) : ''}
      <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white" data-scroll="inv-ledger">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-xs font-medium uppercase text-gray-500"><tr>
            <th class="px-3 py-2 text-left">Item</th>${days.map((d) => `<th class="px-3 py-2 text-right">${fmtDay(d)}</th>`).join('')}
          </tr></thead>
          ${D.COMPONENT_TYPES.map((t) => {
            const group = lines.filter((l) => l.type === t);
            if (!group.length) return '';
            return `<tbody><tr class="bg-gray-50/70"><td colspan="${days.length + 1}" class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">${D.COMPONENT_TYPE_LABELS[t]}</td></tr></tbody>${group
              .map((l) => `<tbody id="inv-${safeKey(l.key)}" class="divide-y divide-gray-100">${itemRows(l, days, pIdx)}</tbody>`)
              .join('')}`;
          }).join('')}
        </table>
      </div>
    </div>`;
  }

  actions['inv-shift'] = (el) => {
    const inv = state.pu.inv;
    const next = D.addDays(inv.windowEnd, WINDOW * Number(el.dataset.d));
    inv.windowEnd = next > D.TODAY ? D.TODAY : next;
  };
  actions['inv-screen'] = (el) => {
    const inv = state.pu.inv;
    const screen = el.dataset.v;
    const lines = ledgerLines();
    inv.screen = screen;
    inv.groupEdit = null;
    inv.groupError = null;
    if (screen === 'adjust') inv.adjust = { date: D.TODAY, key: lines[0].key, kind: 'delta', quantity: '', note: '', error: null };
    if (screen === 'opening') inv.opening = { date: inv.startDate, values: Object.fromEntries(lines.map((l) => [l.key, l.opening ? String(l.opening) : ''])), error: null };
  };

  // A typed transfer only redraws its own ledger line, so a click elsewhere isn't lost to a repaint.
  actions['inv-transfer'] = (el) => {
    const inv = state.pu.inv;
    const key = el.dataset.key;
    const date = el.dataset.date;
    const text = el.value.trim();
    const quantity = text === '' ? 0 : Number(text);
    if (!Number.isFinite(quantity) || quantity < 0) inv.cellErrors[key + '|' + date] = 'A transfer must be zero or a positive number';
    else {
      delete inv.cellErrors[key + '|' + date];
      inv.transfers[key] = inv.transfers[key] || {};
      inv.transfers[key][date] = quantity;
    }
    const body = document.getElementById('inv-' + safeKey(key));
    if (!body) return;
    body.innerHTML = itemRows(ledgerLines().find((l) => l.key === key), windowDays(inv.windowEnd), purchaseIndex());
    return false;
  };
  actions['inv-transfer-kd'] = (el, e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      const saved = (state.pu.inv.transfers[el.dataset.key] || {})[el.dataset.date];
      el.value = saved ? String(saved) : '';
      el.blur();
    }
    return false;
  };

  actions['inv-adjust'] = () => {
    const inv = state.pu.inv;
    const a = inv.adjust;
    const line = ledgerLines().find((l) => l.key === a.key);
    const q = Number(a.quantity);
    if (!line || a.quantity === '' || !Number.isFinite(q)) {
      a.error = 'Enter a quantity.';
      return;
    }
    if (!a.date || a.date < inv.startDate) {
      a.error = `Pick a date on or after the ledger's start (${inv.startDate}).`;
      return;
    }
    let delta = q;
    if (a.kind === 'count') {
      const pIdx = purchaseIndex();
      const ending = balanceBefore(line, a.date, pIdx) + net(movement(line, a.date, pIdx));
      delta = q - ending;
    }
    inv.adjustments.push({ key: a.key, date: a.date, delta, note: a.note });
    inv.adjust = null;
    inv.screen = 'ledger';
  };

  actions['inv-opening'] = () => {
    const inv = state.pu.inv;
    const o = inv.opening;
    const values = {};
    for (const [key, v] of Object.entries(o.values)) {
      const n = v === '' ? 0 : Number(v);
      if (!Number.isFinite(n) || n < 0) {
        o.error = 'Every quantity must be zero or a positive number.';
        return;
      }
      values[key] = n;
    }
    if (!o.date) {
      o.error = 'Pick a start date.';
      return;
    }
    inv.startDate = o.date;
    inv.openings = values;
    inv.opening = null;
    inv.screen = 'ledger';
    if (inv.windowEnd < inv.startDate) inv.windowEnd = D.TODAY;
  };

  actions['grp-new'] = () => {
    state.pu.inv.groupEdit = { id: null, name: '', unit: 'l', ids: [] };
    state.pu.inv.groupError = null;
  };
  actions['grp-edit'] = (el) => {
    const g = state.pu.inv.groups.find((x) => x.id === Number(el.dataset.id));
    state.pu.inv.groupEdit = { id: g.id, name: g.name, unit: g.unit, ids: [...g.componentIds] };
    state.pu.inv.groupError = null;
  };
  actions['grp-cancel'] = () => {
    state.pu.inv.groupEdit = null;
  };
  actions['grp-unit'] = (el) => {
    Object.assign(state.pu.inv.groupEdit, { unit: el.value, ids: [] });
  };
  actions['grp-member'] = (el) => {
    const e = state.pu.inv.groupEdit;
    const id = Number(el.dataset.id);
    e.ids = el.checked ? [...e.ids, id] : e.ids.filter((x) => x !== id);
  };
  actions['grp-save'] = () => {
    const inv = state.pu.inv;
    const e = inv.groupEdit;
    if (!e.name.trim()) {
      inv.groupError = 'Give the group a name.';
      return;
    }
    if (e.ids.length < 2) {
      inv.groupError = 'Pick at least two components to count together.';
      return;
    }
    inv.groupError = null;
    const ids = [...e.ids].sort((a, b) => a - b);
    if (e.id === null) {
      const id = Math.max(0, ...inv.groups.map((g) => g.id)) + 1;
      inv.groups.push({ id, name: e.name.trim(), unit: e.unit, componentIds: ids });
    } else {
      inv.groups = inv.groups.map((g) => (g.id === e.id ? { ...g, name: e.name.trim(), unit: e.unit, componentIds: ids } : g));
      delete inv.openings['g:' + e.id];
    }
    inv.groupEdit = null;
  };
  actions['grp-delete'] = (el) => {
    const inv = state.pu.inv;
    const id = Number(el.dataset.id);
    inv.groups = inv.groups.filter((g) => g.id !== id);
    delete inv.openings['g:' + id];
    if (inv.groupEdit && inv.groupEdit.id === id) inv.groupEdit = null;
  };

  /* ---------------- Page ---------------- */

  pages.purchasing = {
    render() {
      const tab = state.pu.tab;
      return `<div class="space-y-6">
        <div>
          <h1 class="text-xl font-semibold text-gray-900">Purchasing</h1>
          <p class="text-xs text-gray-400">Recording sets each component's cost from its date forward. Report rolls the COGS of shipped orders up by final product and by component, for the purchasing team. Inventory tracks each component's stock day by day, in KG / L / Pcs.</p>
        </div>
        <div class="space-y-5">
          <div class="flex gap-1 border-b border-gray-200">${TABS.map(
            (t) =>
              `<button type="button" data-act="pu-tab" data-v="${t.key}" class="${
                tab === t.key ? 'border-b-2 border-gray-900 px-3 py-2 text-sm font-medium text-gray-900' : 'border-b-2 border-transparent px-3 py-2 text-sm text-gray-500 hover:text-gray-700'
              }">${t.label}</button>`
          ).join('')}</div>
          ${tab === 'recording' ? recordingTab() : tab === 'report' ? reportTab() : inventoryTab()}
        </div>
      </div>`;
    },
  };
})();
