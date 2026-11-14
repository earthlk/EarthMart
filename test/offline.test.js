// Full offline: the counter keeps working with no internet, even after the page is reloaded.
// Real http server for web/ (so the service worker runs), Apps Script API routed into the mock backend.
'use strict';
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const { makeContext } = require('./gasmock');

const WEB = path.join(__dirname, '..', 'web');
const API = 'https://script.google.com/macros/s/TESTDEPLOY/exec';
const DEV = 'Dcounter000000000009';
const SHOTS = path.join(__dirname, 'shots');

const g = makeContext();
g.setup();
const KEY = g.__props.API_KEY;
g.createOwner('เอิร์ธ', '1234');
const call = (fn, ...args) => JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ key: KEY, fn, args }) } }).getContent()).data;
const ownerId = call('status').users[0].userId;
const T = call('login', ownerId, '1234', DEV).token;
call('registerDevice', T, DEV, 'เครื่อง 1');
call('saveSettings', T, { promptPayId: '0812345678', shopName: 'EarthMart ปั๊ม' });
call('addUser', T, 'มิว', 'cashier', '5678');
const mewId = call('listUsers', T).find(u => u.name === 'มิว').userId;
call('importProducts', T, [
  'sku,name,category,type,unit,cost,price,minStock,openingStock,barcode,barcodeUnit,multiplier',
  'W0001,น้ำดื่ม 600 มล.,เครื่องดื่ม,barcode,ขวด,4.2,7,48,50,8851234567890,ชิ้น,1',
  'S0001,ขนมปัง,ขนม,barcode,ชิ้น,10,15,0,0,8850000000011,ชิ้น,1'
].join('\n'));

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
  global.__fail = async () => { try { await page.screenshot({ path: path.join(SHOTS, 'o-fail.png') }); console.error('errors:', errors, await page.evaluate(() => document.body.innerText.slice(0, 400))); } catch (x) { console.error('no page', x.message); } };
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  var page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(([dev]) => { localStorage.setItem('em_device', dev); window.EM_TEST = true; window.print = () => {}; }, [DEV]);

  let netDown = false;
  await ctx.route(API + '*', route => {
    if (netDown) return route.abort('internetdisconnected');
    const out = g.doPost({ postData: { contents: route.request().postData() } });
    return route.fulfill({ status: 200, contentType: 'application/json', body: out.getContent(), headers: { 'access-control-allow-origin': '*' } });
  });
  await ctx.route(/fonts\.g/, route => route.fulfill({ contentType: 'text/css', body: '' }));
  const internet = async on => { netDown = !on; await ctx.setOffline(!on); };
  const shot = n => page.screenshot({ path: path.join(SHOTS, n + '.png') });
  const pin = async (who, digits) => {
    await page.click('[data-act=pickUser]:has-text("' + who + '")');
    for (const d of digits) await page.click('.pinpad [data-k="' + d + '"]');
  };

  // 1. Online once: connect, owner signs in (so the counter learns the owner PIN), then the cashier
  const link = Buffer.from(JSON.stringify({ url: API, key: KEY })).toString('base64');
  await page.goto(SITE + '#connect=' + encodeURIComponent(link));
  await page.waitForSelector('.login');
  await pin('เอิร์ธ', '1234');
  await page.waitForSelector('[data-form=openShift]');
  await page.click('[data-act=logout]');
  await page.waitForSelector('.login');
  await pin('มิว', '5678');
  await page.waitForSelector('[data-form=openShift]');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();   // now the page is controlled by the service worker
  await page.waitForSelector('[data-form=openShift]');
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controls the page');
  const pins = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('em_pins') || '{}')).length);
  assert.strictEqual(pins, 2, 'counter keeps offline sign-in for owner and cashier');

  // 2. Internet gone, page reloaded: it still opens, signed in, from the saved copy
  await internet(false);
  await page.reload();
  await page.waitForSelector('[data-form=openShift]');
  await page.waitForSelector('#netpill:has-text("ออฟไลน์")');
  await shot('o1-offline-reload');

  // 3. Open the shift offline, sell, sell something the system says is out of stock
  await page.fill('#o500', '1');
  await page.click('[data-form=openShift] button[type=submit]');
  await page.click('.modal [data-x=ok]');
  await page.waitForSelector('#scan');
  await page.fill('#scan', '8850000000011'); await page.keyboard.press('Enter');
  await page.waitForSelector('.toast:has-text("ขนมปัง หมดแล้ว")');
  await page.keyboard.press('F12');
  await page.click('#kp [data-k="2"]'); await page.click('#kp [data-k="0"]');
  await page.click('[data-x=ok]');
  await page.waitForSelector('.modal h1:has-text("OFF-0001")');
  await shot('o2-offline-receipt');
  await page.keyboard.press('Escape');

  // 4. Bill discount approved by the owner's PIN with no internet
  await page.fill('#scan', '8851234567890'); await page.keyboard.press('Enter');
  await page.fill('#scan', '8851234567890'); await page.keyboard.press('Enter');
  await page.click('[data-act=billDiscount]');
  await page.waitForSelector('#d-val');
  await page.click('.disc-pad [data-k="2"]');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#apin');
  await page.fill('#apin', '9999'); await page.keyboard.press('Enter');
  await page.waitForSelector('.toast:has-text("PIN เจ้าของไม่ถูกต้อง")');
  await page.fill('#apin', '1234'); await page.keyboard.press('Enter');
  await page.waitForSelector('.toast:has-text("อนุมัติโดย เอิร์ธ")');
  await page.waitForFunction(() => /12\.00/.test(document.querySelector('#totalbar .amt').textContent));
  await page.keyboard.press('F12');
  await page.click('#kp [data-k="2"]'); await page.click('#kp [data-k="0"]');
  await page.click('[data-x=ok]');
  await page.waitForSelector('.modal h1:has-text("OFF-0002")');
  await page.keyboard.press('Escape');

  // 5. Cash out, then online-only pages are refused
  await page.click('[data-act=cashMoveModal]');
  await page.fill('#cm-amt', '20'); await page.fill('#cm-why', 'ค่าน้ำแข็ง');
  await page.click('.modal [data-x=ok]');
  await page.waitForSelector('.toast:has-text("รอส่ง")');
  await page.click('nav button[data-v=stock]');
  await page.waitForSelector('.toast:has-text("ต้องต่อเน็ต")');
  assert.ok(await page.$('nav button[data-v=stock].needs-net'), 'online-only pages are greyed out');
  await page.waitForSelector('#netpill:has-text("4 รายการ")');

  // 6. Sign out and back in with no internet: wrong PIN refused, right PIN works
  await page.click('[data-act=logout]');
  await page.waitForSelector('.banner:has-text("เข้าได้เฉพาะคนที่เคยเข้าเครื่องนี้")');
  await pin('มิว', '1111');
  await page.waitForSelector('.toast:has-text("PIN ไม่ถูกต้อง")');
  await page.click('.pinpad [data-k="clr"]');
  for (const d of '5678') await page.click('.pinpad [data-k="' + d + '"]');
  await page.waitForSelector('#scan');
  await shot('o3-offline-login');
  assert.strictEqual(call('listBills', T).length, 0, 'nothing reached the server yet');

  // 7. Internet back: signs in for real and sends the shift, both bills and the cash move, in order
  await internet(true);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForSelector('#netpill.hidden', { state: 'attached', timeout: 30000 });
  const bills = call('listBills', T);
  assert.strictEqual(bills.length, 2, 'both offline bills sent');
  const sales = g.__sheet('Sales');
  assert.ok(sales.every(s => s.userId === mewId && s.offline === true), 'bills credited to the cashier, marked offline');
  const shifts = g.__sheet('Shifts');
  assert.strictEqual(shifts.length, 1, 'one shift');
  assert.ok(shifts[0].openUid && sales.every(s => s.shiftId === shifts[0].shiftId), 'bills joined the shift opened offline');
  const log = g.__sheet('AuditLog');
  assert.ok(log.some(l => l.action === 'DISCOUNT' && l.approvedBy === 'เอิร์ธ'), 'offline owner approval recorded');
  assert.ok(log.some(l => l.action === 'OVERSELL' && /ขนมปัง/.test(l.detail)), 'oversold item flagged');
  assert.ok(!log.some(l => l.action === 'OFFLINE_CHECK'), 'every offline item verified');
  const sum = call('shiftSummary', T.replace(/.*/, call('login', mewId, '5678', DEV).token));
  assert.deepStrictEqual([sum.cashSales, sum.cashOut, sum.expectedCash], [27, 20, 507], 'shift adds up: 500 + 15 + 12 - 20');
  await page.click('nav button[data-v=shift]');
  await page.waitForSelector('#shiftsum:has-text("ต้องมีในลิ้นชัก")');
  await shot('o4-back-online');

  assert.deepStrictEqual(errors, [], 'no page errors');
  await browser.close();
  server.close();
  console.log('Offline test passed');
})().catch(async e => { console.error(e.message.split('\n')[0], (e.stack.match(/offline.test.js:(\d+)/) || [])[1]); if (global.__fail) await global.__fail(); process.exit(1); });
