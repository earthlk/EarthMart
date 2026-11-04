/**
 * Stock is the sum of StockMoves (in pieces). Products.onHand is a cached total kept in step
 * with every move, so screens never have to add up the whole move history.
 *
 * Move types: OPEN (opening stock), RECEIVE (goods in), SALE (negative), VOID (sale reversed), ADJUST (count / correction)
 */

/**
 * moves: [{ sku, qtyPieces, type, refNo, note }]
 * Caller must hold the script lock.
 */
function addStockMoves_(sess, moves) {
  if (!moves.length) return;
  var stamp = now_();
  appendMany_('StockMoves', moves.map(function (m) {
    return { moveId: uid_('M'), createdAt: stamp, sku: m.sku, qtyPieces: m.qtyPieces, type: m.type,
             refNo: m.refNo || '', userId: sess.userId, note: m.note || '' };
  }));

  var delta = {};
  moves.forEach(function (m) { delta[m.sku] = (delta[m.sku] || 0) + num_(m.qtyPieces); });
  var products = readAll_('Products');
  var col = SCHEMA.Products.indexOf('onHand') + 1;
  var sh = sheet_('Products');
  products.forEach(function (p) {
    var d = delta[String(p.sku)];
    if (d) sh.getRange(p._row, col).setValue(round2_(num_(p.onHand) + d));
  });
}

function api_stockList(token) {
  return respond_(function () {
    session_(token);
    return readAll_('Products').filter(function (p) { return bool_(p.active) && p.type !== 'recipe'; }).map(function (p) {
      return { sku: String(p.sku), name: p.name, category: p.category, unit: p.unit || 'ชิ้น',
               onHand: num_(p.onHand), minStock: num_(p.minStock), cost: num_(p.cost), forSale: forSale_(p) };
    });
  });
}

/**
 * Set the counted quantity for one product. The difference becomes an ADJUST move.
 * Owners act directly; cashiers need an owner approval id for 'STOCK_ADJUST'.
 */
function api_setStockCount(token, sku, countedPieces, reason, approvalId) {
  return respond_(function () {
    var s = session_(token);
    var approver = consumeApproval_(s, approvalId, 'STOCK_ADJUST');
    var counted = num_(countedPieces);
    if (counted < 0) throw new Error('จำนวนติดลบไม่ได้');
    if (!String(reason || '').trim()) throw new Error('ต้องใส่เหตุผล');
    return withLock_(function () {
      var p = readAll_('Products').filter(function (x) { return String(x.sku) === String(sku); })[0];
      if (!p) throw new Error('ไม่พบสินค้า');
      if (p.type === 'recipe') throw new Error('สูตรผสมไม่มีสต็อกของตัวเอง — ปรับที่ส่วนประกอบแทน');
      var diff = round2_(counted - num_(p.onHand));
      if (diff !== 0) {
        var ref = uid_('ADJ');
        var ctx = fifoOpen_();
        if (diff < 0) fifoTake_(ctx, sku, -diff, ref, p);
        else {
          var add = round2_(counted - fifoLeft_(ctx, sku));   // lots must hold exactly what is counted
          if (add > 0) fifoAddLot_(ctx, { sku: sku, receiptNo: ref, qtyIn: add, unitCost: fifoLastCost_(ctx, String(sku), p), note: 'ปรับยอด: ' + reason });
        }
        fifoFlush_(ctx);
        addStockMoves_(s, [{ sku: String(sku), qtyPieces: diff, type: 'ADJUST', refNo: ref, note: reason }]);
        log_(s, 'STOCK_ADJUST', String(sku), p.name + ': ' + p.onHand + ' → ' + counted + ' (' + reason + ')', approver);
      }
      return { sku: String(sku), onHand: counted, diff: diff };
    });
  });
}

function api_stockMoves(token, sku) {
  return respond_(function () {
    session_(token);
    return readAll_('StockMoves').filter(function (m) { return String(m.sku) === String(sku); })
      .slice(-50).reverse();
  });
}

/* ------------------------------------------------------------------ */
/* Stock count (ตรวจนับ) and write-off (ตัดเสีย)                         */
/* ------------------------------------------------------------------ */

var WRITEOFF_REASONS = ['หมดอายุ', 'เสียหาย', 'สูญหาย'];

