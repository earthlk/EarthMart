/**
 * FIFO cost (เข้าก่อนออกก่อน).
 *
 * Every receipt of goods creates a lot (Lots) with its own cost per piece. Selling, adjusting down or
 * using a product as a recipe component takes pieces from the oldest lot first; each take is written to
 * LotUse so a void can put the same pieces back into the same lots.
 *
 * Products.cost is kept as the cost of the next piece to be sold (oldest open lot), or the last known
 * cost when nothing is left. It is a display / estimate value only — sales store their real FIFO cost.
 *
 * Selling more than the lots hold (negative stock) costs the missing pieces at the last known cost and
 * records them with lotId ''. The next receipt is shortened by that deficit so lots and onHand agree again.
 *
 * Every function here expects the caller to hold the script lock.
 */

/** In-memory view of the Lots sheet for one request. */
function fifoOpen_() {
  var rows = readAll_('Lots');
  var open = {}, last = {};
  rows.forEach(function (l) {
    var sku = String(l.sku);
    last[sku] = num_(l.unitCost);
    if (num_(l.qtyLeft) > 0) (open[sku] = open[sku] || []).push(l);
  });
  return { rows: rows, open: open, last: last, touched: [], uses: [], skus: {} };
}

/** Last known cost per piece: newest lot, else the product's stored cost. */
function fifoLastCost_(ctx, sku, product) {
  if (ctx.last[sku] !== undefined) return ctx.last[sku];
  return product ? num_(product.cost) : 0;
}

/**
 * Take `pieces` of `sku`, oldest lot first. Returns the total cost of what was taken.
 * refNo ties the take to a bill / adjustment so it can be reversed.
 */
function fifoTake_(ctx, sku, pieces, refNo, product) {
  sku = String(sku);
  var need = round2_(pieces), cost = 0;
  var lots = ctx.open[sku] || [];
  while (need > 0 && lots.length) {
    var lot = lots[0];
    var take = Math.min(need, num_(lot.qtyLeft));
    lot.qtyLeft = round2_(num_(lot.qtyLeft) - take);
    cost += take * num_(lot.unitCost);
    need = round2_(need - take);
    ctx.uses.push({ refNo: refNo, lotId: lot.lotId, sku: sku, qty: take, unitCost: num_(lot.unitCost) });
    if (ctx.touched.indexOf(lot) < 0) ctx.touched.push(lot);
    if (lot.qtyLeft <= 0) lots.shift();
  }
  if (need > 0) {   // nothing left in lots: selling into negative stock
    var c = fifoLastCost_(ctx, sku, product);
    cost += need * c;
    ctx.uses.push({ refNo: refNo, lotId: '', sku: sku, qty: need, unitCost: c });
  }
  ctx.skus[sku] = true;
  return round2_(cost);
}

/** Add a new lot. Returns it. */
function fifoAddLot_(ctx, lot) {
  var row = {
    lotId: uid_('L'), sku: String(lot.sku), receivedAt: now_(), receiptNo: lot.receiptNo || '',
    qtyIn: round2_(lot.qtyIn), qtyLeft: round2_(lot.qtyLeft === undefined ? lot.qtyIn : lot.qtyLeft),
    unitCost: round2_(lot.unitCost * 10000) / 10000, expiryDate: lot.expiryDate || '', note: lot.note || ''
  };
  ctx.newLots = ctx.newLots || [];
  ctx.newLots.push(row);
  if (row.qtyLeft > 0) (ctx.open[row.sku] = ctx.open[row.sku] || []).push(row);
  ctx.last[row.sku] = row.unitCost;
  ctx.skus[row.sku] = true;
  return row;
}

/** Pieces still sitting in lots for a sku. */
function fifoLeft_(ctx, sku) {
  return (ctx.open[String(sku)] || []).reduce(function (a, l) { return a + num_(l.qtyLeft); }, 0);
}

/** Put back everything that refNo took (void). */
function fifoRestore_(ctx, refNo) {
  var uses = readAll_('LotUse').filter(function (u) { return u.refNo === refNo; });
  var byId = {};
  ctx.rows.forEach(function (l) { byId[l.lotId] = l; });
  uses.forEach(function (u) {
    var q = num_(u.qty);
    if (u.lotId && byId[u.lotId]) {
      var lot = byId[u.lotId];
      var wasEmpty = num_(lot.qtyLeft) <= 0;
      lot.qtyLeft = round2_(num_(lot.qtyLeft) + q);
      if (ctx.touched.indexOf(lot) < 0) ctx.touched.push(lot);
      if (wasEmpty) {   // back in the open list, kept in received order
        var list = ctx.open[String(lot.sku)] = ctx.open[String(lot.sku)] || [];
        list.push(lot);
        list.sort(function (a, b) { return a._row - b._row; });
      }
    }
    ctx.uses.push({ refNo: refNo, lotId: u.lotId, sku: String(u.sku), qty: -q, unitCost: num_(u.unitCost), note: 'คืนจากการยกเลิก' });
    ctx.skus[String(u.sku)] = true;
  });
}

