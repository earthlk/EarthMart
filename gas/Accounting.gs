/**
 * Accounting for the owner: where the money is (wallets), shop expenses, what we owe (payables),
 * what customers owe (credit sales), profit & loss, stock value and tax figures.
 *
 * Money lives in:
 *   - the drawer of each counter: worked out from its shifts (open shift = expected cash, else the float left at close)
 *   - wallets (Wallets sheet): cash reserve and bank accounts. Balance = opening + Ledger rows
 *     (+ QR / transfer sales and customer QR payments for the wallet that receives them).
 * Stock is valued at cost from the FIFO lots.
 */

var DEFAULT_EXPENSE_CATS = ['ค่าเช่าที่', 'ค่าไฟ / น้ำ', 'น้ำแข็ง', 'ถุง / ของใช้', 'ซ่อมบำรุง', 'อินเทอร์เน็ต', 'ค่าแรง', 'อื่น ๆ'];
var LEDGER_KINDS = ['OPENING', 'DEPOSIT', 'FLOAT', 'EXPENSE', 'PAYABLE', 'PURCHASE', 'CUSTPAY', 'DRAW', 'INVEST', 'TRANSFER', 'ADJUST'];
var BILLS_MAX_BYTES = 800 * 1024;

function expenseCats_() {
  var raw = getSetting_('expenseCats');
  try { var a = raw ? JSON.parse(raw) : null; if (Array.isArray(a) && a.length) return a; } catch (e) { /* default */ }
  return DEFAULT_EXPENSE_CATS.slice();
}

function addExpenseCat_(name) {
  var cats = expenseCats_();
  if (name && cats.indexOf(name) < 0) { cats.splice(Math.max(0, cats.length - 1), 0, name); saveSettingRaw_('expenseCats', JSON.stringify(cats)); }
}

function ymd_(d) { return d instanceof Date ? fmtDate_(d, 'yyyy-MM-dd') : String(d || '').slice(0, 10); }

function validYmd_(v, fallback) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : fallback; }

/* ------------------------------------------------------------------ */
/* Wallets                                                             */
/* ------------------------------------------------------------------ */

/** Wallet rows; the first call makes a cash reserve and a bank account that receives QR / transfers. */
function wallets_() {
  var w = readAll_('Wallets').filter(function (x) { return bool_(x.active) || x.active === ''; });
  if (w.length) return w.sort(function (a, b) { return num_(a.sort) - num_(b.sort); });
  appendMany_('Wallets', [
    { walletId: 'WRESERVE', name: 'เงินสดสำรอง', type: 'reserve', opening: 0, receivesQr: false, active: true, sort: 1, createdAt: now_() },
    { walletId: 'WBANK', name: 'บัญชีธนาคาร', type: 'bank', opening: 0, receivesQr: true, active: true, sort: 2, createdAt: now_() }
  ]);
  return readAll_('Wallets');
}

/** Names only (no balances) for the counter's choices: open-shift source, deposit, receive payment. */
function walletsForClient_() {
  return wallets_().map(function (w) { return { walletId: w.walletId, name: w.name, type: w.type }; });
}

function walletById_(id) {
  var w = wallets_().filter(function (x) { return x.walletId === id; })[0];
  if (!w) throw new Error('ไม่พบกระเป๋าเงิน');
  return w;
}

function qrWalletId_() {
  var w = wallets_();
  var q = w.filter(function (x) { return bool_(x.receivesQr); })[0] || w.filter(function (x) { return x.type === 'bank'; })[0];
  return q ? q.walletId : '';
}

function addLedger_(s, tx) {
  var row = {
    txId: uid_('TX'), txUid: tx.txUid || '', createdAt: tx.createdAt || now_(), walletId: tx.walletId, amount: round2_(tx.amount),
    kind: tx.kind, ref: tx.ref || '', note: tx.note || '', userId: s.userId, cleared: tx.cleared === false ? false : true, status: ''
  };
  append_('Ledger', row);
  return row;
}

function voidLedgerByRef_(ref) {
  readAll_('Ledger').forEach(function (t) { if (t.ref === ref && t.status !== 'VOID') { t.status = 'VOID'; writeRow_('Ledger', t); } });
}

/** Drawer cash per counter device: the open shift's expected cash, else the float left at the last close. */
function drawers_() {
  var devices = {};
  readAll_('Devices').forEach(function (d) { devices[d.deviceId] = d; });
  var last = {};
  readAll_('Shifts').forEach(function (sh) { last[sh.deviceId] = sh; });
  return Object.keys(last).map(function (dev) {
    var sh = last[dev];
    var cash = sh.status === 'OPEN' ? shiftSummary_(sh.shiftId).expectedCash
      : (sh.floatLeft === '' || sh.floatLeft === undefined ? num_(sh.countedCash) : num_(sh.floatLeft));
    return { deviceId: dev, name: (devices[dev] || {}).name || dev, cash: round2_(cash), open: sh.status === 'OPEN', shiftId: sh.shiftId };
  });
}

/** Non-cash takings that land in the QR wallet: QR / transfer sales − non-cash refunds + customer QR payments at the counter. */
function qrIncome_(fromDate) {
  var inc = 0;
  readAll_('Sales').forEach(function (b) {
    if (b.status === 'VOID' || !(b.createdAt instanceof Date) || (fromDate && b.createdAt < fromDate)) return;
    var pp = payParts_(b); inc += pp.qr + pp.transfer;
  });
  readAll_('Returns').forEach(function (r) {
    if (r.refundMethod === 'cash' || !(r.createdAt instanceof Date) || (fromDate && r.createdAt < fromDate)) return;
    inc -= num_(r.total);
  });
  readAll_('CustPays').forEach(function (p) {
    if (p.walletId || p.method === 'cash' || !(p.createdAt instanceof Date) || (fromDate && p.createdAt < fromDate)) return;
    inc += num_(p.amount);
  });
  return round2_(inc);
}

function accStartDate_() {
  var v = getSetting_('accStart');
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00') : null;
}

