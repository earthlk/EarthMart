/**
 * EarthMart POS — Phase 1
 * Google Apps Script JSON API backed by Google Sheets.
 * The user interface is a separate static web app (folder web/) that calls this API with fetch().
 *
 * Files:
 *   Code.gs      API router (doPost), schema, sheet helpers, setup
 *   Auth.gs      users, PIN login, sessions, owner approval, devices
 *   Products.gs  products, barcodes, import, internal barcode
 *   Sales.gs     commit sale, bill numbers, void, bills list
 *   Shifts.gs    open / cash in-out / close shift, LINE summary
 *   Stock.gs     stock moves, opening stock, adjustments
 *   Reports.gs   daily report
 *   Admin.gs     settings, audit log, backup, triggers
 */

var APP_NAME = 'EarthMart POS';

/** Sheet name -> header row. Order of columns is the contract with the code below. */
var SCHEMA = {
  Settings:   ['key', 'value'],
  Users:      ['userId', 'name', 'role', 'pinHash', 'salt', 'active', 'createdAt', 'pinLen'],
  Devices:    ['deviceId', 'name', 'type', 'registeredBy', 'registeredAt', 'active'],
  Products:   ['sku', 'name', 'category', 'type', 'unit', 'cost', 'price', 'minStock', 'openPrice',
               'quickKey', 'quickKeyGroup', 'quickKeyOrder', 'icon', 'color', 'plu', 'active', 'onHand', 'updatedAt',
               'forSale', 'trackExpiry'],
  Recipes:    ['sku', 'componentSku', 'qty'],
  Lots:       ['lotId', 'sku', 'receivedAt', 'receiptNo', 'qtyIn', 'qtyLeft', 'unitCost', 'expiryDate', 'note',
               'expStatus', 'expFound', 'markdownPct', 'markdownLeft', 'expBy', 'expAt'],
  LotUse:     ['createdAt', 'refNo', 'lotId', 'sku', 'qty', 'unitCost', 'note'],
  Receipts:   ['receiptNo', 'receiptUid', 'createdAt', 'supplier', 'invoiceNo', 'userId', 'itemsCount', 'pieces',
               'total', 'note'],
  Barcodes:   ['barcode', 'sku', 'unitName', 'multiplier', 'price'],
  Sales:      ['billNo', 'saleUid', 'createdAt', 'shiftId', 'deviceId', 'userId', 'itemsCount', 'subtotal',
               'discount', 'total', 'payMethod', 'received', 'change', 'status', 'voidReason', 'voidBy', 'voidAt',
               'cashPaid', 'qrPaid', 'transferPaid', 'returnedTotal', 'offline'],
  SaleLines:  ['billNo', 'lineNo', 'sku', 'name', 'barcode', 'unitName', 'multiplier', 'qty', 'unitPrice',
               'lineDiscount', 'lineTotal', 'cost', 'markdownLotId', 'markdownQty', 'markdown', 'returnedQty'],
  Returns:    ['returnNo', 'returnUid', 'createdAt', 'billNo', 'shiftId', 'deviceId', 'userId', 'itemsCount', 'total',
               'refundMethod', 'restock', 'reason', 'approvedBy'],
  ReturnLines: ['returnNo', 'billNo', 'lineNo', 'sku', 'name', 'qty', 'multiplier', 'refund', 'cost', 'restocked'],
  StockMoves: ['moveId', 'createdAt', 'sku', 'qtyPieces', 'type', 'refNo', 'userId', 'note'],
  Shifts:     ['shiftId', 'deviceId', 'userId', 'openedAt', 'openingCash', 'closedAt', 'closedBy', 'cashSales',
               'qrSales', 'transferSales', 'cashIn', 'cashOut', 'expectedCash', 'countedCash', 'diff', 'billCount',
               'voidCount', 'note', 'status', 'cashRefunds', 'otherRefunds'],
  CashMoves:  ['moveId', 'shiftId', 'createdAt', 'type', 'amount', 'reason', 'userId'],
  AuditLog:   ['logId', 'createdAt', 'userId', 'action', 'ref', 'detail', 'approvedBy', 'deviceId']
};