/** Write lot changes, LotUse rows and refresh Products.cost for the skus involved. */
function fifoFlush_(ctx) {
  var col = SCHEMA.Lots.indexOf('qtyLeft') + 1;
  var sh = sheet_('Lots');
  ctx.touched.forEach(function (l) { if (l._row) sh.getRange(l._row, col).setValue(l.qtyLeft); });
  if (ctx.newLots && ctx.newLots.length) appendMany_('Lots', ctx.newLots);
  if (ctx.uses.length) {
    var stamp = now_();
    appendMany_('LotUse', ctx.uses.map(function (u) {
      return { createdAt: stamp, refNo: u.refNo, lotId: u.lotId, sku: u.sku, qty: u.qty, unitCost: u.unitCost, note: u.note || '' };
    }));
  }
  var skus = Object.keys(ctx.skus);
  if (!skus.length) return;
  var costCol = SCHEMA.Products.indexOf('cost') + 1;
  var psh = sheet_('Products');
  readAll_('Products').forEach(function (p) {
    var sku = String(p.sku);
    if (!ctx.skus[sku] || p.type === 'recipe') return;
    var head = (ctx.open[sku] || [])[0];
    var c = head ? num_(head.unitCost) : fifoLastCost_(ctx, sku, p);
    if (num_(p.cost) !== c) psh.getRange(p._row, costCol).setValue(c);
  });
}

/* ------------------------------------------------------------------ */
/* Receive goods                                                       */
/* ------------------------------------------------------------------ */

/**
 * rc: { receiptUid, supplier, invoiceNo, note,
 *       lines: [{ sku, barcode?, qty (units received), unitCost (per received unit), expiryDate? }] }
 * A barcode picks the unit (piece / pack / case) and its multiplier.
 */
function api_receive(token, rc) {
  return respond_(function () {
    var s = session_(token);
    if (!rc || !rc.receiptUid) throw new Error('ข้อมูลไม่ครบ');
    if (!rc.lines || !rc.lines.length) throw new Error('ยังไม่มีสินค้า');
    return withLock_(function () {
      var dup = readAll_('Receipts').filter(function (r) { return r.receiptUid === rc.receiptUid; })[0];
      if (dup) return { receiptNo: dup.receiptNo, total: num_(dup.total), duplicate: true };

      var products = {}, codes = {};
      readAll_('Products').forEach(function (p) { products[String(p.sku)] = p; });
      readAll_('Barcodes').forEach(function (b) { codes[String(b.barcode)] = b; });

      var lines = rc.lines.map(function (l) {
        var code = l.barcode ? codes[String(l.barcode)] : null;
        var sku = code ? String(code.sku) : String(l.sku || '');
        var p = products[sku];
        if (!p) throw new Error('ไม่พบสินค้า ' + (l.barcode || l.sku));
        if (p.type === 'recipe') throw new Error(p.name + ' เป็นสูตรผสม — รับเข้าที่ส่วนประกอบแทน');
        var qty = num_(l.qty);
        if (!(qty > 0) || Math.round(qty) !== qty) throw new Error('จำนวนของ ' + p.name + ' ต้องเป็นจำนวนเต็มมากกว่า 0');
        var cost = num_(l.unitCost);
        if (cost < 0) throw new Error('ทุนของ ' + p.name + ' ติดลบไม่ได้');
        var mult = code ? (num_(code.multiplier) || 1) : 1;
        var exp = String(l.expiryDate || '').trim();
        if (exp && !/^\d{4}-\d{2}-\d{2}$/.test(exp)) throw new Error('วันหมดอายุของ ' + p.name + ' ไม่ถูกต้อง');
        return { p: p, sku: sku, qty: qty, mult: mult, pieces: qty * mult, unitCost: cost, pieceCost: cost / mult,
                 unitName: code ? code.unitName : (p.unit || 'ชิ้น'), expiryDate: exp };
      });

      var receiptNo = nextDocNo_('RC');
      var total = round2_(lines.reduce(function (a, l) { return a + l.qty * l.unitCost; }, 0));
      var ctx = fifoOpen_();
      var changed = [];
      lines.forEach(function (l) {
        var before = fifoLastCost_(ctx, l.sku, l.p);
        // Pieces already sold into negative stock were costed at the last cost; don't count them twice.
        var onHand = num_(l.p.onHand), deficit = Math.max(0, -onHand - 0);
        var left = Math.max(0, l.pieces - deficit);
        l.p.onHand = onHand + l.pieces;
        fifoAddLot_(ctx, { sku: l.sku, receiptNo: receiptNo, qtyIn: l.pieces, qtyLeft: left, unitCost: l.pieceCost,
                           expiryDate: l.expiryDate, note: l.qty + ' ' + l.unitName });
        if (Math.abs(before - l.pieceCost) >= 0.005 && ctx.last[l.sku] !== undefined) changed.push({ name: l.p.name, from: before, to: round2_(l.pieceCost) });
      });
      append_('Receipts', {
        receiptNo: receiptNo, receiptUid: rc.receiptUid, createdAt: now_(), supplier: String(rc.supplier || '').trim(),
        invoiceNo: String(rc.invoiceNo || '').trim(), userId: s.userId, itemsCount: lines.length,
        pieces: lines.reduce(function (a, l) { return a + l.pieces; }, 0), total: total, note: String(rc.note || '')
      });
      fifoFlush_(ctx);
      addStockMoves_(s, lines.map(function (l) {
        return { sku: l.sku, qtyPieces: l.pieces, type: 'RECEIVE', refNo: receiptNo, note: l.qty + ' ' + l.unitName + ' × ' + l.unitCost };
      }));
      log_(s, 'RECEIVE', receiptNo, (rc.supplier ? rc.supplier + ' · ' : '') + lines.length + ' รายการ · ' + total + ' บาท', '');
      return { receiptNo: receiptNo, total: total, costChanges: changed };
    });
  });
}