function walletBalances_() {
  var start = accStartDate_();
  var qrId = qrWalletId_();
  var qr = qrIncome_(start);
  var led = readAll_('Ledger').filter(function (t) { return t.status !== 'VOID'; });
  return wallets_().map(function (w) {
    var bal = num_(w.opening), pending = 0;
    led.forEach(function (t) {
      if (t.walletId !== w.walletId) return;
      if (t.cleared === false || t.cleared === 'FALSE' || t.cleared === 'false') pending += num_(t.amount); else bal += num_(t.amount);
    });
    if (w.walletId === qrId) bal += qr;
    return { walletId: w.walletId, name: w.name, type: w.type, opening: num_(w.opening), receivesQr: w.walletId === qrId,
             balance: round2_(bal), pending: round2_(pending) };
  });
}

/* ------------------------------------------------------------------ */
/* Customers who buy on credit                                         */
/* ------------------------------------------------------------------ */

function custBalances_() {
  var owed = {}, bills = {}, since = {}, paid = {};
  readAll_('Sales').forEach(function (b) {
    if (b.status === 'VOID' || !b.customerId || !(num_(b.creditPaid) > 0)) return;
    var left = Math.max(0, num_(b.creditPaid) - num_(b.returnedTotal));
    if (!left) return;
    owed[b.customerId] = (owed[b.customerId] || 0) + left;
    (bills[b.customerId] = bills[b.customerId] || []).push({ billNo: b.billNo, createdAt: b.createdAt, amount: round2_(left) });
  });
  readAll_('CustPays').forEach(function (p) { paid[p.customerId] = (paid[p.customerId] || 0) + num_(p.amount); });
  // Payments settle the oldest bills first; what is left is still open.
  var out = {};
  Object.keys(Object.assign({}, owed, paid)).forEach(function (cid) {
    var p = paid[cid] || 0;
    var open = (bills[cid] || []).sort(function (a, b) { return a.createdAt - b.createdAt; }).filter(function (bl) {
      if (p >= bl.amount - 0.004) { p -= bl.amount; return false; }
      if (p > 0) { bl.amount = round2_(bl.amount - p); p = 0; }
      return true;
    });
    var bal = round2_((owed[cid] || 0) - (paid[cid] || 0));
    out[cid] = { balance: Math.max(0, bal), credit: bal < 0 ? -bal : 0, open: open, since: open.length ? open[0].createdAt : '' };
  });
  return out;
}

/** Counter + owner: customer names for the credit picker, with what each one owes. */
function api_customers(token) {
  return respond_(function () {
    session_(token);
    var bal = custBalances_();
    return readAll_('Customers').filter(function (c) { return c.active !== false && c.active !== 'FALSE'; }).map(function (c) {
      var b = bal[c.customerId] || { balance: 0, open: [], since: '' };
      return { customerId: c.customerId, name: c.name, phone: String(c.phone || ''), note: c.note || '',
               balance: b.balance, bills: b.open.length, since: b.since };
    }).sort(function (a, b) { return b.balance - a.balance || String(a.name).localeCompare(String(b.name)); });
  });
}

/** Make (or find) a customer. Caller holds the lock. */
function ensureCustomer_(c) {
  if (!c) throw new Error('เลือกชื่อลูกค้า');
  var all = readAll_('Customers');
  var found = c.customerId ? all.filter(function (x) { return x.customerId === c.customerId; })[0] : null;
  if (found) return found;
  var name = String(c.name || '').trim();
  if (!name) throw new Error('ใส่ชื่อลูกค้า');
  var same = all.filter(function (x) { return String(x.name).trim() === name && (x.active !== false && x.active !== 'FALSE'); })[0];
  if (same && !c.customerId) return same;
  var row = { customerId: c.customerId || uid_('CU'), name: name, phone: String(c.phone || '').trim(), note: String(c.note || ''), createdAt: now_(), active: true };
  append_('Customers', row);
  return row;
}

function api_saveCustomer(token, c) {
  return respond_(function () {
    var s = session_(token);
    return withLock_(function () {
      var row = c.customerId ? readAll_('Customers').filter(function (x) { return x.customerId === c.customerId; })[0] : null;
      if (row) {
        if (!String(c.name || '').trim()) throw new Error('ใส่ชื่อลูกค้า');
        row.name = String(c.name).trim(); row.phone = String(c.phone || '').trim(); row.note = String(c.note || '');
        writeRow_('Customers', row);
      } else row = ensureCustomer_(c);
      log_(s, 'CUSTOMER', row.customerId, row.name, '');
      return { customerId: row.customerId, name: row.name };
    });
  });
}

function api_customerDetail(token, customerId) {
  return respond_(function () {
    session_(token);
    var c = readAll_('Customers').filter(function (x) { return x.customerId === customerId; })[0];
    if (!c) throw new Error('ไม่พบลูกค้า');
    var b = custBalances_()[customerId] || { balance: 0, open: [] };
    var lines = {};
    var openNos = {};
    b.open.forEach(function (o) { openNos[o.billNo] = true; });
    readAll_('SaleLines').forEach(function (l) { if (openNos[l.billNo]) (lines[l.billNo] = lines[l.billNo] || []).push(l.name + (num_(l.qty) !== 1 ? ' ×' + num_(l.qty) : '')); });
    var users = {};
    readAll_('Users').forEach(function (u) { users[u.userId] = u.name; });
    return {
      customerId: c.customerId, name: c.name, phone: String(c.phone || ''), note: c.note || '', balance: b.balance,
      bills: b.open.map(function (o) { return { billNo: o.billNo, createdAt: o.createdAt, amount: o.amount, items: (lines[o.billNo] || []).join(', ') }; }),
      pays: readAll_('CustPays').filter(function (p) { return p.customerId === customerId; }).reverse().slice(0, 20).map(function (p) {
        return { createdAt: p.createdAt, amount: num_(p.amount), method: p.method, by: users[p.userId] || '' };
      })
    };
  });
}

/**
 * A customer pays back. p = { payUid, customerId, amount, method: 'cash'|'qr'|'transfer', walletId? }
 * At a counter with an open shift and no walletId, cash goes in the drawer and QR / transfer to the QR wallet.
 * From the back office, walletId says where the money went.
 */
