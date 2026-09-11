// Analysis by Product page: every product's orders, revenue, costs and profit for a date range,
// the per-product Key Ratios, and the 7-day Rollforward for one product.
(function () {
  'use strict';
  const Demo = window.Demo;
  const { D, state, pages, actions, ui, esc, fmt, pct, fmtDay, fmtMonth, fmtMon } = Demo;
  const FIXED = D.PERF_EXPENSE_ACCOUNTS.filter((a) => a.section === 'fixed');
  const ROLLFORWARD_WINDOW = 7;

  const TABS = [
    { key: 'performance', label: 'Performance', subtitle: 'Every Shopify order, whether or not it has shipped yet.' },
    { key: 'actual', label: 'Actual', subtitle: 'Only orders actually handed to a courier (Bosta, Turbo or Quick Connect) for delivery.' },
  ];

  const freshRollforward = () => ({ query: '', selectedId: null, endDate: D.YESTERDAY });

  // Yesterday by default: today's orders are still coming in.
  state.abp = {
    from: D.YESTERDAY,
    to: D.YESTERDAY,
    draftFrom: D.YESTERDAY,
    draftTo: D.YESTERDAY,
    mode: 'performance',
    view: 'all',
    rf: freshRollforward(),
  };

  /* ---------------- Data ---------------- */

  function report(from, to, mode) {
    const days = D.DAYS.filter((d) => d >= from && d <= to);
    const touchesOpen = days.some((d) => d >= D.OPEN_MONTH);
    const products = [];
    for (const p of D.salesProducts) {
      const a = { placed: 0, resolved: 0, items: 0, revenue: 0, cogs: 0, grossRevenue: 0, grossCogs: 0, adSpend: 0 };
      for (const d of days) {
        const v = D.productDayView(p, d, mode);
        a.placed += v.placed;
        a.resolved += v.resolved;
        a.items += v.items;
        a.revenue += v.revenue;
        a.cogs += v.cogs;
        a.grossRevenue += v.grossRevenue;
        a.grossCogs += v.grossCogs;
        a.adSpend += v.adSpend;
      }
      if (!a.placed && !a.adSpend) continue;
      const rate = D.productRate(p, D.PREV_MONTH);
      products.push({
        productId: p.id,
        name: p.name,
        isBundle: p.isBundle,
        ordersPlaced: a.placed,
        ordersResolved: a.resolved,
        itemsSold: a.items,
        revenue: a.revenue,
        cogs: a.cogs,
        grossProfit: a.revenue - a.cogs,
        adSpend: a.adSpend,
        contributionProfit: a.revenue - a.cogs - a.adSpend,
        grossRevenue: a.grossRevenue,
        grossCogs: a.grossCogs,
        deliveryRate: rate,
        openMonthRate: touchesOpen ? rate : null,
      });
    }
    products.sort((x, y) => y.revenue - x.revenue);
    return { products, touchesOpen };
  }

  // The Income Statement's fixed cost over the range, per item sold, so each product carries its
  // share (this × its items) in the Key Ratios.
  function fixedCostPerItem(mode, from, to) {
    let fixed = 0;
    let items = 0;
    for (const r of D.dailyRows(mode)) {
      if (r.date < from || r.date > to || !r.itemsSold) continue;
      const monthly = D.resolvePerfExpensesForMonth(state.perfHistory, r.date);
      fixed += FIXED.reduce((s, a) => s + monthly[a.key], 0) / D.daysInMonth(r.date);
      items += r.itemsSold;
    }
    return items ? fixed / items : 0;
  }

  const fmtOrDash = (n) => (n === null ? '—' : fmt(n));
  const rateLabel = (p) => (p.openMonthRate === null ? null : `${(p.openMonthRate * 100).toFixed(0)}% (${fmtMon(D.PREV_MONTH)})`);
  const profitColor = (n) => (n >= 0 ? 'text-green-700' : 'text-red-700');

  /* ---------------- All Products ---------------- */

  function allProducts(products, touchesOpen) {
    const s = state.abp;
    const totals = products.reduce(
      (a, p) => ({
        ordersPlaced: a.ordersPlaced + p.ordersPlaced,
        ordersResolved: a.ordersResolved + p.ordersResolved,
        revenue: a.revenue + p.revenue,
        cogs: a.cogs + p.cogs,
        grossProfit: a.grossProfit + p.grossProfit,
        adSpend: a.adSpend + p.adSpend,
        contributionProfit: a.contributionProfit + p.contributionProfit,
      }),
      { ordersPlaced: 0, ordersResolved: 0, revenue: 0, cogs: 0, grossProfit: 0, adSpend: 0, contributionProfit: 0 }
    );

    const perItem = fixedCostPerItem(s.mode, s.from, s.to);
    const safe = (n, d) => (d ? n / d : 0);
    const ratio = (n, d) => (d ? n / d : null);
    const keyRows = products
      .filter((p) => p.adSpend > 0)
      .map((p) => {
        const mkt = p.adSpend;
        const fixedCost = perItem * p.itemsSold;
        const aRev = p.grossRevenue * p.deliveryRate;
        const aCogs = p.grossCogs * p.deliveryRate;
        const aOrders = p.ordersPlaced * p.deliveryRate;
        return {
          id: p.productId,
          name: p.name,
          aRoas: safe(aRev, mkt),
          aBreakEven: safe(aCogs + mkt + fixedCost, mkt),
          aCpa: ratio(mkt, aOrders),
          aFixedPerOrder: ratio(fixedCost, aOrders),
          mRoas: safe(p.grossRevenue, mkt),
          mBreakEven: safe(p.grossCogs + mkt + fixedCost, mkt),
          mCpa: ratio(mkt, p.ordersPlaced),
          mFixedPerOrder: ratio(fixedCost, p.ordersPlaced),
          cpaLimit: ratio(p.grossRevenue - p.grossCogs, p.ordersPlaced),
        };
      });

    const desktopRow = (p) => `<tr class="text-gray-700">
        <td class="py-1.5 pl-4"><span class="text-gray-900">${esc(p.name)}</span>${
          p.isBundle ? '<span class="ml-1.5 rounded bg-indigo-100 px-1 py-0.5 text-[9px] font-medium uppercase text-indigo-700">Bundle</span>' : ''
        }</td>
        <td class="py-1.5">${p.ordersResolved}/${p.ordersPlaced}</td>
        <td class="py-1.5 text-gray-500">${rateLabel(p) ?? '—'}</td>
        <td class="py-1.5">${fmt(p.revenue)}</td>
        <td class="py-1.5">${fmt(p.cogs)}</td>
        <td class="py-1.5 ${profitColor(p.grossProfit)}">${fmt(p.grossProfit)}</td>
        <td class="py-1.5">${pct(p.grossProfit, p.revenue)}</td>
        <td class="py-1.5">${fmt(p.adSpend)}</td>
        <td class="py-1.5 ${profitColor(p.contributionProfit)}">${fmt(p.contributionProfit)}</td>
        <td class="py-1.5">${pct(p.contributionProfit, p.revenue)}</td>
      </tr>`;

    const metric = (label, value, cls) =>
      `<div class="flex items-baseline justify-between"><span class="text-gray-400">${label}</span><span class="${cls || 'text-gray-900'}">${value}</span></div>`;
    const mobileCard = (x, name, rate, bold) => `<div class="px-4 py-3 ${bold ? 'bg-gray-50' : ''}">
        <div class="flex items-center justify-between">
          <span class="text-sm ${bold ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}">${esc(name)}</span>
          <span class="text-xs text-gray-400">${x.ordersResolved}/${x.ordersPlaced} orders${rate ? ` · ${rate}` : ''}</span>
        </div>
        <div class="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700">
          ${metric('Revenue', fmt(x.revenue))}
          ${metric('COGS', fmt(x.cogs))}
          ${metric('Gross Profit', `${fmt(x.grossProfit)} (${pct(x.grossProfit, x.revenue)})`, profitColor(x.grossProfit))}
          ${metric('Marketing', fmt(x.adSpend))}
          <div class="col-span-2 mt-0.5 flex items-baseline justify-between border-t border-gray-100 pt-1">
            <span class="text-gray-500">Net Profit</span>
            <span class="font-semibold ${profitColor(x.contributionProfit)}">${fmt(x.contributionProfit)} (${pct(x.contributionProfit, x.revenue)})</span>
          </div>
        </div>
      </div>`;

    const mobileRatios = (title, actual) => `<div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div class="border-b border-gray-100 px-3 py-1.5 text-[10px] font-semibold uppercase text-gray-500">${title}</div>
        <table class="w-full table-fixed text-[11px]">
          <thead><tr class="text-[10px] font-medium uppercase text-gray-400">
            <th class="w-[30%] py-1.5 pl-3 text-left">Product</th><th class="py-1.5 text-right">ROAS</th><th class="py-1.5 text-right">BE</th>
            <th class="py-1.5 text-right">CPA</th><th class="py-1.5 text-right">Lim</th><th class="py-1.5 pr-3 text-right">Fix/Ord</th>
          </tr></thead>
          <tbody class="divide-y divide-gray-50">${keyRows
            .map(
              (r) => `<tr class="text-gray-700">
              <td class="py-1.5 pl-3">${esc(r.name)}</td>
              <td class="py-1.5 text-right">${(actual ? r.aRoas : r.mRoas).toFixed(2)}</td>
              <td class="py-1.5 text-right">${(actual ? r.aBreakEven : r.mBreakEven).toFixed(2)}</td>
              <td class="py-1.5 text-right">${fmtOrDash(actual ? r.aCpa : r.mCpa)}</td>
              <td class="py-1.5 text-right">${fmtOrDash(r.cpaLimit)}</td>
              <td class="py-1.5 pr-3 text-right">${fmtOrDash(actual ? r.aFixedPerOrder : r.mFixedPerOrder)}</td>
            </tr>`
            )
            .join('')}</tbody>
        </table>
      </div>`;

    return `${
      touchesOpen
        ? ui.amber(
            `${fmtMonth(D.OPEN_MONTH)} is still settling - revenue and COGS for that month are projected using each product's own last-mature-month delivery rate (see the Rate column below), not yet real per-order outcomes.`
          )
        : ''
    }
      <div class="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white sm:block">
        <table class="w-full table-fixed text-xs">
          <thead class="text-left text-[10px] font-medium uppercase text-gray-400">
            <tr class="border-b border-gray-100">
              <th class="w-[24%] py-2 pl-4">Product</th><th class="w-[8%] py-2">Ord.</th><th class="w-[10%] py-2">Rate</th>
              <th class="w-[9%] py-2">Rev</th><th class="w-[9%] py-2">COGS</th><th class="w-[9%] py-2">GP</th><th class="w-[7%] py-2">GPM%</th>
              <th class="w-[7%] py-2">Mark</th><th class="w-[8%] py-2">NP</th><th class="w-[9%] py-2">NPM%</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            ${products.map(desktopRow).join('')}
            ${products.length === 0 ? '<tr><td colspan="10" class="py-3 pl-4 text-gray-400">No products with orders in this range.</td></tr>' : ''}
          </tbody>
          ${
            products.length
              ? `<tfoot><tr class="border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-900">
              <td class="py-2 pl-4">Total (${products.length})</td>
              <td class="py-2">${totals.ordersResolved}/${totals.ordersPlaced}</td>
              <td class="py-2 text-gray-400">—</td>
              <td class="py-2">${fmt(totals.revenue)}</td>
              <td class="py-2">${fmt(totals.cogs)}</td>
              <td class="py-2 ${profitColor(totals.grossProfit)}">${fmt(totals.grossProfit)}</td>
              <td class="py-2">${pct(totals.grossProfit, totals.revenue)}</td>
              <td class="py-2">${fmt(totals.adSpend)}</td>
              <td class="py-2 ${profitColor(totals.contributionProfit)}">${fmt(totals.contributionProfit)}</td>
              <td class="py-2">${pct(totals.contributionProfit, totals.revenue)}</td>
            </tr></tfoot>`
              : ''
          }
        </table>
      </div>

      <div class="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white sm:hidden">
        ${products.map((p) => mobileCard(p, p.name + (p.isBundle ? ' (Bundle)' : ''), rateLabel(p), false)).join('')}
        ${products.length === 0 ? '<div class="px-4 py-3 text-xs text-gray-400">No products with orders in this range.</div>' : ''}
        ${products.length ? mobileCard(totals, `Total (${products.length})`, null, true) : ''}
      </div>

      ${
        keyRows.length
          ? `<div>
          <h3 class="mb-2 mt-2 text-sm font-semibold text-gray-900">Key Ratios</h3>
          <p class="mb-2 text-xs text-gray-400">Only products with marketing spend. Same calculation as the Income Statement's Actual and Meta Dashboard ratios, per product — Actual on each product's expected-delivered basis, Meta Dashboard on all orders.</p>
          <div class="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white sm:block">
            <table class="w-full min-w-[820px] table-fixed text-[11px]">
              <thead>
                <tr class="border-b border-gray-100 text-[10px] font-semibold uppercase text-gray-500">
                  <th class="w-[18%] py-2 pl-3 text-left"></th>
                  <th class="border-l border-gray-200 py-2 text-center" colspan="5">Actual Ratios</th>
                  <th class="border-l border-gray-200 py-2 text-center" colspan="5">Meta Dashboard Ratios</th>
                </tr>
                <tr class="text-[10px] font-medium uppercase text-gray-400">
                  <th class="py-1.5 pl-3 text-left">Product</th>
                  <th class="border-l border-gray-200 py-1.5 text-right">ROAS</th><th class="py-1.5 text-right">BE ROAS</th><th class="py-1.5 text-right">CPA</th><th class="py-1.5 text-right">CPA Lim</th><th class="py-1.5 text-right">Fix/Ord</th>
                  <th class="border-l border-gray-200 py-1.5 text-right">ROAS</th><th class="py-1.5 text-right">BE ROAS</th><th class="py-1.5 text-right">CPA</th><th class="py-1.5 text-right">CPA Lim</th><th class="py-1.5 pr-3 text-right">Fix/Ord</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">${keyRows
                .map(
                  (r) => `<tr class="text-gray-700">
                  <td class="py-1.5 pl-3">${esc(r.name)}</td>
                  <td class="border-l border-gray-200 py-1.5 text-right">${r.aRoas.toFixed(2)}</td>
                  <td class="py-1.5 text-right">${r.aBreakEven.toFixed(2)}</td>
                  <td class="py-1.5 text-right">${fmtOrDash(r.aCpa)}</td>
                  <td class="py-1.5 text-right">${fmtOrDash(r.cpaLimit)}</td>
                  <td class="py-1.5 text-right">${fmtOrDash(r.aFixedPerOrder)}</td>
                  <td class="border-l border-gray-200 py-1.5 text-right">${r.mRoas.toFixed(2)}</td>
                  <td class="py-1.5 text-right">${r.mBreakEven.toFixed(2)}</td>
                  <td class="py-1.5 text-right">${fmtOrDash(r.mCpa)}</td>
                  <td class="py-1.5 text-right">${fmtOrDash(r.cpaLimit)}</td>
                  <td class="py-1.5 pr-3 text-right">${fmtOrDash(r.mFixedPerOrder)}</td>
                </tr>`
                )
                .join('')}</tbody>
            </table>
          </div>
          <div class="space-y-3 sm:hidden">${mobileRatios('Actual Ratios', true)}${mobileRatios('Meta Dashboard Ratios', false)}</div>
        </div>`
          : ''
      }`;
  }

  /* ---------------- Rollforward ---------------- */

  const productOptions = () => D.salesProducts.map((p) => ({ id: p.id, label: p.name, sku: p.sku }));

  function rollforwardRows(product, endDate, mode) {
    const rows = [];
    for (let i = ROLLFORWARD_WINDOW - 1; i >= 0; i--) {
      const date = D.addDays(endDate, -i);
      if (!product || date < D.START) {
        rows.push({ date, volume: 0, revenue: 0, cogs: 0, grossProfit: 0, adSpend: 0, contributionProfit: 0 });
        continue;
      }
      const v = D.productDayView(product, date, mode);
      const volume = product.isBundle ? v.placed : v.items;
      rows.push({ date, volume, revenue: v.revenue, cogs: v.cogs, grossProfit: v.revenue - v.cogs, adSpend: v.adSpend, contributionProfit: v.revenue - v.cogs - v.adSpend });
    }
    return rows;
  }

  function rollforward() {
    const s = state.abp;
    const rf = s.rf;
    const options = productOptions();
    const q = rf.query.trim().toLowerCase();
    const matches = q ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.sku || '').toLowerCase().includes(q)).slice(0, 12) : [];
    const selected = options.find((o) => o.id === rf.selectedId) || null;
    const product = selected ? D.salesProducts.find((p) => p.id === selected.id) : null;
    const rows = rollforwardRows(product, rf.endDate, s.mode);
    const rate = product ? D.productRate(product, D.PREV_MONTH) : null;
    const open = state.openMenu === 'rf' && matches.length > 0;

    const t = (k) => rows.reduce((a, r) => a + r[k], 0);
    const totalRev = t('revenue');
    const totalGP = t('grossProfit');
    const totalCP = t('contributionProfit');
    const totalVolume = t('volume');
    const lines = [
      { label: 'Total Volume 100%', vals: rows.map((r) => r.volume), total: totalVolume, small: true },
      ...(rate !== null
        ? [{ label: `Delivered Volume ${Math.round(rate * 100)}% (${fmtMon(D.PREV_MONTH)})`, vals: rows.map((r) => r.volume * rate), total: totalVolume * rate, small: true }]
        : []),
      { label: 'Rev', vals: rows.map((r) => r.revenue), total: totalRev },
      { label: 'COGS', vals: rows.map((r) => r.cogs), total: t('cogs') },
      { label: 'Gross Profit', vals: rows.map((r) => r.grossProfit), total: totalGP, profit: true, bold: true },
      { label: 'Gross Margin', vals: rows.map((r) => (r.revenue ? (r.grossProfit / r.revenue) * 100 : NaN)), total: totalRev ? (totalGP / totalRev) * 100 : NaN, pctLine: true },
      { label: 'Marketing Spend', vals: rows.map((r) => r.adSpend), total: t('adSpend') },
      { label: 'Contribution Profit', vals: rows.map((r) => r.contributionProfit), total: totalCP, profit: true, bold: true },
      { label: 'Contribution Margin', vals: rows.map((r) => (r.revenue ? (r.contributionProfit / r.revenue) * 100 : NaN)), total: totalRev ? (totalCP / totalRev) * 100 : NaN, pctLine: true },
    ];
    const cellText = (v, pctLine) => (pctLine ? (Number.isNaN(v) ? '—' : `${v.toFixed(1)}%`) : fmt(v));
    const colorCls = (v, profit) => (profit ? profitColor(v) : 'text-gray-900');

    return `<div class="space-y-4">
      <div class="relative max-w-md" data-menu="rf">
        <label for="rf-q" class="block text-xs font-medium text-gray-500">Product</label>
        <input id="rf-q" type="text" autocomplete="off" value="${esc(rf.query)}" placeholder="Type a product name or SKU…" data-in="rf-query" data-act="rf-open" class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm">
        ${
          open
            ? `<ul class="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">${matches
                .map(
                  (o) => `<li><button type="button" data-act="rf-pick" data-id="${o.id}" class="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100">
                  <span class="truncate">${esc(o.label)}</span>${o.sku ? `<span class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">SKU ${esc(o.sku)}</span>` : ''}
                </button></li>`
                )
                .join('')}</ul>`
            : ''
        }
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-sm font-semibold ${selected ? 'text-gray-900' : 'text-gray-400'}">${selected ? esc(selected.label) : 'No product selected'}${
          selected && selected.sku ? `<span class="ml-1.5 font-normal text-gray-400">(SKU ${esc(selected.sku)})</span>` : ''
        }</span>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500">${fmtDay(rows[0].date)} – ${fmtDay(rows[rows.length - 1].date)}</span>
          ${ui.arrow(-1, { act: 'rf-shift', disabled: rows[0].date <= D.START, label: 'Earlier day' })}
          ${ui.arrow(1, { act: 'rf-shift', disabled: rf.endDate >= D.TODAY, label: 'Later day' })}
        </div>
      </div>

      <div class="overflow-x-auto rounded-lg border border-gray-200" data-scroll="rf">
        <table class="w-full min-w-[640px] text-sm">
          <thead><tr class="border-b-2 border-gray-300 bg-gray-200">
            <th class="px-2 py-2 text-left text-xs font-medium uppercase text-gray-400">Line item</th>
            ${rows.map((r) => `<th class="px-3 py-2 text-right text-sm font-semibold text-gray-900">${fmtDay(r.date)}</th>`).join('')}
            <th class="border-l-2 border-l-gray-400 px-3 py-2 text-right text-sm font-semibold text-gray-900">Total</th>
            <th class="px-3 py-2 text-right text-sm font-semibold text-gray-900">Avg/day</th>
          </tr></thead>
          <tbody>${lines
            .map((line) => {
              const avg = line.pctLine ? line.total : line.total / (rows.length || 1);
              const b = line.bold ? 'font-bold ' : '';
              return `<tr class="${line.bold ? 'bg-gray-50' : ''}${line.small ? ' text-xs' : ''}">
                <td class="px-2 py-1.5 ${line.small ? 'text-gray-500' : line.bold ? 'font-bold text-gray-900' : 'text-gray-700'}">${esc(line.label)}</td>
                ${line.vals.map((v) => `<td class="px-3 py-1.5 text-right ${b}${colorCls(v, line.profit)}">${cellText(v, line.pctLine)}</td>`).join('')}
                <td class="border-l-2 border-l-gray-400 px-3 py-1.5 text-right ${b}${colorCls(line.total, line.profit)}">${cellText(line.total, line.pctLine)}</td>
                <td class="px-3 py-1.5 text-right ${b}${colorCls(avg, line.profit)}">${cellText(avg, line.pctLine)}</td>
              </tr>`;
            })
            .join('')}</tbody>
        </table>
      </div>

      ${selected ? '' : '<p class="text-xs text-gray-400">Type a product name above to fill in the numbers.</p>'}
    </div>`;
  }

  /* ---------------- Page ---------------- */

  pages.products = {
    render() {
      const s = state.abp;
      const allTime = s.from === D.ALL_TIME_START;
      const tab = TABS.find((t) => t.key === s.mode);
      const { products, touchesOpen } = s.view === 'all' ? report(s.from, s.to, s.mode) : { products: [], touchesOpen: false };
      return `<div class="space-y-6">
        <div>
          <h1 class="text-xl font-semibold text-gray-900">Analysis by Product</h1>
          <p class="text-xs text-gray-400">All amounts in EGP.</p>
        </div>

        <form data-form="abp-apply" class="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <label for="abp-from" class="block text-xs font-medium text-gray-500">From</label>
            <input id="abp-from" type="date" value="${s.draftFrom}" data-bind="abp.draftFrom" class="mt-1 rounded border border-gray-300 px-2 py-1 text-sm">
          </div>
          <div>
            <label for="abp-to" class="block text-xs font-medium text-gray-500">To</label>
            <input id="abp-to" type="date" value="${s.draftTo}" data-bind="abp.draftTo" class="mt-1 rounded border border-gray-300 px-2 py-1 text-sm">
          </div>
          <button type="submit" class="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700">Apply</button>
          <a href="#" data-act="abp-all" class="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700">Show all time</a>
          <a href="#" data-act="abp-reset" class="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700">Reset to yesterday</a>
          <span class="text-xs text-gray-400">Showing: ${allTime ? 'all time' : s.from} → ${s.to}</span>
        </form>

        <div class="space-y-4">
          ${ui.tabs(TABS, s.mode, 'abp-mode')}
          <div class="text-xs text-gray-400">${tab.subtitle}</div>
          <div class="inline-flex rounded-md border border-gray-300 p-0.5">
            ${[
              ['all', 'All Products'],
              ['rollforward', 'Rollforward'],
            ]
              .map(
                ([key, label]) =>
                  `<button type="button" data-act="abp-view" data-v="${key}" class="rounded px-3 py-1 text-sm font-medium ${
                    s.view === key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
                  }">${label}</button>`
              )
              .join('')}
          </div>
          ${s.view === 'rollforward' ? rollforward() : allProducts(products, touchesOpen)}
        </div>
      </div>`;
    },
  };

  actions['abp-apply'] = () => {
    const s = state.abp;
    s.from = s.draftFrom || D.YESTERDAY;
    s.to = s.draftTo || D.YESTERDAY;
  };
  actions['abp-all'] = () => {
    Object.assign(state.abp, { from: D.ALL_TIME_START, to: D.TODAY, draftFrom: '', draftTo: D.TODAY });
  };
  actions['abp-reset'] = () => {
    Object.assign(state.abp, { from: D.YESTERDAY, to: D.YESTERDAY, draftFrom: D.YESTERDAY, draftTo: D.YESTERDAY });
  };
  actions['abp-mode'] = (el) => {
    state.abp.mode = el.dataset.v;
    state.abp.rf = freshRollforward();
  };
  actions['abp-view'] = (el) => {
    state.abp.view = el.dataset.v;
  };
  actions['rf-query'] = (el) => {
    state.abp.rf.query = el.value;
    state.openMenu = 'rf';
  };
  actions['rf-open'] = () => {
    if (state.openMenu === 'rf') return false;
    state.openMenu = 'rf';
  };
  actions['rf-pick'] = (el) => {
    const o = productOptions().find((x) => x.id === Number(el.dataset.id));
    state.abp.rf.selectedId = o.id;
    state.abp.rf.query = o.label;
    state.openMenu = null;
  };
  actions['rf-shift'] = (el) => {
    const next = D.addDays(state.abp.rf.endDate, Number(el.dataset.d));
    if (next > D.TODAY) return false;
    state.abp.rf.endDate = next;
  };
})();
