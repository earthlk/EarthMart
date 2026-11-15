// Device brand / model / owner guessed from the MAC prefix and the name a phone gives itself (shop internet page).
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const vm = require('vm');
global.window = global;
global.esc = s => String(s);
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../web/macvendors.js'), 'utf8'));
const src = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
vm.runInThisContext(src.slice(src.indexOf('function netRandomMac'), src.indexOf('\n', src.indexOf('function netTypeFromInfo'))));
const t = (host, mac) => netMacInfoText({ info: netMacInfo(mac, host) }).replace(/<\/?b>/g, '');
// names as the AIS router lists them
assert.strictEqual(t('supaporn-s-Z-Flip6', '46:6B:60:A4:95:88'), 'Samsung Galaxy Z Flip6 · ของ supaporn · น่าจะเป็นมือถือ');
assert.strictEqual(t('Galaxy-A12', 'FA:F6:33:28:8F:11'), 'Samsung Galaxy A12 · น่าจะเป็นมือถือ');
assert.strictEqual(t('OPPO-A97-5G', '62:71:BA:E7:C3:FB'), 'OPPO A97 5G · น่าจะเป็นมือถือ');
assert.strictEqual(t('V2111', '62:62:AC:A1:85:64'), 'vivo (รหัสรุ่น V2111) · น่าจะเป็นมือถือ');
assert.strictEqual(t('DESKTOP-JHDC1VU', '30:DE:4B:2D:B7:81'), 'คอม Windows · TP-Link (ตัวรับ WiFi) · น่าจะเป็นคอม / โน้ตบุ๊ก');
assert.strictEqual(t('phngskr-s-S26-Ultra', '3A:08:B3:89:CB:6B'), 'Samsung Galaxy S26 Ultra · ของ phngskr · น่าจะเป็นมือถือ');
assert.strictEqual(t('Bank-s-iPhone', '7A:11:C8:5D:02:E9'), 'iPhone · ของ Bank · น่าจะเป็นมือถือ');
assert.strictEqual(t('', 'A4:83:E7:22:91:BC'), 'Apple · น่าจะเป็น iPhone / iPad / Mac');
assert.strictEqual(t('', 'D2:6F:3B:90:AE:14'), 'น่าจะเป็นมือถือ · MAC แบบสุ่ม (มือถือรุ่นใหม่) — ดูยี่ห้อจาก MAC ไม่ได้');
assert.strictEqual(netSuggestName({ host: 'supaporn-s-Z-Flip6', info: netMacInfo('46:6B:60:A4:95:88', 'supaporn-s-Z-Flip6') }), 'Samsung Galaxy Z Flip6 ของ supaporn');
assert.strictEqual(netSuggestName({ host: 'DESKTOP-JHDC1VU', info: netMacInfo('30:DE:4B:2D:B7:81', 'DESKTOP-JHDC1VU') }), 'DESKTOP-JHDC1VU');
console.log('MAC info test passed');
