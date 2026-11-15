// Settings > shop internet: the page + the real PowerShell helper + a pretend AIS router.
'use strict';
const assert = require('assert');
const fs = require('fs'), os = require('os'), http = require('http'), path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { makeContext } = require('./gasmock');
const startRouter = require('./routermock');
const WEB = path.join(__dirname, '..', 'web');
const API = 'https://script.google.com/macros/s/TESTDEPLOY/exec';
const OUT = path.join(__dirname, 'shots');
const DEV = 'Dcounter000000000088';
const PWSH = process.env.PWSH || 'pwsh';
const g = makeContext(); g.setup();
const KEY = g.__props.API_KEY;
g.createOwner('เอิร์ธ', '1234');
const call = (fn, ...a) => { const r = JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ key: KEY, fn, args: a }) } }).getContent()); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
const oid = call('status').users[0].userId;
let T = call('login', oid, '1234', DEV).token;
call('registerDevice', T, DEV, 'เครื่อง 1');
call('addUser', call('login', oid, '1234', DEV).token, 'แบงค์', 'cashier', '5555');
// this machine's MAC plays the counter PC, so the page can protect it
const here = Object.values(os.networkInterfaces()).flat().find(i => !i.internal && i.mac && i.mac !== '00:00:00:00:00:00');
const HERE = here ? here.mac.toUpperCase() : '3C:52:82:1A:4F:09';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(WEB, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/$/, '/index.html'));
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': (types[path.extname(f)] || 'application/octet-stream') + ';charset=utf-8' }); res.end(fs.readFileSync(f));
});
(async () => {
  const r = await startRouter({ devices: [['192.168.1.20', HERE, 'DESKTOP-POS', 'Online'], ['192.168.1.34', 'A4:83:E7:22:91:BC', 'Earth-phone', 'Online'], ['192.168.1.57', 'D2:6F:3B:90:AE:14', 'HUAWEI-P30', 'Online'], ['192.168.1.63', '7A:11:C8:5D:02:E9', 'iPhone', 'Online']] });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emnet-'));
  fs.copyFileSync(path.join(__dirname, '..', 'tools', 'windows', 'net-profile.json'), path.join(dir, 'net-profile.json'));
  const port = 19000 + Math.floor(Math.random() * 500);
  const ps = spawn(PWSH, ['-NoProfile', '-File', path.join(__dirname, '..', 'tools', 'windows', 'EarthMart-NetHelper.ps1'), '-Port', String(port), '-Dir', dir], { stdio: 'inherit' });
  await new Promise(x => server.listen(0, '127.0.0.1', x));
  const SITE = 'http://localhost:' + server.address().port + '/';
  for (let i = 0; i < 60; i++) { try { await fetch('http://127.0.0.1:' + port + '/ping'); break; } catch (e) { await new Promise(x => setTimeout(x, 500)); } }
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 800 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  global.__fail = async () => { try { await page.screenshot({ path: path.join(OUT, 'n-fail.png') }); } catch (e) { /* none */ } };
  await page.addInitScript(([dev, url]) => { localStorage.setItem('em_device', dev); window.EM_TEST = true; window.EM_NET_URL = url; window.print = () => {}; }, [DEV, 'http://127.0.0.1:' + port]);
  await ctx.route(API + '*', rt => rt.fulfill({ status: 200, contentType: 'application/json', body: g.doPost({ postData: { contents: rt.request().postData() } }).getContent(), headers: { 'access-control-allow-origin': '*' } }));
  await ctx.route(/fonts\.g/, rt => rt.fulfill({ contentType: 'text/css', body: '' }));
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });
  try {
    await page.goto(SITE + '#connect=' + encodeURIComponent(Buffer.from(JSON.stringify({ url: API, key: KEY })).toString('base64')));
    await page.waitForSelector('.login');
    await page.click('[data-act=pickUser]:has-text("เอิร์ธ")');
    for (const d of '1234') await page.click('.pinpad [data-k="' + d + '"]');
    await page.waitForSelector('[data-form=openShift]');
    await page.click('nav button[data-v=settings]');
    await page.click('[data-act=setTab][data-t=net]');
    // a fresh captcha picture: returns the letters the pretend router expects
    const until = async f => { for (let i = 0; i < 100 && !f(); i++) await new Promise(x => setTimeout(x, 100)); assert.ok(f(), 'timed out'); };
    const fresh = async trigger => {
      const n = r.st.codes || 0;
      await trigger();
      await until(() => (r.st.codes || 0) > n);
      await page.waitForFunction(() => /^data:/.test((document.querySelector('#net-capimg') || {}).src || ''));
      await new Promise(x => setTimeout(x, 300));
      return r.st.code;
    };
    // 1. connect with the router password + captcha
    await page.waitForSelector('#net-pass');
    await page.fill('#net-host', '127.0.0.1:' + r.port);
    await page.fill('#net-pass', 'wrong');
    await page.fill('#net-code', await fresh(() => page.click('[data-act=netCap]')));
    let code = await fresh(() => page.click('[data-act=netPair]'));
    await page.waitForSelector('.toast:has-text("ล็อกอินไม่ผ่าน")');
    await shot('n0-captcha');
    await page.fill('#net-pass', 'secret');
    await page.fill('#net-code', code);
    await page.click('[data-act=netPair]');
    await page.waitForSelector('.net-newrow');
    assert.strictEqual(await page.$$eval('.net-newrow', x => x.length), 4, 'all connected devices show up as new');
    await shot('n1-new-devices');
    // 2. allow this PC and the owner's phone, decline one
    await page.click('.net-newrow:has-text("DESKTOP-POS") [data-act=netNew]');
    await page.fill('#nd-name', 'POS หน้าร้าน');
    await page.click('.chip-radio label:has-text("คอม")');
    await page.click('.modal [data-x=ok]');
    await page.waitForSelector('.net-table :text("POS หน้าร้าน")');
    await page.click('.net-newrow:has-text("Earth-phone") [data-act=netNew]');
    await page.fill('#nd-name', 'มือถือเอิร์ธ');
    await page.check('#nd-lock');
    await page.click('.modal [data-x=ok]');
    await page.waitForSelector('.net-table :text("มือถือเอิร์ธ")');
    await page.click('.net-newrow:has-text("iPhone") [data-act=netNew]');
    await page.fill('#nd-name', 'มือถือแบงค์');
    await page.click('.chip-radio label:has-text("แบงค์")');
    await shot('n2-name-device');
    await page.click('.modal [data-x=ok]');
    await page.waitForSelector('.net-table :text("มือถือแบงค์")');
    await page.click('.net-newrow:has-text("HUAWEI-P30") [data-act=netDecline]');
    await page.waitForFunction(() => !document.querySelector('.net-newrow'));
    assert.deepStrictEqual(r.st.list.map(e => e.mac).sort(), [HERE, 'A4:83:E7:22:91:BC', '7A:11:C8:5D:02:E9'].sort(), 'router whitelist has the allowed devices');
    // 3. whitelist on (with the safety check)
    await page.click('[data-act=netMode]');
    await page.waitForSelector('.modal h1:has-text("เปิดระบบ Whitelist")');
    await shot('n3-enable-check');
    await page.click('.modal [data-x=ok]');
    await page.waitForSelector('.switch.big.on');
    assert.deepStrictEqual([r.st.enabled, r.st.policy], [1, 1], 'router filter on, whitelist mode');
    // 4. this PC cannot be switched off; the cashier's phone can
    assert.ok(await page.$('tr:has-text("POS หน้าร้าน") .switch[disabled]'), 'this PC is protected');
    await page.click('tr:has-text("มือถือแบงค์") [data-act=netToggle]');
    await page.waitForSelector('tr:has-text("มือถือแบงค์") .switch:not(.on)');
    assert.ok(!r.st.list.some(e => e.mac === '7A:11:C8:5D:02:E9'), 'blocked phone removed from the router list');
    await shot('n4-whitelist-on');
    const saved = call('netDevices', T);
    assert.deepStrictEqual(saved.map(d => [d.name, d.allowed]).sort(), [['HUAWEI-P30', false], ['POS หน้าร้าน', true], ['มือถือเอิร์ธ', true], ['มือถือแบงค์', false]].sort(), 'names kept in the shop sheet');
    // 5. the router drops the session (someone opened 192.168.1.1): log in again with the captcha
    r.st.sid = 'someone-else';
    code = await fresh(() => page.click('[data-act=netReload]'));
    await page.waitForSelector('h2:has-text("ล็อกอินเราเตอร์")');
    await page.fill('#net-code', code);
    await page.click('[data-act=netLogin]');
    await page.waitForSelector('.net-table :text("มือถือแบงค์")');
    // 6. self test from the connection settings
    await page.click('[data-act=netSetup]');
    await page.click('.modal [data-x=test]');
    await page.waitForSelector('#net-out:has-text("ผ่าน")');
    await page.click('.modal [data-x=no]');
    assert.deepStrictEqual(errs, [], 'no page errors');
    console.log('Net UI test passed');
  } finally { ps.kill(); r.server.close(); await b.close(); server.close(); }
})().catch(async e => { console.error(e.message.split('\n').slice(0, 3).join('\n'), (e.stack.match(/net.test.js:(\d+)/) || [])[1]); if (global.__fail) await global.__fail(); process.exit(1); });