var DEFAULT_SETTINGS = {
  shopName: 'EarthMart',
  shopAddress: '',
  taxId: '',
  promptPayId: '',
  receiptFooter: 'ขอบคุณที่อุดหนุนค่ะ',
  billPrefix: '',
  lineChannelToken: '',
  lineTargetId: '',
  backupFolderId: '',
  backupKeepDays: '30',
  theme: 'light',
  palette: 'forest',
  autoLockMinutes: '5',
  shopHours: '',
  customerWelcome: 'ยินดีต้อนรับค่ะ',
  customerPromoTitle: '',
  customerPromoText: '',
  expiryWarnDays: '{}',
  expiryDefaultDays: '3',
  markdownPct: '30'
};

/* ------------------------------------------------------------------ */
/* API entry                                                           */
/* ------------------------------------------------------------------ */

/**
 * The web app (GitHub Pages or any host) sends:
 *   POST <exec url>   Content-Type: text/plain   body: {"key":"<API key>","fn":"login","args":[...]}
 * text/plain keeps the request "simple" so browsers skip the CORS preflight, which Apps Script cannot answer.
 * Every call needs the shop API key (created by setup()); every call except status/login also needs a PIN session token.
 */
function doPost(e) {
  return json_(route_(e && e.postData ? e.postData.contents : ''));
}

/** Opening the /exec URL in a browser just shows that the API is alive. */
function doGet() {
  return json_({ ok: true, data: { app: APP_NAME, api: 'ready' } });
}

function route_(body) {
  var req;
  try { req = JSON.parse(body || '{}'); } catch (err) { return { ok: false, error: 'คำขอไม่ถูกต้อง' }; }
  var key = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!key || req.key !== key) return { ok: false, error: 'API key ไม่ถูกต้อง — ตรวจการตั้งค่าการเชื่อมต่อ', code: 'BAD_KEY' };
  var name = String(req.fn || '');
  var fn = /^[A-Za-z]+$/.test(name) ? globalThis['api_' + name] : null;
  if (typeof fn !== 'function') return { ok: false, error: 'ไม่มีคำสั่ง ' + name };
  try {
    return fn.apply(null, Array.isArray(req.args) ? req.args : []);
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* Spreadsheet helpers                                                 */
/* ------------------------------------------------------------------ */

function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('ยังไม่ได้ผูก Google Sheet — รัน setup() จากสคริปต์ที่สร้างใน Sheet ก่อน');
  return active;
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('ไม่พบชีต ' + name + ' — รัน setup() ก่อน');
  return sh;
}

/** Read a sheet as array of objects keyed by header. Includes _row (1-based sheet row). */
function readAll_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var headers = SCHEMA[name];
  var values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row.join('') === '') continue;
    var obj = { _row: i + 2 };
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = row[c];
    out.push(obj);
  }
  return out;
}

function toRow_(name, obj) {
  return SCHEMA[name].map(function (h) {
    var v = obj[h];
    return v === undefined || v === null ? '' : v;
  });
}

function append_(name, obj) {
  sheet_(name).appendRow(toRow_(name, obj));
}

