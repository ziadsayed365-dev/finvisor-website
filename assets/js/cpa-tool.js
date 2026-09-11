// CPA limit calculator on cpa-limit.html. The most an ad can cost per order placed before that
// order loses money. Fixed expenses are shared across every item sold, so more items per order
// means less fixed cost carried by each one:
//
//   fixed per item  = monthly fixed expenses ÷ (monthly orders × average items per order)
//   CPA limit       = (selling price − product cost − fixed per item) × delivery rate
//
// Sliders, unlocking and field reading are shared with the pricing tool in tool-calc.js.
const cpaCalc = document.getElementById('cpaCalc');

if (cpaCalc) {
  setupToolCalculator(cpaCalc, ({ read, out }) => {
    const orders = read('orders');
    const price = read('price');
    const cost = read('cost');
    const requestedRate = read('deliveryRate');
    const deliveryRate = clampNumber(requestedRate, 0, 100) / 100;
    // Every order has at least one item, so a blank or lower figure counts as 1.
    const itemsPerOrder = Math.max(read('items'), 1);
    const fixedPerItem = orders ? read('fixed') / (orders * itemsPerOrder) : 0;

    const limit = (price - cost - fixedPerItem) * deliveryRate;
    // Rounded down, so paying the figure shown never tips an order into a loss. The tiny nudge
    // stops a float like 220.99999999 from rounding a whole limit down by a pound.
    const shownLimit = Math.max(Math.floor(limit + 1e-9), 0);

    out('limit').textContent = formatWhole(shownLimit);
    out('roas').textContent = limit > 0 ? (price / limit).toFixed(2) : '—';
    out('budget').textContent = formatMoney(shownLimit * orders);
    out('fixedPerItem').textContent = formatMoney(fixedPerItem);

    const notes = [];
    if (price && requestedRate && limit <= 0) notes.push('This product loses money before any ad spend. Raise the price or bring costs down first.');
    if (read('fixed') && !orders) notes.push('Add your monthly orders so your fixed expenses can be spread across them.');
    if (!requestedRate) notes.push('Add your delivery rate to get a limit.');
    if (requestedRate > 100) notes.push("A delivery rate can't be above 100%, so 100% is used.");
    out('note').textContent = notes.join(' ');
  });
}
