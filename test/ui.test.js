// Browser smoke test: real web/ files in Chromium, API calls routed into the mocked Apps Script backend.
'use strict';
let errorsRef = [];
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { makeContext } = require('./gasmock');

const WEB = path.join(__dirname, '..', 'web');
const SITE = 'https://pos.example.test/';
const API = 'https://script.google.com/macros/s/TESTDEPLOY/exec';
const DEV = 'Dcounter000000000001';
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
call('importProducts', T, [
  'sku,name,category,type,unit,cost,price,minStock,openingStock,barcode,barcodeUnit,multiplier,barcodePrice,quickKey,quickKeyGroup,openPrice,plu',
  'W0001,น้ำดื่ม 600 มล.,เครื่องดื่ม,barcode,ขวด,4.2,7,48,186,8851234567890,ชิ้น,1,,,,,',
  'W0001,,,,,,,,,8851234567906,แพ็ค,12,80,,,,',
  'D0101,น้ำแข็งแก้ว,เครื่องดื่มชง,nobarcode,แก้ว,1.65,5,0,,,,,,y,เครื่องดื่มชง,,101',
  'D0102,กาแฟเย็น,เครื่องดื่มชง,nobarcode,แก้ว,9,30,0,,,,,,y,เครื่องดื่มชง,,102'
].join('\n'));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
  const errors = []; errorsRef = errors;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.addInitScript(([dev]) => {
    localStorage.setItem('em_device', dev);
    window.print = () => { window.__printed = (window.__printed || 0) + 1; };
    // Fake Web Serial port that records what is written.
    window.__serialWrites = [];
    const port = {
      getInfo: () => ({ usbVendorId: 0x0483, usbProductId: 0x5743 }),
      open: async () => { port.writable = { getWriter: () => ({ write: async b => window.__serialWrites.push(Array.from(b)), releaseLock() {} }) }; },
      writable: null
    };
    Object.defineProperty(navigator, 'serial', { value: { getPorts: async () => [port], requestPort: async () => port } });
  }, [DEV]);

  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(API)) {
      const out = g.doPost({ postData: { contents: route.request().postData() } });
      return route.fulfill({ status: 200, contentType: 'application/json', body: out.getContent(), headers: { 'access-control-allow-origin': '*' } });
    }
    if (url.includes('qrcode-generator')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(require.resolve('qrcode-generator/qrcode.js'), 'utf8') });
    if (url.startsWith(SITE)) {
      const f = path.join(WEB, new URL(url).pathname.replace(/^\/$/, '/index.html'));
      if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)];
      return route.fulfill({ contentType: type + ';charset=utf-8', body: fs.readFileSync(f) });
    }
    if (url.includes('fonts.g')) return route.fulfill({ contentType: 'text/css', body: '' });
    return route.abort();
  });

  const shot = n => page.screenshot({ path: path.join(SHOTS, n + '.png') });

  // 1. First run asks for the connection
  await page.goto(SITE);
  await page.waitForSelector('#c-url');
  await shot('01-connect');
  await page.fill('#c-url', API);
  await page.fill('#c-key', 'wrong-key');
  await page.click('button[type=submit]');
  await page.waitForSelector('.toast.err');
  assert.match(await page.textContent('.toast'), /API key/);
  await page.fill('#c-key', KEY);
  await page.click('button[type=submit]');

  // 2. Login with keyboard PIN
  await page.waitForSelector('.login');
  await page.keyboard.type('1234');
  await shot('02-login');
  await page.keyboard.press('Enter');

  // 3. Counter + no shift -> open shift screen
  await page.waitForSelector('[data-form=openShift]');
  await page.fill('#o500', '1');
  await page.fill('#ocoin', '20');
  assert.match(await page.textContent('#o-total'), /520/);
  await page.click('[data-form=openShift] button[type=submit]');

  // 4. Sale: scan pack barcode, quick key, PLU, multiplier
  await page.waitForSelector('#scan:not([disabled])');
  await page.fill('#scan', '8851234567906'); await page.keyboard.press('Enter');
  await page.click('.key:has-text("กาแฟเย็น")');
  await page.fill('#scan', '101'); await page.keyboard.press('Enter');
  await page.fill('#scan', '3*8851234567890'); await page.keyboard.press('Enter');
  await page.fill('#scan', 'น้ำแข็ง'); await page.keyboard.press('Enter');
  await page.waitForSelector('.suggest');
  await page.keyboard.press('Enter'); // pick first suggestion
  await page.waitForFunction(() => document.querySelectorAll('.line').length === 4);
  const total = await page.textContent('#totalbar .amt');
  assert.match(total, /141\.00/, 'total 80+30+5*2+21 = 141, got ' + total);
  await shot('03-sale');

  // 5. Pay by QR first to see the PromptPay QR, then cash
  await page.keyboard.press('F12');
  await page.click('#pm button[data-m=qr]');
  await page.waitForSelector('#qrbox svg');
  await shot('04-pay-qr');
  await page.click('#pm button[data-m=cash]');
  await page.click('[data-q="500"]');
  assert.match(await page.textContent('#chg'), /359\.00/);
  await page.click('[data-x=ok]');
  await page.waitForSelector('.modal h1:has-text("บันทึกแล้ว")');
  await page.waitForTimeout(300);
  await shot('05-receipt');
  assert.ok(await page.evaluate(() => window.__printed >= 1), 'receipt printed');
  // Drawer is in "none" mode yet -> no kick
  assert.strictEqual((await page.evaluate(() => window.__serialWrites)).length, 0);
  await page.keyboard.press('Escape');

  // 6. Settings: choose serial drawer + test
  await page.click('nav button[data-v=settings]');
  await page.click('[data-act=drawerPick][data-m=serial]');
  await page.waitForSelector('[data-act=drawerTest]:not([disabled])');
  await page.click('[data-act=drawerTest]');
  await page.waitForFunction(() => window.__serialWrites.length === 1);
  assert.deepStrictEqual(await page.evaluate(() => window.__serialWrites[0]), [0x1B, 0x70, 0x00, 0x19, 0xFA]);
  await page.waitForSelector('#auditrows tr');
  await shot('06-settings');

  // 7. Cash sale now kicks the drawer automatically; no-sale button logs NO_SALE
  await page.click('nav button[data-v=sale]');
  await page.click('.key:has-text("กาแฟเย็น")');
  await page.keyboard.press('F12');
  await page.fill('#recv', '30');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__serialWrites.length === 2);
  await page.keyboard.press('Escape');
  await page.click('[data-act=noSale]');
  await page.waitForFunction(() => window.__serialWrites.length === 3);

  // 8. Bills list, report
  await page.click('nav button[data-v=bills]');
  await page.waitForFunction(() => document.querySelectorAll('#bills tr.click').length === 2);
  await shot('07-bills');
  await page.click('nav button[data-v=reports]');
  await page.waitForSelector('.kpis');
  assert.match(await page.textContent('.kpis'), /171\.00/);
  assert.match(await page.textContent('#report'), /เปิดลิ้นชัก/);
  await shot('08-report');

  // 9. Stock page, then products: list + side editor
  await page.click('nav button[data-v=stock]');
  await page.waitForFunction(() => document.querySelectorAll('#srows tr').length >= 3);
  await page.click('nav button[data-v=products]');
  await page.waitForSelector('#prows .prod-grid');
  await page.click('#prows .prod-grid:has-text("น้ำดื่ม")');
  await page.waitForSelector('.units .u:not(.head)');
  assert.strictEqual(await page.locator('.units .u:not(.head)').count(), 2, 'water has piece + pack');
  await shot('09-product-edit');

  // Scan an unknown barcode in the search box -> new product prefilled with that barcode
  await page.fill('#pq', '8850999111222');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#e-name:focus');
  await page.keyboard.type('ขนมปังไส้สังขยา');
  await page.fill('#e-category', 'ขนม');
  await page.fill('#e-cost', '10');
  await page.fill('#e-price', '15');
  await page.fill('#e-scan', '8850999111239');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-ec=multiplier][data-i="1"]:focus');
  await page.keyboard.type('6');
  await page.fill('[data-ec=price][data-i="1"]', '85');
  await page.click('[data-ef=quickKey]');
  await page.click('[data-ed=icon][data-v=bread]');
  await page.click('[data-ed=color][data-v=tan]');
  await page.fill('#e-quickKeyGroup', 'ขนม');
  await shot('09b-product-new');
  await page.click('[data-ed=save]');
  await page.waitForSelector('#ped .muted:has-text("SKU P")');
  const saved = call('bootstrap', T);
  const bread = saved.products.find(p => p.name === 'ขนมปังไส้สังขยา');
  assert.ok(bread && bread.price === 15 && bread.quickKey && bread.icon === 'bread', 'new product saved');
  assert.deepStrictEqual(saved.barcodes.filter(b => b.sku === bread.sku).map(b => [b.unitName, b.multiplier, b.price]).sort(),
    [['ชิ้น', 1, null], ['แพ็ค', 6, 85]], 'barcodes per unit');

  // Sell it: pack barcode + quick key with SVG icon; edit qty; QR quick button
  await page.click('nav button[data-v=sale]');
  await page.click('.chip:has-text("ขนม")');
  await page.waitForSelector('.key:has-text("ขนมปัง") svg');
  await page.click('.key:has-text("ขนมปัง")');
  await page.fill('#scan', '8850999111239'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.line').length === 2);
  // tap the quantity number to type a quantity
  await page.click('.line:has-text("แพ็ค") [data-act=editQty]');
  await page.fill('#p2', '2'); await page.keyboard.press('Enter');
  // swipe a line to the right -> confirm -> removed
  await page.click('.key:has-text("ขนมปัง")');
  await page.waitForFunction(() => document.querySelector('.line .qty .n').textContent === '2');
  const box = await page.locator('.swipe').first().boundingBox();
  await page.mouse.move(box.x + 60, box.y + box.height / 2);
  await page.mouse.down();
  for (let dx = 0; dx <= 200; dx += 20) await page.mouse.move(box.x + 60 + dx, box.y + box.height / 2);
  await shot('09d-swipe');
  await page.mouse.up();
  await page.waitForSelector('.modal h1:has-text("ลบรายการ")');
  await page.click('[data-x=yes]');
  await page.waitForFunction(() => document.querySelectorAll('.line').length === 1);
  await page.click('.key:has-text("ขนมปัง")');
  // minus at qty 1 asks before removing
  await page.click('.line:has-text("ชิ้น ·") [data-d="-1"]');
  await page.waitForSelector('.modal h1:has-text("ลบรายการ")');
  await page.click('[data-x=no]');
  await page.waitForFunction(() => document.querySelectorAll('.line').length === 2);
  // hold the bill, sell something else, recall it
  await page.click('[data-act=holdBill]');
  await page.fill('#p2', 'ลูกค้าเสื้อแดง'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.line').length === 0);
  assert.match(await page.textContent('[data-act=holdBill]'), /พักบิล \(1\)/);
  await page.click('[data-act=holdBill]');
  await page.waitForSelector('.modal:has-text("ลูกค้าเสื้อแดง")');
  await shot('09e-held');
  await page.click('[data-x=recall]');
  await page.waitForFunction(() => document.querySelectorAll('.line').length === 2);
  // per-line discount from the row, bill discount from the bottom button (owner approves self)
  await page.click('.line:has-text("แพ็ค") [data-act=lineDisc]');
  await page.fill('#p2', '10'); await page.keyboard.press('Enter');
  await page.waitForSelector('.line:has-text("แพ็ค") .ldisc.on');
  await page.click('[data-act=billDiscount]');
  await page.fill('#p2', '5'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => /170\.00/.test(document.querySelector('#totalbar .amt').textContent));
  await shot('09f-discounts');
  assert.match(await page.textContent('#totalbar .amt'), /170\.00/, '15 + 2 x 85 - 10 - 5');
  await shot('09c-sale-icons');
  await page.click('[data-act=payQr]');
  await page.waitForSelector('#qrbox svg');
  await page.click('[data-x=ok]');
  await page.waitForSelector('.modal h1:has-text("บันทึกแล้ว")');
  await page.keyboard.press('Escape');

  // 10. Close shift
  await page.click('nav button[data-v=shift]');
  await page.waitForSelector('#shiftsum h2');
  await page.fill('#c1000', '0'); await page.fill('#c500', '1'); await page.fill('#c100', '1'); await page.fill('#ccoin', '91');
  await page.click('[data-act=closeShift]');
  await page.click('[data-x=yes]');
  await page.waitForSelector('.modal h1:has-text("ปิดกะแล้ว")');
  assert.match(await page.textContent('.modal .body'), /เงินพอดี/);
  await shot('10-closed');

  // 11. Phone width: login still usable
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press('Escape');
  await page.click('[data-act=logout]');
  await page.waitForSelector('.login');
  await shot('11-phone-login');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.ok(!overflow, 'no horizontal scroll on phone');

  assert.deepStrictEqual(errors, [], 'console errors: ' + errors.join('\n'));
  await browser.close();
  console.log('UI smoke test passed');
})().catch(e => { console.error(e); console.error('page errors:', errorsRef); process.exit(1); });
