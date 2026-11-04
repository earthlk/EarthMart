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
  if (window.CustomerDisplay && CustomerDisplay.isDisplay) return CustomerDisplay.startDisplay();
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
    S.markdowns = d.markdowns || []; S.expiryTodo = d.expiryTodo || 0;
    setCatalog(d.products, d.barcodes, d.recipes);
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
  S.recipes = {};
  (recipes || []).forEach(function (r) { (S.recipes[r.sku] = S.recipes[r.sku] || []).push({ sku: r.componentSku, qty: r.qty }); });
  S.barcodes = barcodes;
  var bySku = {}, byBarcode = {}, byPlu = {};
  products.forEach(function (p) { bySku[p.sku] = p; if (p.plu && p.active && p.forSale !== false) byPlu[p.plu] = p; });
  barcodes.forEach(function (b) { if (bySku[b.sku] && bySku[b.sku].active) byBarcode[b.barcode] = b; });
  S.idx = { bySku: bySku, byBarcode: byBarcode, byPlu: byPlu };
}

function reloadCatalog() {
  return api('bootstrap', S.token).then(function (d) { setCatalog(d.products, d.barcodes, d.recipes); S.shift = d.shift; S.markdowns = d.markdowns || []; S.expiryTodo = d.expiryTodo || 0; });
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
  if (view === 'sale' && S.isCounter && !S.shift) view = 'shift';
  S.view = view;
  render();
  if (view === 'bills') loadBills();
  if (view === 'products') renderProductRows();
  if (view === 'stock') loadStock();
  if (view === 'receive') loadReceive();
  if (view === 'expiry') { S.expSel = null; loadExpiry(); }
  if (view === 'shift' && S.shift) loadShift();
  if (view === 'reports') loadReport();
  if (view === 'settings') loadSettings();
}

function frame(inner) {
  var nav = NAV.filter(function (n) { return !n[2] || (S.user && S.user.role === n[2]); }).map(function (n) {
    return '<button data-act="go" data-v="' + n[0] + '" class="' + (S.view === n[0] ? 'on' : '') + '">' + n[1] +
      (n[0] === 'expiry' ? '<span class="badge">' + (S.expiryTodo || '') + '</span>' : '') + '</button>';
  }).join('');
  var shiftTxt = S.shift ? 'กะเปิด ' + timeOf(S.shift.openedAt) : (S.isCounter ? 'ยังไม่เปิดกะ' : 'ไม่ใช่เครื่องหน้าร้าน');
  var role = S.user && S.user.role === 'owner' ? 'เจ้าของ' : 'แคชเชียร์';
  var banner = !S.isCounter ? '<div class="banner">เครื่องนี้ยังไม่ได้ลงทะเบียนเป็นเครื่องหน้าร้าน — ขายและเปิดกะไม่ได้' +
    (S.user && S.user.role === 'owner' ? ' · <a href="#" data-act="go" data-v="settings">ลงทะเบียนในหน้าตั้งค่า</a>' : ' · ให้เจ้าของลงทะเบียนในหน้าตั้งค่า') + '</div>' : '';
  return '<header class="topbar"><span class="brand">' + esc(S.settings.shopName || 'EarthMart') + '</span><nav>' + nav + '</nav>' +
    '<span class="grow"></span><span class="meta">' + shiftTxt + ' · ' + role + ': ' + esc(S.user ? S.user.name : '') + '</span>' +
    (S.shift && S.isCounter ? '<button class="btn" data-act="cashMoveModal">เงินเข้า/ออก</button>' : '') +
    (S.isCounter ? '<button class="btn" data-act="openCustomer" id="cdbtn" title="เปิดจอลูกค้าบนจอที่ 2"><span class="dot' +
      (window.CustomerDisplay && CustomerDisplay.pos.connected() ? ' on' : '') + '"></span>จอลูกค้า</button>' : '') +
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
    case 'receive': html = frame(renderReceive()); break;
    case 'expiry': html = frame(renderExpiry()); break;
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
    last: last ? { name: last.name, price: last.unitPrice } : null,
    items: t.items, subtotal: t.subtotal, discount: t.discount, total: t.total
  }, extra || {});
  CustomerDisplay.pos.publish(st);
}

