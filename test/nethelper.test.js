// The router helper (PowerShell) against the pretend router: pair, read, allow, block, whitelist on/off, test, probe.
'use strict';
const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const startRouter = require('./routermock');
const PWSH = process.env.PWSH || 'pwsh';
(async () => {
  const r = await startRouter();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emnet-'));
  fs.copyFileSync(path.join(__dirname, '..', 'tools', 'windows', 'net-profile.json'), path.join(dir, 'net-profile.json'));
  const port = 18765 + Math.floor(Math.random() * 500);
  const ps = spawn(PWSH, ['-NoProfile', '-File', path.join(__dirname, '..', 'tools', 'windows', 'EarthMart-NetHelper.ps1'), '-Port', String(port), '-Dir', dir], { stdio: 'inherit' });
  const H = 'http://127.0.0.1:' + port;
  let key = '';
  const call = async (p, body, k) => {
    const res = await fetch(H + p, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, k !== undefined ? { 'X-EM-Key': k } : key ? { 'X-EM-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
    return Object.assign(await res.json(), { status: res.status });
  };
  for (let i = 0; i < 60; i++) { try { await call('/ping'); break; } catch (e) { await new Promise(x => setTimeout(x, 500)); } }
  try {
    let p = await call('/ping');
    assert.strictEqual(p.configured, false, 'not set up yet');
    const bad = await call('/pair', { host: '127.0.0.1:' + r.port, user: 'admin', pass: 'nope' });
    assert.ok(!bad.ok && /login failed/.test(bad.error), 'wrong router password refused');
    const pr = await call('/pair', { host: '127.0.0.1:' + r.port, user: 'admin', pass: 'secret' });
    assert.ok(pr.ok && pr.key, 'paired, got a key');
    key = pr.key;
    assert.deepStrictEqual(pr.devices.map(d => [d.mac, d.ip, d.name]), [['3C:52:82:1A:4F:09', '192.168.1.20', 'POS-PC'], ['A4:83:E7:22:91:BC', '192.168.1.34', 'Earth-phone'], ['D2:6F:3B:90:AE:14', '192.168.1.57', 'HUAWEI-P30']], 'connected devices read');
    assert.strictEqual((await call('/state', null, 'wrong')).status, 401, 'key required');
    let s = await call('/allow', { mac: '3c-52-82-1a-4f-09', name: 'POS หน้าร้าน' });
    assert.deepStrictEqual(s.entries.map(e => e.mac), ['3C:52:82:1A:4F:09'], 'allowed device listed');
    assert.ok(/^EM-|POS/.test(r.st.list[0].name), 'name made router-safe');
    s = await call('/allow', { mac: 'A4:83:E7:22:91:BC', name: 'Earth phone' });
    s = await call('/allow', { mac: 'A4:83:E7:22:91:BC', name: 'Earth phone' });
    assert.strictEqual(s.entries.length, 2, 'allowing twice keeps one entry');
    s = await call('/mode', { enabled: true });
    assert.deepStrictEqual([s.enabled, s.policy, r.st.enabled, r.st.policy], [true, 'white', 1, 1], 'whitelist on');
    s = await call('/block', { mac: 'A4:83:E7:22:91:BC' });
    assert.deepStrictEqual(s.entries.map(e => e.mac), ['3C:52:82:1A:4F:09'], 'blocked device removed');
    const t = await call('/test', {});
    assert.ok(t.ok && t.steps.length === 3, 'self test: read, add, remove');
    assert.strictEqual(r.st.list.length, 1, 'test entry cleaned up');
    r.st.sid = 'someone-else';
    s = await call('/allow', { mac: 'D2:6F:3B:90:AE:14', name: 'P30' });
    assert.ok(s.ok && s.entries.some(e => e.mac === 'D2:6F:3B:90:AE:14'), 'logs in again after the router drops the session');
    s = await call('/block', { mac: 'D2:6F:3B:90:AE:14' });
    r.st.noPageToken = true;
    s = await call('/allow', { mac: 'D2:6F:3B:90:AE:14', name: 'P30' });
    assert.ok(s.ok && s.entries.some(e => e.mac === 'D2:6F:3B:90:AE:14'), 'token found elsewhere when the page has none');
    s = await call('/block', { mac: 'D2:6F:3B:90:AE:14' });
    assert.ok(s.ok && !s.entries.some(e => e.mac === 'D2:6F:3B:90:AE:14'), 'remove works with the other token source');
    r.st.noPageToken = false;
    s = await call('/mode', { enabled: false });
    assert.strictEqual(s.enabled, false, 'whitelist off');
    const pb = await call('/probe', {});
    assert.ok(pb.ok && pb.pages >= 3 && pb.macPages.length >= 1, 'probe saves pages');
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'net-config.json'), 'utf8'));
    assert.ok(!JSON.stringify(cfg).includes('secret'), 'password not stored in plain text');
    console.log('Net helper test passed');
  } finally { ps.kill(); r.server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
