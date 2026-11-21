// Demo shop for screenshots: realistic products, two weeks of sales, receiving, expenses, payables, promos.
// Runs entirely on the Apps Script mock (no real data involved).
'use strict';
const { makeContext } = require('../../test/gasmock');

const DAYS = 14;
const END = new Date('2026-11-21T03:00:00Z');                 // "now" = 10:00 Bangkok on the last day
const START = new Date(END.getTime() - DAYS * 86400000 - 3 * 3600000);  // 07:00 Bangkok, 14 days earlier

// sku,name,category,subcategory,type,unit,cost,price,openingStock,barcode,quickKey,plu,weight(popularity)
const ITEMS = [
  ['D001', 'โค้ก กระป๋อง 325 มล.', 'เครื่องดื่ม', 'น้ำอัดลม', 'barcode', 'กระป๋อง', 11.5, 17, 48, '8851959132012', 'y', '', 9],
  ['D002', 'เป๊ปซี่ 345 มล.', 'เครื่องดื่ม', 'น้ำอัดลม', 'barcode', 'กระป๋อง', 10.8, 16, 36, '8858998581139', 'y', '', 6],
  ['D003', 'สไปรท์ 325 มล.', 'เครื่องดื่ม', 'น้ำอัดลม', 'barcode', 'กระป๋อง', 11.5, 17, 24, '8851959132036', 'y', '', 4],
  ['D004', 'เอ็ม-150', 'เครื่องดื่ม', 'ชูกำลัง', 'barcode', 'ขวด', 8.6, 12, 60, '8851123212021', 'y', '', 10],
  ['D005', 'คาราบาวแดง', 'เครื่องดื่ม', 'ชูกำลัง', 'barcode', 'ขวด', 8.6, 12, 60, '8852117000107', 'y', '', 9],
  ['D006', 'ลิโพ', 'เครื่องดื่ม', 'ชูกำลัง', 'barcode', 'ขวด', 8.9, 12, 30, '8851123210010', 'y', '', 4],
  ['D007', 'น้ำดื่มสิงห์ 600 มล.', 'เครื่องดื่ม', 'น้ำดื่ม', 'barcode', 'ขวด', 4.6, 7, 96, '8850999320014', 'y', '', 12],
  ['D008', 'น้ำดื่มคริสตัล 1.5 ลิตร', 'เครื่องดื่ม', 'น้ำดื่ม', 'barcode', 'ขวด', 9.5, 14, 36, '8851952350116', 'y', '', 5],
  ['D009', 'เนสกาแฟ กระป๋อง เอสเปรสโซ', 'เครื่องดื่ม', 'กาแฟกระป๋อง', 'barcode', 'กระป๋อง', 11.2, 17, 30, '8850124022310', 'y', '', 5],
  ['D010', 'เบอร์ดี้ โรบัสต้า', 'เครื่องดื่ม', 'กาแฟกระป๋อง', 'barcode', 'กระป๋อง', 10.5, 15, 30, '8850250005027', 'y', '', 5],
  ['D011', 'โออิชิ กรีนที น้ำผึ้งมะนาว', 'เครื่องดื่ม', 'ชาพร้อมดื่ม', 'barcode', 'ขวด', 13.5, 20, 24, '8851218010019', 'y', '', 5],
  ['D012', 'ดัชมิลล์ นมเปรี้ยว สตรอว์เบอร์รี', 'เครื่องดื่ม', 'นม', 'barcode', 'ขวด', 9, 13, 24, '8851717030104', '', '', 3],
  ['C001', 'กาแฟเย็น', 'เครื่องดื่มชง', 'กาแฟ', 'nobarcode', 'แก้ว', 12, 35, 0, '', 'y', '101', 7],
  ['C002', 'ชาเย็น', 'เครื่องดื่มชง', 'ชา', 'nobarcode', 'แก้ว', 10, 30, 0, '', 'y', '102', 5],
  ['C003', 'โกโก้เย็น', 'เครื่องดื่มชง', 'โกโก้', 'nobarcode', 'แก้ว', 11, 30, 0, '', 'y', '103', 3],
  ['C004', 'น้ำแข็งแก้ว', 'เครื่องดื่มชง', 'น้ำแข็ง', 'nobarcode', 'แก้ว', 1.65, 5, 0, '', 'y', '201', 6],
  ['S001', 'เลย์ รสโนริสาหร่าย 48 ก.', 'ขนม', 'มันฝรั่ง', 'barcode', 'ซอง', 14.5, 20, 24, '8850718801213', 'y', '', 5],
  ['S002', 'เลย์ คลาสสิค 48 ก.', 'ขนม', 'มันฝรั่ง', 'barcode', 'ซอง', 14.5, 20, 24, '8850718801206', 'y', '', 4],
  ['S003', 'ปาปริก้า ข้าวเกรียบกุ้ง', 'ขนม', 'ข้าวเกรียบ', 'barcode', 'ซอง', 7.2, 10, 30, '8851613101015', 'y', '', 4],
  ['S004', 'ทาโร่ ปลาเส้น รสเข้มข้น', 'ขนม', 'ปลาเส้น', 'barcode', 'ซอง', 15, 22, 20, '8852144000017', '', '', 3],
  ['S005', 'โก๋แก่ ถั่วลิสงอบเกลือ', 'ขนม', 'ถั่ว', 'barcode', 'ซอง', 7, 10, 30, '8850250002019', '', '', 3],
  ['S006', 'ฟาร์มเฮ้าส์ ขนมปังไส้สังขยา', 'ขนม', 'ขนมปัง', 'barcode', 'ชิ้น', 9.5, 14, 18, '8850123110018', 'y', '', 5],
  ['S007', 'ยูโร่ คัสตาร์ดเค้ก', 'ขนม', 'เค้ก', 'barcode', 'กล่อง', 36, 50, 10, '8850291110011', '', '', 2],
  ['N001', 'มาม่า ต้มยำกุ้ง', 'อาหารแห้ง', 'บะหมี่กึ่งสำเร็จรูป', 'barcode', 'ซอง', 5.3, 7, 60, '8850987101021', 'y', '', 7],
  ['N002', 'ไวไว ปรุงสำเร็จ', 'อาหารแห้ง', 'บะหมี่กึ่งสำเร็จรูป', 'barcode', 'ซอง', 5, 7, 40, '8850100010014', '', '', 3],
  ['N003', 'มาม่า คัพ หมูสับ', 'อาหารแห้ง', 'บะหมี่ถ้วย', 'barcode', 'ถ้วย', 10, 15, 24, '8850987140013', 'y', '', 4],
  ['N004', 'ปลากระป๋อง สามแม่ครัว', 'อาหารแห้ง', 'อาหารกระป๋อง', 'barcode', 'กระป๋อง', 15, 20, 20, '8850039100015', '', '', 2],
  ['P001', 'ทิชชู่ เซลล็อกซ์ ห่อเล็ก', 'ของใช้', 'กระดาษทิชชู่', 'barcode', 'ห่อ', 13, 20, 20, '8850122001010', '', '', 2],
  ['P002', 'ยาสีฟัน คอลเกต 35 ก.', 'ของใช้', 'ดูแลช่องปาก', 'barcode', 'หลอด', 18, 25, 12, '8850006320016', '', '', 1],
  ['P003', 'แชมพู ซันซิล ซอง', 'ของใช้', 'ดูแลเส้นผม', 'barcode', 'ซอง', 4, 6, 48, '8851932300012', '', '', 2],
  ['P004', 'ถ่าน พานาโซนิค AA (2 ก้อน)', 'ของใช้', 'ไฟฟ้า', 'barcode', 'แพ็ค', 18, 25, 12, '8887549100012', '', '', 1],
  ['T001', 'ไฟแช็ค คริกเก็ต', 'ของใช้', 'ไฟแช็ค', 'barcode', 'อัน', 13, 20, 24, '5900000000017', '', '', 2],
  ['G001', 'น้ำมันเครื่อง 2T ขวดเล็ก', 'รถ', 'น้ำมันเครื่อง', 'barcode', 'ขวด', 40, 55, 12, '8850000200013', '', '', 1],
  ['G002', 'ผ้าเช็ดรถ ไมโครไฟเบอร์', 'รถ', 'อุปกรณ์ล้างรถ', 'barcode', 'ผืน', 25, 39, 10, '8850000300010', '', '', 1]
];

