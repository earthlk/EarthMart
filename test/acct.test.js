// Accounting screens on the counter (owner): credit sale, customer pays back, expenses, payables, wallets, P&L, tax.
'use strict';
const fs = require('fs'), http = require('http'), path = require('path');
const { chromium } = require('playwright');
const { makeContext } = require('./gasmock');
const assert = require('assert');
const WEB = path.join(__dirname, '..', 'web');
const API = 'https://script.google.com/macros/s/TESTDEPLOY/exec';
const OUT = path.join(__dirname, 'shots');
const DEV = 'Dcounter000000000077';
const g = makeContext(); g.setup();
const KEY = g.__props.API_KEY;
g.createOwner('เอิร์ธ', '1234');
const call = (fn, ...a) => { const r = JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ key: KEY, fn, args: a }) } }).getContent()); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
const oid = call('status').users[0].userId;
let T = call('login', oid, '1234', DEV).token;
call('registerDevice', T, DEV, 'เครื่อง 1');
T = call('login', oid, '1234', DEV).token;
call('saveSettings', T, { promptPayId: '0812345678', shopName: 'EarthMart ปั๊ม' });
call('importProducts', T, ['sku,name,category,type,unit,cost,price,minStock,openingStock,barcode,barcodeUnit,multiplier',
  'W0001,น้ำดื่ม 600 มล.,เครื่องดื่ม,barcode,ขวด,5,7,0,0,8851234567890,ชิ้น,1',
  'S0001,ขนมปัง,ขนม,barcode,ชิ้น,10,15,0,0,8850000000011,ชิ้น,1'].join('\n'));
