// Builds web/macvendors.js from the IEEE OUI registry (npm package oui-data).
//   npm pack oui-data && tar xzf oui-data-*.tgz && node tools/build-oui.js package/index.json web/macvendors.js
'use strict';
const d = require(require('path').resolve(process.argv[2]));
// [label, type, regex on IEEE org name]
const V = [
 ['Apple','phone',/^Apple, Inc/i], ['Samsung','phone',/^Samsung Electronics/i], ['Xiaomi','phone',/Xiaomi/i],
 ['OPPO','phone',/OPPO|Guangdong Oppo/i], ['vivo','phone',/vivo Mobile/i], ['realme','phone',/Realme/i], ['OnePlus','phone',/OnePlus/i],
 ['HUAWEI','phone',/HUAWEI TECHNOLOGIES|Huawei Device/i], ['HONOR','phone',/Honor Device/i], ['Google','phone',/^Google/i],
 ['Motorola','phone',/Motorola Mobility/i], ['Nokia/HMD','phone',/HMD Global/i], ['Infinix/TECNO','phone',/TECNO|Transsion|Infinix/i],
 ['Sony','phone',/Sony (Mobile|Corporation|Interactive)/i], ['LG','tv',/^LG Electronics/i], ['TCL','tv',/TCL King|TCL Technoly|Shenzhen TCL/i], ['Hisense','tv',/Hisense/i],
 ['Lenovo','pc',/Lenovo|LCFC/i], ['ASUS','pc',/ASUSTek/i], ['Acer','pc',/^Acer/i], ['Dell','pc',/^Dell/i], ['HP','pc',/^Hewlett Packard|^HP Inc/i],
 ['MSI','pc',/Micro-Star/i], ['Intel (การ์ด WiFi คอม/โน้ตบุ๊ก)','pc',/^Intel Corporate/i], ['Realtek (การ์ดเน็ตคอม)','pc',/Realtek/i], ['Microsoft','pc',/^Microsoft/i],
 ['Liteon (การ์ด WiFi โน้ตบุ๊ก)','pc',/Liteon|Lite-On/i], ['AzureWave (การ์ด WiFi โน้ตบุ๊ก)','pc',/AzureWave/i], ['Gigabyte','pc',/GIGA-BYTE/i],
 ['TP-Link','net',/TP-LINK|TP-Link/i], ['Mercusys','net',/Mercusys/i], ['Tenda','net',/Tenda/i], ['D-Link','net',/D-Link/i], ['Ruijie/Reyee','net',/Ruijie/i],
 ['Hikvision (กล้องวงจรปิด)','cam',/Hikvision/i], ['Dahua (กล้องวงจรปิด)','cam',/Dahua/i], ['EZVIZ (กล้อง)','cam',/EZVIZ/i], ['Imou (กล้อง)','cam',/Imou/i],
 ['Epson (ปริ้นเตอร์)','printer',/Seiko Epson/i], ['Canon (ปริ้นเตอร์)','printer',/^Canon/i], ['Brother (ปริ้นเตอร์)','printer',/Brother Industries/i], ['Xprinter','printer',/Xprinter/i],
 ['SUNMI (เครื่อง POS)','pos',/SUNMI/i], ['PAX (เครื่องรูดบัตร)','pos',/PAX Computer/i], ['Ingenico (เครื่องรูดบัตร)','pos',/Ingenico/i],
 ['Espressif (อุปกรณ์ IoT)','iot',/Espressif/i], ['Tuya (อุปกรณ์สมาร์ทโฮม)','iot',/Tuya/i], ['Amazon','iot',/^Amazon Technologies/i],
 ['Nintendo','game',/Nintendo/i], ['Sony PlayStation','game',/Sony Interactive/i], ['Xbox','game',/Microsoft Xbox/i],
 ['Raspberry Pi','iot',/Raspberry Pi/i], ['Amlogic (กล่องทีวี)','tv',/Amlogic/i], ['Skyworth (ทีวี)','tv',/Skyworth/i], ['Roku','tv',/^Roku/i],
];
const out = {};
for (const [oui, org] of Object.entries(d)) {
  const name = org.split('\n')[0];
  const v = V.find(x => x[2].test(name));
  if (!v) continue;
  (out[v[0] + '|' + v[1]] = out[v[0] + '|' + v[1]] || []).push(oui.toUpperCase());
}
let n = 0; const lines = Object.entries(out).map(([k, list]) => { n += list.length; return JSON.stringify(k) + ':' + JSON.stringify(list.sort().join('')); });
const js = '// MAC vendor prefixes (IEEE OUI, from the oui-data npm package) for brands seen in a shop. Built by tools/build-oui.js.\nvar MAC_VENDORS = {' + lines.join(',\n') + '};\n';
require('fs').writeFileSync(process.argv[3], js);
console.log(n, 'prefixes', js.length, 'bytes', Object.keys(out).length, 'vendors');
