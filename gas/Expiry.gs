/**
 * Expiry management (จัดการสินค้าหมดอายุ).
 *
 * Alerts are by DATE only (not by how many are left): a lot shows up once it is within the warning
 * window of its category, and again on/after its expiry day until someone writes it off or closes it.
 *
 * Per lot (columns on Lots): expStatus '' | MARKDOWN | WRITEOFF | CLOSED, expFound (counted on shelf),
 * markdownPct, markdownLeft (pieces still allowed to sell at the markdown price), expBy, expAt.
 *
 * Markdown at the till: the sale line carries markdownLotId + markdownQty; the server prices the cut,
 * uses up the quota, and needs no owner PIN (it is logged as MARKDOWN_SALE). A void gives the quota back.
 */

var EXPIRY_ACTIONS = ['MARKDOWN', 'WRITEOFF', 'CLOSE'];

function expiryDate_(l) {
  if (!l.expiryDate) return '';
  return l.expiryDate instanceof Date ? fmtDate_(l.expiryDate, 'yyyy-MM-dd') : String(l.expiryDate).slice(0, 10);
}

function daysUntil_(ymd) {
  var today = fmtDate_(now_(), 'yyyy-MM-dd');
  return Math.round((new Date(ymd + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / 86400000);
}

/** { category: days } from settings, plus '*' default. */
function warnDays_() {
  var map = {};
  try { map = JSON.parse(getSetting_('expiryWarnDays') || '{}') || {}; } catch (e) { map = {}; }
  map['*'] = num_(getSetting_('expiryDefaultDays')) || 3;
  return map;
}

/** Classify one lot: 'expired' (today or past, not finished), 'near' (in window, untouched), or '' (nothing to do). */
function lotTodo_(l, days, warn) {
  var st = String(l.expStatus || '');
  if (st === 'WRITEOFF' || st === 'CLOSED') return '';
  if (days <= 0) return 'expired';
  if (days <= warn && st === '') return 'near';
  return '';
}

function expiryRows_() {
  var products = {};
  readAll_('Products').forEach(function (p) { products[String(p.sku)] = p; });
  var warn = warnDays_();
  var users = {};
  readAll_('Users').forEach(function (u) { users[u.userId] = u.name; });
  return readAll_('Lots').filter(function (l) { return l.expiryDate; }).map(function (l) {
    var p = products[String(l.sku)] || {};
    var exp = expiryDate_(l);
    var days = daysUntil_(exp);
    var w = warn[p.category] !== undefined ? num_(warn[p.category]) : warn['*'];
    return {
      lotId: l.lotId, sku: String(l.sku), name: p.name || l.sku, category: p.category || '', unit: p.unit || 'ชิ้น',
      price: num_(p.price), receivedAt: l.receivedAt, receiptNo: l.receiptNo, qtyIn: num_(l.qtyIn), qtyLeft: num_(l.qtyLeft),
      unitCost: num_(l.unitCost), expiryDate: exp, daysLeft: days, warnDays: w, todo: lotTodo_(l, days, w),
      status: String(l.expStatus || ''), found: l.expFound === '' ? null : num_(l.expFound),
      markdownPct: num_(l.markdownPct), markdownLeft: num_(l.markdownLeft),
      by: users[l.expBy] || '', at: l.expAt
    };
  });
}

/** Number of lots that need action now (nav badge). */
function expiryTodoCount_() {
  try { return expiryRows_().filter(function (r) { return r.todo; }).length; } catch (e) { return 0; }
}

/** Active markdown quotas for the sale screen: [{ lotId, sku, pct, left, expiryDate }]. */
function activeMarkdowns_() {
  return readAll_('Lots').filter(function (l) { return l.expStatus === 'MARKDOWN' && num_(l.markdownLeft) > 0; }).map(function (l) {
    return { lotId: l.lotId, sku: String(l.sku), pct: num_(l.markdownPct), left: num_(l.markdownLeft), expiryDate: expiryDate_(l) };
  });
}

function api_expiryList(token) {
  return respond_(function () {
    session_(token);
    var rows = expiryRows_();
    var today = fmtDate_(now_(), 'yyyy-MM-dd');
    var month = today.slice(0, 7);
    var loss = 0;
    readAll_('LotUse').forEach(function (u) {
      if (String(u.refNo).indexOf('WO') === 0 && u.createdAt instanceof Date && fmtDate_(u.createdAt, 'yyyy-MM') === month) loss += num_(u.qty) * num_(u.unitCost);
    });
    var todo = rows.filter(function (r) { return r.todo; }).sort(function (a, b) { return a.daysLeft - b.daysLeft; });
    var done = rows.filter(function (r) { return r.status && !r.todo; })
      .sort(function (a, b) { return (b.at instanceof Date ? b.at.getTime() : 0) - (a.at instanceof Date ? a.at.getTime() : 0); }).slice(0, 60);
    return {
      todo: todo, done: done,
      stats: {
        expired: todo.filter(function (r) { return r.todo === 'expired'; }).length,
        near: todo.filter(function (r) { return r.todo === 'near'; }).length,
        doneToday: rows.filter(function (r) { return r.at instanceof Date && fmtDate_(r.at, 'yyyy-MM-dd') === today; }).length,
        lossMonth: round2_(loss)
      },
      warnDays: warnDays_(), markdownPct: num_(getSetting_('markdownPct')) || 30
    };
  });
}

/**
 * act: { lotId, action: MARKDOWN | WRITEOFF | CLOSE, found (counted on shelf), pct?, approvalId? }
 * MARKDOWN — sell `found` pieces at −pct% (staff, no PIN).
 * WRITEOFF — take `found` pieces out of this lot (owner approval for cashiers).
 * CLOSE    — nothing of this lot is left on the shelf; no stock change.
 */
function api_expiryAction(token, act) {
  return respond_(function () {
    var s = session_(token);
    if (!act || EXPIRY_ACTIONS.indexOf(act.action) < 0) throw new Error('เลือกการจัดการ');
    var found = Math.round(num_(act.found));
    if (found < 0) throw new Error('จำนวนติดลบไม่ได้');
    var approver = act.action === 'WRITEOFF' && found > 0 ? consumeApproval_(s, act.approvalId, 'STOCK_ADJUST') : '';
    return withLock_(function () {
      var lot = readAll_('Lots').filter(function (l) { return l.lotId === act.lotId; })[0];
      if (!lot) throw new Error('ไม่พบล็อต');
      var p = readAll_('Products').filter(function (x) { return String(x.sku) === String(lot.sku); })[0] || {};
      var out = { lotId: lot.lotId, action: act.action };
      if (act.action === 'MARKDOWN') {
        var pct = num_(act.pct) || num_(getSetting_('markdownPct')) || 30;
        if (pct <= 0 || pct >= 100) throw new Error('ส่วนลดต้องอยู่ระหว่าง 1–99%');
        if (found < 1) throw new Error('ใส่จำนวนที่เหลือบนชั้น (ถ้าไม่เหลือ กด "ไม่เหลือแล้ว")');
        lot.markdownPct = pct; lot.markdownLeft = found;
        log_(s, 'MARKDOWN', lot.lotId, p.name + ' ' + found + ' ' + (p.unit || 'ชิ้น') + ' −' + pct + '% · หมดอายุ ' + expiryDate_(lot), '');
      } else if (act.action === 'WRITEOFF') {
        if (found > 0) {
          if (found > num_(lot.qtyLeft)) found = num_(lot.qtyLeft);   // never take more than the lot still holds
          var ref = uid_('WO');
          var ctx = fifoOpen_();
          var l2 = (ctx.open[String(lot.sku)] || []).filter(function (x) { return x.lotId === lot.lotId; })[0];
          var cost = 0;
          if (l2 && found > 0) {
            ctx.open[String(lot.sku)] = [l2].concat(ctx.open[String(lot.sku)].filter(function (x) { return x !== l2; }));
            cost = fifoTake_(ctx, lot.sku, found, ref, p);
            ctx.open[String(lot.sku)].sort(function (a, b) { return (a._row || 1e9) - (b._row || 1e9); });
            fifoFlush_(ctx);
            addStockMoves_(s, [{ sku: String(lot.sku), qtyPieces: -found, type: 'WRITEOFF', refNo: ref, note: 'หมดอายุ ' + expiryDate_(lot) }]);
          }
          log_(s, 'WRITEOFF', ref, p.name + ' ' + found + ' ' + (p.unit || 'ชิ้น') + ' · หมดอายุ · ทุน ' + cost + ' บาท', approver);
          out.cost = cost;
          lot = readAll_('Lots').filter(function (l) { return l.lotId === act.lotId; })[0];   // qtyLeft changed
        }
        lot.markdownLeft = 0;
      } else {
        lot.markdownLeft = 0;
        log_(s, 'EXPIRY_CLOSE', lot.lotId, p.name + ' · ไม่เหลือบนชั้น · หมดอายุ ' + expiryDate_(lot), '');
      }
      lot.expStatus = act.action === 'CLOSE' ? 'CLOSED' : act.action;
      lot.expFound = found;
      lot.expBy = s.userId;
      lot.expAt = now_();
      writeRow_('Lots', lot);
      return out;
    });
  });
}

/** Owner: warning days per category ({ "นม": 2, "*": 3 }) and the default markdown %. */
function api_saveExpirySettings(token, warn, pct) {
  return respond_(function () {
    owner_(token);
    var clean = {};
    Object.keys(warn || {}).forEach(function (k) {
      var n = Math.round(num_(warn[k]));
      if (k !== '*' && n >= 0 && n <= 60) clean[k] = n;
    });
    var def = Math.round(num_((warn || {})['*'])) || 3;
    var p = Math.round(num_(pct)) || 30;
    if (p <= 0 || p >= 100) throw new Error('ส่วนลดต้องอยู่ระหว่าง 1–99%');
    withLock_(function () {
      saveSettingRaw_('expiryWarnDays', JSON.stringify(clean));
      saveSettingRaw_('expiryDefaultDays', String(def));
      saveSettingRaw_('markdownPct', String(p));
    });
    return { warnDays: warnDays_(), markdownPct: p };
  });
}

/**
 * Called by priceLines_: validate a markdown on one sale line and return its discount.
 * md: { lotId, qty } ; line: priced line (unitPrice per unit, multiplier).
 */
function markdownFor_(md, line, lots) {
  var lot = lots[md.lotId];
  var q = Math.round(num_(md.qty));
  if (!lot || lot.expStatus !== 'MARKDOWN' || String(lot.sku) !== line.sku) throw new Error('ราคาลดใกล้หมดอายุของ ' + line.name + ' ใช้ไม่ได้แล้ว');
  if (line.multiplier !== 1) throw new Error('ราคาลดใกล้หมดอายุใช้กับหน่วยชิ้นเท่านั้น');
  if (q < 1 || q > line.qty) throw new Error('จำนวนลดราคาของ ' + line.name + ' ไม่ถูกต้อง');
  if (q > num_(lot.markdownLeft)) throw new Error(line.name + ' ลดราคาได้อีก ' + num_(lot.markdownLeft) + ' ชิ้น');
  return { lotId: md.lotId, qty: q, pct: num_(lot.markdownPct), amount: round2_(line.unitPrice * q * num_(lot.markdownPct) / 100) };
}

/** Use up (sign -1) or give back (+1) markdown quota. Caller holds the lock. */
function moveMarkdown_(items, sign) {
  if (!items.length) return;
  var lots = {};
  readAll_('Lots').forEach(function (l) { lots[l.lotId] = l; });
  var col = SCHEMA.Lots.indexOf('markdownLeft') + 1;
  var sh = sheet_('Lots');
  items.forEach(function (it) {
    var l = lots[it.lotId];
    if (!l) return;
    l.markdownLeft = Math.max(0, num_(l.markdownLeft) + sign * it.qty);
    sh.getRange(l._row, col).setValue(l.markdownLeft);
  });
}
