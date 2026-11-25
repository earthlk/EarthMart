// Phone layout (non-counter device, 390 px): bottom tabs, stock sub-tabs, product editor sheet, camera scanning.
'use strict';
const fs = require('fs'), http = require('http'), path = require('path');
const T0 = __dirname + '/';
const { chromium } = require('playwright');
const { makeContext } = require(T0 + 'gasmock');
const WEB = path.join(T0, '..', 'web');
const API = 'https://script.google.com/macros/s/TESTDEPLOY/exec';
const OUT = path.join(__dirname, 'shots');
const assert = require('assert');
const g = makeContext(); g.setup();
const KEY = g.__props.API_KEY;
g.createOwner('เอิร์ธ', '1234');
const call = (fn, ...a) => JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ key: KEY, fn, args: a }) } }).getContent()).data;
const oid = call('status').users[0].userId;
const T = call('login', oid, '1234', 'Dcounter1').token;
call('registerDevice', T, 'Dcounter1', 'เครื่อง 1');
call('saveSettings', T, { promptPayId: '0812345678', shopName: 'EarthMart ปั๊ม' });
call('importProducts', T, ['sku,name,category,type,unit,cost,price,minStock,openingStock,barcode,barcodeUnit,multiplier,barcodePrice,quickKey,quickKeyGroup,openPrice,plu',
  'W0001,น้ำดื่ม 600 มล.,เครื่องดื่ม,barcode,ขวด,4.2,7,48,30,8851234567890,ชิ้น,1,,,,,',
  'W0001,,,,,,,,,8851234567906,แพ็ค,12,80,,,,',
  'W0002,โซดา 325 มล.,เครื่องดื่ม,barcode,ขวด,7.1,12,24,60,8851234567001,ชิ้น,1,,,,,',
  'S0001,ขนมปังไส้สังขยา,ขนม,barcode,ชิ้น,10,15,5,3,8850000000011,ชิ้น,1,,,,,',
  'D0101,น้ำแข็งแก้ว,เครื่องดื่มชง,nobarcode,แก้ว,1.65,5,0,,,,,,y,เครื่องดื่มชง,,101'].join('\n'));
