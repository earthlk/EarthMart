// Refresh opens straight from the saved copy, fresh data arrives quietly, pages show their last result at once,
// and the background sync runs on its timer / on tap without the loading overlay.
'use strict';
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const { makeContext } = require('./gasmock');

const WEB = path.join(__dirname, '..', 'web');
const API = 'https://script.google.com/macros/s/TESTDEPLOY/exec';
const DEV = 'Dcounter000000000011';
const SHOTS = path.join(__dirname, 'shots');

const g = makeContext();
g.setup();
const KEY = g.__props.API_KEY;
g.createOwner('เอิร์ธ', '1234');
const call = (fn, ...args) => JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ key: KEY, fn, args }) } }).getContent());
const ok = (fn, ...args) => { const r = call(fn, ...args); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
const ownerId = ok('status').users[0].userId;
const T = ok('login', ownerId, '1234', DEV).token;
ok('registerDevice', T, DEV, 'เครื่อง 1');
ok('importProducts', T, [
  'sku,name,category,type,unit,cost,price,minStock,openingStock,barcode,barcodeUnit,multiplier',
  'W0001,น้ำดื่ม 600 มล.,เครื่องดื่ม,barcode,ขวด,4.2,7,48,50,8851234567890,ชิ้น,1'
].join('\n'));
ok('openShift', T, 500, '', { floatSource: 'owner' });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(WEB, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/$/, '/index.html'));
  if (!f.startsWith(WEB) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': (types[path.extname(f)] || 'application/octet-stream') + ';charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const SITE = 'http://localhost:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(([dev]) => { localStorage.setItem('em_device', dev); window.EM_TEST = true; window.EM_NO_SW = true; window.print = () => {}; }, [DEV]);

  let delay = 0; const seen = [];
  await ctx.route(API + '*', async route => {
    const body = route.request().postData();
    seen.push(JSON.parse(body).fn);
    if (delay) await new Promise(r => setTimeout(r, delay));
    const out = g.doPost({ postData: { contents: body } });
    return route.fulfill({ status: 200, contentType: 'application/json', body: out.getContent(), headers: { 'access-control-allow-origin': '*' } });
  });
  await ctx.route(/fonts\.g/, route => route.fulfill({ contentType: 'text/css', body: '' }));
  const shot = n => page.screenshot({ path: path.join(SHOTS, n + '.png') });

  try {
    // 1. First visit online: normal sign-in
    const link = Buffer.from(JSON.stringify({ url: API, key: KEY })).toString('base64');
    await page.goto(SITE + '#connect=' + encodeURIComponent(link));
    await page.waitForSelector('.login');
    for (const d of '1234') await page.click('.pinpad [data-k="' + d + '"]');
    await page.waitForSelector('#scan');
    await page.waitForFunction(() => /ซิงก์/.test(document.getElementById('syncpill').textContent));

    // a page visited once is cached
    await page.click('[data-act=go][data-v=stock]');
    await page.waitForSelector('#srows .stk-grid');
    await page.click('[data-act=go][data-v=sale]');
    await page.waitForSelector('#scan');

    // 2. Refresh with a slow server: the sale screen is up long before the server answers
    delay = 2500; seen.length = 0;
    const t0 = Date.now();
    await page.reload();
    await page.waitForSelector('#scan');
    const openMs = Date.now() - t0;
    assert.ok(openMs < 2000, 'refresh opens from the saved copy (' + openMs + ' ms)');
    assert.ok(!(await page.$('.login')), 'no sign-in again on refresh');
    assert.match(await page.textContent('#syncpill'), /กำลังซิงก์/, 'shows it is fetching quietly');
    assert.ok(!(await page.$('#saving.show')), 'no blocking overlay while reading');
    await shot('c1-instant-refresh');

    // price changed on another device meanwhile → arrives without touching the screen
    const p = ok('bootstrap', T).products.find(x => x.sku === 'W0001');
    const bc = ok('bootstrap', T).barcodes.filter(b => b.sku === 'W0001');
    ok('saveProduct', T, Object.assign({}, p, { price: 9 }), bc, []);
    await page.waitForFunction(() => window.__S.idx.bySku.W0001 && window.__S.idx.bySku.W0001.price === 9, null, { timeout: 15000 });
    await page.waitForFunction(() => /ซิงก์เมื่อสักครู่/.test(document.getElementById('syncpill').textContent));
    assert.ok(seen.includes('status') && seen.includes('bootstrap'), 'refreshed in the background');

    // 3. Pages show their last result at once (skeleton never stays), then refresh
    delay = 1500;
    await page.click('[data-act=go][data-v=stock]');
    await page.waitForSelector('#srows .stk-grid', { timeout: 500 });
    assert.match(await page.textContent('#srows'), /น้ำดื่ม/, 'stock shows the saved copy straight away');
    delay = 0;

    // 4. Tap the sync pill: quiet round, no saving overlay; typing is never redrawn away
    await page.click('[data-act=go][data-v=sale]');
    await page.waitForSelector('#scan');
    await page.fill('#scan', '885');
    seen.length = 0;
    delay = 600;
    await page.click('#syncpill');
    assert.ok(!(await page.$('#saving.block')), 'sync never blocks the screen');
    await page.waitForFunction(() => /ซิงก์เมื่อสักครู่/.test(document.getElementById('syncpill').textContent));
    assert.ok(seen.includes('bootstrap'), 'sync pulled the catalog');
    assert.strictEqual(await page.inputValue('#scan'), '885', 'what was typed is kept');
    delay = 0;

    // 5. Timer: 1-minute auto sync set from settings
    ok('saveSettings', T, { syncMinutes: '1' });
    await page.evaluate(() => { window.__S.settings.syncMinutes = '1'; });
    await page.clock.install();
    await page.evaluate(() => window.__startAutoSync());
    seen.length = 0;
    await page.clock.runFor(61000);
    await page.waitForFunction(() => true);
    await new Promise(r => setTimeout(r, 500));
    assert.ok(seen.includes('bootstrap'), 'timer fires a background sync');

    // 5b. Opening stock started on another device: this one locks at the next sync, unlocks after cancel
    await page.clock.uninstall?.();
    ok('startOpening', T);
    await page.click('#syncpill');
    await page.waitForSelector('.op-main, .op-intro', { timeout: 15000 });
    assert.deepStrictEqual(await page.$$eval('header nav button', a => a.map(x => x.textContent)), ['ตั้งยอดเปิดร้าน'], 'locked by another device');
    ok('cancelOpening', T);
    await page.click('#syncpill');
    await page.waitForFunction(() => document.querySelectorAll('header nav button').length > 5, null, { timeout: 15000 });

    // 6. Signed out elsewhere (token no longer valid): refresh lands on sign-in
    await page.evaluate(() => sessionStorage.setItem('em_token', 'nope') || localStorage.setItem('em_token', 'nope'));
    await page.evaluate(() => { try { sstore('em_token', 'nope'); } catch (e) {} });
    await page.reload();
    await page.waitForSelector('.login', { timeout: 15000 });

    assert.deepStrictEqual(errors, [], 'no page errors');
    console.log('Cache & sync test passed');
  } catch (e) {
    try { await shot('c-fail'); console.error(errors, await page.evaluate(() => document.body.innerText.slice(0, 300))); } catch (x) { /* ignore */ }
    throw e;
  } finally {
    await browser.close(); server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
