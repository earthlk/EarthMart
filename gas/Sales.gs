/**
 * Sales: commit a bill, bill numbering, list bills, void.
 *
 * The server re-prices every line from the Products / Barcodes sheets. The client's price is only
 * accepted for products marked openPrice. Discounts need an owner approval.
 */

var PAY_METHODS = ['cash', 'qr', 'transfer'];

/**
 * sale = {
 *   saleUid: string (client-generated, makes retries safe),
 *   lines: [{ sku, barcode, qty, unitPrice? (open price only), lineDiscount? }],
 *   billDiscount: number,
 *   payMethod: 'cash' | 'qr' | 'transfer',
 *   received: number (cash),
 *   approvalId: string (when any discount)
 * }
 */
function api_commitSale(token, sale) {
  return respond_(function () {
    var s = session_(token);
    requireCounter_(s);
    if (!sale || !sale.saleUid) throw new Error('ข้อมูลบิลไม่ครบ');
    if (!sale.lines || !sale.lines.length) throw new Error('ยังไม่มีสินค้าในบิล');
    if (PAY_METHODS.indexOf(sale.payMethod) < 0) throw new Error('ช่องทางชำระไม่ถูกต้อง');

    return withLock_(function () {
      // Retry of a sale that already went through → return the same bill.
      var dup = readAll_('Sales').filter(function (x) { return x.saleUid === sale.saleUid; })[0];
      if (dup) return receipt_(dup, linesOf_(dup.billNo));

      var shift = openShiftForDevice_(s.deviceId);
      if (!shift) throw new Error('ยังไม่ได้เปิดกะ');

      var priced = priceLines_(sale.lines);
      var lineDiscount = 0;
      priced.forEach(function (l) { lineDiscount += l.lineDiscount; });
      var billDiscount = round2_(Math.max(0, num_(sale.billDiscount)));
      var subtotal = round2_(priced.reduce(function (a, l) { return a + l.qty * l.unitPrice; }, 0));
      var discount = round2_(lineDiscount + billDiscount);
      if (discount > subtotal) throw new Error('ส่วนลดมากกว่ายอดขาย');
      var total = round2_(subtotal - discount);

      var approver = '';
      if (discount > 0) approver = consumeApproval_(s, sale.approvalId, 'DISCOUNT');

      var received = total, change = 0;
      if (sale.payMethod === 'cash') {
        received = round2_(num_(sale.received));
        if (received < total) throw new Error('รับเงินไม่พอ');
        change = round2_(received - total);
      }

      var billNo = nextBillNo_();
      var stamp = now_();
      var header = {
        billNo: billNo, saleUid: sale.saleUid, createdAt: stamp, shiftId: shift.shiftId, deviceId: s.deviceId,
        userId: s.userId, itemsCount: priced.reduce(function (a, l) { return a + l.qty; }, 0),
        subtotal: subtotal, discount: discount, total: total, payMethod: sale.payMethod,
        received: received, change: change, status: 'PAID'
      };
      // FIFO: each line costs what its pieces (or its recipe components) cost in the oldest lots.
      var ctx = fifoOpen_(), rec = recipesMap_(), prodBySku = {};
      readAll_('Products').forEach(function (p) { prodBySku[String(p.sku)] = p; });
      var lines = priced.map(function (l, i) {
        var pieces = l.qty * l.multiplier, cost = 0;
        var comps = rec[l.sku];
        if (comps && comps.length) {
          comps.forEach(function (c) { cost += fifoTake_(ctx, c.sku, pieces * c.qty, billNo, prodBySku[c.sku]); });
        } else {
          cost = fifoTake_(ctx, l.sku, pieces, billNo, prodBySku[l.sku]);
        }
        return {
          billNo: billNo, lineNo: i + 1, sku: l.sku, name: l.name, barcode: l.barcode, unitName: l.unitName,
          multiplier: l.multiplier, qty: l.qty, unitPrice: l.unitPrice, lineDiscount: l.lineDiscount,
          lineTotal: round2_(l.qty * l.unitPrice - l.lineDiscount), cost: round2_(cost)
        };
      });

      append_('Sales', header);
      appendMany_('SaleLines', lines);
      fifoFlush_(ctx);
      addStockMoves_(s, explodeMoves_(lines, -1, 'SALE', billNo, ''));
      if (discount > 0) log_(s, 'DISCOUNT', billNo, 'ส่วนลด ' + discount + ' บาท', approver);
      priced.filter(function (l) { return l.openPrice; }).forEach(function (l) {
        log_(s, 'OPEN_PRICE', billNo, l.name + ' ราคา ' + l.unitPrice, '');
      });
      return receipt_(header, lines);
    });
  });
}