function api_custPay(token, p) {
  return respond_(function () {
    var s = session_(token);
    if (!p || !p.payUid) throw new Error('ข้อมูลไม่ครบ');
    var amt = round2_(num_(p.amount));
    if (!(amt > 0)) throw new Error('จำนวนเงินต้องมากกว่า 0');
    return withLock_(function () {
      var dup = readAll_('CustPays').filter(function (x) { return x.payUid === p.payUid; })[0];
      if (dup) return { payId: dup.payId, duplicate: true };
      var c = readAll_('Customers').filter(function (x) { return x.customerId === p.customerId; })[0];
      if (!c) throw new Error('ไม่พบลูกค้า');
      var bal = (custBalances_()[c.customerId] || { balance: 0 }).balance;
      if (amt > bal + 0.004) throw new Error('รับเกินยอดค้าง (' + bal + ' บาท)');
      var shift = p.walletId ? null : openShiftForDevice_(s.deviceId);
      if (!p.walletId && !shift) throw new Error('เลือกว่าเงินเข้ากระเป๋าไหน');
      var row = { payId: uid_('CP'), payUid: p.payUid, createdAt: now_(), customerId: c.customerId, amount: amt,
                  method: ['cash', 'qr', 'transfer'].indexOf(p.method) >= 0 ? p.method : 'cash', walletId: p.walletId || '',
                  shiftId: shift ? shift.shiftId : '', deviceId: s.deviceId || '', userId: s.userId, note: String(p.note || '') };
      append_('CustPays', row);
      if (p.walletId) { walletById_(p.walletId); addLedger_(s, { walletId: p.walletId, amount: amt, kind: 'CUSTPAY', ref: row.payId, note: c.name }); }
      log_(s, 'CUST_PAY', row.payId, c.name + ' จ่าย ' + amt + ' บาท', '');
      return { payId: row.payId, balance: round2_(bal - amt) };
    });
  });
}

/* ------------------------------------------------------------------ */
/* Expenses                                                            */
/* ------------------------------------------------------------------ */

function billsFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('BILLS_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* deleted */ } }
  var f = DriveApp.createFolder(APP_NAME + ' Bills');
  props.setProperty('BILLS_FOLDER_ID', f.getId());
  return f;
}

function saveBillImage_(dataUrl, name) {
  var m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('ไฟล์ต้องเป็นรูปภาพ');
  var bytes = Utilities.base64Decode(m[3]);
  if (bytes.length > BILLS_MAX_BYTES) throw new Error('รูปใหญ่เกินไป');
  return billsFolder_().createFile(Utilities.newBlob(bytes, m[1], name + '.' + (m[2] === 'jpeg' ? 'jpg' : m[2]))).getId();
}

/** Pay out of a counter drawer from the back office: a cash move on the open shift (only one open shift allowed). */
function drawerPay_(s, amount, kind, category, reason, ref) {
  var open = readAll_('Shifts').filter(function (x) { return x.status === 'OPEN'; });
  if (!open.length) throw new Error('ไม่มีกะที่เปิดอยู่ — เลือกจ่ายจากกระเป๋าอื่น');
  var sh = open.filter(function (x) { return x.deviceId === s.deviceId; })[0] || open[0];
  var mv = { moveId: uid_('CM'), shiftId: sh.shiftId, createdAt: now_(), type: 'OUT', amount: round2_(amount), reason: reason,
             userId: s.userId, kind: kind, category: category || '', ref: ref || '' };
  append_('CashMoves', mv);
  return mv;
}

/**
 * e = { expUid, expenseId? (edit), date, category, amount, payFrom: walletId | 'drawer' | 'credit', note, recurring,
 *       dueDate? (credit), party? (credit), image? (data URL) }
 */
function api_saveExpense(token, e) {
  return respond_(function () {
    var s = owner_(token);
    e = e || {};
    var amt = round2_(num_(e.amount));
    if (!(amt > 0)) throw new Error('จำนวนเงินต้องมากกว่า 0');
    var cat = String(e.category || '').trim() || 'อื่น ๆ';
    var date = validYmd_(e.date, fmtDate_(now_(), 'yyyy-MM-dd'));
    return withLock_(function () {
      if (e.expenseId) {   // edit: category, note, date, recurring and photo; money moves stay as they were
        var row = readAll_('Expenses').filter(function (x) { return x.expenseId === e.expenseId; })[0];
        if (!row) throw new Error('ไม่พบรายการ');
        row.category = cat; row.note = String(e.note || ''); row.date = date; row.recurring = !!e.recurring;
        if (e.image) row.fileId = saveBillImage_(e.image, row.expenseId);
        writeRow_('Expenses', row);
        addExpenseCat_(cat);
        return { expenseId: row.expenseId };
      }
      if (!e.expUid) throw new Error('ข้อมูลไม่ครบ');
      var dup = readAll_('Expenses').filter(function (x) { return x.expUid === e.expUid; })[0];
      if (dup) return { expenseId: dup.expenseId, duplicate: true };
      var id = uid_('EX');
      var row2 = { expenseId: id, expUid: e.expUid, createdAt: now_(), date: date, category: cat, amount: amt, payFrom: e.payFrom || '',
                   note: String(e.note || ''), fileId: e.image ? saveBillImage_(e.image, id) : '', recurring: !!e.recurring, payableId: '',
                   userId: s.userId, status: '' };
      var label = cat + (row2.note ? ' · ' + row2.note : '');
      if (e.payFrom === 'credit') {
        var pay = { payableId: uid_('AP'), payUid: '', createdAt: now_(), party: String(e.party || row2.note || cat), category: cat, amount: amt,
                    paid: 0, dueDate: validYmd_(e.dueDate, ''), source: 'expense', ref: id, note: row2.note, status: 'OPEN', userId: s.userId };
        append_('Payables', pay);
        row2.payableId = pay.payableId;
      } else if (e.payFrom === 'drawer') {
        drawerPay_(s, amt, 'expense', cat, label, id);
      } else {
        walletById_(e.payFrom);
        addLedger_(s, { walletId: e.payFrom, amount: -amt, kind: 'EXPENSE', ref: id, note: label });
      }
      append_('Expenses', row2);
      addExpenseCat_(cat);
      log_(s, 'EXPENSE', id, label + ' · ' + amt + ' บาท', '');
      return { expenseId: id };
    });
  });
}

