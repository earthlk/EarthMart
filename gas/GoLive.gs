/**
 * "เริ่มใช้งานจริง" — clear the test data once, before the shop starts using the program for real.
 *
 * Owner only, PIN again, typed phrase, a labelled backup copy first, and only once: afterwards
 * Settings.liveSince is set and the app no longer offers it. To run it again someone has to clear
 * liveSince in the Settings sheet by hand (or run goLiveAgainFromEditor()).
 */

var GO_LIVE_PHRASE = 'เริ่มใช้งานจริง';

/** Sheets whose rows are only test history. */
var GO_LIVE_CLEAR = ['Sales', 'SaleLines', 'Returns', 'ReturnLines', 'Shifts', 'CashMoves', 'StockMoves', 'Lots', 'LotUse',
                     'Receipts', 'Ledger', 'Expenses', 'Payables', 'CustPays', 'AuditLog'];
/** Cleared too when the products were only examples. */
var GO_LIVE_CATALOG = ['Products', 'Barcodes', 'Recipes', 'Promotions'];

function goLiveCounts_() {
  var out = {};
  GO_LIVE_CLEAR.concat(GO_LIVE_CATALOG).concat(['Devices']).forEach(function (n) { out[n] = readAll_(n).length; });
  return out;
}

function api_goLivePreview(token) {
  return respond_(function () {
    owner_(token);
    var devs = readAll_('Devices').filter(function (d) { return bool_(d.active); })
      .map(function (d) { return { deviceId: d.deviceId, name: d.name }; });
    return { liveSince: getSetting_('liveSince'), counts: goLiveCounts_(), devices: devs, phrase: GO_LIVE_PHRASE };
  });
}

/**
 * opts: { pin, phrase, clearCatalog: bool, keepDevices: [deviceId] }
 */
function api_goLive(token, opts) {
  return respond_(function () {
    var s = owner_(token);
    opts = opts || {};
    if (getSetting_('liveSince')) throw new Error('เริ่มใช้งานจริงไปแล้วเมื่อ ' + getSetting_('liveSince') + ' — ล้างซ้ำไม่ได้');
    if (String(opts.phrase || '').trim() !== GO_LIVE_PHRASE) throw new Error('พิมพ์คำยืนยันไม่ตรง');
    var me = readAll_('Users').filter(function (u) { return u.userId === s.userId; })[0];
    if (!me || hashPin_(String(opts.pin || ''), String(me.salt)) !== String(me.pinHash)) throw new Error('PIN ไม่ถูกต้อง');
    return withLock_(function () {
      if (getSetting_('liveSince')) throw new Error('เริ่มใช้งานจริงไปแล้ว');
      var before = goLiveCounts_();
      var backup = backupNow('ก่อนเริ่มใช้จริง');

      var sheets = GO_LIVE_CLEAR.slice();
      if (opts.clearCatalog) sheets = sheets.concat(GO_LIVE_CATALOG);
      sheets.forEach(clearRows_);

      // Stock starts from zero: the first count / receipt makes real lots with real costs.
      if (!opts.clearCatalog) {
        var sh = sheet_('Products'), col = SCHEMA.Products.indexOf('onHand') + 1, last = sh.getLastRow();
        if (last >= 2) sh.getRange(2, col, last - 1, 1).setValue(0);
      }

      var keep = {};
      (opts.keepDevices || []).forEach(function (id) { keep[String(id)] = true; });
      var devs = readAll_('Devices').filter(function (d) { return keep[String(d.deviceId)] && bool_(d.active); });
      clearRows_('Devices');
      if (devs.length) appendMany_('Devices', devs);

      // Header left over from an old version (returns used to split good / damaged).
      var rl = sheet_('ReturnLines');
      if (rl.getLastColumn() > SCHEMA.ReturnLines.length) rl.getRange(1, SCHEMA.ReturnLines.length + 1, 1, rl.getLastColumn() - SCHEMA.ReturnLines.length).clearContent();

      var today = fmtDate_(now_(), 'yyyy-MM-dd');
      saveSettingRaw_('liveSince', fmtDate_(now_(), 'yyyy-MM-dd HH:mm'));
      saveSettingRaw_('openingDone', '');   // opening stock can be set now
      saveSettingRaw_('openingActive', '');
      saveSettingRaw_('accStart', today);
      log_(s, 'GO_LIVE', backup, JSON.stringify({ cleared: sheets, before: before, keptDevices: devs.length }), '');
      return { liveSince: getSetting_('liveSince'), backup: backup, cleared: sheets, before: before };
    });
  });
}

/** Remove every data row, keep the header. */
function clearRows_(name) {
  var sh = sheet_(name), last = sh.getLastRow();
  if (last < 2) return;
  if (last < sh.getMaxRows()) sh.deleteRows(2, last - 1);
  else sh.getRange(2, 1, last - 1, sh.getMaxColumns()).clearContent();
}

/** Run by hand from the Apps Script editor only if the shop really has to start over again. */
function goLiveAgainFromEditor() {
  saveSettingRaw_('liveSince', '');
  return 'ปลดล็อกแล้ว — ปุ่ม "เริ่มใช้งานจริง" จะกลับมาในหน้าสำรองข้อมูล';
}
