// The single-file build (tools/build-local.js) opened from disk (file://) still connects to Apps Script and sells.
'use strict';
const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { makeContext } = require('./gasmock');

const OUT = path.join(__dirname, '..', 'dist', 'EarthMart-local.html');
execFileSync('node', [path.join(__dirname, '..', 'tools', 'build-local.js'), OUT]);
const API = 'https://script.google.com/macros/s/TESTDEPLOY/exec';
const g = makeContext(); g.setup();
const KEY = g.__props.API_KEY;
g.createOwner('เอิร์ธ', '1234');
const call = (fn, ...a) => JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ key: KEY, fn, args: a }) } }).getContent()).data;
const T = call('login', call('status').users[0].userId, '1234', 'Dlocal00000000000001').token;
call('registerDevice', T, 'Dlocal00000000000001', 'คอมหน้าร้าน (ไฟล์)');
call('importProducts', T, ['sku,name,category,type,unit,cost,price,minStock,openingStock,barcode,barcodeUnit,multiplier', 'W1,น้ำดื่ม,เครื่องดื่ม,barcode,ขวด,4,7,0,50,8851234567890,ชิ้น,1'].join('\n'));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(() => { localStorage.setItem('em_device', 'Dlocal00000000000001'); window.print = () => {}; });
  await ctx.route(API + '*', r => r.fulfill({ status: 200, contentType: 'application/json', body: g.doPost({ postData: { contents: r.request().postData() } }).getContent(), headers: { 'access-control-allow-origin': '*' } }));
  await ctx.route(/fonts\.g/, r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.goto('file://' + OUT);
  await page.waitForSelector('#c-link');
  // paste the setup link copied from Settings on another machine
  const link = 'https://earthlk.github.io/EarthMart/#connect=' + encodeURIComponent(Buffer.from(JSON.stringify({ url: API, key: KEY })).toString('base64'));
  await page.fill('#c-link', link);
  assert.strictEqual(await page.inputValue('#c-url'), API, 'link filled the URL');
  await page.click('[data-form=connect] button[type=submit]');
  await page.waitForSelector('.login');
  for (const d of '1234') await page.click('.pinpad [data-k="' + d + '"]');
  await page.waitForSelector('[data-form=openShift]');
  await page.fill('#o500', '1');
  await page.click('[data-form=openShift] button[type=submit]');
  await page.fill('#scan', '8851234567890'); await page.keyboard.press('Enter');
  await page.keyboard.press('F12');
  await page.click('#kp [data-k="1"]'); await page.click('#kp [data-k="0"]');
  await page.click('[data-x=ok]');
  await page.waitForSelector('.modal h1:has-text("บันทึกแล้ว")');
  assert.strictEqual(call('listBills', T).length, 1, 'sale reached Apps Script from the local file');
  assert.ok(await page.evaluate(() => window.EM_LOCAL === true && typeof JsBarcode === 'function' && typeof Chart === 'function' && typeof promoApply === 'function'), 'everything inlined');
  assert.deepStrictEqual(errs, [], 'no page errors');
  await b.close();
  console.log('Local file test passed');
})().catch(e => { console.error(e); process.exit(1); });
