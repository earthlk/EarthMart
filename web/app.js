(function () {
'use strict';

/* =================================================================== */
/* State & small helpers                                               */
/* =================================================================== */

var S = {
  status: null, token: null, user: null, deviceId: null, isCounter: false,
  settings: {}, products: [], barcodes: [], shift: null,
  idx: { bySku: {}, byBarcode: {}, byPlu: {} },
  view: 'login', loginUser: null, pin: '',
  cart: null, keyGroup: '', suggest: [], suggestOn: 0,
  prodSel: null, ed: null, billsDay: null, reportDay: null, stockFilter: { q: '', cat: '', low: false }, prodFilter: { q: '', cat: '' },
  lastActivity: Date.now(), busy: 0
};

var KEY_COLORS = {
  blue:   ['#E0F2FE', '#0369A1'], navy:  ['#DBEAFE', '#1D4ED8'], brown: ['#EDE4DC', '#3F2A1D'],
  orange: ['#FFEDD5', '#C2410C'], tan:   ['#F3E8DC', '#7C4A21'], red:   ['#FEE2E2', '#B91C1C'],
  green:  ['#E3F1E8', '#1F5A3A'], gray:  ['#EEF0EE', '#4B524E'], purple:['#EDE9FE', '#6D28D9']
};

/** Quick-key icons (24×24, stroke). Stored in Products.icon by key; old 2-letter text icons still work. */
var ICONS = {
  ice: ['น้ำแข็งแก้ว', '<path d="M6 4h12l-1.5 16a2 2 0 0 1-2 1.8h-5a2 2 0 0 1-2-1.8z"/><rect x="8.6" y="8.5" width="3.4" height="3.4" rx=".6"/><rect x="12.4" y="11.6" width="3.4" height="3.4" rx=".6"/>'],
  water: ['น้ำ+น้ำแข็ง', '<path d="M6 4h12l-1.5 16a2 2 0 0 1-2 1.8h-5a2 2 0 0 1-2-1.8z"/><path d="M7 9.5c1.6 1 3.2 1 5 0s3.4-1 5 0"/><rect x="10.3" y="12.5" width="3.4" height="3.4" rx=".6"/>'],
  iced: ['เครื่องดื่มเย็น', '<path d="M7.3 9h9.4l-1 10.9a1.4 1.4 0 0 1-1.4 1.3H9.7a1.4 1.4 0 0 1-1.4-1.3z" fill="currentColor" stroke="none" opacity=".6"/><path d="M6 4h12l-1.5 16a2 2 0 0 1-2 1.8h-5a2 2 0 0 1-2-1.8z"/><path d="M14 13V1.8l3-.8"/>'],
  cup: ['แก้วเปล่า', '<path d="M6 4h12l-1.5 16a2 2 0 0 1-2 1.8h-5a2 2 0 0 1-2-1.8z"/><path d="M6.4 8h11.2"/>'],
  hot: ['เครื่องดื่มร้อน', '<path d="M5 9h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8.5 3.5c-.8 1 .8 1.8 0 3M12 3.5c-.8 1 .8 1.8 0 3"/>'],
  bottle: ['ขวด', '<path d="M10 2h4v3l1.5 2.5V20a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V7.5L10 5z"/><path d="M8.5 11h7M8.5 16h7"/>'],
  can: ['กระป๋อง', '<rect x="7" y="4" width="10" height="17" rx="2"/><path d="M8 3h8M7 8h10M7 17h10"/>'],
  energy: ['เครื่องดื่มชูกำลัง', '<path d="M10 2h4v3l1.5 2.5V20a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V7.5L10 5z"/><path d="M12.6 10l-2 3.2h2.2l-1.4 3.4"/>'],
  noodle: ['บะหมี่/โจ๊ก', '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M8 11V4M11 11V3M14 11V4"/><path d="M9 21h6"/>'],
  snack: ['ขนมซอง', '<path d="M6 3h12l-1 3 1 3-1 3 1 3-1 3 1 3H6l1-3-1-3 1-3-1-3 1-3z"/><circle cx="12" cy="12" r="2.5"/>'],
  bread: ['ขนมปัง', '<path d="M5 10a4 4 0 0 1 2-7h10a4 4 0 0 1 2 7v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M9 12v4M12 11v5M15 12v4"/>'],
  food: ['อาหาร', '<path d="M3 13h18"/><path d="M5 13a7 7 0 0 1 14 0"/><path d="M12 6V4"/><path d="M4 17h16l-1 3H5z"/>'],
  pill: ['ยา', '<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="M9.4 8.3l5.2 7.4"/>'],
  lighter: ['ไฟแช็ก', '<rect x="7" y="10" width="10" height="12" rx="2"/><path d="M9 10V7h4v3"/><path d="M15 6.5c0-1.6 1.5-2.3 1.5-4 1 1 2 2.3 2 3.7a1.75 1.75 0 0 1-3.5.3z"/>'],
  tissue: ['ทิชชู่', '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M9 10c0-3 1.5-5 3-6 1.5 1 3 3 3 6"/><path d="M8 15h8"/>'],
  cable: ['สายชาร์จ', '<path d="M9 2v5M15 2v5"/><rect x="7" y="7" width="10" height="6" rx="2"/><path d="M12 13v3a4 4 0 0 1-4 4H6"/>'],
  box: ['ทั่วไป', '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>']
};

function iconSvg(key) {
  var ic = ICONS[key];
  if (!ic) return null;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ic[1] + '</svg>';
}

/** Icon chip for a product: SVG when icon is a known key, else up to 2 letters. */
function iconHtml(p) {
  return iconSvg(p.icon) || esc((p.icon || p.name || '?').slice(0, 2));
}
/** Product photo when there is one (loaded from this device), else the icon. Wrap in an element with data-pimg. */
function picHtml(p) { return p.image && S.imgUrl && S.imgUrl[p.image] ? '<img class="kimg" src="' + S.imgUrl[p.image] + '" alt="">' : iconHtml(p); }
function pimgAttr(p) { return p.image ? ' data-pimg="' + esc(p.image) + '"' : ''; }

function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function esc(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function money(n) { return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function round2(n) { return Math.round(n * 100) / 100; }
function today() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function timeOf(iso) { var d = new Date(iso); return isNaN(d) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function dateTime(iso) {
  var d = new Date(iso);
  if (isNaN(d)) return '';
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + (d.getFullYear() + 543) + ' ' + timeOf(iso);
}
function randomId(n) {
  var a = new Uint8Array(n || 12);
  (window.crypto || window.msCrypto).getRandomValues(a);
  return Array.prototype.map.call(a, function (b) { return 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]; }).join('');
}
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
function sstore(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }

function deviceId() {
  var id = store('em_device');
  if (!id) { id = 'D' + randomId(20); store('em_device', id); }
  return id;
}

/* =================================================================== */
/* Server calls                                                        */
/* =================================================================== */

/** Connection to the Apps Script API: saved per browser, or preset in config.js. */
function conn() {
  var saved = null;
  try { saved = JSON.parse(store('em_api') || 'null'); } catch (e) { saved = null; }
  var preset = window.EM_CONFIG || {};
  return saved && saved.url ? saved : { url: preset.apiUrl || '', key: preset.apiKey || '' };
}

/* ---------------- Offline outbox: work done on the counter while the internet is down ---------------- */
/*
 * Items: { kind: 'sale' | 'shift' | 'cash', id, at, error, pending, ... } sent in order when the server is back.
 * Each is signed with the PIN credentials of whoever did it, so it can be sent later by any session.
 */
function setOffline(v) {
  if (S.offline === v) return;
  S.offline = v;
  drawNetPill();
  markOfflineNav();
  if (!v) {
    if (S.user && !S.token) reauth();
    else if (outbox().length) setTimeout(function () { syncOutbox(); }, 500);
  }
}
function outbox() {
  try {
    return (JSON.parse(store('em_outbox') || '[]') || []).map(function (x) { if (!x.kind) { x.kind = 'sale'; x.id = x.saleUid; } return x; });
  } catch (e) { return []; }
}
function saveOutbox(list) { store('em_outbox', list.length ? JSON.stringify(list) : null); drawNetPill(); }
function outboxPut(item) { var l = outbox(); l.push(item); saveOutbox(l); }
function outboxPatch(id, fn) { var l = outbox(); l.forEach(function (x) { if (x.id === id) fn(x); }); saveOutbox(l); }

/** Sign an outbox item for the user doing it (and the owner who approved a discount). */
function signItem(id, uid, ownerUid) {
  return Promise.all([proofFor(uid, id), ownerUid ? proofFor(ownerUid, id) : null]).then(function (r) {
    outboxPatch(id, function (x) {
      x.pending = false;
      var by = r[0], ok = r[1];
      if (x.kind === 'sale') { if (by) x.sale.offlineBy = by; if (ok) x.sale.offlineApproval = ok; }
      else if (by) x.opt.offlineBy = by;
    });
  }, function () { outboxPatch(id, function (x) { x.pending = false; }); });
}

/** Keep the sale on this device; it is sent (idempotent by saleUid) as soon as the server can be reached. */
function queueSale(sale, rc, ownerUid) {
  outboxPut({ kind: 'sale', id: sale.saleUid, saleUid: sale.saleUid, sale: sale, rc: rc, at: sale.offlineAt, error: '', pending: true });
  signItem(sale.saleUid, S.user.userId, ownerUid);
}

function nextOffNo() {
  var n = Number(store('em_offno') || 0) + 1;
  store('em_offno', String(n));
  return 'OFF-' + String(n).padStart(4, '0');
}

/* Shift opened while offline: kept here until the server gives it a real id. */
function localShift() { try { return JSON.parse(store('em_offshift') || 'null'); } catch (e) { return null; } }
function shiftMap() { try { return JSON.parse(store('em_shiftmap') || '{}') || {}; } catch (e) { return {}; } }
function realShiftId(id) {
  if (!id || id.indexOf('OFS-') !== 0) return id;
  var real = shiftMap()[id];
  if (!real) throw new Error('กะที่เปิดตอนออฟไลน์ยังส่งไม่สำเร็จ');
  return real;
}

var syncing = false;
function syncOutbox(manual) {
  var list = outbox();
  if (syncing || !S.token || !list.length) return Promise.resolve();
  var c = conn();
  if (!c.url) return Promise.resolve();
  syncing = true; drawNetPill();
  var sent = 0, failed = 0;
  var todo = list.filter(function (x) { return !x.pending && (manual || !x.error); }).map(function (x) { return x.id; });
  var sendOne = function (item) {
    if (item.kind === 'shift') {
      return rawCall(c, 'openShift', [S.token, item.cash, '', item.opt]).then(function (sh) {
        var map = shiftMap(); map[item.localId] = sh.shiftId; store('em_shiftmap', JSON.stringify(map));
        if (S.shift && S.shift.shiftId === item.localId) S.shift = sh;
        store('em_offshift', null);
        saveCache();
      });
    }
    if (item.kind === 'cash') {
      var opt = Object.assign({}, item.opt, { shiftId: realShiftId(item.opt.shiftId) });
      return rawCall(c, 'cashMove', [S.token, item.type, item.amount, item.reason, opt]);
    }
    var sale = Object.assign({}, item.sale, { shiftId: realShiftId(item.sale.shiftId) });
    return rawCall(c, 'commitSale', [S.token, sale]);
  };
  var step = function (i) {
    if (i >= todo.length) return Promise.resolve();
    var item = outbox().filter(function (x) { return x.id === todo[i]; })[0];
    if (!item) return step(i + 1);
    return Promise.resolve().then(function () { return sendOne(item); }).then(function () {
      saveOutbox(outbox().filter(function (x) { return x.id !== item.id; }));
      sent++;
      return step(i + 1);
    }, function (e) {
      if (e.offline || /เข้าสู่ระบบ/.test(e.message)) throw e;
      outboxPatch(item.id, function (x) { x.error = e.message; });
      failed++;
      return step(i + 1);
    });
  };
  return step(0).catch(function () {}).then(function () {
    syncing = false; drawNetPill();
    if (sent) { toast('ส่งรายการที่ทำตอนออฟไลน์แล้ว ' + sent + ' รายการ'); if (S.view === 'bills' || S.view === 'shift') render(); }
    if (failed) toast('มีรายการค้างส่งไม่ผ่าน ' + failed + ' รายการ — แตะป้ายด้านบนเพื่อดู', true);
    if (sent && S.token && !outbox().length) reloadCatalog().then(function () { if (S.view === 'stock') render(); }).catch(function () {});
  });
}
setInterval(function () { if (outbox().length && navigator.onLine !== false && !S.offline) syncOutbox(); }, 20000);
// While offline, knock on the server now and then; the first answer brings everything back online.
setInterval(function () { if (S.offline) pingServer(); }, 15000);
window.addEventListener('online', function () { if (S.offline) pingServer(); else syncOutbox(); });
function pingServer() {
  var c = conn();
  if (!c.url) return;
  rawCall(c, 'status', []).then(function (st) { S.status = st; }).catch(function () {});
}

var STALE_MS = 60 * 60 * 1000;
function drawNetPill() {
  var el = $('#netpill');
  if (!el) return;
  var list = outbox(), n = list.length, bad = list.filter(function (x) { return x.error; }).length;
  var stale = list.some(function (x) { return Date.now() - new Date(x.at).getTime() > STALE_MS; });
  el.classList.toggle('hidden', !n && !S.offline);
  el.classList.toggle('bad', !!(S.offline || bad || stale));
  var what = list.every(function (x) { return x.kind === 'sale'; }) ? ' บิล' : ' รายการ';
  el.innerHTML = '<span class="dot"></span>' + (S.offline ? 'ออฟไลน์' : syncing ? 'กำลังส่ง…' : bad ? 'ส่งไม่ผ่าน' : stale ? 'ค้างส่ง' : 'รอส่ง') + (n ? ' · ' + n + what : '');
  el.title = stale ? 'มีรายการค้างส่งนานเกิน 1 ชั่วโมง — ตรวจอินเทอร์เน็ต' : 'รายการที่ทำตอนออฟไลน์';
}

function outboxRow(x) {
  if (x.kind === 'shift') return '<td class="num">' + dateTime(x.at) + '</td><td>เปิดกะ</td><td class="r num">' + money(x.cash) + '</td><td>เงินทอนตั้งต้น</td>';
  if (x.kind === 'cash') return '<td class="num">' + dateTime(x.at) + '</td><td>' + (x.type === 'IN' ? 'เงินเข้า' : 'เงินออก') + '</td><td class="r num">' + money(x.amount) + '</td><td>' + esc(x.reason) + '</td>';
  return '<td class="num">' + dateTime(x.at) + '</td><td>' + esc(x.rc.billNo || 'บิล') + '</td><td class="r num">' + money(x.rc.total) + '</td><td>' + payText(x.rc) + '</td>';
}

function outboxModal() {
  var list = outbox();
  var m = openModal('<header><h1>ทำตอนออฟไลน์ · รอส่ง</h1><span class="muted">' + list.length + ' รายการ · เก็บไว้ในเครื่องนี้</span></header><div class="body" style="gap:10px">' +
    (S.offline ? '<div class="banner">ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ขายต่อได้ตามปกติ จะส่งเองเมื่อเน็ตกลับมา</div>' : '') +
    (!S.offline && S.user && !S.token ? '<div class="banner">เน็ตกลับมาแล้ว — เข้าสู่ระบบอีกครั้งเพื่อส่งรายการ</div>' : '') +
    (list.length ? '<table class="table"><thead><tr><th>เวลา</th><th>รายการ</th><th class="r">ยอด</th><th>รายละเอียด</th><th>สถานะ</th><th></th></tr></thead><tbody>' + list.map(function (x) {
      return '<tr>' + outboxRow(x) + '<td>' +
        (x.error ? '<span class="warn-text">' + esc(x.error) + '</span>' : '<span class="tag amber">รอส่ง</span>') + '</td><td class="r">' +
        (x.error && S.user.role === 'owner' ? '<button class="btn sm" data-del="' + esc(x.id) + '">ลบออก</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table>' : '<div class="empty">ไม่มีรายการค้างส่ง</div>') +
    '<div class="muted" style="font-size:13px">ส่งอัตโนมัติเมื่อเชื่อมต่อได้ · รายการที่ส่งไม่ผ่าน (เช่น สินค้าถูกลบ) ให้เจ้าของตรวจแล้วลบออก · อย่าล้างข้อมูลเบราว์เซอร์ระหว่างมีรายการค้าง</div></div>' +
    '<footer><button class="btn" data-x="close">ปิด</button>' +
    (!S.offline && S.user && !S.token ? '<button class="btn primary" data-x="relog">เข้าสู่ระบบ</button>' :
      '<button class="btn primary" data-x="sync"' + (list.length ? '' : ' disabled') + '>ส่งตอนนี้</button>') + '</footer>');
  $('[data-x=close]', m).onclick = function () { closeModal(); };
  if ($('[data-x=relog]', m)) $('[data-x=relog]', m).onclick = function () { closeModal(); forceLogin(); };
  if ($('[data-x=sync]', m)) $('[data-x=sync]', m).onclick = function () {
    closeModal();
    (S.offline ? rawCall(conn(), 'status', []).catch(function () {}) : Promise.resolve()).then(function () {
      if (S.offline) return toast('ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — จะลองส่งเองเรื่อย ๆ', true);
      if (!S.token) return;   // reauth() takes over
      return syncOutbox(true).then(function () { if (outbox().length) outboxModal(); });
    });
  };
  m.addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]');
    if (!b) return;
    closeModal();
    confirm2('ลบรายการค้างส่ง', 'รายการนี้จะไม่ถูกบันทึกเข้าระบบ (เงินที่เกี่ยวข้องต้องปรับเองตอนปิดกะ)', 'ลบออก', true).then(function (ok) {
      if (ok) saveOutbox(outbox().filter(function (x) { return x.id !== b.getAttribute('data-del'); }));
      outboxModal();
    });
  });
}

/* ---------------- Full offline: shop data + PIN check kept on the counter ---------------- */
function sha256Hex(text) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (b) {
    return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  });
}
function offCreds() { try { return JSON.parse(store('em_pins') || '{}') || {}; } catch (e) { return {}; } }
function saveCred(c) { if (!c || !c.userId) return; var all = offCreds(); all[c.userId] = c; store('em_pins', JSON.stringify(all)); }
function dropCred(uid) { var all = offCreds(); delete all[uid]; store('em_pins', JSON.stringify(all)); }
/** Users removed or disabled on the server lose their offline sign-in here too. */
function pruneCreds(st) {
  if (!st || !st.users) return;
  var all = offCreds(), keep = {};
  st.users.forEach(function (u) { if (all[u.userId]) keep[u.userId] = all[u.userId]; });
  store('em_pins', JSON.stringify(keep));
}
function checkPinLocal(uid, pin) {
  var c = offCreds()[uid];
  if (!c || !window.crypto || !crypto.subtle) return Promise.resolve(false);
  return sha256Hex(c.salt + ':' + pin).then(function (h) { return h === c.hash ? c : false; });
}
function proofFor(uid, ref) {
  var c = offCreds()[uid];
  if (!c || !window.crypto || !crypto.subtle) return Promise.resolve(null);
  return sha256Hex(c.hash + ':' + ref).then(function (p) { return { userId: uid, proof: p }; });
}

if (window.EM_TEST) window.__S = S;   // tests only

function readCache() { try { return JSON.parse(store('em_cache') || 'null'); } catch (e) { return null; } }
var cacheTimer = null;
/** Last known shop data, so the counter can start and sell with no internet. Debounced unless now. */
function saveCache(now) {
  clearTimeout(cacheTimer);
  if (!now) { cacheTimer = setTimeout(function () { saveCache(true); }, 300); return; }
  if (!S.products || !S.status || !S.user) return;
  try {
    localStorage.setItem('em_cache', JSON.stringify({ at: new Date().toISOString(), status: S.status, boot: {
      isCounter: S.isCounter, settings: S.settings, shift: S.shift && !S.shift.offline ? S.shift : null, markdowns: S.markdowns, expiryTodo: S.expiryTodo, promos: S.promos || [], slides: S.slides || [],
      products: S.products, barcodes: S.barcodes, recipes: S.recipeRows || [] } }));
  } catch (e) { /* storage full: selling still works from memory */ }
}
window.addEventListener('pagehide', function () { if (cacheTimer) saveCache(true); });

/** Start the counter from the saved copy. False when this device has never loaded the shop online. */
function bootOffline(user) {
  var c = readCache();
  if (!c || !c.boot || !c.boot.products) return false;
  S.user = user; S.isCounter = !!c.boot.isCounter; S.settings = c.boot.settings || S.settings;
  S.shift = localShift() || c.boot.shift; S.markdowns = c.boot.markdowns || []; S.expiryTodo = c.boot.expiryTodo || 0; S.promos = c.boot.promos || []; S.slides = c.boot.slides || [];
  sstore('em_user', JSON.stringify(user));
  setCatalog(c.boot.products, c.boot.barcodes || [], c.boot.recipes || []);
  applyTheme();
  S.offline = true;
  newCart();
  cdPublish('idle');
  S.lastActivity = Date.now();
  go(S.isCounter && !S.shift ? 'shift' : 'sale');
  toast('ออฟไลน์ — ใช้ข้อมูลร้านที่เก็บไว้ในเครื่อง (' + dateTime(c.at) + ')');
  return true;
}

var offTries = { n: 0, until: 0 };
/** Sign in with no internet: only people who have signed in on this counter before. */
function offlineLogin(uid, pin) {
  if (Date.now() < offTries.until) return Promise.reject(new Error('ใส่ PIN ผิดหลายครั้ง รอ 5 นาทีแล้วลองใหม่'));
  if (!offCreds()[uid]) return Promise.reject(new Error('ออฟไลน์อยู่ — คนนี้ยังไม่เคยเข้าเครื่องนี้ ต้องต่อเน็ตก่อน'));
  return checkPinLocal(uid, pin).then(function (c) {
    if (!c) {
      if (++offTries.n >= 5) { offTries = { n: 0, until: Date.now() + 5 * 60000 }; }
      throw new Error('PIN ไม่ถูกต้อง');
    }
    offTries.n = 0;
    S.offlinePin = { uid: uid, pin: pin };   // memory only: used to get a real session once the internet is back
    S.token = null; sstore('em_token', null); sstore('em_offuser', uid);
    if (!bootOffline({ userId: c.userId, name: c.name, role: c.role })) throw new Error('เครื่องนี้ยังไม่มีข้อมูลร้าน — ต้องต่อเน็ตครั้งแรกก่อน');
  });
}

var reauthing = false;
/** Back online after an offline sign-in: get a real session, then send what was queued. */
function reauth() {
  if (reauthing || S.token) return;
  var c = conn();
  if (S.offlinePin && S.user && S.offlinePin.uid === S.user.userId) {
    reauthing = true;
    rawCall(c, 'login', [S.offlinePin.uid, S.offlinePin.pin, S.deviceId]).then(function (r) {
      S.token = r.token; S.user = r.user; sstore('em_token', r.token); sstore('em_user', JSON.stringify(r.user)); sstore('em_offuser', null);
      if (r.offline) saveCred(r.offline);
      S.offlinePin = null;
      toast('เน็ตกลับมาแล้ว');
      return syncOutbox().then(function () { return reloadCatalog(); }).then(function () { render(); });
    }, function (e) {
      if (!e.offline) { S.offlinePin = null; forceLogin('เน็ตกลับมาแล้ว — ' + e.message); }
    }).catch(function () {}).then(function () { reauthing = false; });
    return;
  }
  // Page was reloaded while offline, so the PIN is gone: ask for it when the cashier is free.
  if (!(S.cart && S.cart.lines.length) && !modalStack.length) forceLogin('เน็ตกลับมาแล้ว — ใส่ PIN อีกครั้งเพื่อส่งรายการที่ค้าง');
  else { drawNetPill(); toast('เน็ตกลับมาแล้ว — จบบิลนี้แล้วเข้าสู่ระบบใหม่เพื่อส่งรายการที่ค้าง'); }
}

/** Views that need the server (fresh data or changes that must be checked right away). */
var ONLINE_VIEWS = ['bills', 'products', 'stock', 'expiry', 'receive', 'reports', 'settings'];
function markOfflineNav() {
  $all('.topbar nav [data-v]').forEach(function (b) { b.classList.toggle('needs-net', !!S.offline && ONLINE_VIEWS.indexOf(b.getAttribute('data-v')) >= 0); });
}

/** Take what was just sold off the stock shown on this device (the server does the real count). */
function localDeduct(lines) {
  lines.forEach(function (l) {
    var pieces = l.qty * (l.multiplier || 1);
    var comps = S.recipes[l.sku];
    (comps && comps.length ? comps.map(function (c) { return { sku: c.sku, n: pieces * c.qty }; }) : [{ sku: l.sku, n: pieces }]).forEach(function (x) {
      var p = S.idx.bySku[x.sku];
      if (p) p.onHand = round2(Number(p.onHand || 0) - x.n);
    });
  });
  saveCache();
}

/** Warn (never block) when the bill takes more than the system thinks is on the shelf. */
function stockWarn(p) {
  if (!S.cart || !p) return;
  var need = {};
  S.cart.lines.forEach(function (l) {
    var pieces = l.qty * (l.multiplier || 1), comps = S.recipes[l.sku];
    (comps && comps.length ? comps.map(function (c) { return [c.sku, pieces * c.qty]; }) : [[l.sku, pieces]]).forEach(function (x) { need[x[0]] = (need[x[0]] || 0) + x[1]; });
  });
  var comps = S.recipes[p.sku];
  var skus = comps && comps.length ? comps.map(function (c) { return c.sku; }) : [p.sku];
  S.cart.warned = S.cart.warned || {};
  skus.forEach(function (sku) {
    var x = S.idx.bySku[sku];
    if (!x || S.cart.warned[sku]) return;
    var left = Number(x.onHand || 0);
    if (need[sku] > left) {
      S.cart.warned[sku] = true;
      toast('สต็อกในระบบของ ' + x.name + ' ' + (left > 0 ? 'เหลือแค่ ' + left : 'หมดแล้ว') + ' — ขายต่อได้ แจ้งเจ้าของตรวจสต็อก', true);
    }
  });
}

function rawCall(c, name, args) {
  var ctrl = window.AbortController ? new AbortController() : null;
  var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 45000);
  return fetch(c.url, {
    method: 'POST',
    // text/plain = "simple" request, so the browser skips the CORS preflight Apps Script can't answer
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ key: c.key, fn: name, args: args }),
    redirect: 'follow',
    signal: ctrl ? ctrl.signal : undefined
  }).then(function (r) {
    if (!r.ok) throw new Error('เซิร์ฟเวอร์ตอบกลับผิดพลาด (' + r.status + ')');
    return r.json().catch(function () { throw new Error('ตอบกลับไม่ใช่ข้อมูล — ตรวจว่า Deploy เป็น Web app สิทธิ์ "Anyone"'); });
  }, function (e) {
    var ne = new Error(e && e.name === 'AbortError' ? 'เซิร์ฟเวอร์ตอบช้าเกินไป ลองใหม่' : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจอินเทอร์เน็ต');
    ne.offline = true;
    setOffline(true);
    throw ne;
  }).then(function (res) {
    clearTimeout(timer);
    setOffline(false);
    if (res && res.ok) return res.data;
    var err = new Error(res && res.error ? res.error : 'เกิดข้อผิดพลาด');
    err.code = res && res.code;
    throw err;
  }, function (e) { clearTimeout(timer); throw e; });
}

function api(name) {
  var args = Array.prototype.slice.call(arguments, 1);
  var c = conn();
  if (!c.url) return Promise.reject(Object.assign(new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อ'), { code: 'NO_CONN' }));
  S.busy++; showBusy();
  return rawCall(c, name, args).then(function (d) { S.busy--; showBusy(); return d; }, function (e) {
    S.busy--; showBusy();
    if (e.code === 'BAD_KEY') { showConnect(e.message); throw e; }
    if (/เข้าสู่ระบบ/.test(e.message) && S.token) { forceLogin(e.message); }
    throw e;
  });
}

function showBusy() {
  var el = $('#busy');
  if (S.busy > 0 && !el) { el = document.createElement('div'); el.id = 'busy'; el.className = 'loading'; document.body.appendChild(el); }
  if (S.busy <= 0 && el) el.remove();
}

var toastTimer;
function toast(msg, isErr) {
  var el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.remove(); }, isErr ? 4500 : 2500);
}
function fail(e) { toast(e && e.message ? e.message : String(e), true); }

/* =================================================================== */
/* Modal                                                               */
/* =================================================================== */

var modalStack = [];
function openModal(html, opts) {
  opts = opts || {};
  var bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
  $('#modal-root').appendChild(bg);
  modalStack.push({ el: bg, onClose: opts.onClose });
  bg.addEventListener('mousedown', function (e) { if (e.target === bg && !opts.sticky) closeModal(); });
  var first = $('[autofocus]', bg) || $('input,select,textarea,button', bg);
  if (first) setTimeout(function () { first.focus(); if (first.select) first.select(); }, 30);
  return bg;
}
function closeModal() {
  var m = modalStack.pop();
  if (!m) return;
  m.el.remove();
  if (m.onClose) m.onClose();
  if (S.view === 'sale' && !modalStack.length) focusScan();
}
function closeAllModals() { while (modalStack.length) closeModal(); }
function topModal() { return modalStack.length ? modalStack[modalStack.length - 1].el : null; }

/** Ask a question with a text input. Resolves with the value or null. */
function prompt2(title, label, value, opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    var done = false;
    var m = openModal(
      '<header><h1>' + esc(title) + '</h1></header>' +
      '<form class="body" data-form="prompt">' +
      '<div class="field"><label for="p2">' + esc(label) + '</label>' +
      '<input id="p2" autofocus type="' + (opts.type || 'text') + '" ' + (opts.inputmode ? 'inputmode="' + opts.inputmode + '"' : '') +
      ' value="' + esc(value || '') + '" ' + (opts.step ? 'step="' + opts.step + '"' : '') + '></div>' +
      (opts.hint ? '<div class="muted" style="font-size:13px">' + esc(opts.hint) + '</div>' : '') +
      '</form><footer><button class="btn" data-x="cancel">ยกเลิก</button><button class="btn primary" data-x="ok">' + esc(opts.ok || 'ตกลง') + '</button></footer>',
      { onClose: function () { if (!done) resolve(null); } });
    var submit = function () { done = true; var v = $('#p2', m).value; closeModal(); resolve(v); };
    $('[data-x=ok]', m).onclick = submit;
    $('[data-x=cancel]', m).onclick = function () { closeModal(); };
    $('form', m).onsubmit = function (e) { e.preventDefault(); submit(); };
  });
}

function confirm2(title, text, okLabel, warn) {
  return new Promise(function (resolve) {
    var done = false;
    var m = openModal('<header><h1>' + esc(title) + '</h1></header><div class="body">' + esc(text) + '</div>' +
      '<footer><button class="btn" data-x="no">ยกเลิก</button><button class="btn ' + (warn ? 'warn' : 'primary') + '" data-x="yes">' + esc(okLabel || 'ยืนยัน') + '</button></footer>',
      { onClose: function () { if (!done) resolve(false); } });
    $('[data-x=yes]', m).onclick = function () { done = true; closeModal(); resolve(true); };
    $('[data-x=no]', m).onclick = function () { closeModal(); };
  });
}

/**
 * Owner approval. Owners approve themselves (resolves ''), cashiers get a PIN pad for the owner.
 * Resolves with approvalId, or null when cancelled.
 */
function approval(action, title) {
  if (S.user && S.user.role === 'owner') return Promise.resolve('');
  if ((S.offline || !S.token) && action !== 'DISCOUNT') { toast('ต้องต่อเน็ตก่อน', true); return Promise.resolve(null); }
  return new Promise(function (resolve) {
    var done = false;
    var m = openModal('<header><h1>' + esc(title || 'ต้องให้เจ้าของอนุมัติ') + '</h1></header>' +
      '<form class="body"><div class="field"><label for="apin">PIN เจ้าของร้าน</label>' +
      '<input id="apin" type="password" inputmode="numeric" autocomplete="off" maxlength="6" autofocus class="big-input" style="text-align:center"></div></form>' +
      '<footer><button class="btn" data-x="no">ยกเลิก</button><button class="btn primary" data-x="yes">อนุมัติ</button></footer>',
      { onClose: function () { if (!done) resolve(null); } });
    var offlineOk = function (pin) {
      // Offline: check against owners who have signed in (or approved) on this counter before.
      var owners = Object.keys(offCreds()).map(function (k) { return offCreds()[k]; }).filter(function (c) { return c.role === 'owner'; });
      if (!owners.length) return Promise.reject(new Error('ออฟไลน์อยู่ — เจ้าของยังไม่เคยเข้าเครื่องนี้ อนุมัติไม่ได้'));
      return Promise.all(owners.map(function (o) { return checkPinLocal(o.userId, pin); })).then(function (r) {
        var o = r.filter(Boolean)[0];
        if (!o) throw new Error('PIN เจ้าของไม่ถูกต้อง');
        return { approvalId: 'OFF:' + o.userId, ownerName: o.name };
      });
    };
    var go = function () {
      var pin = $('#apin', m).value;
      (S.offline || !S.token ? offlineOk(pin) : api('approve', S.token, pin, action).then(function (r) { if (r.offline) saveCred(r.offline); return r; }, function (e) {
        if (e.offline && action === 'DISCOUNT') return offlineOk(pin);
        throw e;
      })).then(function (r) {
        done = true; closeModal(); toast('อนุมัติโดย ' + r.ownerName); resolve(r.approvalId);
      }).catch(function (e) { fail(e); $('#apin', m).value = ''; $('#apin', m).focus(); });
    };
    $('[data-x=yes]', m).onclick = go;
    $('[data-x=no]', m).onclick = function () { closeModal(); };
    $('form', m).onsubmit = function (e) { e.preventDefault(); go(); };
  });
}

/* =================================================================== */
/* Theme                                                               */
/* =================================================================== */

function applyTheme() {
  var local = store('em_theme') || '';
  var theme = local || S.settings.theme || 'light';
  if (theme === 'system') theme = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  var palette = S.settings.palette || 'forest';
  document.documentElement.className = 'ui' + (theme === 'dark' ? ' dark' : '') + ' p-' + palette;
}

/* =================================================================== */
/* Boot / login                                                        */
/* =================================================================== */

function start() {
  if (/[?&]kiosk=1\b/.test(location.search)) kioskFullscreen();
  if (window.CustomerDisplay && CustomerDisplay.isDisplay) return CustomerDisplay.startDisplay();
  S.deviceId = deviceId();
  readConnectLink();
  if ('serviceWorker' in navigator && window.isSecureContext && !window.EM_NO_SW) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  api('status').then(function (st) {
    S.status = st;
    S.settings = st.settings || {};
    pruneCreds(st);
    applyTheme();
    var saved = sstore('em_token');
    if (saved) {
      S.token = saved;
      return boot().catch(function () { S.token = null; sstore('em_token', null); showLogin(); });
    }
    showLogin();
  }).catch(function (e) {
    if (e.code === 'NO_CONN' || e.code === 'BAD_KEY') return showConnect(e.code === 'BAD_KEY' ? e.message : '');
    var c = e.offline ? readCache() : null;
    if (c && c.status) {
      // No internet: start from what this counter saved last time.
      S.status = c.status; S.settings = c.status.settings || {}; S.offline = true;
      applyTheme();
      var user = null;
      try { user = JSON.parse(sstore('em_user') || 'null'); } catch (x) { user = null; }
      if (user && (sstore('em_token') || sstore('em_offuser') === user.userId)) {
        S.token = sstore('em_token') || null;
        if (bootOffline(user)) return;
      }
      return showLogin();
    }
    $('#app').innerHTML = '<div class="center"><div class="card pad col" style="max-width:520px;gap:10px"><h2>ยังใช้งานไม่ได้</h2><p>' + esc(e.message) +
      '</p><div class="row"><button class="btn primary" data-act="reload">ลองใหม่</button><button class="btn" data-act="connect">ตั้งค่าการเชื่อมต่อ</button></div></div></div>';
  });
}

/**
 * Opened by the shop launcher with ?kiosk=1 (a window Chrome could not start in true kiosk mode):
 * go full screen on the first touch / key (browsers only allow it after one), and block the right-click menu.
 */
function kioskFullscreen() {
  // Full screen on the screen the window is on. (The launcher moves the sale window to the main screen
  // itself: pages opened from a file cannot keep the "manage windows" permission, Chrome asks every time.)
  var go = function () {
    var el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(function () {});
  };
  ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, go, true); });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}

/** Apps Script schema version this page needs (api_status.apiVersion). */
var API_NEEDED = 5;

/** Pull { url, key } out of a pasted setup link (or just its #connect=… part). */
function parseConnectLink(text) {
  var m = /#?connect=([^&\s]+)/.exec(String(text || ''));
  if (!m) return null;
  try { var c = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))); return c.url && c.key ? c : null; } catch (e) { return null; }
}

/** A setup link looks like  https://<site>/#connect=<base64 of {"url":"...","key":"..."}>  */
function readConnectLink() {
  var m = /#connect=([^&]+)/.exec(location.hash || '');
  if (!m) return;
  try {
    var c = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
    if (c.url && c.key) store('em_api', JSON.stringify({ url: c.url, key: c.key }));
  } catch (e) { /* ignore a broken link */ }
  history.replaceState(null, '', location.pathname + location.search);
}

function connectLink() {
  var c = conn();
  return location.origin + location.pathname + '#connect=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify({ url: c.url, key: c.key })))));
}

function showConnect(msg) {
  S.view = 'connect';
  var c = conn();
  $('#app').innerHTML = '<header class="topbar"><span class="brand">EarthMart</span></header>' +
    '<div class="center"><form class="card pad col" data-form="connect" style="width:min(560px,100%);gap:12px">' +
    '<h2>เชื่อมต่อกับร้าน</h2><div class="muted" style="font-size:14px">ตั้งครั้งเดียวต่อเครื่อง · ค่าทั้งสองได้จากขั้นตอน Deploy ในคู่มือ ' +
    'หรือเปิด "ลิงก์ตั้งค่าเครื่อง" จากหน้าตั้งค่าของเครื่องที่ใช้งานอยู่แล้ว</div>' +
    (msg ? '<div class="banner" style="border-radius:8px">' + esc(msg) + '</div>' : '') +
    '<div class="field"><label for="c-link">วาง "ลิงก์ตั้งค่าเครื่อง" (ง่ายสุด)</label><input id="c-link" data-input="connectLink" placeholder="https://…#connect=…" autocomplete="off"></div>' +
    '<div class="muted" style="font-size:12px;text-align:center">— หรือใส่เอง —</div>' +
    '<div class="field"><label for="c-url">Web app URL (ลงท้าย /exec)</label><input id="c-url" value="' + esc(c.url) + '" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></div>' +
    '<div class="field"><label for="c-key">API key</label><input id="c-key" value="' + esc(c.key) + '" autocomplete="off"></div>' +
    '<button class="btn primary lg" type="submit">ทดสอบและบันทึก</button></form></div>';
}

function saveConnect() {
  var c = { url: $('#c-url').value.trim(), key: $('#c-key').value.trim() };
  if (!/^https:\/\/\S+$/.test(c.url)) return toast('URL ต้องขึ้นต้นด้วย https://', true);
  if (!c.key) return toast('ใส่ API key', true);
  S.busy++; showBusy();
  rawCall(c, 'status', []).then(function () {
    S.busy--; showBusy();
    store('em_api', JSON.stringify(c));
    toast('เชื่อมต่อสำเร็จ');
    start();
  }).catch(function (e) { S.busy--; showBusy(); fail(e); });
}

function showLogin(msg) {
  S.view = 'login';
  S.pin = '';
  if (!S.loginUser && S.status && S.status.users.length === 1) S.loginUser = S.status.users[0].userId;
  render();
  if (msg) toast(msg, true);
}

function forceLogin(msg) {
  S.token = null; S.user = null; S.offlinePin = null; sstore('em_token', null); sstore('em_user', null); sstore('em_offuser', null);
  closeAllModals();
  showLogin(msg);
}

function renderLogin() {
  var st = S.status || { users: [], ready: false };
  if (!st.ready) {
    return '<div class="center"><div class="card pad" style="max-width:560px"><h2>ยังไม่มีบัญชีเจ้าของร้าน</h2>' +
      '<p>เปิด Apps Script แล้วรันฟังก์ชัน <b>setup</b> และ <b>createOwner("ชื่อ", "PIN")</b> ตามคู่มือ จากนั้นรีเฟรชหน้านี้</p></div></div>';
  }
  var creds = S.offline ? offCreds() : null;
  var users = st.users.map(function (u) {
    var cant = creds && !creds[u.userId];
    return '<button type="button" data-act="pickUser" data-id="' + esc(u.userId) + '" class="' + (S.loginUser === u.userId ? 'on' : '') + (cant ? ' needs-net' : '') + '"' +
      (cant ? ' title="ยังไม่เคยเข้าเครื่องนี้ — ต้องต่อเน็ต"' : '') + '>' +
      '<span class="avatar">' + esc(initial(u.name)) + '</span><span class="col" style="gap:0"><b>' + esc(u.name) + '</b>' +
      '<span class="muted" style="font-size:13px">' + (u.role === 'owner' ? 'เจ้าของ' : 'แคชเชียร์') + '</span></span></button>';
  }).join('');
  var who = st.users.filter(function (u) { return u.userId === S.loginUser; })[0];
  var len = pinLenOf(who);
  var dots = '';
  for (var i = 0; i < (len || 6); i++) dots += '<span class="' + (i < S.pin.length ? 'on' : '') + '"></span>';
  var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'].map(function (k) {
    if (k === 'clr') return '<button type="button" data-act="pinKey" data-k="clr" style="font-size:15px">ล้าง</button>';
    if (k === 'del') return '<button type="button" data-act="pinKey" data-k="del" style="font-size:20px" aria-label="ลบ">⌫</button>';
    return '<button type="button" data-act="pinKey" data-k="' + k + '">' + k + '</button>';
  }).join('');
  return '<header class="topbar"><span class="brand">' + esc(S.settings.shopName || 'EarthMart') + '</span><span class="grow"></span>' +
    '<span class="meta">' + (S.isCounter ? 'เครื่องหน้าร้าน' : 'เครื่องนี้ยังไม่ได้ลงทะเบียน') + '</span></header>' +
    (S.offline ? '<div class="banner warn">ออฟไลน์ — เข้าได้เฉพาะคนที่เคยเข้าเครื่องนี้แล้ว · ขายได้ตามปกติ รายการจะส่งเองเมื่อเน็ตกลับมา</div>' : '') +
    '<div class="center"><div class="card login"><div class="users"><h2 style="margin:0 0 6px">เลือกผู้ใช้</h2>' + users + '</div>' +
    '<div class="pin"><div class="muted">' + (who ? 'ใส่ PIN ของ ' + esc(who.name) : 'เลือกผู้ใช้ก่อน') + '</div>' +
    '<div class="dots' + (S.loginBusy ? ' busy' : '') + '">' + dots + '</div><div class="pinpad">' + keys + '</div>' +
    '<div class="muted" style="font-size:13px">' + (S.loginBusy ? 'กำลังเข้าสู่ระบบ…' : 'ใส่ PIN ครบแล้วเข้าให้เอง · พิมพ์จากคีย์บอร์ดได้') + '</div></div></div></div>';
}

/** PIN length of a user (0 = not known yet: older users until their first sign-in on the new version). */
function pinLenOf(u) { return u && u.pinLen >= 4 && u.pinLen <= 6 ? u.pinLen : 0; }

var pinTimer = null;
function pinKey(k) {
  if (!S.loginUser) return toast('เลือกผู้ใช้ก่อน', true);
  if (S.loginBusy) return;
  clearTimeout(pinTimer);
  if (k === 'del') S.pin = S.pin.slice(0, -1);
  else if (k === 'clr') S.pin = '';
  else if (k === 'ok') { if (S.pin.length >= 4) return doLogin(); return; }
  else if (S.pin.length < 6) S.pin += k;
  render();
  var who = (S.status.users || []).filter(function (u) { return u.userId === S.loginUser; })[0];
  var len = pinLenOf(who);
  // Sign in as soon as the PIN is complete. Length unknown: at 6 digits, or after a short pause from 4 digits.
  if (len ? S.pin.length === len : S.pin.length === 6) doLogin();
  else if (!len && S.pin.length >= 4) pinTimer = setTimeout(doLogin, 1200);
}

function doLogin() {
  clearTimeout(pinTimer);
  if (S.pin.length < 4 || S.loginBusy) return;
  var pin = S.pin, uid = S.loginUser;
  S.loginBusy = true; render();
  var failed = function (e) { S.loginBusy = false; S.pin = ''; render(); shakeDots(); fail(e); };
  var offline = function () { return offlineLogin(uid, pin).then(function () { S.loginBusy = false; S.pin = ''; }, failed); };
  if (S.offline) return offline();
  api('login', uid, pin, S.deviceId).then(function (r) {
    S.loginBusy = false;
    S.token = r.token; S.user = r.user;
    sstore('em_token', r.token); sstore('em_user', JSON.stringify(r.user)); sstore('em_offuser', null);
    if (r.offline) saveCred(r.offline);
    S.offlinePin = null;
    var u = (S.status.users || []).filter(function (x) { return x.userId === uid; })[0];
    if (u) u.pinLen = pin.length;
    return boot();
  }).catch(function (e) {
    if (e.offline) return offline();
    // PIN changed on the server: the copy on this counter is out of date.
    if (/PIN ไม่ถูกต้อง/.test(e.message)) checkPinLocal(uid, pin).then(function (c) { if (c) dropCred(uid); });
    failed(e);
  });
}

function shakeDots() {
  var d = $('.login .dots');
  if (!d) return;
  d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake');
}

function boot() {
  return api('bootstrap', S.token).then(function (d) {
    S.user = d.user; S.isCounter = d.isCounter; S.settings = d.settings; S.shift = d.shift || localShift();
    sstore('em_user', JSON.stringify(d.user));
    S.markdowns = d.markdowns || []; S.expiryTodo = d.expiryTodo || 0; S.promos = d.promos || []; S.slides = d.slides || [];
    setTimeout(syncSlides, 2500);
    setTimeout(syncImages, 4000);
    if (outbox().length) setTimeout(function () { syncOutbox(); }, 1500);
    setCatalog(d.products, d.barcodes, d.recipes);
    saveCache(true);
    applyTheme();
    newCart();
    cdPublish('idle');
    S.lastActivity = Date.now();
    go(S.isCounter && !S.shift ? 'shift' : 'sale');
  });
}

function logout() {
  if (S.cart && S.cart.lines.length) return toast('มีบิลค้างอยู่ — ชำระ พัก หรือล้างบิลก่อนออก', true);
  var t = S.token;
  forceLogin();
  if (t) api('logout', t).catch(function () {});
}

/* =================================================================== */
/* Catalog index                                                       */
/* =================================================================== */

function setCatalog(products, barcodes, recipes) {
  S.products = products;
  S.recipeRows = recipes || [];
  S.recipes = {};
  (recipes || []).forEach(function (r) { (S.recipes[r.sku] = S.recipes[r.sku] || []).push({ sku: r.componentSku, qty: r.qty }); });
  S.barcodes = barcodes;
  var bySku = {}, byBarcode = {}, byPlu = {};
  products.forEach(function (p) { bySku[p.sku] = p; if (p.plu && p.active && p.forSale !== false) byPlu[p.plu] = p; });
  barcodes.forEach(function (b) { if (bySku[b.sku] && bySku[b.sku].active) byBarcode[b.barcode] = b; });
  S.idx = { bySku: bySku, byBarcode: byBarcode, byPlu: byPlu };
}

function reloadCatalog() {
  return api('bootstrap', S.token).then(function (d) {
    setCatalog(d.products, d.barcodes, d.recipes); S.shift = d.shift || localShift(); S.markdowns = d.markdowns || []; S.expiryTodo = d.expiryTodo || 0; S.promos = d.promos || []; S.slides = d.slides || [];
    S.isCounter = d.isCounter; S.settings = d.settings || S.settings;
    saveCache(true);
  });
}

function categories() {
  var seen = {};
  S.products.forEach(function (p) { if (p.category) seen[p.category] = true; });
  return Object.keys(seen).sort();
}

/* =================================================================== */
/* Navigation & frame                                                  */
/* =================================================================== */

var NAV = [
  ['sale', 'ขาย'], ['bills', 'บิล'], ['products', 'สินค้า'], ['stock', 'สต็อก'], ['expiry', 'หมดอายุ'], ['receive', 'รับสินค้า'],
  ['shift', 'กะ'], ['reports', 'รายงาน', 'owner'], ['settings', 'ตั้งค่า', 'owner']
];

function go(view) {
  if (isMobile() && (view === 'sale' || view === 'shift')) view = 'home';
  if (view === 'home' && !isMobile()) view = S.isCounter && !S.shift ? 'shift' : 'sale';
  if (view === 'sale' && S.isCounter && !S.shift) view = 'shift';
  if ((S.offline || !S.token) && ONLINE_VIEWS.indexOf(view) >= 0) return toast('หน้านี้ต้องต่อเน็ต — ตอนออฟไลน์ใช้ได้เฉพาะ ขาย และ กะ', true);
  S.view = view;
  render();
  if (view === 'bills') loadBills();
  if (view === 'products') { if (S.promoMode) loadPromos(); else if (S.labelMode) drawLabItems(); else renderProductRows(); }
  if (view === 'stock') loadStock();
  if (view === 'receive') loadReceive();
  if (view === 'expiry') { S.expSel = null; loadExpiry(); }
  if (view !== 'reports') killCharts();
  if (view === 'shift') { S.denFocus = null; S.shiftSum = null; denomRefresh(S.shift ? 'c' : 'o'); }
  if (view === 'shift' && S.shift) loadShift();
  if (view === 'reports') loadReport();
  if (view === 'settings') loadSettings();
  if (view === 'home') loadHome();
}

function frame(inner) {
  if (isMobile()) return mobileFrame(inner);
  var nav = NAV.filter(function (n) { return !n[2] || (S.user && S.user.role === n[2]); }).map(function (n) {
    return '<button data-act="go" data-v="' + n[0] + '" class="' + (S.view === n[0] ? 'on' : '') + '">' + n[1] +
      (n[0] === 'expiry' ? '<span class="badge">' + (S.expiryTodo || '') + '</span>' : '') + '</button>';
  }).join('');
  var shiftTxt = S.shift ? 'กะเปิด ' + timeOf(S.shift.openedAt) : (S.isCounter ? 'ยังไม่เปิดกะ' : 'ไม่ใช่เครื่องหน้าร้าน');
  var role = S.user && S.user.role === 'owner' ? 'เจ้าของ' : 'แคชเชียร์';
  var old = S.status && !(Number(S.status.apiVersion) >= API_NEEDED);
  var banner = old ? '<div class="banner warn">Apps Script ที่ใช้อยู่เป็นเวอร์ชันเก่า — ฟีเจอร์ใหม่ (ล็อต FIFO, รับสินค้า, หมดอายุ, เบิกใช้, แบ่งจ่าย, คืนสินค้า) ยังใช้ไม่ได้ · ' +
    'วางไฟล์ EarthMart-AppsScript.gs ล่าสุดทับโค้ดเดิม แล้ว Deploy › Manage deployments › New version</div>' : '';
  banner += !S.isCounter ? '<div class="banner">เครื่องนี้ยังไม่ได้ลงทะเบียนเป็นเครื่องหน้าร้าน — ขายและเปิดกะไม่ได้' +
    (S.user && S.user.role === 'owner' ? ' · <a href="#" data-act="go" data-v="settings">ลงทะเบียนในหน้าตั้งค่า</a>' : ' · ให้เจ้าของลงทะเบียนในหน้าตั้งค่า') + '</div>' : '';
  return '<header class="topbar"><span class="brand">' + esc(S.settings.shopName || 'EarthMart') + '</span><nav>' + nav + '</nav>' +
    '<span class="grow"></span><span class="meta">' + shiftTxt + ' · ' + role + ': ' + esc(S.user ? S.user.name : '') + '</span>' +
    (S.shift && S.isCounter ? '<button class="btn" data-act="cashMoveModal">เงินเข้า/ออก</button>' : '') +
    '<button class="netpill hidden" id="netpill" data-act="outbox" title="บิลที่ขายตอนออฟไลน์"></button>' +
    (S.isCounter ? '<button class="btn" data-act="openCustomer" id="cdbtn" title="เปิดจอลูกค้าบนจอที่ 2"><span class="dot' +
      (window.CustomerDisplay && CustomerDisplay.pos.connected() ? ' on' : '') + '"></span>จอลูกค้า</button>' : '') +
    '<button class="btn" data-act="logout">ออก</button></header>' + banner + inner;
}

function render() {
  var html;
  switch (S.view) {
    case 'login': html = renderLogin(); break;
    case 'sale': html = frame(renderSale()); break;
    case 'home': html = frame(renderHome()); break;
    case 'bills': html = frame(renderBills()); break;
    case 'products': html = frame(renderProducts()); break;
    case 'stock': html = frame(renderStock()); break;
    case 'receive': html = frame(renderReceive()); break;
    case 'expiry': html = frame(renderExpiry()); break;
    case 'shift': html = frame(renderShift()); break;
    case 'reports': html = frame(renderReports()); break;
    case 'settings': html = frame(renderSettings()); break;
    default: html = '';
  }
  $('#app').innerHTML = html;
  $('#app').classList.toggle('m', isMobile() && S.view !== 'login');
  fillImages();
  drawNetPill();
  markOfflineNav();
  if (S.view === 'sale') focusScan();
}

/* =================================================================== */
/* Phone layout: bottom tabs, no selling (that stays on the counter)   */
/* =================================================================== */

var phoneMq = window.matchMedia ? matchMedia('(max-width: 767px)') : null;
/** Phone screen on a device that is not a registered counter. */
function isMobile() { return !!(phoneMq && phoneMq.matches) && !S.isCounter; }
var wasMobile = null;
window.addEventListener('resize', function () {
  var m = isMobile();
  if (wasMobile === null) { wasMobile = m; return; }
  if (m === wasMobile || !S.user || S.view === 'login') return;
  wasMobile = m;
  go(m ? 'home' : S.view);
});

var M_TABS = [['home', 'หน้าหลัก', 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z'], ['bills', 'บิล', 'M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4'],
  ['stock', 'สต็อก', 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10'], ['products', 'สินค้า', 'M4 4h7l9 9-7 7-9-9zM8 8h.01'],
  ['reports', 'รายงาน', 'M4 20V10M10 20V4M16 20v-7M22 20H2', 'owner']];
var M_TITLE = { home: '', bills: 'บิล', stock: 'สต็อก', receive: 'สต็อก', expiry: 'สต็อก', products: 'สินค้า', reports: 'รายงาน', settings: 'ตั้งค่า' };

function mobileFrame(inner) {
  var at = S.view === 'receive' || S.view === 'expiry' ? 'stock' : S.view;
  var tabs = M_TABS.filter(function (t) { return !t[3] || (S.user && S.user.role === t[3]); }).map(function (t) {
    return '<button data-act="go" data-v="' + t[0] + '" class="' + (at === t[0] ? 'on' : '') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + t[2] + '"/></svg>' + t[1] +
      (t[0] === 'stock' && S.expiryTodo ? '<span class="badge">' + S.expiryTodo + '</span>' : '') + '</button>';
  }).join('');
  var seg = '';
  if (at === 'stock') {
    var cur = S.view === 'stock' ? (S.stockTab === 'count' ? 'count' : 'list') : S.view;
    seg = '<div class="mseg">' + [['list', 'คงเหลือ'], ['count', 'ตรวจนับ'], ['receive', 'รับสินค้า'], ['expiry', 'หมดอายุ']].map(function (x) {
      return '<button data-act="mStock" data-t="' + x[0] + '" class="' + (cur === x[0] ? 'on' : '') + '">' + x[1] +
        (x[0] === 'expiry' && S.expiryTodo ? ' <span class="badge">' + S.expiryTodo + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  var title = M_TITLE[S.view] !== undefined ? M_TITLE[S.view] : '';
  return '<header class="topbar mtop">' + (title ? '<b class="mtitle">' + title + '</b>' : '<span class="brand">' + esc(S.settings.shopName || 'EarthMart') + '</span>') +
    '<span class="grow"></span><button class="netpill hidden" id="netpill" data-act="outbox"></button>' +
    '<button class="mwho" data-act="logout" title="ออกจากระบบ"><span class="avatar">' + esc(initial(S.user ? S.user.name : '')) + '</span>ออก</button></header>' +
    seg + inner + '<nav class="tabbar">' + tabs + '</nav>';
}

/** First letter for an avatar, skipping Thai leading vowels (เ แ โ ใ ไ). */
function initial(name) { var m = /[^\u0E40-\u0E44\s]/.exec(String(name || '')); return m ? m[0] : ''; }

function renderHome() {
  var owner = S.user.role === 'owner';
  var low = (S.products || []).filter(function (p) { return p.active && p.type !== 'recipe' && p.minStock > 0 && p.onHand <= p.minStock; }).length;
  var tile = function (act, v, label, sub, warn) {
    return '<button class="mtile' + (warn ? ' warn' : '') + '" data-act="' + act + '" ' + v + '><b>' + label + '</b><span>' + sub + '</span></button>';
  };
  var lock = function (t) { return '<div class="mlock"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4"/></svg>' + t + '</div>'; };
  return '<div class="page mhome">' +
    '<div class="muted" style="font-size:13px">' + esc(S.user.name) + ' · ' + (owner ? 'เจ้าของ' : 'แคชเชียร์') + ' · มือถือ</div>' +
    (owner ? '<button class="card pad mtoday" data-act="go" data-v="reports" id="mtoday"><span class="muted">ยอดขายวันนี้</span><b class="num">฿—</b><span class="muted" id="mtoday-sub">กำลังโหลด…</span></button>' : '') +
    (S.expiryTodo ? '<button class="card pad mexp" data-act="go" data-v="expiry"><b>สินค้าหมดอายุ ' + S.expiryTodo + ' ล็อต</b><span>แตะเพื่อจัดการ ›</span></button>' : '') +
    '<h3 class="mh">ทางลัด</h3><div class="mtiles">' +
    tile('mStock', 'data-t="count"', 'ตรวจนับสต็อก', 'สแกนด้วยกล้องได้') +
    tile('mStock', 'data-t="receive"', 'รับสินค้าเข้า', 'เพิ่มล็อตใหม่') +
    tile('mStock', 'data-t="list"', 'ของใกล้หมด', low ? low + ' รายการ' : 'ไม่มี', low > 0) +
    tile('go', 'data-v="bills"', 'ดูบิล', 'ค้นหาเลขบิล') +
    (owner ? tile('mPromo', '', 'โปรโมชั่น', (S.promos || []).length ? S.promos.length + ' รายการที่เปิดอยู่' : 'ยังไม่มี') + tile('mBulk', '', 'แก้ราคาหลายรายการ', '± % หรือบาท') + tile('go', 'data-v="settings"', 'ตั้งค่า', 'ร้าน · ผู้ใช้ · ธีม') : '') +
    '</div><h3 class="mh">ใช้ได้เฉพาะเครื่องหน้าร้าน</h3><div class="card mlocks">' +
    lock('ขาย / รับเงิน') + lock('เปิด / ปิดกะ') + lock('ยกเลิกบิล / คืนสินค้า') + lock('เงินเข้า-ออกลิ้นชัก') + '</div></div>';
}

function loadHome() {
  if (S.user.role !== 'owner' || S.offline || !S.token) return;
  api('report', S.token, { from: today(), to: today() }).then(function (d) {
    var box = $('#mtoday');
    if (!box || !d.summary) return;
    var sm = d.summary;
    $('b', box).textContent = '฿' + money(sm.net);
    $('#mtoday-sub').textContent = sm.bills + ' บิล · กำไรขั้นต้น ฿' + money(sm.profit) + ' ›';
  }).catch(function () { var x = $('#mtoday-sub'); if (x) x.textContent = 'โหลดไม่ได้'; });
}

/* ---------------- Camera barcode scanning (phones) ---------------- */
function camBtn(target) {
  if (!isMobile() || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return '';
  return '<button type="button" class="btn cam" data-act="camScan" data-for="' + target + '" aria-label="สแกนด้วยกล้อง"><svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M7 9v6M10 9v6M13 9v6M16 9v6"/></svg></button>';
}

/** Feed a barcode read by the camera to the field it was opened for. */
function camDeliver(target, code) {
  if (target === 'cscan') return cntScan(code);
  if (target === 'rscan') { if (!rcScan(code)) toast('ไม่พบสินค้า "' + code + '"', true); return; }
  var el = $('#' + target);
  if (!el) return;
  el.value = code;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function camScan(target) {
  if (!('BarcodeDetector' in window)) return toast('มือถือ/เบราว์เซอร์นี้ยังสแกนด้วยกล้องไม่ได้ (เช่น iPhone) — พิมพ์ค้นหาแทน หรือใช้ Chrome บน Android', true);
  var keep = target === 'cscan' || target === 'rscan';   // counting / receiving: keep scanning
  var stream = null, timer = null, last = {}, stopped = false;
  var m = openModal('<header><h1>สแกนด้วยกล้อง</h1><span class="muted">' + (keep ? 'สแกนต่อได้เรื่อย ๆ · กดเสร็จเมื่อพอ' : 'เล็งบาร์โค้ดในกรอบ') + '</span></header>' +
    '<div class="body cam-body"><div class="cam-view"><video playsinline muted></video><div class="cam-frame"></div></div><div class="cam-last muted" id="camlast">กำลังเปิดกล้อง…</div></div>' +
    '<footer><button class="btn primary" data-x="done">เสร็จ</button></footer>', { onClose: function () { stopped = true; clearTimeout(timer); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } });
  $('[data-x=done]', m).onclick = function () { closeModal(); };
  var video = $('video', m);
  var det;
  try { det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'] }); }
  catch (e) { det = new BarcodeDetector(); }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (st) {
    if (stopped) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
    stream = st; video.srcObject = st;
    return video.play().then(function () {
      $('#camlast', m).textContent = 'เล็งบาร์โค้ดในกรอบ';
      var tick = function () {
        if (stopped) return;
        det.detect(video).then(function (codes) {
          var c = codes && codes[0] && codes[0].rawValue;
          if (c && (!last[c] || Date.now() - last[c] > 1500)) {
            last[c] = Date.now();
            beep();
            if (navigator.vibrate) navigator.vibrate(60);
            var p = S.idx.byBarcode[c] ? S.idx.bySku[S.idx.byBarcode[c].sku] : null;
            $('#camlast', m).textContent = (p ? p.name : c) + (keep ? ' ✓' : '');
            if (!keep) { closeModal(); camDeliver(target, c); return; }
            camDeliver(target, c);
          }
        }).catch(function () {}).then(function () { timer = setTimeout(tick, 180); });
      };
      tick();
    });
  }).catch(function (e) {
    $('#camlast', m).textContent = 'เปิดกล้องไม่ได้ — อนุญาตให้ใช้กล้องในเบราว์เซอร์ก่อน';
  });
}

/* =================================================================== */
/* Cart                                                                */
/* =================================================================== */

function newCart() {
  S.cart = { saleUid: 'U' + Date.now().toString(36) + randomId(8), lines: [], billDiscount: 0, approvalId: '', sel: -1 };
  S.suggest = [];
}

function unitPriceOf(p, b) {
  if (b && b.price !== null && b.price !== undefined && b.price !== '') return Number(b.price);
  return round2(p.price * (b ? b.multiplier : 1));
}

/** Add qty of a product (optionally via a barcode row). Asks price for open-price items. */
function addItem(p, b, qty) {
  qty = qty || 1;
  if (p.forSale === false) { beep(); return toast(p.name + ' เป็นวัตถุดิบ — ไม่ได้ตั้งให้ขายหน้าร้าน', true); }
  var doAdd = function (unitPrice) {
    var key = p.sku + '|' + (b ? b.barcode : '') + '|' + unitPrice;
    var found = -1;
    S.cart.lines.forEach(function (l, i) { if (l.key === key) found = i; });
    if (found >= 0) { S.cart.lines[found].qty += qty; S.cart.sel = found; S.cart.lastIdx = found; }
    else {
      S.cart.lines.push({ key: key, sku: p.sku, barcode: b ? b.barcode : '', name: p.name,
        unitName: b ? b.unitName : (p.unit || 'ชิ้น'), multiplier: b ? b.multiplier : 1, qty: qty,
        unitPrice: unitPrice, lineDiscount: 0, openPrice: p.openPrice });
      S.cart.sel = S.cart.lines.length - 1;
      S.cart.lastIdx = S.cart.sel;
    }
    S.suggest = [];
    renderCartOnly();
    stockWarn(p);
  };
  if (p.openPrice) {
    prompt2('ราคาเปิด: ' + p.name, 'ราคาต่อหน่วย (บาท)', '', { type: 'number', inputmode: 'decimal', step: '0.25', ok: 'ใส่ในบิล' })
      .then(function (v) { var n = round2(Number(v)); if (v !== null && n > 0) doAdd(n); else if (v !== null) toast('ราคาไม่ถูกต้อง', true); });
  } else doAdd(unitPriceOf(p, b));
}

/* --------------------------- Customer display ---------------------------- */

/** Publish the bill to the customer display (2nd screen). mode: idle | scan | pay | done. */
function cdPublish(mode, extra) {
  if (!window.CustomerDisplay || !S.cart) return;
  var t = cartTotals();
  mode = mode || (S.cart.lines.length ? 'scan' : 'idle');
  var last = S.cart.lines[S.cart.lastIdx];
  var st = Object.assign({
    mode: mode, shopName: S.settings.shopName, welcome: S.settings.customerWelcome, hours: S.settings.shopHours,
    promoTitle: S.settings.customerPromoTitle, promoText: S.settings.customerPromoText, thanks: S.settings.receiptFooter,
    lines: S.cart.lines.map(function (l) { return { name: l.name + (l.multiplier > 1 ? ' (' + l.unitName + ')' : ''), qty: l.qty, total: round2(l.qty * l.unitPrice), discount: ldTotal(l) }; }),
    last: last ? { name: last.name, price: last.unitPrice, img: (S.idx.bySku[last.sku] || {}).image ? imgKey(S.idx.bySku[last.sku].image) : '' } : null,
    items: t.items, subtotal: t.subtotal, discount: t.discount, total: t.total,
    slides: cdSlides(), slideSeconds: Math.max(3, Number(S.settings.slideSeconds) || 8), hint: S.settings.cdHints === '0' ? '' : promoHint()
  }, extra || {});
  CustomerDisplay.pos.publish(st);
}

/* Near-expiry markdown on a sale line (set on the Expiry page; no PIN needed at the till). */
function mdAmt(l) { return l.md ? round2(l.unitPrice * l.md.qty * l.md.pct / 100) : 0; }
function ldTotal(l) { return round2((l.lineDiscount || 0) + mdAmt(l) + (l.promo || 0)); }

/* ---------------- Promotions (same engine as the server: promo.js) ---------------- */
function promoNow() {
  var d = new Date();
  return { ymd: fmtYmd(d), dow: d.getDay(), hm: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') };
}
/** Work out promotions for the cart: sets l.promo on each line and S.cart.promos. */
function cartPromos() {
  if (!S.cart) return;
  var r = window.promoApply ? promoApply(S.cart.lines.map(function (l, i) {
    return { key: 'L' + ('00' + i).slice(-3), sku: l.sku, qty: l.qty, unitPrice: l.unitPrice, eligible: l.multiplier === 1 && !l.openPrice && !l.md };
  }), S.promos || [], promoNow()) : { byKey: {}, applied: [], total: 0 };
  S.cart.lines.forEach(function (l, i) { l.promo = round2(r.byKey['L' + ('00' + i).slice(-3)] || 0); });
  S.cart.promos = r.applied;
}
/** Promotions running right now that include this sku. */
function promosFor(sku) {
  var w = promoNow();
  return (S.promos || []).filter(function (p) {
    return promoLive(p, w) && promoItems(p).some(function (it) { return String(it && it.sku !== undefined ? it.sku : it) === String(sku); });
  });
}
function promoText(p) {
  var it = promoItems(p);
  if (p.type === 'combo') return it.map(function (c) { var x = S.idx.bySku[c.sku]; return (x ? x.name : c.sku) + (c.qty > 1 ? ' ×' + c.qty : ''); }).join(' + ') + ' = ฿' + money(p.price);
  var names = it.map(function (k) { var x = S.idx.bySku[k]; return x ? x.name : k; });
  var who = names.length > 2 ? names.slice(0, 2).join(', ') + ' และอีก ' + (names.length - 2) + ' รายการ' : names.join(' / ');
  if (p.type === 'single') return who + ' ' + promoCut(p);
  return p.type === 'multi' ? who + ' ' + p.buyQty + ' ชิ้น ฿' + money(p.price) : who + ' ซื้อ ' + p.buyQty + ' แถม ' + p.freeQty;
}

/** Markdown quota for this sku still free in the cart (excluding line `skip`). */
function mdFor(sku, skip) {
  var m = (S.markdowns || []).filter(function (x) { return x.sku === sku; }).sort(function (a, b) { return a.expiryDate < b.expiryDate ? -1 : 1; })[0];
  if (!m) return null;
  var used = 0;
  S.cart.lines.forEach(function (l, i) { if (i !== skip && l.md && l.md.lotId === m.lotId) used += l.md.qty; });
  return { lotId: m.lotId, pct: m.pct, left: m.left - used };
}

function toggleMd(i) {
  var l = S.cart.lines[i];
  if (!l) return;
  if (l.md) { l.md = null; return renderCartOnly(); }
  var m = mdFor(l.sku, i);
  if (!m || m.left < 1) return toast('ไม่เหลือโควตาราคาลดของสินค้านี้', true);
  l.md = { lotId: m.lotId, pct: m.pct, qty: Math.min(l.qty, m.left) };
  if (l.lineDiscount + mdAmt(l) > l.qty * l.unitPrice) l.lineDiscount = 0;
  renderCartOnly();
}

function cartTotals() {
  cartPromos();
  var sub = 0, ld = 0, items = 0;
  S.cart.lines.forEach(function (l) { sub += l.qty * l.unitPrice; ld += ldTotal(l); items += l.qty * (l.multiplier || 1); });
  sub = round2(sub);
  var disc = round2(ld + S.cart.billDiscount);
  return { subtotal: sub, discount: disc, total: round2(sub - disc), items: items };
}

/** Scan box: "6*885…" = 6 units, barcode, PLU, or name search. */
function handleScan(raw) {
  var v = String(raw || '').trim();
  if (!v) return;
  var qty = 1;
  var m = /^(\d{1,3})\*(.+)$/.exec(v);
  if (m) { qty = Number(m[1]); v = m[2].trim(); }
  var b = S.idx.byBarcode[v];
  if (b) { addItem(S.idx.bySku[b.sku], b, qty); return clearScan(); }
  var p = S.idx.byPlu[v];
  if (p) { addItem(p, null, qty); return clearScan(); }
  if (/^\d{6,}$/.test(v)) { beep(); toast('ไม่พบบาร์โค้ด ' + v, true); return clearScan(); }
  var q = v.toLowerCase();
  S.suggest = S.products.filter(function (x) {
    if (!x.active || x.forSale === false) return false;
    return x.name.toLowerCase().indexOf(q) >= 0 || x.sku.toLowerCase() === q;
  }).slice(0, 8).map(function (x) { return { sku: x.sku, qty: qty }; });
  S.suggestOn = 0;
  if (!S.suggest.length) toast('ไม่พบสินค้า "' + v + '"', true);
  renderSuggest();
}

function clearScan() { var i = $('#scan'); if (i) i.value = ''; S.suggest = []; renderSuggest(); }
function focusScan() { setTimeout(function () { var i = $('#scan'); if (i && !modalStack.length) i.focus(); }, 0); }

function beep() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var o = ctx.createOscillator(); o.frequency.value = 220; o.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.15);
  } catch (e) { /* no audio */ }
}

/* =================================================================== */
/* Sale screen                                                         */
/* =================================================================== */

function renderSale() {
  var groups = {};
  S.products.forEach(function (p) { if (p.quickKey && p.active && p.forSale !== false) groups[p.quickKeyGroup || 'ทั่วไป'] = true; });
  var gnames = Object.keys(groups).sort();
  if (gnames.length && gnames.indexOf(S.keyGroup) < 0) S.keyGroup = gnames[0];
  var chips = gnames.map(function (g) {
    return '<button class="chip ' + (g === S.keyGroup ? 'on' : '') + '" data-act="keyGroup" data-g="' + esc(g) + '">' + esc(g) + '</button>';
  }).join('');
  var keys = S.products.filter(function (p) { return p.quickKey && p.active && p.forSale !== false && (p.quickKeyGroup || 'ทั่วไป') === S.keyGroup; })
    .sort(function (a, b) { return (a.quickKeyOrder || 999) - (b.quickKeyOrder || 999) || a.name.localeCompare(b.name, 'th'); })
    .map(function (p) {
      var c = KEY_COLORS[p.color] || KEY_COLORS.gray;
      return '<button class="key" data-act="quickKey" data-sku="' + esc(p.sku) + '"><span class="ic' + (p.image && S.imgUrl && S.imgUrl[p.image] ? ' has-img' : '') + '"' + pimgAttr(p) + ' style="background:' + c[0] + ';color:' + c[1] + '">' +
        picHtml(p) + '</span>' + (promosFor(p.sku).length ? '<span class="kpromo">โปร</span>' : '') + '<span class="nm">' + esc(p.name) + '</span><span class="pr">' +
        (p.openPrice ? 'ราคาเปิด' : '฿' + money(p.price)) + '</span></button>';
    }).join('');
  if (!gnames.length) keys = '<div class="muted">ยังไม่มีปุ่มขายด่วน — ตั้งได้ในหน้าสินค้า (ติ๊ก "ปุ่มขายด่วน")</div>';

  return '<div class="page"><div class="sale">' +
    '<section class="card cart"><div class="scan"><div class="row"><label for="scan" style="white-space:nowrap">สแกน / ค้นหา</label>' +
    '<input id="scan" autocomplete="off" placeholder="สแกนบาร์โค้ด, PLU หรือพิมพ์ชื่อสินค้า" ' + (S.isCounter && S.shift ? '' : 'disabled') + '></div>' +
    '<div class="scan-hint">พิมพ์จำนวนแล้วกด * ก่อนสแกน เช่น 6* = 6 ชิ้น</div><div id="suggest"></div></div>' +
    '<div class="cart-head"><div>รายการ</div><div style="text-align:center">จำนวน</div><div class="r">รวม</div><div class="r" style="font-size:12px">ลด</div></div>' +
    '<div class="lines" id="lines"></div>' +
    '<div class="cart-actions"><button class="btn" data-act="billDiscount">ส่วนลดท้ายบิล</button><button class="btn" data-act="holdBill">พักบิล</button><button class="btn" data-act="storeUse">เบิกใช้</button>' +
    '<button class="btn" data-act="noSale">เปิดลิ้นชัก</button><button class="btn warn" data-act="clearCart">ล้างบิล</button></div></section>' +
    '<section class="sell"><div class="row" style="flex-wrap:wrap">' + chips + '</div><div class="keys">' + keys + '</div>' +
    '<div class="card total" id="totalbar"></div></section></div></div>';
}

function renderCartOnly() {
  var box = $('#lines');
  if (!box) return;
  cartPromos();
  if (!S.cart.lines.length) box.innerHTML = '<div class="empty">สแกนสินค้าหรือแตะปุ่มด้านขวาเพื่อเริ่มบิล</div>';
  else box.innerHTML = S.cart.lines.map(function (l, i) {
    var m = l.multiplier === 1 ? mdFor(l.sku, i) : null;
    var mdChip = l.md ? '<button class="mdchip on" data-act="toggleMd" data-i="' + i + '" title="แตะเพื่อยกเลิก">ราคาลด −' + l.md.pct + '% × ' + l.md.qty + ' ✕</button>'
      : m && m.left > 0 ? '<button class="mdchip" data-act="toggleMd" data-i="' + i + '">ใช้ราคาลด −' + m.pct + '% (เหลือ ' + m.left + ')</button>' : '';
    return '<div class="swipe" data-i="' + i + '"><div class="swipe-bg">ลบ</div><div class="line ' + (i === S.cart.sel ? 'sel' : '') + '" data-act="selLine" data-i="' + i + '">' +
      '<div><div class="name">' + esc(l.name) + '</div><div class="sub">' + (S.recipes[l.sku] ? 'สูตร: ' + esc(recipeText(l.sku)) : esc(l.unitName) + (l.multiplier > 1 ? ' (' + l.multiplier + ' ชิ้น)' : '')) +
      ' · ฿' + money(l.unitPrice) + '</div>' + mdChip + (l.promo ? '<span class="promo-tag">โปร −' + money(l.promo).replace(/\.00$/, '') + '</span>' : '') + '</div>' +
      '<div class="qty"><button data-act="qty" data-i="' + i + '" data-d="-1" aria-label="ลด">−</button><button class="n num" data-act="editQty" data-i="' + i + '" aria-label="พิมพ์จำนวน">' + l.qty +
      '</button><button data-act="qty" data-i="' + i + '" data-d="1" aria-label="เพิ่ม">+</button></div>' +
      '<div class="r num">' + (ldTotal(l) ? '<div class="was">' + money(l.qty * l.unitPrice) + '</div>' : '') + '<b>' + money(l.qty * l.unitPrice - ldTotal(l)) + '</b></div>' +
      '<button class="ldisc' + (l.lineDiscount ? ' on' : '') + '" data-act="lineDisc" data-i="' + i + '" aria-label="ส่วนลดรายการ ' + esc(l.name) + '" title="ส่วนลดรายการนี้">' +
      (l.lineDiscount ? '−' + money(l.lineDiscount).replace(/\.00$/, '') : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>') +
      '</button></div></div>';
  }).join('');
  if (!$('#pm')) cdPublish();
  var hb = $('[data-act=holdBill]');
  if (hb) hb.textContent = 'พักบิล' + (heldBills().length ? ' (' + heldBills().length + ')' : '');
  var t = cartTotals();
  var bar = $('#totalbar');
  var pt = (S.cart.promos || []).reduce(function (a, x) { return a + x.discount; }, 0);
  var hint = promoHint();
  if (bar) bar.innerHTML = '<div class="grow">' + (hint ? '<div class="promo-hint" id="phint">💡 ' + esc(hint) + '</div>' : '') + '<div class="muted">' + t.items + ' ชิ้น' + (pt ? ' · <span class="brand-text" title="' + esc((S.cart.promos || []).map(function (x) { return x.name + (x.times > 1 ? ' ×' + x.times : ''); }).join(', ')) + '">โปร ฿' + money(pt) + '</span>' : '') +
    (round2(t.discount - pt) > 0 ? ' · ส่วนลด ฿' + money(round2(t.discount - pt)) : '') +
    '</div><div class="row" style="align-items:baseline"><b style="font-size:18px">ยอดรวม</b><span class="amt num">฿' + money(t.total) + '</span></div></div>' +
    (S.settings.promptPayId ? '<button class="btn qr-pay" data-act="payQr" ' + (S.cart.lines.length && S.shift ? '' : 'disabled') + '>QR พร้อมเพย์</button>' : '') +
    '<button class="btn lg primary" data-act="pay" ' + (S.cart.lines.length && S.shift ? '' : 'disabled') + '>ชำระเงิน (F12)</button>';
  var sel = $('.line.sel');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function renderSuggest() {
  var box = $('#suggest');
  if (!box) return;
  if (!S.suggest.length) { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="suggest">' + S.suggest.map(function (s, i) {
    var p = S.idx.bySku[s.sku];
    return '<button data-act="pickSuggest" data-i="' + i + '" class="' + (i === S.suggestOn ? 'on' : '') + '"><span>' + esc(p.name) +
      ' <span class="muted">' + esc(p.sku) + '</span></span><span class="num">' + (p.openPrice ? 'ราคาเปิด' : '฿' + money(p.price)) + '</span></button>';
  }).join('') + '</div>';
}

function changeQty(i, d) {
  var l = S.cart.lines[i];
  if (!l) return;
  if (l.qty + d <= 0) return askRemoveLine(i);
  l.qty += d;
  if (l.qty <= 0) S.cart.lines.splice(i, 1);
  if (l.md) l.md.qty = Math.min(l.md.qty, l.qty);
  if (ldTotal(l) > l.qty * l.unitPrice) l.lineDiscount = 0;
  S.cart.sel = Math.min(i, S.cart.lines.length - 1);
  renderCartOnly();
}

function askRemoveLine(i) {
  var l = S.cart.lines[i];
  if (!l) return Promise.resolve(false);
  return confirm2('ลบรายการ', l.name + ' × ' + l.qty + ' (฿' + money(l.qty * l.unitPrice - ldTotal(l)) + ')', 'ลบรายการ', true).then(function (ok) {
    if (ok) {
      S.cart.lines.splice(i, 1);
      S.cart.sel = Math.min(i, S.cart.lines.length - 1);
    }
    renderCartOnly();
    return ok;
  });
}

/* Swipe a cart line to the right to delete it (touch, pen or mouse drag). */
(function () {
  var sw = null;
  var TH = 90;
  document.addEventListener('pointerdown', function (e) {
    var w = e.target.closest('.swipe');
    if (!w || e.target.closest('.qty, .ldisc, .mdchip') || e.button > 0) return;
    sw = { w: w, line: $('.line', w), x: e.clientX, y: e.clientY, dx: 0, on: false, id: e.pointerId };
  });
  document.addEventListener('pointermove', function (e) {
    if (!sw || e.pointerId !== sw.id) return;
    var dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (!sw.on) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }   // vertical scroll
      if (dx < 12) return;
      sw.on = true;
      sw.w.classList.add('dragging');
      try { sw.w.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    sw.dx = Math.max(0, dx);
    sw.line.style.transform = 'translateX(' + sw.dx + 'px)';
    sw.w.classList.toggle('armed', sw.dx > TH);
  });
  function end(e) {
    if (!sw || e.pointerId !== sw.id) return;
    var s2 = sw; sw = null;
    if (!s2.on) return;
    s2.w.classList.remove('dragging');
    var stop = function (ev) { ev.stopPropagation(); ev.preventDefault(); };
    s2.w.addEventListener('click', stop, true);           // the drag must not also select the line
    setTimeout(function () { s2.w.removeEventListener('click', stop, true); }, 60);
    if (s2.dx > TH) {
      s2.line.style.transform = 'translateX(100%)';
      askRemoveLine(Number(s2.w.getAttribute('data-i')));
    } else {
      s2.line.style.transform = '';
      s2.w.classList.remove('armed');
    }
  }
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
})();

/* --------------------------- Held bills --------------------------- */
/* Kept in this browser only (per counter), so a refresh or re-login does not lose them. */

function heldBills() {
  try { return JSON.parse(store('em_held') || '[]'); } catch (e) { return []; }
}
function saveHeld(list) { store('em_held', JSON.stringify(list)); }

function holdBill() {
  var held = heldBills();
  if (!S.cart.lines.length && !held.length) return toast('ยังไม่มีบิลที่พักไว้', true);
  if (S.cart.lines.length && !held.length) return parkCurrent();
  var t = S.cart.lines.length ? cartTotals() : null;
  var m = openModal('<header><h1>พักบิล</h1><span class="muted">' + held.length + ' บิลที่พักไว้</span></header><div class="body">' +
    (t ? '<button class="btn primary" data-x="park" style="height:52px">พักบิลนี้ (฿' + money(t.total) + ') แล้วเริ่มบิลใหม่</button>' : '') +
    '<div class="col" style="gap:8px">' + held.map(function (h, i) {
      var tot = h.lines.reduce(function (a, l) { return a + l.qty * l.unitPrice - ldTotal(l); }, 0) - (h.billDiscount || 0);
      return '<div class="card row" style="padding:10px 12px;gap:10px"><div class="grow"><b>' + esc(h.note || ('บิลพัก ' + timeOf(h.at))) + '</b>' +
        '<div class="muted" style="font-size:13px">' + timeOf(h.at) + ' · ' + h.lines.length + ' รายการ · ' + esc(h.lines.slice(0, 3).map(function (l) { return l.name; }).join(', ')) + (h.lines.length > 3 ? '…' : '') + '</div></div>' +
        '<b class="num">฿' + money(tot) + '</b><button class="btn sm" data-x="recall" data-i="' + i + '">เรียกคืน</button>' +
        '<button class="btn sm ghost" data-x="drop" data-i="' + i + '" aria-label="ทิ้งบิลพัก">ทิ้ง</button></div>';
    }).join('') + '</div></div><footer><button class="btn" data-x="close">ปิด</button></footer>', { wide: false });
  m.addEventListener('click', function (e) {
    var b = e.target.closest('[data-x]');
    if (!b) return;
    var x = b.getAttribute('data-x'), i = Number(b.getAttribute('data-i'));
    if (x === 'close') closeModal();
    if (x === 'park') { closeModal(); parkCurrent(); }
    if (x === 'recall') { closeModal(); recallHeld(i); }
    if (x === 'drop') {
      confirm2('ทิ้งบิลพัก', 'ลบบิลพักนี้ทิ้ง (ไม่กระทบสต็อก)', 'ทิ้งบิล', true).then(function (ok) {
        if (!ok) return;
        var l = heldBills(); l.splice(i, 1); saveHeld(l);
        closeModal(); renderCartOnly(); if (l.length) holdBill();
      });
    }
  });
}

function parkCurrent() {
  prompt2('พักบิล', 'ชื่อ / หมายเหตุ (ไม่ใส่ก็ได้)', '', { hint: 'เช่น ลูกค้าเสื้อแดง, รถกระบะขาว', ok: 'พักบิล' }).then(function (note) {
    if (note === null) return;
    var l = heldBills();
    l.push({ at: new Date().toISOString(), note: note.trim(), lines: S.cart.lines, billDiscount: S.cart.billDiscount, approvalId: S.cart.approvalId });
    saveHeld(l);
    newCart(); renderCartOnly();
    toast('พักบิลแล้ว · มี ' + l.length + ' บิลรออยู่');
  });
}

function recallHeld(i) {
  var l = heldBills();
  var h = l[i];
  if (!h) return;
  l.splice(i, 1);
  if (S.cart.lines.length) {   // swap: the current bill goes on hold
    l.push({ at: new Date().toISOString(), note: 'สลับจากการเรียกคืน', lines: S.cart.lines, billDiscount: S.cart.billDiscount, approvalId: S.cart.approvalId });
  }
  saveHeld(l);
  newCart();
  S.cart.lines = h.lines; S.cart.billDiscount = h.billDiscount || 0; S.cart.approvalId = h.approvalId || '';
  S.cart.sel = h.lines.length - 1;
  renderCartOnly();
  toast('เรียกคืนบิลแล้ว');
}

function askDiscount(kind) {
  if (!S.cart.lines.length) return toast('ยังไม่มีสินค้าในบิล', true);
  var line = kind === 'line' ? S.cart.lines[S.cart.sel] : null;
  if (kind === 'line' && !line) return toast('แตะเลือกรายการก่อน', true);
  var t = cartTotals();
  // A bill discount applies to what is left after line discounts.
  var base = line ? round2(line.qty * line.unitPrice - mdAmt(line)) : round2(t.subtotal - (t.discount - S.cart.billDiscount));
  var cur = line ? line.lineDiscount : S.cart.billDiscount;
  var mode = 'baht';
  var val = cur ? String(cur) : '';

  var apply = function (amt) {
    var set = function () {
      if (line) line.lineDiscount = amt; else S.cart.billDiscount = amt;
      renderCartOnly();
    };
    if (amt === 0) return set();
    return approval('DISCOUNT', 'อนุมัติส่วนลด ฿' + money(amt)).then(function (id) {
      if (id === null) return;
      if (id) S.cart.approvalId = id;
      set();
    });
  };
  var amountOf = function () {
    var n = Number(val || 0);
    return round2(mode === 'pct' ? base * n / 100 : n);
  };
  // "Round down" suggestions: drop the satang, or down to the nearest 5 / 10 baht (max 10 baht off).
  var rounds = [];
  [1, 5, 10].forEach(function (step) {
    var to = Math.floor(base / step) * step, off = round2(base - to);
    if (off > 0 && off <= 10 && rounds.every(function (r) { return r.to !== to; })) rounds.push({ to: to, off: off });
  });

  var m = openModal('<header><h1>' + (line ? 'ส่วนลด: ' + esc(line.name) : 'ส่วนลดท้ายบิล') + '</h1><span class="grow"></span>' +
    '<span class="muted">ยอด</span><b class="num" style="font-size:20px">฿' + money(base) + '</b></header>' +
    '<div class="body disc"><div class="seg"><button type="button" data-mode="baht" class="on">บาท (฿)</button><button type="button" data-mode="pct">เปอร์เซ็นต์ (%)</button></div>' +
    '<div class="disc-in"><label class="sr" for="d-val">ส่วนลด</label><input id="d-val" class="big-input num" inputmode="decimal" autocomplete="off" autofocus value="' + esc(val) + '"><span id="d-unit">฿</span></div>' +
    '<div class="disc-chips" id="d-chips"></div>' +
    (rounds.length ? '<div class="disc-chips"><span class="muted" style="font-size:13px;align-self:center">ปัดเศษ</span>' + rounds.map(function (r) {
      return '<button type="button" class="chip" data-round="' + r.off + '">เหลือ ฿' + money(r.to).replace(/\.00$/, '') + ' <span class="muted">(ลด ' + money(r.off).replace(/\.00$/, '') + ')</span></button>';
    }).join('') + '</div>' : '') +
    '<div class="disc-pad">' + ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'del'].map(function (k) {
      return '<button type="button" data-k="' + k + '">' + (k === 'del' ? '⌫' : k) + '</button>';
    }).join('') + '</div>' +
    '<div class="disc-preview" id="d-prev"></div></div>' +
    '<footer>' + (cur ? '<button class="btn warn" data-x="clear" style="margin-right:auto">ยกเลิกส่วนลด</button>' : '') +
    '<button class="btn" data-x="no">ปิด</button><button class="btn primary" data-x="ok" style="min-width:140px">ใช้ส่วนลด</button></footer>');

  var input = $('#d-val', m);
  var draw = function () {
    var chips = mode === 'pct' ? [5, 10, 15, 20, 25, 50] : [1, 2, 5, 10, 20, 50].filter(function (n) { return n < base; });
    $('#d-chips', m).innerHTML = chips.map(function (n) {
      return '<button type="button" class="chip' + (String(n) === val ? ' on' : '') + '" data-q="' + n + '">' + (mode === 'pct' ? n + '%' : '฿' + n) + '</button>';
    }).join('');
    $('#d-unit', m).textContent = mode === 'pct' ? '%' : '฿';
    var amt = amountOf(), ok = amt >= 0 && amt <= base && (mode !== 'pct' || Number(val || 0) <= 100);
    $('#d-prev', m).className = 'disc-preview' + (ok ? '' : ' bad');
    $('#d-prev', m).innerHTML = ok
      ? '<span>ลด <b class="num">฿' + money(amt) + '</b></span><span>เหลือ <b class="num" style="font-size:24px">฿' + money(base - amt) + '</b></span>'
      : '<span>ส่วนลดเกินยอด ฿' + money(base) + '</span>';
    $('[data-x=ok]', m).disabled = !ok || amt === 0;
  };
  var fine = window.matchMedia && matchMedia('(pointer:fine)').matches;   // PC: keep typing/Enter working; touch: don't pop the keyboard
  var setVal = function (v) { val = v; input.value = v; draw(); if (fine) input.focus(); };
  input.addEventListener('input', function () { val = input.value.replace(/[^\d.]/g, ''); draw(); });
  m.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-mode')) {
      mode = b.getAttribute('data-mode');
      $all('[data-mode]', m).forEach(function (x) { x.classList.toggle('on', x === b); });
      setVal(''); input.focus();
    } else if (b.hasAttribute('data-q')) { setVal(b.getAttribute('data-q')); }
    else if (b.hasAttribute('data-round')) {
      mode = 'baht'; $all('[data-mode]', m).forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-mode') === 'baht'); });
      setVal(b.getAttribute('data-round'));
    } else if (b.hasAttribute('data-k')) {
      var k = b.getAttribute('data-k');
      if (k === 'del') setVal(val.slice(0, -1));
      else if (k === '.' && val.indexOf('.') >= 0) return;
      else setVal(val + k);
    } else if (b.getAttribute('data-x') === 'no') closeModal();
    else if (b.getAttribute('data-x') === 'clear') { closeModal(); apply(0); }
    else if (b.getAttribute('data-x') === 'ok') { var amt = amountOf(); closeModal(); apply(amt); }
  });
  m.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); var ok = $('[data-x=ok]', m); if (!ok.disabled) ok.click(); }
  });
  draw();
}

/* ---------------------------- Payment ----------------------------- */

function openPay(initial) {
  if (!S.cart.lines.length) return;
  if (!S.shift) return toast('ยังไม่ได้เปิดกะ', true);
  var t = cartTotals();
  var method = 'cash';
  var hasPP = !!S.settings.promptPayId;
  var quick = [t.total];
  [20, 50, 100, 500, 1000].forEach(function (n) { var v = Math.ceil(t.total / n) * n; if (v > t.total && quick.indexOf(v) < 0) quick.push(v); });
  quick = quick.slice(0, 5);
  var PM = { cash: 'เงินสด', qr: 'QR พร้อมเพย์', transfer: 'โอน' };
  var numIn = function (id, extra) {
    return '<input id="' + id + '" class="num pay-in" type="text" inputmode="none" autocomplete="off"' + (extra || '') + '>';
  };
  var m = openModal('<header><h1>ชำระเงิน</h1><span class="muted">' + t.items + ' ชิ้น</span><span class="grow"></span>' +
    '<span style="font-size:28px;font-weight:700" class="brand-text num">฿' + money(t.total) + '</span></header>' +
    '<div class="body pay-grid"><div class="pay-left"><div class="seg" id="pm">' +
    '<button data-m="cash" class="on">เงินสด</button><button data-m="qr">QR พร้อมเพย์</button><button data-m="transfer">โอน</button><button data-m="split">แบ่งจ่าย</button></div>' +
    // cash
    '<div id="pm-cash" class="col" style="gap:10px"><label for="recv">รับเงินมา</label>' + numIn('recv', ' autofocus') +
    '<div class="row" style="flex-wrap:wrap">' + quick.map(function (q) { return '<button class="btn" data-q="' + q + '">' + (q === t.total ? 'พอดี' : '฿' + money(q)) + '</button>'; }).join('') + '</div>' +
    '<div class="row" style="justify-content:space-between;align-items:baseline"><span class="muted">เงินทอน</span><span id="chg" class="num brand-text" style="font-size:40px;font-weight:700">฿0.00</span></div></div>' +
    // qr
    '<div id="pm-qr" class="col hidden" style="align-items:center;gap:8px">' +
    (hasPP ? '<div class="qr" id="qrbox"></div><div class="muted">พร้อมเพย์ ' + esc(maskPP(S.settings.promptPayId)) + ' · ยอดอยู่ใน QR แล้ว</div><div class="muted" style="font-size:13px">ตรวจยอดเข้าในแอปธนาคาร แล้วกด "ได้รับเงินแล้ว"</div>'
      : '<div class="banner" style="border-radius:8px">ยังไม่ได้ตั้งเบอร์พร้อมเพย์ (ตั้งค่า › ร้าน)</div>') + '</div>' +
    // transfer
    '<div id="pm-transfer" class="col hidden"><div class="muted">ตรวจยอดโอนในแอปธนาคารก่อน แล้วกด "ได้รับเงินแล้ว"</div></div>' +
    // split
    '<div id="pm-split" class="col hidden" style="gap:12px">' +
    '<div class="sp-part"><div class="sp-h">ส่วนที่ 1 · เลือกช่องทาง แล้วใส่ยอดที่รับมา</div><div class="sp-row"><div class="seg-sm" id="s1m"></div>' +
    '<label class="sr" for="s1">ยอดส่วนที่ 1</label>' + numIn('s1') + '</div></div>' +
    '<div class="sp-part"><div class="sp-h">ส่วนที่ 2 · ที่เหลือจ่ายด้วย <span class="muted" style="font-weight:400" id="s2hint"></span></div><div class="sp-row"><div class="seg-sm" id="s2m"></div>' +
    '<label class="sr" for="s2">ยอดส่วนที่ 2</label>' + numIn('s2') + '</div></div>' +
    '<div class="row" style="gap:14px;align-items:center"><div class="grow"><div id="sp-lab" class="muted">เงินทอน</div><div id="sp-res" class="num brand-text" style="font-size:34px;font-weight:700">฿0.00</div>' +
    '<div class="muted" style="font-size:12px;margin-top:4px" id="sp-qrnote"></div></div>' +
    '<div id="sp-qrwrap" class="hidden"><div class="qr" id="spqr" style="width:128px;height:128px"></div></div></div></div>' +
    '<label class="row" style="color:var(--ink);font-size:15px"><input type="checkbox" id="autoprint" ' + (S.settings.autoPrint === '0' ? '' : 'checked') + '> พิมพ์ใบเสร็จ</label></div>' +
    // keypad
    '<div class="keypad" id="kp">' + ['7', '8', '9', 'del', '4', '5', '6', 'clr', '1', '2', '3', '00', '0', '.'].map(function (k) {
      return '<button type="button" data-k="' + k + '"' + (k === '0' ? ' class="wide"' : '') + ' aria-label="' + (k === 'del' ? 'ลบ' : k === 'clr' ? 'ล้าง' : k) + '">' +
        (k === 'del' ? '⌫' : k === 'clr' ? 'C' : k) + '</button>';
    }).join('') + '</div>' +
    '</div><footer><button class="btn" data-x="cancel">ยกเลิก (Esc)</button><button class="btn primary lg" data-x="ok" style="height:52px;font-size:17px">ยืนยัน (Enter)</button></footer>',
    { onClose: function () { if (!paid) cdPublish(); } });
  m.querySelector('.modal').classList.add('pay');
  var paid = false;
  cdPublish('pay', { method: 'cash' });

  var recv = $('#recv', m), s1 = $('#s1', m), s2 = $('#s2', m);
  var val = function (el) { return round2(Number(el.value || 0)); };

  // ---- keypad: types into whichever amount box was focused last
  var target = recv;
  var setTarget = function (el) { target = el; $all('.pay-in', m).forEach(function (x) { x.classList.toggle('active', x === el); }); };
  $all('.pay-in', m).forEach(function (el) { el.addEventListener('focus', function () { setTarget(el); }); });
  $all('#kp button', m).forEach(function (b) {
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.onclick = function () {
      var k = b.getAttribute('data-k'), v = target.value;
      if (k === 'del') v = v.slice(0, -1);
      else if (k === 'clr') v = '';
      else if (k === '.') { if (v.indexOf('.') < 0) v = (v || '0') + '.'; }
      else if (!/\.\d\d$/.test(v)) v = (v === '0' ? '' : v) + k;
      target.value = v;
      target.dispatchEvent(new Event('input'));
      target.focus();
    };
  });
  $all('.pay-in', m).forEach(function (el) {
    el.addEventListener('input', function () { var c = el.value.replace(/[^\d.]/g, ''); if (c !== el.value) el.value = c; });
  });

  // ---- cash
  var updateCash = function () {
    var c = round2(val(recv) - t.total);
    $('#chg', m).textContent = '฿' + money(Math.max(0, c));
    $('#chg', m).className = 'num ' + (c < 0 ? 'warn-text' : 'brand-text');
  };
  recv.addEventListener('input', updateCash);
  $all('[data-q]', m).forEach(function (b) { b.onclick = function () { recv.value = b.getAttribute('data-q'); updateCash(); recv.focus(); }; });

  // ---- split: part 1 any of 3 methods + amount received; part 2 one of the other 2, auto = total − part 1 (editable)
  var m1 = 'cash', m2 = 'qr', s2Manual = false, qrFor = null;
  var drawSeg = function () {
    $('#s1m', m).innerHTML = ['cash', 'qr', 'transfer'].map(function (k) { return '<button type="button" data-s1="' + k + '" class="' + (k === m1 ? 'on' : '') + '">' + PM[k] + '</button>'; }).join('');
    $('#s2m', m).innerHTML = ['cash', 'qr', 'transfer'].filter(function (k) { return k !== m1; }).map(function (k) {
      return '<button type="button" data-s2="' + k + '" class="' + (k === m2 ? 'on' : '') + '">' + PM[k] + '</button>';
    }).join('');
  };
  var split = function () {
    var a = val(s1), b = val(s2), sum = round2(a + b);
    var cashGiven = (m1 === 'cash' ? a : 0) + (m2 === 'cash' ? b : 0);
    var over = round2(sum - t.total);
    var parts = { cash: 0, qr: 0, transfer: 0 };
    parts[m1] += a; parts[m2] += b;
    if (over > 0) parts.cash = round2(parts.cash - over);   // change comes back from the cash part
    return { a: a, b: b, sum: sum, over: over, cashGiven: round2(cashGiven), parts: parts };
  };
  var updateSplit = function () {
    if (!s2Manual) s2.value = val(s1) > 0 && val(s1) < t.total ? String(round2(t.total - val(s1))) : '';
    var p = split();
    var lab = $('#sp-lab', m), res = $('#sp-res', m);
    if (p.over < 0) { lab.textContent = 'ยังขาด'; res.textContent = '฿' + money(-p.over); res.className = 'num warn-text'; }
    else if (p.over > 0 && p.cashGiven < p.over) { lab.textContent = 'เกินยอด (ทอนได้เฉพาะเงินสด)'; res.textContent = '฿' + money(p.over); res.className = 'num warn-text'; }
    else { lab.textContent = 'เงินทอน'; res.textContent = '฿' + money(Math.max(0, p.over)); res.className = 'num brand-text'; }
    $('#s2hint', m).textContent = s2Manual ? '· แก้ยอดเองแล้ว' : '· คิดให้ = ยอดรวม − ส่วนที่ 1 (แก้ได้)';
    var qrAmt = p.parts.qr;
    var showQr = (m1 === 'qr' || m2 === 'qr');
    $('#sp-qrwrap', m).classList.toggle('hidden', !showQr);
    if (showQr && hasPP && qrAmt > 0) {
      if (qrFor !== qrAmt) {
        qrFor = qrAmt;
        drawQr($('#spqr', m), promptPayPayload(S.settings.promptPayId, qrAmt));
        var restK = m1 === 'qr' ? m2 : m1;
        cdPublish('pay', { method: 'qr', qr: promptPayPayload(S.settings.promptPayId, qrAmt), split: { qr: qrAmt, other: round2(t.total - qrAmt), otherName: PM[restK] } });
      }
      $('#sp-qrnote', m).textContent = 'QR ยอด ฿' + money(qrAmt) + ' ขึ้นที่จอลูกค้าด้วย · ตรวจยอดเข้าก่อนยืนยัน';
    } else {
      if (qrFor !== null) { qrFor = null; $('#spqr', m).innerHTML = ''; cdPublish('pay', { method: m1 === 'transfer' || m2 === 'transfer' ? 'transfer' : 'cash' }); }
      $('#sp-qrnote', m).textContent = !showQr ? '' : hasPP ? 'ใส่ยอดแล้ว QR จะขึ้นที่นี่และที่จอลูกค้า' : 'ยังไม่ได้ตั้งเบอร์พร้อมเพย์';
    }
  };
  s1.addEventListener('input', function () { s2Manual = false; updateSplit(); });
  s2.addEventListener('input', function () { s2Manual = true; updateSplit(); });
  s2.addEventListener('blur', function () { if (s2.value === '') { s2Manual = false; updateSplit(); } });
  $('#pm-split', m).addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-s1')) {
      m1 = b.getAttribute('data-s1');
      if (m2 === m1) m2 = ['cash', 'qr', 'transfer'].filter(function (k) { return k !== m1; })[m1 === 'cash' ? 0 : 0];
      drawSeg(); qrFor = -1; updateSplit(); s1.focus();
    } else if (b.hasAttribute('data-s2')) { m2 = b.getAttribute('data-s2'); drawSeg(); qrFor = -1; updateSplit(); }
  });
  drawSeg();

  var setMethod = function (k) {
    method = k;
    $all('#pm button', m).forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-m') === k); });
    ['cash', 'qr', 'transfer', 'split'].forEach(function (x) { $('#pm-' + x, m).classList.toggle('hidden', x !== k); });
    $('#kp', m).classList.toggle('hidden', k === 'qr' || k === 'transfer');
    m.querySelector('.pay-grid').classList.toggle('nokp', k === 'qr' || k === 'transfer');
    if (k === 'qr' && hasPP) drawQr($('#qrbox', m), promptPayPayload(S.settings.promptPayId, t.total));
    if (k === 'split') { qrFor = -1; updateSplit(); setTarget(s1); s1.focus(); }
    else cdPublish('pay', { method: k, qr: k === 'qr' && hasPP ? promptPayPayload(S.settings.promptPayId, t.total) : '' });
    if (k === 'cash') { setTarget(recv); recv.focus(); }
    $('[data-x=ok]', m).textContent = k === 'cash' ? 'ยืนยัน (Enter)' : 'ได้รับเงินแล้ว (Enter)';
  };
  $all('#pm button', m).forEach(function (b) { b.onclick = function () { setMethod(b.getAttribute('data-m')); }; });

  var submitting = false;
  var submit = function () {
    if (submitting) return;
    var received = method === 'cash' ? val(recv) : t.total;
    if (method === 'cash' && received < t.total) { toast('รับเงินไม่พอ', true); recv.focus(); return; }
    if (method === 'qr' && !hasPP) { toast('ตั้งเบอร์พร้อมเพย์ก่อน', true); return; }
    var payments;
    if (method === 'split') {
      var p = split();
      if (!(p.a > 0)) { toast('ใส่ยอดส่วนที่ 1', true); s1.focus(); return; }
      if (!(p.b > 0)) { toast('ใส่ยอดส่วนที่ 2', true); s2.focus(); return; }
      if (p.over < 0) { toast('ยังขาดอีก ฿' + money(-p.over), true); return; }
      if (p.over > 0 && p.cashGiven <= p.over) { toast('ยอดเกิน — ทอนได้เฉพาะส่วนที่เป็นเงินสด', true); return; }
      if (p.parts.qr > 0 && !hasPP) { toast('ตั้งเบอร์พร้อมเพย์ก่อน', true); return; }
      payments = ['cash', 'qr', 'transfer'].filter(function (k) { return p.parts[k] > 0; }).map(function (k) { return { method: k, amount: p.parts[k] }; });
      if (payments.length < 2) { toast('แบ่งจ่ายต้องมี 2 ช่องทาง', true); return; }
      received = p.cashGiven;
    }
    submitting = true;
    var sale = {
      saleUid: S.cart.saleUid, payMethod: method, received: received, payments: payments, billDiscount: S.cart.billDiscount,
      approvalId: S.cart.approvalId,
      lines: S.cart.lines.map(function (l) {
        return { sku: l.sku, barcode: l.barcode, qty: l.qty, unitPrice: l.openPrice ? l.unitPrice : undefined, lineDiscount: l.lineDiscount,
          markdownLotId: l.md ? l.md.lotId : undefined, markdownQty: l.md ? l.md.qty : undefined };
      })
    };
    cartPromos();
    sale.promo = { lines: S.cart.lines.map(function (l) { return l.promo || 0; }), applied: S.cart.promos || [] };
    var offApproval = String(S.cart.approvalId || '').indexOf('OFF:') === 0 ? S.cart.approvalId.slice(4) : '';
    if (offApproval) sale.approvalId = '';
    var soldLines = S.cart.lines.slice();
    var queueOffline = function () {
      // No internet (or signed in offline): keep the bill on this device and carry on; it is sent when the connection is back.
      sale.offlineAt = new Date().toISOString();
      sale.shiftId = S.shift.shiftId;
      var t2 = cartTotals();
      var pp = { cash: 0, qr: 0, transfer: 0 };
      if (sale.payMethod === 'split') (sale.payments || []).forEach(function (x) { pp[x.method] += x.amount; }); else pp[sale.payMethod] = t2.total;
      var cashPart = pp.cash;
      var rc = { billNo: nextOffNo(), offline: true, createdAt: sale.offlineAt, payMethod: sale.payMethod, subtotal: t2.subtotal, discount: round2(t2.subtotal - t2.total),
        total: t2.total, payments: pp, received: sale.payMethod === 'split' ? round2(sale.received + pp.qr + pp.transfer) : sale.received,
        change: cashPart ? round2(sale.received - cashPart) : 0, status: 'PAID', cashier: S.user.name,
        promos: (S.cart.promos || []).slice(), promoDiscount: round2((S.cart.promos || []).reduce(function (a, x) { return a + x.discount; }, 0)),
        lines: S.cart.lines.map(function (l) { return { name: l.name, unitName: l.unitName, qty: l.qty, unitPrice: l.unitPrice, lineDiscount: ldTotal(l), lineTotal: round2(l.qty * l.unitPrice - ldTotal(l)) }; }) };
      queueSale(sale, rc, offApproval);
      localDeduct(soldLines);
      paid = true;
      cdPublish('done', { method: sale.payMethod === 'split' ? (cashPart > 0 ? 'cash' : 'qr') : sale.payMethod, total: rc.total, received: cashPart ? sale.received : rc.total, change: rc.change });
      closeModal();
      var print2 = $('#autoprint', m).checked;
      newCart();
      renderCartOnly();
      if (cashPart > 0) openDrawer(true);
      showReceipt(rc, print2);
    };
    if (S.offline || !S.token || S.shift.offline || offApproval) return queueOffline();
    api('commitSale', S.token, sale).then(function (rc) {
      paid = true;
      localDeduct(soldLines);
      var cashIn = rc.payMethod === 'split' ? round2(rc.received - rc.payments.qr - rc.payments.transfer) : rc.received;
      cdPublish('done', { method: rc.payMethod === 'split' ? (rc.payments.cash > 0 ? 'cash' : 'qr') : rc.payMethod, total: rc.total, received: cashIn, change: rc.change, split: rc.payMethod === 'split' ? rc.payments : null });
      closeModal();
      var print = $('#autoprint', m).checked;
      newCart();
      renderCartOnly();
      if (rc.payMethod === 'cash' || rc.payMethod === 'split' && rc.payments.cash > 0) openDrawer(true);
      showReceipt(rc, print);
    }).catch(function (e) {
      if (!e.offline) { submitting = false; return fail(e); }
      queueOffline();
    });
  };
  $('[data-x=ok]', m).onclick = submit;
  $('[data-x=cancel]', m).onclick = function () { closeModal(); };
  m.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  setMethod(initial === 'qr' ? 'qr' : 'cash');
}

function maskPP(id) { id = String(id || ''); return id.length > 4 ? id.slice(0, 3) + 'x'.repeat(id.length - 6) + id.slice(-3) : id; }

function showReceipt(rc, autoPrint) {
  var m = openModal('<header><h1>' + (rc.offline ? 'บันทึกไว้ในเครื่อง · ' + esc(rc.billNo) : 'บันทึกแล้ว · ' + esc(rc.billNo)) + '</h1></header><div class="body">' +
    (rc.offline ? '<div class="banner">ออฟไลน์ — บิลนี้เก็บไว้ในเครื่องแล้ว จะส่งเข้าระบบเองเมื่อเน็ตกลับมา (' + esc(rc.billNo) + ' เป็นเลขชั่วคราว เลขบิลจริงจะออกตอนส่งสำเร็จ)</div>' : '') +
    (rc.payMethod === 'cash' || rc.payMethod === 'split' && rc.payments.cash > 0 ? '<div class="row" style="justify-content:space-between;align-items:baseline"><span>เงินทอน</span><span class="num brand-text" style="font-size:44px;font-weight:700">฿' + money(rc.change) + '</span></div>' +
      '<div class="muted">' + (rc.payMethod === 'split' ? payText(rc) + ' · รับเงินสดมา ฿' + money(round2(rc.received - rc.payments.qr - rc.payments.transfer)) : 'รับมา ฿' + money(rc.received)) + ' · ยอด ฿' + money(rc.total) + '</div>'
      : '<div>ชำระด้วย ' + payText(rc) + ' ฿' + money(rc.total) + '</div>') +
    '</div><footer><button class="btn" data-x="print">พิมพ์ใบเสร็จ</button><button class="btn primary" data-x="next" autofocus>บิลใหม่ (Enter)</button></footer>');
  $('[data-x=print]', m).onclick = function () { printReceipt(rc); };
  $('[data-x=next]', m).onclick = function () { closeModal(); };
  if (autoPrint) setTimeout(function () { printReceipt(rc); }, 150);
}

/** Kick the cash drawer; never blocks the sale if the drawer fails. */
function openDrawer(silent) {
  if (!window.CashDrawer) return Promise.resolve(false);
  return CashDrawer.open().catch(function (e) { if (!silent) fail(e); else toast('เปิดลิ้นชักไม่ได้: ' + e.message, true); return false; });
}

/* ---------------------- เบิกใช้ในร้าน (store use) ----------------------- */

/** Scan / search goods taken for the shop's own use. Works from the local catalog — no extra loading. */
function storeUseModal() {
  var st = { lines: [], note: '', uid: 'U' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), busy: false };
  var m = openModal('<header><h1>เบิกใช้ในร้าน</h1><span class="muted" style="font-size:13px">ของในร้านที่หยิบไปใช้เอง — ไม่ใช่การขาย</span></header>' +
    '<div class="body" style="gap:12px"><div class="field" style="position:relative"><label for="su-q">สแกน / ค้นหาสินค้า</label>' +
    '<input id="su-q" autocomplete="off" autofocus placeholder="สแกนบาร์โค้ด หรือพิมพ์ชื่อ"><div id="su-sug"></div></div>' +
    '<div id="su-lines" class="su-lines"></div>' +
    '<div class="field"><label for="su-note">ใช้ทำอะไร</label><input id="su-note" maxlength="100" autocomplete="off" placeholder="เช่น น้ำให้ช่างซ่อมแอร์">' +
    '<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px">' + USE_NOTES.map(function (n) {
      return '<button type="button" class="chip" data-n="' + n + '" style="height:32px;font-size:13px;padding:0 12px">' + n + '</button>';
    }).join('') + '</div></div>' +
    '<div class="hintbox">ฝา หลอด แก้วของเครื่องดื่มชง ระบบตัดให้ตอนขายแล้ว ไม่ต้องเบิก · ถ้าหยิบไปใช้แล้วไม่บันทึก ตอนตรวจนับจะกลายเป็น "สูญหาย"</div></div>' +
    '<footer><span class="grow muted" id="su-cost" style="font-size:13px"></span><button class="btn" data-x="no">ยกเลิก</button><button class="btn primary" data-x="ok">บันทึกเบิกใช้</button></footer>');
  var q = $('#su-q', m), note = $('#su-note', m);
  var unitCost = function (l) { var p = S.idx.bySku[l.sku]; return round2((p && p.cost || 0) * l.mult); };
  var draw = function () {
    $('#su-lines', m).innerHTML = st.lines.length ? st.lines.map(function (l, i) {
      return '<div class="su-line"><div><b>' + esc(l.name) + '</b><div class="muted" style="font-size:12px">' + esc(l.unitName) + (l.mult > 1 ? ' (' + l.mult + ' ชิ้น)' : '') + ' · ทุน ฿' + money(unitCost(l)) + '</div></div>' +
        '<div class="qty"><button type="button" data-q="' + i + '" data-d="-1" aria-label="ลด">−</button><span class="n num">' + l.qty + '</span><button type="button" data-q="' + i + '" data-d="1" aria-label="เพิ่ม">+</button></div></div>';
    }).join('') : '<div class="empty" style="padding:18px">ยังไม่มีรายการ</div>';
    var cost = st.lines.reduce(function (a, l) { return a + unitCost(l) * l.qty; }, 0);
    $('#su-cost', m).textContent = st.lines.length ? st.lines.length + ' รายการ · ทุนประมาณ ฿' + money(cost) : '';
  };
  var add = function (p, b) {
    var key = p.sku + '|' + (b ? b.barcode : '');
    var l = st.lines.filter(function (x) { return x.key === key; })[0];
    if (l) l.qty++;
    else st.lines.push({ key: key, sku: p.sku, barcode: b ? b.barcode : '', name: p.name, unitName: b ? b.unitName : (p.unit || 'ชิ้น'), mult: b ? b.multiplier : 1, qty: 1 });
    q.value = ''; $('#su-sug', m).innerHTML = ''; draw(); q.focus();
  };
  var matches = function (v) {
    v = v.trim().toLowerCase();
    if (!v) return [];
    return S.products.filter(function (p) { return p.active && (p.name.toLowerCase().indexOf(v) >= 0 || p.plu === v || p.sku.toLowerCase() === v); }).slice(0, 6);
  };
  q.oninput = function () {
    var list = matches(q.value);
    $('#su-sug', m).innerHTML = list.length ? '<div class="suggest" style="top:62px;left:0;right:0">' + list.map(function (p) {
      return '<button type="button" data-sku="' + esc(p.sku) + '"><span>' + esc(p.name) + '</span><span class="muted num">เหลือ ' + p.onHand + '</span></button>';
    }).join('') + '</div>' : '';
  };
  q.onkeydown = function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    var v = q.value.trim();
    var b = S.idx.byBarcode[v];
    if (b && S.idx.bySku[b.sku]) return add(S.idx.bySku[b.sku], b.multiplier > 1 ? b : null);
    var f = $('#su-sug button', m);
    if (f) f.click(); else if (v) { beep(); toast('ไม่พบสินค้า', true); }
  };
  m.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-sku')) add(S.idx.bySku[t.getAttribute('data-sku')], null);
    else if (t.hasAttribute('data-q')) {
      var i = Number(t.getAttribute('data-q')), l = st.lines[i];
      l.qty += Number(t.getAttribute('data-d'));
      if (l.qty <= 0) st.lines.splice(i, 1);
      draw();
    } else if (t.hasAttribute('data-n')) {
      note.value = t.getAttribute('data-n');
      $all('[data-n]', m).forEach(function (c) { c.classList.toggle('on', c === t); });
    } else if (t.getAttribute('data-x') === 'no') closeModal();
    else if (t.getAttribute('data-x') === 'ok') save();
  });
  var save = function () {
    if (st.busy) return;
    if (!st.lines.length) { toast('ยังไม่มีรายการ', true); q.focus(); return; }
    if (!note.value.trim()) { toast('ใส่ว่าใช้ทำอะไร', true); note.focus(); return; }
    approval('STOCK_ADJUST', 'อนุมัติเบิกใช้ในร้าน').then(function (id) {
      if (id === null) return;
      st.busy = true;
      return api('storeUse', S.token, { useUid: st.uid, note: note.value.trim(), approvalId: id,
        lines: st.lines.map(function (l) { return { sku: l.sku, barcode: l.barcode, qty: l.qty }; }) }).then(function (r) {
        closeModal();
        toast('เบิกแล้ว ' + r.items + ' รายการ · ทุน ฿' + money(r.cost));
        return reloadCatalog();
      });
    }).catch(function (e) { st.busy = false; fail(e); });
  };
  draw();
}

function noSale() {
  if (!S.isCounter) return toast('เปิดลิ้นชักได้เฉพาะเครื่องหน้าร้าน', true);
  var mode = CashDrawer.load().mode;
  if (mode === 'none') return toast('ยังไม่ได้ตั้งค่าลิ้นชักบนเครื่องนี้ (ตั้งค่า › ลิ้นชักเก็บเงิน)', true);
  openDrawer().then(function (ok) { if (ok) api('logDrawer', S.token, 'เปิดลิ้นชักโดยไม่ขาย').catch(function () {}); });
}

function payName(m) { return { cash: 'เงินสด', qr: 'QR พร้อมเพย์', transfer: 'โอน', split: 'แบ่งจ่าย' }[m] || m; }

/** "เงินสด 60 + QR 40" for split bills; plain name otherwise. */
function payText(rc) {
  if (rc.payMethod !== 'split' || !rc.payments) return payName(rc.payMethod);
  return ['cash', 'qr', 'transfer'].filter(function (k) { return rc.payments[k] > 0; }).map(function (k) {
    return payName(k).replace(' พร้อมเพย์', '') + ' ' + money(rc.payments[k]);
  }).join(' + ');
}

function printReceipt(rc) {
  var st = S.settings;
  var lines = rc.lines.map(function (l) {
    return '<tr><td colspan="2">' + esc(l.name) + (l.unitName && l.unitName !== 'ชิ้น' ? ' (' + esc(l.unitName) + ')' : '') + '</td></tr>' +
      '<tr><td>&nbsp;&nbsp;' + l.qty + ' × ' + money(l.unitPrice) + (l.lineDiscount ? ' ลด ' + money(l.lineDiscount) : '') + '</td><td style="text-align:right">' + money(l.lineTotal) + '</td></tr>';
  }).join('');
  $('#print').innerHTML = '<div class="c big">' + esc(st.shopName || '') + '</div>' +
    (st.shopAddress ? '<div class="c">' + esc(st.shopAddress) + '</div>' : '') +
    (st.taxId ? '<div class="c">เลขผู้เสียภาษี ' + esc(st.taxId) + '</div>' : '') +
    '<div class="c">ใบเสร็จรับเงิน' + (rc.status === 'VOID' ? ' (ยกเลิก)' : '') + '</div><hr>' +
    '<div>เลขที่ ' + esc(rc.billNo) + '<br>' + dateTime(rc.createdAt) + ' · ' + esc(S.user ? S.user.name : '') + '</div><hr>' +
    '<table>' + lines + '</table><hr><table>' +
    (rc.discount ? '<tr><td>รวม</td><td style="text-align:right">' + money(rc.subtotal) + '</td></tr>' : '') +
    (rc.promos || []).map(function (x) { return '<tr><td>โปร ' + esc(x.name) + (x.times > 1 ? ' ×' + x.times : '') + '</td><td style="text-align:right">-' + money(x.discount) + '</td></tr>'; }).join('') +
    (round2(rc.discount - (rc.promoDiscount || 0)) > 0 ? '<tr><td>ส่วนลด</td><td style="text-align:right">-' + money(round2(rc.discount - (rc.promoDiscount || 0))) + '</td></tr>' : '') +
    '<tr><td class="big">ยอดสุทธิ</td><td class="big" style="text-align:right">' + money(rc.total) + '</td></tr>' +
    (rc.payMethod === 'split' ? ['cash', 'qr', 'transfer'].filter(function (k) { return rc.payments[k] > 0; }).map(function (k) {
      return '<tr><td>' + payName(k) + '</td><td style="text-align:right">' + money(k === 'cash' ? round2(rc.received - rc.payments.qr - rc.payments.transfer) : rc.payments[k]) + '</td></tr>';
    }).join('') : '<tr><td>' + payName(rc.payMethod) + '</td><td style="text-align:right">' + money(rc.received) + '</td></tr>') +
    (rc.payMethod === 'cash' || rc.payMethod === 'split' && rc.change > 0 ? '<tr><td>เงินทอน</td><td style="text-align:right">' + money(rc.change) + '</td></tr>' : '') +
    '</table><hr><div class="c">' + esc(st.receiptFooter || '') + '</div>';
  window.print();
}

/* ---------------------- PromptPay QR (EMVCo) ---------------------- */

function crc16(str) {
  var crc = 0xFFFF;
  for (var i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (var j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
    crc &= 0xFFFF;
  }
  return ('0000' + crc.toString(16).toUpperCase()).slice(-4);
}

function promptPayPayload(id, amount) {
  var f = function (tag, val) { return tag + ('0' + val.length).slice(-2) + val; };
  var t = String(id).replace(/\D/g, '');
  var acct;
  if (t.length >= 15) acct = f('03', t.slice(0, 15));
  else if (t.length >= 13) acct = f('02', t.slice(0, 13));
  else acct = f('01', ('0000000000000' + t.replace(/^0/, '66')).slice(-13));
  var s = f('00', '01') + f('01', amount ? '12' : '11') + f('29', f('00', 'A000000677010111') + acct) +
    f('58', 'TH') + f('53', '764') + (amount ? f('54', Number(amount).toFixed(2)) : '') + '6304';
  return s + crc16(s);
}

function drawQr(el, payload) {
  if (!el) return;
  if (typeof qrcode !== 'function') { el.innerHTML = '<div class="muted" style="padding:20px">โหลดตัวสร้าง QR ไม่ได้ (ต้องต่ออินเทอร์เน็ต)</div>'; return; }
  var qr = qrcode(0, 'M');
  qr.addData(payload);
  qr.make();
  el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

/* =================================================================== */
/* Bills                                                               */
/* =================================================================== */

/* Bills: year (months) › month (days) › day (bills). S.bills = { level: 'year'|'month'|'day', y, m, d } */
var TH_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

function billsState() {
  if (!S.bills) { var t = today(); S.bills = { level: 'month', y: t.slice(0, 4), m: t.slice(0, 7), d: t }; }
  return S.bills;
}

function dayLabel(ymd) {
  var d = new Date(ymd + 'T00:00:00');
  var W = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  return W[d.getDay()] + ' ' + d.getDate() + ' ' + thDate(ymd).split(' ')[1] + (ymd === today() ? ' · วันนี้' : '');
}

function renderBills() {
  var b = billsState();
  var crumb = '<nav class="crumb"><button data-act="billsGo" data-l="year" data-k="' + b.y + '" class="' + (b.level === 'year' ? 'on' : '') + '">ปี ' + b.y + '</button>' +
    (b.level !== 'year' ? '<span>›</span><button data-act="billsGo" data-l="month" data-k="' + b.m + '" class="' + (b.level === 'month' ? 'on' : '') + '">' + TH_MONTH[Number(b.m.slice(5)) - 1] + '</button>' : '') +
    (b.level === 'day' ? '<span>›</span><button class="on">' + dayLabel(b.d) + '</button>' : '') + '</nav>';
  var search = '<form class="row" data-form="billFind" style="gap:6px"><label class="sr" for="bfind">ค้นหาเลขบิล</label>' +
    '<input id="bfind" placeholder="ค้นหาเลขบิล เช่น 123" autocomplete="off" inputmode="numeric" value="' + esc(b.q || '') + '" style="width:200px;height:36px">' +
    '<button class="btn sm" type="submit">ค้นหา</button></form>';
  var step = '<div class="row" style="gap:6px"><button class="btn sm" data-act="billsStep" data-d="-1" aria-label="ก่อนหน้า">‹</button><button class="btn sm" data-act="billsStep" data-d="1" aria-label="ถัดไป">›</button>' +
    '<button class="btn sm" data-act="billsToday">วันนี้</button><label class="sr" for="bday">ไปวันที่</label><input id="bday" type="date" value="' + b.d + '" data-change="billsDay" style="width:160px;height:36px"></div>';
  var head = b.level === 'day' || b.level === 'search'
    ? '<tr><th>เลขบิล</th><th>' + (b.level === 'search' ? 'วันเวลา' : 'เวลา') + '</th><th class="r">ชิ้น</th><th class="r">ยอด</th><th>ชำระ</th><th>แคชเชียร์</th><th>สถานะ</th></tr>'
    : '<tr><th>' + (b.level === 'year' ? 'เดือน' : 'วันที่') + '</th><th class="r">บิล</th><th class="r">ยอดขาย</th><th class="r">เงินสด</th><th class="r">QR</th><th class="r">โอน</th><th class="r">คืนสินค้า</th><th class="r">ยกเลิก</th><th class="r">สุทธิ</th><th></th></tr>';
  if (b.level === 'search') crumb = '<nav class="crumb"><button data-act="billsGo" data-l="month" data-k="' + b.m + '">‹ กลับ</button><span>›</span><button class="on">ค้นหา "' + esc(b.q) + '"</button></nav>';
  return '<div class="page" style="flex-direction:column"><div class="row" style="flex-wrap:wrap;gap:10px">' + crumb + '<span class="grow"></span>' + search + step + '</div>' +
    '<div class="kpis" id="bkpi"></div>' +
    '<div class="card" style="flex:1;overflow:auto"><table class="table"><thead>' + head + '</thead><tbody id="bills"><tr><td colspan="10" class="muted">กำลังโหลด…</td></tr></tbody></table></div></div>';
}

function billsKpis(t) {
  var k = function (l, v, sub) { return '<div class="card kpi"><div class="muted">' + l + '</div><div class="v num">' + v + '</div>' + (sub ? '<div class="muted" style="font-size:12px">' + sub + '</div>' : '') + '</div>'; };
  $('#bkpi').innerHTML = k('ยอดขายสุทธิ', '฿' + money(t.net), t.returned ? 'ขาย ฿' + money(t.total) + ' − คืน ฿' + money(t.returned) : '') +
    k('จำนวนบิล', t.bills, t.bills ? 'เฉลี่ย ฿' + money(t.total / t.bills) + ' / บิล' : '') +
    k('เงินสด · QR · โอน', '฿' + money(t.cash), 'QR ฿' + money(t.qr) + ' · โอน ฿' + money(t.transfer)) +
    k('ยกเลิกบิล', t.voids, t.voids ? '฿' + money(t.voidTotal) : '');
}

function loadBills() {
  var b = billsState();
  var tb = $('#bills');
  if (b.level === 'day' || b.level === 'search') {
    return (b.level === 'search' ? api('findBills', S.token, b.q) : api('listBills', S.token, b.d)).then(function (rows) {
      tb = $('#bills');
      if (!tb) return;
      var t = { bills: 0, total: 0, cash: 0, qr: 0, transfer: 0, voids: 0, voidTotal: 0, returned: 0 };
      rows.forEach(function (r) {
        if (r.status === 'VOID') { t.voids++; t.voidTotal += r.total; return; }
        t.bills++; t.total += r.total; t.returned += r.returnedTotal || 0;
        var pp = r.payments || {}; t.cash += pp.cash || 0; t.qr += pp.qr || 0; t.transfer += pp.transfer || 0;
      });
      t.net = t.total - t.returned;
      billsKpis(t);
      tb.innerHTML = rows.length ? rows.map(function (r) {
        return '<tr class="click" data-act="billDetail" data-no="' + esc(r.billNo) + '"><td class="num">' + esc(r.billNo) + '</td><td>' + (b.level === 'search' ? dateTime(r.createdAt) : timeOf(r.createdAt)) +
          '</td><td class="r num">' + r.itemsCount + '</td><td class="r num">' + money(r.total) + '</td><td>' + payName(r.payMethod) +
          '</td><td>' + esc(r.cashier) + '</td><td>' + (r.status === 'VOID' ? '<span class="tag warn">ยกเลิก</span>'
            : r.returnedTotal >= r.total && r.total > 0 ? '<span class="tag gray">คืนทั้งบิล</span>'
            : r.returnedTotal > 0 ? '<span class="tag amber">คืนบางส่วน −' + money(r.returnedTotal) + '</span>' : '<span class="tag green">ปกติ</span>') + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="muted">' + (b.level === 'search' ? 'ไม่พบบิลที่ตรงกับ "' + esc(b.q) + '"' : 'ไม่มีบิลในวันนี้') + '</td></tr>';
      if (b.level === 'search' && rows.length === 1 && b.autoOpen) { b.autoOpen = false; billDetail(rows[0].billNo); }
    }).catch(fail);
  }
  var period = b.level === 'year' ? b.y : b.m;
  return api('billSummary', S.token, period).then(function (d) {
    tb = $('#bills');
    if (!tb) return;
    billsKpis(d.total);
    var next = b.level === 'year' ? 'month' : 'day';
    tb.innerHTML = d.rows.length ? d.rows.map(function (r) {
      var label = b.level === 'year' ? TH_MONTH[Number(r.key.slice(5)) - 1] + ' ' + r.key.slice(0, 4) : dayLabel(r.key);
      return '<tr class="click" data-act="billsGo" data-l="' + next + '" data-k="' + r.key + '"><td><b>' + label + '</b></td><td class="r num">' + r.bills +
        '</td><td class="r num">' + money(r.total) + '</td><td class="r num">' + money(r.cash) + '</td><td class="r num">' + money(r.qr) + '</td><td class="r num">' + money(r.transfer) +
        '</td><td class="r num">' + (r.returned ? '<span class="warn-text">−' + money(r.returned) + '</span>' : '<span class="muted">–</span>') +
        '</td><td class="r num">' + (r.voids ? r.voids : '<span class="muted">–</span>') + '</td><td class="r num"><b>' + money(r.net) + '</b></td><td class="r muted">›</td></tr>';
    }).join('') + '<tr class="sumrow"><td><b>รวม</b></td><td class="r num"><b>' + d.total.bills + '</b></td><td class="r num"><b>' + money(d.total.total) + '</b></td><td class="r num">' + money(d.total.cash) +
      '</td><td class="r num">' + money(d.total.qr) + '</td><td class="r num">' + money(d.total.transfer) + '</td><td class="r num">' + (d.total.returned ? '−' + money(d.total.returned) : '–') +
      '</td><td class="r num">' + (d.total.voids || '–') + '</td><td class="r num"><b>' + money(d.total.net) + '</b></td><td></td></tr>'
      : '<tr><td colspan="10" class="muted">ไม่มีบิลใน' + (b.level === 'year' ? 'ปีนี้' : 'เดือนนี้') + '</td></tr>';
  }).catch(fail);
}

function billsGo(level, key) {
  var b = billsState();
  b.level = level;
  if (level === 'year') b.y = key;
  if (level === 'month') { b.m = key; b.y = key.slice(0, 4); }
  if (level === 'day') { b.d = key; b.m = key.slice(0, 7); b.y = key.slice(0, 4); }
  if (level !== 'search') b.q = '';
  render(); loadBills();
}

function billsStep(dir) {
  var b = billsState();
  if (b.level === 'year') return billsGo('year', String(Number(b.y) + dir));
  if (b.level === 'month') { var d = new Date(Number(b.m.slice(0, 4)), Number(b.m.slice(5)) - 1 + dir, 1); return billsGo('month', d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
  var x = new Date(b.d + 'T00:00:00'); x.setDate(x.getDate() + dir);
  billsGo('day', fmtYmd(x));
}

function billDetail(no) {
  api('billDetail', S.token, no).then(function (rc) {
    var m = openModal('<header><h1>บิล ' + esc(rc.billNo) + '</h1><span class="muted">' + dateTime(rc.createdAt) + '</span><span class="grow"></span>' +
      (rc.status === 'VOID' ? '<span class="tag warn">ยกเลิก</span>' : '') + '</header><div class="body"><table class="table"><tbody>' +
      rc.lines.map(function (l) {
        return '<tr><td>' + esc(l.name) + ' <span class="muted">' + esc(l.unitName) + '</span>' +
          (l.returnedQty ? ' <span class="tag amber">คืนแล้ว ' + l.returnedQty + '</span>' : '') + '</td><td class="r num">' + l.qty + ' × ' + money(l.unitPrice) +
          '</td><td class="r num">' + money(l.lineTotal) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="row" style="justify-content:space-between"><span>ยอดสุทธิ (' + payName(rc.payMethod) + ')' + (rc.discount ? ' · ลด ' + money(rc.discount) : '') +
      '</span><b class="num" style="font-size:20px">฿' + money(rc.total) + '</b></div>' +
      (rc.voidReason ? '<div class="warn-text">เหตุผลยกเลิก: ' + esc(rc.voidReason) + '</div>' : '') +
      (rc.returns && rc.returns.length ? '<div class="hintbox" style="color:var(--ink)">' + rc.returns.map(function (x) {
        return '<div class="row" style="justify-content:space-between"><span>' + esc(x.returnNo) + ' · ' + dateTime(x.createdAt) + ' · ' + esc(x.reason) +
          ' <span class="muted">(' + (x.refundMethod === 'cash' ? 'เงินสด' : 'โอน') + (x.restock ? '' : ' · ไม่คืนสต็อก') + ' · ' + esc(x.user) + ')</span></span><b class="num warn-text">−฿' + money(x.total) + '</b></div>';
      }).join('') + '</div>' : '') +
      '</div><footer><button class="btn" data-x="print">พิมพ์ซ้ำ</button>' +
      (rc.status === 'VOID' ? '' : !S.isCounter ? '<button class="btn" disabled title="คืนสินค้าได้เฉพาะเครื่องหน้าร้าน">คืนสินค้า</button>'
        : rc.lines.some(function (l) { return l.qty > (l.returnedQty || 0); }) ? '<button class="btn" data-x="return">คืนสินค้า</button>' : '') +
      (rc.status !== 'VOID' && S.isCounter && !rc.returnedTotal ? '<button class="btn warn" data-x="void">ยกเลิกบิล</button>' : '') +
      '<button class="btn primary" data-x="close">ปิด</button></footer>', { wide: false });
    $('[data-x=print]', m).onclick = function () { printReceipt(rc); };
    $('[data-x=close]', m).onclick = function () { closeModal(); };
    var rb = $('[data-x=return]', m);
    if (rb) rb.onclick = function () {
      if (rc.lines[0] && rc.lines[0].lineNo === undefined) return toast('ต้องอัปเดต Apps Script เป็นเวอร์ชันล่าสุดก่อน จึงจะคืนสินค้าได้', true);
      closeModal(); returnModal(rc);
    };
    var vb = $('[data-x=void]', m);
    if (vb) vb.onclick = function () {
      prompt2('ยกเลิกบิล ' + rc.billNo, 'เหตุผล (บังคับ)', '', { ok: 'ถัดไป' }).then(function (reason) {
        if (!reason || !reason.trim()) return;
        return approval('VOID', 'อนุมัติยกเลิกบิล ฿' + money(rc.total)).then(function (id) {
          if (id === null) return;
          return api('voidSale', S.token, rc.billNo, reason.trim(), id).then(function () {
            closeModal(); toast('ยกเลิกบิลแล้ว · คืนสต็อกแล้ว'); loadBills(); reloadCatalog();
          });
        });
      }).catch(fail);
    };
  }).catch(fail);
}

var RETURN_REASONS = ['ลูกค้าเปลี่ยนใจ', 'ลูกค้าไม่พอใจ', 'ซื้อเกินจำนวน', 'หยิบผิดชิ้น', 'สินค้าชำรุด', 'หมดอายุ', 'คิดเงินผิด', 'เครื่องดื่มชงผิด'];

/** Partial return: pick quantities per line, refund by cash (from this shift's drawer) or transfer. */
function isRecipeSku(sku) { var p = S.idx.bySku[sku]; return !!(p && p.type === 'recipe'); }

function returnModal(rc) {
  var st = { uid: 'R' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), q: {}, method: S.shift ? 'cash' : 'transfer', busy: false };
  var sumLT = rc.lines.reduce(function (a, l) { return a + l.lineTotal; }, 0);
  var billDisc = round2(rc.discount - rc.lines.reduce(function (a, l) { return a + l.lineDiscount; }, 0));
  var refundOf = function (l, q) { var net = sumLT ? l.lineTotal - billDisc * l.lineTotal / sumLT : 0; return round2(net * q / l.qty); };
  var m = openModal('<header><h1>คืนสินค้า · บิล ' + esc(rc.billNo) + '</h1><span class="muted">' + dateTime(rc.createdAt) + '</span></header>' +
    '<div class="body" style="gap:12px"><div class="su-lines" id="rt-lines"></div>' +
    (billDisc > 0 ? '<div class="muted" style="font-size:13px">บิลนี้มีส่วนลดท้ายบิล ฿' + money(billDisc) + ' — เงินคืนหักส่วนลดตามสัดส่วนแล้ว</div>' : '') +
    '<div class="field"><label>คืนเงินเป็น</label><div class="seg-sm" id="rt-m"><button data-m="cash"' + (S.shift ? '' : ' disabled title="ต้องเปิดกะก่อน"') + '>เงินสด (จากลิ้นชัก)</button><button data-m="transfer">โอนคืน</button></div></div>' +
    '<div id="rt-stock" class="rt-stock"></div>' +
    '<div class="muted" style="font-size:13px">สินค้าปกติกลับเข้าสต็อกทั้งหมด · ถ้ามีชิ้นที่เสีย ไปตัดที่หน้าสต็อก › ตัดของเสีย ทีหลังได้ ลูกค้าไม่ต้องรอ</div>' +
    '<div class="field"><label for="rt-why">เหตุผล</label><input id="rt-why" maxlength="100" autocomplete="off" placeholder="เช่น ลูกค้าซื้อเกิน">' +
    '<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px">' + RETURN_REASONS.map(function (r) {
      return '<button type="button" class="chip" data-why="' + r + '" style="height:32px;font-size:13px;padding:0 12px">' + r + '</button>';
    }).join('') + '</div></div></div>' +
    '<footer><span class="grow"><span class="muted" style="font-size:13px">คืนเงิน</span> <b class="num warn-text" id="rt-total" style="font-size:22px">฿0.00</b></span>' +
    '<button class="btn" data-x="no">ยกเลิก</button><button class="btn primary" data-x="ok">บันทึกคืนสินค้า</button></footer>');
  var draw = function () {
    $('#rt-lines', m).innerHTML = rc.lines.map(function (l) {
      var left = l.qty - l.returnedQty, q = st.q[l.lineNo] || 0, made = isRecipeSku(l.sku);
      return '<div class="su-line' + (made ? ' nostock' : '') + '"><div><b>' + esc(l.name) + '</b> <span class="muted">' + esc(l.unitName) + '</span>' +
        (made ? ' <span class="tag amber">ไม่รับเข้าสต็อก</span>' : '') + '<div class="muted" style="font-size:12px">ซื้อ ' + l.qty +
        (l.returnedQty ? ' · คืนแล้ว ' + l.returnedQty : '') + ' · ' + money(l.lineTotal) + ' บาท' + (made ? ' · เครื่องดื่มชง คืนเงินได้ แต่ของไม่กลับเข้าสต็อก' : '') + '</div></div>' +
        (left > 0 ? '<div class="row" style="gap:10px"><span class="num muted" style="font-size:13px">' + (q ? '−' + money(refundOf(l, q)) : '') + '</span><div class="qty"><button type="button" data-l="' + l.lineNo + '" data-d="-1" aria-label="ลด">−</button>' +
          '<span class="n num">' + q + '</span><button type="button" data-l="' + l.lineNo + '" data-d="1" aria-label="เพิ่ม">+</button></div></div>' : '<span class="tag gray">คืนครบแล้ว</span>') + '</div>';
    }).join('');
    var total = rc.lines.reduce(function (a, l) { return a + (st.q[l.lineNo] ? refundOf(l, st.q[l.lineNo]) : 0); }, 0);
    var all = rc.lines.every(function (l) { return (st.q[l.lineNo] || 0) + l.returnedQty >= l.qty; });
    if (all) total = round2(rc.total - (rc.returnedTotal || 0));
    var inN = 0, outN = 0;
    rc.lines.forEach(function (l) { var q = st.q[l.lineNo] || 0; if (isRecipeSku(l.sku)) outN += q; else inN += q; });
    $('#rt-stock', m).innerHTML = (inN ? '<span class="tag green">เข้าสต็อก ' + inN + ' ชิ้น</span>' : '') +
      (outN ? '<span class="tag amber">ไม่รับเข้าสต็อก ' + outN + ' ชิ้น (เครื่องดื่มชง)</span>' : '');
    $('#rt-total', m).textContent = '฿' + money(total);
    $all('#rt-m button', m).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-m') === st.method); });
  };
  m.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t || t.disabled) return;
    if (t.hasAttribute('data-l')) {
      var n = Number(t.getAttribute('data-l')), l = rc.lines.filter(function (x) { return x.lineNo === n; })[0];
      st.q[n] = Math.max(0, Math.min(l.qty - l.returnedQty, (st.q[n] || 0) + Number(t.getAttribute('data-d'))));
      draw();
    } else if (t.hasAttribute('data-m')) { st.method = t.getAttribute('data-m'); draw(); }
    else if (t.hasAttribute('data-why')) {
      $('#rt-why', m).value = t.getAttribute('data-why');
      $all('[data-why]', m).forEach(function (c) { c.classList.toggle('on', c === t); });
    } else if (t.getAttribute('data-x') === 'no') closeModal();
    else if (t.getAttribute('data-x') === 'ok') save();
  });
  var save = function () {
    if (st.busy) return;
    var lines = rc.lines.filter(function (l) { return st.q[l.lineNo] > 0; }).map(function (l) { return { lineNo: l.lineNo, qty: st.q[l.lineNo] }; });
    if (!lines.length) return toast('กด + ที่รายการที่จะคืน', true);
    var why = $('#rt-why', m).value.trim();
    if (!why) { toast('ใส่เหตุผล', true); $('#rt-why', m).focus(); return; }
    approval('RETURN', 'อนุมัติคืนสินค้า ' + $('#rt-total', m).textContent).then(function (id) {
      if (id === null) return;
      st.busy = true;
      return api('returnSale', S.token, { returnUid: st.uid, billNo: rc.billNo, lines: lines, refundMethod: st.method,
        reason: why, approvalId: id }).then(function (r) {
        closeModal();
        if (r.refundMethod === 'cash') openDrawer(true);
        var outQ = (r.lines || []).filter(function (x) { return !x.restocked; }).reduce(function (a, x) { return a + x.qty; }, 0);
        var inQ = (r.lines || []).filter(function (x) { return x.restocked; }).reduce(function (a, x) { return a + x.qty; }, 0);
        toast('คืนสินค้าแล้ว ' + r.returnNo + ' · คืนเงิน ฿' + money(r.total) + (r.refundMethod === 'cash' ? ' (เงินสด)' : ' (โอน)') +
          (inQ ? ' · เข้าสต็อก ' + inQ : '') + (outQ ? ' · ไม่รับเข้าสต็อก ' + outQ : ''));
        loadBills(); reloadCatalog();
      });
    }).catch(function (e) { st.busy = false; fail(e); });
  };
  draw();
}

/* =================================================================== */
/* Products                                                            */
/* =================================================================== */

/* ---------------- Bulk price edit (owner) ---------------- */

/* =================================================================== */
/* Labels: shelf price tags, barcode stickers, promotion signs          */
/* =================================================================== */

var LAB_KINDS = [['shelf', 'ป้ายราคาหน้าชั้น'], ['sticker', 'สติกเกอร์บาร์โค้ด'], ['promo', 'ป้ายโปรโมชั่น']];
/* A4 layouts: [id, label, cols, rows] — labels fill the page edge to edge (common sticker sheets) */
var LAB_A4 = {
  shelf: [['a4-24', '24 ดวง (3×8 · 70×37 มม.)', 3, 8], ['a4-14', '14 ดวง (2×7 · 105×42 มม.)', 2, 7], ['a4-40', '40 ดวง (4×10 · 52×30 มม.)', 4, 10]],
  sticker: [['a4-40', '40 ดวง (4×10 · 52×30 มม.)', 4, 10], ['a4-65', '65 ดวง (5×13 · 42×23 มม.)', 5, 13], ['a4-24', '24 ดวง (3×8 · 70×37 มม.)', 3, 8]],
  promo: [['a4-4', '4 ป้าย (A6 · 105×148 มม.)', 2, 2], ['a4-2', '2 ป้าย (A5 · 210×148 มม.)', 1, 2], ['a4-1', '1 ป้าย (เต็ม A4)', 1, 1], ['a4-8', '8 ป้าย (105×74 มม.)', 2, 4]]
};
var LAB_ROLL = { shelf: [50, 30], sticker: [40, 30], promo: [100, 75] };

function labState() {
  if (!S.lab) {
    var saved = {};
    try { saved = JSON.parse(store('em_labels') || '{}') || {}; } catch (e) { saved = {}; }
    S.lab = Object.assign({ kind: 'shelf', paper: 'a4', a4: {}, roll: {}, receiptW: 80, opts: { barcode: true, price: true, shop: true } }, saved, { items: [], promos: {} });
  }
  return S.lab;
}
function labSave() { var l = S.lab; store('em_labels', JSON.stringify({ kind: l.kind, paper: l.paper, a4: l.a4, roll: l.roll, receiptW: l.receiptW, opts: l.opts })); }

/** Size of one label in mm, and how they sit on the paper. */
function labLayout() {
  var l = labState(), k = l.kind;
  if (l.paper === 'a4') {
    var pre = LAB_A4[k].filter(function (x) { return x[0] === l.a4[k]; })[0] || LAB_A4[k][0];
    return { paper: 'a4', id: pre[0], cols: pre[2], rows: pre[3], w: 210 / pre[2], h: 297 / pre[3], pageW: 210, pageH: 297 };
  }
  if (l.paper === 'roll') {
    var r = l.roll[k] || LAB_ROLL[k];
    return { paper: 'roll', cols: 1, rows: 1, w: Number(r[0]) || LAB_ROLL[k][0], h: Number(r[1]) || LAB_ROLL[k][1] };
  }
  var w = Number(l.receiptW) === 58 ? 48 : 72;
  return { paper: 'receipt', cols: 1, rows: 1, w: w, h: k === 'promo' ? w * 1.1 : k === 'shelf' ? w * 0.55 : w * 0.6 };
}

/** Barcode as inline SVG (EAN-13 / EAN-8 / UPC when the digits fit, otherwise Code 128). */
function barcodeSvg(code, withText) {
  if (!window.JsBarcode || !code) return '';
  code = String(code);
  var fmt = /^\d{13}$/.test(code) ? 'EAN13' : /^\d{8}$/.test(code) ? 'EAN8' : /^\d{12}$/.test(code) ? 'UPC' : 'CODE128';
  var el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try { JsBarcode(el, code, { format: fmt, displayValue: !!withText, margin: 0, height: 60, width: 2, fontSize: 18, textMargin: 2, flat: fmt === 'CODE128' }); }
  catch (e) { try { JsBarcode(el, code, { format: 'CODE128', displayValue: !!withText, margin: 0, height: 60, width: 2, fontSize: 18 }); } catch (x) { return ''; } }
  var w = el.getAttribute('width'), h = el.getAttribute('height');
  el.setAttribute('viewBox', '0 0 ' + parseFloat(w) + ' ' + parseFloat(h));
  el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  el.setAttribute('width', '100%'); el.setAttribute('height', '100%');
  el.removeAttribute('style');
  return el.outerHTML;
}

/** Units a product can be labelled in: the piece itself plus each barcode unit. */
function labUnits(sku) {
  var p = S.idx.bySku[sku];
  if (!p) return [];
  var codes = codesOf(sku);
  var out = codes.map(function (b) { return { barcode: b.barcode, name: b.unitName || p.unit || 'ชิ้น', mult: b.multiplier, price: unitPriceOf(p, b) }; });
  if (!codes.some(function (b) { return b.multiplier === 1; })) out.unshift({ barcode: '', name: p.unit || 'ชิ้น', mult: 1, price: Number(p.price) || 0 });
  return out;
}
/** What goes in the bars: the unit's barcode, else the PLU (the till reads it too). */
function labCode(sku, barcode) {
  if (barcode) return barcode;
  var p = S.idx.bySku[sku];
  return p && p.plu ? String(p.plu) : '';
}

function labAdd(sku, barcode, copies) {
  var l = labState(), p = S.idx.bySku[sku];
  if (!p) return;
  if (barcode === undefined) { var u = labUnits(sku); barcode = u.length ? u[0].barcode : ''; }
  var key = sku + '|' + barcode;
  var ex = l.items.filter(function (x) { return x.key === key; })[0];
  if (ex) ex.copies += copies || 1;
  else l.items.push({ key: key, sku: sku, barcode: barcode, copies: copies || 1 });
}

function renderLabels() {
  var l = labState(), lay = labLayout();
  var cats = categories().map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  var kinds = LAB_KINDS.map(function (k) { return '<button type="button" data-act="labKind" data-k="' + k[0] + '" class="' + (l.kind === k[0] ? 'on' : '') + '">' + k[1] + '</button>'; }).join('');
  var papers = [['a4', 'กระดาษ A4'], ['roll', 'ม้วนสติกเกอร์'], ['receipt', 'เครื่องพิมพ์ใบเสร็จ']].map(function (x) {
    return '<button type="button" data-act="labPaper" data-p="' + x[0] + '" class="' + (l.paper === x[0] ? 'on' : '') + '">' + x[1] + '</button>';
  }).join('');
  var paperOpts = l.paper === 'a4' ? '<div class="field"><label for="lab-a4">แบบแผ่น</label><select id="lab-a4" data-change="labA4">' + LAB_A4[l.kind].map(function (x) {
      return '<option value="' + x[0] + '"' + (x[0] === lay.id ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>'
    : l.paper === 'roll' ? '<div class="row" style="gap:8px"><div class="field"><label for="lab-rw">กว้าง (มม.)</label><input id="lab-rw" type="number" data-change="labRoll" value="' + lay.w + '" style="width:90px"></div>' +
      '<div class="field"><label for="lab-rh">สูง (มม.)</label><input id="lab-rh" type="number" data-change="labRoll" value="' + lay.h + '" style="width:90px"></div></div>'
    : '<div class="field"><label for="lab-rcw">ขนาดกระดาษ</label><select id="lab-rcw" data-change="labRcw"><option value="80">80 มม.</option><option value="58"' + (Number(l.receiptW) === 58 ? ' selected' : '') + '>58 มม.</option></select></div>';
  var opt = function (k, t) { return '<label class="row" style="gap:6px"><input type="checkbox" data-change="labOpt" data-o="' + k + '"' + (l.opts[k] ? ' checked' : '') + '> ' + t + '</label>'; };
  var opts = l.kind === 'shelf' ? opt('barcode', 'มีบาร์โค้ด') + opt('shop', 'ชื่อร้าน')
    : l.kind === 'sticker' ? opt('price', 'มีราคา') + opt('shop', 'ชื่อร้าน') : opt('shop', 'ชื่อร้าน');
  var recent = (S.lastPriceSkus || []).length;
  var adders = l.kind === 'promo' ? '' :
    '<div class="row" style="gap:8px;flex-wrap:wrap"><label class="sr" for="lab-q">เพิ่มสินค้า</label><input id="lab-q" class="grow" autocomplete="off" placeholder="พิมพ์ชื่อ หรือสแกนบาร์โค้ดเพื่อเพิ่ม" style="min-width:200px">' +
    '<select data-change="labCat" aria-label="เพิ่มทั้งหมวด" style="width:170px"><option value="">+ ทั้งหมวด…</option>' + cats + '</select></div><div id="lab-sug" class="pe-sug"></div>' +
    '<div class="row" style="gap:6px;flex-wrap:wrap">' + (recent ? '<button class="btn sm" data-act="labRecent">+ ราคาเพิ่งเปลี่ยน (' + recent + ')</button>' : '') +
    '<button class="btn sm" data-act="labPromoItems">+ สินค้าที่มีโปร</button>' + (l.items.length ? '<button class="btn sm ghost" data-act="labClear">ล้างรายการ</button>' : '') + '</div>';
  return '<div class="page lab-page"><section class="card pad col lab-left" style="gap:12px">' +
    '<div class="row" style="gap:8px;flex-wrap:wrap"><h2 style="margin:0">พิมพ์ป้าย</h2><span class="grow"></span><button class="btn" data-act="labClose">‹ กลับหน้าสินค้า</button></div>' +
    '<div class="seg lab-seg">' + kinds + '</div>' + adders + '<div id="lab-items" class="lab-items"></div></section>' +
    '<section class="card pad col lab-right" style="gap:10px"><div class="seg lab-seg">' + papers + '</div>' + paperOpts +
    '<div class="row" style="gap:14px;flex-wrap:wrap">' + opts + '</div>' +
    '<div class="muted" style="font-size:13px" id="lab-info"></div><div class="lab-preview" id="lab-prev"></div>' +
    '<button class="btn primary lg" data-act="labPrint" id="lab-print">พิมพ์</button>' +
    '<div class="muted" style="font-size:12px">ตอนพิมพ์: ตั้งขนาดกระดาษให้ตรง · ระยะขอบ "ไม่มี" · สเกล 100% (ไม่ย่อให้พอดี)</div></section></div>';
}

/** Promotions a sign can be printed for: on now or starting later. */
function labPromoList() {
  var d = today();
  return (S.promos || []).filter(function (p) { return p.active && (!p.endDate || p.endDate >= d); });
}

function drawLabItems() {
  var box = $('#lab-items'), l = labState();
  if (!box) return;
  if (l.kind === 'promo') {
    var list = labPromoList();
    box.innerHTML = list.length ? list.map(function (p) {
      var n = l.promos[p.promoId] || 0;
      return '<div class="lab-row' + (n ? ' on' : '') + '"><div class="col" style="gap:1px;min-width:0;flex:1"><b>' + esc(p.name) + '</b><span class="muted" style="font-size:13px">' + esc(promoText(p)) + ' · ' + esc(promoWhenText(p)) + '</span></div>' +
        '<div class="qty"><button data-act="labPromoN" data-id="' + esc(p.promoId) + '" data-d="-1" aria-label="ลด">−</button><b class="num">' + n + '</b><button data-act="labPromoN" data-id="' + esc(p.promoId) + '" data-d="1" aria-label="เพิ่ม">+</button></div></div>';
    }).join('') : '<div class="empty">ยังไม่มีโปรโมชั่นที่เปิดอยู่ — สร้างได้ที่ หน้าสินค้า › โปรโมชั่น</div>';
    drawLabPreview();
    return;
  }
  box.innerHTML = l.items.length ? l.items.map(function (it, i) {
    var p = S.idx.bySku[it.sku], units = labUnits(it.sku);
    var u = units.filter(function (x) { return x.barcode === it.barcode; })[0] || units[0];
    var code = labCode(it.sku, it.barcode);
    var warn = l.kind === 'sticker' && !code ? '<div class="warn-text" style="font-size:12px">ไม่มีบาร์โค้ด/PLU ' +
      (S.user.role === 'owner' && p.type !== 'recipe' ? '<button class="btn sm" data-act="labMakeCode" data-i="' + i + '">สร้างโค้ดภายใน</button>' : '— ตั้ง PLU หรือบาร์โค้ดในหน้าสินค้า') + '</div>' : '';
    return '<div class="lab-row"><div class="col" style="gap:2px;min-width:0;flex:1"><b>' + esc(p ? p.name : it.sku) + '</b>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap">' + (units.length > 1 ? '<select data-labunit="' + i + '" aria-label="หน่วย" style="height:32px;font-size:13px;width:auto">' + units.map(function (x) {
        return '<option value="' + esc(x.barcode) + '"' + (x === u ? ' selected' : '') + '>' + esc(x.name) + (x.mult > 1 ? ' (' + x.mult + ')' : '') + ' ฿' + money(x.price) + '</option>'; }).join('') + '</select>'
        : '<span class="muted" style="font-size:13px">' + esc(u ? u.name : '') + ' · ฿' + money(u ? u.price : 0) + '</span>') +
      (code ? '<span class="muted num" style="font-size:12px">' + esc(code) + (it.barcode ? '' : ' (PLU)') + '</span>' : '') + '</div>' + warn + '</div>' +
      '<div class="qty"><button data-act="labN" data-i="' + i + '" data-d="-1" aria-label="ลด">−</button><b class="num">' + it.copies + '</b><button data-act="labN" data-i="' + i + '" data-d="1" aria-label="เพิ่ม">+</button></div>' +
      '<button class="btn sm ghost" data-act="labDel" data-i="' + i + '" aria-label="เอาออก">✕</button></div>';
  }).join('') : '<div class="empty">ยังไม่มีรายการ — ค้นหา/สแกนสินค้า หรือกดปุ่มเพิ่มด้านบน</div>';
  drawLabPreview();
}

/* ---- one label's HTML (sizes in mm) ---- */
function labelHtml(kind, data, w, h) {
  var l = labState(), shop = l.opts.shop ? esc(S.settings.shopName || '') : '';
  var f = function (mm) { return 'font-size:' + (Math.round(mm * 100) / 100) + 'mm'; };
  var box = 'width:' + w + 'mm;height:' + h + 'mm';
  if (kind === 'promo') {
    var p = data, pb = promoBig(p);
    var s = Math.min(w / 80, h / 80);   // scale against an 80×80 mm sign
    return '<div class="lab lab-promo" style="' + box + '"><div class="lp-band" style="' + f(6 * s) + '">โปรโมชั่น</div>' +
      '<div class="lp-body"><div class="lp-name" style="' + f(6.2 * s) + '">' + esc(p.name) + '</div>' +
      '<div class="lp-big" style="' + f(14 * s) + '">' + esc(pb.big) + '</div>' +
      (pb.was ? '<div class="lp-was" style="' + f(4.6 * s) + '">ปกติ ' + esc(pb.was) + '</div>' : '') +
      '<div class="lp-sub" style="' + f(3.6 * s) + '">' + esc(promoText(p)) + '</div></div>' +
      '<div class="lp-foot" style="' + f(3.2 * s) + '"><span>' + esc(promoWhenText(p)) + '</span><span>' + shop + '</span></div></div>';
  }
  var p2 = S.idx.bySku[data.sku], units = labUnits(data.sku);
  var u = units.filter(function (x) { return x.barcode === data.barcode; })[0] || units[0] || { name: '', price: 0, mult: 1 };
  var code = labCode(data.sku, data.barcode);
  var name = esc(p2 ? p2.name : data.sku), unit = esc(u.name + (u.mult > 1 ? ' (' + u.mult + ' ชิ้น)' : ''));
  if (kind === 'sticker') {
    var withPrice = l.opts.price;
    return '<div class="lab lab-stk" style="' + box + '"><div class="ls-top" style="' + f(Math.min(h * 0.12, w * 0.07)) + '"><span class="ls-name">' + name + '</span>' +
      (withPrice ? '<b>฿' + money(u.price) + '</b>' : '') + '</div>' +
      '<div class="ls-code">' + (code ? barcodeSvg(code, true) : '<span style="' + f(h * 0.1) + '">ไม่มีบาร์โค้ด</span>') + '</div>' +
      (shop ? '<div class="ls-shop" style="' + f(Math.min(h * 0.08, 2.4)) + '">' + shop + '</div>' : '') + '</div>';
  }
  var big = money(u.price).split('.');
  var withCode = l.opts.barcode && code;
  return '<div class="lab lab-shelf" style="' + box + '"><div class="lsh-name" style="' + f(Math.min(h * 0.13, w * 0.075)) + '">' + name + '</div>' +
    '<div class="lsh-mid"><div class="lsh-unit" style="' + f(Math.min(h * 0.09, 3.2)) + '">' + unit + (shop ? '<br>' + shop : '') + '</div>' +
    '<div class="lsh-price" style="' + f(Math.min(h * (withCode ? 0.36 : 0.46), w * 0.22)) + '"><small>฿</small>' + big[0] + (big[1] !== '00' ? '<small>.' + big[1] + '</small>' : '') + '</div></div>' +
    (withCode ? '<div class="lsh-code">' + barcodeSvg(code, true) + '</div>' : '') + '</div>';
}

/** Every label to print, in order (copies expanded). */
function labList() {
  var l = labState(), out = [];
  if (l.kind === 'promo') labPromoList().forEach(function (p) { for (var i = 0; i < (l.promos[p.promoId] || 0); i++) out.push(p); });
  else l.items.forEach(function (it) { for (var i = 0; i < it.copies; i++) out.push(it); });
  return out;
}

/** Pages of labels (HTML) for the print area. */
function labPages(limitPages) {
  var l = labState(), lay = labLayout(), all = labList(), pages = [];
  var per = lay.cols * lay.rows;
  if (lay.paper === 'a4') {
    for (var i = 0; i < all.length && (!limitPages || pages.length < limitPages); i += per) {
      pages.push('<div class="lab-sheet" style="width:210mm;height:297mm;grid-template-columns:repeat(' + lay.cols + ',' + lay.w + 'mm);grid-template-rows:repeat(' + lay.rows + ',' + lay.h + 'mm)">' +
        all.slice(i, i + per).map(function (d) { return labelHtml(l.kind, d, lay.w, lay.h); }).join('') + '</div>');
    }
  } else if (lay.paper === 'roll') {
    all.slice(0, limitPages ? limitPages * 4 : all.length).forEach(function (d) { pages.push('<div class="lab-one">' + labelHtml(l.kind, d, lay.w, lay.h) + '</div>'); });
  } else {
    pages.push('<div class="lab-strip">' + all.slice(0, limitPages ? 6 : all.length).map(function (d) { return labelHtml(l.kind, d, lay.w, lay.h); }).join('') + '</div>');
  }
  return { pages: pages, count: all.length, lay: lay };
}

function drawLabPreview() {
  var box = $('#lab-prev');
  if (!box) return;
  var r = labPages(1), lay = r.lay;
  var sheets = lay.paper === 'a4' ? Math.ceil(r.count / (lay.cols * lay.rows)) : 0;
  $('#lab-info').textContent = r.count ? r.count + ' ดวง' + (sheets ? ' · ' + sheets + ' แผ่น A4' : '') + ' · ขนาดดวง ' + Math.round(lay.w * 10) / 10 + '×' + Math.round(lay.h * 10) / 10 + ' มม.' : 'ยังไม่มีป้ายที่จะพิมพ์';
  $('#lab-print').disabled = !r.count;
  box.innerHTML = r.count ? '<div class="lab-scale">' + r.pages.join('') + '</div>' : '';
  var sc = $('.lab-scale', box);
  if (sc) {
    var mmPx = 96 / 25.4, wmm = lay.paper === 'a4' ? 210 : lay.w;
    var k = Math.min(1, (box.clientWidth - 16) / (wmm * mmPx));
    sc.style.transform = 'scale(' + k + ')';
    sc.style.height = (sc.scrollHeight * k) + 'px';
  }
}

function labPrint() {
  var r = labPages(0), lay = r.lay;
  if (!r.count) return;
  var size = lay.paper === 'a4' ? 'A4 portrait' : lay.paper === 'roll' ? lay.w + 'mm ' + lay.h + 'mm' : (lay.w === 48 ? '58mm' : '80mm') + ' auto';
  var st = document.getElementById('lab-page-style') || document.createElement('style');
  st.id = 'lab-page-style';
  st.textContent = '@media print{@page{size:' + size + ';margin:0}}';
  document.head.appendChild(st);
  document.body.classList.add('print-labels');
  $('#print').innerHTML = r.pages.join('');
  var done = function () { document.body.classList.remove('print-labels'); st.textContent = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 1500);
}

function labSug(q) {
  var box = $('#lab-sug');
  if (!box) return;
  q = String(q || '').trim().toLowerCase();
  if (!q) { box.innerHTML = ''; return; }
  var list = S.products.filter(function (p) { return p.active && p.forSale !== false && (p.name.toLowerCase().indexOf(q) >= 0 || String(p.sku).toLowerCase() === q || String(p.plu || '') === q); }).slice(0, 8);
  box.innerHTML = list.map(function (p) { return '<button type="button" data-act="labPick" data-sku="' + esc(p.sku) + '">' + esc(p.name) + ' <span class="muted">฿' + money(p.price) + '</span></button>'; }).join('') ||
    '<div class="muted" style="padding:6px">ไม่พบสินค้า</div>';
}
/** Enter in the add box: a scanned barcode adds that unit; text adds the first match. */
function labEnter(v) {
  v = String(v || '').trim();
  if (!v) return;
  var b = S.idx.byBarcode[v];
  if (b) labAdd(b.sku, b.barcode);
  else {
    var p = S.idx.byPlu[v] || S.products.filter(function (x) { return x.active && x.forSale !== false && x.name.toLowerCase().indexOf(v.toLowerCase()) >= 0; })[0];
    if (!p) return toast('ไม่พบสินค้า "' + v + '"', true);
    labAdd(p.sku);
  }
  $('#lab-q').value = ''; labSug(''); drawLabItems();
}

/** Owner: give a product without any code an internal EAN-13 (20…) so it can get stickers. */
function labMakeCode(i) {
  var it = labState().items[i], p = S.idx.bySku[it.sku];
  if (!p) return;
  api('newInternalBarcode', S.token).then(function (code) {
    var codes = codesOf(p.sku).map(function (c) { return { barcode: c.barcode, unitName: c.unitName, multiplier: c.multiplier, price: c.price === null || c.price === '' ? null : Number(c.price) }; });
    codes.push({ barcode: code, unitName: p.unit || 'ชิ้น', multiplier: 1, price: null });
    var payload = Object.assign({}, p, { type: 'barcode' });
    return api('saveProduct', S.token, payload, codes, []).then(function () { return reloadCatalog(); }).then(function () {
      it.barcode = code; it.key = it.sku + '|' + code;
      toast('สร้างโค้ดภายในแล้ว ' + code); drawLabItems();
    });
  }).catch(fail);
}

function labOpen(kind, promoId) {
  var l = labState();
  S.labelMode = true; S.bulk = null; S.promoMode = false;
  if (kind) l.kind = kind;
  if (promoId) l.promos[promoId] = (l.promos[promoId] || 0) + 1;
  if (S.view !== 'products') go('products'); else render();
  drawLabItems();
}


/* ---------------- Product photos (quick keys) ---------------- */
var IMG_CACHE = 'em-images', imgPending = {};
function imgKey(id) { return location.origin + location.pathname.replace(/[^/]*$/, '') + '__img/' + encodeURIComponent(id); }
/** Object URL of a product photo: memory, then this device, then the server (kept for next time). */
function loadImg(id) {
  S.imgUrl = S.imgUrl || {};
  if (S.imgUrl[id]) return Promise.resolve(S.imgUrl[id]);
  if (imgPending[id]) return imgPending[id];
  var key = imgKey(id);
  var keep = function (blob) { S.imgUrl[id] = URL.createObjectURL(blob); return S.imgUrl[id]; };
  var fromApi = function () {
    if (!S.token || S.offline) return Promise.reject(new Error('offline'));
    return api('productImage', S.token, id).then(function (r) { return fetch(r.dataUrl).then(function (x) { return x.blob(); }); }).then(function (blob) {
      if (window.caches) caches.open(IMG_CACHE).then(function (c) { c.put(key, new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } })); }).catch(function () {});
      return keep(blob);
    });
  };
  imgPending[id] = (window.caches ? caches.open(IMG_CACHE).then(function (c) { return c.match(key); }).then(function (hit) { return hit ? hit.blob().then(keep) : fromApi(); }) : fromApi())
    .then(function (u) { delete imgPending[id]; return u; }, function (e) { delete imgPending[id]; throw e; });
  return imgPending[id];
}
/** Swap icons for photos wherever a [data-pimg] is on screen. */
function fillImages() {
  $all('[data-pimg]').forEach(function (el) {
    var id = el.getAttribute('data-pimg');
    if (!id) return;
    if (S.imgUrl && S.imgUrl[id]) {
      if (!el.querySelector('img.kimg')) { el.innerHTML = '<img class="kimg" src="' + S.imgUrl[id] + '" alt="">'; el.classList.add('has-img'); }
    } else loadImg(id).then(fillImages).catch(function () {});
  });
}
/** Counter keeps every product photo on the device (offline sale screen, customer display). */
function syncImages() {
  if (!S.isCounter || !window.caches || !S.token || S.offline) return;
  var ids = (S.products || []).filter(function (p) { return p.image && p.active; }).map(function (p) { return p.image; });
  caches.open(IMG_CACHE).then(function (c) {
    return c.keys().then(function (keys) {
      var want = ids.map(imgKey);
      keys.forEach(function (k) { if (want.indexOf(k.url) < 0) c.delete(k); });
      return ids.reduce(function (pr, id) { return pr.then(function () { return loadImg(id).catch(function () {}); }); }, Promise.resolve());
    });
  }).then(fillImages).catch(function () {});
}
function prodImgSet(sku, image) {
  var p = S.idx.bySku[sku];
  if (p) p.image = image;
  if (S.ed && S.ed.p && S.ed.p.sku === sku) S.ed.p.image = image;
  saveCache();
  var go2 = function () { drawEditor(); renderProductRows(); };
  if (image) loadImg(image).then(go2, go2); else go2();
}

/* ---------------- Customer-display slides ---------------- */
var SLIDE_CACHE = 'em-slides';
function slideKey(id) { return location.origin + location.pathname.replace(/[^/]*$/, '') + '__slide/' + encodeURIComponent(id); }
function slideLive(sl) {
  var d = today();
  return sl.active && (!sl.startDate || sl.startDate <= d) && (!sl.endDate || sl.endDate >= d);
}
/** Image of a slide as an object URL: from this device first, else download once and keep. */
function slideUrl(id) {
  var key = slideKey(id);
  var viaApi = function () {
    return api('slideImage', S.token, id).then(function (r) { return fetch(r.dataUrl).then(function (x) { return x.blob(); }); }).then(function (blob) {
      if (window.caches) caches.open(SLIDE_CACHE).then(function (c) { c.put(key, new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } })); }).catch(function () {});
      return URL.createObjectURL(blob);
    });
  };
  if (!window.caches) return viaApi();
  return caches.open(SLIDE_CACHE).then(function (c) { return c.match(key); }).then(function (hit) {
    return hit ? hit.blob().then(function (b) { return URL.createObjectURL(b); }) : viaApi();
  });
}
/** Counter keeps every slide image on the device (the customer display reads them from here, also offline). */
function syncSlides() {
  if (!S.isCounter || !window.caches || !S.token || S.offline) return;
  var want = (S.slides || []).map(function (sl) { return slideKey(sl.slideId); });
  caches.open(SLIDE_CACHE).then(function (c) {
    return c.keys().then(function (keys) {
      var have = keys.map(function (k) { return k.url; });
      keys.forEach(function (k) { if (want.indexOf(k.url) < 0) c.delete(k); });
      var todo = (S.slides || []).filter(function (sl) { return have.indexOf(slideKey(sl.slideId)) < 0; });
      return todo.reduce(function (p, sl) { return p.then(function () { return slideUrl(sl.slideId).then(function (u) { URL.revokeObjectURL(u); }).catch(function () {}); }); }, Promise.resolve());
    });
  }).then(function () { cdPublish(); }).catch(function () {});
}
/** Headline price of a promotion: { big, was } (for slides and signs). */
function promoBig(p) {
  var it = promoItems(p), first = S.idx.bySku[String(it[0] && it[0].sku !== undefined ? it[0].sku : it[0])];
  var big = '', was = '';
  if (p.type === 'single') {
    if (first && it.length === 1) {
      var pr = Number(first.price) || 0, v = Number(p.value) || 0;
      big = '฿' + money(Math.max(0, p.discType === 'pct' ? pr * (1 - v / 100) : p.discType === 'baht' ? pr - v : v)); was = '฿' + money(pr);
    } else big = promoCut(p).replace('เหลือ ', '');
  } else if (p.type === 'multi') { big = p.buyQty + ' ชิ้น ฿' + money(p.price); if (first && it.length === 1) was = '฿' + money(first.price * p.buyQty); }
  else if (p.type === 'bxgy') big = 'ซื้อ ' + p.buyQty + ' แถม ' + p.freeQty;
  else if (p.type === 'combo') {
    big = '฿' + money(p.price);
    was = '฿' + money(it.reduce(function (a, c) { var x = S.idx.bySku[c.sku]; return a + (x ? x.price * c.qty : 0); }, 0));
  }
  return { big: big, was: was, first: first };
}
/** What the customer display cycles through while nobody is at the counter. */
function cdSlides() {
  var out = [];
  (S.slides || []).filter(slideLive).forEach(function (sl) { out.push({ kind: 'img', id: sl.slideId, key: slideKey(sl.slideId), title: sl.title }); });
  if (S.settings.slidesAuto !== '0') {
    var w = promoNow();
    (S.promos || []).filter(function (p) { return promoLive(p, w); }).forEach(function (p) {
      var pb = promoBig(p), first = pb.first, big = pb.big, was = pb.was;
      var col = first ? (KEY_COLORS[first.color] || KEY_COLORS.gray) : KEY_COLORS.gray;
      out.push({ kind: 'promo', title: p.name, sub: promoText(p), big: big, was: was, icon: first ? iconHtml(first) : '', bg: col[0], fg: col[1],
        when: p.timeFrom && p.timeTo ? 'เฉพาะ ' + p.timeFrom + '–' + p.timeTo + ' น.' : p.endDate ? 'ถึง ' + thDate(p.endDate) : '' });
    });
  }
  if (S.settings.customerPromoTitle) out.push({ kind: 'text', title: S.settings.customerPromoTitle, sub: S.settings.customerPromoText || '' });
  return out;
}
/** "Add 1 more for the deal" — shown on the customer display (and to the cashier) while scanning. */
function promoHint() {
  if (!S.cart || !S.cart.lines.length) return '';
  var w = promoNow(), cnt = {};
  S.cart.lines.forEach(function (l) { if (l.multiplier === 1 && !l.md && !l.openPrice) cnt[l.sku] = (cnt[l.sku] || 0) + l.qty; });
  var nameOf = function (k) { var x = S.idx.bySku[k]; return x ? x.name : k; };
  var order = { combo: 0, multi: 1, bxgy: 2 };
  var live = (S.promos || []).filter(function (p) { return order[p.type] !== undefined && promoLive(p, w); })
    .sort(function (a, b) { return order[a.type] - order[b.type]; });
  for (var i = 0; i < live.length; i++) {
    var p = live[i], it = promoItems(p);
    if (p.type === 'combo') {
      var has = it.some(function (c) { return cnt[c.sku]; });
      var miss = it.filter(function (c) { return (cnt[c.sku] || 0) < c.qty; });
      if (has && miss.length) return 'เพิ่ม ' + miss.map(function (c) { return nameOf(c.sku) + (c.qty - (cnt[c.sku] || 0) > 1 ? ' ×' + (c.qty - (cnt[c.sku] || 0)) : ''); }).join(' + ') + ' รับเซ็ต ฿' + money(p.price);
      continue;
    }
    var n = it.reduce(function (a, k) { return a + (cnt[String(k)] || 0); }, 0);
    if (!n) continue;
    if (p.type === 'multi' && n % p.buyQty) return 'เพิ่มอีก ' + (p.buyQty - n % p.buyQty) + ' ชิ้น รับโปร ' + p.name;
    if (p.type === 'bxgy') {
      var size = p.buyQty + p.freeQty, r = n % size;
      if (r >= p.buyQty) return 'หยิบเพิ่มอีก ' + (size - r) + ' ชิ้น ฟรี! (' + p.name + ')';
      if (r > 0) return 'ซื้ออีก ' + (p.buyQty - r) + ' ชิ้น แถมฟรี ' + p.freeQty + ' (' + p.name + ')';
    }
  }
  return '';
}

/* ---------------- Slides manager (Settings, owner) ---------------- */
function slidesCard() {
  return '<div class="card pad col" style="gap:10px"><h2>สไลด์จอลูกค้า</h2>' +
    '<div class="muted" style="font-size:13px">วนแสดงตอนไม่มีลูกค้า · โปรที่กำลังใช้ทำเป็นสไลด์ให้เอง · อัปรูปโปสเตอร์เพิ่มได้ (ย่อขนาดให้อัตโนมัติ)</div>' +
    '<div class="row" style="flex-wrap:wrap;gap:8px"><label class="btn primary" for="sl-file" style="cursor:pointer">+ อัปโหลดรูป</label>' +
    '<input id="sl-file" type="file" accept="image/*" data-change="slideFile" style="position:absolute;left:-9999px"></div>' +
    '<div id="slidelist" class="slide-list"><div class="muted">กำลังโหลด…</div></div></div>';
}
function drawSlideList() {
  var box = $('#slidelist');
  if (!box) return;
  var list = S.slides || [];
  box.innerHTML = list.length ? list.map(function (sl, i) {
    var live = slideLive(sl);
    return '<div class="slide-row' + (live ? '' : ' off') + '"><img data-slimg="' + esc(sl.slideId) + '" alt=""><div class="col" style="gap:2px;min-width:0;flex:1">' +
      '<b>' + esc(sl.title || 'ไม่มีชื่อ') + '</b><span class="muted" style="font-size:12px">' + (sl.startDate || sl.endDate ? (sl.startDate ? thDate(sl.startDate) : 'ตอนนี้') + ' – ' + (sl.endDate ? thDate(sl.endDate) : 'ไม่มีกำหนด') : 'แสดงตลอด') +
      (sl.active ? (live ? '' : ' · ยังไม่ถึง/หมดเวลา') : ' · ปิดอยู่') + '</span></div>' +
      '<div class="row" style="gap:4px;flex-wrap:wrap;justify-content:flex-end"><button class="btn sm" data-act="slideMove" data-id="' + esc(sl.slideId) + '" data-d="-1"' + (i ? '' : ' disabled') + ' aria-label="เลื่อนขึ้น">↑</button>' +
      '<button class="btn sm" data-act="slideMove" data-id="' + esc(sl.slideId) + '" data-d="1"' + (i < list.length - 1 ? '' : ' disabled') + ' aria-label="เลื่อนลง">↓</button>' +
      '<button class="btn sm" data-act="slideEdit" data-id="' + esc(sl.slideId) + '">แก้</button>' +
      '<button class="btn sm" data-act="slideToggle" data-id="' + esc(sl.slideId) + '" data-on="' + (sl.active ? '0' : '1') + '">' + (sl.active ? 'ปิด' : 'เปิด') + '</button>' +
      '<button class="btn sm ghost" data-act="slideDel" data-id="' + esc(sl.slideId) + '">ลบ</button></div></div>';
  }).join('') : '<div class="muted">ยังไม่มีรูป — สไลด์จากโปรโมชั่นยังแสดงตามปกติ</div>';
  $all('[data-slimg]', box).forEach(function (img) { slideUrl(img.getAttribute('data-slimg')).then(function (u) { img.src = u; }).catch(function () {}); });
}
function slidesChanged(list) { S.slides = list; saveCache(); drawSlideList(); syncSlides(); }
/** Shrink a photo to at most 1280 px on the long side, JPEG ~80 %. */
/**
 * Shrink a photo to at most max px on the long side. WebP (smaller, keeps transparency);
 * browsers that cannot write WebP (older Safari) get JPEG on a white background instead.
 */
function shrinkImage(file, max) {
  return new Promise(function (resolve, reject) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var k = Math.min(1, (max || 1280) / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      var cx = c.getContext('2d');
      cx.drawImage(img, 0, 0, c.width, c.height);
      var out = c.toDataURL('image/webp', 0.8);
      if (out.indexOf('data:image/webp') !== 0) {
        cx.globalCompositeOperation = 'destination-over';   // JPEG has no transparency: put white behind see-through parts
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', 0.82);
      }
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('เปิดรูปนี้ไม่ได้')); };
    img.src = url;
  });
}
function slideModal(sl, dataUrl) {
  var m = openModal('<header><h1>' + (sl ? 'แก้สไลด์' : 'เพิ่มสไลด์') + '</h1></header><div class="body" style="gap:10px">' +
    (dataUrl ? '<img src="' + dataUrl + '" alt="" style="width:100%;max-height:260px;object-fit:contain;background:var(--surface-muted);border-radius:8px">' : '') +
    '<div class="field"><label for="sl-title">ชื่อ (ไว้จำเอง)</label><input id="sl-title" value="' + esc(sl ? sl.title : '') + '" placeholder="เช่น โปรกาแฟเดือนนี้"></div>' +
    '<div class="grid3"><div class="field"><label for="sl-sd">วันเริ่ม (ว่าง = ตอนนี้)</label><input id="sl-sd" type="date" value="' + esc(sl ? sl.startDate : '') + '"></div>' +
    '<div class="field"><label for="sl-ed">วันสิ้นสุด (ว่าง = ไม่มีกำหนด)</label><input id="sl-ed" type="date" value="' + esc(sl ? sl.endDate : '') + '"></div></div></div>' +
    '<footer><button class="btn" data-x="no">ยกเลิก</button><button class="btn primary" data-x="ok">' + (sl ? 'บันทึก' : 'อัปโหลด') + '</button></footer>');
  $('[data-x=no]', m).onclick = function () { closeModal(); };
  $('[data-x=ok]', m).onclick = function () {
    var v = { title: $('#sl-title', m).value, startDate: $('#sl-sd', m).value, endDate: $('#sl-ed', m).value };
    var call = sl ? api('saveSlide', S.token, Object.assign({ slideId: sl.slideId }, v)) : api('uploadSlide', S.token, Object.assign({ dataUrl: dataUrl }, v)).then(function () { return api('listSlides', S.token); });
    call.then(function (list) { closeModal(); toast(sl ? 'บันทึกแล้ว' : 'อัปโหลดแล้ว'); slidesChanged(list); }).catch(fail);
  };
}

/* ---------------- Promotions (owner) ---------------- */
var PROMO_TYPE_TH = { single: 'ลดราคาชิ้นเดียว', multi: 'ซื้อหลายชิ้นราคาพิเศษ', bxgy: 'ซื้อ X แถม Y', combo: 'เซ็ตคอมโบ' };
var PROMO_DISC_TH = { pct: 'ลด %', baht: 'ลดเป็นบาท', price: 'ขายราคา' };
function promoCut(p) { return p.discType === 'pct' ? 'ลด ' + Number(p.value) + '%' : p.discType === 'baht' ? 'ลด ' + money(p.value) + ' บาท' : 'เหลือ ฿' + money(p.value); }
var DOW_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function renderPromos() {
  return '<div class="page" style="flex-direction:column;gap:12px"><section class="card pad col" style="gap:10px">' +
    '<div class="row" style="flex-wrap:wrap;gap:8px"><h2 style="margin:0">โปรโมชั่น</h2><span class="grow"></span>' +
    '<button class="btn" data-act="promoClose">‹ กลับหน้าสินค้า</button><button class="btn primary" data-act="promoNew">+ สร้างโปรโมชั่น</button></div>' +
    '<div class="muted" style="font-size:13px">ระบบคิดให้เองตอนสแกน · ใช้กับสินค้าที่ขายเป็นชิ้น (แพ็ค/ลังมีราคาของตัวเองอยู่แล้ว) · สินค้าลดราคาใกล้หมดอายุไม่ร่วมโปร · 1 ชิ้นเข้าได้โปรเดียว (เซ็ต → หลายชิ้น → แถม → ลดชิ้นเดียว)</div></section>' +
    '<div id="promo-rows" class="promo-list"><div class="empty">กำลังโหลด…</div></div></div>';
}

function promoStatus(p) {
  if (!p.active) return ['ปิดอยู่', 'gray'];
  var w = promoNow();
  if (p.endDate && p.endDate < w.ymd) return ['หมดเวลาแล้ว', 'gray'];
  if (p.startDate && p.startDate > w.ymd) return ['เริ่ม ' + thDate(p.startDate), 'blue'];
  return promoLive(p, w) ? ['กำลังใช้', 'green'] : ['นอกช่วงเวลา', 'amber'];
}
function promoWhenText(p) {
  var days = String(p.days || '').split(',').filter(function (d) { return d !== ''; });
  var parts = [];
  parts.push(p.startDate || p.endDate ? (p.startDate ? thDate(p.startDate) : 'ตอนนี้') + ' – ' + (p.endDate ? thDate(p.endDate) : 'ไม่มีกำหนด') : 'ทุกวัน ไม่มีกำหนดสิ้นสุด');
  if (days.length && days.length < 7) parts.push('เฉพาะ ' + days.map(function (d) { return DOW_TH[d]; }).join(' '));
  if (p.timeFrom && p.timeTo) parts.push(p.timeFrom + '–' + p.timeTo + ' น.');
  return parts.join(' · ');
}

function loadPromos() {
  return api('listPromos', S.token).then(function (list) {
    S.promoList = list;
    var box = $('#promo-rows');
    if (!box) return;
    var order = { green: 0, amber: 1, blue: 2, gray: 3 };
    list = list.slice().sort(function (a, b) { return order[promoStatus(a)[1]] - order[promoStatus(b)[1]]; });
    box.innerHTML = list.length ? list.map(function (p) {
      var st = promoStatus(p);
      return '<div class="card pad promo-card' + (st[1] === 'gray' ? ' off' : '') + '"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:8px">' +
        '<div class="col" style="gap:2px;min-width:0"><b style="font-size:16px">' + esc(p.name) + '</b><span>' + esc(promoText(p)) + '</span>' +
        '<span class="muted" style="font-size:13px">' + PROMO_TYPE_TH[p.type] + ' · ' + esc(promoWhenText(p)) + '</span></div>' +
        '<span class="tag ' + st[1] + '" style="white-space:nowrap">' + st[0] + '</span></div>' +
        '<div class="row" style="gap:8px;margin-top:8px"><button class="btn sm" data-act="promoEdit" data-id="' + esc(p.promoId) + '">แก้ไข</button>' +
        '<button class="btn sm" data-act="promoToggle" data-id="' + esc(p.promoId) + '" data-on="' + (p.active ? '0' : '1') + '">' + (p.active ? 'ปิดโปร' : 'เปิดโปร') + '</button>' +
        (st[1] !== 'gray' ? '<button class="btn sm" data-act="labPromo" data-id="' + esc(p.promoId) + '">พิมพ์ป้ายโปร</button>' : '') + '</div></div>';
    }).join('') : '<div class="card pad empty">ยังไม่มีโปรโมชั่น — กด "+ สร้างโปรโมชั่น"</div>';
  }).catch(fail);
}

function promoModal(id) {
  var src = id ? (S.promoList || []).filter(function (p) { return p.promoId === id; })[0] : null;
  var ed = src ? Object.assign({}, src, { items: promoItems(src).map(function (x) { return typeof x === 'object' ? Object.assign({}, x) : x; }),
    days: String(src.days || '').split(',').filter(function (d) { return d !== ''; }).map(Number) })
    : { promoId: '', name: '', type: 'single', items: [], buyQty: 2, freeQty: 1, price: '', discType: 'pct', value: '', startDate: today(), endDate: '', days: [], timeFrom: '', timeTo: '', active: true };
  var skuOf = function (it) { return typeof it === 'object' ? it.sku : it; };
  var priceOf = function (sku) { var x = S.idx.bySku[sku]; return x ? Number(x.price) || 0 : 0; };
  var m = openModal('<header><h1>' + (id ? 'แก้ไขโปรโมชั่น' : 'สร้างโปรโมชั่น') + '</h1></header><div class="body promo-ed" id="pe"></div>' +
    '<footer><button class="btn" data-x="no">ยกเลิก</button><button class="btn primary" data-x="ok">บันทึก</button></footer>', { wide: true });
  var preview = function () {
    var box = $('#pe-prev', m);
    if (!box) return;
    var txt = '';
    if (ed.type === 'combo' && ed.items.length) {
      var normal = ed.items.reduce(function (a, c) { return a + priceOf(c.sku) * (Number(c.qty) || 0); }, 0);
      txt = 'ปกติ ฿' + money(normal) + (Number(ed.price) > 0 ? ' → ฿' + money(ed.price) + ' · ลูกค้าประหยัด ฿' + money(normal - ed.price) : '');
    } else if (ed.type === 'multi' && ed.items.length) {
      var hi = Math.max.apply(null, ed.items.map(priceOf)), lo = Math.min.apply(null, ed.items.map(priceOf));
      var n = Number(ed.buyQty) || 0;
      txt = 'ซื้อปกติ ' + n + ' ชิ้น ฿' + money(lo * n) + (hi !== lo ? '–' + money(hi * n) : '') + (Number(ed.price) > 0 ? ' → ฿' + money(ed.price) : '');
    } else if (ed.type === 'single' && ed.items.length && Number(ed.value) > 0) {
      var v = Number(ed.value);
      txt = ed.items.slice(0, 3).map(function (k) {
        var pr = priceOf(k), np = ed.discType === 'pct' ? pr * (1 - Math.min(v, 100) / 100) : ed.discType === 'baht' ? pr - v : Math.min(pr, v);
        var x = S.idx.bySku[k];
        return (x ? x.name : k) + ' ฿' + money(pr) + ' → ฿' + money(Math.max(0, np));
      }).join(' · ') + (ed.items.length > 3 ? ' · …' : '');
    } else if (ed.type === 'bxgy' && ed.items.length) {
      txt = 'ทุก ' + ((Number(ed.buyQty) || 0) + (Number(ed.freeQty) || 0)) + ' ชิ้น ฟรี ' + (Number(ed.freeQty) || 0) + ' ชิ้นที่ถูกที่สุด';
    }
    box.textContent = txt;
  };
  var draw = function () {
    var chips = ed.items.map(function (it, i) {
      var sku = skuOf(it), x = S.idx.bySku[sku];
      return '<span class="pchip">' + esc(x ? x.name : sku) + ' <span class="muted">฿' + money(priceOf(sku)) + '</span>' +
        (ed.type === 'combo' ? '<span class="pq"><button type="button" data-pq="' + i + '" data-d="-1" aria-label="ลด">−</button><b>' + it.qty + '</b><button type="button" data-pq="' + i + '" data-d="1" aria-label="เพิ่ม">+</button></span>' : '') +
        '<button type="button" class="px" data-pdel="' + i + '" aria-label="เอาออก">✕</button></span>';
    }).join('');
    var num = function (key, label, step) { return '<div class="field"><label for="pe-' + key + '">' + label + '</label><input id="pe-' + key + '" data-pf="' + key + '" type="number" inputmode="decimal" min="0" step="' + (step || 1) + '" value="' + esc(ed[key]) + '"></div>'; };
    $('#pe', m).innerHTML =
      '<div class="field"><label for="pe-name">ชื่อโปรโมชั่น (ขึ้นบนใบเสร็จ)</label><input id="pe-name" data-pf="name" value="' + esc(ed.name) + '" placeholder="เช่น น้ำดื่ม 2 ขวด 12 บาท"></div>' +
      '<div class="seg pe-type">' + ['single', 'multi', 'bxgy', 'combo'].map(function (t) { return '<button type="button" data-pt="' + t + '" class="' + (ed.type === t ? 'on' : '') + '">' + PROMO_TYPE_TH[t] + '</button>'; }).join('') + '</div>' +
      '<div class="field"><label for="pe-q">' + (ed.type === 'combo' ? 'สินค้าในเซ็ต (ปรับจำนวนต่อเซ็ตได้)' : ed.type === 'single' ? 'สินค้าที่ลดราคา (เลือกได้หลายรายการ)' : 'สินค้าที่ร่วมโปร (คละกันได้)') + '</label>' +
      '<input id="pe-q" autocomplete="off" placeholder="พิมพ์ชื่อ หรือสแกนบาร์โค้ด"><div id="pe-sug" class="pe-sug"></div></div>' +
      '<div class="pchips">' + (chips || '<span class="muted">ยังไม่ได้เลือกสินค้า</span>') + '</div>' +
      '<div class="grid3">' + (ed.type === 'single' ? '<div class="field"><label for="pe-dt">วิธีลด</label><select id="pe-dt" data-pf="discType">' +
        ['pct', 'baht', 'price'].map(function (k) { return '<option value="' + k + '"' + (ed.discType === k ? ' selected' : '') + '>' + PROMO_DISC_TH[k] + '</option>'; }).join('') + '</select></div>' +
        num('value', ed.discType === 'pct' ? 'ลดกี่ %' : ed.discType === 'baht' ? 'ลดกี่บาทต่อชิ้น' : 'ราคาต่อชิ้น (บาท)', 0.25)
        : ed.type === 'multi' ? num('buyQty', 'จำนวนชิ้น') + num('price', 'ราคารวม (บาท)', 0.25)
        : ed.type === 'bxgy' ? num('buyQty', 'ซื้อ (ชิ้น)') + num('freeQty', 'แถม (ชิ้น)') : num('price', 'ราคาเซ็ต (บาท)', 0.25)) + '</div>' +
      '<div class="pe-prev brand-text" id="pe-prev"></div>' +
      '<h3 style="margin:6px 0 0;font-size:15px">ช่วงเวลา</h3>' +
      '<div class="grid3"><div class="field"><label for="pe-sd">วันเริ่ม</label><input id="pe-sd" type="date" data-pf="startDate" value="' + esc(ed.startDate) + '"></div>' +
      '<div class="field"><label for="pe-ed">วันสิ้นสุด (ว่าง = ไม่มีกำหนด)</label><input id="pe-ed" type="date" data-pf="endDate" value="' + esc(ed.endDate) + '"></div></div>' +
      '<div class="field"><label>วัน (ไม่เลือก = ทุกวัน)</label><div class="row" style="gap:6px;flex-wrap:wrap">' + DOW_TH.map(function (d, i) {
        return '<button type="button" class="chip' + (ed.days.indexOf(i) >= 0 ? ' on' : '') + '" data-pd="' + i + '">' + d + '</button>'; }).join('') + '</div></div>' +
      '<div class="grid3"><div class="field"><label for="pe-tf">ตั้งแต่เวลา</label><input id="pe-tf" type="time" data-pf="timeFrom" value="' + esc(ed.timeFrom) + '"></div>' +
      '<div class="field"><label for="pe-tt">ถึงเวลา (ว่าง = ทั้งวัน)</label><input id="pe-tt" type="time" data-pf="timeTo" value="' + esc(ed.timeTo) + '"></div></div>' +
      '<label class="row" style="gap:8px"><input type="checkbox" data-pf="active"' + (ed.active ? ' checked' : '') + '> เปิดใช้โปรนี้</label>';
    preview();
  };
  var addSku = function (sku) {
    if (ed.items.some(function (it) { return skuOf(it) === sku; })) return toast('เลือกสินค้านี้แล้ว', true);
    ed.items.push(ed.type === 'combo' ? { sku: sku, qty: 1 } : sku);
    draw(); $('#pe-q', m).focus();
  };
  var sug = function (q) {
    var box = $('#pe-sug', m);
    q = String(q || '').trim().toLowerCase();
    if (!q) { box.innerHTML = ''; return; }
    var code = S.idx.byBarcode[q];
    var list = code ? [S.idx.bySku[code.sku]] : S.products.filter(function (p) {
      return p.active && p.forSale !== false && (p.name.toLowerCase().indexOf(q) >= 0 || String(p.sku).toLowerCase() === q || String(p.plu || '') === q);
    }).slice(0, 8);
    box.innerHTML = list.map(function (p) { return '<button type="button" data-padd="' + esc(p.sku) + '">' + esc(p.name) + ' <span class="muted">฿' + money(p.price) + '</span></button>'; }).join('') ||
      '<div class="muted" style="padding:6px">ไม่พบสินค้า</div>';
  };
  m.addEventListener('input', function (e) {
    var k = e.target.getAttribute('data-pf');
    if (e.target.id === 'pe-q') return sug(e.target.value);
    if (!k) return;
    ed[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    preview();
  });
  m.addEventListener('change', function (e) {
    var k = e.target.getAttribute('data-pf');
    if (k === 'active') ed.active = e.target.checked;
    if (k === 'discType') { ed.discType = e.target.value; draw(); }
  });
  m.addEventListener('keydown', function (e) {
    if (e.target.id === 'pe-q' && e.key === 'Enter') { e.preventDefault(); var b = $('#pe-sug [data-padd]', m); if (b) addSku(b.getAttribute('data-padd')); }
  });
  m.addEventListener('click', function (e) {
    var t = e.target.closest('[data-pt],[data-padd],[data-pdel],[data-pq],[data-pd]');
    if (!t) return;
    if (t.hasAttribute('data-pt')) {
      var nt = t.getAttribute('data-pt');
      if (nt !== ed.type) {
        ed.items = ed.items.map(function (it) { return nt === 'combo' ? { sku: skuOf(it), qty: 1 } : skuOf(it); });
        if (nt === 'bxgy') { ed.buyQty = ed.buyQty || 2; ed.freeQty = ed.freeQty || 1; }
        ed.type = nt;
      }
    } else if (t.hasAttribute('data-padd')) return addSku(t.getAttribute('data-padd'));
    else if (t.hasAttribute('data-pdel')) ed.items.splice(Number(t.getAttribute('data-pdel')), 1);
    else if (t.hasAttribute('data-pq')) { var it = ed.items[Number(t.getAttribute('data-pq'))]; it.qty = Math.max(1, it.qty + Number(t.getAttribute('data-d'))); }
    else if (t.hasAttribute('data-pd')) { var d = Number(t.getAttribute('data-pd')), at = ed.days.indexOf(d); if (at >= 0) ed.days.splice(at, 1); else ed.days.push(d); }
    draw();
  });
  $('[data-x=no]', m).onclick = function () { closeModal(); };
  $('[data-x=ok]', m).onclick = function () {
    if (ed.timeFrom && !ed.timeTo) ed.timeTo = '23:59';
    api('savePromo', S.token, ed).then(function () {
      closeModal(); toast('บันทึกโปรโมชั่นแล้ว');
      return Promise.all([loadPromos(), reloadCatalog()]);
    }).catch(fail);
  };
  draw();
}

function renderBulkPrice() {
  var cats = categories().map(function (c) { return '<option ' + (S.prodFilter.cat === c ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('');
  return '<div class="page" style="flex-direction:column;gap:12px"><div class="card pad bulk-tools">' +
    '<div class="row" style="gap:8px;flex-wrap:wrap"><h2 style="margin:0">แก้ราคาหลายรายการ</h2><span class="grow"></span>' +
    '<label class="sr" for="bq2">ค้นหา</label><input id="bq2" placeholder="ค้นหา ชื่อ, SKU" value="' + esc(S.prodFilter.q) + '" data-input="bulkQ" style="width:220px">' +
    '<label class="sr" for="bcat">หมวด</label><select id="bcat" data-change="bulkCat" style="width:190px"><option value="">ทุกหมวด</option>' + cats + '</select></div>' +
    '<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px"><span class="muted">ปรับทุกรายการที่แสดง</span>' +
    '<select id="bk-dir" aria-label="เพิ่มหรือลด" style="width:90px"><option value="1">เพิ่ม</option><option value="-1">ลด</option></select>' +
    '<input id="bk-val" type="number" min="0" step="0.5" value="5" aria-label="จำนวน" style="width:90px;text-align:right">' +
    '<select id="bk-unit" aria-label="หน่วย" style="width:90px"><option value="pct">%</option><option value="baht">บาท</option></select>' +
    '<select id="bk-round" aria-label="ปัดเศษ" style="width:150px"><option value="1">ปัดเป็นบาทเต็ม</option><option value="0.5">ปัดลง .00 / .50</option><option value="0">ไม่ปัด</option></select>' +
    '<label class="checkrow" style="margin:0"><input type="checkbox" id="bk-packs" checked> รวมราคาแพ็ค</label>' +
    '<button class="btn sm" data-act="bulkApply">ใช้กับที่แสดง</button><button class="btn sm ghost" data-act="bulkReset">ล้างที่แก้</button></div></div>' +
    '<div class="card" style="overflow:auto;flex:1"><table class="table bulk"><thead><tr><th>สินค้า</th><th>หมวด</th><th class="r">ทุน</th><th class="r">ราคาเดิม</th><th class="r">ราคาใหม่</th><th class="r">กำไร</th></tr></thead>' +
    '<tbody id="bulk-rows"></tbody></table></div>' +
    '<div class="card pad row" style="gap:10px"><span id="bulk-sum" class="grow muted"></span><button class="btn" data-act="bulkClose">ยกเลิก</button><button class="btn primary" data-act="bulkSave">บันทึกราคาใหม่</button></div></div>';
}

function bulkList() {
  var q = S.prodFilter.q.toLowerCase().trim();
  return S.products.filter(function (p) {
    if (!p.active || p.forSale === false) return false;
    if (S.prodFilter.cat && p.category !== S.prodFilter.cat) return false;
    return !q || p.name.toLowerCase().indexOf(q) >= 0 || p.sku.toLowerCase().indexOf(q) >= 0;
  }).sort(function (a, b) { return (a.category || '').localeCompare(b.category || '', 'th') || a.name.localeCompare(b.name, 'th'); });
}

function bulkRowHtml(key, name, sub, cost, oldP, isPack) {
  var v = S.bulk.edits[key];
  var np = v === undefined || v === '' ? oldP : Number(v);
  var changed = v !== undefined && v !== '' && round2(Number(v)) !== round2(oldP);
  var m = np > 0 ? Math.round((np - cost) / np * 1000) / 10 : 0;
  var below = cost > 0 && np < cost;
  return '<tr class="' + (isPack ? 'pack ' : '') + (changed ? 'chg ' : '') + (below ? 'below' : '') + '"><td>' + (isPack ? '↳ ' : '<b>') + esc(name) + (isPack ? '' : '</b>') +
    (sub ? ' <span class="muted" style="font-size:12px">' + esc(sub) + '</span>' : '') + '</td><td class="muted">' + (isPack ? '' : esc(S.idx.bySku[key] ? S.idx.bySku[key].category : '')) + '</td>' +
    '<td class="r num">' + money(cost) + '</td><td class="r num' + (changed ? ' was' : '') + '">' + money(oldP) + '</td>' +
    '<td class="r"><input class="num" type="number" min="0" step="0.25" data-bulk="' + esc(key) + '" value="' + (changed ? round2(np) : '') + '" placeholder="' + money(oldP) + '" aria-label="ราคาใหม่ ' + esc(name) + '"></td>' +
    '<td class="r num ' + (below ? 'warn-text' : '') + '">' + (np > 0 ? m + '%' : '–') + (below ? ' ต่ำกว่าทุน' : '') + '</td></tr>';
}

function drawBulk() {
  var box = $('#bulk-rows');
  if (!box) return;
  var list = bulkList();
  box.innerHTML = list.length ? list.map(function (p) {
    var cost = Number(p.cost) || 0;
    return bulkRowHtml(p.sku, p.name, p.unit, cost, Number(p.price) || 0, false) + codesOf(p.sku).filter(function (b) { return b.multiplier > 1; }).map(function (b) {
      return bulkRowHtml('#' + b.barcode, b.unitName + ' (' + b.multiplier + ' ' + (p.unit || 'ชิ้น') + ')', b.barcode, round2(cost * b.multiplier), Number(b.price) || 0, true);
    }).join('');
  }).join('') : '<tr><td colspan="6" class="muted">ไม่พบสินค้า</td></tr>';
  bulkSum();
}

function bulkChanges() {
  var out = [];
  Object.keys(S.bulk.edits).forEach(function (k) {
    var v = S.bulk.edits[k];
    if (v === '' || v === undefined || isNaN(Number(v))) return;
    if (k.charAt(0) === '#') {
      var b = S.barcodes.filter(function (x) { return x.barcode === k.slice(1); })[0];
      if (b && round2(Number(v)) !== round2(Number(b.price) || 0)) out.push({ barcode: b.barcode, price: round2(Number(v)) });
    } else {
      var p = S.idx.bySku[k];
      if (p && round2(Number(v)) !== round2(Number(p.price) || 0)) out.push({ sku: k, price: round2(Number(v)) });
    }
  });
  return out;
}

function bulkSum() {
  var ch = bulkChanges(), el = $('#bulk-sum');
  if (!el) return;
  var below = ch.filter(function (c) {
    if (c.barcode) { var b = S.barcodes.filter(function (x) { return x.barcode === c.barcode; })[0]; var p = b && S.idx.bySku[b.sku]; return p && Number(p.cost) > 0 && c.price < Number(p.cost) * b.multiplier; }
    var q = S.idx.bySku[c.sku]; return q && Number(q.cost) > 0 && c.price < Number(q.cost);
  }).length;
  el.innerHTML = ch.length ? 'แก้ราคาไป <b>' + ch.length + '</b> รายการ' + (below ? ' · <span class="warn-text">ต่ำกว่าทุน ' + below + ' รายการ</span>' : '') : 'พิมพ์ราคาใหม่ในช่อง หรือใช้ "ปรับทุกรายการที่แสดง"';
}

function bulkApply() {
  var dir = Number($('#bk-dir').value), val = Number($('#bk-val').value) || 0, unit = $('#bk-unit').value, rnd = Number($('#bk-round').value), packs = $('#bk-packs').checked;
  if (!val) return toast('ใส่จำนวนที่จะปรับ', true);
  var adj = function (p) {
    var n = unit === 'pct' ? p * (1 + dir * val / 100) : p + dir * val;
    if (rnd === 1) n = Math.round(n);
    else if (rnd === 0.5) n = Math.floor(n * 2) / 2;
    return Math.max(0, round2(n));
  };
  var cnt = 0;
  bulkList().forEach(function (p) {
    if (Number(p.price) > 0) { S.bulk.edits[p.sku] = adj(Number(p.price)); cnt++; }
    if (packs) codesOf(p.sku).filter(function (b) { return b.multiplier > 1 && Number(b.price) > 0; }).forEach(function (b) { S.bulk.edits['#' + b.barcode] = adj(Number(b.price)); cnt++; });
  });
  drawBulk();
  toast('ปรับแล้ว ' + cnt + ' ราคา — ตรวจแล้วกด "บันทึกราคาใหม่"');
}

function bulkSave() {
  var ch = bulkChanges();
  if (!ch.length) return toast('ยังไม่มีราคาที่แก้', true);
  confirm2('บันทึกราคาใหม่', 'เปลี่ยนราคา ' + ch.length + ' รายการ — มีผลกับบิลใหม่ทันที', 'บันทึก').then(function (ok) {
    if (!ok) return;
    return api('bulkPrice', S.token, ch).then(function (r) {
      S.lastPriceSkus = ch.map(function (c) { if (c.sku) return c.sku; var b = S.barcodes.filter(function (x) { return x.barcode === c.barcode; })[0]; return b ? b.sku : ''; })
        .filter(function (k, i, a) { return k && a.indexOf(k) === i; });
      S.bulk = null;
      return reloadCatalog().then(function () {
        render(); renderProductRows();
        return confirm2('เปลี่ยนราคาแล้ว ' + r.changed + ' รายการ', 'พิมพ์ป้ายราคาใหม่สำหรับ ' + S.lastPriceSkus.length + ' สินค้าเลยไหม?', 'พิมพ์ป้าย').then(function (go2) {
          if (!go2) return;
          var l = labState(); l.kind = 'shelf'; S.lastPriceSkus.forEach(function (k) { labAdd(k); }); labOpen('shelf');
        });
      });
    });
  }).catch(fail);
}

function renderProducts() {
  if (S.bulk) return renderBulkPrice();
  if (S.promoMode) return renderPromos();
  if (S.labelMode) return renderLabels();
  var owner = S.user.role === 'owner';
  var cats = categories().map(function (c) { return '<option ' + (S.prodFilter.cat === c ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('');
  return '<div class="page"><div class="prod">' +
    '<section class="card prod-list"><div class="prod-tools">' +
    '<label class="sr" for="pq">ค้นหาสินค้า</label><input id="pq" class="grow" placeholder="ค้นหา ชื่อ, EAN, SKU, PLU" value="' + esc(S.prodFilter.q) + '" data-input="prodQ" style="min-width:180px">' + camBtn('pq') +
    '<label class="sr" for="pcat">หมวด</label><select id="pcat" data-change="prodCat" style="width:170px"><option value="">ทุกหมวด</option>' + cats + '</select>' +
    '<button class="btn sm" data-act="labOpen" style="height:40px">พิมพ์ป้าย</button>' +
    (owner ? '<button class="btn sm" data-act="promoOpen" style="height:40px">โปรโมชั่น' + ((S.promos || []).length ? ' (' + S.promos.length + ')' : '') + '</button>' +
      '<button class="btn sm" data-act="bulkOpen" style="height:40px">แก้ราคาหลายรายการ</button><button class="btn sm" data-act="importCsv" style="height:40px">นำเข้า CSV</button>' +
      '<button class="btn sm primary" data-act="selProduct" data-sku="" style="height:40px">+ เพิ่มสินค้า</button>' : '') +
    '</div><div class="prod-grid head"><div>สินค้า / SKU</div><div>EAN (ชิ้น) / PLU</div><div>หน่วยที่มีบาร์โค้ด</div>' +
    '<div class="r">ทุน</div><div class="r">ขาย</div><div class="r">คงเหลือ</div></div><div class="prod-rows" id="prows"></div></section>' +
    '<aside class="card prod-ed" id="ped"></aside></div></div>';
}

/** "แก้ว+ฝา+หลอด" */
function recipeText(sku) {
  return (S.recipes[sku] || []).map(function (c) { var p = S.idx.bySku[c.sku]; return (p ? p.name : c.sku) + (c.qty !== 1 ? ' ×' + c.qty : ''); }).join(' + ');
}

/** How many recipe units the current component stock can make. */
function canMake(comps) {
  if (!comps || !comps.length) return 0;
  return Math.max(0, Math.min.apply(null, comps.map(function (c) {
    var p = S.idx.bySku[c.sku];
    return p && c.qty > 0 ? Math.floor(p.onHand / c.qty) : 0;
  })));
}

function codesOf(sku) { return S.barcodes.filter(function (b) { return b.sku === sku; }).sort(function (a, b) { return a.multiplier - b.multiplier; }); }

function renderProductRows() {
  var box = $('#prows');
  if (!box) return;
  var q = S.prodFilter.q.toLowerCase().trim();
  var rows = S.products.filter(function (p) {
    if (S.prodFilter.cat && p.category !== S.prodFilter.cat) return false;
    if (!q) return true;
    return p.name.toLowerCase().indexOf(q) >= 0 || p.sku.toLowerCase().indexOf(q) >= 0 || p.plu === q ||
      codesOf(p.sku).some(function (b) { return b.barcode.indexOf(q) >= 0; });
  }).sort(function (a, b) { return (a.active === b.active ? 0 : a.active ? -1 : 1) || a.category.localeCompare(b.category, 'th') || a.name.localeCompare(b.name, 'th'); });
  box.innerHTML = rows.length ? rows.map(function (p) {
    var codes = codesOf(p.sku);
    var piece = codes.filter(function (b) { return b.multiplier === 1; })[0];
    var ean = piece ? '<span class="num">' + esc(piece.barcode) + '</span>' : (p.plu ? '<span class="muted">— PLU ' + esc(p.plu) + '</span>' :
      '<span class="muted">' + (p.forSale === false ? '— (ไม่ขายเป็นชิ้น)' : '—') + '</span>');
    var isRecipe = p.type === 'recipe';
    var tags = codes.map(function (b) {
      var internal = /^2\d{12}$/.test(b.barcode);
      return '<span class="tag ' + (internal ? 'amber' : 'blue') + '">' + (internal ? 'โค้ดภายใน' : esc(b.unitName) + (b.multiplier > 1 ? ' ' + b.multiplier : '')) + '</span>';
    }).join('') + (isRecipe ? '<span class="tag green" title="' + esc(recipeText(p.sku)) + '">สูตรผสม</span>' : '') +
      (p.forSale === false ? '<span class="tag gray">วัตถุดิบ</span>' : '') + (p.quickKey ? '<span class="tag green">ปุ่มด่วน</span>' : '') + (p.openPrice ? '<span class="tag amber">ราคาเปิด</span>' : '') +
      (!p.active ? '<span class="tag gray">ปิดใช้งาน</span>' : '');
    var low = p.minStock > 0 && p.onHand <= p.minStock;
    return '<div class="prod-grid' + (S.prodSel === p.sku ? ' on' : '') + '" data-act="selProduct" data-sku="' + esc(p.sku) + '"' + (p.active ? '' : ' style="opacity:.55"') + '>' +
      '<div><div style="font-weight:' + (S.prodSel === p.sku ? 600 : 500) + '">' + esc(p.name) + '</div><div class="sub">' + esc(p.sku) + (p.category ? ' · ' + esc(p.category) : '') + '</div></div>' +
      '<div style="font-size:14px">' + ean + '</div><div class="tags">' + tags + '</div>' +
      '<div class="r num">' + money(p.cost) + '</div><div class="r num">' + (p.forSale === false ? '<span class="muted">—</span>' : money(p.price)) + '</div>' +
      (isRecipe ? '<div class="r num muted" title="ทำได้จากสต็อกส่วนประกอบ">≈' + canMake(S.recipes[p.sku]) + '</div></div>'
        : '<div class="r num' + (low ? ' warn-text' : '') + '" style="' + (low ? 'font-weight:600' : '') + '">' + p.onHand + '</div></div>');
  }).join('') : '<div class="empty">ไม่พบสินค้า</div>';
  drawEditor();
  var pr = $('.prod');
  if (pr) pr.classList.toggle('editing', !!S.ed);
}

/** Start editing a product (sku), a new one (''), or nothing (null). */
function selectProduct(sku) {
  var go2 = function () {
    S.prodSel = sku;
    if (sku === null) { S.ed = null; }
    else {
      var p = sku ? S.idx.bySku[sku] : null;
      S.ed = {
        p: p ? Object.assign({}, p) : { sku: '', name: '', category: S.prodFilter.cat || '', type: 'barcode', unit: 'ชิ้น', cost: '', price: '', minStock: '',
          openPrice: false, quickKey: false, quickKeyGroup: '', quickKeyOrder: '', icon: '', color: 'gray', plu: '', active: true, forSale: true, trackExpiry: false },
        codes: p ? codesOf(sku).map(function (b) { return Object.assign({}, b); }) : [],
        comps: p && S.recipes[sku] ? S.recipes[sku].map(function (c) { return { sku: c.sku, qty: c.qty }; }) : [],
        dirty: false
      };
    }
    renderProductRows();
    var n = $('#e-name');
    if (n && sku === '') n.focus();
  };
  if (S.ed && S.ed.dirty) confirm2('ยังไม่ได้บันทึก', 'ทิ้งการแก้ไขสินค้านี้?', 'ทิ้งการแก้ไข', true).then(function (ok) { if (ok) go2(); });
  else go2();
}

function guessUnit(codes) {
  var names = codes.map(function (c) { return c.unitName; });
  if (!codes.length || names.indexOf('ชิ้น') < 0 && !codes.some(function (c) { return Number(c.multiplier) === 1; })) return { unitName: 'ชิ้น', multiplier: 1 };
  if (names.indexOf('แพ็ค') < 0) return { unitName: 'แพ็ค', multiplier: '' };
  if (names.indexOf('ลัง') < 0) return { unitName: 'ลัง', multiplier: '' };
  return { unitName: '', multiplier: '' };
}

function drawEditor() {
  var box = $('#ped');
  if (!box) return;
  var owner = S.user.role === 'owner';
  if (!S.ed) {
    box.innerHTML = '<div class="ed-empty"><div style="font-size:16px;color:var(--ink);font-weight:600">เลือกสินค้าทางซ้ายเพื่อดู / แก้ไข</div>' +
      (owner ? '<div>หรือกด <b>+ เพิ่มสินค้า</b> · สแกนบาร์โค้ดสินค้าในช่องค้นหาเพื่อหาเร็ว</div>' : '<div>แก้ไขสินค้าได้เฉพาะเจ้าของร้าน</div>') + '</div>';
    return;
  }
  var p = S.ed.p, codes = S.ed.codes, isNew = !p.sku, isRecipe = p.type === 'recipe';
  var rcost = round2(S.ed.comps.reduce(function (a, c) { var x = S.idx.bySku[c.sku]; return a + (x ? x.cost * (Number(c.qty) || 0) : 0); }, 0));
  var catList = categories().map(function (c) { return '<option value="' + esc(c) + '">'; }).join('');
  var groups = {};
  S.products.forEach(function (x) { if (x.quickKeyGroup) groups[x.quickKeyGroup] = 1; });
  var f = function (key, label, attrs) {
    return '<div class="field"><label for="e-' + key + '">' + label + '</label><input id="e-' + key + '" data-ef="' + key + '" value="' + esc(p[key]) + '" ' + (attrs || '') + '></div>';
  };
  var piecePrice = Number(p.price) || 0;
  var unitRows = codes.map(function (c, i) {
    var auto = c.multiplier ? money(piecePrice * Number(c.multiplier)) : '';
    return '<div class="u"><input data-ec="unitName" data-i="' + i + '" value="' + esc(c.unitName) + '" aria-label="ชื่อหน่วย" style="font-weight:600">' +
      '<input data-ec="barcode" data-i="' + i + '" value="' + esc(c.barcode) + '" inputmode="numeric" aria-label="บาร์โค้ด" class="num">' +
      '<input data-ec="multiplier" data-i="' + i + '" value="' + esc(c.multiplier) + '" type="number" min="1" aria-label="จำนวนชิ้นต่อหน่วย" style="text-align:right">' +
      '<input data-ec="price" data-i="' + i + '" value="' + (c.price === null || c.price === undefined ? '' : esc(c.price)) + '" type="number" step="0.25" placeholder="' + auto + '" aria-label="ราคาขายหน่วยนี้" style="text-align:right">' +
      '<button class="x" data-ed="delcode" data-i="' + i + '" aria-label="ลบหน่วย ' + esc(c.unitName) + '">×</button></div>';
  }).join('');
  var hint = codes.filter(function (c) { return Number(c.multiplier) > 1; }).map(function (c) {
    var pr = c.price !== null && c.price !== undefined && c.price !== '' ? Number(c.price) : piecePrice * Number(c.multiplier);
    return 'สแกน' + esc(c.unitName || 'หน่วย') + ' = ' + c.multiplier + ' ชิ้น ราคา ฿' + money(pr);
  });
  var colors = Object.keys(KEY_COLORS).map(function (k) {
    return '<button type="button" data-ed="color" data-v="' + k + '" class="' + (p.color === k ? 'on' : '') + '" style="background:' + KEY_COLORS[k][0] + ';box-shadow:inset 0 0 0 6px ' + KEY_COLORS[k][0] + ',inset 0 0 0 14px ' + KEY_COLORS[k][1] + '" aria-label="สี ' + k + '"></button>';
  }).join('');
  var icons = Object.keys(ICONS).map(function (k) {
    return '<button type="button" data-ed="icon" data-v="' + k + '" class="' + (p.icon === k ? 'on' : '') + '" title="' + ICONS[k][0] + '" aria-label="ไอคอน ' + ICONS[k][0] + '">' + iconSvg(k) + '</button>';
  }).join('');
  var c = KEY_COLORS[p.color] || KEY_COLORS.gray;

  box.innerHTML = (isMobile() ? '<div class="m-edbar"><button class="btn sm" data-act="edClose">‹ กลับ</button><b>' + esc(isNew ? 'สินค้าใหม่' : p.name) + '</b></div>' : '') +
    '<fieldset class="ed-body" style="border:0;margin:0;min-width:0" ' + (owner ? '' : 'disabled') + '>' +
    '<div class="row" style="justify-content:space-between"><label class="sr" for="e-name">ชื่อสินค้า</label><input id="e-name" class="ed-name grow" data-ef="name" value="' + esc(p.name) + '" placeholder="ชื่อสินค้า">' +
    '<span class="muted" style="font-size:13px;white-space:nowrap">' + (isNew ? 'SKU อัตโนมัติ' : 'SKU ' + esc(p.sku)) + '</span></div>' +
    '<div class="seg-sm"><button type="button" data-ed="type" data-v="barcode" class="' + (p.type === 'barcode' || !p.type ? 'on' : '') + '">มีบาร์โค้ด</button>' +
    '<button type="button" data-ed="type" data-v="nobarcode" class="' + (p.type === 'nobarcode' ? 'on' : '') + '">ไม่มีบาร์โค้ด</button>' +
    '<button type="button" data-ed="type" data-v="recipe" class="' + (isRecipe ? 'on' : '') + '">สูตรผสม</button></div>' +
    '<div class="grid3">' + f('category', 'หมวด', 'list="e-catlist"') + '<datalist id="e-catlist">' + catList + '</datalist>' +
    (isRecipe ? '<div class="field"><label>ทุน / หน่วย</label><input value="' + money(rcost) + '" disabled title="คำนวณจากส่วนประกอบ"></div>'
      : '<div class="field"><label>ทุน / ชิ้น (FIFO)</label><div class="row" style="gap:4px"><input value="' + (isNew ? 'จากการรับสินค้า' : money(p.cost)) + '" disabled title="ทุนของล็อตที่จะขายถัดไป" class="grow">' +
        (isNew ? '' : '<button type="button" class="btn sm" data-act="showLots" data-sku="' + esc(p.sku) + '" style="height:40px;padding:0 8px">ล็อต</button>') + '</div></div>') +
    (p.forSale === false && !isRecipe ? '<div class="field"><label>ราคาขาย</label><input value="ไม่ขาย" disabled></div>'
      : f('price', isRecipe ? 'ราคาขาย / หน่วย' : 'ราคาขาย / ชิ้น', 'type="number" step="0.25" inputmode="decimal"')) + '</div>' +
    '<div class="grid3">' + f('unit', 'หน่วยนับ') + (isRecipe ? '<div class="field"><label>สต็อก</label><input value="ใช้ของส่วนประกอบ" disabled></div>'
      : f('minStock', 'ขั้นต่ำ (ชิ้น)', 'type="number" inputmode="numeric"')) + f('plu', 'PLU (รหัสสั้น)', 'inputmode="numeric"') + '</div>' +
    (isRecipe ? recipeSection(rcost) : p.type !== 'nobarcode' ?
      '<div class="sec-title"><b>บาร์โค้ด (EAN) แต่ละหน่วย</b><span class="muted" style="font-size:12px">สแกนหน่วยไหนก็ได้</span></div>' +
      (codes.length ? '<div class="units"><div class="u head"><span>หน่วย</span><span>EAN</span><span class="r">= ชิ้น</span><span class="r">ราคาขาย</span><span></span></div>' + unitRows + '</div>' : '') +
      '<div class="add-scan"><label class="sr" for="e-scan">สแกนบาร์โค้ดหน่วยใหม่</label><input id="e-scan" inputmode="numeric" autocomplete="off" placeholder="+ สแกน / พิมพ์บาร์โค้ด' +
      (codes.length ? 'หน่วยถัดไป (แพ็ค / ลัง)' : 'ของชิ้น') + ' แล้วกด Enter">' +
      '<button type="button" class="btn sm" data-ed="internal" style="height:38px" title="สร้างบาร์โค้ดภายใน (ขึ้นต้น 20)">โค้ดภายใน</button></div>' +
      '<div class="hintbox">' + (hint.length ? hint.join(' · ') + ' · ' : 'รับของ: สแกนบาร์โค้ดลัง = เพิ่มสต็อกตามจำนวนชิ้นในลัง · ') + 'สต็อกเก็บเป็นชิ้นเสมอ · ราคาขายเว้นว่าง = ราคาชิ้น × จำนวน</div>'
      : '<div class="hintbox">' + (p.forSale === false ? 'วัตถุดิบ — ใช้เป็นส่วนประกอบของสูตรผสม ไม่ขึ้นที่หน้าขาย' : 'ขายด้วย PLU (พิมพ์ในช่องสแกน) หรือปุ่มขายด่วน') + '</div>') +
    (isRecipe ? '' : '<label class="checkrow"><input type="checkbox" data-ef="forSaleOff" ' + (p.forSale === false ? 'checked' : '') + '> วัตถุดิบ / ของใช้ในร้าน — ไม่ขายหน้าร้าน (เช่น ฝา หลอด ถุง)</label>') +
    (isRecipe ? '' : '<label class="checkrow"><input type="checkbox" data-ef="trackExpiry" ' + (p.trackExpiry ? 'checked' : '') + '> ติดตามวันหมดอายุ — ต้องใส่วันหมดอายุตอนรับสินค้า แล้วเตือนในหน้า "หมดอายุ"</label>') +
    (p.forSale === false && !isRecipe ? '' : '<div class="sec-title"><b>ปุ่มขายด่วน</b><label class="checkrow"><input type="checkbox" data-ef="quickKey" ' + (p.quickKey ? 'checked' : '') + '> แสดงบนหน้าขาย</label></div>' +
    (p.quickKey ?
      '<div class="row" style="align-items:flex-end"><span class="key" style="width:120px;height:104px;flex:0 0 120px;cursor:default"><span class="ic' + (p.image && S.imgUrl && S.imgUrl[p.image] ? ' has-img' : '') + '"' + pimgAttr(p) + ' style="background:' + c[0] + ';color:' + c[1] + '">' + picHtml(p) + '</span>' +
      '<span class="nm" style="font-size:13px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + esc(p.name || 'ชื่อสินค้า') + '</span><span class="pr" style="font-size:13px">' + (p.openPrice ? 'ราคาเปิด' : '฿' + money(p.price)) + '</span></span>' +
      '<div class="col grow" style="gap:8px"><div class="field"><label for="e-quickKeyGroup">หมวดปุ่ม</label><input id="e-quickKeyGroup" data-ef="quickKeyGroup" list="e-grplist" value="' + esc(p.quickKeyGroup) + '" placeholder="เช่น เครื่องดื่มชง" style="height:36px"></div>' +
      '<datalist id="e-grplist">' + Object.keys(groups).map(function (g) { return '<option value="' + esc(g) + '">'; }).join('') + '</datalist>' +
      '<div class="field"><label for="e-quickKeyOrder">ลำดับบนจอ</label><input id="e-quickKeyOrder" data-ef="quickKeyOrder" type="number" value="' + esc(p.quickKeyOrder || '') + '" style="height:36px;width:90px"></div></div></div>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><b style="font-size:14px">รูปสินค้า</b>' +
        (owner ? '<label class="btn sm" for="e-img" style="cursor:pointer">' + (p.image ? 'เปลี่ยนรูป' : '+ อัปโหลดรูป') + '</label><input id="e-img" type="file" accept="image/*" data-change="prodImg" style="position:absolute;left:-9999px">' +
          (p.image ? '<button type="button" class="btn sm ghost" data-act="prodImgDel">ลบรูป</button>' : '') : '') +
        '<span class="muted" style="font-size:12px">' + (p.image ? 'ปุ่มขายด่วนใช้รูปนี้แทนไอคอน' : 'ไม่มีรูป = ใช้ไอคอนด้านล่าง') + '</span></div>' +
      '<div class="icons">' + icons + '</div><div class="swatches">' + colors + '</div>' : '') +
    '<label class="checkrow"><input type="checkbox" data-ef="openPrice" ' + (p.openPrice ? 'checked' : '') + '> ราคาเปิด (ใส่ราคาตอนขาย เช่น ของทอด ของฝากขาย)</label>') +
    (isNew ? '' : '<label class="checkrow"><input type="checkbox" data-ef="active" ' + (p.active ? 'checked' : '') + '> ใช้งาน (เอาออก = ซ่อนจากหน้าขาย ประวัติยังอยู่)</label>') +
    '</fieldset>' +
    (owner ? '<div class="ed-foot"><button class="btn" data-ed="cancel">' + (S.ed.dirty ? 'ยกเลิก' : 'ปิด') + '</button><button class="btn primary" data-ed="save"' + (S.ed.dirty || isNew ? '' : ' disabled') + '>บันทึก</button></div>' : '');
}

function recipeSection(rcost) {
  var comps = S.ed.comps, p = S.ed.p;
  var rows = comps.map(function (c, i) {
    var x = S.idx.bySku[c.sku] || { name: c.sku, unit: '', cost: 0, onHand: 0 };
    return '<div class="u c"><div style="min-width:0"><div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.name) + '</div>' +
      '<div class="sub" style="font-size:12px;color:var(--muted)">เหลือ ' + x.onHand + ' ' + esc(x.unit) + (x.forSale === false ? ' · วัตถุดิบ' : '') + '</div></div>' +
      '<input data-ecc="qty" data-i="' + i + '" value="' + esc(c.qty) + '" type="number" min="0" step="any" inputmode="decimal" aria-label="จำนวน ' + esc(x.name) + '" style="text-align:right">' +
      '<span class="muted" style="font-size:13px">' + esc(x.unit) + '</span>' +
      '<span class="r num" style="font-size:13px">' + money(x.cost * (Number(c.qty) || 0)) + '</span>' +
      '<button class="x" data-ed="delcomp" data-i="' + i + '" aria-label="เอา ' + esc(x.name) + ' ออก">×</button></div>';
  }).join('');
  var price = Number(p.price) || 0, make = canMake(comps);
  return '<div class="sec-title"><b>ส่วนประกอบ</b><span class="muted" style="font-size:12px">ขาย 1 ' + esc(p.unit || 'หน่วย') + ' = ตัดสต็อกตามนี้</span></div>' +
    (comps.length ? '<div class="units"><div class="u c head"><span>สินค้า</span><span class="r">จำนวน</span><span>หน่วย</span><span class="r">ทุน</span><span></span></div>' + rows + '</div>' : '') +
    '<div class="add-scan" style="position:relative"><label class="sr" for="e-comp">เพิ่มส่วนประกอบ</label>' +
    '<input id="e-comp" autocomplete="off" placeholder="+ เพิ่มส่วนประกอบ: พิมพ์ชื่อ / สแกน / PLU"><div id="e-comp-sug"></div></div>' +
    '<div class="hintbox">ทุน ฿' + money(rcost) + ' / ' + esc(p.unit || 'หน่วย') + (price ? ' · กำไร ฿' + money(price - rcost) + ' (' + (price ? Math.round((price - rcost) / price * 100) : 0) + '%)' : '') +
    (comps.length ? ' · ทำได้อีก ≈' + make + ' ' + esc(p.unit || 'หน่วย') + ' จากสต็อกตอนนี้' : '') + ' · สูตรผสมไม่มีสต็อกของตัวเอง</div>';
}

function compMatches(q) {
  q = String(q || '').trim().toLowerCase();
  if (!q) return [];
  var code = S.barcodes.filter(function (b) { return b.barcode === q; })[0];
  var list = S.products.filter(function (x) {
    if (!x.active || x.type === 'recipe' || x.sku === S.ed.p.sku) return false;
    if (code) return x.sku === code.sku;
    return x.plu === q || x.sku.toLowerCase() === q || x.name.toLowerCase().indexOf(q) >= 0;
  });
  return list.slice(0, 6);
}

function drawCompSuggest(q) {
  var box = $('#e-comp-sug');
  if (!box) return;
  var list = compMatches(q);
  box.innerHTML = list.length ? '<div class="suggest" style="top:42px;left:0;right:0">' + list.map(function (x, i) {
    return '<button type="button" data-ed="addcomp" data-sku="' + esc(x.sku) + '" class="' + (i === 0 ? 'on' : '') + '"><span>' + esc(x.name) +
      (x.forSale === false ? ' <span class="tag gray">วัตถุดิบ</span>' : '') + '</span><span class="muted num">เหลือ ' + x.onHand + '</span></button>';
  }).join('') + '</div>' : (q.trim() ? '<div class="suggest" style="top:42px;left:0;right:0;padding:10px 12px" class="muted">ไม่พบ — เพิ่มสินค้านั้นก่อน (ติ๊ก "วัตถุดิบ" ถ้าไม่ขาย)</div>' : '');
}

function edAddComp(sku) {
  if (!sku) return;
  var hit = S.ed.comps.filter(function (c) { return c.sku === sku; })[0];
  if (hit) hit.qty = Number(hit.qty) + 1; else S.ed.comps.push({ sku: sku, qty: 1 });
  S.ed.dirty = true;
  drawEditor();
  var inp = $('#e-comp'); if (inp) inp.focus();
}

function edInput(t) {
  if (!S.ed) return;
  var k = t.getAttribute('data-ef'), ck = t.getAttribute('data-ec'), cc = t.getAttribute('data-ecc');
  if (k === 'trackExpiry') { S.ed.p.trackExpiry = t.checked; S.ed.dirty = true; return; }
  if (k === 'forSaleOff') {
    S.ed.p.forSale = !t.checked;
    if (t.checked) { S.ed.p.quickKey = false; }
    S.ed.dirty = true; drawEditor(); return;
  }
  if (cc) {
    S.ed.comps[Number(t.getAttribute('data-i'))].qty = t.value;
    S.ed.dirty = true; markDirty(); return;
  }
  if (t.id === 'e-comp') { drawCompSuggest(t.value); return; }
  if (k) {
    S.ed.p[k] = t.type === 'checkbox' ? t.checked : t.value;
    S.ed.dirty = true;
    if (t.type === 'checkbox') { drawEditor(); return; }
    if (k === 'price' || k === 'name') { /* live-update placeholders / preview without stealing focus */
      $all('[data-ec=price]').forEach(function (inp) {
        var c = S.ed.codes[Number(inp.getAttribute('data-i'))];
        inp.placeholder = c && c.multiplier ? money((Number(S.ed.p.price) || 0) * Number(c.multiplier)) : '';
      });
    }
    markDirty();
  } else if (ck) {
    S.ed.codes[Number(t.getAttribute('data-i'))][ck] = ck === 'price' ? (t.value === '' ? null : t.value) : t.value;
    S.ed.dirty = true;
    markDirty();
  }
}

function markDirty() {
  var b = $('[data-ed=save]'); if (b) b.disabled = false;
  var c = $('[data-ed=cancel]'); if (c) c.textContent = 'ยกเลิก';
}

function edAddCode(code) {
  code = String(code || '').trim();
  if (!code) return;
  if (!/^\d{6,14}$/.test(code)) return toast('บาร์โค้ดต้องเป็นตัวเลข 6–14 หลัก', true);
  if (S.ed.codes.some(function (c) { return c.barcode === code; })) return toast('บาร์โค้ดนี้อยู่ในรายการแล้ว', true);
  var other = S.barcodes.filter(function (b) { return b.barcode === code && b.sku !== S.ed.p.sku; })[0];
  if (other) return toast('บาร์โค้ดนี้เป็นของ ' + (S.idx.bySku[other.sku] || {}).name + ' แล้ว', true);
  var g = guessUnit(S.ed.codes);
  S.ed.codes.push({ barcode: code, unitName: g.unitName, multiplier: g.multiplier, price: null });
  S.ed.dirty = true;
  drawEditor();
  var i = S.ed.codes.length - 1;
  var next = g.multiplier === '' ? $('[data-ec=multiplier][data-i="' + i + '"]') : $('#e-scan');
  if (next) next.focus();
}

function edClick(el) {
  var a = el.getAttribute('data-ed');
  if (!S.ed) return;
  if (a === 'type') { S.ed.p.type = el.getAttribute('data-v'); S.ed.dirty = true; drawEditor(); }
  if (a === 'icon') { S.ed.p.icon = S.ed.p.icon === el.getAttribute('data-v') ? '' : el.getAttribute('data-v'); S.ed.dirty = true; drawEditor(); }
  if (a === 'color') { S.ed.p.color = el.getAttribute('data-v'); S.ed.dirty = true; drawEditor(); }
  if (a === 'delcomp') { S.ed.comps.splice(Number(el.getAttribute('data-i')), 1); S.ed.dirty = true; drawEditor(); }
  if (a === 'addcomp') edAddComp(el.getAttribute('data-sku'));
  if (a === 'delcode') { S.ed.codes.splice(Number(el.getAttribute('data-i')), 1); S.ed.dirty = true; drawEditor(); }
  if (a === 'internal') api('newInternalBarcode', S.token).then(edAddCode).catch(fail);
  if (a === 'cancel') { S.ed.dirty = false; selectProduct(null); }
  if (a === 'save') saveEditor();
}

function saveEditor() {
  var p = S.ed.p;
  if (!String(p.name).trim()) { toast('ใส่ชื่อสินค้า', true); $('#e-name').focus(); return; }
  if (p.forSale !== false && (p.price === '' || isNaN(Number(p.price)))) { if (!p.openPrice) { toast('ใส่ราคาขาย', true); $('#e-price').focus(); return; } }
  if (p.type === 'recipe') {
    if (!S.ed.comps.length) { toast('เพิ่มส่วนประกอบอย่างน้อย 1 รายการ', true); var ci = $('#e-comp'); if (ci) ci.focus(); return; }
    var badQ = S.ed.comps.filter(function (c) { return !(Number(c.qty) > 0); })[0];
    if (badQ) { toast('ใส่จำนวนของ ' + (S.idx.bySku[badQ.sku] || {}).name, true); return; }
  }
  var codes = p.type !== 'barcode' ? [] : S.ed.codes.filter(function (c) { return String(c.barcode).trim(); });
  for (var i = 0; i < codes.length; i++) {
    var m = Number(codes[i].multiplier);
    if (!(m >= 1) || Math.round(m) !== m) { toast('ใส่จำนวนชิ้นของหน่วย "' + (codes[i].unitName || codes[i].barcode) + '"', true); var inp = $('[data-ec=multiplier][data-i="' + S.ed.codes.indexOf(codes[i]) + '"]'); if (inp) inp.focus(); return; }
    if (!String(codes[i].unitName).trim()) { toast('ใส่ชื่อหน่วยของบาร์โค้ด ' + codes[i].barcode, true); return; }
  }
  var payload = Object.assign({}, p, { forSale: p.forSale !== false, trackExpiry: !!p.trackExpiry, price: p.forSale === false ? 0 : Number(p.price) || 0, cost: Number(p.cost) || 0, minStock: Number(p.minStock) || 0, quickKeyOrder: Number(p.quickKeyOrder) || 0 });
  api('saveProduct', S.token, payload, codes.map(function (c) {
    return { barcode: String(c.barcode).trim(), unitName: String(c.unitName).trim(), multiplier: Number(c.multiplier), price: c.price === null || c.price === '' ? null : Number(c.price) };
  }), p.type === 'recipe' ? S.ed.comps.map(function (c) { return { sku: c.sku, qty: Number(c.qty) }; }) : []).then(function (r) {
    toast('บันทึกแล้ว');
    S.ed.dirty = false;
    return reloadCatalog().then(function () { S.prodSel = null; selectProduct(r.sku); });
  }).catch(fail);
}

var CSV_TEMPLATE = 'sku,name,category,type,unit,cost,price,minStock,openingStock,barcode,barcodeUnit,multiplier,barcodePrice,quickKey,quickKeyGroup,openPrice,plu\n' +
  'W0001,น้ำดื่ม 600 มล.,เครื่องดื่ม,barcode,ขวด,4.2,7,48,186,8851234567890,ชิ้น,1,,,,,\n' +
  'W0001,,,,,,,,,8851234567906,แพ็ค,12,80,,,,\n' +
  'W0001,,,,,,,,,8851234567913,ลัง,24,,,,,\n' +
  'D0101,น้ำแข็งแก้ว,เครื่องดื่มชง,nobarcode,แก้ว,1.65,5,0,,,,,,y,น้ำแข็ง,,101\n' +
  'D0102,กาแฟเย็น,เครื่องดื่มชง,nobarcode,แก้ว,9,30,0,,,,,,y,เครื่องดื่มชง,,102\n';

function downloadCsvTemplate() {
  var blob = new Blob(['﻿' + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'earthmart-products-template.csv';
  document.body.appendChild(a); a.click(); a.remove();
}

function importCsv() {
  var m = openModal('<header><h1>นำเข้าสินค้าจาก CSV</h1></header><div class="body">' +
    '<div class="muted" style="font-size:13px">สินค้าเดียวกันหลายบาร์โค้ดใส่หลายแถว SKU เดียวกัน · openingStock ใช้เฉพาะสินค้าใหม่ · <a href="#" data-x="tpl">ดาวน์โหลดไฟล์ตัวอย่าง</a></div>' +
    '<input type="file" id="csvfile" accept=".csv,text/csv" style="height:auto;padding:8px">' +
    '<label for="csvtext">หรือวางข้อความ CSV</label><textarea id="csvtext" rows="8" placeholder="sku,name,category,..."></textarea><div id="csvres"></div></div>' +
    '<footer><button class="btn" data-x="cancel">ปิด</button><button class="btn primary" data-x="go">นำเข้า</button></footer>', { wide: true });
  $('#csvfile', m).onchange = function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { $('#csvtext', m).value = r.result; };
    r.readAsText(f, 'utf-8');
  };
  $('[data-x=cancel]', m).onclick = function () { closeModal(); };
  $('[data-x=tpl]', m).onclick = function (e) { e.preventDefault(); downloadCsvTemplate(); };
  $('[data-x=go]', m).onclick = function () {
    api('importProducts', S.token, $('#csvtext', m).value).then(function (r) {
      $('#csvres', m).innerHTML = '<div class="card pad"><b>เพิ่ม ' + r.created + ' · แก้ ' + r.updated + '</b>' +
        (r.errors.length ? '<div class="warn-text" style="margin-top:6px">' + r.errors.map(esc).join('<br>') + '</div>' : '') + '</div>';
      return reloadCatalog().then(renderProductRows);
    }).catch(fail);
  };
}

/* =================================================================== */
/* Receive goods (FIFO lots)                                           */
/* =================================================================== */

function rcDraft() {
  if (!S.rc) {
    try { S.rc = JSON.parse(store('em_receive') || 'null'); } catch (e) { S.rc = null; }
    if (!S.rc) S.rc = { uid: 'R' + Date.now().toString(36) + randomId(6), supplier: '', invoiceNo: '', note: '', lines: [] };
  }
  return S.rc;
}
function rcSave() { store('em_receive', JSON.stringify(S.rc)); }

/** Units a product can be received in: piece + every barcode unit. */
function rcUnits(sku) {
  var p = S.idx.bySku[sku] || {};
  var units = [{ key: '', unitName: p.unit || 'ชิ้น', mult: 1, barcode: '' }];
  codesOf(sku).forEach(function (b) {
    if (b.multiplier === 1 && !units[0].barcode) { units[0].barcode = b.barcode; units[0].unitName = b.unitName || units[0].unitName; return; }
    units.push({ key: b.barcode, unitName: b.unitName, mult: b.multiplier, barcode: b.barcode });
  });
  return units;
}

function rcAdd(sku, barcode) {
  var p = S.idx.bySku[sku];
  if (!p) return;
  if (p.type === 'recipe') return toast(p.name + ' เป็นสูตรผสม — รับเข้าที่ส่วนประกอบแทน', true);
  var units = rcUnits(sku);
  var u = units.filter(function (x) { return barcode && x.barcode === barcode; })[0] || units[0];
  var d = rcDraft();
  var same = d.lines.filter(function (l) { return l.sku === sku && l.mult === u.mult; })[0];
  if (same) same.qty = (Number(same.qty) || 0) + 1;
  else d.lines.push({ sku: sku, barcode: u.mult > 1 ? u.barcode : '', unitName: u.unitName, mult: u.mult, qty: 1,
    unitCost: p.cost ? round2(p.cost * u.mult) : '', expiryDate: '' });
  rcSave();
  drawRcLines();
  var i = d.lines.indexOf(same || d.lines[d.lines.length - 1]);
  var row = $('#rlines [data-row="' + i + '"]');
  if (row) { row.scrollIntoView({ block: 'nearest' }); row.classList.add('flash'); setTimeout(function () { row.classList.remove('flash'); }, 600); }
}

function renderReceive() {
  var d = rcDraft();
  return '<div class="page"><div class="rcv">' +
    '<section class="card rcv-main"><div class="grid3 rcv-head">' +
    '<div class="field"><label for="rc-sup">ผู้ขาย</label><input id="rc-sup" data-rch="supplier" list="rc-suplist" value="' + esc(d.supplier) + '" placeholder="เช่น แม็คโคร, ร้านส่ง"><datalist id="rc-suplist"></datalist></div>' +
    '<div class="field"><label for="rc-inv">เลขใบส่งของ / ใบเสร็จ</label><input id="rc-inv" data-rch="invoiceNo" value="' + esc(d.invoiceNo) + '" placeholder="ถ้ามี"></div>' +
    '<div class="field"><label for="rc-note">หมายเหตุ</label><input id="rc-note" data-rch="note" value="' + esc(d.note) + '"></div></div>' +
    '<div class="scan"><div class="row"><label for="rscan" style="white-space:nowrap">สแกนรับ</label>' +
    '<input id="rscan" autocomplete="off" placeholder="สแกนบาร์โค้ดชิ้น / แพ็ค / ลัง หรือพิมพ์ชื่อสินค้า">' + camBtn('rscan') + '</div><div id="rsug"></div></div>' +
    '<div class="rcv-grid head"><div>สินค้า</div><div>หน่วยที่รับ</div><div class="r">จำนวน</div><div class="r">ทุน / หน่วย</div>' +
    '<div class="r">ทุน/ชิ้น เดิม → ใหม่</div><div class="r">รวม</div><div></div></div>' +
    '<div class="rcv-rows" id="rlines"></div></section>' +
    '<aside class="rcv-side"><div class="card pad" id="rsum"></div><div class="card pad" id="rlow"></div><div class="card pad" id="rrecent"><span class="muted">กำลังโหลด…</span></div>' +
    '<span class="grow"></span><button class="btn primary" data-act="rcCommit" style="height:60px;font-size:18px">บันทึกรับสินค้า · เพิ่มสต็อก</button></aside></div></div>';
}

function loadReceive() {
  drawRcLines();
  drawRcLow();
  api('receipts', S.token, 8).then(function (rows) {
    var box = $('#rrecent');
    if (!box) return;
    var sups = {};
    rows.forEach(function (r) { if (r.supplier) sups[r.supplier] = 1; });
    var dl = $('#rc-suplist');
    if (dl) dl.innerHTML = Object.keys(sups).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('');
    box.innerHTML = '<h2>รับล่าสุด</h2>' + (rows.length ? rows.slice(0, 5).map(function (r) {
      return '<div class="row" style="justify-content:space-between;font-size:14px;padding:3px 0"><span><b class="num">' + esc(r.receiptNo) + '</b> <span class="muted">' +
        dateTime(r.createdAt) + (r.supplier ? ' · ' + esc(r.supplier) : '') + '</span></span><span class="num">฿' + money(r.total) + '</span></div>';
    }).join('') : '<div class="muted">ยังไม่มี</div>');
  }).catch(function () {});
}

function rcRowCalc(l) {
  var p = S.idx.bySku[l.sku] || {};
  var qty = Number(l.qty) || 0, uc = l.unitCost === '' ? NaN : Number(l.unitCost);
  var piece = isNaN(uc) ? NaN : uc / (l.mult || 1);
  var old = Number(p.cost) || 0;
  return { total: isNaN(uc) ? 0 : round2(qty * uc), piece: piece, old: old, changed: !isNaN(piece) && old > 0 && Math.abs(piece - old) >= 0.005 };
}

function drawRcLines() {
  var box = $('#rlines');
  if (!box) return;
  var d = rcDraft();
  box.innerHTML = d.lines.length ? d.lines.map(function (l, i) {
    var p = S.idx.bySku[l.sku] || { name: l.sku };
    var c = rcRowCalc(l);
    var units = rcUnits(l.sku);
    return '<div class="rcv-grid" data-row="' + i + '"><div style="min-width:0"><div style="font-weight:600">' + esc(p.name) + '</div>' +
      '<div class="row" style="gap:6px;margin-top:3px"><label for="rx' + i + '" style="font-size:12px;white-space:nowrap' + (p.trackExpiry ? ';color:var(--warn);font-weight:600' : '') + '">หมดอายุ' + (p.trackExpiry ? ' *' : '') + '</label>' +
      '<input id="rx' + i + '" type="date" data-rc="expiryDate" data-i="' + i + '" value="' + esc(l.expiryDate) + '"' + (p.trackExpiry ? ' required aria-required="true"' : '') +
      ' style="height:30px;font-size:13px;width:150px;padding:0 6px' + (p.trackExpiry && !l.expiryDate ? ';border-color:var(--warn)' : '') + '"></div></div>' +
      '<div><label class="sr" for="ru' + i + '">หน่วย</label><select id="ru' + i + '" data-rc="unit" data-i="' + i + '" style="height:36px;width:100%;font-size:14px">' + units.map(function (u) {
        return '<option value="' + u.mult + '"' + (u.mult === l.mult ? ' selected' : '') + '>' + esc(u.unitName) + (u.mult > 1 ? ' × ' + u.mult : '') + '</option>';
      }).join('') + '</select></div>' +
      '<div><input data-rc="qty" data-i="' + i + '" value="' + esc(l.qty) + '" type="number" min="1" inputmode="numeric" aria-label="จำนวน ' + esc(p.name) + '" style="height:36px;width:100%;text-align:right"></div>' +
      '<div><input data-rc="unitCost" data-i="' + i + '" value="' + esc(l.unitCost) + '" type="number" min="0" step="0.01" inputmode="decimal" placeholder="ทุน" aria-label="ทุนต่อหน่วย ' + esc(p.name) + '" style="height:36px;width:100%;text-align:right"></div>' +
      '<div class="r num" data-calc="piece">' + rcPieceHtml(c) + '</div>' +
      '<div><input data-rc="total" data-i="' + i + '" value="' + (c.total ? c.total.toFixed(2) : '') + '" type="number" min="0" step="0.01" inputmode="decimal" aria-label="ยอดรวม ' + esc(p.name) + '" style="height:36px;width:100%;text-align:right"></div>' +
      '<button class="x" data-act="rcDel" data-i="' + i + '" aria-label="เอา ' + esc(p.name) + ' ออก">×</button></div>';
  }).join('') : '<div class="empty">สแกนบาร์โค้ดที่ชิ้น แพ็ค หรือลัง — ระบบเลือกหน่วยให้เอง<br>สแกนซ้ำ = เพิ่มจำนวน · ทุนแต่ละรอบเก็บเป็นล็อตแยก (FIFO)</div>';
  drawRcSummary();
}

function rcPieceHtml(c) {
  if (isNaN(c.piece)) return '<span class="muted">—</span>';
  return (c.old ? '<span class="muted">' + money(c.old) + ' → </span>' : '') + '<span class="' + (c.changed ? 'warn-text' : '') + '" style="font-weight:' + (c.changed ? 700 : 400) + '">' + money(c.piece) + '</span>';
}

function drawRcSummary() {
  var box = $('#rsum');
  if (!box) return;
  var d = rcDraft();
  var total = 0, pieces = 0, changes = [], noCost = 0;
  d.lines.forEach(function (l) {
    var c = rcRowCalc(l);
    total += c.total; pieces += (Number(l.qty) || 0) * (l.mult || 1);
    if (l.unitCost === '' || isNaN(Number(l.unitCost))) noCost++;
    if (c.changed) changes.push((S.idx.bySku[l.sku] || {}).name + ' ' + (c.piece > c.old ? '+' : '') + money(c.piece - c.old));
  });
  var row = function (k, v, cls) { return '<div class="row" style="justify-content:space-between' + (cls ? ';color:var(--warn)' : '') + '"><span class="' + (cls ? '' : 'muted') + '">' + k + '</span><span style="text-align:right">' + v + '</span></div>'; };
  box.innerHTML = '<h2>สรุปการรับ</h2>' + row('รายการ', d.lines.length) + row('รวมเป็นชิ้น', pieces) +
    row('มูลค่ารวม', '<b class="num" style="font-size:20px">฿' + money(total) + '</b>') +
    (changes.length ? row('ทุนต่อชิ้นเปลี่ยน', esc(changes.join(', ')), true) : '') +
    (noCost ? row('ยังไม่ใส่ทุน', noCost + ' รายการ', true) : '') +
    (d.lines.length ? '<button class="btn sm ghost" data-act="rcClear" style="align-self:flex-start;margin-top:4px">ล้างรายการ</button>' : '');
}

function drawRcLow() {
  var box = $('#rlow');
  if (!box) return;
  var low = S.products.filter(function (p) { return p.active && p.type !== 'recipe' && p.minStock > 0 && p.onHand <= p.minStock; })
    .sort(function (a, b) { return a.onHand / a.minStock - b.onHand / b.minStock; });
  box.innerHTML = '<div class="row" style="justify-content:space-between"><h2 style="margin:0">ของใกล้หมด</h2><span class="muted" style="font-size:13px">' + low.length + ' รายการ</span></div>' +
    (low.length ? low.slice(0, 8).map(function (p) {
      return '<div class="row" style="justify-content:space-between;font-size:14px;padding:3px 0"><span>' + esc(p.name) + '</span><span class="row" style="gap:6px"><span class="warn-text num">' +
        p.onHand + ' / ' + p.minStock + '</span><button class="btn sm" data-act="rcAddSku" data-sku="' + esc(p.sku) + '" style="height:28px;padding:0 8px" aria-label="เพิ่ม ' + esc(p.name) + ' ในใบรับ">+</button></span></div>';
    }).join('') : '<div class="muted" style="font-size:14px;margin-top:6px">ไม่มี</div>');
}

function rcInput(t) {
  var d = rcDraft();
  var h = t.getAttribute('data-rch');
  if (h) { d[h] = t.value; rcSave(); return; }
  var f = t.getAttribute('data-rc'), i = Number(t.getAttribute('data-i'));
  var l = d.lines[i];
  if (!l) return;
  var row = $('#rlines [data-row="' + i + '"]');
  if (f === 'unit') {
    var u = rcUnits(l.sku).filter(function (x) { return String(x.mult) === t.value; })[0];
    var p = S.idx.bySku[l.sku] || {};
    l.mult = u.mult; l.unitName = u.unitName; l.barcode = u.mult > 1 ? u.barcode : '';
    if (p.cost) l.unitCost = round2(p.cost * u.mult);
    rcSave(); drawRcLines(); return;
  }
  if (f === 'total') {
    var q = Number(l.qty) || 0;
    l.unitCost = q && t.value !== '' ? round2(Number(t.value) / q * 10000) / 10000 : l.unitCost;
    var uc = row && $('[data-rc=unitCost]', row); if (uc) uc.value = l.unitCost;
  } else {
    l[f] = t.value;
    if (f === 'qty' || f === 'unitCost') {
      var tot = row && $('[data-rc=total]', row), c0 = rcRowCalc(l);
      if (tot) tot.value = c0.total ? c0.total.toFixed(2) : '';
    }
  }
  var c = rcRowCalc(l);
  var pc = row && $('[data-calc=piece]', row); if (pc) pc.innerHTML = rcPieceHtml(c);
  rcSave(); drawRcSummary();
}

function rcMatches(q) {
  q = String(q || '').trim().toLowerCase();
  if (!q) return [];
  return S.products.filter(function (x) {
    return x.active && x.type !== 'recipe' && (x.plu === q || x.sku.toLowerCase() === q || x.name.toLowerCase().indexOf(q) >= 0);
  }).slice(0, 8);
}

function rcScan(v) {
  v = String(v || '').trim();
  if (!v) return;
  var code = S.barcodes.filter(function (b) { return b.barcode === v; })[0];
  if (code) { rcAdd(code.sku, code.barcode); return true; }
  var m = rcMatches(v);
  if (m.length === 1 || (m.length && (m[0].plu === v || m[0].sku.toLowerCase() === v.toLowerCase()))) { rcAdd(m[0].sku, ''); return true; }
  if (/^\d{8,14}$/.test(v)) {
    beep();
    toast('ไม่พบบาร์โค้ด ' + v + ' — เพิ่มที่หน้าสินค้าก่อน (สแกนในช่องค้นหาหน้าสินค้าได้เลย)', true);
    return true;
  }
  return false;
}

function drawRcSuggest(q) {
  var box = $('#rsug');
  if (!box) return;
  var list = rcMatches(q);
  box.innerHTML = list.length ? '<div class="suggest">' + list.map(function (x, i) {
    return '<button data-act="rcAddSku" data-sku="' + esc(x.sku) + '" class="' + (i === 0 ? 'on' : '') + '"><span>' + esc(x.name) +
      (x.forSale === false ? ' <span class="tag gray">วัตถุดิบ</span>' : '') + '</span><span class="muted num">เหลือ ' + x.onHand + '</span></button>';
  }).join('') + '</div>' : '';
}

function rcCommit() {
  var d = rcDraft();
  if (!d.lines.length) return toast('ยังไม่มีสินค้า', true);
  for (var i = 0; i < d.lines.length; i++) {
    var l = d.lines[i], q = Number(l.qty);
    var nm = (S.idx.bySku[l.sku] || {}).name;
    if (!(q > 0) || Math.round(q) !== q) return toast('จำนวนของ ' + nm + ' ต้องเป็นจำนวนเต็ม', true);
    if (l.unitCost === '' || isNaN(Number(l.unitCost)) || Number(l.unitCost) < 0) {
      var inp = $('#rlines [data-row="' + i + '"] [data-rc=unitCost]'); if (inp) inp.focus();
      return toast('ใส่ทุนของ ' + nm, true);
    }
  }
  var t = 0;
  d.lines.forEach(function (l) { t += Number(l.qty) * Number(l.unitCost); });
  var free = d.lines.filter(function (l) { return Number(l.unitCost) === 0; }).length;
  confirm2('บันทึกรับสินค้า', d.lines.length + ' รายการ · มูลค่า ฿' + money(t) + (free ? ' · มี ' + free + ' รายการทุน 0 (ของแถม)' : '') + ' — สต็อกจะเพิ่มทันที', 'บันทึกรับ').then(function (ok) {
    if (!ok) return;
    return api('receive', S.token, {
      receiptUid: d.uid, supplier: d.supplier, invoiceNo: d.invoiceNo, note: d.note,
      lines: d.lines.map(function (l) {
        return { sku: l.sku, barcode: l.barcode || '', qty: Number(l.qty), unitCost: Number(l.unitCost), expiryDate: l.expiryDate || '' };
      })
    }).then(function (r) {
      S.rc = null; store('em_receive', null);
      toast('รับสินค้าแล้ว ' + r.receiptNo + ' · ฿' + money(r.total));
      return reloadCatalog().then(function () { render(); loadReceive(); });
    });
  }).catch(fail);
}

function showLots(sku) {
  var p = S.idx.bySku[sku];
  api('lots', S.token, sku).then(function (rows) {
    var left = rows.reduce(function (a, l) { return a + l.qtyLeft; }, 0);
    var value = rows.reduce(function (a, l) { return a + l.qtyLeft * l.unitCost; }, 0);
    var m = openModal('<header><h1>ล็อตคงเหลือ: ' + esc(p ? p.name : sku) + '</h1></header><div class="body">' +
      '<div class="muted" style="font-size:14px">ขายออกจากล็อตบนสุดก่อน (FIFO) · รวม ' + left + ' ชิ้น · มูลค่าทุน ฿' + money(value) + '</div>' +
      '<table class="table"><thead><tr><th>รับเมื่อ</th><th>เลขที่</th><th class="r">รับ</th><th class="r">เหลือ</th><th class="r">ทุน/ชิ้น</th><th>หมดอายุ</th></tr></thead><tbody>' +
      (rows.map(function (l, i) {
        return '<tr' + (i === 0 ? ' class="sel"' : '') + '><td>' + dateTime(l.receivedAt) + '</td><td class="num">' + esc(l.receiptNo) + '<div class="muted" style="font-size:12px">' + esc(l.note) + '</div></td>' +
          '<td class="r num">' + l.qtyIn + '</td><td class="r num"><b>' + l.qtyLeft + '</b></td><td class="r num">' + money(l.unitCost) + '</td><td>' + esc(l.expiryDate || '—') + '</td></tr>';
      }).join('') || '<tr><td colspan="6" class="muted">ไม่มีของในล็อต — รับสินค้าเพื่อสร้างล็อตแรก</td></tr>') +
      '</tbody></table></div><footer><button class="btn primary" data-x="close">ปิด</button></footer>', { wide: true });
    $('[data-x=close]', m).onclick = function () { closeModal(); };
  }).catch(fail);
}

/* =================================================================== */
/* Expiry management (จัดการสินค้าหมดอายุ)                                */
/* =================================================================== */

function fmtYmd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

function thDate(ymd) {
  var M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var d = String(ymd || '').slice(0, 10).split('-');
  return d.length === 3 ? Number(d[2]) + ' ' + M[Number(d[1]) - 1] : '';
}

function renderExpiry() {
  var tab = S.expTab || 'todo';
  return '<div class="page"><div class="exp"><div class="exp-main"><div class="kpis" id="xkpi"></div>' +
    '<section class="card stk-main"><div class="tabs"><button class="tab' + (tab === 'todo' ? ' on' : '') + '" data-act="expTab" data-t="todo" id="xtab-todo">ต้องจัดการ</button>' +
    '<button class="tab' + (tab === 'done' ? ' on' : '') + '" data-act="expTab" data-t="done">จัดการแล้ว</button>' +
    '<button class="tab' + (tab === 'wo' ? ' on' : '') + '" data-act="expTab" data-t="wo">ประวัติตัดหมดอายุ</button><span class="grow"></span>' +
    '<span class="muted" style="align-self:center;font-size:13px;padding-right:6px">เตือนตามวันที่ ไม่ขึ้นกับจำนวนคงเหลือ</span></div>' +
    (tab === 'wo' ? '<div class="exp-grid head"><div>สินค้า</div><div>วันที่ตัด · โดย</div><div>ตัดจาก</div><div class="r">จำนวน · ทุนที่เสีย</div></div>'
      : '<div class="exp-grid head"><div>สินค้า</div><div>ล็อต (วันรับ · จำนวนรับ)</div><div>หมดอายุ</div><div class="r">จัดการ</div></div>') +
    '<div class="stk-rows" id="xrows"><div class="empty">กำลังโหลด…</div></div></section></div>' +
    '<aside class="stk-side"><div class="card pad" id="xact"></div><div class="card pad" id="xset"></div></aside></div></div>';
}

function loadExpiry() {
  api('expiryList', S.token).then(function (d) {
    S.exp = d;
    S.expiryTodo = d.todo.length;
    var nb = $('nav [data-v=expiry] .badge'); if (nb) nb.textContent = d.todo.length || '';
    drawExpiry();
  }).catch(fail);
}

function drawExpiry() {
  var d = S.exp;
  if (!d) return;
  var k = $('#xkpi');
  if (k) {
    var c = function (label, v, cls) { return '<div class="card kpi"' + (cls === 'warn' ? ' style="background:var(--warn-soft);border-color:var(--warn-line)"' : '') + '><div class="' + (cls === 'warn' ? 'warn-text' : cls === 'amber' ? 'amber-text' : 'muted') + '">' + label + '</div><div class="v num' + (cls === 'warn' ? ' warn-text' : '') + '">' + v + '</div></div>'; };
    k.innerHTML = c('หมดอายุ · ต้องเก็บออก', d.stats.expired + ' ล็อต', d.stats.expired ? 'warn' : '') + c('ใกล้หมดอายุ · ควรลดราคา', d.stats.near + ' ล็อต', 'amber') +
      c('จัดการแล้ววันนี้', d.stats.doneToday + ' ล็อต') + c('ตัดของหมดอายุเดือนนี้', '฿' + money(d.stats.lossMonth));
  }
  var t = $('#xtab-todo'); if (t) t.textContent = 'ต้องจัดการ (' + d.todo.length + ')';
  var box = $('#xrows');
  if (box) {
    var row = function (r) {
      var badge = r.daysLeft < 0 ? 'เลยมา ' + (-r.daysLeft) + ' วัน' : r.daysLeft === 0 ? 'วันนี้' : r.daysLeft === 1 ? 'พรุ่งนี้' : 'อีก ' + r.daysLeft + ' วัน';
      var exp = r.todo === 'expired' || r.daysLeft <= 0;
      var acts = S.expTab === 'done' ? '<span class="tag ' + (r.status === 'MARKDOWN' ? 'green' : 'gray') + '">' +
          ({ MARKDOWN: 'ลดราคา −' + r.markdownPct + '% · เหลือ ' + r.markdownLeft, WRITEOFF: 'ตัดเสีย ' + r.found, CLOSED: 'ไม่เหลือแล้ว' }[r.status] || r.status) + '</span>' +
          '<span class="muted" style="font-size:12px">' + esc(r.by) + '</span>'
        : (exp ? '<button class="btn sm warn" data-act="expPick" data-lot="' + esc(r.lotId) + '" data-a="WRITEOFF">ตัดเสีย</button>'
          : '<button class="btn sm outline" data-act="expPick" data-lot="' + esc(r.lotId) + '" data-a="MARKDOWN">ลดราคา</button><button class="btn sm" data-act="expPick" data-lot="' + esc(r.lotId) + '" data-a="WRITEOFF">ตัดเสีย</button>') +
          '<button class="btn sm" data-act="expPick" data-lot="' + esc(r.lotId) + '" data-a="CLOSE">ไม่เหลือแล้ว</button>';
      return '<div class="exp-grid' + (S.expSel && S.expSel.lotId === r.lotId ? ' on' : '') + '"><div><div style="font-weight:600">' + esc(r.name) + '</div><div class="muted" style="font-size:12px">' + esc(r.category) +
        (r.status === 'MARKDOWN' && S.expTab !== 'done' ? ' · ลดราคาอยู่ −' + r.markdownPct + '%' : '') + '</div></div>' +
        '<div style="font-size:14px">' + thDate(r.receivedAt instanceof Date ? r.receivedAt : String(r.receivedAt).slice(0, 10)) + ' · ' + r.qtyIn + ' ' + esc(r.unit) +
        '<div class="muted" style="font-size:12px">' + esc(r.receiptNo) + ' · ในระบบเหลือ ' + r.qtyLeft + '</div></div>' +
        '<div><span class="tag ' + (exp ? 'warn' : 'amber') + '">' + thDate(r.expiryDate) + ' · ' + badge + '</span></div>' +
        '<div class="row" style="justify-content:flex-end;gap:6px;flex-wrap:wrap">' + acts + '</div></div>';
    };
    if (S.expTab === 'wo') box.innerHTML = (d.writeoffs || []).length ? d.writeoffs.map(function (w) {
      var at = new Date(w.at);
      return '<div class="exp-grid"><div><div style="font-weight:600">' + esc(w.name) + '</div><div class="muted" style="font-size:12px">' + esc(w.refNo) + (w.note ? ' · ' + esc(w.note) : '') + '</div></div>' +
        '<div style="font-size:14px">' + thDate(fmtYmd(at)) + ' ' + String(at.getHours()).padStart(2, '0') + ':' + String(at.getMinutes()).padStart(2, '0') + '<div class="muted" style="font-size:12px">' + esc(w.by) + '</div></div>' +
        '<div><span class="tag ' + (w.source === 'stock' ? 'blue' : 'gray') + '">' + (w.source === 'stock' ? 'เช็กสต็อก' : 'หน้าหมดอายุ') + '</span></div>' +
        '<div class="r num">' + w.qty + ' ' + esc(w.unit) + ' · <b>฿' + money(w.cost) + '</b></div></div>';
    }).join('') : '<div class="empty">ยังไม่มีการตัดของหมดอายุ</div>';
    else if (S.expTab === 'done') box.innerHTML = d.done.length ? d.done.map(row).join('') : '<div class="empty">ยังไม่มี</div>';
    else {
      var ex = d.todo.filter(function (r) { return r.todo === 'expired'; }), nr = d.todo.filter(function (r) { return r.todo === 'near'; });
      box.innerHTML = (ex.length ? '<div class="exp-sec warn">หมดอายุ · เก็บออกจากชั้น</div>' + ex.map(row).join('') : '') +
        (nr.length ? '<div class="exp-sec amber">ใกล้หมดอายุ · ลดราคา</div>' + nr.map(row).join('') : '') +
        (d.todo.length ? '' : '<div class="empty">ไม่มีล็อตที่ต้องจัดการ 🎉<br><span style="font-size:13px">ล็อตจะขึ้นที่นี่ตามวันหมดอายุที่ใส่ตอนรับสินค้า</span></div>').replace(' 🎉', '');
    }
  }
  drawExpAction();
  drawExpSettings();
}

function drawExpAction() {
  var box = $('#xact');
  if (!box) return;
  var sel = S.expSel;
  var r = sel && S.exp ? S.exp.todo.concat(S.exp.done).filter(function (x) { return x.lotId === sel.lotId; })[0] : null;
  if (!r) {
    box.innerHTML = '<h2>จัดการล็อต</h2><div class="muted" style="font-size:14px">เลือก "ลดราคา", "ตัดเสีย" หรือ "ไม่เหลือแล้ว" จากรายการ แล้วนับของล็อตนั้นที่เหลือบนชั้นจริง</div>';
    return;
  }
  var a = sel.action, pct = sel.pct || S.exp.markdownPct;
  var newPrice = round2(r.price * (100 - pct) / 100);
  box.innerHTML = '<div><h2 style="margin:0">' + esc(r.name) + '</h2><div class="muted" style="font-size:13px">ล็อตรับ ' + thDate(String(r.receivedAt).slice(0, 10)) + ' · หมดอายุ ' + thDate(r.expiryDate) +
    ' (' + (r.daysLeft <= 0 ? 'หมดแล้ว' : 'อีก ' + r.daysLeft + ' วัน') + ')</div></div>' +
    '<div class="seg-sm">' + [['MARKDOWN', 'ลดราคา'], ['WRITEOFF', 'ตัดเสีย'], ['CLOSE', 'ไม่เหลือแล้ว']].map(function (x) {
      var dis = x[0] === 'MARKDOWN' && r.daysLeft <= 0;
      return '<button class="' + (a === x[0] ? 'on' : '') + '" data-act="expAct" data-a="' + x[0] + '"' + (dis ? ' disabled title="หมดอายุแล้ว ขายไม่ได้"' : '') + '>' + x[1] + '</button>';
    }).join('') + '</div>' +
    (a === 'CLOSE' ? '<div class="hintbox">ของล็อตนี้ไม่เหลือบนชั้นแล้ว (ขายหมด) — ปิดการแจ้งเตือน ไม่ปรับสต็อก</div>' :
      '<div class="field"><label for="xq">ของล็อตนี้ที่เหลือบนชั้น (นับจริง)</label><div class="row"><button class="btn" data-act="expStep" data-d="-1" aria-label="ลดจำนวน" style="width:46px">−</button>' +
      '<input id="xq" data-xq type="number" min="0" inputmode="numeric" value="' + sel.found + '" style="flex:1;height:44px;font-size:20px;font-weight:700;text-align:center">' +
      '<button class="btn" data-act="expStep" data-d="1" aria-label="เพิ่มจำนวน" style="width:46px">+</button></div></div>') +
    (a === 'MARKDOWN' ? '<div class="field"><label>ส่วนลด</label><div class="row">' + [20, 30, 50].map(function (p) {
        return '<button class="chip' + (pct === p ? ' on' : '') + '" data-act="expPct" data-p="' + p + '" style="flex:1">' + p + '%</button>';
      }).join('') + '</div></div>' +
      '<div class="row" style="justify-content:space-between;padding:10px 12px;background:var(--bg);border-radius:8px"><span>ราคาใหม่</span><span><span class="muted" style="text-decoration:line-through">฿' + money(r.price) +
      '</span> <b class="brand-text" style="font-size:20px">฿' + money(newPrice) + '</b></span></div>' +
      '<div class="muted" style="font-size:13px;line-height:1.5">แปะสติกเกอร์ "ลดราคา" ' + sel.found + ' ชิ้น · แคชเชียร์สแกนตามปกติ แล้วกดปุ่ม "−' + pct + '%" ที่แถวสินค้าในหน้าขาย (ไม่ต้องใช้ PIN)</div>' : '') +
    (a === 'WRITEOFF' ? '<div class="row" style="justify-content:space-between;padding:10px 12px;background:var(--bg);border-radius:8px"><span>ทุนที่สูญเสีย (ประมาณ)</span><b class="num">฿' +
      money(Math.min(sel.found, r.qtyLeft) * r.unitCost) + '</b></div>' : '') +
    '<button class="btn primary" data-act="expSave" style="height:46px">' + ({ MARKDOWN: 'บันทึก · เปิดราคาลดให้ล็อตนี้', WRITEOFF: 'บันทึก · ตัดสต็อกล็อตนี้', CLOSE: 'บันทึก · ไม่เหลือแล้ว' }[a]) + '</button>';
}

function drawExpSettings() {
  var box = $('#xset');
  if (!box || !S.exp) return;
  var owner = S.user.role === 'owner';
  var w = S.exp.warnDays;
  var cats = categories().filter(function (c) { return S.products.some(function (p) { return p.category === c && p.trackExpiry; }) || w[c] !== undefined; });
  box.innerHTML = '<h2 style="margin:0">เตือนล่วงหน้า (ตามหมวด)</h2>' +
    cats.map(function (c) {
      return '<div class="row" style="justify-content:space-between"><span>' + esc(c) + '</span>' + (owner ? '<span class="row" style="gap:4px"><input data-xw="' + esc(c) + '" type="number" min="0" max="60" value="' +
        (w[c] !== undefined ? w[c] : '') + '" placeholder="' + w['*'] + '" aria-label="วันเตือน ' + esc(c) + '" style="width:64px;height:34px;text-align:right"> วัน</span>' : '<b>' + (w[c] !== undefined ? w[c] : w['*']) + ' วัน</b>') + '</div>';
    }).join('') +
    '<div class="row" style="justify-content:space-between;border-top:1px solid var(--line-soft);padding-top:6px"><span>หมวดอื่น ๆ</span>' + (owner ? '<span class="row" style="gap:4px"><input data-xw="*" type="number" min="0" max="60" value="' + w['*'] + '" aria-label="วันเตือนค่าเริ่มต้น" style="width:64px;height:34px;text-align:right"> วัน</span>' : '<b>' + w['*'] + ' วัน</b>') + '</div>' +
    '<div class="row" style="justify-content:space-between"><span>ส่วนลดเริ่มต้น</span>' + (owner ? '<span class="row" style="gap:4px"><input id="xpct" type="number" min="1" max="99" value="' + S.exp.markdownPct + '" aria-label="ส่วนลดเริ่มต้น" style="width:64px;height:34px;text-align:right"> %</span>' : '<b>' + S.exp.markdownPct + '%</b>') + '</div>' +
    (owner ? '<button class="btn sm" data-act="expSaveSet" style="align-self:flex-end">บันทึกการเตือน</button>' : '') +
    '<div class="muted" style="font-size:12px">หมวดจะขึ้นที่นี่เมื่อมีสินค้าที่ติ๊ก "ติดตามวันหมดอายุ"</div>';
}

function expSave() {
  var sel = S.expSel, a = sel.action;
  var found = Number(sel.found) || 0;
  var go = function (approvalId) {
    return api('expiryAction', S.token, { lotId: sel.lotId, action: a, found: a === 'CLOSE' ? 0 : found, pct: sel.pct || S.exp.markdownPct, approvalId: approvalId || '' }).then(function (r) {
      toast(a === 'MARKDOWN' ? 'เปิดราคาลดแล้ว ' + found + ' ชิ้น' : a === 'WRITEOFF' ? 'ตัดสต็อกแล้ว · ทุน ฿' + money(r.cost || 0) : 'ปิดการแจ้งเตือนแล้ว');
      S.expSel = null;
      return reloadCatalog().then(loadExpiry);
    });
  };
  if (a === 'WRITEOFF' && found > 0) {
    approval('STOCK_ADJUST', 'อนุมัติตัดของหมดอายุ').then(function (id) { if (id !== null) return go(id); }).catch(fail);
  } else go('').catch(fail);
}

/* =================================================================== */
/* Stock                                                               */
/* =================================================================== */

var stockRows = [];
var MOVE_TH = { OPEN: 'สต็อกเปิด', RECEIVE: 'รับเข้า', SALE: 'ขาย', VOID: 'ยกเลิกบิล', ADJUST: 'ปรับยอด/ตรวจนับ', WRITEOFF: 'ตัดเสีย', STORE_USE: 'เบิกใช้ในร้าน' };
var WO_REASONS = ['เสียหาย', 'สูญหาย', 'หมดอายุ'];
var USE_NOTES = ['ให้พนักงาน', 'ทำความสะอาด', 'ทดสอบเครื่อง', 'ให้ช่าง/ผู้มาติดต่อ'];

function renderStock() {
  var tab = S.stockTab || 'list';
  var tabs = [['list', 'คงเหลือ'], ['count', 'ตรวจนับ'], ['moves', 'ประวัติเคลื่อนไหว']].map(function (t) {
    return '<button class="tab' + (tab === t[0] ? ' on' : '') + '" data-act="stockTab" data-t="' + t[0] + '">' + t[1] + '</button>';
  }).join('');
  return '<div class="page stk-' + tab + '" style="flex-direction:column"><div class="kpis" id="skpi"></div>' +
    '<div class="stk"><section class="card stk-main"><div class="tabs">' + tabs + '</div><div id="stab" class="stk-tab"></div></section>' +
    '<aside class="stk-side"><div class="card pad" id="swo"></div><button class="card pad exp-link" id="sexp" data-act="goExpiry"></button></aside></div></div>';
}

function loadStock() {
  drawStockTab();
  drawWriteOff();
  Promise.all([api('stockList', S.token), api('stockOverview', S.token, 7)]).then(function (r) {
    stockRows = r[0]; S.ov = r[1];
    if (S.ov.expiryTodo !== undefined) { S.expiryTodo = S.ov.expiryTodo; var nb = $('nav [data-v=expiry] .badge'); if (nb) nb.textContent = S.expiryTodo || ''; }
    drawStockKpis(); drawStockTab(); drawExpiring();
  }).catch(fail);
}

function drawStockKpis() {
  var box = $('#skpi');
  if (!box || !S.ov) return;
  var low = stockRows.filter(function (r) { return r.minStock > 0 && r.onHand <= r.minStock; }).length;
  var k = function (label, v, warn) {
    return '<div class="card kpi"' + (warn ? ' style="background:var(--warn-soft);border-color:var(--warn-line)"' : '') + '><div class="' + (warn ? 'warn-text' : 'muted') + '">' + label +
      '</div><div class="v num' + (warn ? ' warn-text' : '') + '">' + v + '</div></div>';
  };
  var sub = function (t) { return '<div class="muted" style="font-size:12px;margin-top:2px">' + t + '</div>'; };
  var loss = round2((S.ov.lossMonth || 0) + (S.ov.expiryMonth || 0));
  box.innerHTML = k('มูลค่าสต็อก (ทุน FIFO)', '฿' + money(S.ov.stockValue)).replace(/<\/div>$/, sub(stockRows.length + ' รายการ') + '</div>') +
    k('ใกล้หมด', low, low > 0) +
    k('ของเสียเดือนนี้', '฿' + money(loss)).replace(/<\/div>$/, sub('เสียหาย/สูญหาย ฿' + money(S.ov.lossMonth || 0) + ' · หมดอายุ ฿' + money(S.ov.expiryMonth || 0)) + '</div>') +
    k('เบิกใช้ในร้านเดือนนี้', '฿' + money(S.ov.useMonth || 0)).replace(/<\/div>$/, sub('ค่าใช้จ่าย · เบิกจากหน้าขาย') + '</div>');
}

function stockCats() {
  var c = {};
  stockRows.forEach(function (r) { var k = r.category || 'ไม่มีหมวด'; c[k] = (c[k] || 0) + 1; });
  var f = S.stockFilter.cat;
  return '<div class="chips"><span class="muted" style="font-size:13px">หมวด</span><button class="chip' + (!f ? ' on' : '') + '" data-act="stockCat" data-c="">ทั้งหมด ' + stockRows.length + '</button>' +
    Object.keys(c).sort().map(function (k) { return '<button class="chip' + (f === k ? ' on' : '') + '" data-act="stockCat" data-c="' + esc(k) + '">' + esc(k) + ' ' + c[k] + '</button>'; }).join('') + '</div>';
}

function stockFiltered() {
  var q = S.stockFilter.q.toLowerCase().trim(), cat = S.stockFilter.cat;
  return stockRows.filter(function (r) {
    if (cat && (r.category || 'ไม่มีหมวด') !== cat) return false;
    if (S.stockFilter.low && !(r.minStock > 0 && r.onHand <= r.minStock)) return false;
    return !q || r.name.toLowerCase().indexOf(q) >= 0 || r.sku.toLowerCase().indexOf(q) >= 0;
  });
}

function drawStockTab() {
  var box = $('#stab');
  if (!box) return;
  var tab = S.stockTab || 'list';
  if (tab === 'moves') {
    var mv = S.ov ? S.ov.moves : null;
    box.innerHTML = '<div style="overflow:auto;flex:1"><table class="table"><thead><tr><th>เวลา</th><th>สินค้า</th><th>ประเภท</th><th class="r">จำนวน</th><th>อ้างอิง</th><th>หมายเหตุ</th><th>โดย</th></tr></thead><tbody>' +
      (!mv ? '<tr><td colspan="7" class="muted">กำลังโหลด…</td></tr>' : mv.map(function (m) {
        return '<tr><td class="num" style="white-space:nowrap">' + dateTime(m.createdAt) + '</td><td>' + esc(m.name) + '</td><td>' + (MOVE_TH[m.type] || m.type) + '</td>' +
          '<td class="r num ' + (m.qtyPieces < 0 ? 'warn-text' : 'brand-text') + '">' + (m.qtyPieces > 0 ? '+' : '') + m.qtyPieces + '</td><td class="num">' + esc(m.refNo) + '</td><td>' + esc(m.note) + '</td><td>' + esc(m.user) + '</td></tr>';
      }).join('') || '<tr><td colspan="7" class="muted">ยังไม่มี</td></tr>') + '</tbody></table></div>';
    return;
  }
  if (tab === 'count') return drawCountTab(box);
  box.innerHTML = stockCats() + '<div class="row stk-tools"><label class="sr" for="sq">ค้นหา</label><input id="sq" placeholder="ค้นหาสินค้า" value="' + esc(S.stockFilter.q) + '" data-input="stockQ" class="grow">' + camBtn('sq') +
    '<label class="row" style="color:var(--ink);white-space:nowrap"><input type="checkbox" data-change="stockLow" ' + (S.stockFilter.low ? 'checked' : '') + '> เฉพาะใกล้หมด</label></div>' +
    '<div class="stk-grid head"><div>สินค้า</div><div>หมวด</div><div class="r">คงเหลือ</div><div class="r">ขั้นต่ำ</div><div class="r">มูลค่า</div><div>สถานะ</div><div></div></div><div id="srows" class="stk-rows"></div>';
  renderStockRows();
}

function renderStockRows() {
  var box = $('#srows');
  if (!box) return;
  var rows = stockFiltered();
  var val = S.ov ? S.ov.values : {};
  box.innerHTML = rows.length ? rows.map(function (r) {
    var low = r.minStock > 0 && r.onHand <= r.minStock;
    var tag = r.onHand < 0 ? '<span class="tag warn">ติดลบ</span>' : low ? '<span class="tag warn">ใกล้หมด</span>' : '<span class="tag green">ปกติ</span>';
    return '<div class="stk-grid"><div>' + esc(r.name) + (r.forSale === false ? ' <span class="tag gray">วัตถุดิบ</span>' : '') + '</div><div class="muted">' + esc(r.category) + '</div>' +
      '<div class="r num' + (low || r.onHand < 0 ? ' warn-text' : '') + '" style="font-weight:600">' + r.onHand + ' <span class="muted" style="font-weight:400;font-size:13px">' + esc(r.unit) + '</span></div>' +
      '<div class="r num">' + (r.minStock || '—') + '</div><div class="r num">' + money(val[r.sku] || 0) + '</div><div>' + tag + '</div>' +
      '<div class="r" style="white-space:nowrap"><button class="btn sm" data-act="countStock" data-sku="' + esc(r.sku) + '">ปรับยอด</button> ' +
      '<button class="btn sm ghost" data-act="stockHist" data-sku="' + esc(r.sku) + '">ประวัติ</button></div></div>';
  }).join('') : '<div class="empty">ไม่พบรายการ</div>';
}

/* ------------------------------ Count ----------------------------- */

function cntDraft() {
  if (!S.cnt) {
    try { S.cnt = JSON.parse(store('em_count') || 'null'); } catch (e) { S.cnt = null; }
    if (!S.cnt) S.cnt = { uid: 'CNT' + Date.now().toString(36) + randomId(4), counts: {}, note: '' };
  }
  return S.cnt;
}
function cntSave() { store('em_count', JSON.stringify(S.cnt)); }

function cntSummary() {
  var d = cntDraft(), n = 0, diff = 0, plus = 0, minus = 0;
  stockRows.forEach(function (r) {
    var c = d.counts[r.sku];
    if (c === undefined || c === '') return;
    n++;
    var x = Number(c) - r.onHand;
    if (x) { diff++; if (x > 0) plus += x * r.cost; else minus += -x * r.cost; }
  });
  return { n: n, diff: diff, plus: plus, minus: minus };
}

function drawCountTab(box) {
  var d = cntDraft();
  box.innerHTML = stockCats() + '<div class="row stk-tools"><label for="cscan" style="white-space:nowrap">สแกนนับ</label>' +
    '<input id="cscan" class="grow" autocomplete="off" placeholder="สแกนบาร์โค้ด = +1 (สแกนแพ็ค = +12) หรือพิมพ์จำนวนในช่องนับได้">' + camBtn('cscan') +
    '<label class="sr" for="cnote">หมายเหตุ</label><input id="cnote" data-cnt-note value="' + esc(d.note) + '" placeholder="หมายเหตุ เช่น นับสิ้นเดือน" style="width:200px"></div>' +
    '<div class="stk-grid cnt head"><div>สินค้า</div><div class="r">ในระบบ</div><div class="r">นับได้</div><div class="r">ส่วนต่าง</div><div class="r">มูลค่า (ประมาณ)</div></div>' +
    '<div id="crows" class="stk-rows"></div><div class="cnt-foot" id="cfoot"></div>';
  drawCountRows();
}

function drawCountRows() {
  var box = $('#crows');
  if (!box) return;
  var d = cntDraft();
  var rows = stockFiltered();
  box.innerHTML = rows.length ? rows.map(function (r) {
    var c = d.counts[r.sku];
    var has = c !== undefined && c !== '';
    var x = has ? round2(Number(c) - r.onHand) : 0;
    return '<div class="stk-grid cnt" data-sku="' + esc(r.sku) + '"><div>' + esc(r.name) + ' <span class="muted" style="font-size:13px">' + esc(r.unit) + '</span></div>' +
      '<div class="r num">' + r.onHand + '</div><div class="r"><input data-cnt="' + esc(r.sku) + '" value="' + (has ? esc(c) : '') + '" type="number" min="0" inputmode="numeric" placeholder="—" aria-label="นับได้ ' + esc(r.name) + '" style="width:90px;height:36px;text-align:right"></div>' +
      '<div class="r num" data-cdiff style="font-weight:600;color:' + (!has || !x ? 'var(--muted)' : x < 0 ? 'var(--warn)' : 'var(--brand-text)') + '">' + (has ? (x > 0 ? '+' : '') + x : '') + '</div>' +
      '<div class="r num" data-cval>' + (has && x ? (x > 0 ? '+' : '−') + money(Math.abs(x) * r.cost) : '') + '</div></div>';
  }).join('') : '<div class="empty">ไม่พบรายการ</div>';
  drawCountFoot();
}

function drawCountFoot() {
  var f = $('#cfoot');
  if (!f) return;
  var s = cntSummary();
  f.innerHTML = '<span>นับแล้ว <b>' + s.n + '</b> รายการ · ต่างจากระบบ <b>' + s.diff + '</b></span>' +
    '<span class="brand-text">เกิน +฿' + money(s.plus) + '</span><span class="warn-text">ขาด −฿' + money(s.minus) + '</span><span class="grow"></span>' +
    (s.n ? '<button class="btn sm ghost" data-act="cntClear">ล้าง</button>' : '') +
    '<button class="btn primary" data-act="cntCommit"' + (s.n ? '' : ' disabled') + '>บันทึกผลตรวจนับ</button>';
}

function cntSet(sku, v) {
  var d = cntDraft();
  if (v === '' || v === null) delete d.counts[sku]; else d.counts[sku] = v;
  cntSave();
  var row = $('#crows [data-sku="' + sku + '"]');
  var r = stockRows.filter(function (x) { return x.sku === sku; })[0];
  if (row && r) {
    var has = v !== '' && v !== null, x = has ? round2(Number(v) - r.onHand) : 0;
    var inp = $('[data-cnt]', row); if (inp && document.activeElement !== inp) inp.value = has ? v : '';
    var dd = $('[data-cdiff]', row); dd.textContent = has ? (x > 0 ? '+' : '') + x : ''; dd.style.color = !has || !x ? 'var(--muted)' : x < 0 ? 'var(--warn)' : 'var(--brand-text)';
    $('[data-cval]', row).textContent = has && x ? (x > 0 ? '+' : '−') + money(Math.abs(x) * r.cost) : '';
  }
  drawCountFoot();
}

function cntScan(v) {
  v = String(v || '').trim();
  if (!v) return;
  var code = S.barcodes.filter(function (b) { return b.barcode === v; })[0];
  var sku = code ? code.sku : (S.products.filter(function (p) { return p.plu === v || p.sku === v; })[0] || {}).sku;
  var r = sku && stockRows.filter(function (x) { return x.sku === sku; })[0];
  if (!r) { beep(); return toast('ไม่พบสินค้า ' + v, true); }
  var d = cntDraft();
  var cur = Number(d.counts[sku] || 0);
  cntSet(sku, String(cur + (code ? code.multiplier : 1)));
  var row = $('#crows [data-sku="' + sku + '"]');
  if (!row) { S.stockFilter.cat = ''; S.stockFilter.q = ''; drawStockTab(); row = $('#crows [data-sku="' + sku + '"]'); }
  if (row) { row.scrollIntoView({ block: 'nearest' }); row.classList.add('flash'); setTimeout(function () { row.classList.remove('flash'); }, 500); }
  toast(r.name + ' = ' + d.counts[sku]);
}

function cntCommit() {
  var d = cntDraft(), s = cntSummary();
  var lines = Object.keys(d.counts).filter(function (k) { return d.counts[k] !== ''; }).map(function (k) { return { sku: k, counted: Number(d.counts[k]) }; });
  confirm2('บันทึกผลตรวจนับ', 'นับ ' + s.n + ' รายการ · ต่างจากระบบ ' + s.diff + ' รายการ · เกิน ฿' + money(s.plus) + ' ขาด ฿' + money(s.minus) +
    ' — สต็อกจะถูกปรับตามที่นับได้ (สินค้าที่ไม่ได้นับจะไม่ถูกแตะ)', 'บันทึก').then(function (ok) {
    if (!ok) return;
    return approval('STOCK_ADJUST', 'อนุมัติผลตรวจนับ').then(function (id) {
      if (id === null) return;
      return api('stockCount', S.token, { countUid: d.uid, note: d.note, lines: lines, approvalId: id }).then(function (r) {
        S.cnt = null; store('em_count', null);
        toast('บันทึกแล้ว · ปรับ ' + r.changed + ' รายการ · สุทธิ ฿' + money(r.netValue));
        return reloadCatalog().then(loadStock);
      });
    });
  }).catch(fail);
}

/* ---------------------------- Write-off --------------------------- */

function drawWriteOff() {
  var box = $('#swo');
  if (!box) return;
  var w = S.wo = S.wo || { sku: '', qty: '', reason: 'เสียหาย', lotId: '' };
  var p = w.sku ? S.idx.bySku[w.sku] : null;
  var est = p ? round2((Number(w.qty) || 0) * p.cost) : 0;
  box.innerHTML = '<h2>ตัดของเสีย / หมดอายุ</h2>' +
    '<div class="field" style="position:relative"><label for="wo-q">สินค้า</label>' +
    (p ? '<div class="row" style="justify-content:space-between;border:1px solid var(--line-strong);border-radius:8px;padding:8px 10px"><b>' + esc(p.name) + '</b>' +
      (w.lotId ? '<span class="tag amber">เฉพาะล็อตนี้</span>' : '') + '<button class="btn sm ghost" data-act="woClear" aria-label="เปลี่ยนสินค้า">เปลี่ยน</button></div>'
      : '<input id="wo-q" autocomplete="off" placeholder="พิมพ์ชื่อ / สแกนบาร์โค้ด"><div id="wo-sug"></div>') + '</div>' +
    '<div class="field"><label for="wo-n">จำนวน (' + esc(p ? p.unit || 'ชิ้น' : 'ชิ้น') + ')</label><input id="wo-n" data-wo-qty type="number" min="1" inputmode="numeric" value="' + esc(w.qty) + '"></div>' +
    '<div class="row" style="flex-wrap:wrap;gap:6px">' + WO_REASONS.map(function (r) {
      return '<button class="chip' + (w.reason === r ? ' on' : '') + '" data-act="woReason" data-r="' + r + '" style="height:34px">' + r + '</button>';
    }).join('') + '</div>' +
    (w.reason === 'หมดอายุ' ? '<div class="hintbox">เจอของหมดอายุตอนเช็กสต็อก — ตัดได้เลย รายการนี้จะขึ้นในรายงานหน้า "หมดอายุ" ด้วย</div>' : '') +
    '<div class="row" style="justify-content:space-between;padding:10px 12px;background:var(--bg);border-radius:8px"><span>มูลค่าที่สูญเสีย (ประมาณ)</span><b class="num" id="wo-est">฿' + money(est) + '</b></div>' +
    '<button class="btn primary" data-act="woCommit"' + (p ? '' : ' disabled') + '>บันทึกตัดสต็อก</button>';
}

function woSuggest(q) {
  var box = $('#wo-sug');
  if (!box) return;
  q = q.trim().toLowerCase();
  var code = S.barcodes.filter(function (b) { return b.barcode === q; })[0];
  var list = q ? S.products.filter(function (p) {
    return p.active && p.type !== 'recipe' && (code ? p.sku === code.sku : p.name.toLowerCase().indexOf(q) >= 0 || p.plu === q);
  }).slice(0, 6) : [];
  box.innerHTML = list.length ? '<div class="suggest" style="top:62px;left:0;right:0">' + list.map(function (p) {
    return '<button data-act="woPick" data-sku="' + esc(p.sku) + '"><span>' + esc(p.name) + '</span><span class="muted num">เหลือ ' + p.onHand + '</span></button>';
  }).join('') + '</div>' : '';
}

function woCommit() {
  var w = S.wo, p = S.idx.bySku[w.sku];
  var qty = Number(w.qty);
  if (!(qty > 0)) return toast('ใส่จำนวน', true);
  confirm2('ตัดสต็อก', p.name + ' ' + qty + ' ' + (p.unit || 'ชิ้น') + ' · ' + w.reason, 'ตัดสต็อก', true).then(function (ok) {
    if (!ok) return;
    return approval('STOCK_ADJUST', 'อนุมัติตัดสต็อก').then(function (id) {
      if (id === null) return;
      return api('writeOff', S.token, { sku: w.sku, qty: qty, reason: w.reason, lotId: w.lotId || '', approvalId: id }).then(function (r) {
        S.wo = null;
        toast('ตัดแล้ว · ทุนที่สูญเสีย ฿' + money(r.cost));
        return reloadCatalog().then(loadStock);
      });
    });
  }).catch(fail);
}

function drawExpiring() {
  var box = $('#sexp');
  if (!box) return;
  var n = S.expiryTodo || 0;
  box.innerHTML = '<span><b>' + (n ? 'ใกล้หมดอายุ / หมดอายุ ' + n + ' ล็อต' : 'ไม่มีล็อตใกล้หมดอายุ') + '</b><br><span class="muted" style="font-size:13px">ลดราคา ตัดของหมดอายุ และตั้งวันเตือน ที่หน้า "หมดอายุ"</span></span><span class="' + (n ? 'warn-text' : 'muted') + '" style="font-size:22px">›</span>';
  box.classList.toggle('has', n > 0);
}

function countStock(sku) {
  var r = stockRows.filter(function (x) { return x.sku === sku; })[0];
  if (!r) return;
  var m = openModal('<header><h1>ปรับยอดสต็อก</h1><span class="muted">' + esc(r.name) + '</span></header><form class="body">' +
    '<div class="muted">ในระบบ ' + r.onHand + ' ' + esc(r.unit) + '</div>' +
    '<div class="field"><label for="cnt">นับได้จริง (ชิ้น)</label><input id="cnt" type="number" class="big-input" autofocus value="' + Math.max(0, r.onHand) + '"></div>' +
    '<div class="field"><label for="why">เหตุผล</label><select id="why"><option>สต็อกเปิด</option><option>ตรวจนับ</option><option>ของเสีย</option><option>สูญหาย</option><option>อื่นๆ</option></select></div>' +
    '</form><footer><button class="btn" data-x="cancel">ยกเลิก</button><button class="btn primary" data-x="save">บันทึก</button></footer>');
  $('[data-x=cancel]', m).onclick = function () { closeModal(); };
  var save = function () {
    var cnt = $('#cnt', m).value, why = $('#why', m).value;
    approval('STOCK_ADJUST', 'อนุมัติปรับสต็อก').then(function (id) {
      if (id === null) return;
      return api('setStockCount', S.token, sku, cnt, why, id).then(function (res) {
        closeModal(); toast('ปรับแล้ว (' + (res.diff > 0 ? '+' : '') + res.diff + ')'); reloadCatalog().then(loadStock);
      });
    }).catch(fail);
  };
  $('[data-x=save]', m).onclick = save;
  $('form', m).onsubmit = function (e) { e.preventDefault(); save(); };
}

function stockHist(sku) {
  var p = S.idx.bySku[sku];
  api('stockMoves', S.token, sku).then(function (rows) {
    var names = MOVE_TH;
    var m = openModal('<header><h1>ประวัติ: ' + esc(p ? p.name : sku) + '</h1></header><div class="body"><table class="table"><thead><tr><th>เวลา</th><th>ประเภท</th>' +
      '<th class="r">จำนวน</th><th>อ้างอิง</th><th>หมายเหตุ</th></tr></thead><tbody>' +
      (rows.map(function (r) {
        return '<tr><td>' + dateTime(r.createdAt) + '</td><td>' + (names[r.type] || r.type) + '</td><td class="r num">' + (r.qtyPieces > 0 ? '+' : '') + r.qtyPieces +
          '</td><td class="num">' + esc(r.refNo) + '</td><td>' + esc(r.note) + '</td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted">ยังไม่มีความเคลื่อนไหว</td></tr>') +
      '</tbody></table></div><footer><button class="btn primary" data-x="close">ปิด</button></footer>', { wide: true });
    $('[data-x=close]', m).onclick = function () { closeModal(); };
  }).catch(fail);
}

/* =================================================================== */
/* Shift                                                               */
/* =================================================================== */

var DENOMS = [1000, 500, 100, 50, 20];
var COINS = [10, 5, 2, 1];   // satang go in "other" as baht

function renderShift() {
  if (!S.isCounter) return '<div class="page"><div class="card pad" style="max-width:560px">เปิด/ปิดกะได้เฉพาะเครื่องหน้าร้านที่ลงทะเบียนแล้ว</div></div>';
  var open = !S.shift, p = open ? 'o' : 'c';
  var count = '<section class="card pad shift-count"><div class="shift-head"><h2>' + (open ? 'เปิดกะ · นับเงินทอน' : 'ปิดกะ · นับเงินในลิ้นชัก') +
    '</h2><span class="muted">นับตามลำดับ 1 → 10 · กด + / − ทีละใบ หรือพิมพ์ที่แป้น · แตะแถวไหนก็ได้เพื่อแก้</span></div>' + denomTable(p) +
    (open ? '' : '<div class="shift-sum" id="shiftsum"><h2>สรุปจากระบบ</h2><span class="muted">กำลังโหลด…</span></div>') + '</section>';
  var side = '<aside class="card pad shift-pad"><div class="shift-total"><div class="st-top"><span>' + (open ? 'เงินทอนตั้งต้น' : 'นับได้จริง') + '</span><small id="' + p + '-prog">นับแล้ว 0 / 11 ชนิด</small></div>' +
    '<b id="' + p + '-total" class="num">฿0.00</b>' + (open ? '' : '<div class="st-cmp"><span id="c-exp"></span><b id="c-diff"></b></div>') +
    '<div class="st-bar"><i id="' + p + '-bar"></i></div></div>' +
    '<div class="den-cur" id="' + p + '-cur"></div>' + denomPad(p) + '<div class="shift-acts">' +
    (open ? '<button class="btn primary shift-go" type="submit">เปิดกะ · เริ่มขาย</button>'
      : '<div class="row" style="gap:8px"><button class="btn grow" type="button" data-act="cashMoveModal">เงินเข้า / ออก</button><button class="btn grow" type="button" data-act="noSale">เปิดลิ้นชัก</button></div>' +
        '<div class="field"><label for="cnote">หมายเหตุ</label><input id="cnote" placeholder="เช่น ทอนเกิน"></div>' +
        '<button class="btn primary shift-go" type="button" data-act="closeShift">ปิดกะ' + (S.settings.lineEnabled ? ' · ส่ง LINE' : '') + '</button>') + '</div></aside>';
  return open ? '<form class="page shift-page" data-form="openShift">' + count + side + '</form>' : '<div class="page shift-page">' + count + side + '</div>';
}

var DEN_COLORS = { 1000: '#8A6D4B', 500: '#7B4FA0', 100: '#C0392B', 50: '#2F6DB5', 20: '#2E8B57', 10: '#B8901C', 5: '#8A9098', 2: '#8A9098', 1: '#8A9098' };
function denChip(d) {
  return '<span class="den-chip ' + (d >= 20 ? 'note' : 'coin') + '" style="background:' + DEN_COLORS[d] + '">' + d.toLocaleString() + '</span>';
}

/** Count the drawer in order: notes, then coins (pieces), then "other" in baht for satang and odd change. */
function denomTable(prefix) {
  var n = 0;
  var row = function (id, d, chip, name, pm) {
    n++;
    return '<div class="den-row" data-row="' + id + '"><span class="den-no" data-no="' + n + '">' + n + '</span>' + chip +
      (pm ? '<button type="button" class="den-pm" data-dpm="-1" data-for="' + id + '" aria-label="ลด ' + name + ' หนึ่ง">−</button>' : '') +
      '<label class="sr" for="' + id + '">' + name + '</label><input id="' + id + '" data-den="' + (pm ? d : 1) + '" data-p="' + prefix + '" data-name="' + name +
      '" inputmode="none" autocomplete="off" placeholder="' + (pm ? '' : 'พิมพ์เป็นบาท') + '"' + (pm ? '' : ' class="wide"') + '>' +
      (pm ? '<button type="button" class="den-pm plus" data-dpm="1" data-for="' + id + '" aria-label="เพิ่ม ' + name + ' หนึ่ง">+</button>' : '') +
      '<span class="den-sub num" data-sub="' + id + '"></span></div>';
  };
  var col = function (title, key, body) {
    return '<div class="den-col"><div class="den-colhead"><b>' + title + '</b><span class="muted">จำนวน · บาท</span></div>' + body +
      '<div class="den-coltotal"><b>รวม' + title + '</b><b class="num" id="' + prefix + '-t' + key + '">0.00</b></div></div>';
  };
  var notes = DENOMS.map(function (d) { return row(prefix + d, d, denChip(d), 'ธนบัตร ' + d.toLocaleString(), true); }).join('');
  var coins = COINS.map(function (d) { return row(prefix + 'c' + d, d, denChip(d), 'เหรียญ ' + d, true); }).join('') +
    row(prefix + 'coin', 1, '<span class="den-chip other">อื่น ๆ<small>เศษสตางค์</small></span>', 'อื่น ๆ (บาท)', false);
  return '<div class="den-cols">' + col('ธนบัตร', 'n', notes) + col('เหรียญ', 'c', coins) + '</div>';
}

/** On-screen keypad for the drawer count. */
function denomPad(prefix) {
  return '<div class="den-kp keypad">' + ['7', '8', '9', 'del', '4', '5', '6', 'clr', '1', '2', '3', 'next', '0', '.'].map(function (k) {
    var t = { del: '⌫', clr: 'C', next: 'ถัดไป ↓' }[k] || k;
    return '<button type="button" data-dk="' + k + '" data-p="' + prefix + '"' + (k === '0' ? ' class="wide"' : '') + ' aria-label="' + ({ del: 'ลบ', clr: 'ล้าง', next: 'ช่องถัดไป' }[k] || k) + '">' + t + '</button>';
  }).join('') + '</div>';
}

/** Row values, column totals, progress, the row being counted and (closing) the difference from the system. */
function denomRefresh(prefix) {
  var boxes = $all('[data-den][data-p="' + prefix + '"]'), done = 0, tn = 0, tc = 0;
  var cur = S.denFocus && boxes.indexOf(S.denFocus) >= 0 ? S.denFocus : null;
  boxes.forEach(function (i, k) {
    var v = Number(i.value || 0) * Number(i.getAttribute('data-den')), sub = $('[data-sub="' + i.id + '"]'), r = i.closest('.den-row');
    if (sub) sub.textContent = i.value !== '' ? money(v) : '';
    if (i.value !== '') done++;
    if (k < DENOMS.length) tn += v; else tc += v;
    if (r) { r.classList.toggle('done', i.value !== '' && i !== cur); r.classList.toggle('cur', i === cur); }
  });
  var set = function (id, t) { var el = $('#' + id); if (el) el.textContent = t; };
  set(prefix + '-tn', money(tn)); set(prefix + '-tc', money(tc));
  var total = denomSum(prefix);
  set(prefix + '-total', '฿' + money(total));
  set(prefix + '-prog', 'นับแล้ว ' + done + ' / ' + boxes.length + ' ชนิด');
  var bar = $('#' + prefix + '-bar'); if (bar) bar.style.width = Math.round(done / (boxes.length || 1) * 100) + '%';
  var curBox = $('#' + prefix + '-cur');
  if (curBox) {
    var c = cur || boxes.filter(function (i) { return i.value === ''; })[0];
    curBox.innerHTML = c ? (cur ? 'กำลังนับ: ' : 'ถัดไป: ') + '<b>' + esc(c.getAttribute('data-name')) + '</b>' : '<b>นับครบแล้ว</b> · ตรวจยอดแล้วกดปุ่มด้านล่าง';
  }
  if (prefix === 'c' && S.shiftSum) {
    set('c-exp', 'ระบบคาดว่ามี ฿' + money(S.shiftSum.expectedCash));
    var diff = round2(total - S.shiftSum.expectedCash), el = $('#c-diff');
    // All notes and coins counted ("other" may stay empty) before showing short / over.
    var main = boxes.slice(0, DENOMS.length + COINS.length).every(function (i) { return i.value !== ''; });
    if (el) {
      el.className = !main ? 'muted' : Math.abs(diff) < 0.005 ? 'ok' : 'bad';
      el.textContent = !main ? 'ยังนับไม่ครบ' : Math.abs(diff) < 0.005 ? 'พอดี' : diff < 0 ? 'ขาด ' + money(-diff) : 'เกิน ' + money(diff);
    }
  }
}

/** On-screen keypad for the drawer count: types into the focused box. */
function denomKey(btn) {
  var p = btn.getAttribute('data-p'), k = btn.getAttribute('data-dk');
  var boxes = $all('[data-den][data-p="' + p + '"]');
  var cur = document.activeElement && boxes.indexOf(document.activeElement) >= 0 ? document.activeElement : (S.denFocus && boxes.indexOf(S.denFocus) >= 0 ? S.denFocus : boxes.filter(function (i) { return i.value === ''; })[0] || boxes[0]);
  if (!cur) return;
  var v = cur.value || '', other = cur.id === p + 'coin';
  if (k === 'next') return denomNext(cur);
  if (k === 'del') v = v.slice(0, -1);
  else if (k === 'clr') v = '';
  else if (k === '.') { if (other && v.indexOf('.') < 0) v = (v || '0') + '.'; }
  else if (!(other && /\.\d\d$/.test(v)) && v.replace('.', '').length < 7) v = (v === '0' ? '' : v) + k;
  cur.value = v;
  cur.focus();
  denomRefresh(p);
}

/** Next row: an untouched row counts as 0 when you move past it. */
function denomNext(cur) {
  var p = cur.getAttribute('data-p'), boxes = $all('[data-den][data-p="' + p + '"]');
  if (cur.value === '' && cur.id !== p + 'coin') cur.value = '0';
  var nx = boxes[boxes.indexOf(cur) + 1] || boxes.filter(function (i) { return i.value === ''; })[0];
  if (nx) { nx.focus(); nx.select(); } else { cur.blur(); S.denFocus = null; }
  denomRefresh(p);
}

/** + / − one piece. */
function denomStep(btn) {
  var i = $('#' + btn.getAttribute('data-for'));
  if (!i) return;
  i.value = String(Math.max(0, Math.floor(Number(i.value || 0)) + Number(btn.getAttribute('data-dpm'))));
  i.focus();
  denomRefresh(i.getAttribute('data-p'));
}

function denomSum(prefix) {
  var total = 0;
  $all('[data-p="' + prefix + '"]').forEach(function (i) { total += Number(i.value || 0) * Number(i.getAttribute('data-den')); });
  return round2(total);
}

function loadShift() {
  if (S.offline || !S.token || S.shift.offline) {
    var box = $('#shiftsum');
    if (box) box.innerHTML = '<h2>สรุปจากระบบ</h2><div class="muted">ออฟไลน์ — ดูสรุปและปิดกะได้เมื่อเน็ตกลับมา<br>เปิดกะ ' + dateTime(S.shift.openedAt) +
      ' · เงินทอนตั้งต้น ' + money(S.shift.openingCash) + '<br>ขายตอนออฟไลน์ ' + outbox().filter(function (x) { return x.kind === 'sale'; }).length + ' บิล (รอส่ง)</div>';
    return;
  }
  api('shiftSummary', S.token).then(drawShiftSum).catch(fail);
}

function drawShiftSum(s) {
  var box = $('#shiftsum');
  if (!box) return;
  S.shiftSum = s;
  var row = function (k, v, cls) { return '<div class="ss-row"><span>' + k + '</span><span class="num' + (cls ? ' ' + cls : '') + '">' + v + '</span></div>'; };
  var grp = function (title, rows, foot, tint) {
    return '<div class="ss-grp' + (tint ? ' tint' : '') + '"><b class="ss-title">' + title + '</b>' + rows.join('') +
      (foot ? '<div class="ss-foot"><span>' + foot[0] + '</span><span class="num">' + foot[1] + '</span></div>' : '') + '</div>';
  };
  var mins = Math.max(0, Math.round((Date.now() - new Date(s.openedAt).getTime()) / 60000));
  var moves = (s.cashMoves || []).slice(-3).map(function (m) {
    return row((m.type === 'IN' ? 'เงินเข้า' : 'เงินออก') + ': ' + esc(m.reason || '') + ' ' + timeOf(m.createdAt), (m.type === 'IN' ? '+' : '−') + money(m.amount), m.type === 'IN' ? '' : 'bad');
  });
  box.innerHTML = '<div class="ss-head"><h2>สรุปจากระบบ</h2><span class="muted">กะเปิด ' + dateTime(s.openedAt) + (s.openedByName ? ' โดย ' + esc(s.openedByName) : '') +
    ' · ' + (mins >= 60 ? Math.floor(mins / 60) + ' ชม. ' : '') + (mins % 60) + ' นาที</span></div><div class="ss-grid">' +
    grp('เงินสดในลิ้นชัก', [row('เงินทอนตั้งต้น', money(s.openingCash)), row('+ ขายเงินสด', money(s.cashSales)), row('+ เงินเข้า', money(s.cashIn)),
      row('− เงินออก', money(s.cashOut), s.cashOut ? 'bad' : ''), row('− คืนเงินลูกค้า', money(s.cashRefunds), s.cashRefunds ? 'bad' : '')], ['ต้องมีในลิ้นชัก', money(s.expectedCash)], true) +
    grp('ยอดขายกะนี้', [row('เงินสด', money(s.cashSales)), row('QR พร้อมเพย์', money(s.qrSales)), row('โอน', money(s.transferSales)),
      row('ส่วนลด', money(s.discount)), row('โปรโมชั่น', money(s.promoDiscount || 0))], ['รวมขาย', money(s.totalSales)]) +
    grp('บิลและรายการ', [row('บิลขาย', s.billCount + ' บิล'), row('เฉลี่ยต่อบิล', s.billCount ? money(s.totalSales / s.billCount) : '–'),
      row('ยกเลิกบิล', s.voidCount + ' บิล', s.voidCount ? 'bad' : ''), row('คืนสินค้า', s.returnCount + ' ครั้ง' + (s.otherRefunds ? ' · โอนคืน ' + money(s.otherRefunds) : ''))].concat(moves)) +
    '</div>';
  denomRefresh('c');
}

function openShift() {
  var cash = denomSum('o');
  var offline = function () {
    // Opened with no internet: a temporary shift on this counter; the server gets it (and its real id) later.
    var id = 'OS' + Date.now().toString(36) + randomId(6);
    var sh = { shiftId: 'OFS-' + id, openedAt: new Date().toISOString(), openingCash: cash, userId: S.user.userId, offline: true };
    store('em_offshift', JSON.stringify(sh));
    outboxPut({ kind: 'shift', id: id, localId: sh.shiftId, cash: cash, at: sh.openedAt, error: '', pending: true, opt: { openUid: id, openedAt: sh.openedAt } });
    signItem(id, S.user.userId);
    S.shift = sh; toast('เปิดกะแล้ว (ออฟไลน์ — จะส่งเข้าระบบเมื่อเน็ตกลับมา)'); go('sale');
    openDrawer(true);
  };
  if (S.offline || !S.token) return offline();
  api('openShift', S.token, cash, '').then(function (sh) {
    S.shift = sh; saveCache(true); toast('เปิดกะแล้ว'); go('sale');
    if (sh) openDrawer(true);
  }).catch(function (e) { if (e.offline) offline(); else fail(e); });
}

/** Cash in/out. Offline it is queued against the current shift. Resolves with the shift summary when online. */
function cashMove(type, amount, reason) {
  var amt = round2(Number(amount));
  if (!(amt > 0)) return Promise.reject(new Error('จำนวนเงินต้องมากกว่า 0'));
  if (!String(reason || '').trim()) return Promise.reject(new Error('ต้องใส่เหตุผล'));
  var offline = function () {
    var id = 'C' + Date.now().toString(36) + randomId(8);
    var at = new Date().toISOString();
    outboxPut({ kind: 'cash', id: id, type: type, amount: amt, reason: reason, at: at, error: '', pending: true, opt: { moveId: id, at: at, shiftId: S.shift.shiftId } });
    signItem(id, S.user.userId);
    return null;
  };
  if (S.offline || !S.token || (S.shift && S.shift.offline)) return Promise.resolve(offline());
  return api('cashMove', S.token, type, amt, reason).catch(function (e) { if (e.offline) return offline(); throw e; });
}

function closeShift() {
  if (S.offline || !S.token) return toast('ปิดกะต้องต่อเน็ต — ขายต่อได้ตามปกติ ปิดกะเมื่อเน็ตกลับมา', true);
  if (outbox().length) {
    return toast('ยังมีบิลขายตอนออฟไลน์ค้างส่ง ' + outbox().length + ' บิล — ส่งให้ครบก่อนปิดกะ (แตะป้าย "รอส่ง" ด้านบน)', true);
  }
  var counted = denomSum('c');
  var nHeld = heldBills().length;
  confirm2('ปิดกะ', 'ยอดนับได้ ฿' + money(counted) + ' — ปิดกะแล้วจะยกเลิกบิลในกะนี้ไม่ได้' +
    (nHeld ? ' · ยังมีบิลพัก ' + nHeld + ' บิล (ยังไม่ได้รับเงิน จะค้างไว้ให้กะถัดไป)' : ''), 'ปิดกะ').then(function (ok) {
    if (!ok) return;
    return api('closeShift', S.token, counted, ($('#cnote') || {}).value || '').then(function (s) {
      S.shift = null;
      var diffTxt = s.diff === 0 ? 'เงินพอดี' : (s.diff < 0 ? 'เงินขาด ฿' + money(-s.diff) : 'เงินเกิน ฿' + money(s.diff));
      var m = openModal('<header><h1>ปิดกะแล้ว</h1></header><div class="body"><div style="font-size:28px;font-weight:700" class="' + (s.diff < 0 ? 'warn-text' : 'brand-text') + '">' + diffTxt + '</div>' +
        '<div>ต้องมี ฿' + money(s.expectedCash) + ' · นับได้ ฿' + money(s.countedCash) + '</div><div class="muted">ยอดขาย ฿' + money(s.totalSales) + ' · ' + s.billCount + ' บิล' +
        (S.settings.lineEnabled ? ' · LINE ' + (s.lineSent ? 'ส่งแล้ว' : 'ส่งไม่สำเร็จ') : '') + '</div></div>' +
        '<footer><button class="btn" data-x="print">พิมพ์สรุป</button><button class="btn primary" data-x="ok">ตกลง</button></footer>', { sticky: true });
      $('[data-x=print]', m).onclick = function () { printShift(s); };
      $('[data-x=ok]', m).onclick = function () { closeModal(); go('shift'); };
    });
  }).catch(fail);
}

function printShift(s) {
  var r = function (k, v) { return '<tr><td>' + k + '</td><td style="text-align:right">' + v + '</td></tr>'; };
  $('#print').innerHTML = '<div class="c big">' + esc(S.settings.shopName || '') + '</div><div class="c">สรุปปิดกะ</div><hr>' +
    '<div>' + dateTime(s.openedAt) + ' – ' + timeOf(s.closedAt) + '<br>ปิดโดย ' + esc(s.closedBy) + '</div><hr><table>' +
    r('เงินทอนตั้งต้น', money(s.openingCash)) + r('ขายเงินสด', money(s.cashSales)) + r('ขาย QR', money(s.qrSales)) + r('ขายโอน', money(s.transferSales)) +
    r('เงินเข้า', money(s.cashIn)) + r('เงินออก', money(s.cashOut)) + (s.cashRefunds ? r('คืนเงินสด', money(s.cashRefunds)) : '') + r('ต้องมีในลิ้นชัก', money(s.expectedCash)) + r('นับได้', money(s.countedCash)) +
    r('ส่วนต่าง', money(s.diff)) + r('จำนวนบิล', s.billCount) + r('ยกเลิก', s.voidCount) + '</table>';
  window.print();
}

/* =================================================================== */
/* Reports                                                             */
/* =================================================================== */

/* Reports: filters on the left, tabs on the right. S.rep = { f: {...}, tab, data } */
var REP_TABS = [['overview', 'ภาพรวม'], ['products', 'สินค้า'], ['categories', 'หมวด'], ['staff', 'พนักงาน'], ['shifts', 'กะ'], ['slow', 'ไม่เคลื่อนไหว'], ['stock', 'มูลค่าสต็อก']];
var ACTION_TH = { VOID: 'ยกเลิกบิล', DISCOUNT: 'ส่วนลด', OPEN_PRICE: 'ราคาเปิด', CASH_IN: 'เงินเข้า', CASH_OUT: 'เงินออก',
  STOCK_ADJUST: 'ปรับสต็อก', PRICE_CHANGE: 'แก้ราคา', APPROVE_FAIL: 'PIN อนุมัติผิด', NO_SALE: 'เปิดลิ้นชัก', WRITEOFF: 'ตัดของเสีย',
  STOCK_COUNT: 'ตรวจนับ', MARKDOWN: 'ลดราคาใกล้หมดอายุ', EXPIRY_CLOSE: 'ปิดล็อตหมดอายุ', STORE_USE: 'เบิกใช้ในร้าน', RETURN: 'คืนสินค้า',
  BELOW_COST: 'ขายต่ำกว่าทุน', LOW_MARGIN: 'กำไรต่ำ', OVERSELL: 'ขายเกินสต็อก', OFFLINE_CHECK: 'ตรวจรายการออฟไลน์' };

function repState() {
  if (!S.rep) S.rep = { f: { from: today(), to: today(), slowDays: 30 }, tab: 'overview', preset: 'today', sort: 'revenue',
    showF: store('em_repfilters') === '1', gran: 'day', mFrom: today().slice(0, 7), mTo: today().slice(0, 7), mPreset: 'month' };
  return S.rep;
}

function ymAdd(ym, n) { var d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }

/** Month mode: f.from/f.to cover whole months mFrom..mTo (not past today). */
function repMonths() {
  var r = repState();
  if (r.mTo < r.mFrom) { var t = r.mFrom; r.mFrom = r.mTo; r.mTo = t; }
  r.f.from = r.mFrom + '-01';
  var end = new Date(Number(r.mTo.slice(0, 4)), Number(r.mTo.slice(5, 7)), 0);
  r.f.to = fmtYmd(end) > today() ? today() : fmtYmd(end);
  r.f.gran = 'month';
}

function repMonthPreset(k) {
  var r = repState(), m = today().slice(0, 7);
  if (k === 'month') { r.mFrom = r.mTo = m; }
  if (k === 'lastmonth') { r.mFrom = r.mTo = ymAdd(m, -1); }
  if (k === '3m') { r.mFrom = ymAdd(m, -2); r.mTo = m; }
  if (k === '6m') { r.mFrom = ymAdd(m, -5); r.mTo = m; }
  if (k === 'year') { r.mFrom = m.slice(0, 4) + '-01'; r.mTo = m; }
  r.mPreset = k;
  repMonths();
}

function repPreset(k) {
  var t = new Date(today() + 'T00:00:00'), f = repState().f, d = function (x) { return fmtYmd(x); };
  if (k === 'today') { f.from = f.to = d(t); }
  if (k === 'yesterday') { t.setDate(t.getDate() - 1); f.from = f.to = d(t); }
  if (k === '7d') { f.to = d(t); var a = new Date(t); a.setDate(a.getDate() - 6); f.from = d(a); }
  if (k === '30d') { f.to = d(t); var b = new Date(t); b.setDate(b.getDate() - 29); f.from = d(b); }
  f.gran = 'day';
  repState().preset = k;
}

function renderReports() {
  var r = repState();
  var month = r.gran === 'month';
  var presets = month ? [['month', 'เดือนนี้'], ['lastmonth', 'เดือนก่อน'], ['3m', '3 เดือน'], ['6m', '6 เดือน'], ['year', 'ปีนี้']]
    : [['today', 'วันนี้'], ['yesterday', 'เมื่อวาน'], ['7d', '7 วัน'], ['30d', '30 วัน']];
  var cur = month ? r.mPreset : r.preset;
  var inputs = month
    ? '<label class="sr" for="rm-from">ตั้งแต่เดือน</label><input id="rm-from" type="month" data-rm="mFrom" value="' + r.mFrom + '" style="width:170px;height:38px">' +
      '<span class="muted">ถึง</span><label class="sr" for="rm-to">ถึงเดือน</label><input id="rm-to" type="month" data-rm="mTo" value="' + r.mTo + '" style="width:170px;height:38px">'
    : '<label class="sr" for="rf-from">ตั้งแต่</label><input id="rf-from" type="date" data-rf="from" value="' + r.f.from + '" style="width:160px;height:38px">' +
      '<span class="muted">ถึง</span><label class="sr" for="rf-to">ถึง</label><input id="rf-to" type="date" data-rf="to" value="' + r.f.to + '" style="width:160px;height:38px">';
  return '<div class="page" style="flex-direction:column;gap:12px"><div class="row" style="flex-wrap:wrap;gap:8px">' +
    '<div class="seg-sm rep-gran"><button class="' + (month ? '' : 'on') + '" data-act="repGran" data-g="day">รายวัน</button><button class="' + (month ? 'on' : '') + '" data-act="repGran" data-g="month">รายเดือน</button></div>' +
    presets.map(function (p) { return '<button class="chip' + (cur === p[0] ? ' on' : '') + '" data-act="' + (month ? 'repMonthPreset' : 'repPreset') + '" data-k="' + p[0] + '">' + p[1] + '</button>'; }).join('') +
    '<span class="row" style="gap:6px;margin-left:6px">' + inputs + '</span>' +
    '<span class="grow"></span><button class="btn sm' + (r.showF ? ' on' : '') + '" data-act="repToggleF" aria-expanded="' + r.showF + '" id="rf-btn">ตัวกรองเพิ่มเติม' + repFilterBadge() + ' ' + (r.showF ? '▴' : '▾') + '</button></div>' +
    '<div class="card rep-f' + (r.showF ? '' : ' hidden') + '"><div id="rf-sel" class="rep-sel"></div><button class="btn sm ghost" data-act="repClear" style="align-self:flex-end;white-space:nowrap">ล้างตัวกรอง</button></div>' +
    '<div class="tabs card rep-tabs">' + REP_TABS.map(function (t) {
      return '<button class="tab' + (r.tab === t[0] ? ' on' : '') + '" data-act="repTab" data-t="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div><div id="report" class="col" style="gap:14px"><span class="muted">กำลังโหลด…</span></div></div>';
}

function repFilterBadge() {
  var f = repState().f, n = ['category', 'sku', 'userId', 'shiftId', 'pay', 'deviceId', 'billType'].filter(function (k) { return f[k]; }).length;
  return n ? ' <span class="badge-n">' + n + '</span>' : '';
}

var CHART_COLORS = ['#2F7D59', '#3B6FB6', '#D08A2C', '#B34B6E', '#6C5BB8', '#2A9C9C', '#9A6B3F', '#8C939B'];
var TH_MON_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/* ---------------- Report charts (Chart.js, same look as the FIFO dashboard) ---------------- */
var CHARTS = {};
function tok(n) { var el = $('.ui') || document.body; return getComputedStyle(el).getPropertyValue(n).trim() || '#888'; }
function rgba(c, a) {
  var m = /^#?([0-9a-f]{6})$/i.exec(c || '');
  if (!m) return c;
  var n = parseInt(m[1], 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
}
function chartFont() { return getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif'; }
function killCharts() { Object.keys(CHARTS).forEach(function (k) { try { CHARTS[k].destroy(); } catch (e) {} delete CHARTS[k]; }); }
function themeDefaults() {
  if (!window.Chart) return;
  Chart.defaults.font.family = chartFont();
  Chart.defaults.font.size = window.innerWidth < 700 ? 12 : 13;
  Chart.defaults.color = tok('--muted');
  Chart.defaults.borderColor = tok('--line-soft');
  Chart.defaults.animation = false;
}
function areaFill(color) {
  return function (ctx) {
    var ch = ctx.chart, a = ch.chartArea;
    if (!a) return 'transparent';
    var g = ch.ctx.createLinearGradient(0, a.top, 0, a.bottom);
    g.addColorStop(0, rgba(color, 0.18)); g.addColorStop(1, rgba(color, 0));
    return g;
  };
}
var crosshairPlugin = {
  id: 'crosshair',
  beforeDatasetsDraw: function (chart) {
    var act = chart.tooltip && chart.tooltip.getActiveElements();
    if (!act || !act.length) return;
    var c = chart.ctx, a = chart.chartArea, x = act[0].element.x;
    c.save(); c.strokeStyle = tok('--line'); c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, a.top); c.lineTo(x, a.bottom); c.stroke(); c.restore();
  }
};
var refLinePlugin = {
  id: 'refLine',
  beforeDatasetsDraw: function (chart, args, o) {
    if (!o || o.value == null) return;
    var c = chart.ctx, a = chart.chartArea, py = chart.scales.y.getPixelForValue(o.value);
    if (py < a.top || py > a.bottom) return;
    c.save(); c.strokeStyle = tok('--muted'); c.setLineDash([4, 4]); c.lineWidth = 1;
    c.beginPath(); c.moveTo(a.left, py); c.lineTo(a.right, py); c.stroke(); c.setLineDash([]);
    c.font = '600 12px ' + chartFont(); c.fillStyle = tok('--muted'); c.textAlign = 'left'; c.textBaseline = 'bottom';
    c.lineJoin = 'round'; c.strokeStyle = tok('--surface'); c.lineWidth = 4;
    c.strokeText(o.label, a.left + 6, py - 4); c.fillText(o.label, a.left + 6, py - 4);
    c.restore();
  }
};
/** Labels only on the key points (latest / highest / lowest), never on every point. */
var keyLabelsPlugin = {
  id: 'keyLabels',
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.points) return;
    var c = chart.ctx, a = chart.chartArea, meta = chart.getDatasetMeta(0), placed = [];
    c.save(); c.font = '600 12px ' + chartFont(); c.textBaseline = 'middle'; c.lineJoin = 'round';
    o.points.forEach(function (p) {
      var el = meta.data[p.i]; if (!el) return;
      var w = c.measureText(p.text).width, x = el.x, align = 'center';
      if (x - w / 2 < a.left) { align = 'left'; x = Math.max(el.x - 4, a.left); }
      if (x + w / 2 > a.right) { align = 'right'; x = Math.min(el.x + 4, a.right); }
      var y = p.below ? el.y + 14 : el.y - 14;
      var L = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
      var rr = { l: L - 4, r: L + w + 4, t: y - 9, b: y + 9 };
      if (placed.some(function (q) { return rr.l < q.r && rr.r > q.l && rr.t < q.b && rr.b > q.t; })) return;
      placed.push(rr);
      c.textAlign = align; c.strokeStyle = tok('--surface'); c.lineWidth = 4; c.strokeText(p.text, x, y);
      c.fillStyle = p.strong ? tok('--ink') : tok('--muted'); c.fillText(p.text, x, y);
      c.beginPath(); c.arc(el.x, el.y, 4, 0, Math.PI * 2); c.fillStyle = o.color || tok('--brand'); c.fill();
      c.lineWidth = 2; c.strokeStyle = tok('--surface'); c.stroke();
    });
    c.restore();
  }
};
function tooltipStyle() {
  var f = chartFont();
  return { backgroundColor: tok('--surface'), borderColor: tok('--line'), borderWidth: 1, titleColor: tok('--ink'), bodyColor: tok('--ink'),
    footerColor: tok('--muted'), titleFont: { size: 14, weight: '700', family: f }, bodyFont: { size: 14, family: f }, footerFont: { size: 12, family: f, weight: '400' },
    padding: 10, cornerRadius: 8, caretSize: 0, boxWidth: 8, boxHeight: 8, boxPadding: 4, usePointStyle: true };
}
function niceMax(v) {
  if (!v) return 0;
  var e = Math.pow(10, Math.floor(Math.log10(v)));
  var ms = [1, 2, 2.5, 4, 5, 10];
  for (var i = 0; i < ms.length; i++) if (v <= ms[i] * e) return ms[i] * e;
  return 10 * e;
}
function bucketLabel(k, kind, long) {
  if (kind === 'hour') return String(k).padStart(2, '0') + ':00' + (long ? '–' + String(Number(k) + 1).padStart(2, '0') + ':00' : '');
  if (kind === 'month') return long ? TH_MONTH[Number(k.slice(5)) - 1] + ' ' + (Number(k.slice(0, 4)) + 543) : TH_MON_SHORT[Number(k.slice(5)) - 1] + ' ' + String(Number(k.slice(0, 4)) + 543).slice(2);
  return long ? dayLabel(k) : Number(k.slice(8)) + ' ' + TH_MON_SHORT[Number(k.slice(5, 7)) - 1];
}
function moneyAxis(v) { return v >= 1000 ? (v / 1000).toLocaleString('th-TH', { maximumFractionDigits: 1 }) + 'k' : String(v); }

/** Total trend: area line + average line + key labels (latest / highest / lowest). sub = id of the summary line. */
function lineChart(id, series, kind, opts) {
  var cv = $('#' + id); if (!cv || !window.Chart) return;
  themeDefaults();
  opts = opts || {};
  var data = series.total, color = tok('--brand');
  var nz = data.map(function (v, i) { return i; });
  var avg = data.length ? data.reduce(function (a, v) { return a + v; }, 0) / data.length : 0;
  var pts = [];
  if (data.some(function (v) { return v; })) {
    var hi = nz.reduce(function (a, i) { return data[i] > data[a] ? i : a; }, 0);
    var lo = nz.reduce(function (a, i) { return data[i] < data[a] ? i : a; }, 0);
    var last = opts.noLatest ? -1 : data.length - 1;
    if (last >= 0) pts.push({ i: last, text: '฿' + money(data[last]), strong: true, below: data[last] < avg && last !== hi });
    if (hi !== last) pts.push({ i: hi, text: 'สูงสุด ฿' + money(data[hi]) });
    if (lo !== last && lo !== hi && data.length > 2) pts.push({ i: lo, text: 'ต่ำสุด ฿' + money(data[lo]), below: true });
    if (opts.sub) $('#' + opts.sub).textContent = (opts.subPrefix || '') + 'เฉลี่ย ฿' + money(avg) + ' · สูงสุด ฿' + money(data[hi]) + ' (' + bucketLabel(series.keys[hi], kind) + ')' +
      (data.length > 2 ? ' · ต่ำสุด ฿' + money(data[lo]) + ' (' + bucketLabel(series.keys[lo], kind) + ')' : '');
  } else if (opts.sub) $('#' + opts.sub).textContent = 'ยังไม่มียอดขายในช่วงนี้';
  CHARTS[id] = new Chart(cv, {
    type: 'line',
    data: { labels: series.keys.map(function (k) { return bucketLabel(k, kind); }),
      datasets: [{ label: 'ยอดขาย', data: data, borderColor: color, borderWidth: 2, backgroundColor: areaFill(color), fill: 'origin', tension: 0,
        pointRadius: data.length <= 16 ? 3 : 0, pointBackgroundColor: color, pointBorderColor: tok('--surface'), pointBorderWidth: 2,
        pointHoverRadius: 6, pointHoverBorderWidth: 2, pointHoverBorderColor: tok('--surface'), pointHitRadius: 12 }] },
    options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 28, right: 12 } }, interaction: { mode: 'index', intersect: false },
      onClick: opts.onClick ? function (e, els) { if (els.length) opts.onClick(series.keys[els[0].index]); } : undefined,
      scales: { y: { beginAtZero: true, grace: '12%', border: { display: false }, grid: { color: tok('--line-soft'), drawTicks: false }, ticks: { padding: 8, maxTicksLimit: 6, callback: moneyAxis } },
        x: { border: { color: tok('--line') }, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 16, padding: 6 } } },
      plugins: { legend: { display: false }, refLine: { value: data.length > 1 ? avg : null, label: 'เฉลี่ย ฿' + money(avg) }, keyLabels: { points: pts, color: color },
        tooltip: Object.assign(tooltipStyle(), { displayColors: false, callbacks: {
          title: function (it) { return bucketLabel(series.keys[it[0].dataIndex], kind, true); },
          label: function (c) { return 'ยอดขาย ฿' + money(c.parsed.y); },
          footer: function (it) { return opts.footer ? opts.footer(series.keys[it[0].dataIndex]) : ''; } } }) } },
    plugins: [crosshairPlugin, refLinePlugin, keyLabelsPlugin]
  });
}

/** By category, "compare": ranking bars (whole range) + trend lines, one category highlighted. */
function catCompare(prefix, series, kind, focus, onFocus) {
  if (!window.Chart) return;
  themeDefaults();
  var cats = series.cats, total = cats.reduce(function (a, c) { return a + c.sum; }, 0) || 1;
  var F = cats.some(function (c) { return c.category === focus; }) ? focus : (cats[0] || {}).category;
  var colorOf = function (i) { return CHART_COLORS[i % CHART_COLORS.length]; };
  var rb = $('#' + prefix + 'r'); if (rb) rb.parentNode.style.height = (cats.length * 38 + 40) + 'px';
  var barLabels = { id: 'barLabels', afterDatasetsDraw: function (chart) {
    var c = chart.ctx, meta = chart.getDatasetMeta(0);
    c.save(); c.font = '600 12px ' + chartFont(); c.textBaseline = 'middle'; c.textAlign = 'left';
    meta.data.forEach(function (el, i) { c.fillStyle = cats[i].category === F ? tok('--ink') : tok('--muted'); c.fillText('฿' + money(cats[i].sum) + ' · ' + Math.round(cats[i].sum / total * 100) + '%', el.x + 6, el.y); });
    c.restore();
  } };
  var xMax = niceMax(Math.max.apply(null, cats.map(function (c) { return c.sum; }).concat([1])) * 1.45);
  if (rb) CHARTS[prefix + 'r'] = new Chart(rb, {
    type: 'bar',
    data: { labels: cats.map(function (c) { return c.category; }), datasets: [{ data: cats.map(function (c) { return c.sum; }),
      backgroundColor: cats.map(function (c, i) { return c.category === F ? colorOf(i) : rgba(colorOf(i), 0.3); }), hoverBackgroundColor: cats.map(function (c, i) { return colorOf(i); }),
      borderRadius: { topRight: 4, bottomRight: 4 }, borderSkipped: 'start', barThickness: 20 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { top: 6, right: 4 } },
      onClick: function (e, els) { if (els.length) onFocus(cats[els[0].index].category); },
      onHover: function (e, els) { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
      scales: { x: { beginAtZero: true, max: xMax, border: { display: false }, grid: { color: tok('--line-soft'), drawTicks: false }, ticks: { maxTicksLimit: 4, padding: 4, callback: moneyAxis } },
        y: { border: { color: tok('--line') }, grid: { display: false }, ticks: { color: function (c) { return cats[c.index] && cats[c.index].category === F ? tok('--ink') : tok('--muted'); },
          font: function (c) { return { family: chartFont(), size: 13, weight: cats[c.index] && cats[c.index].category === F ? '700' : '400' }; } } } },
      plugins: { legend: { display: false }, tooltip: Object.assign(tooltipStyle(), { displayColors: false, callbacks: { label: function (c) { return '฿' + money(c.parsed.x); } } }) } },
    plugins: [barLabels]
  });
  var lc = $('#' + prefix + 'l');
  if (!lc) return;
  var order = cats.map(function (c, i) { return i; }).filter(function (i) { return cats[i].category !== F; }).concat(cats.map(function (c, i) { return i; }).filter(function (i) { return cats[i].category === F; }));
  var ds = order.map(function (i) {
    var on = cats[i].category === F, col = colorOf(i);
    return { label: cats[i].category, data: cats[i].values, borderColor: on ? col : rgba(col, 0.35), borderWidth: on ? 3 : 1.5,
      backgroundColor: on ? areaFill(col) : 'transparent', fill: on ? 'origin' : false, tension: 0, pointRadius: 0, pointHoverRadius: on ? 5 : 3, pointHitRadius: 8,
      pointHoverBackgroundColor: col, pointHoverBorderColor: tok('--surface'), pointHoverBorderWidth: 2, _i: i };
  });
  var endLabel = { id: 'endLabel', afterDatasetsDraw: function (chart) {
    var di = chart.data.datasets.length - 1, meta = chart.getDatasetMeta(di), d = chart.data.datasets[di].data, j = d.length - 1;
    if (j < 0 || !meta.data[j]) return;
    var el = meta.data[j], c = chart.ctx, a = chart.chartArea, t = F + ' ฿' + money(d[j]);
    c.save(); c.font = '700 13px ' + chartFont(); c.textAlign = 'right'; c.textBaseline = 'bottom'; c.lineJoin = 'round';
    var x = Math.min(el.x, a.right), y = Math.max(el.y - 8, a.top + 12);
    c.strokeStyle = tok('--surface'); c.lineWidth = 4; c.strokeText(t, x, y); c.fillStyle = tok('--ink'); c.fillText(t, x, y);
    c.restore();
  } };
  CHARTS[prefix + 'l'] = new Chart(lc, {
    type: 'line',
    data: { labels: series.keys.map(function (k) { return bucketLabel(k, kind); }), datasets: ds },
    options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 16, right: 6 } }, interaction: { mode: 'index', intersect: false },
      onClick: function (e) {
        var near = CHARTS[prefix + 'l'].getElementsAtEventForMode(e, 'nearest', { intersect: false, axis: 'xy' }, false);
        if (near.length) onFocus(ds[near[0].datasetIndex].label);
      },
      scales: { y: { beginAtZero: true, grace: '10%', border: { display: false }, grid: { color: tok('--line-soft'), drawTicks: false }, ticks: { padding: 8, maxTicksLimit: 6, callback: moneyAxis } },
        x: { border: { color: tok('--line') }, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 16, padding: 6 } } },
      plugins: { legend: { display: false }, tooltip: Object.assign(tooltipStyle(), {
        itemSort: function (a, b) { return b.parsed.y - a.parsed.y; },
        callbacks: { title: function (it) { return bucketLabel(series.keys[it[0].dataIndex], kind, true); },
          label: function (c) { return ' ' + c.dataset.label + ': ฿' + money(c.parsed.y); },
          labelColor: function (c) { var col = colorOf(c.dataset._i), v = c.dataset.label === F ? col : rgba(col, 0.45); return { borderColor: v, backgroundColor: v }; },
          labelTextColor: function (c) { return c.dataset.label === F ? tok('--ink') : tok('--muted'); } } }) } },
    plugins: [crosshairPlugin, endLabel]
  });
  var pk = $('#' + prefix + 'p');
  if (pk) pk.innerHTML = cats.map(function (c, i) {
    return '<button type="button" data-act="repFocus" data-c="' + esc(c.category) + '" class="' + (c.category === F ? 'on' : '') + '" style="--c:' + colorOf(i) + '"><i></i>' + esc(c.category) + '</button>';
  }).join('');
}

/** By category, "cards": one small chart per category (category colour) with the total trend in grey to compare shape. */
function catCards(boxId, series, kind) {
  var box = $('#' + boxId); if (!box || !window.Chart) return;
  themeDefaults();
  var total = series.cats.reduce(function (a, c) { return a + c.sum; }, 0) || 1;
  box.innerHTML = series.cats.length ? series.cats.map(function (c, i) {
    return '<div class="mini"><div class="mini-h"><span class="mini-n"><i style="background:' + CHART_COLORS[i % CHART_COLORS.length] + '"></i>' + esc(c.category) + '</span>' +
      '<span class="mini-v num">฿' + money(c.sum) + '</span></div><div class="muted" style="font-size:12px">' + Math.round(c.sum / total * 100) + '% ของยอดรวม</div>' +
      '<div class="mini-c"><canvas></canvas></div><div class="mini-x muted"><span>' + bucketLabel(series.keys[0], kind) + '</span><span>' + bucketLabel(series.keys[series.keys.length - 1], kind) + '</span></div></div>';
  }).join('') : '<div class="empty">ยังไม่มียอดขาย</div>';
  box.querySelectorAll('.mini canvas').forEach(function (cv, i) {
    var col = CHART_COLORS[i % CHART_COLORS.length], c = series.cats[i];
    CHARTS[boxId + i] = new Chart(cv, {
      type: 'line',
      data: { labels: series.keys.map(function (k) { return bucketLabel(k, kind); }),
        datasets: [{ label: c.category, data: c.values, borderColor: col, borderWidth: 2, backgroundColor: areaFill(col), fill: 'origin', tension: 0, pointRadius: 0, pointHoverRadius: 4, pointHitRadius: 10 }] },
      options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 4 } }, interaction: { mode: 'index', intersect: false },
        scales: { x: { display: false }, y: { beginAtZero: true, grace: '10%', border: { display: false }, grid: { color: tok('--line-soft'), drawTicks: false }, ticks: { maxTicksLimit: 3, padding: 4, font: { size: 11 }, callback: moneyAxis } } },
        plugins: { legend: { display: false }, tooltip: Object.assign(tooltipStyle(), { displayColors: false, callbacks: {
          title: function (it) { return bucketLabel(series.keys[it[0].dataIndex], kind, true); }, label: function (x) { return '฿' + money(x.parsed.y); } } }) } }
    });
  });
}

function repSelects(o) {
  var f = repState().f;
  var sel = function (key, label, items) {
    return '<div class="field"><label for="rf-' + key + '">' + label + '</label><select id="rf-' + key + '" data-rf="' + key + '"><option value="">ทั้งหมด</option>' +
      items.map(function (it) { return '<option value="' + esc(it[0]) + '"' + (String(f[key] || '') === String(it[0]) ? ' selected' : '') + '>' + esc(it[1]) + '</option>'; }).join('') + '</select></div>';
  };
  var prods = S.products.filter(function (p) { return p.active && (!f.category || p.category === f.category); })
    .sort(function (a, b) { return a.name.localeCompare(b.name, 'th'); }).map(function (p) { return [p.sku, p.name]; });
  $('#rf-sel').innerHTML = sel('category', 'หมวดสินค้า', o.categories.map(function (c) { return [c, c]; })) +
    sel('sku', 'สินค้า', prods) +
    sel('userId', 'พนักงาน', o.users.map(function (u) { return [u.userId, u.name]; })) +
    sel('shiftId', 'กะ', o.shifts.map(function (x) { return [x.shiftId, x.label]; })) +
    sel('pay', 'ช่องทางชำระ', [['cash', 'เงินสด'], ['qr', 'QR พร้อมเพย์'], ['transfer', 'โอน']]) +
    sel('deviceId', 'เครื่อง', o.devices.map(function (d) { return [d.deviceId, d.name]; })) +
    sel('billType', 'ประเภทบิล', [['discount', 'มีส่วนลด'], ['return', 'มีคืนสินค้า']]);
}

function loadReport() {
  var r = repState();
  var box = $('#report');
  if (box && !r.data) box.innerHTML = '<span class="muted">กำลังโหลด…</span>';
  api('report', S.token, r.f).then(function (d) {
    r.data = d;
    if (!$('#report')) return;
    repSelects(d.options);
    var fb = $('#rf-btn'); if (fb) fb.innerHTML = 'ตัวกรองเพิ่มเติม' + repFilterBadge() + ' ' + (r.showF ? '▴' : '▾');
    drawReport();
  }).catch(fail);
}

function pct(v) { return '<span class="muted" style="font-size:12px">' + v + '%</span>'; }

function drawReport() {
  var r = repState(), d = r.data, box = $('#report');
  if (!d || !box) return;
  var sm = d.summary;
  var kpi = function (k, v, sub, cls) { return '<div class="card kpi"><div class="muted">' + k + '</div><div class="v num ' + (cls || '') + '">' + v + '</div>' + (sub ? '<div class="muted" style="font-size:12px">' + sub + '</div>' : '') + '</div>'; };
  var ml = function (ym) { return TH_MONTH[Number(ym.slice(5, 7)) - 1] + ' ' + (Number(ym.slice(0, 4)) + 543); };
  var range = r.gran === 'month' ? (r.mFrom === r.mTo ? ml(r.mFrom) : ml(r.mFrom) + ' – ' + ml(r.mTo))
    : d.oneDay ? dayLabel(d.from) : dayLabel(d.from).replace(' · วันนี้', '') + ' – ' + dayLabel(d.to);
  var head = '<div class="muted" style="font-size:13px">' + range + '</div>';
  var table = function (cols, rows, foot) {
    return '<div class="card" style="overflow:auto"><table class="table"><thead><tr>' + cols.map(function (c) { return '<th' + (c[1] ? ' class="r"' : '') + '>' + c[0] + '</th>'; }).join('') +
      '</tr></thead><tbody>' + (rows.length ? rows.join('') : '<tr><td colspan="' + cols.length + '" class="muted">ไม่มีข้อมูลในช่วงนี้</td></tr>') + (foot || '') + '</tbody></table></div>';
  };
  var html = '';
  var after = null;   // charts are drawn once the HTML is in place
  if (r.tab === 'overview' && !d.trend) {
    box.innerHTML = '<div class="banner">หน้าเว็บกับระบบหลังร้านเป็นคนละเวอร์ชัน — กด Ctrl+F5 เพื่อโหลดหน้าเว็บใหม่</div>';
    return;
  }
  if (r.tab === 'overview') {
    var month = d.gran === 'month', kind = month ? 'month' : 'day';
    var payT = Math.max(1, d.byPay.cash + d.byPay.qr + d.byPay.transfer);
    var lossAll = round2(sm.loss + sm.expiry + sm.use);
    var histBy = {};
    d.history.forEach(function (h) { histBy[h.key] = h; });
    var unit = month ? 'รายเดือน' : 'รายวัน';
    var catView = r.catView || 'compare';
    var leak = round2(sm.voidTotal + sm.refunds + sm.discount);
    html = head + '<div class="kpis kpis6">' + kpi('ยอดขายสุทธิ', '฿' + money(sm.net), sm.refunds ? 'ขาย ฿' + money(sm.gross) + ' − คืน ฿' + money(sm.refunds) : '', 'brand-text') +
      kpi('จำนวนบิล', sm.bills, sm.bills ? 'เฉลี่ย ฿' + money(sm.avgBill) + ' / บิล' : '') +
      kpi('กำไรขั้นต้น', '฿' + money(sm.profit) + ' ' + pct(sm.margin), 'ต้นทุน ฿' + money(sm.cost)) +
      kpi('กำไรหลังหัก', '฿' + money(sm.after), sm.net ? (Math.round(sm.after / sm.net * 1000) / 10) + '% ของยอดขาย' : '') +
      kpi('ของเสีย · หมดอายุ · เบิกใช้', '฿' + money(lossAll), 'เสีย ฿' + money(sm.loss) + ' · หมดอายุ ฿' + money(sm.expiry) + ' · เบิก ฿' + money(sm.use), lossAll ? 'warn-text' : '') +
      kpi('ยกเลิก · คืน · ส่วนลด', '฿' + money(leak), 'ยกเลิก ' + sm.voids + ' บิล ฿' + money(sm.voidTotal) + ' · คืน ฿' + money(sm.refunds) + ' · ส่วนลด ฿' + money(round2(sm.discount - (sm.promo || 0))) +
        (sm.promo ? ' · โปร ฿' + money(sm.promo) : ''), leak ? 'warn-text' : '') + '</div>' +
      '<div class="card pad chart-card"><div class="ch-h"><h2>ยอดขาย' + unit + '</h2><span class="muted" id="c-trend-s"></span></div><div class="ch-box"><canvas id="c-trend"></canvas></div></div>' +
      '<div class="card pad chart-card"><div class="ch-h"><h2>ยอดขาย' + unit + ' แยกตามหมวด</h2><span class="grow"></span><div class="seg-sm">' +
        [['compare', 'เทียบกัน'], ['cards', 'แยกการ์ด']].map(function (o) { return '<button class="' + (catView === o[0] ? 'on' : '') + '" data-act="repCatView" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
        (catView === 'compare' ? '<div class="cmp"><div><div class="muted ch-cap">อันดับทั้งช่วง (แตะเพื่อเน้น)</div><div class="ch-rank"><canvas id="c-catr"></canvas></div></div>' +
          '<div><div class="muted ch-cap">แนวโน้ม</div><div class="ch-box"><canvas id="c-catl"></canvas></div><div class="cmp-pick" id="c-catp"></div></div></div>'
          : '<div class="minis" id="c-cards"></div>') + '</div>' +
      (month ? '' : '<div class="card pad chart-card"><div class="ch-h"><h2>ยอดขายรายชั่วโมง</h2><span class="muted" id="c-hour-s"></span></div><div class="ch-box"><canvas id="c-hour"></canvas></div></div>') +
      '<div class="card pad"><div class="ch-h"><h2>ตารางย้อนหลัง' + unit + '</h2><span class="muted" style="font-size:13px">แตะแถวเพื่อดู' + (month ? 'รายวันของเดือนนั้น' : 'เฉพาะวันนั้น') + '</span></div>' +
      '<div style="overflow:auto"><table class="table"><thead><tr><th>' + (month ? 'เดือน' : 'วันที่') + '</th><th class="r">บิล</th><th class="r">ยอดสุทธิ</th><th class="r">เทียบก่อนหน้า</th><th class="r">ต้นทุน</th>' +
      '<th class="r">กำไร</th><th class="r">%</th><th class="r">เสีย/หมดอายุ/เบิก</th><th class="r">กำไรหลังหัก</th></tr></thead><tbody>' +
      d.history.map(function (h, i) {
        var prev = d.history[i + 1], ch = '';
        if (prev && prev.net) { var pc = Math.round((h.net - prev.net) / prev.net * 1000) / 10; ch = '<span class="' + (pc >= 0 ? 'up' : 'down') + '">' + (pc >= 0 ? '▲ ' : '▼ ') + Math.abs(pc) + '%</span>'; }
        else if (prev && h.net) ch = '<span class="up">ใหม่</span>';
        var l = round2(h.loss + h.expiry + h.use);
        return '<tr class="click" data-act="repHist" data-k="' + h.key + '"><td><b>' + bucketLabel(h.key, kind, true) + '</b></td><td class="r num">' + h.bills + '</td><td class="r num"><b>' + money(h.net) + '</b></td>' +
          '<td class="r num">' + (ch || '<span class="muted">–</span>') + '</td><td class="r num">' + money(h.cost) + '</td><td class="r num">' + money(h.profit) + '</td><td class="r num">' + h.margin + '%</td>' +
          '<td class="r num">' + (l ? '<span class="warn-text">−' + money(l) + '</span>' : '<span class="muted">–</span>') + '</td><td class="r num"><b class="' + (h.after < 0 ? 'warn-text' : '') + '">' + money(h.after) + '</b></td></tr>';
      }).join('') +
      '<tr class="sumrow"><td><b>รวม</b></td><td class="r num"><b>' + sm.bills + '</b></td><td class="r num"><b>' + money(sm.net) + '</b></td><td></td><td class="r num">' + money(sm.cost) + '</td><td class="r num">' + money(sm.profit) +
      '</td><td class="r num">' + sm.margin + '%</td><td class="r num">' + (lossAll ? '−' + money(lossAll) : '–') + '</td><td class="r num"><b>' + money(sm.after) + '</b></td></tr></tbody></table></div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' +
      '<div class="card pad"><h2>ช่องทางชำระ</h2><div class="paybar">' + ['cash', 'qr', 'transfer'].map(function (k) {
        return '<span class="pb-' + k + '" style="width:' + Math.max(0, d.byPay[k] / payT * 100) + '%"></span>';
      }).join('') + '</div>' + ['cash', 'qr', 'transfer'].map(function (k) {
        return '<div class="row" style="justify-content:space-between"><span>' + payName(k) + '</span><b class="num">฿' + money(d.byPay[k]) + ' ' + pct(Math.round(d.byPay[k] / payT * 100)) + '</b></div>';
      }).join('') + '</div>' +
      '<div class="card pad"><h2>สินค้าขายดี</h2><table class="table"><tbody>' + (d.products.slice(0, 10).map(function (t, i) {
        return '<tr><td class="muted">' + (i + 1) + '</td><td>' + esc(t.name) + '</td><td class="r num">' + t.qty + ' ' + esc(t.unit) + '</td><td class="r num">฿' + money(t.revenue) + '</td></tr>';
      }).join('') || '<tr><td class="muted">ยังไม่มีการขาย</td></tr>') + '</tbody></table></div></div>' +
      (d.promos && d.promos.length ? '<div class="card pad"><h2>โปรโมชั่นที่ใช้</h2><table class="table"><thead><tr><th>โปรโมชั่น</th><th class="r">บิล</th><th class="r">ครั้ง</th><th class="r">ลดไป</th></tr></thead><tbody>' +
        d.promos.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td class="r num">' + x.bills + '</td><td class="r num">' + x.times + '</td><td class="r num">฿' + money(x.discount) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
      '<div class="card pad"><h2>รายการผิดปกติ</h2><table class="table"><tbody>' + (d.exceptions.slice(0, 40).map(function (x) {
        var alert = x.action === 'BELOW_COST' || x.action === 'LOW_MARGIN';
        return '<tr' + (alert ? ' class="alert-row"' : '') + '><td class="num">' + (alert ? '<span class="tag ' + (x.action === 'BELOW_COST' ? 'warn' : 'amber') + '">ราคา</span>' : d.oneDay ? timeOf(x.createdAt) : dateTime(x.createdAt)) +
          '</td><td><b>' + (ACTION_TH[x.action] || x.action) + '</b> ' + esc(x.detail) + '</td><td>' + esc(x.user) + (x.approvedBy ? ' · อนุมัติ ' + esc(x.approvedBy) : '') + '</td></tr>';
      }).join('') || '<tr><td class="muted">ไม่มี</td></tr>') + '</tbody></table></div>';
    after = function () {
      lineChart('c-trend', d.trend, kind, { sub: 'c-trend-s', onClick: function (k) { repDrill(k); },
        footer: function (k) { var h = histBy[k]; return h ? h.bills + ' บิล · กำไร ฿' + money(h.profit) : ''; } });
      if (catView === 'compare') catCompare('c-cat', d.trend, kind, r.catFocus, function (c) { r.catFocus = c; drawReport(); });
      else catCards('c-cards', d.trend, kind);
      if (!month) lineChart('c-hour', d.hours, 'hour', { sub: 'c-hour-s', noLatest: true, subPrefix: d.hours.days > 1 ? 'รวม ' + d.hours.days + ' วัน · ' : '' });
    };
  } else if (r.tab === 'products') {
    var key = r.sort, list = d.products.slice().sort(function (a, b) { return b[key] - a[key]; });
    var tot = list.reduce(function (a, x) { a.qty += x.qty; a.revenue += x.revenue; a.cost += x.cost; a.profit += x.profit; return a; }, { qty: 0, revenue: 0, cost: 0, profit: 0 });
    html = '<div class="row" style="gap:6px"><span class="muted">เรียงตาม</span>' + [['revenue', 'ยอดขาย'], ['profit', 'กำไร'], ['qty', 'จำนวน'], ['margin', '% กำไร']].map(function (x) {
      return '<button class="chip' + (key === x[0] ? ' on' : '') + '" data-act="repSort" data-k="' + x[0] + '">' + x[1] + '</button>';
    }).join('') + '<span class="grow"></span>' + head + '</div>' +
      table([['สินค้า'], ['หมวด'], ['ขาย', 1], ['ยอดขาย', 1], ['ต้นทุน', 1], ['กำไร', 1], ['%', 1]], list.map(function (x) {
        return '<tr><td>' + esc(x.name) + (x.recipe ? ' <span class="tag gray">สูตรผสม</span>' : '') + (x.refunds ? ' <span class="tag amber">คืน ฿' + money(x.refunds) + '</span>' : '') + '</td><td class="muted">' + esc(x.category) +
          '</td><td class="r num">' + x.qty + ' ' + esc(x.unit) + '</td><td class="r num">' + money(x.revenue) + '</td><td class="r num">' + money(x.cost) +
          '</td><td class="r num ' + (x.profit < 0 ? 'warn-text' : '') + '"><b>' + money(x.profit) + '</b></td><td class="r num">' + x.margin + '%</td></tr>';
      }), '<tr class="sumrow"><td><b>รวม</b></td><td></td><td></td><td class="r num"><b>' + money(tot.revenue) + '</b></td><td class="r num">' + money(tot.cost) + '</td><td class="r num"><b>' + money(tot.profit) +
        '</b></td><td class="r num">' + (tot.revenue ? Math.round(tot.profit / tot.revenue * 1000) / 10 : 0) + '%</td></tr>');
  } else if (r.tab === 'categories') {
    html = head + table([['หมวด'], ['สินค้า', 1], ['ยอดขาย', 1], ['สัดส่วน'], ['ต้นทุน', 1], ['กำไร', 1], ['%', 1]], d.categories.map(function (c) {
      return '<tr class="click" data-act="repCat" data-c="' + esc(c.category) + '"><td><b>' + esc(c.category) + '</b></td><td class="r num">' + c.items + '</td><td class="r num">' + money(c.revenue) +
        '</td><td style="min-width:140px"><div class="sharebar"><span style="width:' + Math.max(0, c.share) + '%"></span></div><span class="muted" style="font-size:12px">' + c.share + '%</span></td><td class="r num">' + money(c.cost) +
        '</td><td class="r num"><b>' + money(c.profit) + '</b></td><td class="r num">' + c.margin + '%</td></tr>';
    })) + '<div class="muted" style="font-size:13px">แตะหมวดเพื่อดูสินค้าในหมวดนั้น</div>';
  } else if (r.tab === 'staff') {
    html = head + table([['พนักงาน'], ['บิล', 1], ['ยอดสุทธิ', 1], ['เฉลี่ย/บิล', 1], ['ส่วนลด', 1], ['ยกเลิก', 1], ['คืนสินค้า', 1]], d.staff.map(function (x) {
      return '<tr><td><b>' + esc(x.name) + '</b></td><td class="r num">' + x.bills + '</td><td class="r num"><b>' + money(x.net) + '</b></td><td class="r num">' + (x.bills ? money(x.net / x.bills) : '–') +
        '</td><td class="r num">' + (x.discount ? money(x.discount) : '–') + '</td><td class="r num">' + (x.voids ? x.voids + ' (฿' + money(x.voidTotal) + ')' : '–') +
        '</td><td class="r num">' + (x.returns ? x.returns + ' (฿' + money(x.refunds) + ')' : '–') + '</td></tr>';
    }));
  } else if (r.tab === 'shifts') {
    html = head + table([['เปิดกะ'], ['ปิดกะ'], ['เครื่อง'], ['พนักงาน'], ['บิล', 1], ['ยอดขาย', 1], ['ควรมีในลิ้นชัก', 1], ['นับได้', 1], ['ขาด/เกิน', 1]], d.shifts.map(function (x) {
      var diff = x.diff === null ? '<span class="tag green">เปิดอยู่</span>' : x.diff === 0 ? '<span class="tag green">ตรง</span>' :
        '<b class="num ' + (x.diff < 0 ? 'warn-text' : 'brand-text') + '">' + (x.diff > 0 ? '+' : '') + money(x.diff) + '</b>';
      return '<tr><td class="num">' + dateTime(x.openedAt) + '</td><td class="num">' + (x.closedAt ? dateTime(x.closedAt) : '–') + '</td><td>' + esc(x.device) + '</td><td>' + esc(x.user) +
        (x.closedBy && x.closedBy !== x.user ? ' › ' + esc(x.closedBy) : '') + '</td><td class="r num">' + x.bills + '</td><td class="r num">' + money(x.sales) +
        '</td><td class="r num">' + (x.expectedCash === null ? '–' : money(x.expectedCash)) + '</td><td class="r num">' + (x.countedCash === null ? '–' : money(x.countedCash)) + '</td><td class="r">' + diff + '</td></tr>';
    }));
  } else if (r.tab === 'slow') {
    html = '<div class="row" style="gap:6px"><span class="muted">ไม่มีการขายมาแล้ว</span>' + [30, 60, 90].map(function (n) {
      return '<button class="chip' + (Number(r.f.slowDays) === n ? ' on' : '') + '" data-act="repSlow" data-n="' + n + '">' + n + ' วัน</button>';
    }).join('') + '<span class="grow"></span><span class="muted" style="font-size:13px">' + d.slow.length + ' รายการ · ทุนจม ฿' + money(d.slow.reduce(function (a, x) { return a + x.value; }, 0)) + '</span></div>' +
      table([['สินค้า'], ['หมวด'], ['คงเหลือ', 1], ['มูลค่าทุน', 1], ['ขายล่าสุด', 1]], d.slow.map(function (x) {
        return '<tr><td>' + esc(x.name) + (x.forSale ? '' : ' <span class="tag gray">วัตถุดิบ</span>') + '</td><td class="muted">' + esc(x.category) + '</td><td class="r num">' + x.onHand + ' ' + esc(x.unit) +
          '</td><td class="r num"><b>' + money(x.value) + '</b></td><td class="r">' + (x.days === null ? '<span class="tag warn">ไม่เคยขาย</span>' : x.days + ' วันก่อน') + '</td></tr>';
      })) + '<div class="muted" style="font-size:13px">สินค้าที่ยังมีของแต่ไม่ได้ขายเลยตามจำนวนวันที่เลือก (นับถึงวันนี้ ไม่ขึ้นกับช่วงเวลาด้านซ้าย) — วัตถุดิบนับวันที่ถูกใช้ในสูตรล่าสุด</div>';
  } else if (r.tab === 'stock') {
    html = '<div class="kpis">' + kpi('มูลค่าสต็อกรวม (ทุน FIFO)', '฿' + money(d.stock.total), 'ณ ตอนนี้ · ไม่ขึ้นกับช่วงเวลา', 'brand-text') + '</div>' +
      table([['หมวด'], ['รายการ', 1], ['ชิ้น', 1], ['มูลค่าทุน', 1], ['สัดส่วน']], d.stock.categories.map(function (c) {
        return '<tr><td><b>' + esc(c.category) + '</b></td><td class="r num">' + c.items + '</td><td class="r num">' + c.pieces + '</td><td class="r num"><b>' + money(c.value) +
          '</b></td><td style="min-width:160px"><div class="sharebar"><span style="width:' + c.share + '%"></span></div><span class="muted" style="font-size:12px">' + c.share + '%</span></td></tr>';
      }), '<tr class="sumrow"><td><b>รวม</b></td><td></td><td></td><td class="r num"><b>' + money(d.stock.total) + '</b></td><td></td></tr>');
  }
  killCharts();
  box.innerHTML = html;
  if (after) after();
}

/** Tap a day / month (table row or chart point): day → just that day; month → its days. */
function repDrill(k) {
  var rs = repState();
  if (k.length === 7) { rs.gran = 'day'; rs.preset = ''; rs.f.gran = 'day'; rs.f.from = k + '-01'; var e = new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)), 0); rs.f.to = fmtYmd(e) > today() ? today() : fmtYmd(e); }
  else { rs.preset = ''; rs.f.gran = 'day'; rs.f.from = rs.f.to = k; }
  render(); loadReport();
}

/* =================================================================== */
/* Settings                                                            */
/* =================================================================== */

function renderSettings() {
  var st = S.settings;
  var f = function (key, label, ph, type) {
    return '<div class="field"><label for="s-' + key + '">' + label + '</label><input id="s-' + key + '" data-skey="' + key + '" type="' + (type || 'text') +
      '" value="' + esc(st[key] || '') + '" placeholder="' + esc(ph || '') + '"></div>';
  };
  var pal = ['forest', 'ocean', 'sunset', 'berry', 'ruby', 'mono'];
  var palTh = { forest: 'ป่า', ocean: 'ทะเล', sunset: 'อัสดง', berry: 'เบอร์รี่', ruby: 'ทับทิม', mono: 'ขาวดำ' };
  var local = store('em_theme') || '';
  return '<div class="page" style="flex-direction:column;gap:14px"><div class="set-grid">' +
    '<form class="card pad col" data-form="settings" style="gap:10px"><h2>ร้าน</h2>' + f('shopName', 'ชื่อร้าน (บนใบเสร็จ)') + f('shopAddress', 'ที่อยู่') +
    f('taxId', 'เลขผู้เสียภาษี', 'ถ้ามี') + f('promptPayId', 'พร้อมเพย์', 'เบอร์มือถือ / เลขบัตร 13 หลัก') + f('receiptFooter', 'ข้อความท้ายใบเสร็จ') +
    f('billPrefix', 'คำนำหน้าเลขบิล', 'เว้นว่างได้') +
    '<div class="field"><label for="s-autoPrint">พิมพ์ใบเสร็จอัตโนมัติหลังรับเงิน</label><select id="s-autoPrint" data-skey="autoPrint">' +
      '<option value="1">พิมพ์ทุกบิล (ยกเลิกได้ในหน้าชำระเงิน)</option><option value="0"' + (st.autoPrint === '0' ? ' selected' : '') + '>ไม่พิมพ์ (ติ๊กพิมพ์เองเฉพาะบิลที่ลูกค้าขอ)</option></select></div>' +
    '<div class="field"><label for="s-autoLockMinutes">ล็อกหน้าจอเมื่อไม่มีใครใช้ (ต้องใส่ PIN ใหม่)</label><select id="s-autoLockMinutes" data-skey="autoLockMinutes">' +
      [['0', 'ไม่ล็อก'], ['5', '5 นาที'], ['10', '10 นาที'], ['15', '15 นาที'], ['30', '30 นาที'], ['60', '1 ชั่วโมง'], ['120', '2 ชั่วโมง']].map(function (o) {
        return '<option value="' + o[0] + '"' + (String(st.autoLockMinutes === undefined ? '5' : st.autoLockMinutes) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
    '<h2 style="margin:8px 0 0">จอลูกค้า</h2>' + f('customerWelcome', 'ข้อความต้อนรับ', 'ยินดีต้อนรับค่ะ') + f('shopHours', 'เวลาเปิด–ปิด', 'เช่น เปิดทุกวัน 06:00–22:00') +
    f('customerPromoTitle', 'ข้อความโปร (หัวข้อ · เป็นสไลด์ข้อความ)', 'เว้นว่าง = ไม่แสดง') + f('customerPromoText', 'ข้อความโปร (รายละเอียด)', 'เช่น ซื้อ 2 ขวด 25 บาท') +
    '<div class="grid3">' + f('slideSeconds', 'วินาทีต่อสไลด์', '8', 'number') +
    '<div class="field"><label for="s-slidesAuto">สไลด์จากโปรโมชั่น</label><select id="s-slidesAuto" data-skey="slidesAuto"><option value="1">แสดง</option><option value="0"' + (st.slidesAuto === '0' ? ' selected' : '') + '>ไม่แสดง</option></select></div>' +
    '<div class="field"><label for="s-cdHints">บอกโปรตอนสแกน</label><select id="s-cdHints" data-skey="cdHints"><option value="1">เปิด</option><option value="0"' + (st.cdHints === '0' ? ' selected' : '') + '>ปิด</option></select></div></div>' +
    '<button class="btn primary" type="submit">บันทึก</button></form>' +
    '<form class="card pad col" data-form="settings" style="gap:10px"><h2>ธีม & LINE</h2>' +
    '<div class="field"><label for="s-theme">โหมดสี (ทั้งร้าน)</label><select id="s-theme" data-skey="theme">' + ['light', 'dark', 'system'].map(function (t) {
      return '<option value="' + t + '"' + (st.theme === t ? ' selected' : '') + '>' + { light: 'สว่าง', dark: 'มืด', system: 'ตามเครื่อง' }[t] + '</option>';
    }).join('') + '</select></div>' +
    '<div class="field"><label for="s-palette">สีหลัก</label><select id="s-palette" data-skey="palette">' + pal.map(function (p) {
      return '<option value="' + p + '"' + (st.palette === p ? ' selected' : '') + '>' + palTh[p] + '</option>';
    }).join('') + '</select></div>' +
    '<div class="field"><label for="localtheme">โหมดสีเฉพาะเครื่องนี้</label><select id="localtheme" data-change="localTheme"><option value="">ตามร้าน</option>' +
    '<option value="light"' + (local === 'light' ? ' selected' : '') + '>สว่าง</option><option value="dark"' + (local === 'dark' ? ' selected' : '') + '>มืด</option></select></div>' +
    f('lineChannelToken', 'LINE Channel access token', 'เว้นว่าง = ไม่ส่ง', 'password') + f('lineTargetId', 'LINE ผู้รับ (userId / groupId)') +
    '<button class="btn primary" type="submit">บันทึก</button></form>' +
    '<div class="card pad col" style="gap:10px"><h2>เครื่องนี้</h2><div class="muted" style="font-size:13px;word-break:break-all">รหัส ' + esc(S.deviceId) + '</div>' +
    '<div>' + (S.isCounter ? '<span class="tag green">เครื่องหน้าร้าน</span>' : '<span class="tag warn">ยังไม่ได้ลงทะเบียน</span>') + '</div>' +
    (S.isCounter ? '<button class="btn warn" data-act="unregisterThis">ยกเลิกการลงทะเบียนเครื่องนี้</button>' : '<button class="btn primary" data-act="registerThis">ลงทะเบียนเป็นเครื่องหน้าร้าน</button>') +
    '<div id="devlist" class="muted" style="font-size:13px"></div><hr style="border:0;border-top:1px solid var(--line);width:100%">' +
    drawerSettings() + '<hr style="border:0;border-top:1px solid var(--line);width:100%">' +
    '<h2>การเชื่อมต่อ</h2><div class="muted" style="font-size:13px;word-break:break-all">' + esc(conn().url.replace(/(macros\/s\/.{6}).*(.{6}\/exec)/, '$1…$2')) + '</div>' +
    '<div class="row" style="flex-wrap:wrap"><button class="btn sm" data-act="copyConnect">คัดลอกลิงก์ตั้งค่าเครื่องอื่น</button><button class="btn sm ghost" data-act="connect">เปลี่ยน</button></div>' +
    '<div class="muted" style="font-size:12px">ลิงก์นี้มี API key — ส่งให้เฉพาะเครื่องของร้าน</div>' +
    '<hr style="border:0;border-top:1px solid var(--line);width:100%"><h2>ไฟล์เปิดในเครื่อง</h2>' +
    (window.EM_LOCAL ? '<div class="muted" style="font-size:13px">เครื่องนี้เปิดจากไฟล์ในคอม · เวอร์ชัน ' + esc(window.EM_BUILD || '') + ' (UTC)<br>ไฟล์ไม่อัปเดตเอง — มีฟีเจอร์ใหม่ให้ดาวน์โหลดชุดติดตั้งแล้วรัน Install-EarthMart.bat อีกครั้ง</div>' +
      '<a class="btn sm" href="https://earthlk.github.io/EarthMart/EarthMart-Setup.zip" target="_blank" rel="noopener">ดาวน์โหลดชุดติดตั้งล่าสุด</a>'
      : '<div class="muted" style="font-size:13px">ติดตั้งบนคอมเครื่องอื่น: แตก ZIP แล้วรัน Install-EarthMart.bat → ได้ไอคอนหน้าร้าน (kiosk) / หลังร้าน และเปิดเองตอนเปิดเครื่อง · ยังเชื่อมกับ Google Sheet ของร้าน</div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap"><a class="btn sm" href="EarthMart-Setup.zip" download>ชุดติดตั้ง Windows (.zip)</a><a class="btn sm ghost" href="EarthMart-local.html" download="EarthMart.html">เฉพาะไฟล์ .html</a></div>') +
    '<hr style="border:0;border-top:1px solid var(--line);width:100%">' +
    '<h2>สำรองข้อมูล</h2><div class="muted" style="font-size:13px">Backup อัตโนมัติทุกวันตั้งได้ด้วย installTriggers() (ดูคู่มือ)</div>' +
    '<button class="btn" data-act="backupNow">Backup ตอนนี้</button></div></div>' +
    '<div class="set-grid2">' + slidesCard() + '<div class="card pad"><h2>พนักงาน & สิทธิ์</h2><div id="userlist" class="muted">กำลังโหลด…</div>' +
    '<form class="row" data-form="addUser" style="margin-top:10px;flex-wrap:wrap"><label class="sr" for="nu-name">ชื่อ</label><input id="nu-name" placeholder="ชื่อ" style="width:140px">' +
    '<label class="sr" for="nu-role">สิทธิ์</label><select id="nu-role"><option value="cashier">แคชเชียร์</option><option value="owner">เจ้าของ</option></select>' +
    '<label class="sr" for="nu-pin">PIN</label><input id="nu-pin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN 4–6 หลัก" style="width:120px">' +
    '<button class="btn" type="submit">+ เพิ่ม</button></form></div></div>' +
    '<div class="card pad" style="max-height:420px;overflow:auto"><h2>บันทึกการทำงาน (ล่าสุด 100)</h2><table class="table"><tbody id="auditrows"><tr><td class="muted">กำลังโหลด…</td></tr></tbody></table></div></div>';
}

function drawerSettings() {
  if (!window.CashDrawer) return '';
  var d = CashDrawer.load(), sup = CashDrawer.support();
  var modeTh = { none: 'ให้ไดรเวอร์เครื่องพิมพ์เปิดเอง', serial: 'Web Serial (COM)', usb: 'WebUSB' };
  return '<h2>ลิ้นชักเก็บเงิน (เครื่องนี้)</h2>' +
    '<div class="muted" style="font-size:13px">ตอนนี้: <b>' + modeTh[d.mode] + '</b>' + (d.label ? ' · ' + esc(d.label) : '') +
    (d.vid ? ' · ' + d.vid.toString(16).padStart(4, '0') + ':' + d.pid.toString(16).padStart(4, '0') : '') + '</div>' +
    (!sup.secure ? '<div class="warn-text" style="font-size:13px">ต้องเปิดผ่าน https</div>' : '') +
    '<div class="row" style="flex-wrap:wrap">' +
    '<button class="btn sm" data-act="drawerPick" data-m="serial" ' + (sup.serial ? '' : 'disabled') + '>เลือกพอร์ต COM</button>' +
    '<button class="btn sm" data-act="drawerPick" data-m="usb" ' + (sup.usb ? '' : 'disabled') + '>เลือก USB</button>' +
    '<button class="btn sm ghost" data-act="drawerPick" data-m="none">ปิด</button></div>' +
    '<div class="row" style="flex-wrap:wrap"><label for="dr-pin" style="font-size:13px">ขา</label><select id="dr-pin" data-change="drawerPin" style="width:90px">' +
    '<option value="0"' + (d.pin ? '' : ' selected') + '>Pin 2</option><option value="1"' + (d.pin ? ' selected' : '') + '>Pin 5</option></select>' +
    (d.mode === 'serial' ? '<label for="dr-baud" style="font-size:13px">Baud</label><select id="dr-baud" data-change="drawerBaud" style="width:110px">' +
      [9600, 19200, 38400, 115200].map(function (b) { return '<option' + (Number(d.baud) === b ? ' selected' : '') + '>' + b + '</option>'; }).join('') + '</select>' : '') +
    '<button class="btn sm primary" data-act="drawerTest" ' + (d.mode === 'none' ? 'disabled' : '') + '>ทดสอบเปิด</button></div>';
}

function loadSettings() {
  api('listSlides', S.token).then(function (list) { S.slides = list; drawSlideList(); }).catch(function () {});
  api('listUsers', S.token).then(function (us) {
    var box = $('#userlist');
    if (!box) return;
    box.classList.remove('muted');
    box.innerHTML = '<table class="table"><tbody>' + us.map(function (u) {
      return '<tr><td>' + esc(u.name) + '</td><td>' + (u.role === 'owner' ? 'เจ้าของ' : 'แคชเชียร์') + (u.active ? '' : ' <span class="tag warn">ปิดใช้งาน</span>') +
        '</td><td class="r"><button class="btn sm" data-act="resetPin" data-id="' + esc(u.userId) + '">ตั้ง PIN ใหม่</button> ' +
        '<button class="btn sm ghost" data-act="toggleUser" data-id="' + esc(u.userId) + '" data-on="' + (u.active ? '0' : '1') + '">' + (u.active ? 'ปิด' : 'เปิด') + '</button></td></tr>';
    }).join('') + '</tbody></table>';
  }).catch(fail);
  api('listDevices', S.token).then(function (ds) {
    var box = $('#devlist');
    if (box) box.innerHTML = 'เครื่องหน้าร้านทั้งหมด: ' + (ds.map(function (d) { return esc(d.name); }).join(', ') || '—');
  }).catch(function () {});
  api('auditLog', S.token, 100).then(function (rows) {
    var tb = $('#auditrows');
    if (!tb) return;
    tb.innerHTML = rows.map(function (r) {
      return '<tr><td class="num" style="white-space:nowrap">' + dateTime(r.createdAt) + '</td><td>' + esc(r.user) + '</td><td><b>' + esc(ACTION_TH[r.action] || r.action) +
        '</b> ' + esc(r.ref) + ' ' + esc(r.detail) + (r.approvedBy ? ' · อนุมัติ ' + esc(r.approvedBy) : '') + '</td></tr>';
    }).join('') || '<tr><td class="muted">ยังไม่มี</td></tr>';
  }).catch(fail);
}

function saveSettingsForm(form) {
  var vals = {};
  $all('[data-skey]', form).forEach(function (i) { vals[i.getAttribute('data-skey')] = i.value; });
  api('saveSettings', S.token, vals).then(function (st) {
    S.settings = st; applyTheme(); toast('บันทึกแล้ว'); render(); loadSettings();
  }).catch(fail);
}

/* =================================================================== */
/* Events (one delegated handler per event type)                       */
/* =================================================================== */

var ACTIONS = {
  pickUser: function (el) { clearTimeout(pinTimer); S.loginUser = el.getAttribute('data-id'); S.pin = ''; render(); },
  pinKey: function (el) { pinKey(el.getAttribute('data-k')); },
  go: function (el, e) { if (e) e.preventDefault(); go(el.getAttribute('data-v')); },
  logout: logout,
  keyGroup: function (el) { S.keyGroup = el.getAttribute('data-g'); render(); renderCartOnly(); },
  quickKey: function (el) {
    if (!S.shift) return toast('ยังไม่ได้เปิดกะ', true);
    addItem(S.idx.bySku[el.getAttribute('data-sku')], null, 1);
  },
  pickSuggest: function (el) {
    var s = S.suggest[Number(el.getAttribute('data-i'))];
    if (s) { addItem(S.idx.bySku[s.sku], null, s.qty); clearScan(); }
  },
  selLine: function (el, e) { if (e.target.closest('.qty, .ldisc, .mdchip')) return; S.cart.sel = Number(el.getAttribute('data-i')); renderCartOnly(); },
  qty: function (el) { changeQty(Number(el.getAttribute('data-i')), Number(el.getAttribute('data-d'))); },
  billDiscount: function () { askDiscount('bill'); },
  lineDisc: function (el) { S.cart.sel = Number(el.getAttribute('data-i')); askDiscount('line'); },
  holdBill: holdBill,
  bulkOpen: function () { S.bulk = { edits: {} }; render(); drawBulk(); },
  bulkClose: function () {
    var go2 = function () { S.bulk = null; render(); renderProductRows(); };
    if (bulkChanges().length) confirm2('ทิ้งราคาที่แก้', 'ยังไม่ได้บันทึก ' + bulkChanges().length + ' รายการ', 'ทิ้ง', true).then(function (ok) { if (ok) go2(); }); else go2();
  },
  bulkApply: bulkApply,
  bulkReset: function () { S.bulk.edits = {}; drawBulk(); },
  bulkSave: bulkSave,
  outbox: function () { outboxModal(); },
  toggleMd: function (el) { toggleMd(Number(el.getAttribute('data-i'))); },
  expTab: function (el) { S.expTab = el.getAttribute('data-t'); S.expSel = null; render(); drawExpiry(); },
  expPick: function (el) {
    var r = S.exp.todo.filter(function (x) { return x.lotId === el.getAttribute('data-lot'); })[0];
    S.expSel = { lotId: r.lotId, action: el.getAttribute('data-a'), found: Math.max(0, r.qtyLeft), pct: S.exp.markdownPct };
    drawExpiry();
  },
  expAct: function (el) { S.expSel.action = el.getAttribute('data-a'); drawExpAction(); },
  expPct: function (el) { S.expSel.pct = Number(el.getAttribute('data-p')); drawExpAction(); },
  expStep: function (el) { S.expSel.found = Math.max(0, (Number(S.expSel.found) || 0) + Number(el.getAttribute('data-d'))); drawExpAction(); },
  expSave: expSave,
  expSaveSet: function () {
    var w = {};
    $all('[data-xw]').forEach(function (i) { if (i.value !== '') w[i.getAttribute('data-xw')] = Number(i.value); });
    api('saveExpirySettings', S.token, w, $('#xpct').value).then(function (r) {
      S.exp.warnDays = r.warnDays; S.exp.markdownPct = r.markdownPct; toast('บันทึกแล้ว'); loadExpiry();
    }).catch(fail);
  },
  goExpiry: function () { go('expiry'); },
  stockTab: function (el) { S.stockTab = el.getAttribute('data-t'); render(); loadStock(); },
  stockCat: function (el) { S.stockFilter.cat = el.getAttribute('data-c'); drawStockTab(); },
  cntCommit: cntCommit,
  cntClear: function () { confirm2('ล้างการนับ', 'ลบตัวเลขที่นับไว้ทั้งหมด?', 'ล้าง', true).then(function (ok) { if (ok) { S.cnt = null; store('em_count', null); drawStockTab(); } }); },
  woPick: function (el) { S.wo = { sku: el.getAttribute('data-sku'), qty: '', reason: (S.wo || {}).reason || 'เสียหาย', lotId: '' }; drawWriteOff(); var n = $('#wo-n'); if (n) n.focus(); },
  woClear: function () { S.wo = Object.assign(S.wo, { sku: '', lotId: '' }); drawWriteOff(); var q = $('#wo-q'); if (q) q.focus(); },
  woReason: function (el) { S.wo.reason = el.getAttribute('data-r'); drawWriteOff(); },
  woCommit: woCommit,
  openCustomer: function () {
    if (!CustomerDisplay.pos.open()) return toast('เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาต pop-up ให้เว็บนี้ก่อน', true);
    toast('ลากหน้าต่างไปจอที่ 2 แล้วดับเบิลคลิกเพื่อเต็มจอ');
  },
  rcAddSku: function (el) { rcAdd(el.getAttribute('data-sku'), ''); var i = $('#rscan'); if (i) { i.value = ''; i.focus(); } drawRcSuggest(''); },
  rcDel: function (el) { rcDraft().lines.splice(Number(el.getAttribute('data-i')), 1); rcSave(); drawRcLines(); },
  rcClear: function () { confirm2('ล้างรายการ', 'ลบรายการรับทั้งหมดในใบนี้?', 'ล้าง', true).then(function (ok) { if (ok) { S.rc = null; store('em_receive', null); render(); loadReceive(); } }); },
  rcCommit: rcCommit,
  showLots: function (el) { showLots(el.getAttribute('data-sku')); },
  editQty: function (el) {
    var i = el && el.hasAttribute('data-i') ? Number(el.getAttribute('data-i')) : S.cart.sel;
    var l = S.cart.lines[i];
    if (!l) return;
    S.cart.sel = i;
    prompt2('แก้จำนวน: ' + l.name, 'จำนวน (' + l.unitName + ')', String(l.qty), { type: 'number', inputmode: 'numeric' }).then(function (v) {
      if (v === null) return;
      var n = Math.round(Number(v));
      if (!(n >= 0)) return toast('จำนวนไม่ถูกต้อง', true);
      if (n === l.qty) return;
      changeQty(i, n - l.qty);
    });
  },
  payQr: function () { openPay('qr'); },
  cashMoveModal: function () {
    var type = 'OUT';
    var m = openModal('<header><h1>เงินเข้า / ออกลิ้นชัก</h1></header><form class="body">' +
      '<div class="seg"><button type="button" data-t="OUT" class="on">เงินออก</button><button type="button" data-t="IN">เงินเข้า</button></div>' +
      '<div class="field"><label for="cm-amt">จำนวนเงิน</label><input id="cm-amt" type="number" step="0.25" inputmode="decimal" class="big-input" autofocus></div>' +
      '<div class="field"><label for="cm-why">เหตุผล</label><input id="cm-why" placeholder="เช่น ค่าน้ำแข็ง, แลกเหรียญ"></div></form>' +
      '<footer><button class="btn" data-x="no">ยกเลิก</button><button class="btn primary" data-x="ok">บันทึก</button></footer>');
    $all('[data-t]', m).forEach(function (b) { b.onclick = function () { type = b.getAttribute('data-t'); $all('[data-t]', m).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    var save = function () {
      cashMove(type, $('#cm-amt', m).value, $('#cm-why', m).value).then(function (sum) {
        closeModal(); toast((type === 'IN' ? 'บันทึกเงินเข้าแล้ว' : 'บันทึกเงินออกแล้ว') + (sum ? '' : ' (รอส่ง)')); openDrawer(true);
      }).catch(fail);
    };
    $('[data-x=ok]', m).onclick = save;
    $('[data-x=no]', m).onclick = function () { closeModal(); };
    $('form', m).onsubmit = function (e) { e.preventDefault(); save(); };
  },
  clearCart: function () {
    if (!S.cart.lines.length) return;
    confirm2('ล้างบิล', 'ลบสินค้าทั้งหมดในบิลนี้?', 'ล้างบิล', true).then(function (ok) { if (ok) { newCart(); renderCartOnly(); } });
  },
  pay: openPay,
  noSale: noSale,
  storeUse: function () { storeUseModal(); },
  reload: function () { location.reload(); },
  connect: function () { showConnect(''); },
  copyConnect: function () {
    var link = connectLink();
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { toast('คัดลอกลิงก์แล้ว'); })
      .catch(function () { prompt2('ลิงก์ตั้งค่าเครื่องอื่น', 'คัดลอกลิงก์นี้', link); });
  },
  drawerPick: function (el) {
    CashDrawer.choose(el.getAttribute('data-m')).then(function () { render(); loadSettings(); toast('บันทึกการตั้งค่าลิ้นชักแล้ว'); })
      .catch(function (e) { if (e && e.name !== 'NotFoundError') fail(e); });
  },
  drawerTest: function () { openDrawer().then(function (ok) { if (ok) toast('ส่งคำสั่งเปิดลิ้นชักแล้ว'); }); },
  billDetail: function (el) { billDetail(el.getAttribute('data-no')); },
  billsGo: function (el) { if (el.getAttribute('data-l')) billsGo(el.getAttribute('data-l'), el.getAttribute('data-k')); },
  billsStep: function (el) { billsStep(Number(el.getAttribute('data-d'))); },
  billsToday: function () { billsGo('day', today()); },
  repPreset: function (el) { repPreset(el.getAttribute('data-k')); render(); loadReport(); },
  repTab: function (el) { repState().tab = el.getAttribute('data-t'); $all('.rep-tabs .tab').forEach(function (b) { b.classList.toggle('on', b === el); }); drawReport(); },
  repSort: function (el) { repState().sort = el.getAttribute('data-k'); drawReport(); },
  repCat: function (el) { var rs = repState(); rs.f.category = el.getAttribute('data-c'); rs.f.sku = ''; rs.tab = 'products'; render(); loadReport(); },
  repSlow: function (el) { repState().f.slowDays = Number(el.getAttribute('data-n')); loadReport(); },
  repToggleF: function () {
    var rs = repState(); rs.showF = !rs.showF; store('em_repfilters', rs.showF ? '1' : '0');
    $('.rep-f').classList.toggle('hidden', !rs.showF);
    var b = $('#rf-btn'); b.classList.toggle('on', rs.showF); b.setAttribute('aria-expanded', rs.showF); b.innerHTML = 'ตัวกรองเพิ่มเติม' + repFilterBadge() + ' ' + (rs.showF ? '▴' : '▾');
  },
  repGran: function (el) {
    var rs = repState(), g = el.getAttribute('data-g');
    if (rs.gran === g) return;
    rs.gran = g;
    if (g === 'month') repMonthPreset(rs.mPreset || 'month'); else repPreset(rs.preset || 'today');
    render(); loadReport();
  },
  repCatView: function (el) { repState().catView = el.getAttribute('data-v'); drawReport(); },
  repFocus: function (el) { repState().catFocus = el.getAttribute('data-c'); drawReport(); },
  repHist: function (el) { repDrill(el.getAttribute('data-k')); },
  repMonthPreset: function (el) { repMonthPreset(el.getAttribute('data-k')); render(); loadReport(); },
  repClear: function () { var rs = repState(); rs.f = { from: rs.f.from, to: rs.f.to, slowDays: rs.f.slowDays }; loadReport(); },
  selProduct: function (el) { selectProduct(el.getAttribute('data-sku')); },
  edClose: function () { selectProduct(null); },
  slideMove: function (el) { api('saveSlide', S.token, { slideId: el.getAttribute('data-id'), move: Number(el.getAttribute('data-d')) }).then(slidesChanged).catch(fail); },
  slideToggle: function (el) { api('saveSlide', S.token, { slideId: el.getAttribute('data-id'), active: el.getAttribute('data-on') === '1' }).then(slidesChanged).catch(fail); },
  slideEdit: function (el) { slideModal((S.slides || []).filter(function (x) { return x.slideId === el.getAttribute('data-id'); })[0], ''); },
  slideDel: function (el) {
    confirm2('ลบสไลด์', 'ลบรูปนี้ออกจากจอลูกค้า?', 'ลบ', true).then(function (ok) {
      if (ok) api('deleteSlide', S.token, el.getAttribute('data-id')).then(slidesChanged).catch(fail);
    });
  },
  prodImgDel: function () {
    var sku = S.ed && S.ed.p.sku;
    if (!sku) return;
    confirm2('ลบรูปสินค้า', 'กลับไปใช้ไอคอนแทน?', 'ลบรูป', true).then(function (ok) {
      if (ok) api('removeProductImage', S.token, sku).then(function (r) { toast('ลบรูปแล้ว'); prodImgSet(sku, ''); }).catch(fail);
    });
  },
  labOpen: function () { labOpen(); },
  labClose: function () { S.labelMode = false; render(); renderProductRows(); },
  labPromo: function (el) { labOpen('promo', el.getAttribute('data-id')); },
  labKind: function (el) { labState().kind = el.getAttribute('data-k'); labSave(); render(); drawLabItems(); },
  labPaper: function (el) { labState().paper = el.getAttribute('data-p'); labSave(); render(); drawLabItems(); },
  labPick: function (el) { labAdd(el.getAttribute('data-sku')); $('#lab-q').value = ''; labSug(''); drawLabItems(); },
  labN: function (el) { var it = labState().items[Number(el.getAttribute('data-i'))]; it.copies = Math.max(1, it.copies + Number(el.getAttribute('data-d'))); drawLabItems(); },
  labDel: function (el) { labState().items.splice(Number(el.getAttribute('data-i')), 1); render(); drawLabItems(); },
  labClear: function () { labState().items = []; render(); drawLabItems(); },
  labRecent: function () { (S.lastPriceSkus || []).forEach(function (k) { labAdd(k); }); render(); drawLabItems(); },
  labPromoItems: function () {
    var w = promoNow();
    (S.promos || []).filter(function (p) { return promoLive(p, w); }).forEach(function (p) {
      promoItems(p).forEach(function (it) { var k = String(it && it.sku !== undefined ? it.sku : it); if (!labState().items.some(function (x) { return x.sku === k; })) labAdd(k); });
    });
    render(); drawLabItems();
  },
  labPromoN: function (el) { var l = labState(), id = el.getAttribute('data-id'); l.promos[id] = Math.max(0, (l.promos[id] || 0) + Number(el.getAttribute('data-d'))); drawLabItems(); },
  labMakeCode: function (el) { labMakeCode(Number(el.getAttribute('data-i'))); },
  labPrint: function () { labPrint(); },
  mBulk: function () { S.bulk = { edits: {} }; go('products'); drawBulk(); },
  mPromo: function () { S.promoMode = true; S.bulk = null; go('products'); loadPromos(); },
  promoOpen: function () { S.promoMode = true; S.bulk = null; render(); loadPromos(); },
  promoClose: function () { S.promoMode = false; render(); renderProductRows(); },
  promoEdit: function (el) { promoModal(el.getAttribute('data-id')); },
  promoNew: function () { promoModal(''); },
  promoToggle: function (el) {
    api('setPromoActive', S.token, el.getAttribute('data-id'), el.getAttribute('data-on') === '1').then(function () { return Promise.all([loadPromos(), reloadCatalog()]); }).catch(fail);
  },
  mStock: function (el) {
    var t = el.getAttribute('data-t');
    if (t === 'receive' || t === 'expiry') return go(t);
    S.stockTab = t; go('stock');
  },
  camScan: function (el) { camScan(el.getAttribute('data-for')); },
  csvTemplate: downloadCsvTemplate,
  importCsv: importCsv,
  countStock: function (el) { countStock(el.getAttribute('data-sku')); },
  stockHist: function (el) { stockHist(el.getAttribute('data-sku')); },
  closeShift: closeShift,
  registerThis: function () {
    prompt2('ลงทะเบียนเครื่องหน้าร้าน', 'ชื่อเครื่อง', 'เครื่อง 1').then(function (name) {
      if (name === null) return;
      return api('registerDevice', S.token, S.deviceId, name).then(function () { return boot(); }).then(function () { toast('ลงทะเบียนแล้ว'); go('settings'); });
    }).catch(fail);
  },
  unregisterThis: function () {
    confirm2('ยกเลิกการลงทะเบียน', 'เครื่องนี้จะขายและเปิดกะไม่ได้อีก', 'ยกเลิกลงทะเบียน', true).then(function (ok) {
      if (!ok) return;
      return api('unregisterDevice', S.token, S.deviceId).then(function () { return boot(); }).then(function () { go('settings'); });
    }).catch(fail);
  },
  backupNow: function () { api('backupNow', S.token).then(function (n) { toast('Backup แล้ว: ' + n); }).catch(fail); },
  resetPin: function (el) {
    prompt2('ตั้ง PIN ใหม่', 'PIN 4–6 หลัก', '', { type: 'password', inputmode: 'numeric' }).then(function (pin) {
      if (pin === null) return;
      return api('resetPin', S.token, el.getAttribute('data-id'), pin).then(function () { toast('ตั้ง PIN แล้ว'); });
    }).catch(fail);
  },
  toggleUser: function (el) {
    api('setUserActive', S.token, el.getAttribute('data-id'), el.getAttribute('data-on') === '1').then(loadSettings).catch(fail);
  }
};

document.addEventListener('mousedown', function (e) { if (e.target.closest('[data-dk],[data-dpm]')) e.preventDefault(); });
document.addEventListener('focusin', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-den')) { S.denFocus = e.target; denomRefresh(e.target.getAttribute('data-p')); } });
document.addEventListener('click', function (e) {
  S.lastActivity = Date.now();
  var dk = e.target.closest('[data-dk]');
  if (dk) { denomKey(dk); return; }
  var dpm = e.target.closest('[data-dpm]');
  if (dpm) { denomStep(dpm); return; }
  var drow = e.target.closest('.den-row');
  if (drow && !e.target.closest('input')) { var di = drow.querySelector('input'); di.focus(); di.select(); return; }
  var el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (topModal() && !topModal().contains(el)) return;
  var fn = ACTIONS[el.getAttribute('data-act')];
  if (fn) fn(el, e);
});

document.addEventListener('submit', function (e) {
  var form = e.target;
  var kind = form.getAttribute('data-form');
  if (!kind) return;
  e.preventDefault();
  if (kind === 'connect') return saveConnect();
  if (kind === 'billFind') {
    var q = $('#bfind').value.trim();
    if (q.length < 2) return toast('พิมพ์เลขบิลอย่างน้อย 2 ตัว', true);
    var b = billsState(); b.level = 'search'; b.q = q; b.autoOpen = true;
    render(); loadBills();
    return;
  }
  if (kind === 'openShift') openShift();
  if (kind === 'settings') saveSettingsForm(form);
  if (kind === 'addUser') {
    api('addUser', S.token, $('#nu-name').value, $('#nu-role').value, $('#nu-pin').value).then(function () {
      toast('เพิ่มผู้ใช้แล้ว'); $('#nu-name').value = ''; $('#nu-pin').value = ''; loadSettings();
    }).catch(fail);
  }
  if (kind === 'cashMove') {
    var type = ($('[data-mv].on') || {}).getAttribute ? $('[data-mv].on').getAttribute('data-mv') : 'OUT';
    cashMove(type, $('#mvamt').value, $('#mvwhy').value).then(function (s) {
      toast(s ? 'บันทึกแล้ว' : 'บันทึกแล้ว (รอส่ง)'); $('#mvamt').value = ''; $('#mvwhy').value = ''; if (s) drawShiftSum(s);
    }).catch(fail);
  }
});

document.addEventListener('click', function (e) {
  var ed = e.target.closest('[data-ed]');
  if (ed && !ed.disabled && !topModal()) { edClick(ed); return; }
  var mv = e.target.closest('[data-mv]');
  if (mv) $all('[data-mv]').forEach(function (b) { b.classList.toggle('on', b === mv); });
});

document.addEventListener('input', function (e) {
  if (e.target.id === 'lab-q') return labSug(e.target.value);
  if (e.target.id === 'c-link') {
    var cl = parseConnectLink(e.target.value);
    if (cl) { $('#c-url').value = cl.url; $('#c-key').value = cl.key; toast('อ่านลิงก์แล้ว — กด "ทดสอบและบันทึก"'); }
    return;
  }
  S.lastActivity = Date.now();
  var t = e.target;
  if (t.hasAttribute('data-den')) {
    if (!/^\d*\.?\d*$/.test(t.value)) t.value = t.value.replace(/[^\d.]/g, '');
    denomRefresh(t.getAttribute('data-p'));
  }
  if (t.hasAttribute('data-ef') || t.hasAttribute('data-ec') || t.hasAttribute('data-ecc') || t.id === 'e-comp') edInput(t);
  if (t.hasAttribute('data-rc') || t.hasAttribute('data-rch')) rcInput(t);
  if (t.hasAttribute('data-bulk') && S.bulk) {
    var bk = t.getAttribute('data-bulk');
    S.bulk.edits[bk] = t.value;
    var tr = t.closest('tr'), cells = tr.children;
    var cost = Number(cells[2].textContent.replace(/,/g, '')) || 0, oldP = Number(cells[3].textContent.replace(/,/g, '')) || 0;
    var np = t.value === '' ? oldP : Number(t.value);
    var chg = t.value !== '' && round2(np) !== round2(oldP), below = cost > 0 && np < cost;
    tr.classList.toggle('chg', chg); tr.classList.toggle('below', below); cells[3].classList.toggle('was', chg);
    cells[5].className = 'r num ' + (below ? 'warn-text' : '');
    cells[5].textContent = (np > 0 ? Math.round((np - cost) / np * 1000) / 10 + '%' : '–') + (below ? ' ต่ำกว่าทุน' : '');
    bulkSum();
  }
  if (t.id === 'rscan') drawRcSuggest(/^\d{6,}$/.test(t.value.trim()) ? '' : t.value);
  var k = t.getAttribute('data-input');
  if (k === 'prodQ') { S.prodFilter.q = t.value; renderProductRows(); }
  if (k === 'bulkQ') { S.prodFilter.q = t.value; drawBulk(); }
  if (k === 'stockQ') { S.stockFilter.q = t.value; renderStockRows(); }
  if (t.hasAttribute('data-cnt')) cntSet(t.getAttribute('data-cnt'), t.value);
  if (t.hasAttribute('data-cnt-note')) { cntDraft().note = t.value; cntSave(); }
  if (t.id === 'wo-q') woSuggest(t.value);
  if (t.hasAttribute('data-xq') && S.expSel) { S.expSel.found = t.value; }
  if (t.hasAttribute('data-wo-qty') && S.wo) { S.wo.qty = t.value; var p0 = S.idx.bySku[S.wo.sku]; var e0 = $('#wo-est'); if (e0) e0.textContent = '฿' + money(p0 ? (Number(t.value) || 0) * p0.cost : 0); }
});

document.addEventListener('change', function (e) {
  var t = e.target, k = t.getAttribute('data-change');
  if (k === 'billsDay' && t.value) billsGo('day', t.value);
  if (t.hasAttribute && t.hasAttribute('data-rm') && t.value) {
    var rm = repState(); rm[t.getAttribute('data-rm')] = t.value; rm.mPreset = ''; repMonths(); render(); loadReport();
  }
  if (t.hasAttribute && t.hasAttribute('data-rf')) {
    var rs = repState(), fk = t.getAttribute('data-rf');
    rs.f[fk] = t.value;
    if (fk === 'from' || fk === 'to') { rs.preset = ''; rs.f.gran = 'day'; if (!rs.f.to || rs.f.to < rs.f.from) rs.f.to = rs.f.from; render(); }
    if (fk === 'category') rs.f.sku = '';
    loadReport();
  }
  if (k === 'prodImg' && t.files && t.files[0]) {
    var pf = t.files[0], psku = S.ed && S.ed.p.sku; t.value = '';
    if (!psku) return toast('บันทึกสินค้าก่อน แล้วค่อยใส่รูป', true);
    shrinkImage(pf, 480).then(function (u) { return api('uploadProductImage', S.token, psku, u); })
      .then(function (r) { toast('ใส่รูปแล้ว'); prodImgSet(psku, r.image); }).catch(fail);
  }
  if (k === 'labA4') { labState().a4[labState().kind] = t.value; labSave(); drawLabPreview(); }
  if (k === 'labRoll') { labState().roll[labState().kind] = [Number($('#lab-rw').value) || 0, Number($('#lab-rh').value) || 0]; labSave(); drawLabPreview(); }
  if (k === 'labRcw') { labState().receiptW = Number(t.value); labSave(); drawLabPreview(); }
  if (k === 'labOpt') { labState().opts[t.getAttribute('data-o')] = t.checked; labSave(); drawLabPreview(); }
  if (k === 'labCat' && t.value) {
    S.products.filter(function (p) { return p.active && p.forSale !== false && p.category === t.value; }).forEach(function (p) { labAdd(p.sku); });
    t.value = ''; render(); drawLabItems();
  }
  if (t.hasAttribute && t.hasAttribute('data-labunit')) {
    var li = labState().items[Number(t.getAttribute('data-labunit'))]; li.barcode = t.value; li.key = li.sku + '|' + t.value; drawLabItems();
  }
  if (k === 'slideFile' && t.files && t.files[0]) {
    var file = t.files[0]; t.value = '';
    shrinkImage(file).then(function (u) { slideModal(null, u); }).catch(fail);
  }
  if (k === 'prodCat') { S.prodFilter.cat = t.value; renderProductRows(); }
  if (k === 'bulkCat') { S.prodFilter.cat = t.value; drawBulk(); }
  if (k === 'stockLow') { S.stockFilter.low = t.checked; renderStockRows(); }
  if (k === 'drawerPin') { CashDrawer.save({ pin: Number(t.value) }); }
  if (k === 'drawerBaud') { CashDrawer.save({ baud: Number(t.value) }); }
  if (k === 'localTheme') { store('em_theme', t.value || null); applyTheme(); }
});

document.addEventListener('keydown', function (e) {
  S.lastActivity = Date.now();
  if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-den')) { e.preventDefault(); denomNext(e.target); return; }
  if (e.target.id === 'lab-q' && e.key === 'Enter' && !modalStack.length) { e.preventDefault(); labEnter(e.target.value); return; }
  if (e.key === 'Escape' && modalStack.length) { e.preventDefault(); closeModal(); return; }
  if (S.view === 'login' && !modalStack.length) {
    if (/^\d$/.test(e.key)) { e.preventDefault(); pinKey(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); pinKey('del'); }
    else if (e.key === 'Enter') { e.preventDefault(); pinKey('ok'); }
    return;
  }
  if (S.view === 'stock' && !modalStack.length && e.key === 'Enter') {
    if (e.target.id === 'cscan') { e.preventDefault(); cntScan(e.target.value); e.target.value = ''; return; }
    if (e.target.id === 'wo-q') { e.preventDefault(); var fb = $('#wo-sug button'); if (fb) fb.click(); else toast('ไม่พบสินค้า', true); return; }
  }
  if (S.view === 'receive' && !modalStack.length && e.target.id === 'rscan' && e.key === 'Enter') {
    e.preventDefault();
    var v = e.target.value;
    if (rcScan(v)) { e.target.value = ''; drawRcSuggest(''); }
    else { var first = rcMatches(v)[0]; if (first) { rcAdd(first.sku, ''); e.target.value = ''; drawRcSuggest(''); } else toast('ไม่พบสินค้า "' + v + '"', true); }
    return;
  }
  if (S.view === 'products' && !modalStack.length && e.key === 'Enter') {
    if (e.target.id === 'e-comp') {
      e.preventDefault();
      var mm = compMatches(e.target.value);
      if (mm.length) { e.target.value = ''; edAddComp(mm[0].sku); } else toast('ไม่พบสินค้า "' + e.target.value + '"', true);
      return;
    }
    if (e.target.id === 'e-scan') { e.preventDefault(); var code = e.target.value; e.target.value = ''; edAddCode(code); return; }
    if (e.target.id === 'pq') {
      // Scanning a product in the search box opens it straight away.
      var q = e.target.value.trim(), hit = S.barcodes.filter(function (b) { return b.barcode === q; })[0];
      var sku = hit ? hit.sku : (S.products.filter(function (p) { return p.plu === q || p.sku === q; })[0] || {}).sku;
      if (sku) { e.preventDefault(); e.target.value = ''; S.prodFilter.q = ''; selectProduct(sku); }
      else if (/^\d{8,14}$/.test(q) && S.user.role === 'owner') {
        // Unknown barcode: start a new product with it.
        e.preventDefault();
        if (S.ed && S.ed.dirty) return toast('บันทึกหรือยกเลิกสินค้าที่แก้อยู่ก่อน', true);
        e.target.value = ''; S.prodFilter.q = '';
        selectProduct('');
        edAddCode(q);
        $('#e-name').focus();
      }
      return;
    }
  }
  if (S.view !== 'sale' || modalStack.length) return;
  if (e.key === 'F12') { e.preventDefault(); openPay(); return; }
  if (e.target.id === 'scan') {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (S.suggest.length) { var s = S.suggest[S.suggestOn]; addItem(S.idx.bySku[s.sku], null, s.qty); clearScan(); }
      else handleScan(e.target.value);
      if (!S.suggest.length) e.target.value = '';
    } else if (e.key === 'ArrowDown' && S.suggest.length) { e.preventDefault(); S.suggestOn = Math.min(S.suggest.length - 1, S.suggestOn + 1); renderSuggest(); }
    else if (e.key === 'ArrowUp' && S.suggest.length) { e.preventDefault(); S.suggestOn = Math.max(0, S.suggestOn - 1); renderSuggest(); }
    else if (e.key === 'Escape') { clearScan(); }
    else if (e.key === 'Delete' && !e.target.value && S.cart.lines[S.cart.sel]) { e.preventDefault(); askRemoveLine(S.cart.sel); }
  }
});

['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) { document.addEventListener(ev, function () { S.lastActivity = Date.now(); }, { passive: true }); });
/* Auto-lock when idle with an empty cart (Settings › ล็อกหน้าจอ; 0 = never). */
setInterval(function () {
  if (!S.token || S.view === 'login') return;
  var mins = Number(S.settings.autoLockMinutes || 0);
  if (!mins || (S.cart && S.cart.lines.length) || modalStack.length) return;
  if (Date.now() - S.lastActivity > mins * 60000) logout();
}, 30000);

/* Expose a few pure helpers for testing. */
if (window.CustomerDisplay) CustomerDisplay.pos.onStatus = function (on) { var d = $('#cdbtn .dot'); if (d) d.classList.toggle('on', on); };
window.__em = { promptPayPayload: promptPayPayload, crc16: crc16, S: S, conn: conn };

start();
})();
