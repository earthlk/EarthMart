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
