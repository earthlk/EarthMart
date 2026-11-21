// Screenshots of every screen of the current EarthMart build (PC + phone) on a demo shop.
// node tools/mockup/capture.js <outDir>   → <outDir>/*.png + shots.json (id, title, group)
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const { seed } = require('./seed');

const WEB = path.join(__dirname, '..', '..', 'web');
const API = 'https://script.google.com/macros/s/TESTDEPLOY/exec';
const OUT = path.resolve(process.argv[2] || 'mockup-shots');
fs.mkdirSync(OUT, { recursive: true });

const { g, KEY, DEV, ownerId } = seed();
const call = (fn, ...args) => JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ key: KEY, fn, args }) } }).getContent()).data;

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(WEB, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/$/, '/index.html'));
  if (!f.startsWith(WEB) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': (types[path.extname(f)] || 'application/octet-stream') + ';charset=utf-8' });
  res.end(fs.readFileSync(f));
});

const shots = [];
const fails = [];
const HIDE = '.toast,#busy,.loading{display:none!important} *{caret-color:transparent!important}';

async function newPage(ctx, dev) {
  const page = await ctx.newPage();
  await page.addInitScript(([d, css]) => {
    localStorage.setItem('em_device', d); window.EM_TEST = true; window.EM_NO_SW = true; window.print = () => {};
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); });
  }, [dev, HIDE]);
  return page;
}
async function route(ctx) {
  await ctx.route(API + '*', r => r.fulfill({ status: 200, contentType: 'application/json', body: g.doPost({ postData: { contents: r.request().postData() } }).getContent(), headers: { 'access-control-allow-origin': '*' } }));
  await ctx.route(/fonts\.g/, r => r.fulfill({ contentType: 'text/css', body: '' }));
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const SITE = 'http://localhost:' + server.address().port + '/';
  const link = SITE + '#connect=' + encodeURIComponent(Buffer.from(JSON.stringify({ url: API, key: KEY })).toString('base64'));
  const browser = await chromium.launch();

  /* ============================ PC ============================ */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await route(ctx);
  const page = await newPage(ctx, DEV);
  const wait = ms => page.waitForTimeout(ms);
  const snap = async (id, title, group, p) => { await (p || page).waitForTimeout(450); await (p || page).screenshot({ path: path.join(OUT, id + '.png') }); shots.push({ id, title, group, device: p && p.__phone ? 'mobile' : (p && p.__cd ? 'customer' : 'pc') }); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { fails.push(name + ': ' + e.message.split('\n')[0]); try { await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); } catch (x) { /* */ } } };
  const nav = async v => { await page.click('header nav button[data-v=' + v + ']'); await wait(700); };
  const reset = async () => { await page.reload(); await page.waitForSelector('#scan, .login, [data-form=openShift]'); if (await page.$('.login')) await pin(page, '1234'); await page.waitForTimeout(800); };
  const esc = async () => { for (let i = 0; i < 3 && await page.$('.modal'); i++) { await page.keyboard.press('Escape'); await wait(200); } };
  const pin = async (p, digits) => { await p.click('[data-act=pickUser]:has-text("เอิร์ธ")').catch(() => {}); for (const d of digits) await p.click('.pinpad [data-k="' + d + '"]'); };

  await page.goto(link);
  await page.waitForSelector('.login');
  await step('login', async () => { await snap('pc-01-login', 'เข้าสู่ระบบ (เลือกผู้ใช้ + PIN)', 'เริ่มต้น'); });
  await pin(page, '1234');
  await page.waitForTimeout(2500);
  if (!(await page.$('#scan'))) { await page.screenshot({ path: path.join(OUT, '_after-login.png') }); console.log(await page.evaluate(() => document.body.innerText.slice(0, 400))); }
  await page.waitForSelector('#scan');

  // customer display window
  const cd = await ctx.newPage(); cd.__cd = true;
  await cd.setViewportSize({ width: 1024, height: 600 });
  await cd.goto(SITE + '?page=customer');
  await step('cd-idle', async () => { await cd.waitForSelector('#cd'); await snap('cd-01-idle', 'จอลูกค้า — รอลูกค้า', 'จอลูกค้า', cd); });

  await step('sale', async () => {
    await page.click('.chip:has-text("เครื่องดื่ม")').catch(() => {});
    await page.click('.key:has-text("เอ็ม-150")'); await page.click('.key:has-text("เอ็ม-150")'); await page.click('.key:has-text("คาราบาวแดง")');
    await page.fill('#scan', '8850999320021'); await page.keyboard.press('Enter');
    await page.fill('#scan', '101'); await page.keyboard.press('Enter');
    await page.fill('#scan', '2*8850718801213'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.line').length >= 5);
    await snap('pc-02-sale', 'หน้าขาย — ปุ่มขายด่วนแบ่งแท็บตามหมวด แถวตามหมวดย่อย, โปรใช้อัตโนมัติ', 'ขาย');
  });
  await step('cd-scan', async () => { await snap('cd-02-scan', 'จอลูกค้า — รายการที่สแกน', 'จอลูกค้า', cd); });
  await step('pay-cash', async () => {
    await page.keyboard.press('F12'); await page.waitForSelector('#pm');
    await page.click('#pm button[data-m=cash]'); await page.click('[data-q="500"]');
    await snap('pc-03-pay-cash', 'ชำระเงิน — เงินสด (ปุ่มแบงก์ + numpad)', 'ขาย');
    await page.click('#pm button[data-m=qr]'); await page.waitForSelector('#qrbox svg');
    await snap('pc-04-pay-qr', 'ชำระเงิน — QR พร้อมเพย์', 'ขาย');
    await snap('cd-03-pay', 'จอลูกค้า — QR ให้สแกนจ่าย', 'จอลูกค้า', cd);
    await page.click('#pm [data-m=split]');
    await page.click('#s1m [data-s1=qr]'); await page.click('#kp [data-k="1"]'); await page.click('#kp [data-k="0"]'); await page.click('#kp [data-k="0"]');
    await snap('pc-05-pay-split', 'ชำระเงิน — แบ่งจ่าย (เงินสด + QR)', 'ขาย');
    await page.click('#pm button[data-m=cash]'); await page.click('[data-q="500"]');
    await page.click('[data-x=ok]'); await page.waitForSelector('.modal h1:has-text("บันทึกแล้ว")');
    await snap('pc-06-paid', 'บันทึกบิลแล้ว — เงินทอน / พิมพ์ใบเสร็จ', 'ขาย');
    await snap('cd-04-done', 'จอลูกค้า — ชำระเรียบร้อย', 'จอลูกค้า', cd);
    await esc();
  });
  await step('hold+disc', async () => {
    await page.click('.key:has-text("เอ็ม-150")'); await page.click('.key:has-text("โค้ก")');
    await page.click('[data-act=holdBill]'); await page.fill('#p2', 'ลูกค้าเสื้อแดง'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.line').length === 0);
    await page.click('.chip:has-text("เครื่องดื่ม")').catch(() => {});
    await page.click('.key:has-text("น้ำดื่มสิงห์")'); await page.click('.key:has-text("น้ำดื่มสิงห์")'); await page.click('.key:has-text("เนสกาแฟ")');
    await page.click('.line [data-act=lineDisc] >> nth=0'); await page.waitForSelector('#d-val');
    await page.click('[data-mode=baht]').catch(() => {}); await page.click('.disc-pad [data-k="2"]').catch(() => {});
    await snap('pc-08-line-discount', 'ส่วนลดรายการ', 'ขาย'); await page.click('[data-x=ok]'); await wait(300);
    await page.click('[data-act=billDiscount]'); await page.waitForSelector('#d-val');
    await snap('pc-07-discount', 'ส่วนลดท้ายบิล', 'ขาย'); await esc();
    await page.click('[data-act=holdBill]'); await page.waitForSelector('.modal:has-text("ลูกค้าเสื้อแดง")');
    await snap('pc-09-held', 'พักบิล — เรียกบิลที่พักไว้', 'ขาย'); await esc();
    await page.keyboard.press('F12'); await page.waitForSelector('#pm');
    await page.click('#pm [data-m=credit]'); await wait(400);
    await snap('pc-10-pay-credit', 'ชำระเงิน — ค้างจ่าย (เลือกลูกค้า)', 'ขาย'); await esc();
    await page.click('[data-act=clearCart]'); await page.click('.modal [data-x=yes]').catch(() => {});
  });
  await step('cashmove', async () => {
    await page.click('[data-act=cashMoveModal]'); await page.waitForSelector('.modal');
    await snap('pc-11-cash-move', 'เงินเข้า / ออก ลิ้นชัก', 'ขาย'); await esc();
  });
  await step('storeuse', async () => {
    await page.click('[data-act=storeUse]'); await page.waitForSelector('.modal');
    await snap('pc-12-store-use', 'เบิกใช้ในร้าน', 'ขาย'); await esc();
  });

  // bills
  await step('bills', async () => {
    await nav('bills'); await page.waitForSelector('#bills tr.click');
    await snap('pc-13-bills', 'บิล — รายวัน', 'บิล');
    await page.click('#bills tr.click[data-l=day] >> nth=0'); await wait(600);
    await snap('pc-14-bills-day', 'บิล — รายการบิลของวัน', 'บิล');
    await wait(500);
    await page.click('#bills tr.click >> nth=0'); await page.waitForSelector('.modal');
    await snap('pc-15-bill', 'รายละเอียดบิล', 'บิล');
    await page.click('.modal [data-x=return]'); await wait(300);
    await page.click('.modal [data-l="0"][data-d="1"]').catch(() => {});
    await page.click('.modal [data-why]').catch(() => {});
    await snap('pc-16-return', 'คืนสินค้า', 'บิล'); await esc();
  });

  // products
  await step('products', async () => {
    await nav('products'); await page.waitForSelector('#prows .prod-grid');
    await snap('pc-17-products', 'สินค้า — รายการ (กรองหมวด / หมวดย่อย)', 'สินค้า');
    await page.click('#prows .prod-grid:has-text("เอ็ม-150")'); await page.waitForSelector('#e-name');
    await snap('pc-18-product-edit', 'แก้ไขสินค้า — หมวด/หมวดย่อย, ขั้นต่ำอัตโนมัติ, PLU', 'สินค้า');
    await page.click('[data-act=selProduct][data-sku=""]'); await page.waitForSelector('#e-name');
    await snap('pc-19-product-new', 'เพิ่มสินค้าใหม่', 'สินค้า');
    await page.click('[data-ed=cancel]').catch(() => {});
    await page.click('[data-act=promoOpen]'); await wait(600);
    await snap('pc-20-promos', 'โปรโมชั่น', 'สินค้า');
    await page.click('.promo-card >> nth=0').catch(() => {}); await wait(400);
    await page.click('[data-act=promoNew]').catch(() => {}); await wait(400);
    await snap('pc-21-promo-edit', 'สร้าง / แก้โปรโมชั่น', 'สินค้า');
    await reset(); await nav('products');
    await page.click('[data-act=labOpen]'); await wait(500);
    await page.click('.lab-row >> nth=0 >> [data-act=labN][data-d="1"]').catch(() => {});
    await snap('pc-22-labels', 'พิมพ์ป้ายราคา / สติกเกอร์', 'สินค้า');
    await reset(); await nav('products');
    await page.click('[data-act=bulkOpen]'); await wait(500);
    await snap('pc-23-bulk-price', 'แก้ราคาหลายรายการ', 'สินค้า');
    await esc(); await nav('products');
  });

  // stock
  await step('stock', async () => {
    await nav('stock'); await page.waitForSelector('#srows .stk-grid');
    await snap('pc-24-stock', 'สต็อก — คงเหลือ / ต้องสั่ง', 'สต็อก');
    await page.click('[data-act=stockTab][data-t=count]'); await page.waitForSelector('#crows [data-cnt]');
    await page.fill('#crows [data-cnt] >> nth=0', '20'); await page.fill('#crows [data-cnt] >> nth=1', '31');
    await snap('pc-25-count', 'สต็อก — ตรวจนับ', 'สต็อก');
    await page.click('[data-act=cntClear]').catch(() => {}); await page.click('.modal [data-x=yes]').catch(() => {});
    await page.click('[data-act=stockTab][data-t=moves]'); await wait(700);
    await snap('pc-26-moves', 'สต็อก — ความเคลื่อนไหว', 'สต็อก');
    await page.click('[data-act=stockTab][data-t=list]'); await wait(500);
    await reset(); await nav('products');
    await page.click('#prows .prod-grid:has-text("น้ำดื่มสิงห์")'); await page.click('[data-act=showLots]');
    await page.waitForSelector('.modal tbody tr');
    await snap('pc-27-lots', 'ล็อตสินค้า (FIFO / ทุน / วันหมดอายุ)', 'สต็อก');
    await esc(); await reset();
  });
  await step('expiry', async () => { await nav('expiry'); await wait(800); await snap('pc-28-expiry', 'หมดอายุ', 'สต็อก'); });
  await step('receive', async () => {
    await nav('receive'); await wait(600);
    await page.fill('#rscan', '8851959132012').catch(() => {}); await page.keyboard.press('Enter');
    await page.fill('#rscan', '8851123212021').catch(() => {}); await page.keyboard.press('Enter');
    await wait(400);
    await snap('pc-29-receive', 'รับสินค้าเข้า', 'สต็อก');
    await page.click('[data-act=rcCommit]').catch(() => {}); await wait(500);
    if (await page.$('.modal')) await snap('pc-30-receive-pay', 'รับสินค้า — จ่ายเงินจากไหน / ค้างจ่าย', 'สต็อก');
    await esc();
  });

  // shift
  await step('shift', async () => {
    await nav('shift'); await wait(900);
    await snap('pc-31-shift', 'กะ — สรุปกะปัจจุบัน', 'กะ');
  });

  // reports
  await step('reports', async () => {
    await nav('reports'); await wait(900);
    await page.click('[data-act=repPreset][data-k="7d"]').catch(() => {}); await wait(900);
    await snap('pc-32-report-overview', 'รายงาน — ภาพรวม', 'รายงาน');
    for (const [t, title] of [['products', 'สินค้าขายดี / กำไรต่อสินค้า'], ['categories', 'หมวด / หมวดย่อย'], ['staff', 'พนักงาน'], ['shifts', 'กะ'], ['slow', 'สินค้าไม่เคลื่อนไหว'], ['stock', 'มูลค่าสต็อก']]) {
      await page.click('[data-act=repTab][data-t=' + t + ']'); await wait(800);
      await snap('pc-3' + (3 + ['products', 'categories', 'staff', 'shifts', 'slow', 'stock'].indexOf(t)) + '-report-' + t, 'รายงาน — ' + title, 'รายงาน');
    }
  });

  // accounting
  await step('acct', async () => {
    await nav('acct'); await wait(900);
    await snap('pc-39-acc-overview', 'บัญชี — ภาพรวม', 'บัญชี');
    for (const [t, title, i] of [['expenses', 'รายจ่าย', 40], ['debts', 'ค้างจ่าย / ลูกหนี้', 41], ['wallets', 'บัญชีเงิน', 43], ['pl', 'กำไรขาดทุน', 44], ['tax', 'ภาษี', 45]]) {
      await page.click('[data-act=accTab][data-t=' + t + ']'); await wait(800);
      await snap('pc-' + i + '-acc-' + t, 'บัญชี — ' + title, 'บัญชี');
      if (t === 'debts') { await page.click('[data-act=accSide][data-s=ours]').catch(() => {}); await wait(600); await snap('pc-42-acc-debts-ours', 'บัญชี — เราค้างจ่าย', 'บัญชี'); }
    }
  });

  // settings
  await step('settings', async () => {
    await nav('settings'); await wait(600);
    const tabs = [['shop', 'ร้าน / ใบเสร็จ'], ['customer', 'จอลูกค้า / สไลด์'], ['look', 'ธีมสี & LINE'], ['device', 'เครื่องหน้าร้าน'], ['users', 'ผู้ใช้ / PIN'], ['net', 'อินเทอร์เน็ตร้าน'], ['connect', 'การเชื่อมต่อ / ติดตั้ง'], ['backup', 'สำรองข้อมูล & ตั้งยอดเปิดร้าน']];
    let i = 46;
    for (const [t, title] of tabs) {
      await page.click('[data-act=setTab][data-t=' + t + ']'); await wait(t === 'net' ? 1800 : 700);
      await snap('pc-' + (i++) + '-settings-' + t, 'ตั้งค่า — ' + title, 'ตั้งค่า');
    }
  });

  // opening mode (shown on a fresh flag, then switched back)
  await step('opening', async () => {
    g.saveSettingRaw_('openingDone', '');
    await reset();
    await nav('settings'); await page.click('[data-act=setTab][data-t=backup]'); await wait(800);
    await snap('pc-54-opening-start', 'ตั้งยอดเปิดร้าน — ปุ่มเปิดโหมด (ตั้งค่า › สำรองข้อมูล)', 'ตั้งยอดเปิดร้าน');
    await page.click('[data-act=opStart]'); await page.click('[data-x=yes]'); await page.waitForSelector('.op-bar');
    await page.fill('#crows [data-cnt] >> nth=0', '24'); await page.fill('#crows [data-cnt] >> nth=1', '18');
    await snap('pc-55-opening-count', 'โหมดตั้งยอดเปิดร้าน — ตรวจนับพร้อมทุน (ล็อกเหลือ สินค้า/สต็อก/บัญชี/ตั้งค่า)', 'ตั้งยอดเปิดร้าน');
    await page.click('[data-act=cntClear]').catch(() => {}); await page.click('.modal [data-x=yes]').catch(() => {});
    await page.click('[data-act=opFinish]'); await page.click('[data-x=yes]'); await wait(800);
  });

  // close shift → closed → open shift
  await step('close', async () => {
    await nav('shift'); await wait(700);
    await page.click('[data-act=closeShift]'); await wait(700);
    await snap('pc-56-close-shift', 'ปิดกะ — นับเงินในลิ้นชัก', 'กะ');
    await esc();
  });
  await step('openShift', async () => {
    const T = call('login', ownerId, '1234', DEV).token;
    const sum = call('shiftSummary', T);
    call('closeShift', T, sum.expectedCash, '', { floatLeft: 1000, depositTo: 'WBANK' });
    await page.evaluate(() => { sessionStorage.clear(); });
    await page.reload(); await page.waitForSelector('.login'); await pin(page, '1234');
    await page.waitForSelector('[data-form=openShift]');
    await snap('pc-57-open-shift', 'เปิดกะ — นับเงินทอนตั้งต้น', 'กะ');
  });
  await ctx.close();

  /* ============================ Phone ============================ */
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', hasTouch: true, isMobile: true });
  await route(pctx);
  const ph = await newPage(pctx, 'Dphone00000000000001'); ph.__phone = true;
  const pstep = async (name, fn) => { try { await fn(); } catch (e) { fails.push('phone ' + name + ': ' + e.message.split('\n')[0]); } };
  const tab = async v => { await ph.click('.tabbar [data-v=' + v + ']'); await ph.waitForTimeout(800); };
  await ph.goto(link); await ph.waitForSelector('.login');
  await pstep('login', async () => { await snap('m-01-login', 'มือถือ — เข้าสู่ระบบ', 'มือถือ', ph); });
  await ph.click('[data-act=pickUser]:has-text("เอิร์ธ")').catch(() => {}); for (const d of '1234') await ph.click('.pinpad [data-k="' + d + '"]'); await ph.waitForSelector('.mhome');
  await pstep('home', async () => { await ph.waitForTimeout(800); await snap('m-02-home', 'มือถือ — หน้าแรก (ยอดวันนี้, ทางลัด)', 'มือถือ', ph); });
  await pstep('bills', async () => { await tab('bills'); await snap('m-03-bills', 'มือถือ — บิล', 'มือถือ', ph); });
  await pstep('stock', async () => {
    await tab('stock'); await snap('m-04-stock', 'มือถือ — สต็อก', 'มือถือ', ph);
    await ph.click('.mseg [data-t=count]'); await ph.waitForTimeout(700); await snap('m-05-count', 'มือถือ — ตรวจนับ', 'มือถือ', ph);
    await ph.click('.mseg [data-t=receive]'); await ph.waitForTimeout(700); await snap('m-06-receive', 'มือถือ — รับสินค้า', 'มือถือ', ph);
    await ph.click('.mseg [data-t=expiry]'); await ph.waitForTimeout(700); await snap('m-07-expiry', 'มือถือ — หมดอายุ', 'มือถือ', ph);
  });
  await pstep('products', async () => {
    await tab('products'); await snap('m-08-products', 'มือถือ — สินค้า', 'มือถือ', ph);
    await ph.click('#prows .prod-grid >> nth=0'); await ph.waitForTimeout(700); await snap('m-09-product', 'มือถือ — แก้ไขสินค้า', 'มือถือ', ph);
    await ph.click('[data-ed=cancel], [data-act=edClose]').catch(() => {});
  });
  await pstep('reports', async () => { await tab('reports'); await ph.waitForTimeout(800); await snap('m-10-reports', 'มือถือ — รายงาน', 'มือถือ', ph); });
  await pstep('settings', async () => {
    await tab('home'); await ph.click('[data-act=go][data-v=settings]'); await ph.waitForTimeout(700);
    await snap('m-12-settings', 'มือถือ — ตั้งค่า', 'มือถือ', ph);
    await ph.click('.set-nav [data-t=net]'); await ph.waitForTimeout(1000);
    await snap('m-13-net', 'มือถือ — เพิ่ม Whitelist ด้วย MAC', 'มือถือ', ph);
  });

  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(shots, null, 1));
  console.log('shots', shots.length, 'fails', fails.length);
  fails.forEach(f => console.log('  FAIL', f));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
