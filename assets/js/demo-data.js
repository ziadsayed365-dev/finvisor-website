// Sample data for the FinVisor demo dashboard (demo-dashboard.html). Everything here is generated:
// a fictional store ("Your Brand"), made-up products and components, and orders, costs and ad
// spend produced by a seeded random generator, so the figures look alive and come out the same
// on every load. No client's numbers are used anywhere.
//
// Dates are anchored to today (Egypt time), so the demo always shows the last eight months with
// the current month still "settling", exactly as a live dashboard would. The file is plain data
// and arithmetic with no DOM access; demo-dashboard.js renders it.
(function (root) {
  'use strict';

  /* ---------------- Dates ---------------- */

  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (s, n) => {
    const d = new Date(s + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return iso(d);
  };
  const addMonths = (s, n) => {
    const [y, m] = s.split('-').map(Number);
    return iso(new Date(Date.UTC(y, m - 1 + n, 1)));
  };
  // Works on "YYYY-MM-DD" and on "YYYY-MM" month keys alike.
  const firstOfMonth = (s) => s.slice(0, 7) + '-01';
  const daysInMonth = (s) => {
    const [y, m] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  };
  const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  const weekday = (s) => new Date(s + 'T00:00:00Z').getUTCDay();

  const TODAY = iso(new Date(Date.now() + 3 * 3600 * 1000));
  const YESTERDAY = addDays(TODAY, -1);
  const OPEN_MONTH = firstOfMonth(TODAY);
  const PREV_MONTH = addMonths(OPEN_MONTH, -1);
  const START = addMonths(OPEN_MONTH, -7);
  // The Actual (courier-handed) view only has history from here, like a store that started
  // recording shipments a few months in.
  const ACTUAL_START = addMonths(OPEN_MONTH, -3);
  const ALL_TIME_START = '2000-01-01';

  /* ---------------- Seeded randomness ---------------- */

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  // One stable number in [0, 1) per key (mulberry32 seeded by the key's hash).
  function rand(key) {
    let a = hash(key) | 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const round2 = (n) => Math.round(n * 100) / 100;

  /* ---------------- Components & bill of materials ---------------- */

  const COMPONENT_TYPES = ['raw_material', 'product_package', 'sticker', 'other'];
  const COMPONENT_UNITS = ['pcs', 'l', 'kg'];
  const COMPONENT_TYPE_LABELS = { raw_material: 'Raw Material', product_package: 'Product Package', sticker: 'Sticker', other: 'Other' };
  const COMPONENT_UNIT_LABELS = { pcs: 'Pcs', l: 'L', kg: 'KG' };
  const ALLOCATION_UNIT_LABELS = { pcs: 'pc', l: 'ml', kg: 'g' };
  const UNIT_DIVISOR = { pcs: 1, l: 1000, kg: 1000 };
  const computeLineCost = (cost, unit, qty) => (cost === null ? null : (cost * qty) / UNIT_DIVISOR[unit]);

  const components = [
    ['raw_material', 'Hyaluronic Acid', 'kg', 2400],
    ['raw_material', 'Vitamin C Powder', 'kg', 3100],
    ['raw_material', 'Shea Butter', 'kg', 420],
    ['raw_material', 'Coconut Oil', 'l', 180],
    ['raw_material', 'Rose Water', 'l', 95],
    ['raw_material', 'Activated Charcoal', 'kg', 350],
    ['raw_material', 'Vanilla Fragrance Oil', 'l', 1900],
    ['raw_material', 'Rose Fragrance Oil', 'l', 2100],
    ['raw_material', 'Musk Fragrance Oil', 'l', 2300],
    ['raw_material', 'Beeswax', 'kg', 610],
    ['raw_material', 'Argan Oil', 'l', 1450],
    ['raw_material', 'Aloe Vera Extract', 'l', 260],
    ['raw_material', 'Zinc Oxide', 'kg', 880],
    ['raw_material', 'Sugar Granules', 'kg', 45],
    ['product_package', 'Dropper Bottle 30ml', 'pcs', 14],
    ['product_package', 'Jar 50g', 'pcs', 11],
    ['product_package', 'Tub 200g', 'pcs', 9],
    ['product_package', 'Bottle 100ml', 'pcs', 8],
    ['product_package', 'Spray Bottle 100ml', 'pcs', 12],
    ['product_package', 'Tube 60ml', 'pcs', 10],
    ['product_package', 'Lip Balm Tube', 'pcs', 4],
    ['sticker', 'Front Label', 'pcs', 1.5],
    ['sticker', 'Back Label', 'pcs', 1.2],
    ['sticker', 'Seal Sticker', 'pcs', 0.6],
    ['other', 'Gift Box', 'pcs', 25],
    ['other', 'Tissue Paper', 'pcs', 1],
    ['other', 'Thank-you Card', 'pcs', 2],
  ].map(([type, account, unit, cost], i) => ({ id: i + 1, type, account, unit, cost, updatedAt: START + 'T09:00:00Z' }));

  const componentByName = (name) => components.find((c) => c.account === name);
  const maps = (list) => list.map(([name, quantity]) => ({ componentId: componentByName(name).id, quantity }));

  // weight = share of daily orders; ads = ad spend as a share of sales (the two loss-makers carry
  // far more than they can afford); rateOffset nudges each product's delivery rate.
  const singles = [
    { id: 1, name: 'Hydrating Face Serum 30ml', sku: '1001', price: 450, weight: 0.12, ads: 0.19, rateOffset: 0.02, mappings: maps([['Hyaluronic Acid', 18], ['Rose Water', 12], ['Dropper Bottle 30ml', 1], ['Front Label', 1], ['Back Label', 1], ['Seal Sticker', 1]]) },
    { id: 2, name: 'Vitamin C Glow Cream 50g', sku: '1002', price: 520, weight: 0.1, ads: 0.21, rateOffset: 0.01, mappings: maps([['Vitamin C Powder', 15], ['Shea Butter', 25], ['Jar 50g', 1], ['Front Label', 1], ['Back Label', 1]]) },
    { id: 3, name: 'Shea Body Butter 200g', sku: '1003', price: 380, weight: 0.09, ads: 0.17, rateOffset: 0.03, mappings: maps([['Shea Butter', 150], ['Coconut Oil', 40], ['Tub 200g', 1], ['Front Label', 1], ['Seal Sticker', 1]]) },
    { id: 4, name: 'Coconut Hair Oil 100ml', sku: '1004', price: 290, weight: 0.08, ads: 0.18, rateOffset: 0, mappings: maps([['Coconut Oil', 90], ['Argan Oil', 10], ['Bottle 100ml', 1], ['Front Label', 1]]) },
    { id: 5, name: 'Rose Water Toner 150ml', sku: '1005', price: 250, weight: 0.07, ads: 0.16, rateOffset: 0.01, mappings: maps([['Rose Water', 140], ['Aloe Vera Extract', 10], ['Bottle 100ml', 1], ['Front Label', 1], ['Back Label', 1]]) },
    { id: 6, name: 'Charcoal Face Wash 120ml', sku: '1006', price: 270, weight: 0.06, ads: 0.2, rateOffset: -0.01, mappings: maps([['Activated Charcoal', 12], ['Aloe Vera Extract', 60], ['Tube 60ml', 2], ['Front Label', 1]]) },
    {
      id: 7, name: 'Body Mist 100ml', sku: '1007', price: 340, weight: 0.11, ads: 0.22, rateOffset: 0.02,
      mappings: maps([['Rose Water', 85], ['Spray Bottle 100ml', 1], ['Front Label', 1]]),
      variants: [
        { variantId: 71, title: 'Vanilla', sku: '1007-V', price: 340, mappings: maps([['Vanilla Fragrance Oil', 8]]) },
        { variantId: 72, title: 'Rose', sku: '1007-R', price: 340, mappings: maps([['Rose Fragrance Oil', 8]]) },
        { variantId: 73, title: 'Musk', sku: '1007-M', price: 360, mappings: maps([['Musk Fragrance Oil', 8]]) },
      ],
    },
    { id: 8, name: 'Lip Balm Trio', sku: '1008', price: 190, weight: 0.06, ads: 0.62, rateOffset: -0.04, mappings: maps([['Beeswax', 30], ['Coconut Oil', 10], ['Lip Balm Tube', 3], ['Front Label', 3]]) },
    { id: 9, name: 'Argan Hair Mask 250g', sku: '1009', price: 410, weight: 0.06, ads: 0.18, rateOffset: 0.02, mappings: maps([['Argan Oil', 30], ['Shea Butter', 120], ['Tub 200g', 1], ['Front Label', 1], ['Back Label', 1]]) },
    { id: 10, name: 'Aloe Vera Gel 200ml', sku: '1010', price: 230, weight: 0.05, ads: 0.15, rateOffset: 0, mappings: maps([['Aloe Vera Extract', 180], ['Tub 200g', 1], ['Front Label', 1]]) },
    {
      id: 11, name: 'Sunscreen SPF 50 60ml', sku: '1011', price: 480, weight: 0.07, ads: 0.55, rateOffset: -0.06,
      mappings: maps([['Zinc Oxide', 15], ['Aloe Vera Extract', 30], ['Tube 60ml', 1], ['Front Label', 1], ['Back Label', 1]]),
      variants: [
        { variantId: 111, title: 'Tinted', sku: '1011-T', price: 490, mappings: maps([['Shea Butter', 10]]) },
        { variantId: 112, title: 'Clear', sku: '1011-C', price: 480, mappings: maps([['Coconut Oil', 5]]) },
      ],
    },
    { id: 12, name: 'Exfoliating Body Scrub 300g', sku: '1012', price: 360, weight: 0.05, ads: 0.2, rateOffset: 0.01, mappings: maps([['Sugar Granules', 200], ['Coconut Oil', 60], ['Tub 200g', 1], ['Front Label', 1]]) },
    { id: 16, name: 'Mint Foot Cream 100g', sku: '1016', price: 210, weight: 0, ads: 0, rateOffset: 0, isActive: false, mappings: maps([['Shea Butter', 60], ['Jar 50g', 1], ['Front Label', 1]]) },
  ].map((p) => ({ variants: [], isActive: true, isBundle: false, ...p }));

  const bundles = [
    { id: 13, name: 'Glow Routine Box', price: 1050, weight: 0.04, ads: 0.12, rateOffset: 0.05, items: [['product', 1, 1], ['product', 2, 1], ['product', 5, 1], ['component', 'Gift Box', 1]] },
    { id: 14, name: 'Hair Care Bundle', price: 620, weight: 0.02, ads: 0.08, rateOffset: 0.03, items: [['product', 4, 1], ['product', 9, 1], ['component', 'Gift Box', 1]] },
    { id: 15, name: 'Body Care Gift Set', price: 950, weight: 0.02, ads: 0.1, rateOffset: 0.04, items: [['product', 3, 1], ['product', 7, 1], ['product', 12, 1], ['component', 'Gift Box', 1], ['component', 'Tissue Paper', 2]] },
  ].map((b) => ({
    ...b,
    sku: null,
    isActive: true,
    isBundle: true,
    variants: [],
    items: b.items.map(([kind, ref, quantity]) =>
      kind === 'product' ? { kind, refId: ref, quantity } : { kind, refId: componentByName(ref).id, quantity }
    ),
  }));

  const componentById = (id) => components.find((c) => c.id === id);
  const singleById = (id) => singles.find((p) => p.id === id);

  function mappingCost(list) {
    return list.reduce((s, m) => {
      const c = componentById(m.componentId);
      return s + (computeLineCost(c.cost, c.unit, m.quantity) ?? 0);
    }, 0);
  }
  const variantBuiltCost = (product, variant) => mappingCost(product.mappings) + mappingCost(variant.mappings);
  // A multi-variant product's cost is the average built cost across its variants.
  function singleCost(p) {
    if (p.variants.length) return p.variants.reduce((s, v) => s + variantBuiltCost(p, v), 0) / p.variants.length;
    return mappingCost(p.mappings);
  }
  function bundleCost(b) {
    return b.items.reduce((s, it) => {
      if (it.kind === 'product') return s + singleCost(singleById(it.refId)) * it.quantity;
      const c = componentById(it.refId);
      return s + (computeLineCost(c.cost, c.unit, it.quantity) ?? 0);
    }, 0);
  }
  const productCost = (p) => (p.isBundle ? bundleCost(p) : singleCost(p));

  // Component quantity (allocation units: g / ml / pc) used by one item of a product.
  function bomUsage(p) {
    const out = new Map();
    const add = (id, q) => out.set(id, (out.get(id) ?? 0) + q);
    if (p.isBundle) {
      for (const it of p.items) {
        if (it.kind === 'product') for (const [id, q] of bomUsage(singleById(it.refId))) add(id, q * it.quantity);
        else add(it.refId, it.quantity);
      }
      return out;
    }
    for (const m of p.mappings) add(m.componentId, m.quantity);
    for (const v of p.variants) for (const m of v.mappings) add(m.componentId, m.quantity / p.variants.length);
    return out;
  }

  const salesProducts = [...singles.filter((p) => p.weight > 0), ...bundles].sort((a, b) => a.id - b.id);
  // Costs are fixed at load for the sales history, so editing a BOM later reprices the Product
  // List but never rewrites past profit - the same rule a real dashboard follows.
  for (const p of salesProducts) p.salesCost = productCost(p);
  const usageCache = new Map(salesProducts.map((p) => [p.id, bomUsage(p)]));

  /* ---------------- Daily sales ---------------- */

  const DAYS = [];
  for (let d = START; d <= TODAY; d = addDays(d, 1)) DAYS.push(d);

  const MONTHS = [];
  for (let m = START; m <= OPEN_MONTH; m = addMonths(m, 1)) MONTHS.push(m);
  const MONTH_RATE = Object.fromEntries(MONTHS.map((m) => [m, 0.77 + rand('rate' + m) * 0.09]));
  const productRate = (p, month) => clamp(MONTH_RATE[month] + p.rateOffset, 0.55, 0.96);

  function baseOrders(d) {
    const i = daysBetween(START, d);
    const dow = weekday(d); // Friday and Thursday are the busy days
    let b = 40 * (1 + i / 500) * (dow === 5 ? 1.25 : dow === 4 ? 1.12 : dow === 6 ? 1.05 : 1) * (0.8 + rand('day' + d) * 0.4);
    if (d === TODAY) b *= 0.45;
    return b;
  }

  const rawCache = new Map();
  function productRaw(p, d) {
    const key = p.id + '|' + d;
    if (rawCache.has(key)) return rawCache.get(key);
    const orders = Math.floor(baseOrders(d) * p.weight + rand('o' + key));
    const items = orders + (p.isBundle ? 0 : Math.floor(orders * 0.15 + rand('i' + key)));
    const units = p.isBundle ? orders : items;
    const grossRevenue = Math.round(units * p.price * (0.93 + rand('r' + key) * 0.07));
    const grossCogs = units * p.salesCost;
    const spend = (orders * p.price * p.ads + p.price * p.ads * 0.35) * (0.7 + rand('a' + key) * 0.6);
    const dow = weekday(d);
    const adSpend = round2(spend);
    const tiktok = round2(spend * (dow === 5 || dow === 6 ? 0.25 : 0.08));
    const row = { orders, items, grossRevenue, grossCogs, adSpend, tiktok, meta: round2(adSpend - tiktok) };
    rawCache.set(key, row);
    return row;
  }

  const ZERO_VIEW = { placed: 0, resolved: 0, received: 0, delivered: 0, items: 0, grossRevenue: 0, grossCogs: 0, revenue: 0, cogs: 0, adSpend: 0, meta: 0, tiktok: 0, rate: 0 };

  // One product on one day, in Performance (every order) or Actual (handed to a courier) mode.
  // A closed month books revenue at that month's real delivery rate; the open month is still
  // settling, so it is projected at the previous month's rate, like the live dashboard.
  function productDayView(p, d, mode) {
    if (mode === 'actual' && d < ACTUAL_START) return ZERO_VIEW;
    const raw = productRaw(p, d);
    const k = mode === 'actual' ? 0.95 : 1;
    const month = firstOfMonth(d);
    const open = month === OPEN_MONTH;
    const rate = productRate(p, month);
    const src = productRate(p, PREV_MONTH);
    const useRate = open ? src : rate;
    const placed = Math.round(raw.orders * k);
    const received = placed + Math.floor(placed * 0.05 + rand('c' + p.id + d));
    const resolved = open ? Math.round(placed * Math.min(1, daysBetween(d, TODAY) / 10)) : placed;
    const delivered = open ? Math.round(resolved * src) : Math.round(received * rate);
    return {
      placed,
      resolved,
      received,
      delivered,
      items: Math.round(raw.items * k),
      grossRevenue: raw.grossRevenue * k,
      grossCogs: raw.grossCogs * k,
      revenue: raw.grossRevenue * k * useRate,
      cogs: raw.grossCogs * k * useRate,
      adSpend: raw.adSpend,
      meta: raw.meta,
      tiktok: raw.tiktok,
      rate: useRate,
    };
  }

  const emptyRow = (date) => ({
    date, ordersPlaced: 0, ordersResolved: 0, ordersReceived: 0, ordersDelivered: 0, itemsSold: 0, revenue: 0, cogs: 0,
    grossRevenue: 0, grossCogs: 0, grossProfit: 0, adSpend: 0, adSpendMeta: 0, adSpendTiktok: 0, contributionProfit: 0,
    packaging: 0, transportation: 0, shippingFeeCharged: 0, bostaFeesPaid: 0, shippingDifferencesFee: 0, salaries: 0, rent: 0, bostaPenalty: 0, nextDayFee: 0,
  });

  const dailyCache = {};
  function dailyRows(mode) {
    if (dailyCache[mode]) return dailyCache[mode];
    dailyCache[mode] = DAYS.map((d) => {
      const r = emptyRow(d);
      for (const p of salesProducts) {
        const v = productDayView(p, d, mode);
        r.ordersPlaced += v.placed;
        r.ordersResolved += v.resolved;
        r.ordersReceived += v.received;
        r.ordersDelivered += v.delivered;
        r.itemsSold += v.items;
        r.revenue += v.revenue;
        r.cogs += v.cogs;
        r.grossRevenue += v.grossRevenue;
        r.grossCogs += v.grossCogs;
        r.adSpend += v.adSpend;
        r.adSpendMeta += v.meta;
        r.adSpendTiktok += v.tiktok;
      }
      if (mode === 'actual' && d < ACTUAL_START) r.adSpend = r.adSpendMeta = r.adSpendTiktok = 0;
      r.grossProfit = r.revenue - r.cogs;
      r.contributionProfit = r.grossProfit - r.adSpend;
      r.shippingDifferencesFee = -Math.round(r.ordersDelivered * (4 + rand('sd' + d + mode) * 5));
      r.bostaPenalty = Math.round(Math.max(0, r.ordersResolved - r.ordersDelivered) * 0.6 * 20);
      // Bosta's Next Day cash-settlement fee: 1% of the cash it collects (about 88% of sales are COD).
      r.nextDayFee = Math.round(r.revenue * 0.88 * 0.01);
      return r;
    });
    return dailyCache[mode];
  }

  /* ---------------- Fixed expenses (Settings) ---------------- */

  const PERF_EXPENSE_ACCOUNTS = [
    { key: 'salaries', label: 'Salaries', slug: 'salaries', nature: 'expense', section: 'fixed' },
    { key: 'postProduction', label: 'Post Production', slug: 'post_production', nature: 'expense', section: 'fixed' },
    { key: 'subscription', label: 'Subscription', slug: 'subscription', nature: 'expense', section: 'fixed' },
    { key: 'rent', label: 'Rent', slug: 'rent', nature: 'expense', section: 'fixed' },
    { key: 'transportation', label: 'Transportation', slug: 'transportation', nature: 'expense', section: 'fixed' },
    { key: 'refunds', label: 'Refunds', slug: 'refunds', nature: 'expense', section: 'fixed' },
    { key: 'packingFees', label: 'Packing fees', slug: 'packing_fees', nature: 'expense', section: 'fixed' },
    { key: 'otherExpense', label: 'Other-Expense', slug: 'other_expense', nature: 'expense', section: 'other' },
    { key: 'otherIncome', label: 'Other-Income', slug: 'other_income', nature: 'income', section: 'other' },
  ];

  function initialPerfHistory() {
    const at = (m, amount) => ({ month: m, amount });
    return {
      salaries: [at(START, 78000), at(addMonths(START, 4), 86000)],
      postProduction: [at(START, 12000)],
      subscription: [at(START, 6500)],
      rent: [at(START, 22000)],
      transportation: [at(START, 4800)],
      refunds: [at(START, 3500)],
      packingFees: [at(START, 9000)],
      otherExpense: [at(START, 2500)],
      otherIncome: [at(START, 1200)],
    };
  }

  function resolvePerfExpensesForMonth(history, dateISO) {
    const target = firstOfMonth(dateISO);
    const out = {};
    for (const acc of PERF_EXPENSE_ACCOUNTS) {
      let amount = 0;
      for (const e of history[acc.key] ?? []) {
        if (e.month <= target) amount = e.amount;
        else break;
      }
      out[acc.key] = amount;
    }
    return out;
  }

  // Real recorded totals for each closed month: the Settings figure give or take a little, the
  // way actual bills never match the budget exactly.
  const recordedByMonth = (() => {
    const base = initialPerfHistory();
    const out = {};
    for (const m of MONTHS) {
      if (m >= OPEN_MONTH) continue;
      const resolved = resolvePerfExpensesForMonth(base, m);
      out[m] = {};
      for (const acc of PERF_EXPENSE_ACCOUNTS) {
        out[m][acc.key] = Math.round((resolved[acc.key] * (0.92 + rand('rec' + m + acc.key) * 0.16)) / 50) * 50;
      }
    }
    return out;
  })();

  /* ---------------- Expense & Income records ---------------- */

  const ACCOUNT_TYPES = [
    { id: 1, name: 'COD Collections', type: 'income' },
    { id: 2, name: 'Online Payments', type: 'income' },
    { id: 3, name: 'Other-Income', type: 'income' },
    { id: 4, name: 'Salaries', type: 'expense' },
    { id: 6, name: 'Rent', type: 'expense' },
    { id: 7, name: 'Subscription', type: 'expense' },
    { id: 8, name: 'Transportation', type: 'expense' },
    { id: 10, name: 'Packing fees', type: 'expense' },
    { id: 11, name: 'Post Production', type: 'expense' },
    { id: 12, name: 'Refunds', type: 'expense' },
    { id: 13, name: 'Purchasing', type: 'expense' },
    { id: 14, name: 'Marketing', type: 'expense' },
    { id: 15, name: 'Other-Expense', type: 'expense' },
  ];

  function initialRecords() {
    const perf = dailyRows('performance');
    const revenueByMonth = {};
    const adsByMonth = {};
    for (const r of perf) {
      const m = firstOfMonth(r.date);
      revenueByMonth[m] = (revenueByMonth[m] ?? 0) + r.revenue;
      adsByMonth[m] = (adsByMonth[m] ?? 0) + r.adSpend;
    }
    const out = [];
    let id = 1;
    const push = (date, accountTypeId, description, amount) => {
      if (date > TODAY) return;
      const t = ACCOUNT_TYPES.find((a) => a.id === accountTypeId);
      out.push({ id: id++, date, accountTypeId, accountTypeName: t.name, type: t.type, description, amount: Math.round(amount), updatedAt: date + 'T00:00:00Z' });
    };
    for (const m of MONTHS) {
      const day = (n) => addDays(m, n - 1);
      const rev = revenueByMonth[m] ?? 0;
      const rec = recordedByMonth[m] ?? resolvePerfExpensesForMonth(initialPerfHistory(), m);
      for (const n of [7, 14, 21, 28]) push(day(n), 1, 'Bosta weekly payout', (rev * 0.76) / 4 * (0.9 + rand('cod' + m + n) * 0.2));
      for (const n of [10, 25]) push(day(n), 2, 'Paymob settlement', (rev * 0.12) / 2 * (0.9 + rand('pm' + m + n) * 0.2));
      if (rand('oi' + m) > 0.4) push(day(18), 3, 'Sold surplus packaging', rec.otherIncome);
      push(day(28), 4, 'Monthly payroll', rec.salaries);
      push(day(1), 6, 'Office & warehouse rent', rec.rent);
      push(day(3), 7, 'Shopify plan', rec.subscription * 0.55);
      push(day(3), 7, 'Google Workspace & tools', rec.subscription * 0.45);
      for (const n of [6, 16, 26]) push(day(n), 8, 'Courier pickup runs', rec.transportation / 3);
      for (const n of [9, 22]) push(day(n), 10, 'Packing staff (daily wage)', rec.packingFees / 2);
      push(day(15), 11, 'Product photo shoot', rec.postProduction);
      for (const n of [11, 24]) push(day(n), 12, `Customer refund #${4100 + Math.floor(rand('rf' + m + n) * 900)}`, rec.refunds / 2);
      for (const n of [4, 17]) push(day(n), 13, 'Raw materials order', rev * 0.07 * (0.8 + rand('pu' + m + n) * 0.4));
      for (const n of [2, 9, 16, 23]) push(day(n), 14, 'Meta ads top-up', ((adsByMonth[m] ?? 0) * 0.85) / 4);
      push(day(20), 15, 'Bank charges', rec.otherExpense);
    }
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
    return out;
  }

  /* ---------------- Shipping ---------------- */

  const COURIERS = [
    { value: 'bosta', label: 'Bosta', share: 0.7, rateAdj: 0 },
    { value: 'turbo', label: 'Turbo', share: 0.18, rateAdj: 0.03 },
    { value: 'quick_box', label: 'Quick Connect', share: 0.12, rateAdj: -0.05 },
  ];
  const courierLabel = (v) => COURIERS.find((c) => c.value === v)?.label ?? v ?? '—';

  // Placed / delivered / resolved per month, for either mode.
  function monthTotals(mode) {
    const out = {};
    for (const r of dailyRows(mode)) {
      const m = firstOfMonth(r.date);
      const t = (out[m] ??= { placed: 0, received: 0, delivered: 0, resolved: 0 });
      t.placed += r.ordersPlaced;
      t.received += r.ordersReceived;
      t.delivered += r.ordersDelivered;
      t.resolved += r.ordersResolved;
    }
    return out;
  }

  function courierMonth(courier, m, t) {
    const shipped = Math.round(t.placed * courier.share);
    const open = m === OPEN_MONTH;
    const rate = clamp((t.placed ? t.delivered / t.placed : 0) + courier.rateAdj, 0.5, 0.97);
    const resolved = open ? Math.round(shipped * (t.placed ? t.resolved / t.placed : 0)) : shipped;
    const delivered = Math.round(resolved * rate);
    return { shipped, delivered, returned: resolved - delivered, inProgress: shipped - resolved, rate: resolved ? delivered / resolved : null };
  }

  function shippingAnalysis() {
    const actual = monthTotals('actual');
    const months = MONTHS.filter((m) => m >= ACTUAL_START);
    const notes = {
      bosta: 'Bosta reports real outcomes through its API: delivered ÷ (delivered + returned), orders still in transit left out.',
      turbo: 'No API. Only returns are recorded, so everything not returned counts as delivered.',
      quick_box: 'No API. Only returns are recorded, so everything not returned counts as delivered.',
    };
    const rows = COURIERS.map((c) => {
      const agg = months.reduce(
        (a, m) => {
          const x = courierMonth(c, m, actual[m]);
          return { shipped: a.shipped + x.shipped, delivered: a.delivered + x.delivered, returned: a.returned + x.returned, inTransit: a.inTransit + x.inProgress };
        },
        { shipped: 0, delivered: 0, returned: 0, inTransit: 0 }
      );
      const resolved = agg.delivered + agg.returned;
      return { key: c.value, label: c.label, note: notes[c.value], ...agg, deliveryRate: resolved ? agg.delivered / resolved : null };
    });

    const perf = monthTotals('performance');
    const statusByMonth = MONTHS.map((m) => {
      const t = perf[m];
      const open = m === OPEN_MONTH;
      const cancelled = t.received - t.placed;
      const neverShipped = Math.round(t.placed * 0.01);
      const inProgress = open ? t.placed - t.resolved : 0;
      const returned = Math.max(0, t.placed - neverShipped - inProgress - t.delivered);
      return { month: m.slice(0, 7), placed: t.received, delivered: t.delivered, returned, cancelled, inProgress, neverShipped };
    });

    const overallBusiness = MONTHS.map((m) => ({ month: m.slice(0, 7), received: perf[m].received, delivered: perf[m].delivered, rate: perf[m].received ? perf[m].delivered / perf[m].received : null }));
    const byCourier = COURIERS.map((c) => ({
      courier: c.value,
      byMonth: Object.fromEntries(months.map((m) => [m.slice(0, 7), courierMonth(c, m, actual[m])])),
    }));
    const overall = months.map((m) => {
      const cells = COURIERS.map((c) => courierMonth(c, m, actual[m]));
      const shipped = cells.reduce((s, x) => s + x.shipped, 0);
      const delivered = cells.reduce((s, x) => s + x.delivered, 0);
      const inProgress = cells.reduce((s, x) => s + x.inProgress, 0);
      const resolved = shipped - inProgress;
      return { month: m.slice(0, 7), shipped, delivered, inProgress, rate: resolved ? delivered / resolved : null };
    });
    const productRates = salesProducts.slice(0, 8).map((p) => ({
      productId: p.id,
      name: p.name,
      byMonth: Object.fromEntries(
        MONTHS.filter((m) => m < OPEN_MONTH).map((m) => {
          let shipped = 0;
          let delivered = 0;
          for (const d of DAYS) {
            if (firstOfMonth(d) !== m) continue;
            const v = productDayView(p, d, 'performance');
            shipped += v.received;
            delivered += v.delivered;
          }
          return [m.slice(0, 7), { shipped, delivered, rate: shipped ? delivered / shipped : null }];
        })
      ),
    }));
    return { rows, rates: { months: MONTHS.map((m) => m.slice(0, 7)), overallBusiness, overall, byCourier, statusByMonth }, productRates };
  }


  /* ---------------- Purchasing & inventory ---------------- */

  // Component usage on a day, in allocation units, from the products shipped (Actual mode).
  function componentUsageOn(d) {
    const out = new Map();
    for (const p of salesProducts) {
      const v = productDayView(p, d, 'actual');
      if (!v.items) continue;
      const units = p.isBundle ? v.placed : v.items;
      for (const [id, q] of usageCache.get(p.id)) out.set(id, (out.get(id) ?? 0) + q * units);
    }
    return out;
  }
  const usageByDay = new Map(DAYS.filter((d) => d >= ACTUAL_START).map((d) => [d, componentUsageOn(d)]));
  const usage = (componentId, d) => usageByDay.get(d)?.get(componentId) ?? 0;

  // Shipped units per product per day, for the Purchasing report.
  const shippedUnits = (p, d) => {
    const v = productDayView(p, d, 'actual');
    return p.isBundle ? v.placed : v.items;
  };

  function initialPurchases() {
    const out = [];
    let id = 1;
    for (const c of components) {
      const offset = c.id % 5;
      for (let d = addDays(ACTUAL_START, offset); d <= TODAY; d = addDays(d, 18)) {
        let need = 0;
        for (let i = 0; i < 18; i++) need += usage(c.id, addDays(d, i));
        if (!need) continue;
        const priced = (need * 1.15) / UNIT_DIVISOR[c.unit];
        const quantity = c.unit === 'pcs' ? Math.ceil(priced / 50) * 50 : Math.ceil(priced * 10) / 10;
        out.push({
          id: id++,
          date: d,
          componentId: c.id,
          componentName: c.account,
          unit: c.unit,
          quantity,
          amount: round2(c.cost * (0.95 + rand('pa' + c.id + d) * 0.13)),
          description: rand('pd' + c.id + d) > 0.5 ? 'Monthly supplier order' : '',
        });
      }
    }
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
    return out;
  }

  // Ledger lines: the three fragrance oils are counted together as one balance.
  const INVENTORY_GROUPS = [
    { id: 1, name: 'Fragrance oils', unit: 'l', componentIds: ['Vanilla Fragrance Oil', 'Rose Fragrance Oil', 'Musk Fragrance Oil'].map((n) => componentByName(n).id) },
  ];

  function inventoryLines() {
    const grouped = new Set(INVENTORY_GROUPS.flatMap((g) => g.componentIds));
    const lines = [];
    for (const t of COMPONENT_TYPES) {
      for (const g of INVENTORY_GROUPS) {
        const first = componentById(g.componentIds[0]);
        if (first.type !== t) continue;
        lines.push({ key: 'g:' + g.id, kind: 'group', id: g.id, type: t, name: g.name, unit: g.unit, componentIds: g.componentIds, memberNames: g.componentIds.map((id) => componentById(id).account) });
      }
      for (const c of components) {
        if (c.type !== t || grouped.has(c.id)) continue;
        lines.push({ key: 'c:' + c.id, kind: 'component', id: c.id, type: t, name: c.account, unit: c.unit, componentIds: [c.id], memberNames: [] });
      }
    }
    // Opening balance: roughly three weeks of use, so the first purchases land before it runs out.
    for (const l of lines) {
      let need = 0;
      for (let i = 0; i < 21; i++) for (const id of l.componentIds) need += usage(id, addDays(ACTUAL_START, i));
      const priced = (need * 1.1) / UNIT_DIVISOR[l.unit];
      l.opening = l.unit === 'pcs' ? Math.ceil(priced / 10) * 10 : Math.round(priced * 100) / 100;
    }
    return lines;
  }

  /* ---------------- Navigation ---------------- */

  // Header pages in order, with their inner tabs.
  const PERMISSION_TREE = [
    { key: 'income-statement', label: 'Income Statement', tabs: [{ key: 'performance', label: 'Performance' }, { key: 'actual', label: 'Actual' }] },
    { key: 'products', label: 'Analysis by Product', tabs: [{ key: 'all', label: 'All Products' }, { key: 'rollforward', label: 'Rollforward' }] },
    { key: 'record-data', label: 'Expense & Income', tabs: [{ key: 'expenses', label: 'Expense & Income', edit: true }, { key: 'report', label: 'Report' }] },
    { key: 'shipping-orders', label: 'Shipping Orders', tabs: [{ key: 'analysis', label: 'Analysis' }] },
    { key: 'purchasing', label: 'Purchasing', tabs: [{ key: 'recording', label: 'Recording', edit: true }, { key: 'report', label: 'Report' }, { key: 'inventory', label: 'Inventory', edit: true }] },
    { key: 'product-list', label: 'Product List', tabs: [{ key: 'components', label: 'Product Components', edit: true }, { key: 'final', label: 'Final Product', edit: true }, { key: 'products', label: 'Product List', edit: true }] },
  ];

  root.DemoData = {
    // dates
    TODAY, YESTERDAY, OPEN_MONTH, PREV_MONTH, START, ACTUAL_START, ALL_TIME_START, DAYS, MONTHS,
    iso, addDays, addMonths, firstOfMonth, daysInMonth, daysBetween, rand,
    // catalogue
    COMPONENT_TYPES, COMPONENT_UNITS, COMPONENT_TYPE_LABELS, COMPONENT_UNIT_LABELS, ALLOCATION_UNIT_LABELS, UNIT_DIVISOR, computeLineCost,
    components, singles, bundles, salesProducts, componentById, singleById, mappingCost, variantBuiltCost, singleCost, bundleCost, productCost,
    // sales
    MONTH_RATE, productRate, productDayView, dailyRows, emptyRow,
    // fixed expenses, records & navigation
    PERF_EXPENSE_ACCOUNTS, initialPerfHistory, resolvePerfExpensesForMonth, recordedByMonth,
    ACCOUNT_TYPES, initialRecords, PERMISSION_TREE,
    // shipping
    COURIERS, courierLabel, shippingAnalysis,
    // purchasing
    usage, shippedUnits, initialPurchases, INVENTORY_GROUPS, inventoryLines,
  };
})(typeof window !== 'undefined' ? window : globalThis);