/**
 * Stock moves for sold (sign -1) or voided (sign +1) lines. A recipe line moves its components instead.
 */
function explodeMoves_(lines, sign, type, refNo, note) {
  var rec = recipesMap_();
  var moves = [];
  lines.forEach(function (l) {
    var pieces = num_(l.qty) * (num_(l.multiplier) || 1);
    var comps = rec[String(l.sku)];
    if (comps && comps.length) {
      comps.forEach(function (c) {
        moves.push({ sku: c.sku, qtyPieces: round2_(sign * pieces * c.qty), type: type, refNo: refNo,
                     note: (note ? note + ' · ' : '') + 'สูตร ' + l.name });
      });
    } else {
      moves.push({ sku: String(l.sku), qtyPieces: sign * pieces, type: type, refNo: refNo, note: note });
    }
  });
  return moves;
}

/** Re-price client lines from the sheet. */
function priceLines_(inLines) {
  var products = {};
  readAll_('Products').forEach(function (p) { products[String(p.sku)] = p; });
  var rec = recipesMap_();
  var codes = {};
  readAll_('Barcodes').forEach(function (b) { codes[String(b.barcode)] = b; });

  return inLines.map(function (l) {
    var qty = num_(l.qty);
    if (qty <= 0 || Math.round(qty) !== qty) throw new Error('จำนวนต้องเป็นจำนวนเต็มมากกว่า 0');
    var code = l.barcode ? codes[String(l.barcode)] : null;
    var sku = code ? String(code.sku) : String(l.sku || '');
    var p = products[sku];
    if (!p || !bool_(p.active)) throw new Error('ไม่พบสินค้า ' + (l.barcode || l.sku));
    if (!forSale_(p)) throw new Error(p.name + ' เป็นวัตถุดิบ ไม่ได้ตั้งให้ขายหน้าร้าน');
    var mult = code ? (num_(code.multiplier) || 1) : 1;
    var unitPrice;
    if (bool_(p.openPrice)) {
      unitPrice = round2_(num_(l.unitPrice));
      if (unitPrice <= 0) throw new Error('ใส่ราคาสำหรับ ' + p.name);
    } else if (code && code.price !== '' && code.price !== null) {
      unitPrice = num_(code.price);
    } else {
      unitPrice = round2_(num_(p.price) * mult);
    }
    var lineDiscount = round2_(Math.max(0, num_(l.lineDiscount)));
    if (lineDiscount > qty * unitPrice) throw new Error('ส่วนลดของ ' + p.name + ' เกินราคา');
    return {
      sku: sku, name: p.name, barcode: code ? String(code.barcode) : '', unitName: code ? code.unitName : (p.unit || 'ชิ้น'),
      multiplier: mult, qty: qty, unitPrice: unitPrice, lineDiscount: lineDiscount,
      costPerPiece: p.type === 'recipe' ? recipeCost_(rec[sku], products) : num_(p.cost), openPrice: bool_(p.openPrice)
    };
  });
}

