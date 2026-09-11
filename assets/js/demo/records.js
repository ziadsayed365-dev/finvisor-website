// Expense & Income page: record cash in and out (add, filter, edit, bulk delete, one-step undo) and
// the Report tab, a cash-flow summary of everything recorded.
(function () {
  'use strict';
  const Demo = window.Demo;
  const { D, state, pages, actions, ui, esc } = Demo;

  const TABS = [
    { key: 'expenses', label: 'Expense & Income' },
    { key: 'report', label: 'Report' },
  ];

  state.rd = {
    tab: 'expenses',
    form: { date: D.TODAY, accountTypeId: String(D.ACCOUNT_TYPES[0].id), description: '', amount: '', error: null },
    filter: { from: '', to: '', accountTypeIds: [], kind: 'all', descriptions: [] },
    selected: [],
    edit: null,
    last: null, // single-level undo: { kind: 'add', id } | { kind: 'edit', id, previous } | { kind: 'delete', previous }
    report: { from: '', to: D.TODAY },
  };

  const accountType = (id) => D.ACCOUNT_TYPES.find((t) => t.id === Number(id));
  const accountOptions = D.ACCOUNT_TYPES.map((t) => ({ value: t.id, label: t.name }));
  const sortRecords = (list) => list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  const now = () => new Date().toISOString();

  // Expenses show negative and income positive; the stored amount is always positive.
  function fmtSignedAmount(amount, type) {
    const signed = type === 'expense' ? -amount : amount;
    const formatted = Math.abs(signed).toLocaleString('en-US', { maximumFractionDigits: 2 });
    return (signed < 0 ? `-${formatted}` : formatted) + ' EGP';
  }

  const kindBadge = (type, extra = '') =>
    `<span class="rounded px-1.5 py-0.5 ${extra} font-medium ${type === 'income' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">${
      type === 'income' ? 'Income' : 'Expense'
    }</span>`;

  function descriptionOptions() {
    const unique = [...new Set(state.records.map((r) => r.description).filter((d) => d && d.trim() !== ''))];
    return unique.sort((a, b) => a.localeCompare(b)).map((d) => ({ value: d, label: d }));
  }

  // Only account types that appear in the data are offered as filters, like an Excel column filter.
  function accountFilterOptions() {
    const byId = new Map();
    for (const r of state.records) byId.set(r.accountTypeId, r.accountTypeName);
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => ({ value: String(id), label: name }));
  }

  function filteredRecords() {
    const f = state.rd.filter;
    return state.records.filter((r) => {
      if (f.from && r.date < f.from) return false;
      if (f.to && r.date > f.to) return false;
      if (f.accountTypeIds.length && !f.accountTypeIds.includes(String(r.accountTypeId))) return false;
      if (f.kind !== 'all' && r.type !== f.kind) return false;
      if (f.descriptions.length && !f.descriptions.includes(r.description || '')) return false;
      return true;
    });
  }

  /* ---------------- Expense & Income tab ---------------- */

  function expensesTab() {
    const rd = state.rd;
    const f = rd.form;
    const filtered = filteredRecords();
    const selected = new Set(rd.selected);
    const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
    const inputClass = 'mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm';
    const filterClass = 'w-full rounded border border-gray-200 px-1.5 py-1 text-xs';
    const editInputClass = 'w-full rounded border border-gray-300 px-1.5 py-1 text-xs';
    const e = rd.edit;

    const editFields = (prefix) => ({
      date: `<input id="${prefix}-date" type="date" value="${esc(e.date)}" data-bind="rd.edit.date" class="${editInputClass}">`,
      account: `<select id="${prefix}-acct" data-bind="rd.edit.accountTypeId" data-render class="${editInputClass}">${ui.options(accountOptions, e.accountTypeId)}</select>`,
      description: `<input id="${prefix}-desc" type="text" value="${esc(e.description)}" data-bind="rd.edit.description" class="${editInputClass}">`,
      amount: `<input id="${prefix}-amt" type="number" min="0.01" step="0.01" value="${esc(e.amount)}" data-bind="rd.edit.amount" class="${editInputClass}">`,
    });

    const desktopRow = (r) => {
      if (e && e.id === r.id) {
        const x = editFields('rde');
        const previewType = (accountType(e.accountTypeId) || r).type;
        return `<tr class="bg-blue-50/40">
          <td class="px-3 py-2"></td>
          <td class="px-3 py-2">${x.date}</td>
          <td class="px-3 py-2">${x.account}</td>
          <td class="px-3 py-2">${kindBadge(previewType, 'text-xs')}</td>
          <td class="px-3 py-2">${x.description}</td>
          <td class="px-3 py-2">${x.amount}</td>
          <td class="px-3 py-2"><div class="flex flex-col gap-1">
            <div class="flex gap-1">
              <button type="button" data-act="rd-save" class="rounded bg-gray-900 px-2 py-0.5 text-xs font-medium text-white hover:bg-gray-700">Save</button>
              <button type="button" data-act="rd-cancel" class="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
            </div>
            ${e.error ? `<span class="text-[11px] text-red-600">${esc(e.error)}</span>` : ''}
          </div></td>
        </tr>`;
      }
      return `<tr class="text-gray-700">
        <td class="px-3 py-2"><input type="checkbox" data-ch="rd-sel" data-id="${r.id}"${selected.has(r.id) ? ' checked' : ''} aria-label="Select record ${r.id}"></td>
        <td class="px-3 py-2">${r.date}</td>
        <td class="px-3 py-2">${esc(r.accountTypeName)}</td>
        <td class="px-3 py-2">${kindBadge(r.type, 'text-xs')}</td>
        <td class="truncate px-3 py-2">${esc(r.description)}</td>
        <td class="px-3 py-2 text-right ${r.type === 'expense' ? 'text-red-700' : 'text-green-700'}">${fmtSignedAmount(r.amount, r.type)}</td>
        <td class="px-3 py-2"><button type="button" data-act="rd-edit" data-id="${r.id}" class="text-xs font-medium text-gray-600 hover:underline">Edit</button></td>
      </tr>`;
    };

    const mobileRow = (r) => {
      if (e && e.id === r.id) {
        const x = editFields('rdm');
        return `<div class="space-y-2 bg-blue-50/40 p-3">
          <div><label class="block text-xs font-medium text-gray-500">Date</label>${x.date}</div>
          <div><label class="block text-xs font-medium text-gray-500">Account type</label>${x.account}</div>
          <div><label class="block text-xs font-medium text-gray-500">Description</label>${x.description}</div>
          <div><label class="block text-xs font-medium text-gray-500">Amount (EGP)</label>${x.amount}</div>
          <div class="flex gap-1">
            <button type="button" data-act="rd-save" class="rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-700">Save</button>
            <button type="button" data-act="rd-cancel" class="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          </div>
          ${e.error ? `<span class="text-[11px] text-red-600">${esc(e.error)}</span>` : ''}
        </div>`;
      }
      return `<div class="flex items-start gap-2 p-3">
        <input type="checkbox" data-ch="rd-sel" data-id="${r.id}"${selected.has(r.id) ? ' checked' : ''} aria-label="Select record ${r.id}" class="mt-1">
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm text-gray-900">${r.date}</span>
            <span class="text-sm font-medium ${r.type === 'expense' ? 'text-red-700' : 'text-green-700'}">${fmtSignedAmount(r.amount, r.type)}</span>
          </div>
          <div class="mt-1 flex items-center gap-2 text-xs">${kindBadge(r.type)}<span class="truncate text-gray-500">${esc(r.accountTypeName)}</span></div>
          ${r.description ? `<div class="mt-1 truncate text-xs text-gray-600">${esc(r.description)}</div>` : ''}
          <button type="button" data-act="rd-edit" data-id="${r.id}" class="mt-1 text-xs font-medium text-gray-600 hover:underline">Edit</button>
        </div>
      </div>`;
    };

    const last = rd.last;
    return `<div class="space-y-4">
      <form data-form="rd-add" class="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div class="w-full sm:w-auto">
          <label for="rd-date" class="block text-xs font-medium text-gray-500">Date</label>
          <input id="rd-date" type="date" value="${esc(f.date)}" data-bind="rd.form.date" required class="${inputClass}">
        </div>
        <div class="w-full sm:w-auto">
          <label for="rd-acct" class="block text-xs font-medium text-gray-500">Account type</label>
          <select id="rd-acct" data-bind="rd.form.accountTypeId" required class="${inputClass}">${ui.options(accountOptions, f.accountTypeId)}</select>
        </div>
        <div class="w-full sm:min-w-[180px] sm:flex-1">
          <label for="rd-desc" class="block text-xs font-medium text-gray-500">Description</label>
          <input id="rd-desc" type="text" value="${esc(f.description)}" data-bind="rd.form.description" class="${inputClass}">
        </div>
        <div class="w-full sm:w-auto">
          <label for="rd-amt" class="block text-xs font-medium text-gray-500">Amount (EGP)</label>
          <input id="rd-amt" type="number" min="0.01" step="0.01" value="${esc(f.amount)}" data-bind="rd.form.amount" required class="${inputClass}">
        </div>
        <button type="submit" class="w-full rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 sm:w-auto">Add</button>
        ${f.error ? `<span class="text-xs text-red-600">${esc(f.error)}</span>` : ''}
      </form>

      ${
        last
          ? `<div class="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <span>${last.kind === 'add' ? 'Record added.' : last.kind === 'edit' ? 'Record updated.' : `${last.previous.length} record(s) deleted.`}</span>
          <button type="button" data-act="rd-undo" class="rounded bg-blue-700 px-3 py-1 text-xs font-medium text-white hover:bg-blue-800">Undo</button>
        </div>`
          : ''
      }

      ${
        rd.selected.length
          ? `<div class="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          <span class="text-amber-800">${rd.selected.length} selected</span>
          <button type="button" data-act="rd-delete" class="rounded bg-red-700 px-3 py-1 text-xs font-medium text-white hover:bg-red-800">Delete selected</button>
          <button type="button" data-act="rd-clear-sel" class="text-xs text-amber-800 hover:underline">Clear selection</button>
        </div>`
          : ''
      }

      <div class="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div>
          <label for="rdf-from" class="block text-xs font-medium text-gray-500">From</label>
          <input id="rdf-from" type="date" value="${esc(rd.filter.from)}" data-bind="rd.filter.from" data-render class="${filterClass} w-auto">
        </div>
        <div>
          <label for="rdf-to" class="block text-xs font-medium text-gray-500">To</label>
          <input id="rdf-to" type="date" value="${esc(rd.filter.to)}" data-bind="rd.filter.to" data-render class="${filterClass} w-auto">
        </div>
        <div class="w-36">
          <label class="block text-xs font-medium text-gray-500">Account type</label>
          ${ui.multiSelect({ key: 'rd-acct', options: accountFilterOptions(), selected: rd.filter.accountTypeIds, act: 'rd-ms-acct' })}
        </div>
        <div class="w-28">
          <label for="rdf-kind" class="block text-xs font-medium text-gray-500">Kind</label>
          <select id="rdf-kind" data-bind="rd.filter.kind" data-render class="${filterClass}">${ui.options(
            [
              { value: 'all', label: 'All' },
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
            ],
            rd.filter.kind
          )}</select>
        </div>
        <div class="w-36">
          <label class="block text-xs font-medium text-gray-500">Description</label>
          ${ui.multiSelect({ key: 'rd-desc', options: descriptionOptions(), selected: rd.filter.descriptions, act: 'rd-ms-desc' })}
        </div>
      </div>

      <div class="hidden overflow-x-auto rounded-lg border border-gray-200 sm:block">
        <table class="w-full table-fixed text-sm">
          <thead class="bg-gray-50 text-left text-xs font-medium uppercase text-gray-400">
            <tr>
              <th class="w-[4%] px-3 py-2"><input type="checkbox" data-ch="rd-sel-all"${allVisibleSelected ? ' checked' : ''} aria-label="Select all"></th>
              <th class="w-[15%] px-3 py-2">Date</th>
              <th class="w-[18%] px-3 py-2">Account type</th>
              <th class="w-[9%] px-3 py-2">Kind</th>
              <th class="w-[28%] px-3 py-2">Description</th>
              <th class="w-[16%] px-3 py-2 text-right">Amount</th>
              <th class="w-[10%] px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${filtered.map(desktopRow).join('')}
            ${filtered.length === 0 ? '<tr><td colspan="7" class="px-3 py-4 text-center text-gray-400">No records match these filters.</td></tr>' : ''}
          </tbody>
        </table>
      </div>

      <div class="divide-y divide-gray-100 rounded-lg border border-gray-200 sm:hidden">
        ${filtered.map(mobileRow).join('')}
        ${filtered.length === 0 ? '<div class="p-4 text-center text-sm text-gray-400">No records match these filters.</div>' : ''}
      </div>
    </div>`;
  }

  /* ---------------- Report tab ---------------- */

  function reportTab() {
    const rep = state.rd.report;
    const filtered = state.records.filter((r) => (!rep.from || r.date >= rep.from) && (!rep.to || r.date <= rep.to));
    const byAccount = new Map();
    for (const r of filtered) byAccount.set(r.accountTypeId, (byAccount.get(r.accountTypeId) || 0) + (r.type === 'expense' ? -r.amount : r.amount));
    const rowsOf = (type) =>
      D.ACCOUNT_TYPES.filter((t) => t.type === type)
        .map((t) => ({ id: t.id, name: t.name, amount: byAccount.get(t.id) || 0 }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    const incomeRows = rowsOf('income');
    const expenseRows = rowsOf('expense');
    const totalIncome = incomeRows.reduce((s, r) => s + r.amount, 0);
    const totalExpense = expenseRows.reduce((s, r) => s + r.amount, 0);
    const net = totalIncome + totalExpense;
    const fmtAmount = (n) => (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' EGP';
    const pctOfCashIn = (n) => (totalIncome ? `${((n / totalIncome) * 100).toFixed(1)}%` : '—');
    const inputClass = 'mt-1 rounded border border-gray-300 px-2 py-1 text-sm';
    const row = (r, color) => `<tr class="text-gray-700">
        <td class="px-3 py-2">${esc(r.name)}</td>
        <td class="px-3 py-2 text-right ${color}">${fmtAmount(r.amount)}</td>
        <td class="px-3 py-2 text-right text-gray-500">${pctOfCashIn(r.amount)}</td>
      </tr>`;

    return `<div class="space-y-4">
      <div class="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label for="rp-from" class="block text-xs font-medium text-gray-500">From</label>
          <input id="rp-from" type="date" value="${esc(rep.from)}" data-bind="rd.report.from" data-render class="${inputClass}">
        </div>
        <div>
          <label for="rp-to" class="block text-xs font-medium text-gray-500">To</label>
          <input id="rp-to" type="date" value="${esc(rep.to)}" data-bind="rd.report.to" data-render class="${inputClass}">
        </div>
        ${rep.from ? '<button type="button" data-act="rp-clear" class="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700">Clear from (all time)</button>' : ''}
      </div>
      <div class="overflow-x-auto rounded-lg border border-gray-200">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left text-xs font-medium uppercase text-gray-400">
            <tr><th class="px-3 py-2">Account</th><th class="px-3 py-2 text-right">Amount</th><th class="px-3 py-2 text-right">% of Cash In</th></tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${incomeRows.map((r) => row(r, 'text-green-700')).join('')}
            <tr class="border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-900">
              <td class="px-3 py-2">Total Income</td><td class="px-3 py-2 text-right text-green-700">${fmtAmount(totalIncome)}</td><td class="px-3 py-2 text-right">${pctOfCashIn(totalIncome)}</td>
            </tr>
            ${expenseRows.map((r) => row(r, 'text-red-700')).join('')}
            <tr class="border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-900">
              <td class="px-3 py-2">Total Expense</td><td class="px-3 py-2 text-right text-red-700">${fmtAmount(totalExpense)}</td><td class="px-3 py-2 text-right">${pctOfCashIn(totalExpense)}</td>
            </tr>
            <tr class="border-t-2 border-gray-400 font-bold ${net >= 0 ? 'text-green-700' : 'text-red-700'}">
              <td class="px-3 py-2">Net Cash Flow</td><td class="px-3 py-2 text-right">${fmtAmount(net)}</td><td class="px-3 py-2 text-right">${pctOfCashIn(net)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
  }

  /* ---------------- Page ---------------- */

  pages['record-data'] = {
    render() {
      return `<div class="space-y-6">
        <div><h1 class="text-xl font-semibold text-gray-900">Expense & Income</h1></div>
        <div class="space-y-4">
          ${ui.tabs(TABS, state.rd.tab, 'rd-tab')}
          ${state.rd.tab === 'expenses' ? expensesTab() : reportTab()}
        </div>
      </div>`;
    },
  };

  actions['rd-tab'] = (el) => {
    state.rd.tab = el.dataset.v;
  };

  actions['rd-add'] = () => {
    const f = state.rd.form;
    f.error = null;
    const amount = Number(f.amount);
    const t = accountType(f.accountTypeId);
    if (!f.date || !t || !(amount > 0)) {
      f.error = 'Date, account type, and a positive amount are required.';
      return;
    }
    const rec = { id: Demo.nextId(), date: f.date, accountTypeId: t.id, accountTypeName: t.name, type: t.type, description: f.description, amount, updatedAt: now() };
    state.records = sortRecords([rec, ...state.records]);
    state.rd.last = { kind: 'add', id: rec.id };
    f.description = '';
    f.amount = '';
  };

  actions['rd-ms-acct'] = (el) => {
    state.rd.filter.accountTypeIds = Demo.applyMultiSelect(state.rd.filter.accountTypeIds, accountFilterOptions(), el);
  };
  actions['rd-ms-desc'] = (el) => {
    state.rd.filter.descriptions = Demo.applyMultiSelect(state.rd.filter.descriptions, descriptionOptions(), el);
  };

  actions['rd-sel'] = (el) => {
    const id = Number(el.dataset.id);
    const sel = state.rd.selected;
    state.rd.selected = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
  };
  actions['rd-sel-all'] = () => {
    const filtered = filteredRecords();
    const all = filtered.length > 0 && filtered.every((r) => state.rd.selected.includes(r.id));
    state.rd.selected = all ? [] : filtered.map((r) => r.id);
  };
  actions['rd-clear-sel'] = () => {
    state.rd.selected = [];
  };
  actions['rd-delete'] = () => {
    const ids = state.rd.selected;
    if (!ids.length || !window.confirm(`Delete ${ids.length} record(s)?`)) return false;
    const previous = state.records.filter((r) => ids.includes(r.id));
    state.records = state.records.filter((r) => !ids.includes(r.id));
    state.rd.last = { kind: 'delete', previous };
    state.rd.selected = [];
  };

  actions['rd-edit'] = (el) => {
    const r = state.records.find((x) => x.id === Number(el.dataset.id));
    state.rd.edit = { id: r.id, date: r.date, accountTypeId: String(r.accountTypeId), description: r.description || '', amount: String(r.amount), original: r, error: null };
  };
  actions['rd-cancel'] = () => {
    state.rd.edit = null;
  };
  actions['rd-save'] = () => {
    const e = state.rd.edit;
    const amount = Number(e.amount);
    const t = accountType(e.accountTypeId);
    if (!e.date || !t || !(amount > 0)) {
      e.error = 'Date, account type, and a positive amount are required.';
      return;
    }
    const updated = { ...e.original, date: e.date, accountTypeId: t.id, accountTypeName: t.name, type: t.type, description: e.description, amount, updatedAt: now() };
    state.records = sortRecords(state.records.map((r) => (r.id === e.id ? updated : r)));
    state.rd.last = { kind: 'edit', id: e.id, previous: e.original };
    state.rd.edit = null;
  };

  actions['rd-undo'] = () => {
    const last = state.rd.last;
    if (!last) return false;
    if (last.kind === 'add') state.records = state.records.filter((r) => r.id !== last.id);
    else if (last.kind === 'edit') state.records = sortRecords(state.records.map((r) => (r.id === last.id ? { ...last.previous, updatedAt: now() } : r)));
    else state.records = sortRecords([...state.records, ...last.previous.map((r) => ({ ...r, updatedAt: now() }))]);
    state.rd.last = null;
  };

  actions['rp-clear'] = () => {
    state.rd.report.from = '';
  };
})();
