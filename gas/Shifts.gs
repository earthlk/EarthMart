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

/**
 * opt (sent from the offline outbox) = { openUid, openedAt, offlineBy }: the shift was opened on the counter
 * while the internet was down. openUid makes resending safe.
 */
function api_openShift(token, openingCash, note, opt) {
  return respond_(function () {
    var s = session_(token);
    requireCounter_(s);
    opt = opt || {};
    var cash = round2_(num_(openingCash));
    if (cash < 0) throw new Error('เงินทอนตั้งต้นติดลบไม่ได้');
    return withLock_(function () {
      if (opt.openUid) {
        var dup = readAll_('Shifts').filter(function (x) { return x.openUid === opt.openUid; })[0];
        if (dup) return shiftView_(dup);
      }
      var open = openShiftForDevice_(s.deviceId);
      if (open) {
        if (opt.openUid) return open;   // a shift is already running here: offline work joins it
        throw new Error('เครื่องนี้มีกะที่เปิดอยู่แล้ว');
      }
      var actor = opt.offlineBy ? offlineActor_(s, opt.offlineBy, opt.openUid) || s : s;
      var at = offlineTime_(opt.openedAt) || now_();
      var prev = prevFloat_(s.deviceId);
      var d = round2_(cash - prev);
      var src = d === 0 ? 'carry' : String(opt.source || (d > 0 ? 'owner' : 'short'));
      if (d > 0 && ['owner', 'reserve', 'bank'].indexOf(src) < 0 && !walletIdOk_(src)) src = 'owner';
      if (d < 0 && ['draw', 'short'].indexOf(src) < 0) src = 'short';
      var shift = {
        shiftId: 'SH' + fmtDate_(at, 'yyMMddHHmm') + '-' + uid_('').slice(0, 4),
        deviceId: s.deviceId, userId: actor.userId, openedAt: at, openingCash: cash,
        note: note || '', status: 'OPEN', openUid: opt.openUid || '', offline: opt.openedAt ? true : '',
        prevFloat: prev, openSource: src
      };
      append_('Shifts', shift);
      // Extra float taken from a wallet: money leaves that wallet.
      if (d > 0 && walletIdOk_(src)) addLedger_(actor, { walletId: src, amount: -d, kind: 'FLOAT', ref: shift.shiftId, note: 'เงินทอนเข้าลิ้นชัก' });
      log_(actor, 'SHIFT_OPEN', shift.shiftId, 'เงินทอนตั้งต้น ' + cash + (opt.openedAt ? ' (เปิดตอนออฟไลน์)' : ''), '');
      return openShiftForDevice_(s.deviceId);
    });
  });
}

/** A time sent from the outbox: kept when within the last 7 days and not in the future. */
function offlineTime_(iso) {
  if (!iso) return null;
  var t = new Date(iso), nowT = now_().getTime();
  return !isNaN(t.getTime()) && t.getTime() <= nowT + 5 * 60000 && t.getTime() >= nowT - 7 * 86400000 ? t : null;
}

/** Cash left in this device's drawer when its last shift closed (0 for the first shift). */
function prevFloat_(deviceId) {
  var last = readAll_('Shifts').filter(function (x) { return x.deviceId === deviceId && x.status === 'CLOSED'; }).pop();
  if (!last) return 0;
  return last.floatLeft === '' || last.floatLeft === undefined ? num_(last.countedCash) : num_(last.floatLeft);
}

function walletIdOk_(id) { return !!id && readAll_('Wallets').some(function (w) { return w.walletId === id; }); }

function shiftView_(sh) {
  return { shiftId: sh.shiftId, openedAt: sh.openedAt, openingCash: num_(sh.openingCash), userId: sh.userId, status: sh.status };
}

/**
 * type: 'IN' | 'OUT'. Cash put into or taken out of the drawer during the shift.
 * opt (offline outbox) = { moveId, at, shiftId, offlineBy }.
 */
function api_cashMove(token, type, amount, reason, opt) {
  // opt.kind: expense | draw | purchase | invest | change | other ; opt.category for expenses
  return respond_(function () {
    var s = session_(token);
    requireCounter_(s);
    opt = opt || {};
    if (type !== 'IN' && type !== 'OUT') throw new Error('ประเภทไม่ถูกต้อง');
    var amt = round2_(num_(amount));
    if (amt <= 0) throw new Error('จำนวนเงินต้องมากกว่า 0');
    if (!String(reason || '').trim()) throw new Error('ต้องใส่เหตุผล');
    return withLock_(function () {
      if (opt.moveId && readAll_('CashMoves').some(function (x) { return x.moveId === opt.moveId; })) {
        var prev = readAll_('CashMoves').filter(function (x) { return x.moveId === opt.moveId; })[0];
        return shiftSummary_(prev.shiftId);
      }
      var shift = null;
      if (opt.shiftId) shift = readAll_('Shifts').filter(function (x) { return x.shiftId === opt.shiftId && x.deviceId === s.deviceId; })[0] || null;
      shift = shift || openShiftForDevice_(s.deviceId);
      if (!shift) throw new Error('ยังไม่ได้เปิดกะ');
      var actor = opt.offlineBy ? offlineActor_(s, opt.offlineBy, opt.moveId) || s : s;
      var at = offlineTime_(opt.at);
      append_('CashMoves', { moveId: opt.moveId || uid_('C'), shiftId: shift.shiftId, createdAt: at || now_(), type: type,
                             amount: amt, reason: reason, userId: actor.userId, offline: at ? true : '',
                             kind: ['expense', 'draw', 'purchase', 'invest', 'change', 'other'].indexOf(opt.kind) >= 0 ? opt.kind : (type === 'OUT' ? 'expense' : 'change'),
                             category: String(opt.category || (type === 'OUT' && !opt.kind ? 'อื่น ๆ' : '')) });
      log_(actor, type === 'IN' ? 'CASH_IN' : 'CASH_OUT', shift.shiftId, amt + ' บาท · ' + reason + (at ? ' (ตอนออฟไลน์)' : ''), '');
      return shiftSummary_(shift.shiftId);
    });
  });
}