call('openShift', T, 500, '');
for (let i = 0; i < 6; i++) call('commitSale', T, { saleUid: 'X' + i, payMethod: i % 2 ? 'qr' : 'cash', received: 100, lines: [{ sku: 'W0001', qty: 2 + i }, { sku: 'S0001', qty: 1 }] });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(WEB, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/$/, '/index.html'));
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': (types[path.extname(f)] || 'application/octet-stream') + ';charset=utf-8' }); res.end(fs.readFileSync(f));
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const SITE = 'http://localhost:' + server.address().port + '/';
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.addInitScript(() => {
    localStorage.setItem('em_device', 'Dphone0001');
    // Fake camera + barcode detector: the first detect() call "sees" the water bottle.
    window.__det = ['8851234567890'];
    window.BarcodeDetector = class { constructor() {} detect() { const c = window.__det.shift(); return Promise.resolve(c ? [{ rawValue: c }] : []); } };
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 48;
    navigator.mediaDevices.getUserMedia = async () => {
      const x = canvas.getContext('2d'); let n = 0;
      setInterval(() => { x.fillStyle = n++ % 2 ? '#333' : '#555'; x.fillRect(0, 0, 64, 48); }, 100);
      return canvas.captureStream(10);
    };
  });
  await ctx.route(API + '*', r => r.fulfill({ status: 200, contentType: 'application/json', body: g.doPost({ postData: { contents: r.request().postData() } }).getContent(), headers: { 'access-control-allow-origin': '*' } }));
  await ctx.route(/fonts\.g/, r => r.fulfill({ contentType: 'text/css', body: '' }));
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });
  await page.goto(SITE + '#connect=' + encodeURIComponent(Buffer.from(JSON.stringify({ url: API, key: KEY })).toString('base64')));
  await page.waitForSelector('.login');
  for (const d of '1234') await page.click('.pinpad [data-k="' + d + '"]');

  // Home: today's sales, shortcuts, counter-only rows locked
  await page.waitForSelector('.mhome');
  await page.waitForSelector('#mtoday b:has-text("279.00")');
  assert.strictEqual(await page.locator('.tabbar button').count(), 5, 'owner has 5 tabs');
  assert.ok(!(await page.$('#scan')), 'no selling on a phone');
  assert.strictEqual(await page.locator('.mlock').count(), 4, 'counter-only actions shown as locked');
  await shot('m1-home');

  // Stock: sub-tabs, low-stock list, count with the camera
  await page.click('.tabbar [data-v=stock]');
  await page.waitForSelector('.mseg button.on:has-text("คงเหลือ")');
  await page.waitForSelector('#srows .stk-grid');
  await shot('m2-stock');
  await page.click('.mseg [data-t=count]');
  await page.waitForSelector('#cscan');
  await page.click('[data-act=camScan][data-for=cscan]');
  await page.waitForSelector('#camlast:has-text("น้ำดื่ม 600 มล.")');
  await shot('m3-camera');
  await page.click('.modal [data-x=done]');
  assert.strictEqual(await page.inputValue('[data-cnt=W0001]'), '1', 'camera scan counted one bottle');
  await shot('m4-count');
  await page.click('.mseg [data-t=receive]');
  await page.waitForSelector('#rscan');
  await shot('m5-receive');
  await page.click('.mseg [data-t=expiry]');
  await page.waitForSelector('#xrows');
  await shot('m6-expiry');

  // Products: list, editor opens as a full-screen sheet, back
  await page.click('.tabbar [data-v=products]');
  await page.waitForSelector('#prows .prod-grid');
  await page.evaluate(() => { window.__det = ['8851234567001']; });
  await page.click('[data-act=camScan][data-for=pq]');
  await page.waitForFunction(() => document.querySelector('#pq').value === '8851234567001');
  await page.waitForFunction(() => document.querySelectorAll('#prows .prod-grid').length === 1);
  await page.click('#prows .prod-grid');
  await page.waitForSelector('.prod.editing .m-edbar:has-text("โซดา")');
  await shot('m7-product');
  await page.click('[data-act=edClose]');
  await page.waitForSelector('.prod:not(.editing)');

  // Bills, reports, settings, bulk price from home
  assert.ok(!(await page.$('.tabbar [data-v=bills]')), 'owner: no บิล tab (it sits under รายงาน)');
  await page.click('.tabbar [data-v=reports]');
  await page.waitForSelector('canvas#c-trend');
  await shot('m9-reports');
  await page.click('.mseg [data-v=bills]');
  await page.waitForSelector('#bills tr');
  assert.ok(await page.$('.tabbar [data-v=reports].on'), 'บิล lights the รายงาน tab');
  await shot('m8-bills');
  // Accounting sits under รายงาน as a second segment
  await page.click('.tabbar [data-v=acct]');
  await page.waitForSelector('.acc-flow');
  const accRight = () => page.evaluate(() => Math.max(...[...document.querySelectorAll('.acc-page *')].filter(e => e.offsetParent && !e.closest('.acc-tabs,.seg-sm,.table')).map(e => Math.round(e.getBoundingClientRect().right))));
  const accW = await accRight();
  assert.ok(accW <= 392, 'accounting fits the phone width (' + accW + ')');
  await shot('m9b-acct');
  for (const t of ['expenses', 'debts', 'wallets', 'pl', 'tax']) {
    await page.click('.acc-tabs [data-t=' + t + ']');
    await page.waitForFunction(() => !document.querySelector('#acc-body .skel'));
    await page.waitForTimeout(150);
    const w = await accRight();
    assert.ok(w <= 392, 'acct ' + t + ' fits the phone width (' + w + ')');
    await shot('m9c-acct-' + t);
  }
  await page.click('.tabbar [data-v=home]');
  // expense: four ways to pay, drawer first
  await page.click('[data-act=mExpense]');
  await page.waitForSelector('.modal input[name=exfrom]');
  const ways = await page.$$eval('.modal input[name=exfrom]', a => a.map(i => i.parentElement.textContent.trim()));
  assert.deepStrictEqual(ways, ['เงินในลิ้นชัก', 'บัญชีธนาคาร', 'เงินสดร้าน', 'ค้างจ่าย'], 'expense pay choices: ' + ways.join(', '));
  assert.ok(await page.isVisible('.modal .lbl:has-text("วิธีจ่าย")'), 'labelled วิธีจ่าย');
  await shot('m11-expense');
  await page.click('.modal [data-x=no]');
  await page.click('[data-act=go][data-v=settings]');
  await page.waitForSelector('.set-page');
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.set-page')).gridTemplateColumns.split(' ').length);
  assert.strictEqual(cols, 1, 'settings in one column');
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(sw <= 392, 'settings: no sideways page scroll (' + sw + ')');
  await shot('m10-settings');
  // internet: whitelist by MAC from the phone (sent to the router later by the counter PC)
  await page.click('.set-nav [data-t=net]');
  await page.waitForSelector('#nq-mac');
  await page.fill('#nq-mac', '3c:22:fb:01:02:03');
  await page.fill('#nq-name', 'มือถือพนักงาน');
  await page.click('[data-form=netQueueAdd] button');
  await page.waitForSelector('.net-q:has-text("มือถือพนักงาน") .net-wait');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 392, 'whitelist card fits the phone');
  await shot('m10b-net-phone');
  await page.click('.tabbar [data-v=home]');
  await page.click('[data-act=mBulk]');
  await page.waitForSelector('#bulk-rows');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(wide <= 392, 'no sideways page scroll (' + wide + ')');

  assert.deepStrictEqual(errs, [], 'no page errors');
  await b.close(); server.close();
  console.log('Mobile test passed');
})().catch(e => { console.error(e); process.exit(1); });
