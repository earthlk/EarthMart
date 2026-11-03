/**
 * Shifts: one open shift per front-counter device.
 * Expected cash = opening cash + cash sales + cash in − cash out.
 */

function openShiftForDevice_(deviceId) {
  if (!deviceId) return null;
  var open = readAll_('Shifts').filter(function (x) { return x.deviceId === deviceId && x.status === 'OPEN'; });
  if (!open.length) return null;
  var sh = open[open.length - 1];
  return { shiftId: sh.shiftId, openedAt: sh.openedAt, openingCash: num_(sh.openingCash), userId: sh.userId };
}

function api_openShift(token, openingCash, note) {
  return respond_(function () {
    var s = session_(token);
    requireCounter_(s);
    var cash = round2_(num_(openingCash));
    if (cash < 0) throw new Error('เงินทอนตั้งต้นติดลบไม่ได้');
    return withLock_(function () {
      if (openShiftForDevice_(s.deviceId)) throw new Error('เครื่องนี้มีกะที่เปิดอยู่แล้ว');
      var shift = {
        shiftId: 'SH' + fmtDate_(now_(), 'yyMMddHHmm') + '-' + uid_('').slice(0, 4),
        deviceId: s.deviceId, userId: s.userId, openedAt: now_(), openingCash: cash,
        note: note || '', status: 'OPEN'
      };
      append_('Shifts', shift);
      log_(s, 'SHIFT_OPEN', shift.shiftId, 'เงินทอนตั้งต้น ' + cash, '');
      return openShiftForDevice_(s.deviceId);
    });
  });
}

/** type: 'IN' | 'OUT'. Cash put into or taken out of the drawer during the shift. */
function api_cashMove(token, type, amount, reason) {
  return respond_(function () {
    var s = session_(token);
    requireCounter_(s);
    if (type !== 'IN' && type !== 'OUT') throw new Error('ประเภทไม่ถูกต้อง');
    var amt = round2_(num_(amount));
    if (amt <= 0) throw new Error('จำนวนเงินต้องมากกว่า 0');
    if (!String(reason || '').trim()) throw new Error('ต้องใส่เหตุผล');
    return withLock_(function () {
      var shift = openShiftForDevice_(s.deviceId);
      if (!shift) throw new Error('ยังไม่ได้เปิดกะ');
      append_('CashMoves', { moveId: uid_('C'), shiftId: shift.shiftId, createdAt: now_(), type: type,
                             amount: amt, reason: reason, userId: s.userId });
      log_(s, type === 'IN' ? 'CASH_IN' : 'CASH_OUT', shift.shiftId, amt + ' บาท · ' + reason, '');
      return shiftSummary_(shift.shiftId);
    });
  });
}

function shiftSummary_(shiftId) {
  var shift = readAll_('Shifts').filter(function (x) { return x.shiftId === shiftId; })[0];
  if (!shift) throw new Error('ไม่พบกะ');
  var sum = { cash: 0, qr: 0, transfer: 0 };
  var billCount = 0, voidCount = 0, discount = 0;
  readAll_('Sales').forEach(function (b) {
    if (b.shiftId !== shiftId) return;
    if (b.status === 'VOID') { voidCount++; return; }
    billCount++;
    sum[b.payMethod] = (sum[b.payMethod] || 0) + num_(b.total);
    discount += num_(b.discount);
  });
  var cashIn = 0, cashOut = 0;
  var moves = readAll_('CashMoves').filter(function (m) { return m.shiftId === shiftId; });
  moves.forEach(function (m) { if (m.type === 'IN') cashIn += num_(m.amount); else cashOut += num_(m.amount); });
  var opening = num_(shift.openingCash);
  return {
    shiftId: shiftId, openedAt: shift.openedAt, status: shift.status, openingCash: opening,
    cashSales: round2_(sum.cash), qrSales: round2_(sum.qr), transferSales: round2_(sum.transfer),
    totalSales: round2_(sum.cash + sum.qr + sum.transfer), discount: round2_(discount),
    cashIn: round2_(cashIn), cashOut: round2_(cashOut),
    expectedCash: round2_(opening + sum.cash + cashIn - cashOut),
    billCount: billCount, voidCount: voidCount,
    cashMoves: moves.map(function (m) { return { type: m.type, amount: num_(m.amount), reason: m.reason, createdAt: m.createdAt }; })
  };
}

