/**
 * Sales: commit a bill, bill numbering, list bills, void.
 *
 * The server re-prices every line from the Products / Barcodes sheets. The client's price is only
 * accepted for products marked openPrice. Discounts need an owner approval.
 */

var PAY_METHODS = ['cash', 'qr', 'transfer', 'split'];
var PAY_PARTS = ['cash', 'qr', 'transfer'];

/** Amount paid by each method for one bill (older bills only have payMethod + total). */
function payParts_(h) {
  var out = { cash: 0, qr: 0, transfer: 0 };
  if (h.cashPaid !== '' && h.cashPaid !== undefined || h.qrPaid !== '' && h.qrPaid !== undefined || h.transferPaid !== '' && h.transferPaid !== undefined) {
    out.cash = num_(h.cashPaid); out.qr = num_(h.qrPaid); out.transfer = num_(h.transferPaid);
  } else if (out[h.payMethod] !== undefined) out[h.payMethod] = num_(h.total);
  return out;
}

/**
 * sale = {
 *   saleUid: string (client-generated, makes retries safe),
 *   lines: [{ sku, barcode, qty, unitPrice? (open price only), lineDiscount? }],
 *   billDiscount: number,
 *   payMethod: 'cash' | 'qr' | 'transfer' | 'split',
 *   payments: [{ method: 'cash'|'qr'|'transfer', amount }] (split only; must add up to the total),
 *   received: number (cash handed over; for split, covers the cash part),
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
      var lineDiscount = 0, manual = 0, markdowns = [];
      priced.forEach(function (l) {
        lineDiscount += l.lineDiscount;
        manual += l.lineDiscount - (l.md ? l.md.amount : 0);
        if (l.md) markdowns.push(l.md);
      });
      var billDiscount = round2_(Math.max(0, num_(sale.billDiscount)));
      var subtotal = round2_(priced.reduce(function (a, l) { return a + l.qty * l.unitPrice; }, 0));
      var discount = round2_(lineDiscount + billDiscount);
      if (discount > subtotal) throw new Error('ส่วนลดมากกว่ายอดขาย');
      var total = round2_(subtotal - discount);

      var approver = '';
      // Near-expiry markdowns are pre-approved on the expiry page; only manual discounts need the owner.
      manual = round2_(manual + billDiscount);
      if (manual > 0) approver = consumeApproval_(s, sale.approvalId, 'DISCOUNT');

      var parts = { cash: 0, qr: 0, transfer: 0 };
      if (sale.payMethod === 'split') {
        (sale.payments || []).forEach(function (p) {
          if (PAY_PARTS.indexOf(p.method) < 0) throw new Error('ช่องทางชำระไม่ถูกต้อง');
          var a = round2_(num_(p.amount));
          if (a < 0) throw new Error('ยอดชำระติดลบไม่ได้');
          parts[p.method] = round2_(parts[p.method] + a);
        });
        var used = PAY_PARTS.filter(function (m) { return parts[m] > 0; });
        if (used.length < 2) throw new Error('แบ่งจ่ายต้องมีอย่างน้อย 2 ช่องทาง');
        if (round2_(parts.cash + parts.qr + parts.transfer) !== total) throw new Error('ยอดแบ่งจ่ายรวมต้องเท่ากับ ' + total + ' บาท');
      } else parts[sale.payMethod] = total;
      var received = total, change = 0;
      if (parts.cash > 0) {
        received = round2_(num_(sale.received));
        if (received < parts.cash) throw new Error('รับเงินสดไม่พอ');
        change = round2_(received - parts.cash);
        if (sale.payMethod === 'split') received = round2_(received + parts.qr + parts.transfer);
      }

      var billNo = nextBillNo_();
      var stamp = now_();
      var header = {
        billNo: billNo, saleUid: sale.saleUid, createdAt: stamp, shiftId: shift.shiftId, deviceId: s.deviceId,
        userId: s.userId, itemsCount: priced.reduce(function (a, l) { return a + l.qty; }, 0),
        subtotal: subtotal, discount: discount, total: total, payMethod: sale.payMethod,
        received: received, change: change, status: 'PAID',
        cashPaid: parts.cash, qrPaid: parts.qr, transferPaid: parts.transfer, returnedTotal: 0
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
          lineTotal: round2_(l.qty * l.unitPrice - l.lineDiscount), cost: round2_(cost),
          markdownLotId: l.md ? l.md.lotId : '', markdownQty: l.md ? l.md.qty : '', markdown: l.md ? l.md.amount : ''
        };
      });

      append_('Sales', header);
      appendMany_('SaleLines', lines);
      fifoFlush_(ctx);
      addStockMoves_(s, explodeMoves_(lines, -1, 'SALE', billNo, ''));
      if (manual > 0) log_(s, 'DISCOUNT', billNo, 'ส่วนลด ' + manual + ' บาท', approver);
      if (markdowns.length) {
        moveMarkdown_(markdowns, -1);
        log_(s, 'MARKDOWN_SALE', billNo, markdowns.map(function (m) { return m.qty + ' ชิ้น −' + m.pct + '%'; }).join(', '), '');
      }
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
  var lots = null;

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
    var md = null;
    if (l.markdownLotId) {
      if (!lots) { lots = {}; readAll_('Lots').forEach(function (x) { lots[x.lotId] = x; }); }
      md = markdownFor_({ lotId: l.markdownLotId, qty: l.markdownQty }, { sku: sku, name: p.name, multiplier: mult, qty: qty, unitPrice: unitPrice }, lots);
      lineDiscount = round2_(lineDiscount + md.amount);
    }
    if (lineDiscount > qty * unitPrice) throw new Error('ส่วนลดของ ' + p.name + ' เกินราคา');
    return {
      sku: sku, name: p.name, barcode: code ? String(code.barcode) : '', unitName: code ? code.unitName : (p.unit || 'ชิ้น'),
      multiplier: mult, qty: qty, unitPrice: unitPrice, lineDiscount: lineDiscount,
      costPerPiece: p.type === 'recipe' ? recipeCost_(rec[sku], products) : num_(p.cost), openPrice: bool_(p.openPrice), md: md
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
    status: h.status, payments: payParts_(h), returnedTotal: num_(h.returnedTotal),
    lines: lines.map(function (l) {
      return { lineNo: num_(l.lineNo), sku: String(l.sku), name: l.name, unitName: l.unitName, multiplier: num_(l.multiplier) || 1,
               qty: num_(l.qty), unitPrice: num_(l.unitPrice), lineDiscount: num_(l.lineDiscount), lineTotal: num_(l.lineTotal),
               returnedQty: num_(l.returnedQty) };
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
               payMethod: b.payMethod, status: b.status, cashier: users[b.userId] || '', shiftId: b.shiftId,
               returnedTotal: num_(b.returnedTotal) };
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
    var users = {};
    readAll_('Users').forEach(function (u) { users[u.userId] = u.name; });
    r.returns = readAll_('Returns').filter(function (x) { return x.billNo === billNo; }).map(function (x) {
      return { returnNo: x.returnNo, createdAt: x.createdAt, total: num_(x.total), refundMethod: x.refundMethod,
               restock: bool_(x.restock), reason: x.reason, user: users[x.userId] || '' };
    });
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
      if (num_(h.returnedTotal) > 0) throw new Error('บิลนี้มีการคืนสินค้าแล้ว — คืนรายการที่เหลือแทนการยกเลิกทั้งบิล');
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
      moveMarkdown_(lines.filter(function (l) { return l.markdownLotId; }).map(function (l) { return { lotId: l.markdownLotId, qty: num_(l.markdownQty) }; }), 1);
      fifoFlush_(ctx);
      addStockMoves_(s, explodeMoves_(lines, 1, 'VOID', billNo, reason));
      log_(s, 'VOID', billNo, num_(h.total) + ' บาท · ' + reason, approver);
      return { billNo: billNo, status: 'VOID' };
    });
  });
}

/* ------------------------------------------------------------------ */
/* Partial returns (คืนสินค้าบางรายการ)                                */
/* ------------------------------------------------------------------ */