/**
 * Cost of goods that left the shop without a sale, this month, split into
 * loss (damaged / lost), expiry, and store use (an expense, not a loss).
 */
function outflowMonth_(month) {
  var kind = {};
  readAll_('StockMoves').forEach(function (m) {
    if (m.type === 'STORE_USE') kind[m.refNo] = 'use';
    else if (m.type === 'WRITEOFF') kind[m.refNo] = String(m.note).indexOf('หมดอายุ') === 0 ? 'expiry'
      : String(m.note).indexOf('ใช้ในร้าน') === 0 ? 'use' : 'loss';   // old write-offs with reason ใช้ในร้าน
  });
  var out = { loss: 0, expiry: 0, use: 0 };
  readAll_('LotUse').forEach(function (u) {
    var k = kind[u.refNo];
    if (k && u.createdAt instanceof Date && fmtDate_(u.createdAt, 'yyyy-MM') === month) out[k] += num_(u.qty) * num_(u.unitCost);
  });
  Object.keys(out).forEach(function (k) { out[k] = round2_(out[k]); });
  return out;
}

/**
 * เบิกใช้ในร้าน: goods taken for the shop's own use (opened from the sale screen).
 * su: { useUid, lines: [{ sku, barcode?, qty }], note, approvalId }
 * Pack barcodes count their pieces; a recipe item takes its components. Idempotent by useUid.
 */
function api_storeUse(token, su) {
  return respond_(function () {
    var s = session_(token);
    if (!su) throw new Error('ข้อมูลไม่ครบ');
    var inLines = su.lines || (su.sku ? [{ sku: su.sku, qty: su.qty }] : []);
    if (!inLines.length) throw new Error('ยังไม่มีสินค้า');
    var note = String(su.note || '').trim().slice(0, 100);
    if (!note) throw new Error('ใส่ว่าใช้ทำอะไร');
    var cache = CacheService.getScriptCache();
    var key = su.useUid ? 'su:' + su.useUid : '';
    if (key && cache.get(key)) return JSON.parse(cache.get(key));
    var approver = consumeApproval_(s, su.approvalId, 'STOCK_ADJUST');
    return withLock_(function () {
      if (key && cache.get(key)) return JSON.parse(cache.get(key));
      var products = {};
      readAll_('Products').forEach(function (p) { products[String(p.sku)] = p; });
      var codes = {};
      readAll_('Barcodes').forEach(function (b) { codes[String(b.barcode)] = b; });
      var rec = recipesMap_();
      var ref = uid_('SU');
      var ctx = fifoOpen_();
      var cost = 0, names = [];
      var lines = inLines.map(function (l) {
        var b = l.barcode ? codes[String(l.barcode)] : null;
        var sku = String(b ? b.sku : l.sku);
        var p = products[sku];
        if (!p) throw new Error('ไม่พบสินค้า ' + (l.barcode || l.sku));
        var qty = num_(l.qty);
        if (!(qty > 0) || Math.round(qty) !== qty) throw new Error('จำนวนของ ' + p.name + ' ต้องเป็นจำนวนเต็มมากกว่า 0');
        var mult = b ? num_(b.multiplier) || 1 : 1;
        var pieces = qty * mult;
        var comps = rec[sku];
        if (comps && comps.length) comps.forEach(function (c) { cost += fifoTake_(ctx, c.sku, pieces * c.qty, ref, products[c.sku]); });
        else cost += fifoTake_(ctx, sku, pieces, ref, p);
        names.push(p.name + ' ' + pieces);
        return { sku: sku, name: p.name, qty: qty, multiplier: mult };
      });
      fifoFlush_(ctx);
      addStockMoves_(s, explodeMoves_(lines, -1, 'STORE_USE', ref, note));
      cost = round2_(cost);
      log_(s, 'STORE_USE', ref, names.join(', ') + ' · ' + note + ' · ทุน ' + cost + ' บาท', approver);
      var out = { refNo: ref, cost: cost, items: lines.length };
      if (key) cache.put(key, JSON.stringify(out), 21600);
      return out;
    });
  });
}

