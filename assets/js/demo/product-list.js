// Product List page: the components products are built from, each product's bill of materials
// (single products, variants and bundles), and the price / built cost / gross margin overview.
// Edits here reprice the catalogue straight away; past sales keep the cost they were booked at.
(function () {
  'use strict';
  const Demo = window.Demo;
  const { D, state, pages, actions, ui, esc } = Demo;
  const TYPE_LABEL = D.COMPONENT_TYPE_LABELS;
  const UNIT = D.COMPONENT_UNIT_LABELS;
  const ALLOC = D.ALLOCATION_UNIT_LABELS;
  const SINGLE_COL_WIDTH = { raw_material: 'w-[22%]', product_package: 'w-[16%]', sticker: 'w-[14%]', other: 'w-[14%]' };

  const TABS = [
    { key: 'components', label: 'Product Components' },
    { key: 'final', label: 'Final Product' },
    { key: 'products', label: 'Product List' },
  ];

  const fmt = (v) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }));
  const safe = (s) => String(s).replace(/[^a-zA-Z0-9]/g, '-');
  const byId = (a, b) => a.id - b.id;

  state.pl = {
    tab: 'components',
    comp: { form: { type: 'raw_material', account: '', unit: 'pcs', cost: '', error: null }, filter: 'all', edit: null, rowError: null },
    fin: { search: '', status: 'active', expanded: [], add: {}, errors: {} },
    over: { search: '', status: 'active', expanded: [] },
  };

  /* ---------------- Costs ---------------- */

  const comp = (id) => D.componentById(id);
  const single = (id) => D.singles.find((p) => p.id === id);

  function mappingCosts(list) {
    let total = 0;
    let missing = false;
    for (const m of list) {
      const c = comp(m.componentId);
      const line = c ? D.computeLineCost(c.cost, c.unit, m.quantity) : null;
      if (line === null) missing = true;
      else total += line;
    }
    return { total, missing };
  }
  function variantBuilt(p, v) {
    const base = mappingCosts(p.mappings);
    const own = mappingCosts(v.mappings);
    return { total: base.total + own.total, missing: base.missing || own.missing };
  }
  // A multi-variant product costs the average of its variants' built costs.
  function singleBuilt(p) {
    if (!p.variants.length) return mappingCosts(p.mappings).total;
    return p.variants.reduce((s, v) => s + variantBuilt(p, v).total, 0) / p.variants.length;
  }
  function bundleItemCost(item) {
    if (item.kind === 'product') {
      const member = single(item.refId);
      return member ? singleBuilt(member) * item.quantity : null;
    }
    const c = comp(item.refId);
    return c ? D.computeLineCost(c.cost, c.unit, item.quantity) : null;
  }
  function bundleCost(b) {
    let total = 0;
    let missing = false;
    for (const it of b.items) {
      const x = bundleItemCost(it);
      if (x === null) missing = true;
      else total += x;
    }
    return { total, missing };
  }

  const statusToggle = (path, value) => `<div class="flex rounded-md border border-gray-300 text-xs font-medium">
      <button type="button" data-act="pl-status" data-path="${path}" data-v="active" class="rounded-l-md px-3 py-1.5 ${value === 'active' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}">Active only</button>
      <button type="button" data-act="pl-status" data-path="${path}" data-v="all" class="rounded-r-md px-3 py-1.5 ${value === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}">All statuses</button>
    </div>`;

  actions['pl-tab'] = (el) => {
    state.pl.tab = el.dataset.v;
  };
  actions['pl-status'] = (el) => {
    Demo.setPath(el.dataset.path, el.dataset.v);
  };
  actions['pl-expand'] = (el) => {
    const list = Demo.getPath(el.dataset.path);
    const id = Number(el.dataset.id);
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else list.push(id);
  };

  /* ---------------- Product Components ---------------- */

  function componentsTab() {
    const s = state.pl.comp;
    const f = s.form;
    const inputClass = 'mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm';
    const editClass = 'w-full rounded border border-gray-300 px-1.5 py-1 text-xs';
    const typeOptions = D.COMPONENT_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }));
    const unitOptions = D.COMPONENT_UNITS.map((u) => ({ value: u, label: UNIT[u] }));
    const filtered = s.filter === 'all' ? D.components : D.components.filter((c) => c.type === s.filter);
    const e = s.edit;

    const row = (c) => {
      if (e && e.id === c.id) {
        return `<tr class="bg-blue-50/40">
          <td class="px-3 py-2"><select id="plce-type" data-bind="pl.comp.edit.type" class="${editClass}">${ui.options(typeOptions, e.type)}</select></td>
          <td class="px-3 py-2"><input id="plce-acct" type="text" value="${esc(e.account)}" data-bind="pl.comp.edit.account" class="${editClass}"></td>
          <td class="px-3 py-2"><select id="plce-unit" data-bind="pl.comp.edit.unit" class="${editClass}">${ui.options(unitOptions, e.unit)}</select></td>
          <td class="px-3 py-2"><input id="plce-cost" type="number" min="0" step="0.01" value="${esc(e.cost)}" data-bind="pl.comp.edit.cost" class="${editClass} text-right"></td>
          <td class="px-3 py-2"><div class="flex gap-1">
            <button type="button" data-act="plc-save" class="rounded bg-gray-900 px-2 py-0.5 text-xs font-medium text-white hover:bg-gray-700">Save</button>
            <button type="button" data-act="plc-cancel" class="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          </div></td>
        </tr>`;
      }
      return `<tr class="text-gray-700">
        <td class="px-3 py-2"><span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">${TYPE_LABEL[c.type]}</span></td>
        <td class="px-3 py-2 text-gray-900">${esc(c.account)}</td>
        <td class="px-3 py-2 text-gray-500">${UNIT[c.unit]}</td>
        <td class="px-3 py-2 text-right">${fmt(c.cost)}</td>
        <td class="px-3 py-2"><div class="flex gap-2">
          <button type="button" data-act="plc-edit" data-id="${c.id}" class="text-xs font-medium text-gray-600 hover:underline">Edit</button>
          <button type="button" data-act="plc-delete" data-id="${c.id}" class="text-xs font-medium text-red-600 hover:underline">Delete</button>
        </div></td>
      </tr>`;
    };

    return `<div class="space-y-4">
      <p class="text-xs text-gray-400">The raw materials, packaging, stickers and other inputs your products are built from. Add each with its unit and cost — the Final Product tab will reference these to build up each product's cost.</p>

      <form data-form="plc-add" class="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div class="w-full sm:w-auto">
          <label for="plc-type" class="block text-xs font-medium text-gray-500">Type</label>
          <select id="plc-type" data-bind="pl.comp.form.type" class="${inputClass}">${ui.options(typeOptions, f.type)}</select>
        </div>
        <div class="w-full sm:min-w-[200px] sm:flex-1">
          <label for="plc-acct" class="block text-xs font-medium text-gray-500">Account</label>
          <input id="plc-acct" type="text" value="${esc(f.account)}" data-bind="pl.comp.form.account" placeholder="e.g. Argan Oil 100ml" class="${inputClass}">
        </div>
        <div class="w-full sm:w-auto">
          <label for="plc-unit" class="block text-xs font-medium text-gray-500">Unit</label>
          <select id="plc-unit" data-bind="pl.comp.form.unit" class="${inputClass}">${ui.options(unitOptions, f.unit)}</select>
        </div>
        <div class="w-full sm:w-32">
          <label for="plc-cost" class="block text-xs font-medium text-gray-500">Cost (EGP)</label>
          <input id="plc-cost" type="number" min="0" step="0.01" value="${esc(f.cost)}" data-bind="pl.comp.form.cost" class="${inputClass}">
        </div>
        <button type="submit" class="w-full rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 sm:w-auto">Add</button>
        ${f.error ? `<span class="text-xs text-red-600">${esc(f.error)}</span>` : ''}
      </form>

      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-medium text-gray-500">Filter:</span>
        <div class="flex flex-wrap rounded-md border border-gray-300 text-xs font-medium">
          ${[{ value: 'all', label: 'All' }, ...typeOptions]
            .map((o) => `<button type="button" data-act="plc-filter" data-v="${o.value}" class="px-3 py-1.5 ${s.filter === o.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}">${o.label}</button>`)
            .join('')}
        </div>
        <span class="text-xs text-gray-400">${filtered.length} of ${D.components.length}</span>
        ${s.rowError ? `<span class="text-xs text-red-600">${esc(s.rowError)}</span>` : ''}
        <button type="button" data-act="plc-export" ${D.components.length ? '' : 'disabled'} class="ml-auto rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40">⬇ Export to Excel</button>
      </div>

      <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500"><tr>
            <th class="px-3 py-2">Type</th><th class="px-3 py-2">Account</th><th class="px-3 py-2">Unit</th><th class="px-3 py-2 text-right">Cost / unit (EGP)</th><th class="px-3 py-2">Actions</th>
          </tr></thead>
          <tbody class="divide-y divide-gray-100">
            ${filtered.map(row).join('')}
            ${filtered.length === 0 ? '<tr><td colspan="5" class="px-3 py-4 text-center text-gray-400">No components yet. Add your first one above.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  const parseCost = (v) => (String(v).trim() === '' ? null : Number(v));

  actions['plc-add'] = () => {
    const f = state.pl.comp.form;
    f.error = null;
    if (!f.account.trim()) {
      f.error = 'Account name is required.';
      return;
    }
    const cost = parseCost(f.cost);
    if (cost !== null && !(cost >= 0)) {
      f.error = 'Cost must be zero or more.';
      return;
    }
    const id = Math.max(0, ...D.components.map((c) => c.id)) + 1;
    D.components.push({ id, type: f.type, account: f.account.trim(), unit: f.unit, cost, updatedAt: new Date().toISOString() });
    f.account = '';
    f.cost = '';
  };
  actions['plc-filter'] = (el) => {
    state.pl.comp.filter = el.dataset.v;
  };
  actions['plc-edit'] = (el) => {
    const c = comp(Number(el.dataset.id));
    state.pl.comp.edit = { id: c.id, type: c.type, account: c.account, unit: c.unit, cost: c.cost === null ? '' : String(c.cost) };
    state.pl.comp.rowError = null;
  };
  actions['plc-cancel'] = () => {
    state.pl.comp.edit = null;
  };
  actions['plc-save'] = () => {
    const s = state.pl.comp;
    const e = s.edit;
    if (!e.account.trim()) {
      s.rowError = 'Account name is required.';
      return;
    }
    Object.assign(comp(e.id), { type: e.type, account: e.account.trim(), unit: e.unit, cost: parseCost(e.cost) });
    s.edit = null;
    s.rowError = null;
  };

  function usesOf(componentId) {
    let n = 0;
    for (const p of D.singles) {
      if (p.mappings.some((m) => m.componentId === componentId) || p.variants.some((v) => v.mappings.some((m) => m.componentId === componentId))) n += 1;
    }
    for (const b of D.bundles) if (b.items.some((it) => it.kind === 'component' && it.refId === componentId)) n += 1;
    return n;
  }

  actions['plc-delete'] = (el) => {
    const s = state.pl.comp;
    const c = comp(Number(el.dataset.id));
    const uses = usesOf(c.id);
    if (uses) {
      s.rowError = `"${c.account}" is used in ${uses} product${uses === 1 ? '' : 's'} — remove it from the Final Product tab first.`;
      return;
    }
    if (!window.confirm(`Delete "${c.account}"?`)) return false;
    D.components.splice(D.components.indexOf(c), 1);
    s.rowError = null;
  };

  // A real CSV download; the byte-order mark lets Excel read non-Latin names correctly.
  actions['plc-export'] = () => {
    const rows = [['Type', 'Account', 'Unit', 'Cost/unit'], ...D.components.map((c) => [TYPE_LABEL[c.type], c.account, UNIT[c.unit], c.cost === null ? '' : String(c.cost)])];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-components-${D.TODAY}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return false;
  };

  /* ---------------- Final Product ---------------- */

  // p:<productId> = a single product's shared lines, v:<variantId> = one variant's own lines,
  // b:<bundleId> = a bundle's contents.
  function targetList(target) {
    const [kind, raw] = target.split(':');
    const id = Number(raw);
    if (kind === 'p') return single(id).mappings;
    if (kind === 'b') return D.bundles.find((b) => b.id === id).items;
    for (const p of D.singles) {
      const v = p.variants.find((x) => x.variantId === id);
      if (v) return v.mappings;
    }
    return [];
  }

  function qtyLine({ label, prefix, bg, target, ref, quantity, unitLabel, cost, kind, unit }) {
    const lineCost = cost === null ? null : kind === 'product' ? cost * quantity : D.computeLineCost(cost, unit, quantity);
    return `<div class="flex flex-wrap items-center gap-1 rounded ${bg} px-1.5 py-1">
      <span class="basis-full truncate text-xs text-gray-700" title="${esc(label)}">${prefix}${esc(label)}</span>
      <input type="number" min="0" step="0.001" value="${quantity}" aria-label="Quantity" data-in="plf-qty" data-saved="${quantity}" data-cost="${cost === null ? '' : cost}" data-kind="${kind}" data-unit="${unit}" class="w-12 rounded border border-gray-300 px-1 py-0.5 text-right text-xs">
      <span class="text-[10px] text-gray-400">${unitLabel}</span>
      <span class="flex-1 text-right text-[11px] text-gray-500" title="line cost" data-linecost>${fmt(lineCost)}</span>
      <button type="button" hidden data-act="plf-save" data-target="${target}" data-ref="${ref}" class="rounded bg-gray-900 px-1.5 py-0.5 text-[11px] text-white hover:bg-gray-700">Save</button>
      <button type="button" data-act="plf-remove" data-target="${target}" data-ref="${ref}" class="px-1 text-xs text-red-500 hover:text-red-700" title="Remove">×</button>
    </div>`;
  }

  function adder(cellKey, target, optionsHtml, hasAvailable, emptyAndNothing, unitLabel) {
    const add = state.pl.fin.add[cellKey] || { id: '', qty: '1' };
    const err = state.pl.fin.errors[cellKey];
    let html = '';
    if (hasAvailable) {
      html = `<div class="flex flex-wrap items-center gap-1">
        <select id="plf-s-${safe(cellKey)}" data-ch="plf-pick" data-cell="${cellKey}" class="min-w-0 flex-1 basis-full rounded border border-gray-300 px-1 py-1 text-xs">${optionsHtml(add.id)}</select>
        ${
          add.id
            ? `<input id="plf-q-${safe(cellKey)}" type="number" min="0" step="0.001" value="${esc(add.qty)}" aria-label="Quantity" data-bind="pl.fin.add.${cellKey}.qty" class="w-14 rounded border border-gray-300 px-1 py-1 text-right text-xs">
          ${unitLabel ? `<span class="text-[10px] text-gray-400">${unitLabel(add.id)}</span>` : ''}
          <button type="button" data-act="plf-add" data-cell="${cellKey}" data-target="${target}" class="rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-700">Add</button>`
            : ''
        }
      </div>`;
    } else if (emptyAndNothing) {
      html = '<span class="text-xs text-gray-300">—</span>';
    }
    return html + (err ? `<p class="text-[11px] text-red-600">${esc(err)}</p>` : '');
  }

  function mappingCell(target, type, list) {
    const assigned = list.filter((m) => comp(m.componentId) && comp(m.componentId).type === type);
    const used = new Set(assigned.map((m) => m.componentId));
    const available = D.components.filter((c) => c.type === type && !used.has(c.id));
    const cellKey = `${target}|${type}`;
    const options = (selected) =>
      `<option value="">+ add…</option>${available
        .map((o) => `<option value="${o.id}"${String(o.id) === selected ? ' selected' : ''}>${esc(o.account)} (${o.cost === null ? 'no cost' : `${fmt(o.cost)}/${UNIT[o.unit]}`})</option>`)
        .join('')}`;
    return `<div class="space-y-1">
      ${assigned
        .map((m) => {
          const c = comp(m.componentId);
          return qtyLine({ label: c.account, prefix: '', bg: 'bg-gray-50', target, ref: m.componentId, quantity: m.quantity, unitLabel: ALLOC[c.unit], cost: c.cost, kind: 'component', unit: c.unit });
        })
        .join('')}
      ${adder(cellKey, target, options, available.length > 0, assigned.length === 0, (id) => ALLOC[(comp(Number(id)) || { unit: 'pcs' }).unit])}
    </div>`;
  }

  function bundleCell(b) {
    const target = `b:${b.id}`;
    const cellKey = `${target}|items`;
    const usedP = new Set(b.items.filter((i) => i.kind === 'product').map((i) => i.refId));
    const usedC = new Set(b.items.filter((i) => i.kind === 'component').map((i) => i.refId));
    const members = D.singles.filter((p) => p.id !== b.id && !usedP.has(p.id));
    const others = D.components.filter((c) => c.type === 'other' && !usedC.has(c.id));
    const options = (selected) =>
      `<option value="">+ add to bundle…</option>${
        members.length
          ? `<optgroup label="Single products">${members.map((m) => `<option value="p:${m.id}"${selected === `p:${m.id}` ? ' selected' : ''}>${esc(m.name)} (built ${fmt(singleBuilt(m))})</option>`).join('')}</optgroup>`
          : ''
      }${
        others.length
          ? `<optgroup label="Other components (box)">${others
              .map((c) => `<option value="c:${c.id}"${selected === `c:${c.id}` ? ' selected' : ''}>${esc(c.account)} (${c.cost === null ? 'no cost' : `${fmt(c.cost)}/${UNIT[c.unit]}`})</option>`)
              .join('')}</optgroup>`
          : ''
      }`;
    return `<div class="space-y-1">
      ${b.items
        .map((it) => {
          if (it.kind === 'product') {
            const m = single(it.refId);
            return qtyLine({ label: m ? m.name : `Product #${it.refId}`, prefix: '', bg: 'bg-indigo-50', target, ref: `product:${it.refId}`, quantity: it.quantity, unitLabel: 'pc', cost: m ? singleBuilt(m) : null, kind: 'product', unit: 'pcs' });
          }
          const c = comp(it.refId);
          return qtyLine({ label: c.account, prefix: '<span class="mr-1 text-[9px] uppercase text-gray-400">box</span>', bg: 'bg-gray-50', target, ref: `component:${it.refId}`, quantity: it.quantity, unitLabel: ALLOC[c.unit], cost: c.cost, kind: 'component', unit: c.unit });
        })
        .join('')}
      ${adder(cellKey, target, options, members.length + others.length > 0, b.items.length === 0, null)}
    </div>`;
  }

  function finalTab() {
    const s = state.pl.fin;
    const q = s.search.trim().toLowerCase();
    const matches = (name, sku) => !q || name.toLowerCase().includes(q) || (sku || '').toLowerCase().includes(q);
    const show = (active) => s.status === 'all' || active;
    const singles = D.singles.filter((p) => show(p.isActive) && matches(p.name, p.sku));
    const bundles = D.bundles.filter((b) => show(b.isActive) && matches(b.name, null));
    const inactive = '<span class="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">inactive</span>';
    const kindToggle = (id, makeBundle) =>
      `<button type="button" data-act="plf-kind" data-id="${id}" class="mt-1 block text-[11px] text-gray-400 hover:text-gray-700 hover:underline">${makeBundle ? '→ mark as bundle' : '→ mark as single product'}</button>`;

    const singleRows = singles
      .map((p) => {
        const hasVariants = p.variants.length > 0;
        const open = hasVariants && s.expanded.includes(p.id);
        const base = mappingCosts(p.mappings);
        const head = `<tr class="align-top">
          <td class="px-3 py-2 text-gray-900">
            ${
              hasVariants
                ? `<button type="button" data-act="pl-expand" data-path="pl.fin.expanded" data-id="${p.id}" class="mr-1.5 inline-flex w-4 justify-center text-gray-400 hover:text-gray-700" aria-label="${open ? 'Collapse variants' : 'Expand variants'}">${open ? '▾' : '▸'}</button>`
                : '<span class="mr-1.5 inline-block w-4"></span>'
            }<span class="break-words">${esc(p.name)}</span>
            ${hasVariants ? `<span class="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">${p.variants.length} variants</span>` : ''}
            ${p.isActive ? '' : inactive}
            ${kindToggle(p.id, true)}
          </td>
          ${D.COMPONENT_TYPES.map((t) =>
            hasVariants && t === 'raw_material'
              ? `<td class="px-2 py-2 align-middle text-[11px] text-gray-400">per variant ${open ? '↓' : '→ expand'}</td>`
              : `<td class="px-2 py-2">${mappingCell(`p:${p.id}`, t, p.mappings)}</td>`
          ).join('')}
          <td class="px-2 py-2 text-right">
            <div class="font-medium text-gray-900">${p.mappings.length === 0 ? '—' : fmt(base.total)}</div>
            ${hasVariants ? '<div class="text-[10px] text-gray-400">shared base</div>' : base.missing ? '<div class="text-[10px] text-amber-600">some costs missing</div>' : ''}
          </td>
        </tr>`;
        const variants = open
          ? p.variants
              .map((v) => {
                const built = variantBuilt(p, v);
                return `<tr class="bg-gray-50/60 align-top">
              <td class="py-2 pl-10 pr-3 text-gray-700"><span class="break-words">${esc(v.title || v.sku)}</span>${v.sku && v.title ? `<span class="ml-2 text-[11px] text-gray-400">${esc(v.sku)}</span>` : ''}</td>
              ${D.COMPONENT_TYPES.map((t) => (t === 'raw_material' ? `<td class="px-2 py-2">${mappingCell(`v:${v.variantId}`, t, v.mappings)}</td>` : '<td class="px-2 py-2 text-[11px] text-gray-300">shared</td>')).join('')}
              <td class="px-2 py-2 text-right">
                <div class="font-medium text-gray-900">${v.mappings.length === 0 ? '—' : fmt(built.total)}</div>
                ${built.missing ? '<div class="text-[10px] text-amber-600">some costs missing</div>' : ''}
              </td>
            </tr>`;
              })
              .join('')
          : '';
        return head + variants;
      })
      .join('');

    const bundleRows = bundles
      .map((b) => {
        const cost = bundleCost(b);
        return `<tr class="align-top">
        <td class="px-3 py-2 text-gray-900"><span class="break-words">${esc(b.name)}</span>${b.isActive ? '' : inactive}${kindToggle(b.id, false)}</td>
        <td class="px-2 py-2">${bundleCell(b)}</td>
        <td class="px-2 py-2 text-right">
          <div class="font-medium text-gray-900">${b.items.length === 0 ? '—' : fmt(cost.total)}</div>
          ${cost.missing ? '<div class="text-[10px] text-amber-600">some costs missing</div>' : ''}
        </td>
      </tr>`;
      })
      .join('');

    return `<div class="space-y-5">
      <p class="text-xs text-gray-400">Single products are built from raw materials, packaging, stickers and other costs. Bundles are built from single products (and an optional box), chosen from one dropdown. Quantities: grams for KG, ml for L, pieces otherwise.</p>
      <div class="flex flex-wrap items-center gap-3">
        <input id="plf-search" value="${esc(s.search)}" data-bind="pl.fin.search" data-render placeholder="Filter by name or SKU…" class="w-64 rounded border border-gray-300 px-2 py-1.5 text-sm">
        ${statusToggle('pl.fin.status', s.status)}
      </div>

      <section class="space-y-2">
        <h2 class="text-sm font-semibold text-gray-800">Single Products <span class="font-normal text-gray-400">(${singles.length})</span></h2>
        <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white" data-scroll="plf-singles">
          <table class="w-full min-w-[900px] table-fixed divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500"><tr>
              <th class="w-[22%] px-3 py-2">Product</th>
              ${D.COMPONENT_TYPES.map((t) => `<th class="${SINGLE_COL_WIDTH[t]} px-2 py-2">${TYPE_LABEL[t]}</th>`).join('')}
              <th class="w-[12%] px-2 py-2 text-right">Built cost</th>
            </tr></thead>
            <tbody class="divide-y divide-gray-100">
              ${singleRows}
              ${singles.length === 0 ? `<tr><td colspan="${D.COMPONENT_TYPES.length + 2}" class="px-3 py-4 text-center text-gray-400">No single products match this filter.</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </section>

      <section class="space-y-2">
        <h2 class="text-sm font-semibold text-gray-800">Bundles <span class="font-normal text-gray-400">(${bundles.length})</span></h2>
        <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table class="w-full min-w-[640px] table-fixed divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500"><tr>
              <th class="w-[30%] px-3 py-2">Bundle</th><th class="w-[55%] px-2 py-2">Contents (single products + box)</th><th class="w-[15%] px-2 py-2 text-right">Built cost</th>
            </tr></thead>
            <tbody class="divide-y divide-gray-100">
              ${bundleRows}
              ${bundles.length === 0 ? '<tr><td colspan="3" class="px-3 py-4 text-center text-gray-400">No bundles match this filter.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </section>
    </div>`;
  }

  actions['plf-pick'] = (el) => {
    const s = state.pl.fin;
    s.add[el.dataset.cell] = { id: el.value, qty: (s.add[el.dataset.cell] && s.add[el.dataset.cell].qty) || '1' };
    delete s.errors[el.dataset.cell];
    if (el.value) state.focusNext = 'plf-q-' + safe(el.dataset.cell);
  };

  actions['plf-add'] = (el) => {
    const s = state.pl.fin;
    const cell = el.dataset.cell;
    const add = s.add[cell];
    const qty = Number(add.qty);
    if (!Number.isFinite(qty) || qty < 0 || String(add.qty).trim() === '') {
      s.errors[cell] = 'Bad qty';
      return;
    }
    const list = targetList(el.dataset.target);
    if (el.dataset.target.startsWith('b:')) {
      const kind = add.id.startsWith('p:') ? 'product' : 'component';
      list.push({ kind, refId: Number(add.id.slice(2)), quantity: qty });
    } else {
      list.push({ componentId: Number(add.id), quantity: qty });
    }
    delete s.add[cell];
    delete s.errors[cell];
  };

  // Typing a quantity only swaps × for Save and updates the line cost, so nothing repaints mid-edit.
  actions['plf-qty'] = (el) => {
    const box = el.parentElement;
    const text = el.value.trim();
    const dirty = text !== '' && Number(text) !== Number(el.dataset.saved);
    box.querySelector('[data-act="plf-save"]').hidden = !dirty;
    box.querySelector('[data-act="plf-remove"]').hidden = dirty;
    const cost = el.dataset.cost === '' ? null : Number(el.dataset.cost);
    const q = Number(text || 0);
    box.querySelector('[data-linecost]').textContent = fmt(cost === null ? null : el.dataset.kind === 'product' ? cost * q : D.computeLineCost(cost, el.dataset.unit, q));
    return false;
  };

  function findLine(target, ref) {
    const list = targetList(target);
    if (target.startsWith('b:')) {
      const [kind, id] = ref.split(':');
      return { list, index: list.findIndex((it) => it.kind === kind && it.refId === Number(id)) };
    }
    return { list, index: list.findIndex((m) => m.componentId === Number(ref)) };
  }

  actions['plf-save'] = (el) => {
    const q = Number(el.parentElement.querySelector('input').value);
    if (!Number.isFinite(q) || q < 0) return false;
    const { list, index } = findLine(el.dataset.target, el.dataset.ref);
    if (index >= 0) list[index].quantity = q;
  };
  actions['plf-remove'] = (el) => {
    const { list, index } = findLine(el.dataset.target, el.dataset.ref);
    if (index >= 0) list.splice(index, 1);
  };

  // Flip a product between single and bundle.
  actions['plf-kind'] = (el) => {
    const id = Number(el.dataset.id);
    const si = D.singles.findIndex((p) => p.id === id);
    if (si >= 0) {
      const [p] = D.singles.splice(si, 1);
      for (const b of D.bundles) b.items = b.items.filter((it) => !(it.kind === 'product' && it.refId === id));
      D.bundles.push({ ...p, isBundle: true, items: [], variants: [] });
    } else {
      const bi = D.bundles.findIndex((b) => b.id === id);
      const [b] = D.bundles.splice(bi, 1);
      D.singles.push({ ...b, isBundle: false, mappings: b.mappings || [], variants: b.variants || [] });
    }
    D.singles.sort(byId);
    D.bundles.sort(byId);
  };

  /* ---------------- Product List (overview) ---------------- */

  function overviewTab() {
    const s = state.pl.over;
    const toRow = (p, isBundle, cost) => ({
      id: p.id,
      name: p.name,
      isBundle,
      isActive: p.isActive,
      price: p.price ?? null,
      cost,
      margin: p.price > 0 && cost !== null ? (p.price - cost) / p.price : null,
      variants: isBundle ? [] : p.variants,
      product: p,
    });
    const rows = [
      ...D.bundles.map((b) => toRow(b, true, b.items.length ? bundleCost(b).total : null)),
      ...D.singles.map((p) => {
        const hasCost = p.mappings.length > 0 || p.variants.some((v) => v.mappings.length > 0);
        return toRow(p, false, hasCost ? singleBuilt(p) : null);
      }),
    ];
    const q = s.search.trim().toLowerCase();
    const filtered = rows.filter((r) => (s.status === 'all' || r.isActive) && (!q || r.name.toLowerCase().includes(q)));
    const fmtPct = (v) => (v === null ? '—' : `${(v * 100).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`);
    const marginCls = (v) => (v === null ? 'text-gray-300' : v < 0 ? 'text-red-600' : 'text-green-700');

    return `<div class="space-y-3">
      <p class="text-xs text-gray-400">Price is synced from Shopify; Cost is the built cost from the Final Product tab; Gross Margin = (Price − Cost) ÷ Price. Products sold in several variants (e.g. scents) can be expanded to see each variant's own price and cost.</p>
      <div class="flex flex-wrap items-center gap-3">
        <input id="plo-search" value="${esc(s.search)}" data-bind="pl.over.search" data-render placeholder="Filter by name…" class="w-64 rounded border border-gray-300 px-2 py-1.5 text-sm">
        ${statusToggle('pl.over.status', s.status)}
        <span class="text-xs text-gray-400">${filtered.length} items</span>
      </div>
      <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table class="w-full table-fixed divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500"><tr>
            <th class="w-[46%] px-3 py-2">Name</th><th class="w-[18%] px-3 py-2 text-right">Price (EGP)</th><th class="w-[18%] px-3 py-2 text-right">Cost (EGP)</th><th class="w-[18%] px-3 py-2 text-right">Gross Margin</th>
          </tr></thead>
          <tbody class="divide-y divide-gray-100">
            ${filtered
              .map((r) => {
                const canExpand = r.variants.length > 1;
                const open = canExpand && s.expanded.includes(r.id);
                const head = `<tr class="text-gray-700">
                  <td class="px-3 py-2 text-gray-900">
                    ${
                      canExpand
                        ? `<button type="button" data-act="pl-expand" data-path="pl.over.expanded" data-id="${r.id}" class="mr-1.5 inline-flex w-4 justify-center text-gray-400 hover:text-gray-700" aria-label="${open ? 'Collapse variants' : 'Expand variants'}">${open ? '▾' : '▸'}</button>`
                        : '<span class="mr-1.5 inline-block w-4"></span>'
                    }${r.isBundle ? '<span class="mr-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">bundle</span>' : ''}<span class="break-words">${esc(r.name)}</span>
                    ${canExpand ? `<span class="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">${r.variants.length} variants</span>` : ''}
                    ${r.isActive ? '' : '<span class="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">inactive</span>'}
                  </td>
                  <td class="px-3 py-2 text-right text-gray-500">${fmt(r.price)}</td>
                  <td class="px-3 py-2 text-right">${r.cost === null ? '<span class="text-gray-300">—</span>' : fmt(r.cost)}</td>
                  <td class="px-3 py-2 text-right font-medium ${marginCls(r.margin)}">${fmtPct(r.margin)}</td>
                </tr>`;
                const variants = open
                  ? r.variants
                      .map((v) => {
                        const cost = r.product.mappings.length || v.mappings.length ? variantBuilt(r.product, v).total : null;
                        const margin = v.price > 0 && cost !== null ? (v.price - cost) / v.price : null;
                        return `<tr class="bg-gray-50/60 text-gray-600">
                      <td class="py-1.5 pl-12 pr-3"><span class="break-words">${esc(v.title || v.sku)}</span>${v.sku && v.title ? `<span class="ml-2 text-xs text-gray-400">${esc(v.sku)}</span>` : ''}</td>
                      <td class="px-3 py-1.5 text-right text-gray-500">${fmt(v.price)}</td>
                      <td class="px-3 py-1.5 text-right">${cost === null ? '<span class="text-gray-300" title="Build this variant in the Final Product tab">—</span>' : fmt(cost)}</td>
                      <td class="px-3 py-1.5 text-right font-medium ${marginCls(margin)}">${fmtPct(margin)}</td>
                    </tr>`;
                      })
                      .join('')
                  : '';
                return head + variants;
              })
              .join('')}
            ${filtered.length === 0 ? '<tr><td colspan="4" class="px-3 py-4 text-center text-gray-400">No products match this filter.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  /* ---------------- Page ---------------- */

  pages['product-list'] = {
    render() {
      const tab = state.pl.tab;
      return `<div class="space-y-6">
        <div><h1 class="text-xl font-semibold text-gray-900">Product List</h1></div>
        <div class="space-y-4">
          ${ui.tabs(TABS, tab, 'pl-tab')}
          ${tab === 'components' ? componentsTab() : tab === 'final' ? finalTab() : overviewTab()}
        </div>
      </div>`;
    },
  };
})();