/** Append many rows in one write. */
function appendMany_(name, objs) {
  if (!objs.length) return;
  var sh = sheet_(name);
  var rows = objs.map(function (o) { return toRow_(name, o); });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

/** Overwrite a full row (obj must carry _row). */
function writeRow_(name, obj) {
  var headers = SCHEMA[name];
  sheet_(name).getRange(obj._row, 1, 1, headers.length).setValues([toRow_(name, obj)]);
}

function setCell_(name, row, header, value) {
  var col = SCHEMA[name].indexOf(header) + 1;
  if (col < 1) throw new Error('ไม่มีคอลัมน์ ' + header + ' ใน ' + name);
  sheet_(name).getRange(row, col).setValue(value);
}

function now_() { return new Date(); }

function tz_() { return Session.getScriptTimeZone() || 'Asia/Bangkok'; }

function fmtDate_(d, pattern) { return Utilities.formatDate(d, tz_(), pattern); }

function uid_(prefix) {
  return (prefix || '') + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
}

function num_(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function round2_(n) { return Math.round(n * 100) / 100; }

function bool_(v) { return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1'; }

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('ระบบกำลังบันทึกจากเครื่องอื่น ลองใหม่อีกครั้ง');
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

/**
 * Run once from the Apps Script editor (bound to the Google Sheet).
 * Creates every sheet with headers and default settings. Safe to run again.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('ต้องเปิดสคริปต์จากเมนู ส่วนขยาย › Apps Script ของ Google Sheet');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  ensureSchema_(ss, true);

  // Barcodes must stay text so leading zeros survive.
  ss.getSheetByName('Barcodes').getRange('A:A').setNumberFormat('@');
  ss.getSheetByName('Products').getRange('A:A').setNumberFormat('@');
  ss.getSheetByName('Sales').getRange('A:A').setNumberFormat('@');
  ss.getSheetByName('SaleLines').getRange('A:A').setNumberFormat('@');

  var existing = {};
  readAll_('Settings').forEach(function (r) { existing[r.key] = true; });
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
    if (!existing[k]) append_('Settings', { key: k, value: DEFAULT_SETTINGS[k] });
  });

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('API_KEY')) props.setProperty('API_KEY', Utilities.getUuid().replace(/-/g, ''));

  var sheet1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (sheet1 && sheet1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sheet1);

  Logger.log('API key: ' + props.getProperty('API_KEY'));
  return 'ตั้งค่าชีตเรียบร้อย — API key: ' + props.getProperty('API_KEY') + ' — ต่อไปรัน createOwner("ชื่อ", "PIN")';
}

/** Run from the editor to see the API key again (to set up a new device). */
function showApiKey() {
  var k = PropertiesService.getScriptProperties().getProperty('API_KEY');
  Logger.log('API key: ' + k);
  return k;
}

/** Run from the editor to issue a new key. Every device must then be set up again. */
function rotateApiKey() {
  var k = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('API_KEY', k);
  Logger.log('New API key: ' + k);
  return k;
}

/** Bump when SCHEMA gains sheets or columns; the next page load adds them (no need to re-run setup). */
var SCHEMA_VERSION = '8';

/** Create missing sheets and append missing header columns. Existing data is never moved. */
function ensureSchema_(ss, force) {
  var props = PropertiesService.getScriptProperties();
  var was = num_(props.getProperty('SCHEMA_VERSION'));
  if (!force && String(was) === SCHEMA_VERSION) return;
  ss = ss || ss_();
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var headers = SCHEMA[name];
    var current = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    if (current.join('') === '') sh.setFrozenRows(1);
    if (current.join('|') !== headers.join('|')) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    }
  });
  if (was < 3) migrateLots_();   // v3: FIFO lots — existing stock becomes an opening lot at its current cost
  props.setProperty('SCHEMA_VERSION', SCHEMA_VERSION);
}

/**
 * Run once from the editor to create the first owner account.
 * Example: createOwner('เจ้าของร้าน', '1234')
 */
function createOwner(name, pin) {
  return withLock_(function () {
    var owners = readAll_('Users').filter(function (u) { return u.role === 'owner' && bool_(u.active); });
    if (owners.length) throw new Error('มีบัญชีเจ้าของแล้ว — เพิ่มผู้ใช้อื่นจากหน้าตั้งค่า');
    return addUser_(name || 'เจ้าของร้าน', 'owner', String(pin || ''));
  });
}

/** Called by the client right after load. Tells it whether setup is complete. */
function api_status() {
  return respond_(function () {
    ensureSchema_();
    var users = readAll_('Users').filter(function (u) { return bool_(u.active); });
    return {
      ready: users.some(function (u) { return u.role === 'owner'; }),
      apiVersion: Number(SCHEMA_VERSION),
      users: users.map(function (u) { return { userId: u.userId, name: u.name, role: u.role, pinLen: num_(u.pinLen) || 0 }; }),   // pinLen lets the login screen sign in as soon as the PIN is complete
      settings: publicSettings_()
    };
  });
}

/** Log a "no sale" drawer opening (button on the sale screen). */
function api_logDrawer(token, reason) {
  return respond_(function () {
    var s = session_(token);
    log_(s, 'NO_SALE', '', String(reason || 'เปิดลิ้นชัก'));
    return true;
  });
}