var REFUND_METHODS = ['cash', 'transfer'];

/**
 * ret = { returnUid, billNo, lines: [{ lineNo, qty }], refundMethod: 'cash'|'transfer', restock: bool, reason, approvalId }
 * Any bill (also from closed shifts). A cash refund comes out of this device's open shift drawer.
 * Refund per piece = line total less its share of the bill discount. Restocked goods go back as a new
 * FIFO lot at the cost they were sold at; recipe items are never restocked. Owner approval 'RETURN'.
 */
function api_returnSale(token, ret) {
  return respond_(function () {
    var s = session_(token);
    requireCounter_(s);
    if (!ret || !ret.returnUid || !ret.billNo) throw new Error('ข้อมูลไม่ครบ');
    if (REFUND_METHODS.indexOf(ret.refundMethod) < 0) throw new Error('เลือกวิธีคืนเงิน');
    if (!String(ret.reason || '').trim()) throw new Error('ต้องใส่เหตุผล');
    var want = (ret.lines || []).filter(function (l) { return num_(l.qty) > 0; });
    if (!want.length) throw new Error('เลือกรายการที่จะคืน');
    var dupRet = readAll_('Returns').filter(function (x) { return x.returnUid === ret.returnUid; })[0];
    if (dupRet) return { returnNo: dupRet.returnNo, total: num_(dupRet.total), duplicate: true };
    var approver = consumeApproval_(s, ret.approvalId, 'RETURN');
    return withLock_(function () {
      var h = readAll_('Sales').filter(function (b) { return b.billNo === ret.billNo; })[0];
      if (!h) throw new Error('ไม่พบบิล');
      if (h.status === 'VOID') throw new Error('บิลนี้ถูกยกเลิกแล้ว');
      var shift = openShiftForDevice_(s.deviceId);
      if (ret.refundMethod === 'cash' && !shift) throw new Error('คืนเป็นเงินสดต้องเปิดกะก่อน');
      var all = linesOf_(h.billNo);
      var sumLT = all.reduce(function (a, l) { return a + num_(l.lineTotal); }, 0);
      var billDisc = round2_(num_(h.discount) - all.reduce(function (a, l) { return a + num_(l.lineDiscount); }, 0));
      var rec = recipesMap_();
      var returnNo = nextDocNo_('RT');
      var ctx = fifoOpen_();
      var moves = [], rlines = [], total = 0, pieces = 0;
      want.forEach(function (w) {
        var l = all.filter(function (x) { return num_(x.lineNo) === num_(w.lineNo); })[0];
        if (!l) throw new Error('ไม่พบรายการที่ ' + w.lineNo);
        var q = num_(w.qty);
        var left = num_(l.qty) - num_(l.returnedQty);
        if (Math.round(q) !== q || q > left) throw new Error(l.name + ' คืนได้อีก ' + left + ' ' + (l.unitName || ''));
        var lt = num_(l.lineTotal);
        var net = sumLT ? lt - billDisc * lt / sumLT : 0;
        var refund = round2_(net * q / num_(l.qty));
        var mult = num_(l.multiplier) || 1;
        var cost = round2_(num_(l.cost) * q / num_(l.qty));
        var isRecipe = !!(rec[String(l.sku)] && rec[String(l.sku)].length);
        var restocked = !!ret.restock && !isRecipe;
        if (restocked) {
          var pcs = q * mult;
          fifoAddLot_(ctx, { sku: l.sku, qtyIn: pcs, unitCost: pcs ? cost / pcs : 0, receiptNo: returnNo, note: 'คืนจากบิล ' + h.billNo });
          moves.push({ sku: String(l.sku), qtyPieces: pcs, type: 'RETURN', refNo: returnNo, note: 'คืนจากบิล ' + h.billNo });
        }
        l.returnedQty = num_(l.returnedQty) + q;
        writeRow_('SaleLines', l);
        rlines.push({ returnNo: returnNo, billNo: h.billNo, lineNo: num_(l.lineNo), sku: String(l.sku), name: l.name, qty: q,
                      multiplier: mult, refund: refund, cost: cost, restocked: restocked });
        total += refund;
        pieces += q;
      });
      // Last items of the bill: refund exactly what is left so the bill nets to zero.
      var fully = all.every(function (l) { return num_(l.returnedQty) >= num_(l.qty); });
      total = round2_(total);
      if (fully) {
        var rest = round2_(num_(h.total) - num_(h.returnedTotal));
        rlines[rlines.length - 1].refund = round2_(rlines[rlines.length - 1].refund + rest - total);
        total = rest;
      }
      fifoFlush_(ctx);
      if (moves.length) addStockMoves_(s, moves);
      appendMany_('ReturnLines', rlines);
      append_('Returns', { returnNo: returnNo, returnUid: ret.returnUid, createdAt: now_(), billNo: h.billNo,
        shiftId: shift ? shift.shiftId : '', deviceId: s.deviceId, userId: s.userId, itemsCount: pieces, total: total,
        refundMethod: ret.refundMethod, restock: !!ret.restock, reason: String(ret.reason).trim(), approvedBy: approver });
      h.returnedTotal = round2_(num_(h.returnedTotal) + total);
      writeRow_('Sales', h);
      log_(s, 'RETURN', returnNo, 'บิล ' + h.billNo + ' · คืน ' + total + ' บาท (' + (ret.refundMethod === 'cash' ? 'เงินสด' : 'โอน') + ') · ' +
        rlines.map(function (r) { return r.name + ' ' + r.qty; }).join(', ') + ' · ' + ret.reason, approver);
      return { returnNo: returnNo, billNo: h.billNo, total: total, refundMethod: ret.refundMethod, lines: rlines, fullyReturned: fully };
    });
  });
}
