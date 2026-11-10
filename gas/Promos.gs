/**
 * Promotions (owner sets them up on the Products page; the till applies them by itself).
 * One row per promotion; the conditions live in a JSON "rule" column so Sheets never turns
 * dates, times or "1,2,3" into something else. Pricing itself is in PromoEngine.gs (shared with the browser).
 */

var PROMO_TYPES = ['multi', 'bxgy', 'combo'];

function promoRow_(r) {
  var rule = {};
  try { rule = JSON.parse(r.rule || '{}') || {}; } catch (e) { rule = {}; }
  return {
    promoId: String(r.promoId), name: r.name, type: r.type, active: bool_(r.active),
    items: rule.items || [], buyQty: num_(rule.buyQty), freeQty: num_(rule.freeQty), price: num_(rule.price),
    startDate: rule.startDate || '', endDate: rule.endDate || '', days: (rule.days || []).join(','),
    timeFrom: rule.timeFrom || '', timeTo: rule.timeTo || '', updatedAt: r.updatedAt
  };
}

function allPromos_() { return readAll_('Promotions').map(promoRow_); }

/** Promotions the till needs: switched on and not over yet. */
function promosForClient_() {
  var today = fmtDate_(now_(), 'yyyy-MM-dd');
  return allPromos_().filter(function (p) { return p.active && (!p.endDate || p.endDate >= today); });
}

/** Shop-time "when" for the engine. */
function promoWhen_(d) {
  return { ymd: fmtDate_(d, 'yyyy-MM-dd'), dow: Number(fmtDate_(d, 'u')) % 7, hm: fmtDate_(d, 'HH:mm') };
}

function api_listPromos(token) {
  return respond_(function () {
    owner_(token);
    return allPromos_();
  });
}

