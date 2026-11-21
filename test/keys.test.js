// Sale keys in rows (sub-groups); the owner presses and holds a key to drag it, the order saves by itself.
'use strict';
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const { makeContext } = require('./gasmock');

const WEB = path.join(__dirname, '..', 'web');
const API = 'https://script.google.com/macros/s/TESTDEPLOY/exec';
const DEV = 'Dcounter000000000012';
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
[['โค้ก', 'น้ำอัดลม'], ['สไปรท์', 'น้ำอัดลม'], ['M-150', 'ชูกำลัง'], ['คาราบาว', 'ชูกำลัง']].forEach(([n, r], i) =>
  ok('saveProduct', T, { name: n, price: 15, type: 'nobarcode', quickKey: true, category: 'เครื่องดื่ม', subcategory: r, quickKeyOrder: i + 1 }));
const order = () => ok('listProducts', T).filter(p => p.quickKey).sort((a, b) => a.quickKeyOrder - b.quickKeyOrder).map(p => p.name + ':' + p.quickKeyRow);
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
  page.on('console', m => { if (/FAIL/.test(m.text())) console.log(m.text()); });
  await page.addInitScript(([dev]) => { localStorage.setItem('em_device', dev); window.EM_TEST = true; window.EM_NO_SW = true; window.print = () => {}; }, [DEV]);
  await ctx.route(API + '*', route => {
    const out = g.doPost({ postData: { contents: route.request().postData() } });
    return route.fulfill({ status: 200, contentType: 'application/json', body: out.getContent(), headers: { 'access-control-allow-origin': '*' } });
  });
  await ctx.route(/fonts\.g/, route => route.fulfill({ contentType: 'text/css', body: '' }));
  const shot = n => page.screenshot({ path: path.join(SHOTS, n + '.png') });
  const center = async sel => { const b = await page.locator(sel).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2, b]; };
  const drag = async (from, toX, toY) => {
    const [x, y] = await center(from);
    await page.mouse.move(x, y); await page.mouse.down();
    await page.waitForTimeout(600);                       // press and hold
    await page.mouse.move(x + 10, y + 5, { steps: 3 });
    await page.mouse.move(toX, toY, { steps: 12 });
    await page.mouse.up();
  };

  try {
    const link = Buffer.from(JSON.stringify({ url: API, key: KEY })).toString('base64');
    await page.goto(SITE + '#connect=' + encodeURIComponent(link));
    await page.waitForSelector('.login');
    for (const d of '1234') await page.click('.pinpad [data-k="' + d + '"]');
    await page.waitForSelector('.salekeys');

    // rows in order with their names
    assert.deepStrictEqual(await page.$$eval('.krow-h', a => a.map(x => x.textContent)), ['น้ำอัดลม', 'ชูกำลัง'], 'one row per sub-group');
    assert.deepStrictEqual(await page.$$eval('[data-act=keyGroup]', a => a.map(x => x.textContent)), ['เครื่องดื่ม'], 'tabs come from the product category');
    await shot('k1-rows');

    // a quick tap still sells
    await page.click('.key:has-text("โค้ก")');
    await page.waitForSelector('#lines :text("โค้ก")');
    // the bill stays on screen after visiting another page
    await page.click('[data-act=go][data-v=stock]');
    await page.waitForSelector('#srows');
    await page.click('[data-act=go][data-v=sale]');
    await page.waitForSelector('#lines .line:has-text("โค้ก")', { timeout: 3000 });
    assert.match(await page.textContent('#totalbar'), /15\.00/, 'total shown again');
    await page.click('.key:has-text("สไปรท์")');
    assert.strictEqual(await page.$$eval('#lines .line', a => a.length), 2, 'adding another keeps both');
    await page.click('[data-act=clearCart]');
    await page.click('.modal [data-x=yes]');
    await page.waitForSelector('.modal', { state: 'detached' });

    // drag คาราบาว in front of โค้ก (into row 1) → saved, nothing added to the bill
    const [cx, cy, cb] = await center('.key:has-text("โค้ก")');
    await drag('.key:has-text("คาราบาว")', cb.x + 8, cy);
    await page.waitForSelector('.toast:has-text("บันทึกตำแหน่งปุ่มแล้ว")');
    assert.deepStrictEqual(order(), ['คาราบาว:น้ำอัดลม', 'โค้ก:น้ำอัดลม', 'สไปรท์:น้ำอัดลม', 'M-150:ชูกำลัง'], 'key moved into row 1, first');
    assert.strictEqual(await page.$$eval('#lines .line', a => a.length).catch(() => 0), 0, 'drag does not sell');
    assert.ok(!(await page.$('#saving.show')), 'saves in the background');

    // drag a row by its name: ชูกำลัง above น้ำอัดลม
    const [, , hb] = await center('.krow-h:has-text("น้ำอัดลม")');
    await drag('.krow-h:has-text("ชูกำลัง")', hb.x + 30, hb.y + 2);
    await page.waitForFunction(() => document.querySelector('.krow-h').textContent === 'ชูกำลัง');
    await page.waitForFunction(() => true);
    await new Promise(r => setTimeout(r, 400));
    assert.deepStrictEqual(order()[0], 'M-150:ชูกำลัง', 'row order saved');

    // drop on "new row" → asks for a name and makes the row
    const [, , nb] = await center('.krow-new').catch(async () => [0, 0, null]);
    const [sx, sy] = await center('.key:has-text("สไปรท์")');
    await page.mouse.move(sx, sy); await page.mouse.down(); await page.waitForTimeout(600);
    await page.mouse.move(sx + 10, sy + 5, { steps: 3 });
    const z = await page.locator('.krow-new').boundingBox();
    await page.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 12 });
    await shot('k2-dragging');
    await page.mouse.up();
    await page.fill('#p2', 'น้ำผลไม้');
    await page.click('.modal [data-x=ok]');
    await page.waitForSelector('.krow-h:has-text("น้ำผลไม้")');
    await new Promise(r => setTimeout(r, 400));
    assert.ok(order().includes('สไปรท์:น้ำผลไม้'), 'new row saved');

    // survives a refresh
    await page.reload();
    await page.waitForSelector('.salekeys');
    assert.deepStrictEqual(await page.$$eval('.krow-h', a => a.map(x => x.textContent)), ['ชูกำลัง', 'น้ำอัดลม', 'น้ำผลไม้'], 'layout kept after refresh');
    await page.waitForFunction(() => /ยอดรวม/.test(document.getElementById('totalbar').textContent));
    await shot('k3-after');
    // products page: subcategory is a product field; after saving, moving on never asks to discard
    await page.click('[data-act=go][data-v=products]');
    await page.waitForSelector('#prows .prod-grid');
    await page.click('#prows .prod-grid:has-text("คาราบาว")');
    assert.ok((await page.$$eval('#e-unitlist option', a => a.map(o => o.value))).includes('ชิ้น'), 'unit offers existing units');
    assert.strictEqual(await page.getAttribute('#e-plu', 'placeholder'), 'เช่น 101', 'suggests a free PLU');
    await page.fill('#e-plu', '12a');
    await page.click('[data-ed=save]');
    await page.waitForSelector('.toast.err:has-text("1–5 หลัก")');
    await page.fill('#e-plu', '');
    await page.fill('#e-category', 'เครื่องดื่ม');
    await page.fill('#e-subcategory', 'เครื่องดื่มชูกำลัง');
    await page.fill('#e-price', '16');
    const t1 = Date.now();
    await page.click('[data-ed=save]');
    await page.waitForFunction(() => !document.querySelector('#saving.show, #saving.block'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForSelector('.toast:has-text("บันทึกแล้ว")');
    await page.click('[data-act=selProduct][data-sku=""]');
    await page.waitForSelector('#e-name:focus');
    assert.ok(!(await page.$('.modal')), 'no "discard changes?" after saving');
    await page.keyboard.type('เป๊ปซี่');
    await page.waitForTimeout(800);
    assert.strictEqual(await page.inputValue('#e-name'), 'เป๊ปซี่', 'the new product form is not replaced after the save');
    await page.click('[data-ed=cancel]');
    assert.strictEqual(ok('listProducts', T).find(p => p.name === 'คาราบาว').subcategory, 'เครื่องดื่มชูกำลัง', 'subcategory saved');
    await page.selectOption('#pcat', 'เครื่องดื่ม');
    await page.selectOption('#psub', 'เครื่องดื่มชูกำลัง');
    assert.deepStrictEqual(await page.$$eval('#prows .prod-grid', a => a.map(x => x.querySelector('div div').textContent)), ['คาราบาวP00004 · เครื่องดื่ม › เครื่องดื่มชูกำลัง'], 'filter by subcategory');
    await page.click('#prows .prod-grid:has-text("คาราบาว")');
    await shot('k4-products');
    // reports: category broken down by subcategory, filter by subcategory
    ok('saveProduct', T, Object.assign({}, ok('listProducts', T).find(p => p.name === 'M-150'), { category: 'เครื่องดื่ม' }), []);
    const sk = n => ok('listProducts', T).find(p => p.name === n).sku;
    ok('commitSale', T, { saleUid: 'KR1', payMethod: 'cash', received: 100, lines: [{ sku: sk('คาราบาว'), qty: 2 }, { sku: sk('M-150'), qty: 1 }, { sku: sk('โค้ก'), qty: 1 }] });
    await page.click('[data-act=go][data-v=reports]');
    await page.waitForSelector('#report');
    await page.click('[data-act=repTab][data-t=categories]').catch(async () => { await page.click('text=หมวด >> nth=-1'); });
    await page.waitForTimeout(800);
    await shot('k5-report-cats');
    assert.ok(!(await page.$('.toast.err')), 'reports open without an error');
    assert.ok(await page.$('tr.subrow:has-text("เครื่องดื่มชูกำลัง")'), 'category table lists subcategories');
    await page.click('tr.subrow:has-text("เครื่องดื่มชูกำลัง")');
    await page.waitForFunction(() => /คาราบาว/.test((document.getElementById('report') || {}).textContent || ''));
    assert.ok(!/M-150/.test(await page.textContent('#report')), 'tapping a subcategory shows only its products');

    assert.deepStrictEqual(errors, [], 'no page errors');
    console.log('Sale key rows test passed');
  } catch (e) {
    try { await shot('k-fail'); console.error(errors, await page.evaluate(() => document.body.innerText.slice(0, 300))); } catch (x) { /* ignore */ }
    throw e;
  } finally {
    await browser.close(); server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
