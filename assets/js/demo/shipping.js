// Shipping Orders page: delivery-rate analysis per courier, where every month's orders ended up,
// and delivery rate by month placed for the business, each courier and each product.
(function () {
  'use strict';
  const Demo = window.Demo;
  const { D, state, pages, actions, ui, esc, fmtMonthShort } = Demo;

  const TABS = [{ key: 'analysis', label: 'Analysis' }];

  let analysisCache = null;
  const analysis = () => analysisCache || (analysisCache = D.shippingAnalysis());

  state.sh = { tab: 'analysis' };

  const courierLabel = D.courierLabel;
  const int = (n) => Math.round(n).toLocaleString('en-US');
  const pctRate = (rate) => (rate === null || rate === undefined ? '—' : `${(rate * 100).toFixed(1)}%`);

  // Green once most orders land, amber in the middle, red when returns dominate.
  function rateColor(rate) {
    if (rate === null || rate === undefined) return 'text-gray-400';
    if (rate >= 0.9) return 'text-green-700';
    if (rate >= 0.75) return 'text-amber-700';
    return 'text-red-700';
  }

  const download = (label, title) =>
    `<a href="#" data-act="sh-download" title="${esc(title)}" class="underline decoration-dotted underline-offset-2 hover:opacity-70">${label}</a>`;

  function analysisTab() {
    const { rows, rates, productRates } = analysis();
    const totals = rows.reduce(
      (a, r) => ({ shipped: a.shipped + r.shipped, delivered: a.delivered + r.delivered, returned: a.returned + r.returned, inTransit: a.inTransit + r.inTransit }),
      { shipped: 0, delivered: 0, returned: 0, inTransit: 0 }
    );
    const resolved = totals.delivered + totals.returned;
    const totalRate = resolved ? totals.delivered / resolved : null;
    const card = (label, value, color) =>
      `<div class="rounded-lg border border-gray-200 bg-white p-4"><div class="text-xs font-medium text-gray-500">${label}</div><div class="mt-1 text-lg font-semibold ${color || 'text-gray-900'}">${value}</div></div>`;
    const months = rates.months;
    const businessBy = Object.fromEntries(rates.overallBusiness.map((m) => [m.month, m]));
    const overallBy = Object.fromEntries(rates.overall.map((m) => [m.month, m]));
    const title = (cell) => (cell ? `${cell.delivered} delivered / ${cell.shipped} shipped` : '');

    const rateCellWithOpen = (cell, dense) => {
      const open = cell ? cell.inProgress : 0;
      const clickable = cell && cell.shipped > 0;
      return `<td class="px-3 ${dense ? 'py-1.5' : 'py-2'} text-right align-top" title="${cell ? `${title(cell)}${open > 0 ? ` · ${open} still in progress` : ''}` : ''}">
        ${clickable ? `<span class="${rateColor(cell.rate)} block">${download(pctRate(cell.rate), title(cell) + ' — click to download')}</span>` : `<div class="${rateColor(cell ? cell.rate : null)}">${pctRate(cell ? cell.rate : null)}</div>`}
        ${open > 0 ? `<div class="text-[10px] font-normal text-amber-600">${int(open)} open</div>` : ''}
      </td>`;
    };
    const rateCell = (cell) =>
      `<td class="px-3 py-1.5 text-right ${rateColor(cell ? cell.rate : null)}" title="${title(cell)}">${cell && cell.shipped > 0 ? download(pctRate(cell.rate), title(cell) + ' — click to download') : pctRate(cell ? cell.rate : null)}</td>`;
    const businessCell = (cell) =>
      `<td class="px-3 py-2 text-right ${rateColor(cell ? cell.rate : null)}" title="${cell ? `${cell.delivered} delivered / ${cell.received} orders placed — click to download` : ''}">${
        cell && cell.rate !== null ? download(pctRate(cell.rate), 'Download') : pctRate(cell ? cell.rate : null)
      }</td>`;

    return `<div class="space-y-4">
      <p class="text-xs text-gray-400">Every order recorded, by who shipped it. Delivery rate is delivered ÷ resolved — see each company's note for what counts as resolved, since only Bosta reports real outcomes.</p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        ${card('Shipped', int(totals.shipped))}
        ${card('Delivered', int(totals.delivered))}
        ${card('Returned', int(totals.returned))}
        ${card('Overall delivery rate', pctRate(totalRate), rateColor(totalRate))}
      </div>

      <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500"><tr>
            <th class="px-3 py-2">Company</th><th class="px-3 py-2 text-right">Shipped</th><th class="px-3 py-2 text-right">Delivered</th>
            <th class="px-3 py-2 text-right">Returned</th><th class="px-3 py-2 text-right">In transit</th><th class="px-3 py-2 text-right">Delivery rate</th>
          </tr></thead>
          <tbody class="divide-y divide-gray-100">${rows
            .map(
              (r) => `<tr class="align-top text-gray-700">
              <td class="px-3 py-2"><div class="font-medium text-gray-900">${esc(r.label)}</div><div class="mt-0.5 max-w-md text-xs text-gray-400">${esc(r.note)}</div></td>
              <td class="px-3 py-2 text-right tabular-nums">${int(r.shipped)}</td>
              <td class="px-3 py-2 text-right tabular-nums">${int(r.delivered)}</td>
              <td class="px-3 py-2 text-right tabular-nums">${r.returned > 0 ? int(r.returned) : '—'}</td>
              <td class="px-3 py-2 text-right tabular-nums text-gray-400">${r.inTransit > 0 ? int(r.inTransit) : '—'}</td>
              <td class="px-3 py-2 text-right font-semibold tabular-nums ${rateColor(r.deliveryRate)}">${pctRate(r.deliveryRate)}</td>
            </tr>`
            )
            .join('')}</tbody>
          <tfoot class="border-t-2 border-gray-200 bg-gray-50 font-medium text-gray-900"><tr>
            <td class="px-3 py-2">All companies</td>
            <td class="px-3 py-2 text-right tabular-nums">${int(totals.shipped)}</td>
            <td class="px-3 py-2 text-right tabular-nums">${int(totals.delivered)}</td>
            <td class="px-3 py-2 text-right tabular-nums">${int(totals.returned)}</td>
            <td class="px-3 py-2 text-right tabular-nums text-gray-400">${int(totals.inTransit)}</td>
            <td class="px-3 py-2 text-right tabular-nums ${rateColor(totalRate)}">${pctRate(totalRate)}</td>
          </tr></tfoot>
        </table>
      </div>

      <div class="space-y-2">
        <div>
          <h3 class="text-sm font-semibold text-gray-900">Where every order ended up, by month placed</h3>
          <p class="text-xs text-gray-400">Of the orders that came in each month: how many reached the customer, came back, were cancelled, are still moving, and how many nobody ever handed to a courier. Every order counts in exactly one column, so the five add up to <strong>Placed</strong>. Bucketed by the day the order was placed — the same months the Actual Income Statement uses. <strong>Click a month</strong> to download every one of its orders with its status.</p>
        </div>
        <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500"><tr>
              <th class="px-3 py-2">Month</th><th class="px-3 py-2 text-right">Placed</th><th class="px-3 py-2 text-right">Delivered</th><th class="px-3 py-2 text-right">Returned</th>
              <th class="px-3 py-2 text-right">Cancelled</th><th class="px-3 py-2 text-right">In progress</th><th class="px-3 py-2 text-right">Never shipped</th><th class="px-3 py-2 text-right">Delivered %</th>
            </tr></thead>
            <tbody class="divide-y divide-gray-100">${rates.statusByMonth
              .map((m) => {
                const rate = m.placed ? m.delivered / m.placed : null;
                return `<tr class="text-gray-700">
                <td class="px-3 py-2 font-medium text-gray-900">${download(fmtMonthShort(m.month), "Download this month's orders with each one's status")}</td>
                <td class="px-3 py-2 text-right font-medium tabular-nums text-gray-900">${int(m.placed)}</td>
                <td class="px-3 py-2 text-right tabular-nums text-green-700">${int(m.delivered)}</td>
                <td class="px-3 py-2 text-right tabular-nums ${m.returned > 0 ? 'text-red-700' : 'text-gray-400'}">${m.returned > 0 ? int(m.returned) : '—'}</td>
                <td class="px-3 py-2 text-right tabular-nums ${m.cancelled > 0 ? 'text-gray-700' : 'text-gray-400'}">${m.cancelled > 0 ? int(m.cancelled) : '—'}</td>
                <td class="px-3 py-2 text-right tabular-nums ${m.inProgress > 0 ? 'font-medium text-amber-700' : 'text-gray-400'}">${m.inProgress > 0 ? int(m.inProgress) : '—'}</td>
                <td class="px-3 py-2 text-right tabular-nums ${m.neverShipped > 0 ? 'font-medium text-gray-700' : 'text-gray-400'}">${m.neverShipped > 0 ? int(m.neverShipped) : '—'}</td>
                <td class="px-3 py-2 text-right font-semibold tabular-nums ${rateColor(rate)}">${pctRate(rate)}</td>
              </tr>`;
              })
              .join('')}</tbody>
          </table>
        </div>
      </div>

      <div class="space-y-3">
        <div>
          <h3 class="text-sm font-semibold text-gray-900">Delivery rate by month placed</h3>
          <p class="text-xs text-gray-400"><strong>Overall business</strong> is delivered ÷ <em>every order that came in</em> that month, so orders nobody ever shipped count against it — the same figure as the Delivery Rate row on the monthly Income Statement. Every row beneath it scores the couriers instead: delivered ÷ <em>orders handed to that courier</em>. Bucketed by the month each order was placed, so the current month is still settling and its rate rises as orders land. Hover a cell for the counts. The amber <span class="text-amber-600">n open</span> under a rate counts orders we can't yet confirm either way; they stay in the denominator, so that month reads honestly low rather than falsely perfect. The courier rows start in ${fmtMonthShort(D.ACTUAL_START)}, when shipment recording began; the top row still covers every month. <strong>Click any rate</strong> to download that month's orders.</p>
        </div>
        <div class="overflow-x-auto rounded-lg border border-gray-200" data-scroll="sh-rates">
          <table class="w-full text-sm">
            <thead><tr class="border-b-2 border-gray-300 bg-gray-200">
              <th class="sticky left-0 z-10 bg-gray-200 px-3 py-2 text-left text-xs font-medium uppercase text-gray-400">Delivery rate</th>
              ${months.map((m) => `<th class="px-3 py-2 text-right text-xs font-semibold text-gray-900">${fmtMonthShort(m)}</th>`).join('')}
            </tr></thead>
            <tbody class="divide-y divide-gray-100">
              <tr class="border-b border-gray-200 bg-gray-100 font-semibold">
                <td class="sticky left-0 z-10 bg-gray-100 px-3 py-2 text-gray-900">Overall business<span class="ml-1 font-normal text-gray-400">÷ all orders</span></td>
                ${months.map((m) => businessCell(businessBy[m])).join('')}
              </tr>
              <tr class="bg-gray-50 font-semibold">
                <td class="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-gray-900">All couriers<span class="ml-1 font-normal text-gray-400">÷ shipped</span></td>
                ${months.map((m) => rateCellWithOpen(overallBy[m], false)).join('')}
              </tr>
              ${rates.byCourier
                .map(
                  (c) => `<tr class="text-gray-700"><td class="sticky left-0 z-10 bg-white px-3 py-1.5 text-gray-700">${courierLabel(c.courier)}</td>${months
                    .map((m) => rateCellWithOpen(c.byMonth[m], true))
                    .join('')}</tr>`
                )
                .join('')}
              ${productRates
                .map(
                  (p) => `<tr class="text-gray-700"><td class="sticky left-0 z-10 bg-white px-3 py-1.5 text-gray-700">${esc(p.name)}</td>${months
                    .map((m) => rateCell(p.byMonth[m]))
                    .join('')}</tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  }

  actions['sh-download'] = () => {
    Demo.toast('Downloads are turned off in the demo. A live dashboard hands you the order list as a spreadsheet.');
    return false;
  };
  actions['sh-tab'] = (el) => {
    state.sh.tab = el.dataset.v;
  };

  pages['shipping-orders'] = {
    render() {
      return `<div class="space-y-6">
        <div>
          <h1 class="text-xl font-semibold text-gray-900">Shipping Orders</h1>
          <p class="text-xs text-gray-400">See how each shipper is doing, and where every order ended up.</p>
        </div>
        <div class="space-y-4">
          ${ui.tabs(TABS, state.sh.tab, 'sh-tab')}
          ${analysisTab()}
        </div>
      </div>`;
    },
  };
})();