/** Value of what is left in lots, per sku. */
function lotValues_() {
  var v = {};
  readAll_('Lots').forEach(function (l) {
    var q = num_(l.qtyLeft);
    if (q > 0) v[String(l.sku)] = (v[String(l.sku)] || 0) + q * num_(l.unitCost);
  });
  return v;
}

/**
 * Count many products at once. lines: [{ sku, counted }] — only products actually counted.
 * Every difference becomes an ADJUST move under one reference, lots follow FIFO.
 * Cashiers need one owner approval ('STOCK_ADJUST') for the whole count.
 */
function api_stockCount(token, cnt) {
  return respond_(function () {
    var s = session_(token);
    if (!cnt || !cnt.countUid) throw new Error('ข้อมูลไม่ครบ');
    var lines = (cnt.lines || []).filter(function (l) { return l && l.sku && l.counted !== '' && l.counted !== null && l.counted !== undefined; });
    if (!lines.length) throw new Error('ยังไม่ได้นับสินค้า');
    return withLock_(function () {
      var dup = readAll_('StockMoves').filter(function (m) { return m.refNo === cnt.countUid; })[0];
      if (dup) return { refNo: cnt.countUid, duplicate: true };
      var products = {};
      readAll_('Products').forEach(function (p) { products[String(p.sku)] = p; });
      var ctx = fifoOpen_();
      var moves = [], plus = 0, minus = 0, changed = 0;
      var diffs = lines.map(function (l) {
        var p = products[String(l.sku)];
        if (!p) throw new Error('ไม่พบสินค้า ' + l.sku);
        if (p.type === 'recipe') throw new Error(p.name + ' เป็นสูตรผสม — นับที่ส่วนประกอบแทน');
        var counted = num_(l.counted);
        if (counted < 0) throw new Error('จำนวนของ ' + p.name + ' ติดลบไม่ได้');
        return { p: p, sku: String(l.sku), counted: counted, diff: round2_(counted - num_(p.onHand)) };
      }).filter(function (d) { return d.diff !== 0; });
      var approver = diffs.length ? consumeApproval_(s, cnt.approvalId, 'STOCK_ADJUST') : '';
      diffs.forEach(function (d) {
        if (d.diff < 0) minus += fifoTake_(ctx, d.sku, -d.diff, cnt.countUid, d.p);
        else {
          var add = round2_(d.counted - fifoLeft_(ctx, d.sku));
          var c = fifoLastCost_(ctx, d.sku, d.p);
          if (add > 0) fifoAddLot_(ctx, { sku: d.sku, receiptNo: cnt.countUid, qtyIn: add, unitCost: c, note: 'ตรวจนับ' });
          plus += d.diff * c;
        }
        moves.push({ sku: d.sku, qtyPieces: d.diff, type: 'ADJUST', refNo: cnt.countUid, note: 'ตรวจนับ' + (cnt.note ? ': ' + cnt.note : '') });
        changed++;
      });
      if (moves.length) {
        fifoFlush_(ctx);
        addStockMoves_(s, moves);
      }
      var net = round2_(plus - minus);
      log_(s, 'STOCK_COUNT', cnt.countUid, 'นับ ' + lines.length + ' รายการ · ต่าง ' + changed + ' · มูลค่าส่วนต่าง ' + net + ' บาท' + (cnt.note ? ' · ' + cnt.note : ''), approver);
      return { refNo: cnt.countUid, counted: lines.length, changed: changed, plusValue: round2_(plus), minusValue: round2_(minus), netValue: net };
    });
  });
}

/**
 * Write off damaged / expired / lost stock. wo: { sku, qty, reason, lotId?, note?, approvalId? }
 * With lotId the pieces come out of that lot (expiry page); otherwise oldest lots first.
 */
