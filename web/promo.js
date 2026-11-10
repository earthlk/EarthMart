/*
 * Promotion engine — the SAME file runs in the browser (web/promo.js) and in Apps Script (gas/PromoEngine.gs).
 * A test checks the two copies are identical; edit web/promo.js and copy it over.
 *
 * promoApply(lines, promos, when)
 *   lines:  [{ key, sku, qty, unitPrice, eligible }]   eligible = single piece, no open price, no near-expiry markdown
 *   promos: [{ promoId, name, type: 'multi'|'bxgy'|'combo', active, items, buyQty, freeQty, price,
 *              startDate, endDate, days, timeFrom, timeTo }]
 *           multi: buy buyQty pieces from items (skus, mix allowed) for price
 *           bxgy:  every buyQty + freeQty pieces from items, the freeQty cheapest are free
 *           combo: items = [{ sku, qty }] together for price
 *   when:   { ymd: 'yyyy-MM-dd', dow: 0-6 (Sunday = 0), hm: 'HH:mm' } in the shop's time zone
 * Returns { byKey: { key: discount }, applied: [{ promoId, name, times, discount }], total }
 * Each piece is used by one promotion at most: combos first, then multi-buys, then buy-X-get-Y.
 */
function promoLive(p, when) {
  if (!p || !(p.active === true || p.active === 'TRUE' || p.active === 'true')) return false;
  if (p.startDate && when.ymd < String(p.startDate).slice(0, 10)) return false;
  if (p.endDate && when.ymd > String(p.endDate).slice(0, 10)) return false;
  var days = String(p.days === undefined || p.days === null ? '' : p.days).split(',').filter(function (d) { return d !== ''; });
  if (days.length && days.indexOf(String(when.dow)) < 0) return false;
  if (p.timeFrom && p.timeTo) {
    var a = String(p.timeFrom), b = String(p.timeTo);
    if (a <= b ? !(when.hm >= a && when.hm < b) : !(when.hm >= a || when.hm < b)) return false;
  }
  return true;
}

function promoItems(p) {
  var it = p.items;
  if (typeof it === 'string') { try { it = JSON.parse(it || '[]'); } catch (e) { it = []; } }
  return Array.isArray(it) ? it : [];
}

function promoApply(lines, promos, when) {
  var units = [];
  (lines || []).forEach(function (l) {
    if (!l.eligible) return;
    var q = Math.max(0, Math.floor(Number(l.qty) || 0));
    for (var i = 0; i < q; i++) units.push({ key: l.key, sku: String(l.sku), price: Number(l.unitPrice) || 0, used: false });
  });
  var byKey = {}, applied = [], total = 0;
  var byPrice = function (a, b) { return b.price - a.price || (a.key > b.key ? 1 : a.key < b.key ? -1 : 0); };
  var pool = function (skus) { return units.filter(function (u) { return !u.used && skus.indexOf(u.sku) >= 0; }).sort(byPrice); };
  // Split a discount over pieces by price, in satang, so the per-line amounts add up exactly.
  var share = function (list, disc) {
    var cents = Math.round(disc * 100), sum = 0, given = 0;
    list.forEach(function (u) { sum += u.price; });
    if (!sum || cents <= 0) return;
    var parts = list.map(function (u) { var c = Math.floor(cents * u.price / sum); given += c; return c; });
    for (var i = 0; given < cents; i = (i + 1) % parts.length) { parts[i]++; given++; }
    list.forEach(function (u, i) { byKey[u.key] = Math.round(((byKey[u.key] || 0) * 100 + parts[i])) / 100; });
  };
  var done = function (p, times, disc) {
    disc = Math.round(disc * 100) / 100;
    applied.push({ promoId: p.promoId, name: p.name, times: times, discount: disc });
    total = Math.round((total + disc) * 100) / 100;
  };
  var order = { combo: 0, multi: 1, bxgy: 2 };
  (promos || []).filter(function (p) { return promoLive(p, when) && order[p.type] !== undefined; })
    .map(function (p, i) { return { p: p, i: i }; })
    .sort(function (a, b) { return order[a.p.type] - order[b.p.type] || a.i - b.i; })
    .forEach(function (x) {
      var p = x.p, items = promoItems(p), price = Number(p.price) || 0;
      if (p.type === 'combo') {
        var comps = items.filter(function (c) { return c && c.sku && Number(c.qty) > 0; });
        if (!comps.length) return;
        var sets = Infinity;
        comps.forEach(function (c) { sets = Math.min(sets, Math.floor(pool([String(c.sku)]).length / Number(c.qty))); });
        if (!(sets > 0) || sets === Infinity) return;
        var take = [];
        comps.forEach(function (c) { take = take.concat(pool([String(c.sku)]).slice(0, Number(c.qty) * sets)); });
        var normal = take.reduce(function (a, u) { return a + u.price; }, 0);
        var disc = normal - sets * price;
        if (disc <= 0.004) return;
        take.forEach(function (u) { u.used = true; });
        share(take, disc); done(p, sets, disc);
        return;
      }
      var skus = items.map(String);
      var n = Math.floor(Number(p.buyQty) || 0);
      if (p.type === 'multi') {
        if (n < 2) return;
        // Sets from the dearest pieces down; a set only counts while it actually saves money.
        var pl = pool(skus), k = 0, d = 0, t = [];
        for (var j = 0; j + n <= pl.length; j += n) {
          var set = pl.slice(j, j + n), sum = set.reduce(function (a, u) { return a + u.price; }, 0);
          if (sum - price <= 0.004) break;
          k++; d += sum - price; t = t.concat(set);
        }
        if (!k) return;
        t.forEach(function (u) { u.used = true; });
        share(t, d); done(p, k, d);
        return;
      }
      if (p.type === 'bxgy') {
        var y = Math.floor(Number(p.freeQty) || 0);
        if (n < 1 || y < 1) return;
        var pb = pool(skus), size = n + y, chunks = Math.floor(pb.length / size);
        if (!chunks) return;
        var free = [], dd = 0;
        for (var c = 0; c < chunks; c++) {
          var chunk = pb.slice(c * size, c * size + size);
          chunk.forEach(function (u) { u.used = true; });
          chunk.slice(n).forEach(function (u) { free.push(u); dd += u.price; });
        }
        if (dd <= 0.004) return;
        free.forEach(function (u) { byKey[u.key] = Math.round(((byKey[u.key] || 0) + u.price) * 100) / 100; });
        done(p, chunks, dd);
      }
    });
  return { byKey: byKey, applied: applied, total: total };
}

if (typeof window !== 'undefined') { window.promoApply = promoApply; window.promoLive = promoLive; window.promoItems = promoItems; }