call('accSetup', T, { start: '2026-11-01', wallets: [{ walletId: 'WRESERVE', name: 'เงินสดสำรอง', type: 'reserve', opening: 10000 }, { walletId: 'WBANK', name: 'กสิกร', type: 'bank', opening: 50000, receivesQr: true }] });
call('receive', T, { receiptUid: 'R1', supplier: 'แม็คโคร', payFrom: 'WBANK', lines: [{ sku: 'W0001', qty: 48, unitCost: 5 }, { sku: 'S0001', qty: 20, unitCost: 10 }] });
call('openShift', T, 1000, '', { source: 'owner' });
for (let i = 0; i < 5; i++) call('commitSale', T, { saleUid: 'X' + i, payMethod: i % 2 ? 'qr' : 'cash', received: 100, lines: [{ sku: 'W0001', qty: 2 + i }, { sku: 'S0001', qty: 1 }] });
call('commitSale', T, { saleUid: 'C0', payMethod: 'credit', customer: { customerId: 'CUL', name: 'ลุงสมชาย' }, lines: [{ sku: 'W0001', qty: 3 }] });
call('saveExpense', T, { expUid: 'E0', category: 'ค่าเช่าที่', amount: 8000, payFrom: 'WBANK', note: 'ค่าเช่า พ.ย.' });

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
  const ctx = await b.newContext({ viewport: { width: 1366, height: 800 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  global.__fail = async () => { try { await page.screenshot({ path: path.join(OUT, 'a-fail.png') }); } catch (e) { /* none */ } };
  await page.addInitScript(([dev]) => { localStorage.setItem('em_device', dev); window.EM_TEST = true; window.print = () => {}; }, [DEV]);
  await ctx.route(API + '*', r => r.fulfill({ status: 200, contentType: 'application/json', body: g.doPost({ postData: { contents: r.request().postData() } }).getContent(), headers: { 'access-control-allow-origin': '*' } }));
  await ctx.route(/fonts\.g/, r => r.fulfill({ contentType: 'text/css', body: '' }));
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });
  await page.goto(SITE + '#connect=' + encodeURIComponent(Buffer.from(JSON.stringify({ url: API, key: KEY })).toString('base64')));
  await page.waitForSelector('.login');
  await page.click('[data-act=pickUser]:has-text("เอิร์ธ")');
  for (const d of '1234') await page.click('.pinpad [data-k="' + d + '"]');
  await page.waitForSelector('#scan');

  // 1. Credit sale: pick the customer from last time
  await page.fill('#scan', '8851234567890'); await page.keyboard.press('Enter');
  await page.fill('#scan', '8850000000011'); await page.keyboard.press('Enter');
  await page.keyboard.press('F12');
  await page.click('#pm [data-m=credit]');
  await page.waitForSelector('.cust-chip[data-cu=CUL]');
  await page.click('.cust-chip[data-cu=CUL]');
  await page.waitForSelector('.cr-sum:has-text("43.00")');   // 21 owed + 22 this bill
  await shot('a1-credit-pick');
  await page.click('.modal [data-x=ok]');
  await page.waitForSelector('.modal h1:has-text("บันทึกแล้ว")');
  assert.match(await page.textContent('.modal .body'), /ค้างจ่าย.*ลุงสมชาย/);
  await page.keyboard.press('Escape');
  // a new name
  await page.fill('#scan', '8851234567890'); await page.keyboard.press('Enter');
  await page.keyboard.press('F12');
  await page.click('#pm [data-m=credit]');
  await page.click('.cust-chip.add');
  await page.fill('#cr-name', 'ป้าแดง');
  await page.click('.modal [data-x=ok]');
  await page.waitForSelector('.modal h1:has-text("บันทึกแล้ว")');
  await page.keyboard.press('Escape');
  const custs = call('customers', T);
  assert.deepStrictEqual(custs.map(c => [c.name, c.balance]), [['ลุงสมชาย', 43], ['ป้าแดง', 7]], 'credit sales owed by name');

  // 2. Customer pays back at the counter (from the cash in/out window)
  await page.click('[data-act=cashMoveModal]');
  await page.click('[data-act=custPayCounter]');
  await page.click('.cust-chip[data-cu=CUL]');
  await page.fill('#cp-amt', '20');
  await page.click('.modal [data-x=ok]');
  await page.waitForSelector('.toast:has-text("ค้างเหลือ ฿23.00")');

  // 3. Accounting page: overview
  await page.click('nav [data-v=acct]');
  await page.waitForSelector('.acc-kpi:has-text("กำไรสุทธิ")');
  await shot('a2-overview');
  assert.match(await page.textContent('#acc-body'), /ทรัพย์สินร้าน/);
  assert.match(await page.textContent('#acc-body'), /ลูกค้าค้างจ่าย/);

  // 4. Expense with a new category, paid on credit -> payables
  await page.click('[data-act=accTab][data-t=expenses]');
  await page.waitForSelector('.acc-table');
  await page.click('[data-act=accExpense]');
  await page.fill('#ex-amt', '1500');
  await page.click('.chip-radio label:has-text("ซ่อมบำรุง")');
  await page.click('.chip-radio label:has-text("ค้างจ่าย")');
  await page.fill('#ex-party', 'ช่างวิทย์');
  await page.fill('#ex-note', 'ซ่อมตู้แช่');
  await shot('a3-expense');
  await page.click('.modal [data-x=ok]');
  await page.waitForSelector('.acc-table :text("ซ่อมตู้แช่")');
  await page.click('[data-act=accPur][data-p="1"]');
  await page.waitForSelector('.acc-table :text("แม็คโคร")');
  await shot('a4-purchases');

  // 5. Debts: customers, then what we owe -> pay it
  await page.click('[data-act=accTab][data-t=debts]');
  await page.waitForSelector('.acc-cust.on');
  await shot('a5-debts-customers');
  await page.click('[data-act=accSide][data-s=ours]');
  await page.waitForSelector('.acc-table :text("ช่างวิทย์")');
  await shot('a6-debts-ours');
  await page.click('[data-act=accPayPay]');
  await page.click('.modal input[name=ppfrom][value=WRESERVE]');
  await page.click('.modal [data-x=ok]');
  await page.waitForSelector('.acc-table :text("ไม่มีรายการค้างจ่าย")');

  // 6. Wallets: owner draw from the cash reserve
  await page.click('[data-act=accTab][data-t=wallets]');
  await page.waitForSelector('.acc-wcard');
  await page.click('[data-act=accTx][data-k=DRAW]');
  await page.fill('#tx-amt', '3000');
  await page.click('.modal input[name=txfrom][value=WRESERVE]');
  await page.click('.modal [data-x=ok]');
  await page.waitForSelector('.acc-wcard:has-text("5,500.00")');   // 10000 - 1500 - 3000
  await shot('a7-wallets');

  // 7. P&L and tax
  await page.click('[data-act=accTab][data-t=pl]');
  await page.waitForSelector('.pl-net');
  await shot('a8-pl');
  await page.click('[data-act=accMode][data-m=year]');
  await page.waitForSelector('.acc-step :text("ปี 2569")');
  await page.click('[data-act=accTab][data-t=tax]');
  await page.waitForSelector('.tax-opt.on');
  await shot('a9-tax');
  const tax = call('accTax', T, '2026', false);
  assert.ok(tax.income > 0 && tax.actual > 0, 'tax figures');

  assert.deepStrictEqual(errs, [], 'no page errors');
  await b.close(); server.close();
  console.log('Accounting UI test passed');
})().catch(async e => { console.error(e.message.split('\n').slice(0, 3).join('\n'), (e.stack.match(/acct.test.js:(\d+)/) || [])[1]); if (global.__fail) await global.__fail(); process.exit(1); });