function api_writeOff(token, wo) {
  return respond_(function () {
    var s = session_(token);
    if (!wo || !wo.sku) throw new Error('เลือกสินค้า');
    var qty = num_(wo.qty);
    if (!(qty > 0)) throw new Error('จำนวนต้องมากกว่า 0');
    var reason = String(wo.reason || '');
    if (WRITEOFF_REASONS.indexOf(reason) < 0) throw new Error('เลือกเหตุผล');
    var approver = consumeApproval_(s, wo.approvalId, 'STOCK_ADJUST');
    return withLock_(function () {
      var p = readAll_('Products').filter(function (x) { return String(x.sku) === String(wo.sku); })[0];
      if (!p) throw new Error('ไม่พบสินค้า');
      if (p.type === 'recipe') throw new Error('สูตรผสมไม่มีสต็อกของตัวเอง — ตัดที่ส่วนประกอบแทน');
      var ref = uid_('WO');
      var ctx = fifoOpen_();
      var cost;
      if (wo.lotId) {
        var lot = (ctx.open[String(wo.sku)] || []).filter(function (l) { return l.lotId === wo.lotId; })[0];
        if (!lot) throw new Error('ล็อตนี้ไม่มีของเหลือแล้ว');
        if (qty > num_(lot.qtyLeft)) throw new Error('ล็อตนี้เหลือ ' + num_(lot.qtyLeft) + ' ชิ้น');
        // move the chosen lot to the front so FIFO takes from it
        ctx.open[String(wo.sku)] = [lot].concat(ctx.open[String(wo.sku)].filter(function (l) { return l !== lot; }));
      }
      cost = fifoTake_(ctx, wo.sku, qty, ref, p);
      if (wo.lotId) ctx.open[String(wo.sku)].sort(function (a, b) { return (a._row || 1e9) - (b._row || 1e9); });
      fifoFlush_(ctx);
      addStockMoves_(s, [{ sku: String(wo.sku), qtyPieces: -qty, type: 'WRITEOFF', refNo: ref, note: reason + (wo.note ? ': ' + wo.note : '') }]);
      log_(s, 'WRITEOFF', ref, p.name + ' ' + qty + ' ' + (p.unit || 'ชิ้น') + ' · ' + reason + ' · ทุน ' + cost + ' บาท', approver);
      if (reason === 'หมดอายุ') markExpiredLotsWrittenOff_(s, ref);
      return { refNo: ref, cost: cost };
    });
  });
}

/** KPIs + recent moves + lots expiring soon for the stock screen. */
function api_stockOverview(token, expiryDays) {
  return respond_(function () {
    session_(token);
    var month = fmtDate_(now_(), 'yyyy-MM');
    var out = outflowMonth_(month);
    var products = {};
    readAll_('Products').forEach(function (p) { products[String(p.sku)] = p; });
    var users = {};
    readAll_('Users').forEach(function (u) { users[u.userId] = u.name; });
    var moves = readAll_('StockMoves').slice(-150).reverse().map(function (m) {
      var p = products[String(m.sku)] || {};
      return { createdAt: m.createdAt, sku: String(m.sku), name: p.name || m.sku, unit: p.unit || '', qtyPieces: num_(m.qtyPieces),
               type: m.type, refNo: m.refNo, note: m.note, user: users[m.userId] || '' };
    });
    var values = lotValues_();
    return {
      stockValue: round2_(Object.keys(values).reduce(function (a, k) { return a + values[k]; }, 0)),
      values: values, lossMonth: out.loss, expiryMonth: out.expiry, useMonth: out.use, moves: moves,
      expiryTodo: expiryTodoCount_(), expiring: expiringLots_(num_(expiryDays) || 7, products)
    };
  });
}

/** Open lots with an expiry date within `days` from today (past ones included), soonest first. */
function expiringLots_(days, products) {
  var today = fmtDate_(now_(), 'yyyy-MM-dd');
  var limit = fmtDate_(new Date(now_().getTime() + days * 86400000), 'yyyy-MM-dd');
  return readAll_('Lots').filter(function (l) { return num_(l.qtyLeft) > 0 && l.expiryDate; }).map(function (l) {
    var exp = l.expiryDate instanceof Date ? fmtDate_(l.expiryDate, 'yyyy-MM-dd') : String(l.expiryDate);
    var p = products[String(l.sku)] || {};
    var daysLeft = Math.round((new Date(exp + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
    return { lotId: l.lotId, sku: String(l.sku), name: p.name || l.sku, unit: p.unit || '', receiptNo: l.receiptNo,
             qtyLeft: num_(l.qtyLeft), unitCost: num_(l.unitCost), expiryDate: exp, daysLeft: daysLeft };
  }).filter(function (l) { return l.expiryDate <= limit; }).sort(function (a, b) { return a.expiryDate < b.expiryDate ? -1 : 1; });
}