function shiftSummary_(shiftId) {
  var shift = readAll_('Shifts').filter(function (x) { return x.shiftId === shiftId; })[0];
  if (!shift) throw new Error('ไม่พบกะ');
  var sum = { cash: 0, qr: 0, transfer: 0 };
  var billCount = 0, voidCount = 0, discount = 0, promo = 0;
  readAll_('Sales').forEach(function (b) {
    if (b.shiftId !== shiftId) return;
    if (b.status === 'VOID') { voidCount++; return; }
    billCount++;
    var pp = payParts_(b);
    sum.cash += pp.cash; sum.qr += pp.qr; sum.transfer += pp.transfer;
    discount += num_(b.discount);
    promo += num_(b.promoDiscount);
  });
  var cashRefunds = 0, otherRefunds = 0, returnCount = 0;
  readAll_('Returns').forEach(function (r) {
    if (r.shiftId !== shiftId) return;
    returnCount++;
    if (r.refundMethod === 'cash') cashRefunds += num_(r.total); else otherRefunds += num_(r.total);
  });
  var credit = 0;
  readAll_('Sales').forEach(function (b) { if (b.shiftId === shiftId && b.status !== 'VOID') credit += num_(b.creditPaid); });
  var custCash = 0, custOther = 0;
  readAll_('CustPays').forEach(function (p) { if (p.shiftId === shiftId && !p.walletId) { if (p.method === 'cash') custCash += num_(p.amount); else custOther += num_(p.amount); } });
  var cashIn = 0, cashOut = 0;
  var moves = readAll_('CashMoves').filter(function (m) { return m.shiftId === shiftId; });
  moves.forEach(function (m) { if (m.type === 'IN') cashIn += num_(m.amount); else cashOut += num_(m.amount); });
  var opening = num_(shift.openingCash);
  return {
    shiftId: shiftId, openedAt: shift.openedAt, status: shift.status, openingCash: opening,
    cashSales: round2_(sum.cash), qrSales: round2_(sum.qr), transferSales: round2_(sum.transfer),
    totalSales: round2_(sum.cash + sum.qr + sum.transfer + credit), creditSales: round2_(credit), custPayCash: round2_(custCash), custPayOther: round2_(custOther),
    prevFloat: shift.prevFloat === '' ? null : num_(shift.prevFloat), discount: round2_(discount), promoDiscount: round2_(promo),
    openedByName: (readAll_('Users').filter(function (u) { return u.userId === shift.userId; })[0] || {}).name || '',
    cashIn: round2_(cashIn), cashOut: round2_(cashOut),
    cashRefunds: round2_(cashRefunds), otherRefunds: round2_(otherRefunds), returnCount: returnCount,
    expectedCash: round2_(opening + sum.cash + custCash + cashIn - cashOut - cashRefunds),
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
function api_closeShift(token, countedCash, note, opt) {
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
      shift.cashRefunds = sum.cashRefunds;
      shift.otherRefunds = sum.otherRefunds;
      shift.expectedCash = sum.expectedCash;
      shift.countedCash = counted;
      shift.diff = round2_(counted - sum.expectedCash);
      shift.billCount = sum.billCount;
      shift.voidCount = sum.voidCount;
      shift.note = note || '';
      shift.status = 'CLOSED';
      shift.creditSales = sum.creditSales;
      shift.custPayCash = sum.custPayCash;
      // Keep a float for the next shift; the rest goes to the bank (waiting to be deposited) or the cash reserve.
      opt = opt || {};
      var keep = opt.floatLeft === undefined || opt.floatLeft === null || opt.floatLeft === '' ? counted : round2_(num_(opt.floatLeft));
      if (keep < 0 || keep > counted) throw new Error('เงินทอนที่ทิ้งไว้ต้องอยู่ระหว่าง 0 ถึง ' + counted);
      var dep = round2_(counted - keep);
      shift.floatLeft = keep; shift.depositAmt = dep; shift.depositTo = dep > 0 ? String(opt.depositTo || '') : '';
      if (dep > 0) {
        var w = readAll_('Wallets').filter(function (x) { return x.walletId === opt.depositTo; })[0];
        if (!w) throw new Error('เลือกว่าเงินที่เก็บออกไปไว้ที่ไหน');
        addLedger_(s, { walletId: w.walletId, amount: dep, kind: 'DEPOSIT', ref: shift.shiftId, note: 'เงินจากกะ ' + fmtDate_(shift.closedAt, 'd/M HH:mm'),
                        cleared: w.type === 'bank' ? false : true });
      }
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