function api_voidExpense(token, expenseId) {
  return respond_(function () {
    var s = owner_(token);
    return withLock_(function () {
      var row = readAll_('Expenses').filter(function (x) { return x.expenseId === expenseId; })[0];
      if (!row || row.status === 'VOID') throw new Error('ไม่พบรายการ');
      if (row.payFrom === 'drawer') throw new Error('รายการนี้จ่ายจากลิ้นชัก — ยกเลิกไม่ได้ (เงินออกจากลิ้นชักไปแล้ว)');
      if (row.payableId) {
        var p = readAll_('Payables').filter(function (x) { return x.payableId === row.payableId; })[0];
        if (p && num_(p.paid) > 0) throw new Error('จ่ายหนี้รายการนี้ไปแล้ว — ยกเลิกไม่ได้');
        if (p) { p.status = 'VOID'; writeRow_('Payables', p); }
      }
      voidLedgerByRef_(row.expenseId);
      row.status = 'VOID';
      writeRow_('Expenses', row);
      log_(s, 'EXPENSE_VOID', row.expenseId, row.category + ' · ' + row.amount, '');
      return { expenseId: row.expenseId };
    });
  });
}

/** Expense rows (manual + cash taken from the drawer for expenses) in [from, to]. */
function expenseRows_(from, to) {
  var wname = {};
  wallets_().forEach(function (w) { wname[w.walletId] = w.name; });
  var out = [];
  readAll_('Expenses').forEach(function (x) {
    if (x.status === 'VOID') return;
    var d = ymd_(x.date);
    if (d < from || d > to) return;
    out.push({ id: x.expenseId, date: d, createdAt: x.createdAt, category: x.category, amount: num_(x.amount), note: x.note || '',
               from: x.payFrom === 'credit' ? 'ค้างจ่าย' : x.payFrom === 'drawer' ? 'ลิ้นชัก' : (wname[x.payFrom] || ''),
               payFrom: x.payFrom, fileId: x.fileId || '', recurring: bool_(x.recurring), source: 'manual' });
  });
  readAll_('CashMoves').forEach(function (m) {
    if (m.type !== 'OUT' || m.kind !== 'expense' || m.ref) return;   // ref = paid for a back-office expense, already listed
    var d = ymd_(m.createdAt);
    if (d < from || d > to) return;
    out.push({ id: m.moveId, date: d, createdAt: m.createdAt, category: m.category || 'อื่น ๆ', amount: num_(m.amount), note: m.reason || '',
               from: 'ลิ้นชัก', payFrom: 'drawer', fileId: '', recurring: false, source: 'drawer' });
  });
  return out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
}

function api_expenses(token, f) {
  return respond_(function () {
    owner_(token);
    f = f || {};
    var today = fmtDate_(now_(), 'yyyy-MM-dd');
    var from = validYmd_(f.from, today.slice(0, 8) + '01'), to = validYmd_(f.to, today);
    var rows = expenseRows_(from, to);
    var wname = {};
    wallets_().forEach(function (w) { wname[w.walletId] = w.name; });
    var aps = {};
    readAll_('Payables').forEach(function (p) { aps[p.payableId] = p; });
    var purchases = readAll_('Receipts').filter(function (r) { var d = ymd_(r.createdAt); return d >= from && d <= to; }).reverse().map(function (r) {
      var ap = aps[r.payableId];
      return { receiptNo: r.receiptNo, date: ymd_(r.createdAt), supplier: r.supplier || '', items: num_(r.itemsCount), total: num_(r.total),
               from: r.payFrom === 'credit' ? '' : r.payFrom === 'drawer' ? 'ลิ้นชัก' : (wname[r.payFrom] || (r.payFrom ? r.payFrom : 'ไม่ระบุ')),
               status: ap ? (ap.status === 'PAID' ? 'จ่ายแล้ว' : 'ค้างจ่าย' + (ap.dueDate ? ' · ครบ ' + ymd_(ap.dueDate) : '')) : (r.payFrom ? 'จ่ายแล้ว' : 'ไม่ระบุ') };
    });
    return { from: from, to: to, cats: expenseCats_(), rows: rows, purchases: purchases };
  });
}

function api_billImage(token, fileId) {
  return respond_(function () {
    owner_(token);
    var f = DriveApp.getFileById(fileId);
    var b = f.getBlob();
    return { dataUrl: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) };
  });
}

/* ------------------------------------------------------------------ */
/* What we owe                                                         */
/* ------------------------------------------------------------------ */

