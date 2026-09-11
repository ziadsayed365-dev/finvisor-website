// Pricing calculator on pricing.html. Adds up every cost one item carries, then puts the target net
// margin on top:
//
//   ad cost per item    = CPA ÷ delivery rate   (ads are paid on every order, delivered or not)
//   fixed cost per item = (monthly fixed expenses ÷ monthly orders) ÷ average items per order
//   cost per item       = product cost + ad cost per item + packaging + fixed cost per item
//   price               = cost per item × (1 + target net margin)
//
// Sliders, unlocking and field reading are shared with the CPA tool in tool-calc.js.
const pricingCalc = document.getElementById('pricingCalc');

if (pricingCalc) {
  setupToolCalculator(pricingCalc, ({ read, out, drawBar }) => {
    const orders = read('orders');
    const requestedRate = read('deliveryRate');
    // A delivery rate of 0 would make the ad cost infinite, so the floor is 1%.
    const deliveryRate = clampNumber(requestedRate, 1, 100) / 100;
    const margin = read('margin') / 100;
    // Every order has at least one item, so a blank or lower figure counts as 1.
    const itemsPerOrder = Math.max(read('items'), 1);

    // Each cost one item carries. These are also the slices of the price bar.
    const parts = {
      cost: read('cost'),
      packaging: read('packaging'),
      ads: read('cpa') / deliveryRate,
      fixed: orders ? read('fixed') / orders / itemsPerOrder : 0,
    };
    const costPerItem = Object.values(parts).reduce((sum, value) => sum + value, 0);
    const price = Math.round(costPerItem * (1 + margin));
    const profit = price - costPerItem;

    out('price').textContent = formatWhole(price);
    out('profit').textContent = formatWhole(profit);
    out('breakEven').textContent = formatMoney(costPerItem);
    out('adsPerItem').textContent = formatMoney(parts.ads);
    out('fixedPerItem').textContent = formatMoney(parts.fixed);
    drawBar({ ...parts, profit }, price);

    const notes = [];
    if (read('fixed') && !orders) notes.push('Add your monthly orders so your fixed expenses can be spread across them.');
    if (requestedRate < 1) notes.push('Add your delivery rate to get a price.');
    if (requestedRate > 100) notes.push("A delivery rate can't be above 100%, so 100% is used.");
    out('note').textContent = notes.join(' ');
  });
}