/* Near-expiry markdown on a sale line (set on the Expiry page; no PIN needed at the till). */
function mdAmt(l) { return l.md ? round2(l.unitPrice * l.md.qty * l.md.pct / 100) : 0; }
function ldTotal(l) { return round2((l.lineDiscount || 0) + mdAmt(l)); }

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
      return '<button class="key" data-act="quickKey" data-sku="' + esc(p.sku) + '"><span class="ic" style="background:' + c[0] + ';color:' + c[1] + '">' +
        iconHtml(p) + '</span><span class="nm">' + esc(p.name) + '</span><span class="pr">' +
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
  if (!S.cart.lines.length) box.innerHTML = '<div class="empty">สแกนสินค้าหรือแตะปุ่มด้านขวาเพื่อเริ่มบิล</div>';
  else box.innerHTML = S.cart.lines.map(function (l, i) {
    var m = l.multiplier === 1 ? mdFor(l.sku, i) : null;
    var mdChip = l.md ? '<button class="mdchip on" data-act="toggleMd" data-i="' + i + '" title="แตะเพื่อยกเลิก">ราคาลด −' + l.md.pct + '% × ' + l.md.qty + ' ✕</button>'
      : m && m.left > 0 ? '<button class="mdchip" data-act="toggleMd" data-i="' + i + '">ใช้ราคาลด −' + m.pct + '% (เหลือ ' + m.left + ')</button>' : '';
    return '<div class="swipe" data-i="' + i + '"><div class="swipe-bg">ลบ</div><div class="line ' + (i === S.cart.sel ? 'sel' : '') + '" data-act="selLine" data-i="' + i + '">' +
      '<div><div class="name">' + esc(l.name) + '</div><div class="sub">' + (S.recipes[l.sku] ? 'สูตร: ' + esc(recipeText(l.sku)) : esc(l.unitName) + (l.multiplier > 1 ? ' (' + l.multiplier + ' ชิ้น)' : '')) +
      ' · ฿' + money(l.unitPrice) + '</div>' + mdChip + '</div>' +
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
  if (bar) bar.innerHTML = '<div class="grow"><div class="muted">' + t.items + ' ชิ้น' + (t.discount ? ' · ส่วนลด ฿' + money(t.discount) : '') +
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
  var m = openModal('<header><h1>ชำระเงิน</h1><span class="muted">' + t.items + ' ชิ้น</span><span class="grow"></span>' +
    '<span style="font-size:28px;font-weight:700" class="brand-text num">฿' + money(t.total) + '</span></header>' +
    '<div class="body"><div class="seg" id="pm">' +
    '<button data-m="cash" class="on">เงินสด</button><button data-m="qr">QR พร้อมเพย์</button><button data-m="transfer">โอน</button><button data-m="split">แบ่งจ่าย</button></div>' +
    '<div id="pm-cash" class="col" style="gap:10px"><label for="recv">รับเงินมา</label><input id="recv" class="big-input num" type="number" inputmode="decimal" step="0.25" autofocus>' +
    '<div class="row" style="flex-wrap:wrap">' + quick.map(function (q) { return '<button class="btn" data-q="' + q + '">' + (q === t.total ? 'พอดี' : '฿' + money(q)) + '</button>'; }).join('') + '</div>' +
    '<div class="row" style="justify-content:space-between;align-items:baseline"><span class="muted">เงินทอน</span><span id="chg" class="num brand-text" style="font-size:40px;font-weight:700">฿0.00</span></div></div>' +
    '<div id="pm-qr" class="col hidden" style="align-items:center;gap:8px">' +
    (hasPP ? '<div class="qr" id="qrbox"></div><div class="muted">พร้อมเพย์ ' + esc(maskPP(S.settings.promptPayId)) + ' · ยอดอยู่ใน QR แล้ว</div><div class="muted" style="font-size:13px">ตรวจยอดเข้าในแอปธนาคาร แล้วกด "ได้รับเงินแล้ว"</div>'
      : '<div class="banner" style="border-radius:8px">ยังไม่ได้ตั้งเบอร์พร้อมเพย์ (ตั้งค่า › ร้าน)</div>') + '</div>' +
    '<div id="pm-transfer" class="col hidden"><div class="muted">ตรวจยอดโอนในแอปธนาคารก่อน แล้วกด "ได้รับเงินแล้ว"</div></div>' +
    '<div id="pm-split" class="col hidden" style="gap:10px"><div class="row" style="gap:10px;align-items:flex-end">' +
    '<div class="field" style="flex:1"><label>อีกส่วนจ่ายด้วย</label><div class="seg-sm" id="sp-m"><button data-o="qr" class="on">QR พร้อมเพย์</button><button data-o="transfer">โอน</button></div></div>' +
    '<div class="field" style="flex:1"><label for="sp-o">ยอด QR / โอน</label><input id="sp-o" class="num" type="number" inputmode="decimal" step="0.25" style="height:44px;font-size:20px;font-weight:700;text-align:right"></div></div>' +
    '<div class="row" style="justify-content:space-between;padding:10px 12px;background:var(--bg);border-radius:8px"><span>ส่วนเงินสด</span><b class="num" id="sp-c" style="font-size:20px">฿0.00</b></div>' +
    '<div class="row" style="gap:10px;align-items:flex-end"><div class="field" style="flex:1"><label for="sp-r">รับเงินสดมา</label><input id="sp-r" class="num" type="number" inputmode="decimal" step="0.25" style="height:44px;font-size:20px;text-align:right"></div>' +
    '<div style="flex:1;text-align:right"><div class="muted" style="font-size:13px">เงินทอน</div><div id="sp-chg" class="num brand-text" style="font-size:30px;font-weight:700">฿0.00</div></div></div>' +
    '<div id="sp-qrwrap" class="col" style="align-items:center;gap:6px"><div class="qr" id="spqr" style="width:170px;height:170px"></div><div class="muted" style="font-size:13px" id="sp-qrnote">ใส่ยอด QR ก่อน แล้ว QR จะขึ้นที่นี่และที่จอลูกค้า</div></div></div>' +
    '<label class="row" style="color:var(--ink);font-size:15px"><input type="checkbox" id="autoprint" ' + (store('em_autoprint') === '0' ? '' : 'checked') + '> พิมพ์ใบเสร็จ</label>' +
    '</div><footer><button class="btn" data-x="cancel">ยกเลิก (Esc)</button><button class="btn primary lg" data-x="ok" style="height:52px;font-size:17px">ยืนยัน (Enter)</button></footer>',
    { onClose: function () { if (!paid) cdPublish(); } });
  var paid = false;
  cdPublish('pay', { method: 'cash' });

  var recv = $('#recv', m);
  var update = function () {
    var r = Number(recv.value || 0);
    var c = round2(r - t.total);
    $('#chg', m).textContent = '฿' + money(Math.max(0, c));
    $('#chg', m).className = 'num ' + (c < 0 ? 'warn-text' : 'brand-text');
    $('[data-x=ok]', m).textContent = method === 'cash' ? 'ยืนยัน (Enter)' : 'ได้รับเงินแล้ว (Enter)';
    if (method === 'split') updateSplit();
  };
  // Split: one non-cash part (QR or transfer) + the rest in cash.
  var spOther = 'qr', spQrFor = -1;
  var spParts = function () {
    var o = round2(Number($('#sp-o', m).value || 0));
    return { other: o, cash: round2(t.total - o), recv: round2(Number($('#sp-r', m).value || 0)) };
  };
  var updateSplit = function () {
    var p = spParts();
    $('#sp-c', m).textContent = '฿' + money(Math.max(0, p.cash));
    var c = round2(p.recv - p.cash);
    $('#sp-chg', m).textContent = '฿' + money(Math.max(0, c));
    $('#sp-chg', m).className = 'num ' + (c < 0 ? 'warn-text' : 'brand-text');
    var showQr = spOther === 'qr' && hasPP && p.other > 0 && p.other < t.total;
    $('#sp-qrwrap', m).classList.toggle('hidden', spOther !== 'qr');
    if (showQr && spQrFor !== p.other) {
      spQrFor = p.other;
      drawQr($('#spqr', m), promptPayPayload(S.settings.promptPayId, p.other));
      $('#sp-qrnote', m).textContent = 'QR ยอด ฿' + money(p.other) + ' · ตรวจยอดเข้าในแอปธนาคารก่อนยืนยัน';
      cdPublish('pay', { method: 'qr', qr: promptPayPayload(S.settings.promptPayId, p.other), split: { qr: p.other, cash: p.cash } });
    } else if (!showQr && spQrFor !== -1) {
      spQrFor = -1; $('#spqr', m).innerHTML = '';
      $('#sp-qrnote', m).textContent = hasPP ? 'ใส่ยอด QR ก่อน แล้ว QR จะขึ้นที่นี่และที่จอลูกค้า' : 'ยังไม่ได้ตั้งเบอร์พร้อมเพย์';
      cdPublish('pay', { method: 'cash' });
    }
  };
  $('#sp-o', m).oninput = update;
  $('#sp-r', m).oninput = update;
  $all('#sp-m button', m).forEach(function (b) {
    b.onclick = function () {
      spOther = b.getAttribute('data-o'); spQrFor = -2;
      $all('#sp-m button', m).forEach(function (x) { x.classList.toggle('on', x === b); });
      if (spOther !== 'qr') cdPublish('pay', { method: 'cash' });
      update();
    };
  });
  recv.oninput = update;
  $all('[data-q]', m).forEach(function (b) { b.onclick = function () { recv.value = b.getAttribute('data-q'); update(); recv.focus(); }; });
  $all('#pm button', m).forEach(function (b) {
    b.onclick = function () {
      method = b.getAttribute('data-m');
      $all('#pm button', m).forEach(function (x) { x.classList.toggle('on', x === b); });
      ['cash', 'qr', 'transfer', 'split'].forEach(function (k) { $('#pm-' + k, m).classList.toggle('hidden', k !== method); });
      if (method === 'qr' && hasPP) drawQr($('#qrbox', m), promptPayPayload(S.settings.promptPayId, t.total));
      cdPublish('pay', { method: method, qr: method === 'qr' && hasPP ? promptPayPayload(S.settings.promptPayId, t.total) : '' });
      if (method === 'cash') recv.focus();
      if (method === 'split') { spQrFor = -2; $('#sp-o', m).focus(); }
      update();
    };
  });
  var submitting = false;
  var submit = function () {
    if (submitting) return;
    var received = method === 'cash' ? round2(Number(recv.value || 0)) : t.total;
    if (method === 'cash' && received < t.total) { toast('รับเงินไม่พอ', true); recv.focus(); return; }
    var payments;
    if (method === 'split') {
      var sp = spParts();
      if (!(sp.other > 0) || sp.other >= t.total) { toast('ใส่ยอด QR / โอน ให้น้อยกว่ายอดรวม', true); $('#sp-o', m).focus(); return; }
      if (sp.recv < sp.cash) { toast('รับเงินสดไม่พอ', true); $('#sp-r', m).focus(); return; }
      if (spOther === 'qr' && !hasPP) { toast('ตั้งเบอร์พร้อมเพย์ก่อน', true); return; }
      payments = [{ method: 'cash', amount: sp.cash }, { method: spOther, amount: sp.other }];
      received = sp.recv;
    }
    if (method === 'qr' && !hasPP) { toast('ตั้งเบอร์พร้อมเพย์ก่อน', true); return; }
    submitting = true;
    store('em_autoprint', $('#autoprint', m).checked ? '1' : '0');
    var sale = {
      saleUid: S.cart.saleUid, payMethod: method, received: received, payments: payments, billDiscount: S.cart.billDiscount,
      approvalId: S.cart.approvalId,
      lines: S.cart.lines.map(function (l) {
        return { sku: l.sku, barcode: l.barcode, qty: l.qty, unitPrice: l.openPrice ? l.unitPrice : undefined, lineDiscount: l.lineDiscount,
          markdownLotId: l.md ? l.md.lotId : undefined, markdownQty: l.md ? l.md.qty : undefined };
      })
    };
    api('commitSale', S.token, sale).then(function (rc) {
      paid = true;
      var cashIn = rc.payMethod === 'split' ? round2(rc.received - rc.payments.qr - rc.payments.transfer) : rc.received;
      cdPublish('done', { method: rc.payMethod === 'split' ? (rc.payments.cash > 0 ? 'cash' : 'qr') : rc.payMethod, total: rc.total, received: cashIn, change: rc.change, split: rc.payMethod === 'split' ? rc.payments : null });
      closeModal();
      var print = $('#autoprint', m).checked;
      newCart();
      renderCartOnly();
      if (rc.payMethod === 'cash' || rc.payMethod === 'split' && rc.payments.cash > 0) openDrawer(true);
      showReceipt(rc, print);
    }).catch(function (e) { submitting = false; fail(e); });
  };
  $('[data-x=ok]', m).onclick = submit;
  $('[data-x=cancel]', m).onclick = function () { closeModal(); };
  m.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  update();
  if (initial === 'qr') { var qb = $('#pm button[data-m=qr]', m); if (qb) qb.click(); }
}

function maskPP(id) { id = String(id || ''); return id.length > 4 ? id.slice(0, 3) + 'x'.repeat(id.length - 6) + id.slice(-3) : id; }

function showReceipt(rc, autoPrint) {
  var m = openModal('<header><h1>บันทึกแล้ว · ' + esc(rc.billNo) + '</h1></header><div class="body">' +
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
    (rc.discount ? '<tr><td>รวม</td><td style="text-align:right">' + money(rc.subtotal) + '</td></tr><tr><td>ส่วนลด</td><td style="text-align:right">-' + money(rc.discount) + '</td></tr>' : '') +
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
    var ret = paid.reduce(function (a, r) { return a + (r.returnedTotal || 0); }, 0);
    $('#bsum').textContent = paid.length + ' บิล · ฿' + money(paid.reduce(function (a, r) { return a + r.total; }, 0)) + (ret ? ' · คืน ฿' + money(ret) : '');
    tb.innerHTML = rows.length ? rows.map(function (r) {
      return '<tr class="click" data-act="billDetail" data-no="' + esc(r.billNo) + '"><td class="num">' + esc(r.billNo) + '</td><td>' + timeOf(r.createdAt) +
        '</td><td class="r num">' + r.itemsCount + '</td><td class="r num">' + money(r.total) + '</td><td>' + payName(r.payMethod) +
        '</td><td>' + esc(r.cashier) + '</td><td>' + (r.status === 'VOID' ? '<span class="tag warn">ยกเลิก</span>'
          : r.returnedTotal >= r.total && r.total > 0 ? '<span class="tag gray">คืนทั้งบิล</span>'
          : r.returnedTotal > 0 ? '<span class="tag amber">คืนบางส่วน −' + money(r.returnedTotal) + '</span>' : '<span class="tag green">ปกติ</span>') + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="muted">ไม่มีบิล</td></tr>';
  }).catch(fail);
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
      (rc.status !== 'VOID' && S.isCounter && rc.lines.some(function (l) { return l.qty > l.returnedQty; }) ? '<button class="btn" data-x="return">คืนสินค้า</button>' : '') +
      (rc.status !== 'VOID' && S.isCounter && !rc.returnedTotal ? '<button class="btn warn" data-x="void">ยกเลิกบิล</button>' : '') +
      '<button class="btn primary" data-x="close">ปิด</button></footer>', { wide: false });
    $('[data-x=print]', m).onclick = function () { printReceipt(rc); };
    $('[data-x=close]', m).onclick = function () { closeModal(); };
    var rb = $('[data-x=return]', m);
    if (rb) rb.onclick = function () { closeModal(); returnModal(rc); };
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

var RETURN_REASONS = ['ลูกค้าเปลี่ยนใจ', 'สินค้าชำรุด', 'คิดเงินผิด', 'หมดอายุ'];

/** Partial return: pick quantities per line, refund by cash (from this shift's drawer) or transfer. */
function returnModal(rc) {
  var st = { uid: 'R' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), q: {}, method: S.shift ? 'cash' : 'transfer', restock: true, busy: false };
  var sumLT = rc.lines.reduce(function (a, l) { return a + l.lineTotal; }, 0);
  var billDisc = round2(rc.discount - rc.lines.reduce(function (a, l) { return a + l.lineDiscount; }, 0));
  var refundOf = function (l, q) { var net = sumLT ? l.lineTotal - billDisc * l.lineTotal / sumLT : 0; return round2(net * q / l.qty); };
  var m = openModal('<header><h1>คืนสินค้า · บิล ' + esc(rc.billNo) + '</h1><span class="muted">' + dateTime(rc.createdAt) + '</span></header>' +
    '<div class="body" style="gap:12px"><div class="su-lines" id="rt-lines"></div>' +
    (billDisc > 0 ? '<div class="muted" style="font-size:13px">บิลนี้มีส่วนลดท้ายบิล ฿' + money(billDisc) + ' — เงินคืนหักส่วนลดตามสัดส่วนแล้ว</div>' : '') +
    '<div class="field"><label>คืนเงินเป็น</label><div class="seg-sm" id="rt-m"><button data-m="cash"' + (S.shift ? '' : ' disabled title="ต้องเปิดกะก่อน"') + '>เงินสด (จากลิ้นชัก)</button><button data-m="transfer">โอนคืน</button></div></div>' +
    '<label class="checkrow"><input type="checkbox" id="rt-restock" checked> นำของกลับเข้าสต็อก (ของยังขายได้) — เครื่องดื่มชง/สูตรผสมไม่คืนสต็อก</label>' +
    '<div class="field"><label for="rt-why">เหตุผล</label><input id="rt-why" maxlength="100" autocomplete="off" placeholder="เช่น ลูกค้าซื้อเกิน">' +
    '<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px">' + RETURN_REASONS.map(function (r) {
      return '<button type="button" class="chip" data-why="' + r + '" style="height:32px;font-size:13px;padding:0 12px">' + r + '</button>';
    }).join('') + '</div></div></div>' +
    '<footer><span class="grow"><span class="muted" style="font-size:13px">คืนเงิน</span> <b class="num warn-text" id="rt-total" style="font-size:22px">฿0.00</b></span>' +
    '<button class="btn" data-x="no">ยกเลิก</button><button class="btn primary" data-x="ok">บันทึกคืนสินค้า</button></footer>');
  var draw = function () {
    $('#rt-lines', m).innerHTML = rc.lines.map(function (l) {
      var left = l.qty - l.returnedQty, q = st.q[l.lineNo] || 0;
      return '<div class="su-line"><div><b>' + esc(l.name) + '</b> <span class="muted">' + esc(l.unitName) + '</span><div class="muted" style="font-size:12px">ซื้อ ' + l.qty +
        (l.returnedQty ? ' · คืนแล้ว ' + l.returnedQty : '') + ' · ' + money(l.lineTotal) + ' บาท</div></div>' +
        (left > 0 ? '<div class="row" style="gap:10px"><span class="num muted" style="font-size:13px">' + (q ? '−' + money(refundOf(l, q)) : '') + '</span><div class="qty"><button type="button" data-l="' + l.lineNo + '" data-d="-1" aria-label="ลด">−</button>' +
          '<span class="n num">' + q + '</span><button type="button" data-l="' + l.lineNo + '" data-d="1" aria-label="เพิ่ม">+</button></div></div>' : '<span class="tag gray">คืนครบแล้ว</span>') + '</div>';
    }).join('');
    var total = rc.lines.reduce(function (a, l) { return a + (st.q[l.lineNo] ? refundOf(l, st.q[l.lineNo]) : 0); }, 0);
    var all = rc.lines.every(function (l) { return (st.q[l.lineNo] || 0) + l.returnedQty >= l.qty; });
    if (all) total = round2(rc.total - (rc.returnedTotal || 0));
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
      if (t.getAttribute('data-why') === 'สินค้าชำรุด' || t.getAttribute('data-why') === 'หมดอายุ') $('#rt-restock', m).checked = false;
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
        restock: $('#rt-restock', m).checked, reason: why, approvalId: id }).then(function (r) {
        closeModal();
        if (r.refundMethod === 'cash') openDrawer(true);
        toast('คืนสินค้าแล้ว ' + r.returnNo + ' · คืนเงิน ฿' + money(r.total) + (r.refundMethod === 'cash' ? ' (เงินสด)' : ' (โอน)'));
        loadBills(); reloadCatalog();
      });
    }).catch(function (e) { st.busy = false; fail(e); });
  };
  draw();
}