function api_payables(token) {
  return respond_(function () {
    owner_(token);
    var today = fmtDate_(now_(), 'yyyy-MM-dd');
    return readAll_('Payables').filter(function (p) { return p.status === 'OPEN'; }).map(function (p) {
      var due = ymd_(p.dueDate);
      return { payableId: p.payableId, party: p.party, category: p.category || '', amount: num_(p.amount), paid: num_(p.paid),
               left: round2_(num_(p.amount) - num_(p.paid)), dueDate: due, source: p.source, ref: p.ref || '', note: p.note || '',
               days: due ? Math.round((new Date(due + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000) : null };
    }).sort(function (a, b) { return (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1; });
  });
}

/** p = { payUid, party, category, amount, dueDate, note } — something we owe, added by hand. */
function api_savePayable(token, p) {
  return respond_(function () {
    var s = owner_(token);
    p = p || {};
    var amt = round2_(num_(p.amount));
    if (!(amt > 0)) throw new Error('จำนวนเงินต้องมากกว่า 0');
    if (!String(p.party || '').trim()) throw new Error('ใส่ชื่อว่าค้างจ่ายใคร');
    return withLock_(function () {
      if (p.payUid) {
        var dup = readAll_('Payables').filter(function (x) { return x.payUid === p.payUid; })[0];
        if (dup) return { payableId: dup.payableId, duplicate: true };
      }
      var cat = String(p.category || '').trim() || 'อื่น ๆ';
      var row = { payableId: uid_('AP'), payUid: p.payUid || '', createdAt: now_(), party: String(p.party).trim(), category: cat,
                  amount: amt, paid: 0, dueDate: validYmd_(p.dueDate, ''), source: 'manual', ref: '', note: String(p.note || ''), status: 'OPEN', userId: s.userId };
      // Added by hand = an expense not paid yet (it counts in the month it is for).
      var ex = { expenseId: uid_('EX'), expUid: '', createdAt: now_(), date: validYmd_(p.date, fmtDate_(now_(), 'yyyy-MM-dd')), category: cat,
                 amount: amt, payFrom: 'credit', note: row.party + (row.note ? ' · ' + row.note : ''), fileId: '', recurring: false,
                 payableId: row.payableId, userId: s.userId, status: '' };
      if (p.isPurchase) { row.category = 'ซื้อสินค้า'; row.source = 'purchase'; }
      else { row.ref = ex.expenseId; append_('Expenses', ex); addExpenseCat_(cat); }
      append_('Payables', row);
      log_(s, 'PAYABLE', row.payableId, row.party + ' · ' + amt, '');
      return { payableId: row.payableId };
    });
  });
}

/** Pay all or part of what we owe. walletId or 'drawer'. */
function api_payPayable(token, payableId, amount, walletId) {
  return respond_(function () {
    var s = owner_(token);
    return withLock_(function () {
      var p = readAll_('Payables').filter(function (x) { return x.payableId === payableId; })[0];
      if (!p || p.status !== 'OPEN') throw new Error('ไม่พบรายการค้างจ่าย');
      var left = round2_(num_(p.amount) - num_(p.paid));
      var amt = amount === undefined || amount === null || amount === '' ? left : round2_(num_(amount));
      if (!(amt > 0)) throw new Error('จำนวนเงินต้องมากกว่า 0');
      if (amt > left + 0.004) throw new Error('จ่ายเกินยอดค้าง (' + left + ' บาท)');
      if (walletId === 'drawer') drawerPay_(s, amt, 'payable', p.category, 'จ่ายหนี้ ' + p.party, p.payableId);
      else { walletById_(walletId); addLedger_(s, { walletId: walletId, amount: -amt, kind: 'PAYABLE', ref: p.payableId, note: 'จ่าย ' + p.party }); }
      p.paid = round2_(num_(p.paid) + amt);
      if (p.paid >= num_(p.amount) - 0.004) p.status = 'PAID';
      writeRow_('Payables', p);
      log_(s, 'PAYABLE_PAY', p.payableId, p.party + ' · จ่าย ' + amt, '');
      return { payableId: p.payableId, left: round2_(num_(p.amount) - num_(p.paid)) };
    });
  });
}

/* ------------------------------------------------------------------ */
/* Wallet page                                                         */
/* ------------------------------------------------------------------ */

function api_wallets(token, walletId) {
  return respond_(function () {
    owner_(token);
    var bals = walletBalances_();
    var id = walletId || (bals.filter(function (w) { return w.type === 'bank'; })[0] || bals[0] || {}).walletId;
    var users = {};
    readAll_('Users').forEach(function (u) { users[u.userId] = u.name; });
    var rows = readAll_('Ledger').filter(function (t) { return t.walletId === id && t.status !== 'VOID'; }).map(function (t) {
      return { txId: t.txId, createdAt: t.createdAt, amount: num_(t.amount), kind: t.kind, note: t.note || '', by: users[t.userId] || '',
               cleared: !(t.cleared === false || t.cleared === 'FALSE' || t.cleared === 'false') };
    });
    if (bals.filter(function (w) { return w.walletId === id && w.receivesQr; }).length) {
      // QR / transfer takings, one row per day
      var start = accStartDate_(), days = {};
      readAll_('Sales').forEach(function (b) {
        if (b.status === 'VOID' || !(b.createdAt instanceof Date) || (start && b.createdAt < start)) return;
        var pp = payParts_(b), v = pp.qr + pp.transfer;
        if (v) { var d = ymd_(b.createdAt); days[d] = (days[d] || 0) + v; }
      });
      readAll_('Returns').forEach(function (r) {
        if (r.refundMethod === 'cash' || !(r.createdAt instanceof Date) || (start && r.createdAt < start)) return;
        var d = ymd_(r.createdAt); days[d] = (days[d] || 0) - num_(r.total);
      });
      readAll_('CustPays').forEach(function (p) {
        if (p.walletId || p.method === 'cash' || !(p.createdAt instanceof Date) || (start && p.createdAt < start)) return;
        var d = ymd_(p.createdAt); days[d] = (days[d] || 0) + num_(p.amount);
      });
      Object.keys(days).forEach(function (d) {
        if (Math.abs(days[d]) < 0.005) return;
        rows.push({ txId: '', createdAt: new Date(d + 'T23:59:00'), amount: round2_(days[d]), kind: 'SALES_QR', note: 'ยอด QR / โอน ' + d, by: '', cleared: true });
      });
    }
    rows.sort(function (a, b) { return b.createdAt - a.createdAt; });
    return { wallets: bals, drawers: drawers_(), walletId: id, rows: rows.slice(0, 300), start: getSetting_('accStart') };
  });
}

/**
 * Owner moves money. t = { txUid, kind: 'TRANSFER'|'DRAW'|'INVEST'|'ADJUST', from?, to?, amount, note }
 * from / to are wallet ids ('drawer' allowed as from for DRAW and TRANSFER while a shift is open).
 */
function api_walletTx(token, t) {
  return respond_(function () {
    var s = owner_(token);
    t = t || {};
    var amt = round2_(num_(t.amount));
    if (t.kind !== 'ADJUST' && !(amt > 0)) throw new Error('จำนวนเงินต้องมากกว่า 0');
    return withLock_(function () {
      if (t.txUid && readAll_('Ledger').some(function (x) { return x.txUid === t.txUid; })) return { duplicate: true };
      var note = String(t.note || '');
      var out = function (from, kind, label) {
        if (from === 'drawer') drawerPay_(s, amt, kind === 'DRAW' ? 'draw' : 'transfer', '', label, t.txUid || '');
        else { walletById_(from); addLedger_(s, { txUid: t.txUid, walletId: from, amount: -amt, kind: kind, note: label }); }
      };
      if (t.kind === 'TRANSFER') {
        if (!t.from || !t.to || t.from === t.to) throw new Error('เลือกกระเป๋าต้นทางและปลายทาง');
        walletById_(t.to);
        out(t.from, 'TRANSFER', 'ย้ายไป ' + walletById_(t.to).name + (note ? ' · ' + note : ''));
        addLedger_(s, { txUid: t.txUid ? t.txUid + '-in' : '', walletId: t.to, amount: amt, kind: 'TRANSFER', note: 'ย้ายมาจาก ' + (t.from === 'drawer' ? 'ลิ้นชัก' : walletById_(t.from).name) + (note ? ' · ' + note : '') });
      } else if (t.kind === 'DRAW') {
        out(t.from, 'DRAW', 'ถอนใช้ส่วนตัว' + (note ? ' · ' + note : ''));
      } else if (t.kind === 'INVEST') {
        walletById_(t.to);
        addLedger_(s, { txUid: t.txUid, walletId: t.to, amount: amt, kind: 'INVEST', note: 'ลงทุนเพิ่ม' + (note ? ' · ' + note : '') });
      } else if (t.kind === 'ADJUST') {
        walletById_(t.to);
        if (!amt) throw new Error('ใส่จำนวนเงิน (ติดลบได้)');
        addLedger_(s, { txUid: t.txUid, walletId: t.to, amount: amt, kind: 'ADJUST', note: note || 'ปรับยอดตาม statement' });
      } else throw new Error('ไม่รู้จักรายการ');
      log_(s, 'WALLET_' + t.kind, t.txUid || '', amt + ' บาท ' + note, '');
      return { ok: true };
    });
  });
}

/** Tick a ledger row as matched with the statement (or a deposit as actually banked). */
function api_setCleared(token, txId, cleared) {
  return respond_(function () {
    var s = owner_(token);
    return withLock_(function () {
      var t = readAll_('Ledger').filter(function (x) { return x.txId === txId; })[0];
      if (!t) throw new Error('ไม่พบรายการ');
      t.cleared = !!cleared;
      writeRow_('Ledger', t);
      log_(s, 'LEDGER_CLEAR', txId, cleared ? 'ฝากแล้ว / ตรงกับ statement' : 'ยกเลิกการติ๊ก', '');
      return { txId: txId, cleared: !!cleared };
    });
  });
}

/**
 * Starting point: date, opening balance of each wallet (and new wallets). w = { start, wallets: [{ walletId?, name, type, opening, receivesQr }] }
 * The total of money + stock on that day is kept to measure growth.
 */
function api_accSetup(token, w) {
  return respond_(function () {
    var s = owner_(token);
    w = w || {};
    return withLock_(function () {
      var existing = wallets_();
      var qrSet = false;
      (w.wallets || []).forEach(function (x, i) {
        var name = String(x.name || '').trim();
        if (!name) return;
        var row = x.walletId ? existing.filter(function (e) { return e.walletId === x.walletId; })[0] : null;
        var q = !!x.receivesQr && !qrSet;
        if (q) qrSet = true;
        if (row) {
          row.name = name; row.opening = round2_(num_(x.opening)); row.receivesQr = q; row.active = x.active !== false;
          row.type = x.type === 'bank' ? 'bank' : 'reserve'; row.sort = i + 1;
          writeRow_('Wallets', row);
        } else {
          append_('Wallets', { walletId: uid_('W'), name: name, type: x.type === 'bank' ? 'bank' : 'reserve', opening: round2_(num_(x.opening)),
                               receivesQr: q, active: true, sort: i + 1, createdAt: now_() });
        }
      });
      var start = validYmd_(w.start, getSetting_('accStart') || fmtDate_(now_(), 'yyyy-MM-dd'));
      saveSettingRaw_('accStart', start);
      var stock = 0;
      var vals = lotValues_();
      Object.keys(vals).forEach(function (k) { stock += vals[k]; });
      var money = walletBalances_().reduce(function (a, x) { return a + x.balance + x.pending; }, 0) +
        drawers_().reduce(function (a, d) { return a + d.cash; }, 0);
      saveSettingRaw_('accStartAssets', String(round2_(money + stock)));
      log_(s, 'ACC_SETUP', start, 'ตั้งยอดเริ่มต้น ' + round2_(money + stock), '');
      return { start: start, assets: round2_(money + stock) };
    });
  });
}

/* ------------------------------------------------------------------ */
/* Profit & loss, stock, tax                                           */
/* ------------------------------------------------------------------ */

/** Everything that changed stock value or profit between from and to (yyyy-MM-dd, inclusive). */
function accFigures_(from, to, ctx) {
  var inR = function (d) { var k = ymd_(d); return k >= from && k <= to; };
  var F = { sales: 0, cash: 0, qr: 0, transfer: 0, credit: 0, bills: 0, refunds: 0, cogs: 0, waste: 0, storeUse: 0,
            shrinkLoss: 0, shrinkGain: 0, purchases: 0, lotsIn: 0, lotsOut: 0, cashDiff: 0, expenses: 0, byCat: {}, draws: 0, invests: 0, discount: 0 };
  var billNos = ctx.billNos;
  ctx.sales.forEach(function (b) {
    if (b.status === 'VOID' || !inR(b.createdAt)) return;
    var pp = payParts_(b);
    F.sales += num_(b.total); F.cash += pp.cash; F.qr += pp.qr; F.transfer += pp.transfer; F.credit += num_(b.creditPaid); F.bills++;
    F.discount += num_(b.discount) + num_(b.promoDiscount);
  });
  ctx.returns.forEach(function (r) { if (inR(r.createdAt)) F.refunds += num_(r.total); });
  ctx.lotUse.forEach(function (u) {
    if (!inR(u.createdAt)) return;
    var v = num_(u.qty) * num_(u.unitCost);
    F.lotsOut += v;
    var k = ctx.kind[u.refNo];
    if (billNos[u.refNo]) F.cogs += v;
    else if (k === 'use') F.storeUse += v;
    else if (k === 'loss' || k === 'expiry') F.waste += v;
    else if (k === 'count') F.shrinkLoss += v;
    else F.cogs += v;
  });
  ctx.lots.forEach(function (l) {
    if (!inR(l.receivedAt)) return;
    var v = num_(l.qtyIn) * num_(l.unitCost);
    F.lotsIn += v;
    if (ctx.kind[l.receiptNo] === 'count') F.shrinkGain += v;
    else if (ctx.returnNos[l.receiptNo]) F.cogs -= v;     // restocked returns give the cost back
  });
  ctx.receipts.forEach(function (r) { if (inR(r.createdAt)) F.purchases += num_(r.total); });
  ctx.shifts.forEach(function (sh) { if (sh.status === 'CLOSED' && sh.closedAt instanceof Date && inR(sh.closedAt)) F.cashDiff += num_(sh.diff); });
  ctx.expenses.forEach(function (x) {
    var d = ymd_(x.date);
    if (d < from || d > to) return;
    F.expenses += x.amount; F.byCat[x.category] = (F.byCat[x.category] || 0) + x.amount;
  });
  ctx.ledger.forEach(function (t) {
    if (!inR(t.createdAt)) return;
    if (t.kind === 'DRAW') F.draws -= num_(t.amount);
    if (t.kind === 'INVEST') F.invests += num_(t.amount);
  });
  ctx.cashMoves.forEach(function (m) {
    if (!inR(m.createdAt)) return;
    if (m.kind === 'draw') F.draws += m.type === 'OUT' ? num_(m.amount) : -num_(m.amount);
    if (m.kind === 'invest') F.invests += num_(m.amount);
  });
  ctx.shifts.forEach(function (sh) {
    if (!(sh.openedAt instanceof Date) || !inR(sh.openedAt)) return;
    var d = round2_(num_(sh.openingCash) - num_(sh.prevFloat));
    if (sh.openSource === 'owner' && d > 0) F.invests += d;
    if (sh.openSource === 'draw' && d < 0) F.draws += -d;
    if (sh.openSource === 'short' && d < 0) F.cashDiff += d;
  });
  Object.keys(F).forEach(function (k) { if (typeof F[k] === 'number') F[k] = round2_(F[k]); });
  Object.keys(F.byCat).forEach(function (k) { F.byCat[k] = round2_(F.byCat[k]); });
  F.netSales = round2_(F.sales - F.refunds);
  F.gross = round2_(F.netSales - F.cogs);
  F.shrink = round2_(F.shrinkLoss - F.shrinkGain);
  F.net = round2_(F.gross - F.waste - F.storeUse - F.shrink - F.expenses + F.cashDiff);
  return F;
}

function accCtx_() {
  var kind = {};
  readAll_('StockMoves').forEach(function (m) {
    if (m.type === 'STORE_USE') kind[m.refNo] = 'use';
    else if (m.type === 'WRITEOFF') kind[m.refNo] = String(m.note).indexOf('หมดอายุ') === 0 ? 'expiry' : String(m.note).indexOf('ใช้ในร้าน') === 0 ? 'use' : 'loss';
    else if (m.type === 'ADJUST') kind[m.refNo] = 'count';
  });
  var sales = readAll_('Sales'), billNos = {};
  sales.forEach(function (b) { billNos[b.billNo] = true; });
  var returns = readAll_('Returns'), returnNos = {};
  returns.forEach(function (r) { returnNos[r.returnNo] = true; });
  var farFrom = '2000-01-01', farTo = '2999-12-31';
  return { kind: kind, sales: sales, billNos: billNos, returns: returns, returnNos: returnNos, lotUse: readAll_('LotUse'), lots: readAll_('Lots'),
           receipts: readAll_('Receipts'), shifts: readAll_('Shifts'), ledger: readAll_('Ledger').filter(function (t) { return t.status !== 'VOID'; }),
           cashMoves: readAll_('CashMoves'), expenses: expenseRows_(farFrom, farTo) };
}

function stockNow_() {
  var v = lotValues_(), t = 0;
  Object.keys(v).forEach(function (k) { t += v[k]; });
  return round2_(t);
}

/** Stock value (at cost) at the end of day `day`: today's value rolled back by what happened after it. */
function stockAt_(ctx, day, now) {
  var today = fmtDate_(now_(), 'yyyy-MM-dd');
  if (day >= today) return now;
  var next = fmtDate_(new Date(new Date(day + 'T12:00:00').getTime() + 86400000), 'yyyy-MM-dd');
  var after = accFigures_(next, today, ctx);
  return round2_(now - after.lotsIn + after.lotsOut);
}

function dayBefore_(day) { return fmtDate_(new Date(new Date(day + 'T12:00:00').getTime() - 86400000), 'yyyy-MM-dd'); }

/**
 * The whole accounting picture for a period. f = { from, to }.
 * Returns P&L, stock roll-forward, wallets, assets, debts, VAT watch and the previous period to compare.
 */
function api_accSummary(token, f) {
  return respond_(function () {
    owner_(token);
    f = f || {};
    var today = fmtDate_(now_(), 'yyyy-MM-dd');
    var from = validYmd_(f.from, today.slice(0, 8) + '01'), to = validYmd_(f.to, today);
    if (to < from) { var x = from; from = to; to = x; }
    var ctx = accCtx_();
    var F = accFigures_(from, to, ctx);
    // previous period of the same length
    var len = Math.round((new Date(to + 'T12:00:00') - new Date(from + 'T12:00:00')) / 86400000) + 1;
    var pTo = dayBefore_(from), pFrom = fmtDate_(new Date(new Date(pTo + 'T12:00:00').getTime() - (len - 1) * 86400000), 'yyyy-MM-dd');
    var P = accFigures_(pFrom, pTo, ctx);
    var stockNow = stockNow_();
    var stock = { start: stockAt_(ctx, dayBefore_(from), stockNow), end: stockAt_(ctx, to, stockNow), purchases: F.purchases,
                  cogs: F.cogs, waste: round2_(F.waste + F.storeUse), shrink: F.shrink, now: stockNow };
    // buckets for the chart: by day for up to 31 days, else by month
    var byMonth = len > 31, buckets = [];
    var cur = new Date(from + 'T12:00:00');
    while (ymd_(cur) <= to && buckets.length < 400) {
      var a = ymd_(cur), b, label;
      if (byMonth) {
        var mEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 12);
        b = ymd_(mEnd) > to ? to : ymd_(mEnd); label = a.slice(5, 7) + '/' + a.slice(2, 4);
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1, 12);
      } else { b = a; label = String(Number(a.slice(8, 10))); cur = new Date(cur.getTime() + 86400000); }
      var g = accFigures_(a, b, ctx);
      buckets.push({ label: label, from: a, to: b, sales: g.netSales, gross: g.gross, net: g.net });
    }
    var wal = walletBalances_(), drw = drawers_();
    var money = wal.reduce(function (s1, w) { return s1 + w.balance + w.pending; }, 0) + drw.reduce(function (s1, d) { return s1 + d.cash; }, 0);
    var cb = custBalances_(), receivable = 0;
    Object.keys(cb).forEach(function (k) { receivable += cb[k].balance; });
    var payable = 0;
    readAll_('Payables').forEach(function (p) { if (p.status === 'OPEN') payable += num_(p.amount) - num_(p.paid); });
    var start = getSetting_('accStart');
    var allTime = start ? accFigures_(start, today, ctx) : null;
    // VAT watch: sales this calendar year + daily average since the start
    var year = today.slice(0, 4);
    var ytd = accFigures_(year + '-01-01', today, ctx);
    var firstSale = ctx.sales.filter(function (bb) { return bb.createdAt instanceof Date; }).map(function (bb) { return ymd_(bb.createdAt); }).sort()[0] || today;
    var since = firstSale > year + '-01-01' ? firstSale : year + '-01-01';
    var days = Math.max(1, Math.round((new Date(today + 'T12:00:00') - new Date(since + 'T12:00:00')) / 86400000) + 1);
    var missingCost = readAll_('Products').filter(function (p) { return bool_(p.active) && p.type !== 'recipe' && num_(p.onHand) > 0 && !(num_(p.cost) > 0); }).length;
    return {
      from: from, to: to, f: F, prev: P, prevFrom: pFrom, prevTo: pTo, stock: stock, buckets: buckets, byMonth: byMonth,
      wallets: wal, drawers: drw, cats: expenseCats_(),
      assets: { money: round2_(money), stock: stockNow, receivable: round2_(receivable), payable: round2_(payable),
                total: round2_(money + stockNow + receivable - payable), startAssets: num_(getSetting_('accStartAssets')), start: start,
                profitSince: allTime ? allTime.net : null, drawsSince: allTime ? allTime.draws : null, investsSince: allTime ? allTime.invests : null },
      vat: { ytd: ytd.netSales, perDay: round2_(ytd.netSales / days), days: days, limit: 1800000 },
      missingCost: missingCost
    };
  });
}

/** Tax figures for a half (Jan–Jun, for PND 94) or the whole calendar year (PND 90), plus a daily cash book. */
function api_accTax(token, year, half) {
  return respond_(function () {
    owner_(token);
    var y = /^\d{4}$/.test(String(year)) ? String(year) : fmtDate_(now_(), 'yyyy');
    var from = y + '-01-01', to = half ? y + '-06-30' : y + '-12-31';
    var ctx = accCtx_();
    var F = accFigures_(from, to, ctx);
    var actual = round2_(F.cogs + F.waste + F.storeUse + Math.max(0, F.shrink) + F.expenses);
    // daily cash book: money in (sales + customer payments) and out (expenses + purchases + payables paid)
    var book = {};
    var add = function (d, k, v) { var r = book[d] || (book[d] = { day: d, salesIn: 0, otherIn: 0, expensesOut: 0, purchasesOut: 0 }); r[k] += v; };
    ctx.sales.forEach(function (b) { if (b.status !== 'VOID' && b.createdAt instanceof Date) { var d = ymd_(b.createdAt); if (d >= from && d <= to) add(d, 'salesIn', num_(b.total) - num_(b.creditPaid)); } });
    ctx.returns.forEach(function (r) { var d = ymd_(r.createdAt); if (d >= from && d <= to) add(d, 'salesIn', -num_(r.total)); });
    readAll_('CustPays').forEach(function (p) { var d = ymd_(p.createdAt); if (d >= from && d <= to) add(d, 'otherIn', num_(p.amount)); });
    ctx.expenses.forEach(function (x) { if (x.date >= from && x.date <= to && x.payFrom !== 'credit') add(x.date, 'expensesOut', x.amount); });
    ctx.receipts.forEach(function (r) { var d = ymd_(r.createdAt); if (d >= from && d <= to && r.payFrom !== 'credit') add(d, 'purchasesOut', num_(r.total)); });
    ctx.ledger.forEach(function (t) { if (t.kind === 'PAYABLE') { var d = ymd_(t.createdAt); if (d >= from && d <= to) add(d, 'purchasesOut', -num_(t.amount)); } });
    var rows = Object.keys(book).sort().map(function (d) { var r = book[d]; Object.keys(r).forEach(function (k) { if (k !== 'day') r[k] = round2_(r[k]); }); return r; });
    return { year: y, half: !!half, from: from, to: to, income: F.netSales, flat: round2_(F.netSales * 0.6), actual: actual,
             cogs: F.cogs, expenses: F.expenses, waste: round2_(F.waste + F.storeUse), shrink: F.shrink, byCat: F.byCat, book: rows };
  });
}