function api_shiftSummary(token) {
  return respond_(function () {
    var s = session_(token);
    var shift = openShiftForDevice_(s.deviceId);
    if (!shift) throw new Error('ยังไม่ได้เปิดกะ');
    return shiftSummary_(shift.shiftId);
  });
}

/** countedCash = cash actually in the drawer. Returns the summary with the difference. */
function api_closeShift(token, countedCash, note) {
  return respond_(function () {
    var s = session_(token);
    requireCounter_(s);
    var counted = round2_(num_(countedCash));
    if (counted < 0) throw new Error('ยอดนับติดลบไม่ได้');
    var result = withLock_(function () {
      var open = openShiftForDevice_(s.deviceId);
      if (!open) throw new Error('ไม่มีกะที่เปิดอยู่');
      var sum = shiftSummary_(open.shiftId);
      var shift = readAll_('Shifts').filter(function (x) { return x.shiftId === open.shiftId; })[0];
      shift.closedAt = now_();
      shift.closedBy = s.userId;
      shift.cashSales = sum.cashSales;
      shift.qrSales = sum.qrSales;
      shift.transferSales = sum.transferSales;
      shift.cashIn = sum.cashIn;
      shift.cashOut = sum.cashOut;
      shift.expectedCash = sum.expectedCash;
      shift.countedCash = counted;
      shift.diff = round2_(counted - sum.expectedCash);
      shift.billCount = sum.billCount;
      shift.voidCount = sum.voidCount;
      shift.note = note || '';
      shift.status = 'CLOSED';
      writeRow_('Shifts', shift);
      log_(s, 'SHIFT_CLOSE', shift.shiftId, 'นับได้ ' + counted + ' · ต่าง ' + shift.diff, '');
      sum.status = 'CLOSED';
      sum.countedCash = counted;
      sum.diff = shift.diff;
      sum.closedAt = shift.closedAt;
      sum.closedBy = s.name;
      return sum;
    });
    result.lineSent = sendShiftToLine_(result);
    return result;
  });
}

/** Optional: push a text summary to LINE when a channel token and target are set. */
function sendShiftToLine_(sum) {
  var tokenLine = getSetting_('lineChannelToken');
  var target = getSetting_('lineTargetId');
  if (!tokenLine || !target) return false;
  var shop = getSetting_('shopName') || APP_NAME;
  var money = function (n) { return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var text = [
    shop + ' · ปิดกะ',
    fmtDate_(new Date(sum.openedAt), 'dd/MM HH:mm') + ' – ' + fmtDate_(new Date(sum.closedAt), 'HH:mm') + ' · ' + sum.closedBy,
    'ยอดขาย ' + money(sum.totalSales) + ' (' + sum.billCount + ' บิล)',
    'เงินสด ' + money(sum.cashSales) + ' · QR ' + money(sum.qrSales) + ' · โอน ' + money(sum.transferSales),
    'ต้องมีในลิ้นชัก ' + money(sum.expectedCash) + ' · นับได้ ' + money(sum.countedCash),
    (sum.diff === 0 ? 'เงินพอดี' : (sum.diff < 0 ? 'เงินขาด ' : 'เงินเกิน ') + money(Math.abs(sum.diff))),
    'ยกเลิก ' + sum.voidCount + ' บิล · ส่วนลด ' + money(sum.discount)
  ].join('\n');
  try {
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + tokenLine },
      payload: JSON.stringify({ to: target, messages: [{ type: 'text', text: text }] })
    });
    return res.getResponseCode() === 200;
  } catch (e) {
    return false;
  }
}
