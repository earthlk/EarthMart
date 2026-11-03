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
  billsDay: null, reportDay: null, stockFilter: { q: '', cat: '', low: false }, prodFilter: { q: '', cat: '' },
  lastActivity: Date.now(), busy: 0
};

var KEY_COLORS = {
  blue:   ['#E0F2FE', '#0369A1'], navy:  ['#DBEAFE', '#1D4ED8'], brown: ['#EDE4DC', '#3F2A1D'],
  orange: ['#FFEDD5', '#C2410C'], tan:   ['#F3E8DC', '#7C4A21'], red:   ['#FEE2E2', '#B91C1C'],
  green:  ['#E3F1E8', '#1F5A3A'], gray:  ['#EEF0EE', '#4B524E'], purple:['#EDE9FE', '#6D28D9']
};

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
    throw new Error(e && e.name === 'AbortError' ? 'เซิร์ฟเวอร์ตอบช้าเกินไป ลองใหม่' : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจอินเทอร์เน็ต');
  }).then(function (res) {
    clearTimeout(timer);
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
  return new Promise(function (resolve) {
    var done = false;
    var m = openModal('<header><h1>' + esc(title || 'ต้องให้เจ้าของอนุมัติ') + '</h1></header>' +
      '<form class="body"><div class="field"><label for="apin">PIN เจ้าของร้าน</label>' +
      '<input id="apin" type="password" inputmode="numeric" autocomplete="off" maxlength="6" autofocus class="big-input" style="text-align:center"></div></form>' +
      '<footer><button class="btn" data-x="no">ยกเลิก</button><button class="btn primary" data-x="yes">อนุมัติ</button></footer>',
      { onClose: function () { if (!done) resolve(null); } });
    var go = function () {
      api('approve', S.token, $('#apin', m).value, action).then(function (r) {
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
  S.deviceId = deviceId();
  readConnectLink();
  api('status').then(function (st) {
    S.status = st;
    S.settings = st.settings || {};
    applyTheme();
    var saved = sstore('em_token');
    if (saved) {
      S.token = saved;
      return boot().catch(function () { S.token = null; sstore('em_token', null); showLogin(); });
    }
    showLogin();
  }).catch(function (e) {
    if (e.code === 'NO_CONN' || e.code === 'BAD_KEY') return showConnect(e.code === 'BAD_KEY' ? e.message : '');
    $('#app').innerHTML = '<div class="center"><div class="card pad col" style="max-width:520px;gap:10px"><h2>ยังใช้งานไม่ได้</h2><p>' + esc(e.message) +
      '</p><div class="row"><button class="btn primary" data-act="reload">ลองใหม่</button><button class="btn" data-act="connect">ตั้งค่าการเชื่อมต่อ</button></div></div></div>';
  });
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
  S.token = null; S.user = null; sstore('em_token', null);
  closeAllModals();
  showLogin(msg);
}

function renderLogin() {
  var st = S.status || { users: [], ready: false };
  if (!st.ready) {
    return '<div class="center"><div class="card pad" style="max-width:560px"><h2>ยังไม่มีบัญชีเจ้าของร้าน</h2>' +
      '<p>เปิด Apps Script แล้วรันฟังก์ชัน <b>setup</b> และ <b>createOwner("ชื่อ", "PIN")</b> ตามคู่มือ จากนั้นรีเฟรชหน้านี้</p></div></div>';
  }
  var users = st.users.map(function (u) {
    return '<button type="button" data-act="pickUser" data-id="' + esc(u.userId) + '" class="' + (S.loginUser === u.userId ? 'on' : '') + '">' +
      '<span class="avatar">' + esc(u.name.charAt(0)) + '</span><span class="col" style="gap:0"><b>' + esc(u.name) + '</b>' +
      '<span class="muted" style="font-size:13px">' + (u.role === 'owner' ? 'เจ้าของ' : 'แคชเชียร์') + '</span></span></button>';
  }).join('');
  var who = st.users.filter(function (u) { return u.userId === S.loginUser; })[0];
  var dots = '';
  for (var i = 0; i < 6; i++) dots += '<span class="' + (i < S.pin.length ? 'on' : '') + '"></span>';
  var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map(function (k) {
    if (k === 'del') return '<button type="button" data-act="pinKey" data-k="del" style="font-size:15px">ลบ</button>';
    if (k === 'ok') return '<button type="button" data-act="pinKey" data-k="ok" style="font-size:16px;background:var(--brand);color:var(--brand-ink);border-color:var(--brand)">เข้า</button>';
    return '<button type="button" data-act="pinKey" data-k="' + k + '">' + k + '</button>';
  }).join('');
  return '<header class="topbar"><span class="brand">' + esc(S.settings.shopName || 'EarthMart') + '</span><span class="grow"></span>' +
    '<span class="meta">' + (S.isCounter ? 'เครื่องหน้าร้าน' : 'เครื่องนี้ยังไม่ได้ลงทะเบียน') + '</span></header>' +
    '<div class="center"><div class="card login"><div class="users"><h2 style="margin:0 0 6px">เลือกผู้ใช้</h2>' + users + '</div>' +
    '<div class="pin"><div class="muted">' + (who ? 'ใส่ PIN ของ ' + esc(who.name) : 'เลือกผู้ใช้ก่อน') + '</div>' +
    '<div class="dots">' + dots + '</div><div class="pinpad">' + keys + '</div>' +
    '<div class="muted" style="font-size:13px">พิมพ์ตัวเลขจากคีย์บอร์ดได้ · Enter เพื่อเข้า</div></div></div></div>';
}

function pinKey(k) {
  if (!S.loginUser) return toast('เลือกผู้ใช้ก่อน', true);
  if (k === 'del') S.pin = S.pin.slice(0, -1);
  else if (k === 'ok') return doLogin();
  else if (S.pin.length < 6) S.pin += k;
  render();
}

function doLogin() {
  if (S.pin.length < 4) return toast('PIN อย่างน้อย 4 หลัก', true);
  var pin = S.pin;
  api('login', S.loginUser, pin, S.deviceId).then(function (r) {
    S.token = r.token; S.user = r.user;
    sstore('em_token', r.token);
    return boot();
  }).catch(function (e) { S.pin = ''; render(); fail(e); });
}

function boot() {
  return api('bootstrap', S.token).then(function (d) {
    S.user = d.user; S.isCounter = d.isCounter; S.settings = d.settings; S.shift = d.shift;
    setCatalog(d.products, d.barcodes);
    applyTheme();
    newCart();
    S.lastActivity = Date.now();
    go(S.isCounter && !S.shift ? 'shift' : 'sale');
  });
}

function logout() {
  if (S.cart && S.cart.lines.length) return toast('มีบิลค้างอยู่ — ชำระหรือล้างบิลก่อนออก', true);
  var t = S.token;
  forceLogin();
  if (t) api('logout', t).catch(function () {});
}

/* =================================================================== */
/* Catalog index                                                       */
/* =================================================================== */

function setCatalog(products, barcodes) {
  S.products = products;
  S.barcodes = barcodes;
  var bySku = {}, byBarcode = {}, byPlu = {};
  products.forEach(function (p) { bySku[p.sku] = p; if (p.plu) byPlu[p.plu] = p; });
  barcodes.forEach(function (b) { if (bySku[b.sku]) byBarcode[b.barcode] = b; });
  S.idx = { bySku: bySku, byBarcode: byBarcode, byPlu: byPlu };
}

function reloadCatalog() {
  return api('bootstrap', S.token).then(function (d) { setCatalog(d.products, d.barcodes); S.shift = d.shift; });
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
  ['sale', 'ขาย'], ['bills', 'บิล'], ['products', 'สินค้า'], ['stock', 'สต็อก'],
  ['shift', 'กะ'], ['reports', 'รายงาน', 'owner'], ['settings', 'ตั้งค่า', 'owner']
];

function go(view) {
  if (view === 'sale' && S.isCounter && !S.shift) view = 'shift';
  S.view = view;
  render();
  if (view === 'bills') loadBills();
  if (view === 'products') renderProductRows();
  if (view === 'stock') loadStock();
  if (view === 'shift' && S.shift) loadShift();
  if (view === 'reports') loadReport();
  if (view === 'settings') loadSettings();
}

function frame(inner) {
  var nav = NAV.filter(function (n) { return !n[2] || (S.user && S.user.role === n[2]); }).map(function (n) {
    return '<button data-act="go" data-v="' + n[0] + '" class="' + (S.view === n[0] ? 'on' : '') + '">' + n[1] + '</button>';
  }).join('');
  var shiftTxt = S.shift ? 'กะเปิด ' + timeOf(S.shift.openedAt) : (S.isCounter ? 'ยังไม่เปิดกะ' : 'ไม่ใช่เครื่องหน้าร้าน');
  var banner = !S.isCounter ? '<div class="banner">เครื่องนี้ยังไม่ได้ลงทะเบียนเป็นเครื่องหน้าร้าน — ขายและเปิดกะไม่ได้' +
    (S.user && S.user.role === 'owner' ? ' · <a href="#" data-act="go" data-v="settings">ลงทะเบียนในหน้าตั้งค่า</a>' : ' · ให้เจ้าของลงทะเบียนในหน้าตั้งค่า') + '</div>' : '';
  return '<header class="topbar"><span class="brand">' + esc(S.settings.shopName || 'EarthMart') + '</span><nav>' + nav + '</nav>' +
    '<span class="grow"></span><span class="meta">' + esc(S.user ? S.user.name : '') + ' · ' + shiftTxt + '</span>' +
    '<button class="btn" data-act="logout">ออก</button></header>' + banner + inner;
}

function render() {
  var html;
  switch (S.view) {
    case 'login': html = renderLogin(); break;
    case 'sale': html = frame(renderSale()); break;
    case 'bills': html = frame(renderBills()); break;
    case 'products': html = frame(renderProducts()); break;
    case 'stock': html = frame(renderStock()); break;
    case 'shift': html = frame(renderShift()); break;
    case 'reports': html = frame(renderReports()); break;
    case 'settings': html = frame(renderSettings()); break;
    default: html = '';
  }
  $('#app').innerHTML = html;
  if (S.view === 'sale') focusScan();
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
  var doAdd = function (unitPrice) {
    var key = p.sku + '|' + (b ? b.barcode : '') + '|' + unitPrice;
    var found = -1;
    S.cart.lines.forEach(function (l, i) { if (l.key === key) found = i; });
    if (found >= 0) { S.cart.lines[found].qty += qty; S.cart.sel = found; }
    else {
      S.cart.lines.push({ key: key, sku: p.sku, barcode: b ? b.barcode : '', name: p.name,
        unitName: b ? b.unitName : (p.unit || 'ชิ้น'), multiplier: b ? b.multiplier : 1, qty: qty,
        unitPrice: unitPrice, lineDiscount: 0, openPrice: p.openPrice });
      S.cart.sel = S.cart.lines.length - 1;
    }
    S.suggest = [];
    renderCartOnly();
  };
  if (p.openPrice) {
    prompt2('ราคาเปิด: ' + p.name, 'ราคาต่อหน่วย (บาท)', '', { type: 'number', inputmode: 'decimal', step: '0.25', ok: 'ใส่ในบิล' })
      .then(function (v) { var n = round2(Number(v)); if (v !== null && n > 0) doAdd(n); else if (v !== null) toast('ราคาไม่ถูกต้อง', true); });
  } else doAdd(unitPriceOf(p, b));
}

function cartTotals() {
  var sub = 0, ld = 0, items = 0;
  S.cart.lines.forEach(function (l) { sub += l.qty * l.unitPrice; ld += l.lineDiscount; items += l.qty; });
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
  S.products.forEach(function (p) { if (p.quickKey) groups[p.quickKeyGroup || 'ทั่วไป'] = true; });
  var gnames = Object.keys(groups).sort();
  if (gnames.length && gnames.indexOf(S.keyGroup) < 0) S.keyGroup = gnames[0];
  var chips = gnames.map(function (g) {
    return '<button class="chip ' + (g === S.keyGroup ? 'on' : '') + '" data-act="keyGroup" data-g="' + esc(g) + '">' + esc(g) + '</button>';
  }).join('');
  var keys = S.products.filter(function (p) { return p.quickKey && (p.quickKeyGroup || 'ทั่วไป') === S.keyGroup; })
    .sort(function (a, b) { return (a.quickKeyOrder || 999) - (b.quickKeyOrder || 999) || a.name.localeCompare(b.name, 'th'); })
    .map(function (p) {
      var c = KEY_COLORS[p.color] || KEY_COLORS.gray;
      return '<button class="key" data-act="quickKey" data-sku="' + esc(p.sku) + '"><span class="ic" style="background:' + c[0] + ';color:' + c[1] + '">' +
        esc((p.icon || p.name).slice(0, 2)) + '</span><span class="nm">' + esc(p.name) + '</span><span class="pr">' +
        (p.openPrice ? 'ราคาเปิด' : '฿' + money(p.price)) + '</span></button>';
    }).join('');
  if (!gnames.length) keys = '<div class="muted">ยังไม่มีปุ่มขายด่วน — ตั้งได้ในหน้าสินค้า (ติ๊ก "ปุ่มขายด่วน")</div>';

  return '<div class="page"><div class="sale">' +
    '<section class="card cart"><div class="scan"><label class="sr" for="scan">สแกนหรือค้นหา</label>' +
    '<input id="scan" autocomplete="off" placeholder="สแกนบาร์โค้ด / PLU / พิมพ์ชื่อ  ·  6*บาร์โค้ด = 6 ชิ้น" ' + (S.isCounter && S.shift ? '' : 'disabled') + '>' +
    '<div id="suggest"></div></div>' +
    '<div class="lines" id="lines"></div>' +
    '<div class="cart-actions"><button class="btn" data-act="lineDiscount">ส่วนลดรายการ</button><button class="btn" data-act="billDiscount">ส่วนลดท้ายบิล</button>' +
    '<button class="btn" data-act="noSale">เปิดลิ้นชัก</button><button class="btn warn" data-act="clearCart">ล้างบิล</button></div></section>' +
    '<section class="sell"><div class="row" style="flex-wrap:wrap">' + chips + '</div><div class="keys">' + keys + '</div>' +
    '<div class="card total" id="totalbar"></div></section></div></div>';
}

function renderCartOnly() {
  var box = $('#lines');
  if (!box) return;
  if (!S.cart.lines.length) box.innerHTML = '<div class="empty">สแกนสินค้าหรือแตะปุ่มด้านขวาเพื่อเริ่มบิล</div>';
  else box.innerHTML = S.cart.lines.map(function (l, i) {
    return '<div class="line ' + (i === S.cart.sel ? 'sel' : '') + '" data-act="selLine" data-i="' + i + '">' +
      '<div><div class="name">' + esc(l.name) + '</div><div class="sub">' + esc(l.unitName) + (l.multiplier > 1 ? ' (' + l.multiplier + ' ชิ้น)' : '') +
      ' · ฿' + money(l.unitPrice) + (l.lineDiscount ? ' · ลด ' + money(l.lineDiscount) : '') + '</div></div>' +
      '<div class="qty"><button data-act="qty" data-i="' + i + '" data-d="-1" aria-label="ลด">−</button><span class="num">' + l.qty +
      '</span><button data-act="qty" data-i="' + i + '" data-d="1" aria-label="เพิ่ม">+</button></div>' +
      '<div class="r num"><b>' + money(l.qty * l.unitPrice - l.lineDiscount) + '</b></div></div>';
  }).join('');
  var t = cartTotals();
  var bar = $('#totalbar');
  if (bar) bar.innerHTML = '<div class="grow"><div class="muted">' + t.items + ' ชิ้น' + (t.discount ? ' · ส่วนลด ฿' + money(t.discount) : '') +
    '</div><div class="row" style="align-items:baseline"><b style="font-size:18px">ยอดรวม</b><span class="amt num">฿' + money(t.total) + '</span></div></div>' +
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
  l.qty += d;
  if (l.qty <= 0) S.cart.lines.splice(i, 1);
  if (l.lineDiscount > l.qty * l.unitPrice) l.lineDiscount = 0;
  S.cart.sel = Math.min(i, S.cart.lines.length - 1);
  renderCartOnly();
}

function askDiscount(kind) {
  if (!S.cart.lines.length) return toast('ยังไม่มีสินค้าในบิล', true);
  var line = kind === 'line' ? S.cart.lines[S.cart.sel] : null;
  if (kind === 'line' && !line) return toast('แตะเลือกรายการก่อน', true);
  var base = kind === 'line' ? line.qty * line.unitPrice : cartTotals().subtotal;
  prompt2(kind === 'line' ? 'ส่วนลด: ' + line.name : 'ส่วนลดท้ายบิล', 'ใส่เป็นบาท หรือใส่ % เช่น 10%', '', { hint: 'ยอดก่อนลด ฿' + money(base) })
    .then(function (v) {
      if (v === null || String(v).trim() === '') return;
      var amt = /%$/.test(v.trim()) ? round2(base * Number(v.trim().slice(0, -1)) / 100) : round2(Number(v));
      if (!(amt >= 0) || amt > base) return toast('ส่วนลดไม่ถูกต้อง', true);
      return approval('DISCOUNT', 'อนุมัติส่วนลด ฿' + money(amt)).then(function (id) {
        if (id === null) return;
        if (id) S.cart.approvalId = id;
        if (line) line.lineDiscount = amt; else S.cart.billDiscount = amt;
        renderCartOnly();
      });
    });
}

/* ---------------------------- Payment ----------------------------- */

function openPay() {
  if (!S.cart.lines.length) return;
  if (!S.shift) return toast('ยังไม่ได้เปิดกะ', true);
  var t = cartTotals();
  var method = 'cash';
  var hasPP = !!S.settings.promptPayId;
  var quick = [t.total];
  [20, 50, 100, 500, 1000].forEach(function (n) { var v = Math.ceil(t.total / n) * n; if (v > t.total && quick.indexOf(v) < 0) quick.push(v); });
  quick = quick.slice(0, 5);
  var m = openModal('<header><h1>ชำระเงิน</h1><span class="muted">' + t.items + ' ชิ้น</span><span class="grow"></span>' +
    '<span style="font-size:28px;font-weight:700" class="brand-text num">฿' + money(t.total) + '</span></header>' +
    '<div class="body"><div class="seg" id="pm">' +
    '<button data-m="cash" class="on">เงินสด</button><button data-m="qr">QR พร้อมเพย์</button><button data-m="transfer">โอน</button></div>' +
    '<div id="pm-cash" class="col" style="gap:10px"><label for="recv">รับเงินมา</label><input id="recv" class="big-input num" type="number" inputmode="decimal" step="0.25" autofocus>' +
    '<div class="row" style="flex-wrap:wrap">' + quick.map(function (q) { return '<button class="btn" data-q="' + q + '">' + (q === t.total ? 'พอดี' : '฿' + money(q)) + '</button>'; }).join('') + '</div>' +
    '<div class="row" style="justify-content:space-between;align-items:baseline"><span class="muted">เงินทอน</span><span id="chg" class="num brand-text" style="font-size:40px;font-weight:700">฿0.00</span></div></div>' +
    '<div id="pm-qr" class="col hidden" style="align-items:center;gap:8px">' +
    (hasPP ? '<div class="qr" id="qrbox"></div><div class="muted">พร้อมเพย์ ' + esc(maskPP(S.settings.promptPayId)) + ' · ยอดอยู่ใน QR แล้ว</div><div class="muted" style="font-size:13px">ตรวจยอดเข้าในแอปธนาคาร แล้วกด "ได้รับเงินแล้ว"</div>'
      : '<div class="banner" style="border-radius:8px">ยังไม่ได้ตั้งเบอร์พร้อมเพย์ (ตั้งค่า › ร้าน)</div>') + '</div>' +
    '<div id="pm-transfer" class="col hidden"><div class="muted">ตรวจยอดโอนในแอปธนาคารก่อน แล้วกด "ได้รับเงินแล้ว"</div></div>' +
    '<label class="row" style="color:var(--ink);font-size:15px"><input type="checkbox" id="autoprint" ' + (store('em_autoprint') === '0' ? '' : 'checked') + '> พิมพ์ใบเสร็จ</label>' +
    '</div><footer><button class="btn" data-x="cancel">ยกเลิก (Esc)</button><button class="btn primary lg" data-x="ok" style="height:52px;font-size:17px">ยืนยัน (Enter)</button></footer>');

  var recv = $('#recv', m);
  var update = function () {
    var r = Number(recv.value || 0);
    var c = round2(r - t.total);
    $('#chg', m).textContent = '฿' + money(Math.max(0, c));
    $('#chg', m).className = 'num ' + (c < 0 ? 'warn-text' : 'brand-text');
    $('[data-x=ok]', m).textContent = method === 'cash' ? 'ยืนยัน (Enter)' : 'ได้รับเงินแล้ว (Enter)';
  };
  recv.oninput = update;
  $all('[data-q]', m).forEach(function (b) { b.onclick = function () { recv.value = b.getAttribute('data-q'); update(); recv.focus(); }; });
  $all('#pm button', m).forEach(function (b) {
    b.onclick = function () {
      method = b.getAttribute('data-m');
      $all('#pm button', m).forEach(function (x) { x.classList.toggle('on', x === b); });
      ['cash', 'qr', 'transfer'].forEach(function (k) { $('#pm-' + k, m).classList.toggle('hidden', k !== method); });
      if (method === 'qr' && hasPP) drawQr($('#qrbox', m), promptPayPayload(S.settings.promptPayId, t.total));
      if (method === 'cash') recv.focus();
      update();
    };
  });
  var submitting = false;
  var submit = function () {
    if (submitting) return;
    var received = method === 'cash' ? round2(Number(recv.value || 0)) : t.total;
    if (method === 'cash' && received < t.total) { toast('รับเงินไม่พอ', true); recv.focus(); return; }
    if (method === 'qr' && !hasPP) { toast('ตั้งเบอร์พร้อมเพย์ก่อน', true); return; }
    submitting = true;
    store('em_autoprint', $('#autoprint', m).checked ? '1' : '0');
    var sale = {
      saleUid: S.cart.saleUid, payMethod: method, received: received, billDiscount: S.cart.billDiscount,
      approvalId: S.cart.approvalId,
      lines: S.cart.lines.map(function (l) {
        return { sku: l.sku, barcode: l.barcode, qty: l.qty, unitPrice: l.openPrice ? l.unitPrice : undefined, lineDiscount: l.lineDiscount };
      })
    };
    api('commitSale', S.token, sale).then(function (rc) {
      closeModal();
      var print = $('#autoprint', m).checked;
      newCart();
      renderCartOnly();
      if (rc.payMethod === 'cash') openDrawer(true);
      showReceipt(rc, print);
    }).catch(function (e) { submitting = false; fail(e); });
  };
  $('[data-x=ok]', m).onclick = submit;
  $('[data-x=cancel]', m).onclick = function () { closeModal(); };
  m.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  update();
}

function maskPP(id) { id = String(id || ''); return id.length > 4 ? id.slice(0, 3) + 'x'.repeat(id.length - 6) + id.slice(-3) : id; }

function showReceipt(rc, autoPrint) {
  var m = openModal('<header><h1>บันทึกแล้ว · ' + esc(rc.billNo) + '</h1></header><div class="body">' +
    (rc.payMethod === 'cash' ? '<div class="row" style="justify-content:space-between;align-items:baseline"><span>เงินทอน</span><span class="num brand-text" style="font-size:44px;font-weight:700">฿' + money(rc.change) + '</span></div>' +
      '<div class="muted">รับมา ฿' + money(rc.received) + ' · ยอด ฿' + money(rc.total) + '</div>' : '<div>ชำระด้วย ' + payName(rc.payMethod) + ' ฿' + money(rc.total) + '</div>') +
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

function noSale() {
  if (!S.isCounter) return toast('เปิดลิ้นชักได้เฉพาะเครื่องหน้าร้าน', true);
  var mode = CashDrawer.load().mode;
  if (mode === 'none') return toast('ยังไม่ได้ตั้งค่าลิ้นชักบนเครื่องนี้ (ตั้งค่า › ลิ้นชักเก็บเงิน)', true);
  openDrawer().then(function (ok) { if (ok) api('logDrawer', S.token, 'เปิดลิ้นชักโดยไม่ขาย').catch(function () {}); });
}

function payName(m) { return { cash: 'เงินสด', qr: 'QR พร้อมเพย์', transfer: 'โอน' }[m] || m; }

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
    (rc.discount ? '<tr><td>รวม</td><td style="text-align:right">' + money(rc.subtotal) + '</td></tr><tr><td>ส่วนลด</td><td style="text-align:right">-' + money(rc.discount) + '</td></tr>' : '') +
    '<tr><td class="big">ยอดสุทธิ</td><td class="big" style="text-align:right">' + money(rc.total) + '</td></tr>' +
    '<tr><td>' + payName(rc.payMethod) + '</td><td style="text-align:right">' + money(rc.received) + '</td></tr>' +
    (rc.payMethod === 'cash' ? '<tr><td>เงินทอน</td><td style="text-align:right">' + money(rc.change) + '</td></tr>' : '') +
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

function renderBills() {
  return '<div class="page" style="flex-direction:column"><div class="row"><label for="bday">วันที่</label>' +
    '<input id="bday" type="date" value="' + (S.billsDay || today()) + '" data-change="billsDay" style="width:180px"><span class="grow"></span>' +
    '<span class="muted" id="bsum"></span></div><div class="card" style="flex:1;overflow:auto"><table class="table"><thead><tr><th>เลขบิล</th><th>เวลา</th>' +
    '<th class="r">ชิ้น</th><th class="r">ยอด</th><th>ชำระ</th><th>แคชเชียร์</th><th>สถานะ</th></tr></thead><tbody id="bills"><tr><td colspan="7" class="muted">กำลังโหลด…</td></tr></tbody></table></div></div>';
}

function loadBills() {
  var day = S.billsDay || today();
  api('listBills', S.token, day).then(function (rows) {
    var tb = $('#bills');
    if (!tb) return;
    var paid = rows.filter(function (r) { return r.status !== 'VOID'; });
    $('#bsum').textContent = paid.length + ' บิล · ฿' + money(paid.reduce(function (a, r) { return a + r.total; }, 0));
    tb.innerHTML = rows.length ? rows.map(function (r) {
      return '<tr class="click" data-act="billDetail" data-no="' + esc(r.billNo) + '"><td class="num">' + esc(r.billNo) + '</td><td>' + timeOf(r.createdAt) +
        '</td><td class="r num">' + r.itemsCount + '</td><td class="r num">' + money(r.total) + '</td><td>' + payName(r.payMethod) +
        '</td><td>' + esc(r.cashier) + '</td><td>' + (r.status === 'VOID' ? '<span class="tag warn">ยกเลิก</span>' : '<span class="tag green">ปกติ</span>') + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="muted">ไม่มีบิล</td></tr>';
  }).catch(fail);
}

function billDetail(no) {
  api('billDetail', S.token, no).then(function (rc) {
    var m = openModal('<header><h1>บิล ' + esc(rc.billNo) + '</h1><span class="muted">' + dateTime(rc.createdAt) + '</span><span class="grow"></span>' +
      (rc.status === 'VOID' ? '<span class="tag warn">ยกเลิก</span>' : '') + '</header><div class="body"><table class="table"><tbody>' +
      rc.lines.map(function (l) {
        return '<tr><td>' + esc(l.name) + ' <span class="muted">' + esc(l.unitName) + '</span></td><td class="r num">' + l.qty + ' × ' + money(l.unitPrice) +
          '</td><td class="r num">' + money(l.lineTotal) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="row" style="justify-content:space-between"><span>ยอดสุทธิ (' + payName(rc.payMethod) + ')' + (rc.discount ? ' · ลด ' + money(rc.discount) : '') +
      '</span><b class="num" style="font-size:20px">฿' + money(rc.total) + '</b></div>' +
      (rc.voidReason ? '<div class="warn-text">เหตุผลยกเลิก: ' + esc(rc.voidReason) + '</div>' : '') +
      '</div><footer><button class="btn" data-x="print">พิมพ์ซ้ำ</button>' +
      (rc.status !== 'VOID' && S.isCounter ? '<button class="btn warn" data-x="void">ยกเลิกบิล</button>' : '') +
      '<button class="btn primary" data-x="close">ปิด</button></footer>', { wide: false });
    $('[data-x=print]', m).onclick = function () { printReceipt(rc); };
    $('[data-x=close]', m).onclick = function () { closeModal(); };
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

/* =================================================================== */
/* Products                                                            */
/* =================================================================== */

function renderProducts() {
  var owner = S.user.role === 'owner';
  var cats = categories().map(function (c) { return '<option ' + (S.prodFilter.cat === c ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('');
  return '<div class="page" style="flex-direction:column"><div class="row" style="flex-wrap:wrap">' +
    '<label class="sr" for="pq">ค้นหาสินค้า</label><input id="pq" placeholder="ค้นหา ชื่อ / SKU / บาร์โค้ด" value="' + esc(S.prodFilter.q) + '" data-input="prodQ" style="width:300px">' +
    '<label class="sr" for="pcat">หมวด</label><select id="pcat" data-change="prodCat"><option value="">ทุกหมวด</option>' + cats + '</select><span class="grow"></span>' +
    (owner ? '<button class="btn" data-act="csvTemplate">ไฟล์ตัวอย่าง CSV</button><button class="btn" data-act="importCsv">นำเข้า CSV</button>' +
      '<button class="btn primary" data-act="editProduct" data-sku="">+ เพิ่มสินค้า</button>' : '') +
    '</div><div class="card" style="flex:1;overflow:auto"><table class="table"><thead><tr><th>SKU</th><th>สินค้า</th><th>หมวด</th><th>บาร์โค้ด / หน่วย</th>' +
    '<th class="r">ทุน</th><th class="r">ขาย</th><th class="r">คงเหลือ</th></tr></thead><tbody id="prows"></tbody></table></div></div>';
}

function renderProductRows() {
  var tb = $('#prows');
  if (!tb) return;
  var q = S.prodFilter.q.toLowerCase();
  var codesBySku = {};
  S.barcodes.forEach(function (b) { (codesBySku[b.sku] = codesBySku[b.sku] || []).push(b); });
  var rows = S.products.filter(function (p) {
    if (S.prodFilter.cat && p.category !== S.prodFilter.cat) return false;
    if (!q) return true;
    var codes = codesBySku[p.sku] || [];
    return p.name.toLowerCase().indexOf(q) >= 0 || p.sku.toLowerCase().indexOf(q) >= 0 || codes.some(function (b) { return b.barcode.indexOf(q) >= 0; });
  });
  tb.innerHTML = rows.length ? rows.map(function (p) {
    var codes = codesBySku[p.sku] || [];
    var codeTxt = codes.length ? '<span class="num">' + esc(codes[0].barcode) + '</span>' + (codes.length > 1 ? ' <span class="muted">+' + (codes.length - 1) + ' หน่วย</span>' : '')
      : (p.plu ? 'PLU ' + esc(p.plu) : '<span class="muted">—</span>');
    var low = p.minStock > 0 && p.onHand <= p.minStock;
    return '<tr class="click" data-act="editProduct" data-sku="' + esc(p.sku) + '"><td class="num">' + esc(p.sku) + '</td><td>' + esc(p.name) +
      (p.quickKey ? ' <span class="tag green">ปุ่มด่วน</span>' : '') + (p.openPrice ? ' <span class="tag amber">ราคาเปิด</span>' : '') +
      '</td><td>' + esc(p.category) + '</td><td>' + codeTxt + '</td><td class="r num">' + money(p.cost) + '</td><td class="r num">' + money(p.price) +
      '</td><td class="r num ' + (low ? 'warn-text' : '') + '">' + p.onHand + '</td></tr>';
  }).join('') : '<tr><td colspan="7" class="muted">ไม่พบสินค้า</td></tr>';
}

function editProduct(sku) {
  if (S.user.role !== 'owner') return toast('แก้สินค้าได้เฉพาะเจ้าของ', true);
  var p = sku ? S.idx.bySku[sku] : { sku: '', name: '', category: '', type: 'barcode', unit: 'ชิ้น', cost: 0, price: 0, minStock: 0,
    openPrice: false, quickKey: false, quickKeyGroup: '', quickKeyOrder: 0, icon: '', color: 'gray', plu: '', active: true };
  var codes = S.barcodes.filter(function (b) { return b.sku === sku; }).map(function (b) { return Object.assign({}, b); });
  if (!sku) codes.push({ barcode: '', unitName: 'ชิ้น', multiplier: 1, price: null });
  var catList = categories().map(function (c) { return '<option value="' + esc(c) + '">'; }).join('');
  var colorOpts = Object.keys(KEY_COLORS).map(function (c) { return '<option ' + (p.color === c ? 'selected' : '') + '>' + c + '</option>'; }).join('');

  var m = openModal('<header><h1>' + (sku ? esc(p.name) : 'เพิ่มสินค้า') + '</h1><span class="muted">' + esc(sku || 'SKU สร้างอัตโนมัติ') + '</span></header>' +
    '<form class="body" id="pf" autocomplete="off"><div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px">' +
    '<div class="field"><label for="f-name">ชื่อสินค้า *</label><input id="f-name" value="' + esc(p.name) + '" autofocus></div>' +
    '<div class="field"><label for="f-cat">หมวด</label><input id="f-cat" list="catlist" value="' + esc(p.category) + '"><datalist id="catlist">' + catList + '</datalist></div>' +
    '<div class="field"><label for="f-type">ประเภท</label><select id="f-type"><option value="barcode"' + (p.type === 'barcode' ? ' selected' : '') + '>มีบาร์โค้ด</option>' +
    '<option value="nobarcode"' + (p.type === 'nobarcode' ? ' selected' : '') + '>ไม่มีบาร์โค้ด</option></select></div></div>' +
    '<div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px">' +
    '<div class="field"><label for="f-unit">หน่วยนับ</label><input id="f-unit" value="' + esc(p.unit) + '"></div>' +
    '<div class="field"><label for="f-cost">ทุน/ชิ้น</label><input id="f-cost" type="number" step="0.01" value="' + p.cost + '"></div>' +
    '<div class="field"><label for="f-price">ราคาขาย/ชิ้น *</label><input id="f-price" type="number" step="0.25" value="' + p.price + '"></div>' +
    '<div class="field"><label for="f-min">ขั้นต่ำ (ชิ้น)</label><input id="f-min" type="number" value="' + p.minStock + '"></div>' +
    '<div class="field"><label for="f-plu">PLU</label><input id="f-plu" inputmode="numeric" value="' + esc(p.plu) + '"></div></div>' +
    '<div class="row" style="gap:18px;flex-wrap:wrap"><label class="row" style="color:var(--ink)"><input type="checkbox" id="f-open" ' + (p.openPrice ? 'checked' : '') + '> ราคาเปิด (ใส่ราคาตอนขาย)</label>' +
    '<label class="row" style="color:var(--ink)"><input type="checkbox" id="f-qk" ' + (p.quickKey ? 'checked' : '') + '> ปุ่มขายด่วน</label>' +
    (sku ? '<label class="row" style="color:var(--ink)"><input type="checkbox" id="f-active" ' + (p.active !== false ? 'checked' : '') + '> ใช้งาน</label>' : '') + '</div>' +
    '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:10px" id="qkbox">' +
    '<div class="field"><label for="f-qkg">หมวดปุ่มด่วน</label><input id="f-qkg" value="' + esc(p.quickKeyGroup) + '" placeholder="เช่น เครื่องดื่มชง"></div>' +
    '<div class="field"><label for="f-qko">ลำดับ</label><input id="f-qko" type="number" value="' + (p.quickKeyOrder || '') + '"></div>' +
    '<div class="field"><label for="f-icon">ตัวย่อบนปุ่ม</label><input id="f-icon" maxlength="2" value="' + esc(p.icon) + '" placeholder="2 ตัวอักษร"></div>' +
    '<div class="field"><label for="f-color">สีปุ่ม</label><select id="f-color">' + colorOpts + '</select></div></div>' +
    '<div class="row" style="justify-content:space-between"><b>บาร์โค้ดแต่ละหน่วย</b><span class="row"><button type="button" class="btn sm" data-x="internal">สร้างบาร์โค้ดภายใน</button>' +
    '<button type="button" class="btn sm" data-x="addcode">+ เพิ่มหน่วย</button></span></div>' +
    '<table class="table"><thead><tr><th>หน่วย</th><th>บาร์โค้ด (EAN)</th><th class="r">= ชิ้น</th><th class="r">ราคาขายหน่วยนี้</th><th></th></tr></thead><tbody id="codes"></tbody></table>' +
    '<div class="muted" style="font-size:13px">สต็อกนับเป็นชิ้นเสมอ · ราคาขายหน่วยว่างไว้ = ราคาต่อชิ้น × จำนวนชิ้น</div>' +
    '</form><footer><button class="btn" data-x="cancel">ยกเลิก</button><button class="btn primary" data-x="save">บันทึก</button></footer>', { wide: true });

  var drawCodes = function () {
    $('#codes', m).innerHTML = codes.map(function (c, i) {
      return '<tr><td><input data-c="unitName" data-i="' + i + '" value="' + esc(c.unitName) + '" style="width:90px" aria-label="หน่วย"></td>' +
        '<td><input data-c="barcode" data-i="' + i + '" inputmode="numeric" value="' + esc(c.barcode) + '" style="width:180px" aria-label="บาร์โค้ด"></td>' +
        '<td class="r"><input data-c="multiplier" data-i="' + i + '" type="number" min="1" value="' + c.multiplier + '" style="width:80px;text-align:right" aria-label="จำนวนชิ้น"></td>' +
        '<td class="r"><input data-c="price" data-i="' + i + '" type="number" step="0.25" value="' + (c.price === null || c.price === undefined ? '' : c.price) + '" placeholder="อัตโนมัติ" style="width:110px;text-align:right" aria-label="ราคาหน่วย"></td>' +
        '<td class="r"><button type="button" class="btn sm ghost" data-x="del" data-i="' + i + '" aria-label="ลบหน่วย">ลบ</button></td></tr>';
    }).join('') || '<tr><td colspan="5" class="muted">ยังไม่มีบาร์โค้ด (ขายผ่าน PLU / ปุ่มด่วนได้)</td></tr>';
  };
  drawCodes();
  m.addEventListener('input', function (e) {
    var c = e.target.getAttribute('data-c');
    if (!c) return;
    var i = Number(e.target.getAttribute('data-i'));
    codes[i][c] = c === 'multiplier' ? Number(e.target.value) : (c === 'price' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value);
  });
  m.addEventListener('click', function (e) {
    var x = e.target.getAttribute('data-x');
    if (x === 'del') { codes.splice(Number(e.target.getAttribute('data-i')), 1); drawCodes(); }
    if (x === 'addcode') { codes.push({ barcode: '', unitName: codes.length ? 'แพ็ค' : 'ชิ้น', multiplier: codes.length ? 6 : 1, price: null }); drawCodes(); }
    if (x === 'internal') {
      api('newInternalBarcode', S.token).then(function (code) {
        var empty = codes.filter(function (c) { return !c.barcode; })[0];
        if (empty) empty.barcode = code; else codes.push({ barcode: code, unitName: 'ชิ้น', multiplier: 1, price: null });
        drawCodes(); toast('สร้างบาร์โค้ด ' + code);
      }).catch(fail);
    }
    if (x === 'cancel') closeModal();
    if (x === 'save') save();
  });
  var save = function () {
    var v = function (id) { return $('#' + id, m).value; };
    var prod = {
      sku: sku, name: v('f-name'), category: v('f-cat'), type: v('f-type'), unit: v('f-unit'), cost: v('f-cost'), price: v('f-price'),
      minStock: v('f-min'), plu: v('f-plu'), openPrice: $('#f-open', m).checked, quickKey: $('#f-qk', m).checked,
      quickKeyGroup: v('f-qkg'), quickKeyOrder: v('f-qko'), icon: v('f-icon'), color: v('f-color'),
      active: $('#f-active', m) ? $('#f-active', m).checked : true
    };
    api('saveProduct', S.token, prod, codes.filter(function (c) { return String(c.barcode || '').trim(); })).then(function () {
      closeModal(); toast('บันทึกแล้ว');
      return reloadCatalog().then(renderProductRows);
    }).catch(fail);
  };
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
    '<div class="muted" style="font-size:13px">ใช้ไฟล์ตัวอย่างเป็นแบบ · สินค้าเดียวกันหลายบาร์โค้ดใส่หลายแถว SKU เดียวกัน · openingStock ใช้เฉพาะสินค้าใหม่</div>' +
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
  $('[data-x=go]', m).onclick = function () {
    api('importProducts', S.token, $('#csvtext', m).value).then(function (r) {
      $('#csvres', m).innerHTML = '<div class="card pad"><b>เพิ่ม ' + r.created + ' · แก้ ' + r.updated + '</b>' +
        (r.errors.length ? '<div class="warn-text" style="margin-top:6px">' + r.errors.map(esc).join('<br>') + '</div>' : '') + '</div>';
      return reloadCatalog().then(renderProductRows);
    }).catch(fail);
  };
}

/* =================================================================== */
/* Stock                                                               */
/* =================================================================== */

var stockRows = [];
function renderStock() {
  var cats = categories().map(function (c) { return '<option ' + (S.stockFilter.cat === c ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('');
  return '<div class="page" style="flex-direction:column"><div class="row" style="flex-wrap:wrap">' +
    '<label class="sr" for="sq">ค้นหา</label><input id="sq" placeholder="ค้นหาสินค้า" value="' + esc(S.stockFilter.q) + '" data-input="stockQ" style="width:280px">' +
    '<label class="sr" for="scat">หมวด</label><select id="scat" data-change="stockCat"><option value="">ทุกหมวด</option>' + cats + '</select>' +
    '<label class="row" style="color:var(--ink)"><input type="checkbox" data-change="stockLow" ' + (S.stockFilter.low ? 'checked' : '') + '> เฉพาะใกล้หมด</label>' +
    '<span class="grow"></span><span class="muted" id="ssum"></span></div>' +
    '<div class="card" style="flex:1;overflow:auto"><table class="table"><thead><tr><th>SKU</th><th>สินค้า</th><th>หมวด</th><th class="r">คงเหลือ</th>' +
    '<th class="r">ขั้นต่ำ</th><th class="r">มูลค่าทุน</th><th></th></tr></thead><tbody id="srows"><tr><td colspan="7" class="muted">กำลังโหลด…</td></tr></tbody></table></div></div>';
}

function loadStock() { api('stockList', S.token).then(function (rows) { stockRows = rows; renderStockRows(); }).catch(fail); }

function renderStockRows() {
  var tb = $('#srows');
  if (!tb) return;
  var q = S.stockFilter.q.toLowerCase();
  var rows = stockRows.filter(function (r) {
    if (S.stockFilter.cat && r.category !== S.stockFilter.cat) return false;
    if (S.stockFilter.low && !(r.minStock > 0 && r.onHand <= r.minStock)) return false;
    return !q || r.name.toLowerCase().indexOf(q) >= 0 || r.sku.toLowerCase().indexOf(q) >= 0;
  });
  var value = rows.reduce(function (a, r) { return a + Math.max(0, r.onHand) * r.cost; }, 0);
  $('#ssum').textContent = rows.length + ' รายการ · มูลค่าทุน ฿' + money(value);
  tb.innerHTML = rows.length ? rows.map(function (r) {
    var low = r.minStock > 0 && r.onHand <= r.minStock;
    return '<tr><td class="num">' + esc(r.sku) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.category) + '</td><td class="r num ' +
      (low || r.onHand < 0 ? 'warn-text' : '') + '"><b>' + r.onHand + '</b> ' + esc(r.unit) + '</td><td class="r num">' + (r.minStock || '—') +
      '</td><td class="r num">' + money(Math.max(0, r.onHand) * r.cost) + '</td><td class="r"><button class="btn sm" data-act="countStock" data-sku="' + esc(r.sku) +
      '">ปรับยอด</button> <button class="btn sm ghost" data-act="stockHist" data-sku="' + esc(r.sku) + '">ประวัติ</button></td></tr>';
  }).join('') : '<tr><td colspan="7" class="muted">ไม่พบรายการ</td></tr>';
}

function countStock(sku) {
  var r = stockRows.filter(function (x) { return x.sku === sku; })[0];
  if (!r) return;
  var m = openModal('<header><h1>ปรับยอดสต็อก</h1><span class="muted">' + esc(r.name) + '</span></header><form class="body">' +
    '<div class="muted">ในระบบ ' + r.onHand + ' ' + esc(r.unit) + '</div>' +
    '<div class="field"><label for="cnt">นับได้จริง (ชิ้น)</label><input id="cnt" type="number" class="big-input" autofocus value="' + Math.max(0, r.onHand) + '"></div>' +
    '<div class="field"><label for="why">เหตุผล</label><select id="why"><option>สต็อกเปิด</option><option>ตรวจนับ</option><option>ของเสีย/หมดอายุ</option><option>สูญหาย</option><option>อื่นๆ</option></select></div>' +
    '</form><footer><button class="btn" data-x="cancel">ยกเลิก</button><button class="btn primary" data-x="save">บันทึก</button></footer>');
  $('[data-x=cancel]', m).onclick = function () { closeModal(); };
  var save = function () {
    var cnt = $('#cnt', m).value, why = $('#why', m).value;
    approval('STOCK_ADJUST', 'อนุมัติปรับสต็อก').then(function (id) {
      if (id === null) return;
      return api('setStockCount', S.token, sku, cnt, why, id).then(function (res) {
        closeModal(); toast('ปรับแล้ว (' + (res.diff > 0 ? '+' : '') + res.diff + ')'); loadStock(); reloadCatalog();
      });
    }).catch(fail);
  };
  $('[data-x=save]', m).onclick = save;
  $('form', m).onsubmit = function (e) { e.preventDefault(); save(); };
}

function stockHist(sku) {
  var p = S.idx.bySku[sku];
  api('stockMoves', S.token, sku).then(function (rows) {
    var names = { OPEN: 'สต็อกเปิด', SALE: 'ขาย', VOID: 'ยกเลิกบิล', ADJUST: 'ปรับยอด' };
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

function renderShift() {
  if (!S.isCounter) return '<div class="page"><div class="card pad" style="max-width:560px">เปิด/ปิดกะได้เฉพาะเครื่องหน้าร้านที่ลงทะเบียนแล้ว</div></div>';
  if (!S.shift) {
    return '<div class="page" style="justify-content:center;align-items:flex-start"><form class="card pad col" style="width:520px;gap:12px" data-form="openShift">' +
      '<h2>เปิดกะ</h2><div class="muted">นับเงินทอนในลิ้นชักก่อนเริ่มขาย</div>' + denomTable('o') +
      '<div class="row" style="justify-content:space-between;align-items:baseline"><b>เงินทอนตั้งต้น</b><span id="o-total" class="num" style="font-size:30px;font-weight:700">฿0.00</span></div>' +
      '<button class="btn lg primary" type="submit">เปิดกะ · เริ่มขาย</button></form></div>';
  }
  return '<div class="page"><section class="card pad col grow" style="gap:12px"><h2>นับเงินในลิ้นชัก · ปิดกะ</h2>' + denomTable('c') +
    '<div class="row" style="justify-content:space-between;align-items:baseline"><b>นับได้จริง</b><span id="c-total" class="num" style="font-size:30px;font-weight:700">฿0.00</span></div>' +
    '<div class="field"><label for="cnote">หมายเหตุ</label><input id="cnote" placeholder="เช่น ทอนเกิน"></div>' +
    '<button class="btn" type="button" data-act="noSale">เปิดลิ้นชักเพื่อนับเงิน</button>' +
    '<button class="btn lg primary" data-act="closeShift">ปิดกะ' + (S.settings.lineEnabled ? ' · ส่ง LINE' : '') + '</button></section>' +
    '<section class="col" style="width:420px;gap:16px"><div class="card pad" id="shiftsum"><span class="muted">กำลังโหลด…</span></div>' +
    '<form class="card pad col" data-form="cashMove" style="gap:10px"><h2 style="margin:0">เงินเข้า / ออกลิ้นชัก</h2>' +
    '<div class="seg"><button type="button" data-mv="OUT" class="on">เงินออก</button><button type="button" data-mv="IN">เงินเข้า</button></div>' +
    '<div class="row"><label class="sr" for="mvamt">จำนวน</label><input id="mvamt" type="number" step="0.25" placeholder="จำนวนเงิน" style="width:140px">' +
    '<label class="sr" for="mvwhy">เหตุผล</label><input id="mvwhy" placeholder="เหตุผล เช่น ค่าน้ำแข็ง" class="grow"></div>' +
    '<button class="btn" type="submit">บันทึก</button></form></section></div>';
}

function denomTable(prefix) {
  return '<table class="table"><tbody>' + DENOMS.map(function (d) {
    return '<tr><td><label for="' + prefix + d + '" style="color:var(--ink);font-size:15px">แบงก์ ' + d.toLocaleString() + '</label></td><td class="r"><input id="' + prefix + d +
      '" data-den="' + d + '" data-p="' + prefix + '" type="number" min="0" inputmode="numeric" style="width:110px;text-align:center"></td></tr>';
  }).join('') + '<tr><td><label for="' + prefix + 'coin" style="color:var(--ink);font-size:15px">เหรียญรวม (บาท)</label></td><td class="r"><input id="' + prefix +
    'coin" data-den="1" data-p="' + prefix + '" type="number" min="0" step="0.25" style="width:110px;text-align:center"></td></tr></tbody></table>';
}

function denomSum(prefix) {
  var total = 0;
  $all('[data-p="' + prefix + '"]').forEach(function (i) { total += Number(i.value || 0) * Number(i.getAttribute('data-den')); });
  return round2(total);
}

function loadShift() {
  api('shiftSummary', S.token).then(drawShiftSum).catch(fail);
}

function drawShiftSum(s) {
  var box = $('#shiftsum');
  if (!box) return;
  var row = function (k, v, strong) { return '<div class="row" style="justify-content:space-between' + (strong ? ';font-weight:700' : '') + '"><span>' + k + '</span><span class="num">' + v + '</span></div>'; };
  box.innerHTML = '<h2>สรุปจากระบบ</h2>' + row('เปิดกะ', dateTime(s.openedAt)) + row('เงินทอนตั้งต้น', money(s.openingCash)) + row('ขายเงินสด', money(s.cashSales)) +
    row('เงินเข้า', money(s.cashIn)) + row('เงินออก', '−' + money(s.cashOut)) +
    '<hr style="border:0;border-top:1px solid var(--line)">' + row('ต้องมีในลิ้นชัก', money(s.expectedCash), true) +
    '<div class="muted" style="font-size:14px;margin-top:6px">QR ' + money(s.qrSales) + ' · โอน ' + money(s.transferSales) + ' · รวมขาย ' + money(s.totalSales) +
    '<br>' + s.billCount + ' บิล · ยกเลิก ' + s.voidCount + ' · ส่วนลด ' + money(s.discount) + '</div>';
}

function openShift() {
  var cash = denomSum('o');
  api('openShift', S.token, cash, '').then(function (sh) {
    S.shift = sh; toast('เปิดกะแล้ว'); go('sale');
    if (sh) openDrawer(true);
  }).catch(fail);
}

function closeShift() {
  var counted = denomSum('c');
  confirm2('ปิดกะ', 'ยอดนับได้ ฿' + money(counted) + ' — ปิดกะแล้วจะยกเลิกบิลในกะนี้ไม่ได้', 'ปิดกะ').then(function (ok) {
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
    r('เงินเข้า', money(s.cashIn)) + r('เงินออก', money(s.cashOut)) + r('ต้องมีในลิ้นชัก', money(s.expectedCash)) + r('นับได้', money(s.countedCash)) +
    r('ส่วนต่าง', money(s.diff)) + r('จำนวนบิล', s.billCount) + r('ยกเลิก', s.voidCount) + '</table>';
  window.print();
}

/* =================================================================== */
/* Reports                                                             */
/* =================================================================== */

function renderReports() {
  return '<div class="page" style="flex-direction:column"><div class="row"><label for="rday">วันที่</label><input id="rday" type="date" value="' +
    (S.reportDay || today()) + '" data-change="reportDay" style="width:180px"></div><div id="report" class="col" style="gap:14px"><span class="muted">กำลังโหลด…</span></div></div>';
}

var ACTION_TH = { VOID: 'ยกเลิกบิล', DISCOUNT: 'ส่วนลด', OPEN_PRICE: 'ราคาเปิด', CASH_IN: 'เงินเข้า', CASH_OUT: 'เงินออก',
  STOCK_ADJUST: 'ปรับสต็อก', PRICE_CHANGE: 'แก้ราคา', APPROVE_FAIL: 'PIN อนุมัติผิด', NO_SALE: 'เปิดลิ้นชัก' };

function loadReport() {
  api('dailyReport', S.token, S.reportDay || today()).then(function (r) {
    var box = $('#report');
    if (!box) return;
    var max = Math.max.apply(null, r.hourly.concat([1]));
    var kpi = function (k, v, cls) { return '<div class="card kpi"><div class="muted">' + k + '</div><div class="v num ' + (cls || '') + '">' + v + '</div></div>'; };
    box.innerHTML = '<div class="kpis">' + kpi('ยอดขาย', '฿' + money(r.total), 'brand-text') + kpi('จำนวนบิล', r.billCount) + kpi('เฉลี่ยต่อบิล', '฿' + money(r.avgBill)) +
      kpi('กำไรขั้นต้น', '฿' + money(r.grossProfit) + ' <span class="muted" style="font-size:14px">' + r.grossMargin + '%</span>') + '</div>' +
      '<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:14px">' +
      '<div class="card pad"><h2>ยอดขายรายชั่วโมง</h2><div class="bars">' + r.hourly.map(function (v, h) {
        return '<div title="' + h + ':00 ฿' + money(v) + '" style="height:' + (v / max * 100) + '%"></div>';
      }).join('') + '</div><div class="row muted" style="justify-content:space-between;font-size:12px"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div></div>' +
      '<div class="card pad"><h2>ช่องทางชำระ</h2>' + ['cash', 'qr', 'transfer'].map(function (k) {
        return '<div class="row" style="justify-content:space-between"><span>' + payName(k) + '</span><b class="num">฿' + money(r.byPay[k]) + '</b></div>';
      }).join('') + '<div class="muted" style="margin-top:8px">ส่วนลดรวม ฿' + money(r.discount) + ' · ยกเลิก ' + r.voidCount + ' บิล (฿' + money(r.voidTotal) + ')</div></div>' +
      '<div class="card pad"><h2>สินค้าขายดี</h2><table class="table"><tbody>' + (r.top.map(function (t, i) {
        return '<tr><td class="muted">' + (i + 1) + '</td><td>' + esc(t.name) + '</td><td class="r num">' + t.pieces + ' ชิ้น</td><td class="r num">฿' + money(t.revenue) + '</td></tr>';
      }).join('') || '<tr><td class="muted">ยังไม่มีการขาย</td></tr>') + '</tbody></table></div>' +
      '<div class="card pad"><h2>รายการผิดปกติ</h2><table class="table"><tbody>' + (r.exceptions.map(function (x) {
        return '<tr><td class="num">' + timeOf(x.createdAt) + '</td><td><b>' + (ACTION_TH[x.action] || x.action) + '</b> ' + esc(x.detail) + '</td><td>' + esc(x.user) +
          (x.approvedBy ? ' · อนุมัติ ' + esc(x.approvedBy) : '') + '</td></tr>';
      }).join('') || '<tr><td class="muted">ไม่มี</td></tr>') + '</tbody></table></div></div>' +
      (r.lowStock.length ? '<div class="card pad"><h2>ของใกล้หมด (' + r.lowStock.length + ')</h2>' + r.lowStock.map(function (l) {
        return '<span class="tag warn" style="margin:0 6px 6px 0">' + esc(l.name) + ' ' + l.onHand + '/' + l.minStock + '</span>';
      }).join('') + '</div>' : '');
  }).catch(fail);
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
  return '<div class="page" style="flex-direction:column;gap:14px"><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px">' +
    '<form class="card pad col" data-form="settings" style="gap:10px"><h2>ร้าน</h2>' + f('shopName', 'ชื่อร้าน (บนใบเสร็จ)') + f('shopAddress', 'ที่อยู่') +
    f('taxId', 'เลขผู้เสียภาษี', 'ถ้ามี') + f('promptPayId', 'พร้อมเพย์', 'เบอร์มือถือ / เลขบัตร 13 หลัก') + f('receiptFooter', 'ข้อความท้ายใบเสร็จ') +
    f('billPrefix', 'คำนำหน้าเลขบิล', 'เว้นว่างได้') + '<button class="btn primary" type="submit">บันทึก</button></form>' +
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
    '<hr style="border:0;border-top:1px solid var(--line);width:100%">' +
    '<h2>สำรองข้อมูล</h2><div class="muted" style="font-size:13px">Backup อัตโนมัติทุกวันตั้งได้ด้วย installTriggers() (ดูคู่มือ)</div>' +
    '<button class="btn" data-act="backupNow">Backup ตอนนี้</button></div></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1.4fr;gap:14px"><div class="card pad"><h2>พนักงาน & สิทธิ์</h2><div id="userlist" class="muted">กำลังโหลด…</div>' +
    '<form class="row" data-form="addUser" style="margin-top:10px;flex-wrap:wrap"><label class="sr" for="nu-name">ชื่อ</label><input id="nu-name" placeholder="ชื่อ" style="width:140px">' +
    '<label class="sr" for="nu-role">สิทธิ์</label><select id="nu-role"><option value="cashier">แคชเชียร์</option><option value="owner">เจ้าของ</option></select>' +
    '<label class="sr" for="nu-pin">PIN</label><input id="nu-pin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN 4–6 หลัก" style="width:120px">' +
    '<button class="btn" type="submit">+ เพิ่ม</button></form></div>' +
    '<div class="card pad" style="max-height:420px;overflow:auto"><h2>บันทึกการทำงาน (ล่าสุด 100)</h2><table class="table"><tbody id="auditrows"><tr><td class="muted">กำลังโหลด…</td></tr></tbody></table></div></div></div>';
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
  pickUser: function (el) { S.loginUser = el.getAttribute('data-id'); S.pin = ''; render(); },
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
  selLine: function (el, e) { if (e.target.closest('[data-act=qty]')) return; S.cart.sel = Number(el.getAttribute('data-i')); renderCartOnly(); },
  qty: function (el) { changeQty(Number(el.getAttribute('data-i')), Number(el.getAttribute('data-d'))); },
  lineDiscount: function () { askDiscount('line'); },
  billDiscount: function () { askDiscount('bill'); },
  clearCart: function () {
    if (!S.cart.lines.length) return;
    confirm2('ล้างบิล', 'ลบสินค้าทั้งหมดในบิลนี้?', 'ล้างบิล', true).then(function (ok) { if (ok) { newCart(); renderCartOnly(); } });
  },
  pay: openPay,
  noSale: noSale,
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
  editProduct: function (el) { editProduct(el.getAttribute('data-sku')); },
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

document.addEventListener('click', function (e) {
  S.lastActivity = Date.now();
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
  if (kind === 'openShift') openShift();
  if (kind === 'settings') saveSettingsForm(form);
  if (kind === 'addUser') {
    api('addUser', S.token, $('#nu-name').value, $('#nu-role').value, $('#nu-pin').value).then(function () {
      toast('เพิ่มผู้ใช้แล้ว'); $('#nu-name').value = ''; $('#nu-pin').value = ''; loadSettings();
    }).catch(fail);
  }
  if (kind === 'cashMove') {
    var type = ($('[data-mv].on') || {}).getAttribute ? $('[data-mv].on').getAttribute('data-mv') : 'OUT';
    api('cashMove', S.token, type, $('#mvamt').value, $('#mvwhy').value).then(function (s) {
      toast('บันทึกแล้ว'); $('#mvamt').value = ''; $('#mvwhy').value = ''; drawShiftSum(s);
    }).catch(fail);
  }
});

document.addEventListener('click', function (e) {
  var mv = e.target.closest('[data-mv]');
  if (mv) $all('[data-mv]').forEach(function (b) { b.classList.toggle('on', b === mv); });
});

document.addEventListener('input', function (e) {
  S.lastActivity = Date.now();
  var t = e.target;
  if (t.hasAttribute('data-den')) {
    var p = t.getAttribute('data-p');
    var out = $('#' + p + '-total');
    if (out) out.textContent = '฿' + money(denomSum(p));
  }
  var k = t.getAttribute('data-input');
  if (k === 'prodQ') { S.prodFilter.q = t.value; renderProductRows(); }
  if (k === 'stockQ') { S.stockFilter.q = t.value; renderStockRows(); }
});

document.addEventListener('change', function (e) {
  var t = e.target, k = t.getAttribute('data-change');
  if (k === 'billsDay') { S.billsDay = t.value; loadBills(); }
  if (k === 'reportDay') { S.reportDay = t.value; loadReport(); }
  if (k === 'prodCat') { S.prodFilter.cat = t.value; renderProductRows(); }
  if (k === 'stockCat') { S.stockFilter.cat = t.value; renderStockRows(); }
  if (k === 'stockLow') { S.stockFilter.low = t.checked; renderStockRows(); }
  if (k === 'drawerPin') { CashDrawer.save({ pin: Number(t.value) }); }
  if (k === 'drawerBaud') { CashDrawer.save({ baud: Number(t.value) }); }
  if (k === 'localTheme') { store('em_theme', t.value || null); applyTheme(); }
});

document.addEventListener('keydown', function (e) {
  S.lastActivity = Date.now();
  if (e.key === 'Escape' && modalStack.length) { e.preventDefault(); closeModal(); return; }
  if (S.view === 'login' && !modalStack.length) {
    if (/^\d$/.test(e.key)) { e.preventDefault(); pinKey(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); pinKey('del'); }
    else if (e.key === 'Enter') { e.preventDefault(); pinKey('ok'); }
    return;
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
  }
});

/* Auto-lock when idle with an empty cart. */
setInterval(function () {
  if (!S.token || S.view === 'login') return;
  var mins = Number(S.settings.autoLockMinutes || 0);
  if (!mins || (S.cart && S.cart.lines.length) || modalStack.length) return;
  if (Date.now() - S.lastActivity > mins * 60000) logout();
}, 30000);

/* Expose a few pure helpers for testing. */
window.__em = { promptPayPayload: promptPayPayload, crc16: crc16, S: S, conn: conn };

start();
})();
