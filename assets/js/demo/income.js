// Income Statement page: Performance / Actual tabs, summary cards for a chosen period, and the
// day-by-day or month-by-month statement with the Actual and Meta Dashboard ratio blocks.
(function () {
  'use strict';
  const Demo = window.Demo;
  const { D, state, pages, actions, modals, ui, esc, fmtEgp, fmtMoney, pct, fmtDay, fmtMonth, fmtMonthShort, fmtMonYear, isMobile } = Demo;
  const BRAND_NAVY = '#050a30';
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const FIXED = D.PERF_EXPENSE_ACCOUNTS.filter((a) => a.section === 'fixed');
  const OTHER = D.PERF_EXPENSE_ACCOUNTS.filter((a) => a.section === 'other');
  const SUMMABLE = [
    'ordersPlaced', 'ordersResolved', 'ordersReceived', 'ordersDelivered', 'itemsSold', 'revenue', 'cogs', 'grossRevenue', 'grossCogs',
    'grossProfit', 'adSpend', 'adSpendMeta', 'adSpendTiktok', 'contributionProfit', 'packaging', 'transportation', 'shippingFeeCharged',
    'bostaFeesPaid', 'shippingDifferencesFee', 'salaries', 'rent', 'bostaPenalty', 'nextDayFee',
  ];

  const TABS = [
    { key: 'performance', label: 'Income Statement - Performance', subtitle: 'Every Shopify order, whether or not it has shipped yet.' },
    { key: 'actual', label: 'Income Statement - Actual', subtitle: 'Only orders actually handed to a courier (Bosta, Turbo or Quick Connect) for delivery.' },
  ];

  const defaultFrom = D.addDays(D.TODAY, -30);
  state.is = {
    mode: 'performance',
    granularity: 'daily',
    from: defaultFrom,
    to: D.TODAY,
    draftFrom: defaultFrom,
    draftTo: D.TODAY,
    windowEnd: null, // last day shown in the daily view; null = the latest
    monthEnd: null, // index just past the last month shown; null = the latest
  };

  /* ---------------- Data ---------------- */

  // The rows a mode really has: the Actual view only starts once shipments were being recorded.
  const modeRows = (mode) => {
    const rows = D.dailyRows(mode);
    return mode === 'actual' ? rows.filter((r) => r.date >= D.ACTUAL_START) : rows;
  };

  function monthRate(mode, month) {
    const key = month.slice(0, 7);
    let received = 0;
    let delivered = 0;
    for (const r of D.dailyRows(mode)) {
      if (!r.date.startsWith(key)) continue;
      received += r.ordersReceived;
      delivered += r.ordersDelivered;
    }
    return received ? delivered / received : null;
  }

  const openMonthInfo = (mode) => ({ month: D.OPEN_MONTH, sourceMonth: D.PREV_MONTH, rate: monthRate(mode, D.PREV_MONTH) ?? 0 });
  const expectedRate = (mode) => ({ rate: monthRate(mode, D.PREV_MONTH), month: fmtMonYear(D.PREV_MONTH) });

  // One day's share of the Settings fixed expenses, and of the Other-Expense / Other-Income net.
  function dayExpenses(date) {
    const monthly = D.resolvePerfExpensesForMonth(state.perfHistory, date);
    const days = D.daysInMonth(date);
    return {
      fixed: FIXED.reduce((s, a) => s + monthly[a.key], 0) / days,
      otherNet: OTHER.reduce((s, a) => s + (a.nature === 'income' ? monthly[a.key] : -monthly[a.key]), 0) / days,
    };
  }

  // Recorded Expense & Income totals per closed month, per Settings account (matched by name).
  const KEY_BY_LABEL = Object.fromEntries(D.PERF_EXPENSE_ACCOUNTS.map((a) => [a.label, a.key]));
  function recordedByMonth() {
    const out = {};
    for (const r of state.records) {
      const key = KEY_BY_LABEL[r.accountTypeName];
      if (!key) continue;
      const m = D.firstOfMonth(r.date);
      out[m] = out[m] || {};
      out[m][key] = (out[m][key] || 0) + r.amount;
    }
    return out;
  }

  function totalsFor(mode, from, to) {
    const t = { ordersPlaced: 0, itemsSold: 0, adSpendMeta: 0, adSpendTiktok: 0, revenue: 0, contributionProfit: 0, netProfit: 0, ordersDelivered: 0, ordersReceived: 0 };
    for (const r of modeRows(mode)) {
      if (r.date < from || r.date > to) continue;
      for (const k of Object.keys(t)) if (k !== 'netProfit') t[k] += r[k];
      const e = dayExpenses(r.date);
      t.netProfit += r.contributionProfit - e.fixed + r.shippingDifferencesFee - r.bostaPenalty - r.nextDayFee + e.otherNet;
    }
    return t;
  }

  Demo.pnl = { modeRows, dayExpenses, monthRate };

  /* ---------------- Statement lines ---------------- */

  function buildLines(cols, opts) {
    const revenue = cols.map((r) => r.revenue);
    const grossProfit = cols.map((r) => r.grossProfit);
    const contributionProfit = cols.map((r) => r.contributionProfit);
    const revenueTotal = sum(revenue);
    const pctOfRevenueTotal = (n) => (revenueTotal ? (n / revenueTotal) * 100 : 0);
    const margin = (vals) => vals.map((v, i) => (revenue[i] ? (v / revenue[i]) * 100 : 0));
    const receivedTotal = sum(cols.map((r) => r.ordersReceived));
    const deliveredTotal = sum(cols.map((r) => r.ordersDelivered));

    // A single day's own delivery rate reads near 0% (its orders have not arrived yet), so the
    // daily view shows the last closed month's rate instead; the monthly view shows each month's.
    const expected = opts.expected;
    const expectedPct = expected && expected.rate != null ? expected.rate * 100 : null;

    const head = [
      expectedPct !== null
        ? { label: `Delivery Rate (expected, ${expected.month})`, values: cols.map(() => expectedPct), total: expectedPct, kind: 'percent', small: true }
        : {
            label: 'Delivery Rate',
            values: cols.map((r) => (r.ordersReceived ? (r.ordersDelivered / r.ordersReceived) * 100 : 0)),
            total: receivedTotal ? (deliveredTotal / receivedTotal) * 100 : 0,
            kind: 'percent',
            small: true,
          },
      { label: 'Delivered / Orders', values: cols.map((r) => r.ordersDelivered), ratioTotals: cols.map((r) => r.ordersReceived), kind: 'ratio', small: true },
      { label: 'Total Items Sold', values: cols.map((r) => r.itemsSold), kind: 'count', small: true },
      { label: 'Total Revenue', values: revenue, kind: 'money-profit', band: 1, blankBefore: true },
      { label: 'Total Cost', values: cols.map((r) => -r.cogs), kind: 'money-cost', band: 1 },
      { label: 'Gross Profit', values: grossProfit, kind: 'money-profit', bold: true, subtotal: true },
      { label: 'Gross Margin %', values: margin(grossProfit), total: pctOfRevenueTotal(sum(grossProfit)), kind: 'percent', small: true },
      { label: 'Meta Ads', values: cols.map((r) => -r.adSpendMeta), kind: 'money-cost', band: 2, blankBefore: true },
      { label: 'TikTok Ads', values: cols.map((r) => -r.adSpendTiktok), kind: 'money-cost', band: 2 },
      { label: 'Contribution Profit', values: contributionProfit, kind: 'money-profit', bold: true, subtotal: true },
      { label: 'Contribution Margin %', values: margin(contributionProfit), total: pctOfRevenueTotal(sum(contributionProfit)), kind: 'percent', small: true },
    ];

    // Actual ratios haircut the all-orders (Meta Dashboard) figures by the delivery rate shown at
    // the top of the same column, so the gap between the two blocks is the cost of failed deliveries.
    const marketing = cols.map((r) => r.adSpend);
    const grossRev = cols.map((r) => r.grossRevenue);
    const grossCogs = cols.map((r) => r.grossCogs);
    const placed = cols.map((r) => r.ordersPlaced);
    const safe = (n, d) => (d ? n / d : 0);
    const tMkt = sum(marketing);
    const tGrossRev = sum(grossRev);
    const tGrossCogs = sum(grossCogs);
    const tPlaced = sum(placed);
    const rate = cols.map((r) =>
      opts.monthly ? (r.ordersReceived ? r.ordersDelivered / r.ordersReceived : 1) : expected && expected.rate != null ? expected.rate : 1
    );
    const realRev = grossRev.map((v, i) => v * rate[i]);
    const realCogs = grossCogs.map((v, i) => v * rate[i]);
    const realOrders = placed.map((v, i) => v * rate[i]);

    const ratioLines = (net) => {
      const fixedCost = cols.map((_, i) => contributionProfit[i] - net[i]);
      const tFixed = sum(fixedCost);
      const tRealRev = sum(realRev);
      const tRealCogs = sum(realCogs);
      const tRealOrders = sum(realOrders);
      const cpaLimit = cols.map((_, i) => safe(realRev[i] - realCogs[i], realOrders[i]));
      const cpaLimitTotal = safe(tRealRev - tRealCogs, tRealOrders);
      return [
        { label: 'Actual Ratios', values: cols.map(() => 0), kind: 'header', bold: true, blankBefore: true },
        { label: 'ROAS', values: cols.map((_, i) => safe(realRev[i], marketing[i])), total: safe(tRealRev, tMkt), kind: 'decimal', small: true },
        {
          label: 'Break-Even ROAS',
          values: cols.map((_, i) => safe(realCogs[i] + marketing[i] + fixedCost[i], marketing[i])),
          total: safe(tRealCogs + tMkt + tFixed, tMkt),
          kind: 'decimal',
          small: true,
        },
        { label: 'CPA', values: cols.map((_, i) => safe(marketing[i], realOrders[i])), total: safe(tMkt, tRealOrders), kind: 'money-profit', small: true },
        { label: 'CPA Limit', values: cpaLimit, total: cpaLimitTotal, kind: 'money-profit', small: true },
        { label: 'Fixed Cost / Order', values: cols.map((_, i) => safe(fixedCost[i], realOrders[i])), total: safe(tFixed, tRealOrders), kind: 'money-profit', small: true },
        { label: 'Meta Dashboard Ratios', values: cols.map(() => 0), kind: 'header', bold: true, blankBefore: true },
        { label: 'ROAS', values: cols.map((_, i) => safe(grossRev[i], marketing[i])), total: safe(tGrossRev, tMkt), kind: 'decimal', small: true },
        {
          label: 'Break-Even ROAS',
          values: cols.map((_, i) => safe(grossCogs[i] + marketing[i] + fixedCost[i], marketing[i])),
          total: safe(tGrossCogs + tMkt + tFixed, tMkt),
          kind: 'decimal',
          small: true,
        },
        { label: 'CPA', values: cols.map((_, i) => safe(marketing[i], placed[i])), total: safe(tMkt, tPlaced), kind: 'money-profit', small: true },
        { label: 'CPA Limit', values: cpaLimit, total: cpaLimitTotal, kind: 'money-profit', small: true },
        { label: 'Fixed Cost / Order', values: cols.map((_, i) => safe(fixedCost[i], placed[i])), total: safe(tFixed, tPlaced), kind: 'money-profit', small: true },
      ];
    };

    // Below Contribution Profit sit the owner's monthly fixed-expense accounts from Settings. A
    // closed month in the monthly view shows what was actually recorded; otherwise the Settings
    // figure is used (spread over the month's days in the daily view).
    const recorded = opts.monthly ? recordedByMonth() : null;
    const perColumn = (key) =>
      cols.map((r) => {
        const monthStart = D.firstOfMonth(r.date);
        if (recorded && monthStart < D.OPEN_MONTH) return (recorded[monthStart] && recorded[monthStart][key]) || 0;
        const monthly = D.resolvePerfExpensesForMonth(state.perfHistory, r.date)[key];
        return opts.monthly ? monthly : monthly / D.daysInMonth(r.date);
      });
    const values = Object.fromEntries(D.PERF_EXPENSE_ACCOUNTS.map((a) => [a.key, perColumn(a.key)]));
    const sumOf = (accs) => cols.map((_, i) => accs.reduce((s, a) => s + values[a.key][i], 0));
    const fixedSum = sumOf(FIXED);
    const otherExpense = sumOf(OTHER.filter((a) => a.nature === 'expense'));
    const otherIncome = sumOf(OTHER.filter((a) => a.nature === 'income'));
    const shippingDifferences = cols.map((r) => r.shippingDifferencesFee);
    const penalty = cols.map((r) => r.bostaPenalty);
    const nextDayFees = cols.map((r) => r.nextDayFee);
    const net = contributionProfit.map((v, i) => v - fixedSum[i] + shippingDifferences[i] - penalty[i] - nextDayFees[i] - otherExpense[i] + otherIncome[i]);

    const cost = (label, vals, blankBefore) => ({ label, values: vals.map((v) => -v), kind: 'money-cost', band: 3, blankBefore });
    const accountLine = (a) =>
      a.nature === 'income' ? { label: a.label, values: values[a.key], kind: 'money-profit', band: 3 } : cost(a.label, values[a.key]);

    return [
      ...head,
      ...FIXED.map((a, i) => cost(a.label, values[a.key], i === 0)),
      { label: 'Shipping Differences', values: shippingDifferences, kind: 'money-profit', band: 3 },
      cost('Bosta Penalty', penalty),
      cost('Bosta Next Day fees', nextDayFees),
      ...OTHER.map(accountLine),
      { label: 'Net Profit', values: net, kind: 'money-profit', bold: true, subtotal: true },
      { label: 'Net Margin %', values: margin(net), total: pctOfRevenueTotal(sum(net)), kind: 'percent', small: true },
      ...ratioLines(net),
    ];
  }

  function lineRow(line) {
    const bg = line.band !== undefined ? 'bg-gray-200' : '';
    const size = line.small ? 'text-xs' : 'text-sm';
    const style = line.small ? ` style="color:${BRAND_NAVY}"` : '';
    const top = line.subtotal ? 'border-t-2 border-t-gray-400' : '';
    const total =
      line.kind === 'ratio' ? sum(line.values) : line.kind === 'percent' || line.kind === 'decimal' ? line.total ?? 0 : line.total ?? sum(line.values);
    const text = (v, den) =>
      line.kind === 'header'
        ? ''
        : line.kind === 'decimal'
          ? v.toFixed(2)
          : line.kind === 'percent'
            ? `${v.toFixed(0)}%`
            : line.kind === 'ratio'
              ? `${v}/${den}`
              : line.kind === 'count'
                ? v
                : fmtMoney(v);
    const cell = (v, den, extra) => {
      const color = line.subtotal && v < 0 ? 'text-red-700' : 'text-gray-900';
      return `<td class="${top} ${extra} px-4 py-1.5 text-right ${size} ${line.bold ? `font-bold ${color}` : color}"${style}>${text(v, den)}</td>`;
    };
    return `${line.blankBefore ? `<tr><td class="h-3" colspan="${line.values.length + 2}"></td></tr>` : ''}<tr class="${bg}">
      <td class="${top} px-2 py-1.5 ${size} ${line.bold ? 'font-bold text-gray-900' : 'text-gray-700'}"${style}>${esc(line.label)}</td>
      ${line.values.map((v, i) => cell(v, line.ratioTotals && line.ratioTotals[i], '')).join('')}
      ${cell(total, line.kind === 'ratio' ? sum(line.ratioTotals) : 0, 'border-l-2 border-l-gray-400')}
    </tr>`;
  }

  function statementTable(headers, lines, scrollKey) {
    return `<div class="overflow-x-auto rounded-lg border border-gray-200" data-scroll="${scrollKey}">
      <table class="w-full text-sm">
        <thead><tr class="border-b-2 border-gray-300 bg-gray-200">
          <th class="px-2 py-2 text-left text-xs font-medium uppercase text-gray-400">Line item</th>
          ${headers.map((h) => `<th class="px-4 py-2 text-right text-sm font-semibold text-gray-900">${h}</th>`).join('')}
          <th class="border-l-2 border-l-gray-400 px-4 py-2 text-right text-sm font-semibold text-gray-900">Total</th>
        </tr></thead>
        <tbody>${lines.map(lineRow).join('')}</tbody>
      </table>
    </div>`;
  }

  function settlingNotice(mode) {
    const info = openMonthInfo(mode);
    const open = modeRows(mode).filter((r) => r.date >= info.month);
    const placed = sum(open.map((r) => r.ordersPlaced));
    const resolved = sum(open.map((r) => r.ordersResolved));
    return ui.amber(
      `${fmtMonth(info.month)} is still settling - figures are projected using ${fmtMonth(info.sourceMonth)}'s delivery rate (${(info.rate * 100).toFixed(1)}%), not yet real per-order outcomes. ` +
        (placed > 0 ? `${resolved}/${placed} orders resolved so far (${((resolved / placed) * 100).toFixed(1)}%).` : '')
    );
  }

  /* ---------------- Daily & monthly views ---------------- */

  function dailyWindow(rows) {
    const size = isMobile() ? 3 : 7;
    const end = state.is.windowEnd;
    const after = end ? rows.findIndex((r) => r.date > end) : -1;
    const endIndex = Math.max(after === -1 ? rows.length : after, Math.min(size, rows.length));
    return { size, endIndex, start: Math.max(0, endIndex - size) };
  }

  function dailyView(mode) {
    const rows = modeRows(mode);
    const { size, endIndex, start } = dailyWindow(rows);
    const win = rows.slice(start, endIndex);
    while (win.length < size) win.unshift(D.emptyRow(D.addDays(win.length ? win[0].date : D.TODAY, -1)));
    const touchesOpen = win.some((r) => r.date >= D.OPEN_MONTH);
    const lines = buildLines(win, { monthly: false, expected: expectedRate(mode) });
    return `<div class="space-y-2">
      ${touchesOpen ? settlingNotice(mode) : ''}
      <div class="flex items-center justify-end gap-2">
        <span class="text-xs text-gray-500">${fmtDay(win[0].date)} – ${fmtDay(win[win.length - 1].date)}</span>
        ${ui.arrow(-1, { act: 'is-day', disabled: start <= 0, label: 'Earlier day' })}
        ${ui.arrow(1, { act: 'is-day', disabled: endIndex >= rows.length, label: 'Later day' })}
      </div>
      ${statementTable(win.map((r) => fmtDay(r.date)), lines, 'is-daily')}
    </div>`;
  }

  function aggregateMonthly(rows) {
    const byMonth = new Map();
    for (const r of rows) {
      const month = r.date.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, D.emptyRow(month));
      const m = byMonth.get(month);
      for (const k of SUMMABLE) m[k] += r[k];
    }
    return [...byMonth.values()];
  }

  function monthlyWindow(months) {
    const size = isMobile() ? 3 : 7;
    const endIndex = state.is.monthEnd === null ? months.length : Math.min(state.is.monthEnd, months.length);
    return { size, endIndex, start: Math.max(0, endIndex - size) };
  }

  function monthlyView(mode) {
    const months = aggregateMonthly(modeRows(mode));
    const { endIndex, start } = monthlyWindow(months);
    const win = months.slice(start, endIndex);
    const canEarlier = start > 0;
    const canLater = endIndex < months.length;
    const touchesOpen = win.some((r) => r.date >= D.OPEN_MONTH.slice(0, 7));
    const lines = buildLines(win, { monthly: true });
    return `<div class="space-y-2">
      ${touchesOpen ? settlingNotice(mode) : ''}
      ${
        canEarlier || canLater
          ? `<div class="flex items-center justify-end gap-2">
          <span class="text-xs text-gray-500">${fmtMonthShort(win[0].date)} – ${fmtMonthShort(win[win.length - 1].date)}</span>
          ${ui.arrow(-1, { act: 'is-month', disabled: !canEarlier, label: 'Earlier month' })}
          ${ui.arrow(1, { act: 'is-month', disabled: !canLater, label: 'Later month' })}
        </div>`
          : ''
      }
      ${statementTable(win.map((r) => fmtMonthShort(r.date)), lines, 'is-monthly')}
    </div>`;
  }

  /* ---------------- Page ---------------- */

  function summaryCard(label, value, highlight) {
    const color = highlight === 'positive' ? 'text-green-700' : highlight === 'negative' ? 'text-red-700' : 'text-gray-900';
    return `<div class="rounded-lg border border-gray-200 bg-white p-4">
      <div class="text-xs font-medium text-gray-500">${label}</div>
      <div class="mt-1 text-lg font-semibold ${color}">${value}</div>
    </div>`;
  }

  pages['income-statement'] = {
    render() {
      const s = state.is;
      const tab = TABS.find((t) => t.key === s.mode);
      const t = totalsFor(s.mode, s.from, s.to);
      const sign = (n) => (n >= 0 ? 'positive' : 'negative');
      return `<div class="space-y-6">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-semibold text-gray-900">Income Statement</h1>
          <button type="button" data-act="export-open" class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">Export PDF</button>
        </div>
        <div class="space-y-4">
          ${ui.tabs(TABS, s.mode, 'is-mode')}
          <div class="rounded-lg border border-gray-200 bg-white">
            <div class="px-4 pt-3 text-xs text-gray-400">${tab.subtitle}</div>
            <div class="space-y-4 px-4 py-4">
              <form data-form="is-apply" class="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <span class="self-center text-xs text-gray-400">Summary period:</span>
                <div>
                  <label for="is-from" class="block text-xs font-medium text-gray-500">From</label>
                  <input id="is-from" type="date" value="${s.draftFrom}" data-bind="is.draftFrom" class="mt-1 rounded border border-gray-300 px-2 py-1 text-sm">
                </div>
                <div>
                  <label for="is-to" class="block text-xs font-medium text-gray-500">To</label>
                  <input id="is-to" type="date" value="${s.draftTo}" data-bind="is.draftTo" class="mt-1 rounded border border-gray-300 px-2 py-1 text-sm">
                </div>
                <button type="submit" class="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700">Apply</button>
              </form>

              <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                ${summaryCard('Orders', String(t.ordersPlaced))}
                ${summaryCard('Items Sold', String(t.itemsSold))}
                ${summaryCard('Meta Ads', fmtEgp(t.adSpendMeta))}
                ${summaryCard('TikTok Ads', fmtEgp(t.adSpendTiktok))}
                ${summaryCard('Contribution Profit', fmtEgp(t.contributionProfit), sign(t.contributionProfit))}
                ${summaryCard('Contribution Margin %', pct(t.contributionProfit, t.revenue))}
                ${summaryCard('Net Profit', fmtEgp(t.netProfit), sign(t.netProfit))}
                ${summaryCard('Net Margin %', pct(t.netProfit, t.revenue))}
                ${summaryCard('Delivery Rate', `${pct(t.ordersDelivered, t.ordersReceived)} (${t.ordersDelivered}/${t.ordersReceived})`)}
              </div>

              <div class="border-t border-gray-100 pt-4">
                <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div class="text-xs text-gray-400">${
                    s.granularity === 'daily'
                      ? 'Day-by-day, independent of the summary period above — browse the full history with the arrows.'
                      : `Month-by-month from ${fmtMonYear(D.START)}, independent of the summary period above — browse with the arrows.`
                  }</div>
                  <div class="flex gap-1 rounded-md border border-gray-200 bg-gray-50 p-0.5">
                    ${['daily', 'monthly']
                      .map(
                        (g) =>
                          `<button type="button" data-act="is-gran" data-v="${g}" class="rounded px-3 py-1 text-xs font-medium capitalize ${
                            s.granularity === g ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                          }">${g}</button>`
                      )
                      .join('')}
                  </div>
                </div>
                ${s.granularity === 'daily' ? dailyView(s.mode) : monthlyView(s.mode)}
              </div>
            </div>
          </div>
        </div>
      </div>`;
    },
  };

  actions['is-mode'] = (el) => {
    state.is.mode = el.dataset.v;
  };
  actions['is-gran'] = (el) => {
    state.is.granularity = el.dataset.v;
  };
  actions['is-apply'] = () => {
    const s = state.is;
    s.from = s.draftFrom || defaultFrom;
    s.to = s.draftTo || D.TODAY;
  };
  actions['is-day'] = (el) => {
    const rows = modeRows(state.is.mode);
    const { size, endIndex } = dailyWindow(rows);
    const next = Math.min(rows.length, Math.max(size, endIndex + Number(el.dataset.d)));
    state.is.windowEnd = rows[next - 1].date;
  };
  actions['is-month'] = (el) => {
    const months = aggregateMonthly(modeRows(state.is.mode));
    const { size, endIndex } = monthlyWindow(months);
    state.is.monthEnd = Math.min(months.length, Math.max(size, endIndex + Number(el.dataset.d)));
  };

  /* ---------------- Export PDF ---------------- */

  const MAX_DAYS = 7;
  const dayCount = (from, to) => {
    const ms = Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z');
    return Number.isNaN(ms) ? 0 : Math.floor(ms / 86400000) + 1;
  };

  actions['export-open'] = () => {
    state.modal = { type: 'export', from: D.YESTERDAY, to: D.YESTERDAY, inc: true, prod: false };
  };
  actions['export-go'] = () => {
    state.modal = null;
    Demo.toast('PDF export is turned off in the demo. A live dashboard opens a print-ready report here.');
  };

  modals.export = (m) => {
    const days = dayCount(m.from, m.to);
    const invalid = m.from > m.to;
    const tooMany = m.inc && days > MAX_DAYS;
    const none = !m.inc && !m.prod;
    const canGenerate = !invalid && !tooMany && !none && days >= 1;
    const hint = invalid
      ? '<span class="text-red-600">“From” must be on or before “To”.</span>'
      : tooMany
        ? `<span class="text-red-600">${days} days selected — the Income Statement is limited to ${MAX_DAYS} day columns. Shorten the range, or untick it to export Analysis by Product over any range.</span>`
        : m.inc
          ? `<span class="text-gray-400">${days} ${days === 1 ? 'column' : 'columns'}.</span>`
          : `<span class="text-gray-400">${days} ${days === 1 ? 'day' : 'days'} — no limit, totalled into one table.</span>`;
    const check = (key, title, desc) => `<label class="flex cursor-pointer items-start gap-2 rounded border border-gray-200 p-2 text-sm hover:bg-gray-50">
        <input type="checkbox" data-bind="modal.${key}" data-render${m[key] ? ' checked' : ''} class="mt-0.5">
        <span><span class="font-medium text-gray-900">${title}</span><span class="block text-xs text-gray-500">${desc}</span></span>
      </label>`;
    return ui.modal({
      title: 'Export PDF',
      body: `<div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-gray-500">${m.inc ? `Days to export (one day = one column, max ${MAX_DAYS})` : 'Date range to export'}</label>
          <div class="mt-1 grid grid-cols-2 gap-3">
            <div><span class="block text-[11px] text-gray-400">From</span><input id="ex-from" type="date" value="${m.from}" data-bind="modal.from" data-render class="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"></div>
            <div><span class="block text-[11px] text-gray-400">To</span><input id="ex-to" type="date" value="${m.to}" data-bind="modal.to" data-render class="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"></div>
          </div>
          <div class="mt-1 text-xs">${hint}</div>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500">Include (pick one or both)</label>
          <div class="mt-1 space-y-2">
            ${check('inc', 'Income Statement', `All accounts and ratios, one column per day (max ${MAX_DAYS} days).`)}
            ${check('prod', 'Analysis by Product', 'Per-product table totalled over the whole range — any length.')}
          </div>
          ${none ? '<div class="mt-1 text-xs text-red-600">Select at least one section.</div>' : ''}
        </div>
      </div>`,
      footer: `<div class="mt-5 flex justify-end gap-2">
        <button type="button" data-act="modal-close" class="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
        <button type="button" data-act="export-go" ${canGenerate ? '' : 'disabled'} class="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40">Generate PDF</button>
      </div>`,
    });
  };
})();