/** Bill numbers: [prefix]YYMM-000001, restarting each month. Caller holds the lock. */
function nextBillNo_() {
  var props = PropertiesService.getScriptProperties();
  var ym = fmtDate_(now_(), 'yyMM');
  var key = 'BILL_SEQ_' + ym;
  var seq = num_(props.getProperty(key)) + 1;
  props.setProperty(key, String(seq));
  var prefix = getSetting_('billPrefix') || '';
  return prefix + ym + '-' + ('000000' + seq).slice(-6);
}

function linesOf_(billNo) {
  return readAll_('SaleLines').filter(function (l) { return l.billNo === billNo; });
}

function receipt_(h, lines) {
  return {
    billNo: h.billNo, createdAt: h.createdAt, payMethod: h.payMethod, subtotal: num_(h.subtotal),
    discount: num_(h.discount), total: num_(h.total), received: num_(h.received), change: num_(h.change),
    status: h.status,
    lines: lines.map(function (l) {
      return { name: l.name, unitName: l.unitName, qty: num_(l.qty), unitPrice: num_(l.unitPrice),
               lineDiscount: num_(l.lineDiscount), lineTotal: num_(l.lineTotal) };
    })
  };
}

/* ------------------------------------------------------------------ */
/* Bills list / detail / void                                          */
/* ------------------------------------------------------------------ */

/** Bills of one day (yyyy-MM-dd, shop time zone). Newest first. */
function api_listBills(token, day) {
  return respond_(function () {
    session_(token);
    var d = day || fmtDate_(now_(), 'yyyy-MM-dd');
    var users = {};
    readAll_('Users').forEach(function (u) { users[u.userId] = u.name; });
    return readAll_('Sales').filter(function (b) {
      return b.createdAt instanceof Date && fmtDate_(b.createdAt, 'yyyy-MM-dd') === d;
    }).reverse().map(function (b) {
      return { billNo: b.billNo, createdAt: b.createdAt, itemsCount: num_(b.itemsCount), total: num_(b.total),
               payMethod: b.payMethod, status: b.status, cashier: users[b.userId] || '', shiftId: b.shiftId };
    });
  });
}

function api_billDetail(token, billNo) {
  return respond_(function () {
    session_(token);
    var h = readAll_('Sales').filter(function (b) { return b.billNo === billNo; })[0];
    if (!h) throw new Error('ไม่พบบิล');
    var r = receipt_(h, linesOf_(billNo));
    r.voidReason = h.voidReason;
    return r;
  });
}

/**
 * Void a whole bill. Only bills from a shift that is still open (cash still in the drawer).
 * Cashiers need an owner approval id for 'VOID'.
 */
function api_voidSale(token, billNo, reason, approvalId) {
  return respond_(function () {
    var s = session_(token);
    requireCounter_(s);
    if (!String(reason || '').trim()) throw new Error('ต้องใส่เหตุผล');
    var approver = consumeApproval_(s, approvalId, 'VOID');
    return withLock_(function () {
      var h = readAll_('Sales').filter(function (b) { return b.billNo === billNo; })[0];
      if (!h) throw new Error('ไม่พบบิล');
      if (h.status === 'VOID') throw new Error('บิลนี้ถูกยกเลิกแล้ว');
      var shift = readAll_('Shifts').filter(function (x) { return x.shiftId === h.shiftId; })[0];
      if (!shift || shift.status !== 'OPEN') throw new Error('ยกเลิกได้เฉพาะบิลในกะที่ยังเปิดอยู่');
      h.status = 'VOID';
      h.voidReason = reason;
      h.voidBy = s.userId;
      h.voidAt = now_();
      writeRow_('Sales', h);
      var lines = linesOf_(billNo);
      var ctx = fifoOpen_();
      fifoRestore_(ctx, billNo);
      fifoFlush_(ctx);
      addStockMoves_(s, explodeMoves_(lines, 1, 'VOID', billNo, reason));
      log_(s, 'VOID', billNo, num_(h.total) + ' บาท · ' + reason, approver);
      return { billNo: billNo, status: 'VOID' };
    });
  });
}
