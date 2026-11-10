/*
 * Customer display (จอลูกค้า) — a second screen on the same PC.
 *
 * Open  <site>/?page=customer  in its own window on the 2nd monitor (kiosk / full screen).
 * The POS window publishes the bill state over BroadcastChannel (no network, < 0.5 s);
 * a localStorage 'storage' event is the fallback for browsers without BroadcastChannel.
 * Always light theme — a QR on a dark background does not scan reliably.
 *
 * States: idle → scan (every change) → pay (QR / amount) → done (change) → idle after 5 s.
 * Cancel / hold → idle at once. A reloaded display asks for the latest state ('hello').
 */
(function () {
  'use strict';

  var NAME = 'earthmart-customer';
  var KEY = 'em_cd_msg';
  var bc = null;
  try { bc = new BroadcastChannel(NAME); } catch (e) { bc = null; }

  function post(msg) {
    msg.t = Date.now();
    if (bc) { try { bc.postMessage(msg); return; } catch (e) { /* fall through */ } }
    try { localStorage.setItem(KEY, JSON.stringify(msg)); } catch (e) { /* ignore */ }
  }

  function listen(fn) {
    if (bc) bc.onmessage = function (e) { fn(e.data || {}); };
    window.addEventListener('storage', function (e) {
      if (e.key !== KEY || !e.newValue) return;
      try { fn(JSON.parse(e.newValue)); } catch (err) { /* ignore */ }
    });
  }

  /* ------------------------------ POS side ------------------------------ */

  var last = { mode: 'idle' };
  var lastAlive = 0;

  var pos = {
    /** Publish the bill state. Called by the POS on every change. */
    publish: function (state) {
      last = state;
      post({ type: 'state', state: state });
    },
    /** True when a display answered in the last 15 s. */
    connected: function () { return Date.now() - lastAlive < 15000; },
    open: function () {
      var url = location.pathname + '?page=customer';
      var w = window.open(url, 'em-customer', 'popup,width=1024,height=600');
      if (!w) return false;
      setTimeout(function () { pos.publish(last); }, 800);
      return true;
    },
    onStatus: null
  };

  function startPos() {
    listen(function (m) {
      if (m.type === 'hello' || m.type === 'alive') {
        var was = pos.connected();
        lastAlive = Date.now();
        if (m.type === 'hello') post({ type: 'state', state: last });
        if (!was && pos.onStatus) pos.onStatus(true);
      }
    });
    setInterval(function () { if (!pos.connected() && pos.onStatus) pos.onStatus(false); }, 15000);
  }

  /* ---------------------------- Display side ---------------------------- */

  function money(n) { return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var CSS = '' +
    'html,body{margin:0;height:100%;background:#F3F4F1;color:#1B1F1D;font-family:"IBM Plex Sans Thai",system-ui,sans-serif;overflow:hidden}' +
    '#cd{height:100vh;display:flex;font-size:min(2.2vw,3.6vh)}' +
    '.cd-brand{background:#1F6B45;color:#fff}.cd-soft{color:#D6EBDD}.cd-muted{color:#5B625E}' +
    '.cd-card{background:#fff;border:1px solid #DDE0DB;border-radius:1.2em}' +
    '.cd-row{display:flex;justify-content:space-between;gap:1em;padding:.65em 1.1em;border-bottom:1px solid #F0F1EE;font-size:1.05em}' +
    '.cd-row:last-child{border-bottom:0}.cd-num{font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '.cd-disc{color:#B45309}' +
    '.cd-qr{width:min(28vw,46vh);height:min(28vw,46vh);background:#fff;padding:.6em;border:2px solid #1B1F1D;border-radius:.6em;box-sizing:border-box}' +
    '.cd-qr svg{width:100%;height:100%;display:block}' +
    '.cd-hint{position:fixed;inset:auto 0 0 0;padding:.4em;text-align:center;font-size:.6em;color:#5B625E}' +
    '.cd-slide{flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;min-height:0}' +
    '.cd-sp{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.35em;text-align:center;padding:1.4em}' +
    '.cd-spic{width:3.4em;height:3.4em;border-radius:.8em;display:flex;align-items:center;justify-content:center}.cd-spic svg{width:60%;height:60%}' +
    '.cd-img{width:100%;height:100%;object-fit:contain;display:block}' +
    '.cd-dots{display:flex;justify-content:center;gap:.4em}.cd-dots span{width:.5em;height:.5em;border-radius:50%;background:#C9CEC9}.cd-dots span.on{background:#1F6B45}' +
    '.cd-hintbox{margin-top:1em;padding:.7em .9em;border-radius:.8em;background:#FFF7D6;color:#5A4500;font-weight:700;font-size:1em;line-height:1.3}';

  var S = { mode: 'idle', doneUntil: 0, timer: null };

  function view(st) {
    var shop = esc(st.shopName || 'EarthMart');
    if (st.mode === 'scan') {
      var lines = (st.lines || []).slice(-8);
      return '<section style="flex:1;padding:1.4em 1.4em 1.4em 1.6em;display:flex;flex-direction:column;gap:.8em;min-width:0">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:1.2em">รายการของคุณ</b><span class="cd-muted">' + shop + '</span></div>' +
        (st.last ? '<div style="background:#EEF6F1;border:2px solid #1F6B45;border-radius:.9em;padding:.8em 1.1em;display:flex;justify-content:space-between;align-items:center">' +
          '<div><div style="font-size:.7em;font-weight:600;color:#1F6B45">เพิ่งเพิ่ม</div><div style="font-size:1.5em;font-weight:700">' + esc(st.last.name) + '</div></div>' +
          '<div class="cd-num" style="font-size:1.7em;font-weight:700;color:#1F6B45">฿' + money(st.last.price) + '</div></div>' : '') +
        '<div class="cd-card" style="flex:1;overflow:hidden;display:flex;flex-direction:column">' +
        ((st.lines || []).length > lines.length ? '<div class="cd-row cd-muted" style="font-size:.8em">… อีก ' + ((st.lines.length) - lines.length) + ' รายการ</div>' : '') +
        lines.map(function (l) {
          return '<div class="cd-row"><span>' + esc(l.name) + ' × ' + l.qty + '</span><span class="cd-num">' + money(l.total) + '</span></div>' +
            (l.discount ? '<div class="cd-row cd-disc" style="font-size:.9em"><span>&nbsp;&nbsp;ส่วนลด</span><span class="cd-num">−' + money(l.discount) + '</span></div>' : '');
        }).join('') + '</div></section>' +
        '<section class="cd-brand" style="width:38%;box-sizing:border-box;padding:2em 1.6em;display:flex;flex-direction:column;justify-content:center;gap:.4em">' +
        '<div class="cd-soft" style="font-size:1.1em">ยอดรวม</div><div class="cd-num" style="font-size:' + (money(st.total).length > 7 ? 2.3 : 2.9) + 'em;font-weight:700;line-height:1.05">฿' + money(st.total) + '</div>' +
        '<div class="cd-soft">' + st.items + ' ชิ้น</div><div style="height:1px;background:#3F8A63;margin:1em 0"></div>' +
        '<div class="cd-soft" style="display:flex;justify-content:space-between"><span>ส่วนลด</span><span class="cd-num">฿' + money(st.discount) + '</span></div>' +
        (st.hint ? '<div class="cd-hintbox">' + esc(st.hint) + '</div>' : '') + '</section>';
    }
    if (st.mode === 'pay') {
      var qr = st.method === 'qr' && st.qr;
      return '<section style="width:40%;box-sizing:border-box;padding:1.6em;display:flex;flex-direction:column;gap:.7em">' +
        '<b style="font-size:1.1em">สรุปรายการ</b><div class="cd-card" style="overflow:hidden">' + (st.lines || []).slice(-6).map(function (l) {
          return '<div class="cd-row" style="font-size:.9em"><span>' + esc(l.name) + ' × ' + l.qty + '</span><span class="cd-num">' + money(l.total - (l.discount || 0)) + '</span></div>';
        }).join('') + '</div><div style="flex:1"></div>' +
        (st.discount ? '<div class="cd-muted">ส่วนลด ฿' + money(st.discount) + '</div>' : '') +
        '<div class="cd-muted" style="font-size:.9em">ยอดที่ต้องชำระ</div><div class="cd-num" style="font-size:3em;font-weight:700;color:#1F6B45;line-height:1.05">฿' + money(st.total) + '</div></section>' +
        '<section style="flex:1;padding:1.4em 1.6em 1.4em 0;display:flex"><div class="cd-card" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.7em;padding:1.2em;text-align:center">' +
        (qr ? '<b style="font-size:1.3em">สแกนจ่ายด้วยแอปธนาคาร</b><div class="cd-qr" id="cdqr"></div>' +
          (st.split ? '<div class="cd-num" style="font-size:1.6em;font-weight:700;color:#1F6B45">QR ฿' + money(st.split.qr) + '</div><div class="cd-muted">+ ' + esc(st.split.otherName || 'เงินสด') + ' ฿' + money(st.split.other) + '</div>' : '') +
          '<div><b>PromptPay' + (st.ppName ? ' · ' + esc(st.ppName) : '') + '</b><div class="cd-muted" style="font-size:.8em">ยอดถูกใส่ใน QR แล้ว ไม่ต้องพิมพ์เอง</div></div>'
          : '<b style="font-size:1.4em">' + (st.method === 'transfer' ? 'โอนเงิน' : 'ชำระด้วยเงินสด') + '</b><div class="cd-num" style="font-size:4em;font-weight:700;color:#1F6B45">฿' + money(st.total) + '</div>') +
        '</div></section>';
    }
    if (st.mode === 'done') {
      var card = function (k, v, hi) {
        return '<div class="cd-card" style="width:12em;padding:.9em 1.2em;' + (hi ? 'background:#EEF6F1;border:2px solid #1F6B45' : '') + '"><div class="' + (hi ? '' : 'cd-muted') + '" style="font-size:.85em;' +
          (hi ? 'font-weight:600;color:#1F6B45' : '') + '">' + k + '</div><div class="cd-num" style="font-size:1.7em;font-weight:700;' + (hi ? 'color:#1F6B45' : '') + '">฿' + money(v) + '</div></div>';
      };
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.1em">' +
        '<div style="width:4.4em;height:4.4em;border-radius:50%;background:#1F6B45;display:flex;align-items:center;justify-content:center">' +
        '<svg width="50%" height="50%" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
        '<div style="text-align:center"><div style="font-size:1.9em;font-weight:700">ชำระเงินเรียบร้อย</div><div class="cd-muted" style="font-size:1.1em">' + esc(st.thanks || 'ขอบคุณที่อุดหนุนค่ะ') + '</div></div>' +
        '<div style="display:flex;gap:.8em">' + card('ยอดรวม', st.total) + (st.method === 'cash' ? card('รับเงินมา', st.received) + card('เงินทอน', st.change, true) : card(st.method === 'qr' ? 'พร้อมเพย์' : 'โอน', st.total, true)) + '</div>' +
        '<div class="cd-muted" style="font-size:.75em">กลับหน้าหลักใน 5 วินาที</div></div>';
    }
    return '<section class="cd-brand" style="width:43%;box-sizing:border-box;padding:2.6em 2.2em;display:flex;flex-direction:column;justify-content:space-between">' +
      '<div><div style="font-size:2.6em;font-weight:700;line-height:1.1">' + shop + '</div><div class="cd-soft" style="font-size:1.1em;margin-top:.4em">' + esc(st.welcome || 'ยินดีต้อนรับค่ะ') + '</div></div>' +
      '<div class="cd-soft" style="font-size:.8em;line-height:1.6">' + (st.hours ? esc(st.hours) + '<br>' : '') + 'รับเงินสด · พร้อมเพย์ทุกธนาคาร</div></section>' +
      ((st.slides || []).length ? '<section style="flex:1;padding:2em;display:flex;flex-direction:column;gap:.6em;min-width:0"><div class="cd-card cd-slide" id="cdslide"></div>' +
        ((st.slides || []).length > 1 ? '<div class="cd-dots" id="cddots"></div>' : '') + '</section>' :
      '<section style="flex:1;padding:2em;display:flex"><div class="cd-card" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5em;text-align:center;padding:1.6em">' +
      (st.promoTitle ? '<div class="cd-muted" style="font-size:.7em;font-weight:600;letter-spacing:.08em">โปรโมชั่น</div><div style="font-size:1.6em;font-weight:700">' + esc(st.promoTitle) + '</div>' +
        '<div class="cd-muted" style="font-size:.95em;white-space:pre-line">' + esc(st.promoText || '') + '</div>'
        : '<div style="font-size:1.6em;font-weight:700">' + shop + '</div><div class="cd-muted">' + esc(st.welcome || 'ยินดีต้อนรับค่ะ') + '</div>') +
      '</div></section>');
  }

  /* ---- slideshow (idle) ---- */
  var urls = {};
  function slideImg(sl) {
    if (urls[sl.id]) return Promise.resolve(urls[sl.id]);
    if (!window.caches) return Promise.resolve('');
    return caches.open('em-slides').then(function (c) { return c.match(sl.key); }).then(function (hit) {
      return hit ? hit.blob().then(function (b) { urls[sl.id] = URL.createObjectURL(b); return urls[sl.id]; }) : '';
    }).catch(function () { return ''; });
  }
  function slideHtml(sl) {
    if (sl.kind === 'promo') {
      return '<div class="cd-sp"><div class="cd-muted" style="font-size:.7em;font-weight:600;letter-spacing:.08em">โปรโมชั่น</div>' +
        (sl.icon ? '<div class="cd-spic" style="background:' + esc(sl.bg) + ';color:' + esc(sl.fg) + '">' + sl.icon + '</div>' : '') +
        '<div style="font-size:1.5em;font-weight:700;line-height:1.2">' + esc(sl.title) + '</div>' +
        (sl.big ? '<div class="cd-num" style="font-size:2.6em;font-weight:700;color:#1F6B45;line-height:1.1">' + esc(sl.big) + '</div>' : '') +
        (sl.was ? '<div class="cd-muted" style="text-decoration:line-through">ปกติ ' + esc(sl.was) + '</div>' : '') +
        '<div class="cd-muted" style="font-size:.85em">' + esc(sl.sub || '') + (sl.when ? ' · ' + esc(sl.when) : '') + '</div></div>';
    }
    if (sl.kind === 'text') {
      return '<div class="cd-sp"><div class="cd-muted" style="font-size:.7em;font-weight:600;letter-spacing:.08em">โปรโมชั่น</div><div style="font-size:1.7em;font-weight:700">' + esc(sl.title) + '</div>' +
        '<div class="cd-muted" style="white-space:pre-line">' + esc(sl.sub || '') + '</div></div>';
    }
    return '<img class="cd-img" alt="' + esc(sl.title || '') + '" data-id="' + esc(sl.id) + '">';
  }
  function showSlide(st) {
    var box = document.getElementById('cdslide');
    var list = st.slides || [];
    if (!box || !list.length) return;
    S.slideIdx = S.slideIdx % list.length;
    var sl = list[S.slideIdx];
    box.innerHTML = slideHtml(sl);
    if (sl.kind === 'img') {
      slideImg(sl).then(function (u) {
        var img = box.querySelector('img');
        if (!img) return;
        if (u) img.src = u;
        else if (list.length > 1) { S.slideIdx++; showSlide(st); }   // image not on this device yet: skip it
        else box.innerHTML = '<div class="cd-sp cd-muted">' + esc(sl.title || '') + '</div>';
      });
    }
    var dots = document.getElementById('cddots');
    if (dots) dots.innerHTML = list.map(function (x, i) { return '<span class="' + (i === S.slideIdx ? 'on' : '') + '"></span>'; }).join('');
  }
  function startSlides(st) {
    clearInterval(S.slideTimer);
    var list = st.slides || [];
    var sig = JSON.stringify(list.map(function (x) { return x.kind + (x.id || x.title); }));
    if (sig !== S.slideSig) { S.slideSig = sig; S.slideIdx = 0; }
    S.slideIdx = S.slideIdx || 0;
    showSlide(st);
    if (list.length > 1) S.slideTimer = setInterval(function () { S.slideIdx = (S.slideIdx + 1) % list.length; showSlide(st); }, (st.slideSeconds || 8) * 1000);
  }

  function draw(st) {
    var root = document.getElementById('cd');
    root.innerHTML = view(st);
    if (st.mode === 'idle') startSlides(st); else clearInterval(S.slideTimer);
    var box = document.getElementById('cdqr');
    if (box && st.qr) {
      if (typeof qrcode !== 'function') { box.textContent = 'โหลดตัวสร้าง QR ไม่ได้'; return; }
      var q = qrcode(0, 'M'); q.addData(st.qr); q.make();
      box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    }
  }

  function onState(st) {
    st = st || { mode: 'idle' };
    var now = Date.now();
    clearTimeout(S.timer);
    if (st.mode === 'done') {
      S.doneUntil = now + 5000;
      S.idleInfo = st;
      S.timer = setTimeout(function () { S.doneUntil = 0; draw(Object.assign({}, S.idleInfo, { mode: 'idle' })); }, 5000);
    } else if (st.mode === 'idle' && now < S.doneUntil) {
      // keep showing the change; the timer returns to idle
      S.idleInfo = st;
      S.timer = setTimeout(function () { S.doneUntil = 0; draw(S.idleInfo); }, S.doneUntil - now);
      return;
    } else {
      S.doneUntil = 0;
    }
    S.mode = st.mode;
    draw(st);
  }

  function startDisplay() {
    document.title = 'EarthMart · จอลูกค้า';
    document.documentElement.className = '';
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    document.body.innerHTML = '<div id="cd"></div><div class="cd-hint" id="cdhint">ดับเบิลคลิกเพื่อเต็มจอ</div>';
    document.body.addEventListener('dblclick', function () {
      var el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
    });
    setTimeout(function () { var h = document.getElementById('cdhint'); if (h) h.remove(); }, 8000);
    draw({ mode: 'idle' });
    listen(function (m) { if (m.type === 'state') onState(m.state); });
    post({ type: 'hello' });
    setInterval(function () { post({ type: 'alive' }); }, 5000);
  }

  var isDisplay = /[?&]page=customer\b/.test(location.search);
  window.CustomerDisplay = { isDisplay: isDisplay, pos: pos, startDisplay: startDisplay, _view: view };
  if (!isDisplay) startPos();
})();