/** p = { promoId?, name, type, active, items, buyQty, freeQty, price, startDate, endDate, days: [0-6], timeFrom, timeTo } */
function api_savePromo(token, p) {
  return respond_(function () {
    var s = owner_(token);
    p = p || {};
    var name = String(p.name || '').trim();
    if (!name) throw new Error('ต้องใส่ชื่อโปรโมชั่น');
    if (PROMO_TYPES.indexOf(p.type) < 0) throw new Error('ประเภทโปรโมชั่นไม่ถูกต้อง');
    var products = {};
    readAll_('Products').forEach(function (x) { products[String(x.sku)] = x; });
    var rule = { startDate: dateOnly_(p.startDate), endDate: dateOnly_(p.endDate), timeFrom: hm_(p.timeFrom), timeTo: hm_(p.timeTo),
                 days: (p.days || []).map(Number).filter(function (d) { return d >= 0 && d <= 6; }) };
    if (rule.startDate && rule.endDate && rule.endDate < rule.startDate) throw new Error('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
    if ((rule.timeFrom && !rule.timeTo) || (!rule.timeFrom && rule.timeTo)) throw new Error('ใส่เวลาเริ่มและเวลาสิ้นสุดให้ครบ');
    var normal = 0;
    if (p.type === 'combo') {
      rule.items = (p.items || []).map(function (c) { return { sku: String(c.sku), qty: Math.floor(num_(c.qty)) }; })
        .filter(function (c) { return c.sku && c.qty > 0; });
      if (rule.items.length < 2 && !(rule.items.length === 1 && rule.items[0].qty > 1)) throw new Error('เซ็ตต้องมีสินค้าอย่างน้อย 2 ชิ้น');
      rule.items.forEach(function (c) { if (!products[c.sku]) throw new Error('ไม่พบสินค้า ' + c.sku); normal += num_(products[c.sku].price) * c.qty; });
      rule.price = round2_(num_(p.price));
      if (!(rule.price > 0)) throw new Error('ใส่ราคาเซ็ต');
      if (rule.price >= normal) throw new Error('ราคาเซ็ตต้องถูกกว่าราคาปกติ (' + round2_(normal) + ' บาท)');
    } else {
      rule.items = (p.items || []).map(String).filter(function (k, i, a) { return k && a.indexOf(k) === i; });
      if (!rule.items.length) throw new Error('เลือกสินค้าอย่างน้อย 1 รายการ');
      rule.items.forEach(function (k) { if (!products[k]) throw new Error('ไม่พบสินค้า ' + k); });
      rule.buyQty = Math.floor(num_(p.buyQty));
      if (p.type === 'multi') {
        if (rule.buyQty < 2) throw new Error('จำนวนชิ้นต้องตั้งแต่ 2 ขึ้นไป');
        rule.price = round2_(num_(p.price));
        if (!(rule.price > 0)) throw new Error('ใส่ราคาโปร');
        var top = Math.max.apply(null, rule.items.map(function (k) { return num_(products[k].price); }));
        if (rule.price >= top * rule.buyQty) throw new Error('ราคาโปรต้องถูกกว่าซื้อปกติ (' + round2_(top * rule.buyQty) + ' บาท)');
      } else {
        rule.freeQty = Math.floor(num_(p.freeQty));
        if (rule.buyQty < 1 || rule.freeQty < 1) throw new Error('ใส่จำนวนซื้อและจำนวนแถม');
      }
    }
    return withLock_(function () {
      var rows = readAll_('Promotions');
      var row = p.promoId ? rows.filter(function (r) { return String(r.promoId) === String(p.promoId); })[0] : null;
      var data = { name: name, type: p.type, active: p.active !== false, rule: JSON.stringify(rule), updatedAt: now_() };
      if (row) { Object.keys(data).forEach(function (k) { row[k] = data[k]; }); writeRow_('Promotions', row); }
      else { row = Object.assign({ promoId: uid_('PR'), createdAt: now_(), createdBy: s.userId }, data); append_('Promotions', row); }
      log_(s, 'PROMO_SAVE', row.promoId, name, '');
      return promoRow_(row);
    });
  });
}

function api_setPromoActive(token, promoId, active) {
  return respond_(function () {
    var s = owner_(token);
    return withLock_(function () {
      var row = readAll_('Promotions').filter(function (r) { return String(r.promoId) === String(promoId); })[0];
      if (!row) throw new Error('ไม่พบโปรโมชั่น');
      row.active = !!active; row.updatedAt = now_();
      writeRow_('Promotions', row);
      log_(s, active ? 'PROMO_ON' : 'PROMO_OFF', row.promoId, row.name, '');
      return promoRow_(row);
    });
  });
}

function dateOnly_(v) {
  if (!v) return '';
  if (v instanceof Date) return fmtDate_(v, 'yyyy-MM-dd');
  var m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v));
  if (!m) throw new Error('วันที่ไม่ถูกต้อง');
  return m[1];
}
function hm_(v) {
  if (!v) return '';
  var m = /^(\d{1,2}):(\d{2})/.exec(String(v));
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new Error('เวลาไม่ถูกต้อง');
  return ('0' + m[1]).slice(-2) + ':' + m[2];
}

/**
 * Promotions for priced sale lines. Mutates each line: .promo (baht off this line).
 * clientPromo (offline sales only): the amounts the till already charged, kept as long as they fit the line.
 * Returns the applied list [{ promoId, name, times, discount }].
 */
function applySalePromos_(priced, at, clientPromo) {
  if (clientPromo) {
    var applied = clientPromo.applied || [];
    priced.forEach(function (l, i) {
      var v = round2_(Math.max(0, num_((clientPromo.lines || [])[i])));
      l.promo = Math.min(v, round2_(l.qty * l.unitPrice - l.lineDiscount));
    });
    return applied.map(function (a) { return { promoId: String(a.promoId || ''), name: String(a.name || ''), times: num_(a.times), discount: round2_(num_(a.discount)) }; });
  }
  var r = promoApply(priced.map(function (l, i) {
    return { key: 'L' + ('00' + i).slice(-3), sku: l.sku, qty: l.qty, unitPrice: l.unitPrice, eligible: l.multiplier === 1 && !l.openPrice && !l.md };
  }), allPromos_(), promoWhen_(at));
  priced.forEach(function (l, i) { l.promo = round2_(r.byKey['L' + ('00' + i).slice(-3)] || 0); });
  return r.applied;
}