/* =================================================================== */
/* Products                                                            */
/* =================================================================== */

function renderProducts() {
  var owner = S.user.role === 'owner';
  var cats = categories().map(function (c) { return '<option ' + (S.prodFilter.cat === c ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('');
  return '<div class="page"><div class="prod">' +
    '<section class="card prod-list"><div class="prod-tools">' +
    '<label class="sr" for="pq">ค้นหาสินค้า</label><input id="pq" class="grow" placeholder="ค้นหา ชื่อ, EAN, SKU, PLU" value="' + esc(S.prodFilter.q) + '" data-input="prodQ" style="min-width:180px">' +
    '<label class="sr" for="pcat">หมวด</label><select id="pcat" data-change="prodCat" style="width:170px"><option value="">ทุกหมวด</option>' + cats + '</select>' +
    (owner ? '<button class="btn sm" data-act="importCsv" style="height:40px">นำเข้า CSV</button>' +
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

  box.innerHTML = '<fieldset class="ed-body" style="border:0;margin:0;min-width:0" ' + (owner ? '' : 'disabled') + '>' +
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
      '<div class="row" style="align-items:flex-end"><span class="key" style="width:120px;height:104px;flex:0 0 120px;cursor:default"><span class="ic" style="background:' + c[0] + ';color:' + c[1] + '">' + iconHtml(p) + '</span>' +
      '<span class="nm" style="font-size:13px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + esc(p.name || 'ชื่อสินค้า') + '</span><span class="pr" style="font-size:13px">' + (p.openPrice ? 'ราคาเปิด' : '฿' + money(p.price)) + '</span></span>' +
      '<div class="col grow" style="gap:8px"><div class="field"><label for="e-quickKeyGroup">หมวดปุ่ม</label><input id="e-quickKeyGroup" data-ef="quickKeyGroup" list="e-grplist" value="' + esc(p.quickKeyGroup) + '" placeholder="เช่น เครื่องดื่มชง" style="height:36px"></div>' +
      '<datalist id="e-grplist">' + Object.keys(groups).map(function (g) { return '<option value="' + esc(g) + '">'; }).join('') + '</datalist>' +
      '<div class="field"><label for="e-quickKeyOrder">ลำดับบนจอ</label><input id="e-quickKeyOrder" data-ef="quickKeyOrder" type="number" value="' + esc(p.quickKeyOrder || '') + '" style="height:36px;width:90px"></div></div></div>' +
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
    '<input id="rscan" autocomplete="off" placeholder="สแกนบาร์โค้ดชิ้น / แพ็ค / ลัง หรือพิมพ์ชื่อสินค้า"></div><div id="rsug"></div></div>' +
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
  return '<div class="page" style="flex-direction:column"><div class="kpis" id="skpi"></div>' +
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
  box.innerHTML = stockCats() + '<div class="row stk-tools"><label class="sr" for="sq">ค้นหา</label><input id="sq" placeholder="ค้นหาสินค้า" value="' + esc(S.stockFilter.q) + '" data-input="stockQ" class="grow">' +
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
    '<input id="cscan" class="grow" autocomplete="off" placeholder="สแกนบาร์โค้ด = +1 (สแกนแพ็ค = +12) หรือพิมพ์จำนวนในช่องนับได้">' +
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
    (s.cashRefunds ? row('คืนเงินลูกค้า (เงินสด)', '−' + money(s.cashRefunds)) : '') +
    '<hr style="border:0;border-top:1px solid var(--line)">' + row('ต้องมีในลิ้นชัก', money(s.expectedCash), true) +
    '<div class="muted" style="font-size:14px;margin-top:6px">QR ' + money(s.qrSales) + ' · โอน ' + money(s.transferSales) + ' · รวมขาย ' + money(s.totalSales) +
    '<br>' + s.billCount + ' บิล · ยกเลิก ' + s.voidCount + ' · ส่วนลด ' + money(s.discount) +
    (s.returnCount ? '<br>คืนสินค้า ' + s.returnCount + ' ครั้ง · เงินสด ' + money(s.cashRefunds) + ' · โอนคืน ' + money(s.otherRefunds) : '') + '</div>';
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
      }).join('') + '<div class="muted" style="margin-top:8px">ส่วนลดรวม ฿' + money(r.discount) + ' · ยกเลิก ' + r.voidCount + ' บิล (฿' + money(r.voidTotal) + ')' +
        (r.returnCount ? ' · คืนสินค้า ' + r.returnCount + ' ครั้ง (฿' + money(r.refundTotal) + ') — ยอดขายหักคืนแล้ว' : '') + '</div></div>' +
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
    f('billPrefix', 'คำนำหน้าเลขบิล', 'เว้นว่างได้') +
    '<h2 style="margin:8px 0 0">จอลูกค้า</h2>' + f('customerWelcome', 'ข้อความต้อนรับ', 'ยินดีต้อนรับค่ะ') + f('shopHours', 'เวลาเปิด–ปิด', 'เช่น เปิดทุกวัน 06:00–22:00') +
    f('customerPromoTitle', 'โปรโมชั่น (หัวข้อ)', 'เว้นว่าง = ไม่แสดง') + f('customerPromoText', 'โปรโมชั่น (รายละเอียด)', 'เช่น ซื้อ 2 ขวด 25 บาท') +
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
  selLine: function (el, e) { if (e.target.closest('.qty, .ldisc, .mdchip')) return; S.cart.sel = Number(el.getAttribute('data-i')); renderCartOnly(); },
  qty: function (el) { changeQty(Number(el.getAttribute('data-i')), Number(el.getAttribute('data-d'))); },
  billDiscount: function () { askDiscount('bill'); },
  lineDisc: function (el) { S.cart.sel = Number(el.getAttribute('data-i')); askDiscount('line'); },
  holdBill: holdBill,
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
      api('cashMove', S.token, type, $('#cm-amt', m).value, $('#cm-why', m).value).then(function () {
        closeModal(); toast(type === 'IN' ? 'บันทึกเงินเข้าแล้ว' : 'บันทึกเงินออกแล้ว'); openDrawer(true);
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
  selProduct: function (el) { selectProduct(el.getAttribute('data-sku')); },
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
  var ed = e.target.closest('[data-ed]');
  if (ed && !ed.disabled && !topModal()) { edClick(ed); return; }
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
  if (t.hasAttribute('data-ef') || t.hasAttribute('data-ec') || t.hasAttribute('data-ecc') || t.id === 'e-comp') edInput(t);
  if (t.hasAttribute('data-rc') || t.hasAttribute('data-rch')) rcInput(t);
  if (t.id === 'rscan') drawRcSuggest(/^\d{6,}$/.test(t.value.trim()) ? '' : t.value);
  var k = t.getAttribute('data-input');
  if (k === 'prodQ') { S.prodFilter.q = t.value; renderProductRows(); }
  if (k === 'stockQ') { S.stockFilter.q = t.value; renderStockRows(); }
  if (t.hasAttribute('data-cnt')) cntSet(t.getAttribute('data-cnt'), t.value);
  if (t.hasAttribute('data-cnt-note')) { cntDraft().note = t.value; cntSave(); }
  if (t.id === 'wo-q') woSuggest(t.value);
  if (t.hasAttribute('data-xq') && S.expSel) { S.expSel.found = t.value; }
  if (t.hasAttribute('data-wo-qty') && S.wo) { S.wo.qty = t.value; var p0 = S.idx.bySku[S.wo.sku]; var e0 = $('#wo-est'); if (e0) e0.textContent = '฿' + money(p0 ? (Number(t.value) || 0) * p0.cost : 0); }
});

document.addEventListener('change', function (e) {
  var t = e.target, k = t.getAttribute('data-change');
  if (k === 'billsDay') { S.billsDay = t.value; loadBills(); }
  if (k === 'reportDay') { S.reportDay = t.value; loadReport(); }
  if (k === 'prodCat') { S.prodFilter.cat = t.value; renderProductRows(); }
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

/* Auto-lock when idle with an empty cart. */
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