/** Document numbers like RC2611-0001, restarting each month. Caller holds the lock. */
function nextDocNo_(prefix) {
  var props = PropertiesService.getScriptProperties();
  var ym = fmtDate_(now_(), 'yyMM');
  var key = prefix + '_SEQ_' + ym;
  var seq = num_(props.getProperty(key)) + 1;
  props.setProperty(key, String(seq));
  return prefix + ym + '-' + ('0000' + seq).slice(-4);
}

/** Open lots of one product (oldest first) for the product screen. */
function api_lots(token, sku) {
  return respond_(function () {
    session_(token);
    return readAll_('Lots').filter(function (l) { return String(l.sku) === String(sku) && num_(l.qtyLeft) > 0; })
      .map(function (l) {
        return { lotId: l.lotId, receivedAt: l.receivedAt, receiptNo: l.receiptNo, qtyIn: num_(l.qtyIn), qtyLeft: num_(l.qtyLeft),
                 unitCost: num_(l.unitCost), expiryDate: l.expiryDate instanceof Date ? fmtDate_(l.expiryDate, 'yyyy-MM-dd') : String(l.expiryDate || ''),
                 note: l.note };
      });
  });
}

/** Recent receipts (newest first). */
function api_receipts(token, limit) {
  return respond_(function () {
    session_(token);
    var users = {};
    readAll_('Users').forEach(function (u) { users[u.userId] = u.name; });
    return readAll_('Receipts').slice(-(num_(limit) || 30)).reverse().map(function (r) {
      return { receiptNo: r.receiptNo, createdAt: r.createdAt, supplier: r.supplier, invoiceNo: r.invoiceNo,
               itemsCount: num_(r.itemsCount), pieces: num_(r.pieces), total: num_(r.total), user: users[r.userId] || '' };
    });
  });
}

/**
 * One-time move to FIFO: products that already have stock but no lots get an opening lot
 * at their current cost.
 */
function migrateLots_() {
  var have = {};
  readAll_('Lots').forEach(function (l) { have[String(l.sku)] = true; });
  var stamp = now_();
  var rows = readAll_('Products').filter(function (p) {
    return p.type !== 'recipe' && num_(p.onHand) > 0 && !have[String(p.sku)];
  }).map(function (p) {
    return { lotId: uid_('L'), sku: String(p.sku), receivedAt: stamp, receiptNo: 'OPENING', qtyIn: num_(p.onHand),
             qtyLeft: num_(p.onHand), unitCost: num_(p.cost), expiryDate: '', note: 'ยกยอดสต็อกเดิม' };
  });
  if (rows.length) appendMany_('Lots', rows);
}
