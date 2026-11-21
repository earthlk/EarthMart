// Product photos: fetched in quiet batches (not one call each, not all at once), kept on the device for the next start.
'use strict';
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const { makeContext } = require('./gasmock');

const WEB = path.join(__dirname, '..', 'web');
const API = 'https://script.google.com/macros/s/TESTDEPLOY/exec';
const DEV = 'Dcounter000000000013';
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
const IMG = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-bytes').toString('base64');
for (let i = 1; i <= 30; i++) {
  const sku = ok('saveProduct', T, { name: 'สินค้า ' + i, price: 10, type: 'nobarcode', quickKey: true, category: 'ทดสอบ', quickKeyOrder: i }).sku;
  ok('uploadProductImage', T, sku, IMG);
}
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
  await page.addInitScript(([dev]) => { localStorage.setItem('em_device', dev); window.EM_TEST = true; window.EM_NO_SW = true; window.print = () => {}; }, [DEV]);
  const calls = []; let live = 0, peak = 0;
  await ctx.route(API + '*', async route => {
    const body = route.request().postData(), fn = JSON.parse(body).fn;
    calls.push(fn);
    if (/^productImage/.test(fn)) { live++; peak = Math.max(peak, live); await new Promise(r => setTimeout(r, 150)); live--; }
    const out = g.doPost({ postData: { contents: body } });
    return route.fulfill({ status: 200, contentType: 'application/json', body: out.getContent(), headers: { 'access-control-allow-origin': '*' } });
  });
  await ctx.route(/fonts\.g/, route => route.fulfill({ contentType: 'text/css', body: '' }));
  try {
    const link = Buffer.from(JSON.stringify({ url: API, key: KEY })).toString('base64');
    await page.goto(SITE + '#connect=' + encodeURIComponent(link));
    await page.waitForSelector('.login');
    for (const d of '1234') await page.click('.pinpad [data-k="' + d + '"]');
    await page.waitForSelector('.salekeys');
    // while photos are coming: the loading bar shows, and selling still works
    await page.waitForSelector('#busy', { timeout: 5000 });
    await page.click('.salekeys .key >> nth=0');
    await page.waitForSelector('#lines .line');
    assert.ok(!(await page.$('#saving.show')), 'no saving screen');
    await page.waitForFunction(() => document.querySelectorAll('.salekeys img.kimg').length === 30, null, { timeout: 20000 });
    await page.waitForFunction(() => !document.getElementById('busy'), null, { timeout: 10000 });
    const single = calls.filter(f => f === 'productImage').length, batches = calls.filter(f => f === 'productImages').length;
    assert.strictEqual(single, 0, 'no one-photo-per-call requests');
    assert.ok(batches >= 3 && batches <= 6, 'photos come in batches (' + batches + ' calls for 30)');
    assert.ok(peak <= 2, 'at most 2 photo calls at a time (peak ' + peak + ')');
    assert.ok(!(await page.$('#saving.show')), 'never blocks the screen');
    // next start: everything from this device
    await page.waitForTimeout(1500);
    calls.length = 0;
    await page.reload();
    await page.waitForSelector('.salekeys');
    await page.waitForFunction(() => document.querySelectorAll('.salekeys img.kimg').length === 30, null, { timeout: 10000 });
    await page.waitForTimeout(5000);   // past the background photo sync
    assert.strictEqual(calls.filter(f => /^productImage/.test(f)).length, 0, 'restart loads photos from the device, no server calls');
    assert.deepStrictEqual(errors, [], 'no page errors');
    console.log('Image loading test passed');
  } finally {
    await browser.close(); server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