function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

function seed() {
  const g = makeContext({ now: START.toISOString() });
  g.setup();
  const KEY = g.__props.API_KEY;
  const call = (fn, ...args) => JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ key: KEY, fn, args }) } }).getContent());
  const ok = (fn, ...args) => { const r = call(fn, ...args); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  const R = rng(20261121);
  const pick = arr => arr[Math.floor(R() * arr.length)];

  g.createOwner('เอิร์ธ', '1234');
  const DEV = 'Dcounter000000000021';
  const ownerId = ok('status').users[0].userId;
  let T = ok('login', ownerId, '1234', DEV).token;
  ok('registerDevice', T, DEV, 'เครื่องหน้าร้าน');
  ok('registerDevice', T, 'Dcounter000000000022', 'แท็บเล็ตหลังร้าน');
  T = ok('login', ownerId, '1234', DEV).token;
  ok('addUser', T, 'มิว', 'cashier', '2222');
  ok('addUser', T, 'ฝน', 'cashier', '3333');
  ok('saveSettings', T, { shopName: 'EarthMart', shopAddress: 'ในปั๊มแก๊ส ถ.มิตรภาพ', promptPayId: '0812345678', receiptFooter: 'ขอบคุณที่อุดหนุนค่ะ', customerWelcome: 'ยินดีต้อนรับค่ะ' });
  ok('accSetup', T, { start: START.toISOString().slice(0, 10), wallets: [
    { walletId: 'WRESERVE', name: 'เงินสดสำรอง', type: 'reserve', opening: 5000 },
    { walletId: 'WBANK', name: 'กสิกร', type: 'bank', opening: 30000, receivesQr: true }] });
  const csv = ['sku,name,category,subcategory,type,unit,cost,price,minStock,openingStock,barcode,barcodeUnit,multiplier,quickKey,plu'];
  ITEMS.forEach(i => csv.push([i[0], i[1], i[2], i[3], i[4], i[5], i[6], i[7], '', i[8], i[9], i[9] ? 'ชิ้น' : '', i[9] ? 1 : '', i[10], i[11]].join(',')));
  csv.push('D007,,,,,,,,,,8850999320021,แพ็ค,12,,');
  ok('importProducts', T, csv.join('\n'));
  // recipe: ice + cup set; promotions
  const P = () => Object.fromEntries(ok('listProducts', T).map(p => [p.sku, p]));
  ok('savePromo', T, { name: 'เอ็ม-150 / คาราบาว 3 ขวด 33', type: 'multi', active: true, items: ['D004', 'D005'], buyQty: 3, price: 33 });
  ok('savePromo', T, { name: 'ขนมปังลด 20% หลัง 18:00', type: 'single', active: true, items: ['S006'], discType: 'pct', value: 20, timeFrom: '18:00', timeTo: '23:59' });
  ok('savePromo', T, { name: 'กาแฟเย็น + ขนมปัง 45', type: 'combo', active: true, items: [{ sku: 'C001', qty: 1 }, { sku: 'S006', qty: 1 }], price: 45 });

  const pool = [];
  ITEMS.forEach(i => { for (let k = 0; k < i[12]; k++) pool.push(i[0]); });
  const prices = Object.fromEntries(ITEMS.map(i => [i[0], i[7]]));
  const cashierIds = () => ok('listUsers', T).filter(u => u.role === 'cashier').map(u => u.userId);
  let bill = 0;
  const customers = [{ customerId: 'CU-RED', name: 'ป้าแดง' }, { customerId: 'CU-WIN', name: 'พี่วินมอไซค์' }];

  for (let d = 0; d <= DAYS; d++) {
    const dayStart = START.getTime() + d * 86400000;
    g.__advance(dayStart - g.now_().getTime());
    T = ok('login', ownerId, '1234', DEV).token;
    const cid = d % 2 ? cashierIds()[0] : cashierIds()[1];
    const pin = d % 2 ? '2222' : '3333';
    // receiving every 3 days in the morning
    if (d % 3 === 1) {
      const stock = P(), lines = [];
      ITEMS.filter(i => i[4] === 'barcode').forEach(i => { if ((stock[i[0]].onHand || 0) < 20 && R() < 0.8) lines.push({ sku: i[0], qty: 24, unitCost: i[6] }); });
      if (lines.length) ok('receive', T, { receiptUid: 'RC' + d, supplier: d % 2 ? 'แม็คโคร' : 'เอเย่นต์เครื่องดื่ม', payFrom: d % 6 === 1 ? 'credit' : 'WBANK', dueDate: d % 6 === 1 ? '2026-11-30' : '', lines });
    }
    if (d % 7 === 2) ok('saveExpense', T, { expUid: 'EXI' + d, date: new Date(dayStart + 7 * 3600000).toISOString().slice(0, 10), category: 'น้ำแข็ง', amount: 240, payFrom: 'WRESERVE', note: 'น้ำแข็งถุงใหญ่' });
    if (d === 5) ok('saveExpense', T, { expUid: 'EXE', date: new Date(dayStart + 7 * 3600000).toISOString().slice(0, 10), category: 'ค่าไฟ / น้ำ', amount: 2860, payFrom: 'WBANK', note: 'ค่าไฟ ต.ค.' });
    if (d === 9) ok('saveExpense', T, { expUid: 'EXR', date: new Date(dayStart + 7 * 3600000).toISOString().slice(0, 10), category: 'ซ่อมบำรุง', amount: 450, payFrom: 'credit', party: 'ช่างแอร์วิทย์', dueDate: '2026-11-28' });

    const TC = ok('login', cid, pin, DEV).token;
    ok('openShift', TC, d ? 1000 : 1000, '', { source: 'owner' });
    const last = d === DAYS;
    const n = last ? 9 : 26 + Math.floor(R() * 18);
    const span = last ? 3 * 3600000 : 13 * 3600000;
    for (let s = 0; s < n; s++) {
      g.__advance(span / n * (0.6 + R() * 0.8));
      const lines = [];
      const k = 1 + Math.floor(R() * (R() < 0.3 ? 4 : 2));
      for (let j = 0; j < k; j++) {
        const sku = pick(pool), ex = lines.find(l => l.sku === sku);
        if (ex) ex.qty++; else lines.push({ sku, qty: R() < 0.2 ? 2 : 1 });
      }
      const total = lines.reduce((a, l) => a + prices[l.sku] * l.qty, 0);
      const r = R();
      const sale = { saleUid: 'S' + (++bill), lines };
      if (r < 0.04) { sale.payMethod = 'credit'; sale.customer = pick(customers); }
      else if (r < 0.4) sale.payMethod = 'qr';
      else { sale.payMethod = 'cash'; sale.received = total <= 20 ? 20 : total <= 50 ? 50 : total <= 100 ? 100 : Math.ceil(total / 100) * 100; }
      ok('commitSale', TC, sale);
    }
    if (!last) {
      if (d % 4 === 3) ok('cashMove', TC, 'OUT', 60, 'ค่าน้ำแข็ง', { kind: 'expense', category: 'น้ำแข็ง' });
      g.__advance(20 * 60000);
      const sum = ok('shiftSummary', TC);
      ok('closeShift', TC, sum.expectedCash - (d === 6 ? 20 : 0), d === 6 ? 'เงินขาด 20 บาท' : '', { floatLeft: 1000, depositTo: 'WBANK' });
    }
  }
  T = ok('login', ownerId, '1234', DEV).token;
  const ymd = ms => new Date(END.getTime() + ms * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
  ok('receive', T, { receiptUid: 'RCEXP', supplier: 'ฟาร์มเฮ้าส์', payFrom: 'WRESERVE', lines: [
    { sku: 'S006', qty: 12, unitCost: 9.5, expiryDate: ymd(1) }, { sku: 'D012', qty: 12, unitCost: 9, expiryDate: ymd(3) },
    { sku: 'S007', qty: 6, unitCost: 36, expiryDate: ymd(-1) }, { sku: 'D007', qty: 24, unitCost: 4.6, expiryDate: ymd(300) }] });
  ok('custPay', T, { payUid: 'CP1', customerId: 'CU-RED', amount: 50, method: 'cash' });
  ok('writeOff', T, { sku: 'S006', qty: 2, reason: 'หมดอายุ' });
  ok('saveNetDevice', T, { mac: '3C:52:82:1A:4F:09', name: 'POS หน้าร้าน', type: 'pc', locked: true, allowed: true });
  ok('saveNetDevice', T, { mac: 'D2:6F:3B:90:AE:14', name: 'มือถือเจ้าของ', type: 'phone', locked: true, allowed: true });
  ok('saveNetDevice', T, { mac: 'A4:83:E7:22:91:BC', name: 'แท็บเล็ตจอลูกค้า', type: 'tablet', allowed: true });
  ok('saveNetDevice', T, { mac: '9C:B6:D0:11:22:33', name: 'มือถือมิว', type: 'phone', pending: 'allow' });
  // live since the start; opening stock done (the opening-mode screen is shown separately)
  g.saveSettingRaw_('liveSince', START.toISOString().slice(0, 10) + ' 07:00');
  g.saveSettingRaw_('openingDone', '1');
  return { g, KEY, DEV, ownerId };
}

module.exports = { seed, END };
