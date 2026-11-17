/**
 * Minimum stock (reorder point) worked out from sales, so nobody has to type it.
 *
 *   sold per day  = pieces that left by sale (SALE − VOID − RETURN moves, recipes exploded to their
 *                   ingredients) over the last REORDER_WINDOW days, or since the product first moved
 *   cover days    = how often this product is restocked: the median gap between the days it was
 *                   received (needs 2+ receipts); else the gap of the supplier it last came from;
 *                   else Settings.reorderDays (default 7) — never more than half the shelf life,
 *                   so stock turns over before it expires
 *   shelf life    = median days from receipt to expiry of its lots (when expiry dates were entered)
 *   minStock      = ceil(sold per day × cover days), at least 1 once it sells
 *
 * A number typed in Products.minManual wins over the computed one. Recomputed at most once a day
 * (on the first bootstrap of the day) and on demand by the owner.
 */

var REORDER_WINDOW = 28;   // days of sales looked at
var REORDER_MIN_DAYS = 7;  // fewer days of history than this → not enough to judge yet

function dateOf_(v) {
  if (v instanceof Date) return v;
  if (!v) return null;
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]) > 2400 ? Number(m[3]) - 543 : Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function minStockFigures_() {
  var DAY = 86400000, now = now_().getTime(), from = now - REORDER_WINDOW * DAY;
  var sold = {}, first = {};
  var seen = function (sku, t) { if (!first[sku] || t < first[sku]) first[sku] = t; };
  readAll_('StockMoves').forEach(function (m) {
    var d = dateOf_(m.createdAt); if (!d) return;
    var t = d.getTime(), sku = String(m.sku);
    seen(sku, t);
    if (t < from) return;
    var q = num_(m.qtyPieces);
    if (m.type === 'SALE' || m.type === 'VOID' || m.type === 'RETURN') sold[sku] = (sold[sku] || 0) - q;
  });
  var shelf = {}, recvDays = {}, lastSup = {}, supDays = {};
  var supOf = {};
  readAll_('Receipts').forEach(function (rc) { supOf[String(rc.receiptNo)] = String(rc.supplier || '').trim(); });
  var dayKey = function (d) { return Math.floor((d.getTime() + 7 * 3600000) / DAY); };  // Thai calendar day
  readAll_('Lots').forEach(function (l) {
    var r = dateOf_(l.receivedAt), e = dateOf_(l.expiryDate), sku = String(l.sku);
    if (r) seen(sku, r.getTime());
    if (r && e && e > r) (shelf[sku] = shelf[sku] || []).push((e - r) / DAY);
    if (!r || l.receiptNo === 'OPENING') return;
    var k = dayKey(r), sup = supOf[String(l.receiptNo)] || '';
    (recvDays[sku] = recvDays[sku] || {})[k] = true;
    if (!lastSup[sku] || k >= lastSup[sku].k) lastSup[sku] = { k: k, sup: sup };
    if (sup) (supDays[sup] = supDays[sup] || {})[k] = true;
  });
  var gapOf = function (set) {
    var ks = Object.keys(set || {}).map(Number).sort(function (a, b) { return a - b; }).slice(-7);
    if (ks.length < 2) return 0;
    var g = []; for (var i = 1; i < ks.length; i++) g.push(ks[i] - ks[i - 1]);
    return Math.min(60, Math.max(1, Math.round(median_(g))));
  };
  var supGap = {};
  Object.keys(supDays).forEach(function (sup) { supGap[sup] = gapOf(supDays[sup]); });
  var fallback = Math.max(1, num_(getSetting_('reorderDays')) || 7);
  var out = {};
  Object.keys(first).forEach(function (sku) {
    var days = Math.min(REORDER_WINDOW, (now - Math.max(from, first[sku])) / DAY);
    var sl = shelf[sku] ? median_(shelf[sku]) : 0;
    var cycle = gapOf(recvDays[sku]) || (lastSup[sku] && supGap[lastSup[sku].sup]) || 0;
    var cover = cycle || fallback;
    var o = { days: days, shelfDays: sl ? Math.round(sl) : '', cycleDays: cycle || '', avgDaily: '', min: null };
    if (days >= REORDER_MIN_DAYS) {
      var daily = Math.max(0, sold[sku] || 0) / days;
      var c = sl ? Math.min(cover, sl / 2) : cover;
      o.avgDaily = round2_(daily);
      o.min = daily > 0 ? Math.max(1, Math.ceil(daily * c)) : 0;
    }
    out[sku] = o;
  });
  return out;
}

function median_(a) {
  var b = a.slice().sort(function (x, y) { return x - y; }), n = b.length;
  return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2;
}

/** Write minStock / avgDaily / shelfDays for every product. → { updated, auto, manual, waiting } */
function recomputeMinStock_() {
  var fig = minStockFigures_();
  var rows = readAll_('Products');
  if (!rows.length) return { updated: 0, auto: 0, manual: 0, waiting: 0 };
  var sh = sheet_('Products'), S = SCHEMA.Products;
  var cMin = S.indexOf('minStock'), cAvg = S.indexOf('avgDaily'), cShelf = S.indexOf('shelfDays');
  var n = { updated: 0, auto: 0, manual: 0, waiting: 0 };
  // Index by sheet row so blank rows in the sheet cannot shift values onto the wrong product.
  var last = sh.getLastRow();
  var colMin = sh.getRange(2, cMin + 1, last - 1, 1).getValues();
  var colExtra = sh.getRange(2, cAvg + 1, last - 1, 3).getValues();
  rows.forEach(function (p) {
    var f = fig[String(p.sku)] || {}, man = p.minManual;
    var min = num_(p.minStock);
    if (p.type === 'recipe') min = 0;
    else if (man !== '' && man !== null && man !== undefined) { min = num_(man); n.manual++; }
    else if (f.min !== null && f.min !== undefined) { min = f.min; n.auto++; }
    else n.waiting++;
    if (min !== num_(p.minStock)) n.updated++;
    colMin[p._row - 2] = [min];
    colExtra[p._row - 2] = [f.avgDaily === undefined ? '' : f.avgDaily, f.shelfDays === undefined ? '' : f.shelfDays, f.cycleDays === undefined ? '' : f.cycleDays];
  });
  // minStock, then avgDaily / shelfDays / cycleDays (side by side at the end)
  sh.getRange(2, cMin + 1, last - 1, 1).setValues(colMin);
  sh.getRange(2, cAvg + 1, last - 1, 3).setValues(colExtra);
  saveSettingRaw_('minStockAt', fmtDate_(now_(), 'yyyy-MM-dd'));
  return n;
}

/** Once a day, from bootstrap; never lets a failure stop the app from loading. */
function maybeRecomputeMinStock_() {
  try {
    if (getSetting_('minStockAt') === fmtDate_(now_(), 'yyyy-MM-dd')) return;
    withLock_(function () {
      if (getSetting_('minStockAt') === fmtDate_(now_(), 'yyyy-MM-dd')) return;
      recomputeMinStock_();
    });
  } catch (e) { console.error('minStock: ' + e); }
}

function api_recomputeMinStock(token) {
  return respond_(function () {
    owner_(token);
    return withLock_(function () { return recomputeMinStock_(); });
  });
}
