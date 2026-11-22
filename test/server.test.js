// End-to-end test of the Apps Script API through doPost, against an in-memory Sheets mock.
'use strict';
const assert = require('assert');
const { makeContext } = require('./gasmock');

const g = makeContext({ now: '2026-11-03T03:00:00Z' }); // 10:00 Bangkok
let pass = 0;
const round = n => Math.round(n * 100) / 100;
const ok = (cond, msg) => { assert.ok(cond, msg); pass++; };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); pass++; };

let KEY = '';
function call(fn, ...args) {
  const out = g.doPost({ postData: { contents: JSON.stringify({ key: KEY, fn, args }) } });
  return JSON.parse(out.getContent());
}
function must(fn, ...args) {
  const r = call(fn, ...args);
  if (!r.ok) throw new Error(fn + ' failed: ' + r.error);
  return r.data;
}
function mustFail(re, fn, ...args) {
  const r = call(fn, ...args);
  ok(!r.ok && re.test(r.error), fn + ' should fail with ' + re + ' but got ' + JSON.stringify(r));
}

// --- setup
const msg = g.setup();
KEY = g.__props.API_KEY;
ok(KEY && KEY.length === 32 && msg.includes(KEY), 'setup creates API key');
ok(!g.__ss.getSheetByName('Sheet1'), 'Sheet1 removed');
eq(JSON.parse(g.doGet().getContent()).ok, true, 'doGet alive');

// --- key + router
const saveKey = KEY; KEY = 'wrong';
eq(call('status').code, 'BAD_KEY', 'bad key rejected'); KEY = saveKey;
mustFail(/ไม่มีคำสั่ง/, 'nope');
mustFail(/ไม่มีคำสั่ง/, 'status;x');
ok(JSON.parse(g.doPost({ postData: { contents: '{bad' } }).getContent()).ok === false, 'bad json');

let st = must('status');
eq(st.ready, false, 'not ready before owner');
g.createOwner('เอิร์ธ', '1234');
st = must('status');
eq(st.ready, true, 'ready'); eq(st.users.length, 1, '1 user');
ok(!('lineChannelToken' in st.settings), 'token hidden from public settings');
const ownerId = st.users[0].userId;

// --- login
const DEV = 'Dcounter000000000001';
mustFail(/PIN/, 'login', ownerId, '9999', DEV);
const { token: T } = must('login', ownerId, '1234', DEV);
ok(T, 'owner token');
mustFail(/เข้าสู่ระบบ/, 'bootstrap', 'bad-token');

// --- device not registered: cannot open shift
mustFail(/เครื่องหน้าร้าน|ลงทะเบียน/, 'openShift', T, 500, '');
must('registerDevice', T, DEV, 'เครื่อง 1');
// session carries deviceId; register makes it a counter
let boot = must('bootstrap', T);
eq(boot.isCounter, true, 'counter after register');

// --- settings
must('saveSettings', T, { shopName: 'EarthMart ปั๊ม', promptPayId: '0812345678', lineChannelToken: 'tok', lineTargetId: 'U1' });
mustFail(/พร้อมเพย์/, 'saveSettings', T, { promptPayId: '123' });
eq(must('getSettings', T).lineChannelToken, '••••••', 'token masked');

// --- products via CSV (EAN per unit) + quick keys
const csv = [
  'sku,name,category,type,unit,cost,price,minStock,openingStock,barcode,barcodeUnit,multiplier,barcodePrice,quickKey,quickKeyGroup,openPrice,plu',
  'W0001,น้ำดื่ม 600 มล.,เครื่องดื่ม,barcode,ขวด,4.2,7,48,186,08851234567890,ชิ้น,1,,,,,',
  'W0001,,,,,,,,,8851234567906,แพ็ค,12,80,,,,',
  'W0001,,,,,,,,,8851234567913,ลัง,24,,,,,',
  'D0101,น้ำแข็งแก้ว,เครื่องดื่มชง,nobarcode,แก้ว,1.65,5,0,,,,,,y,น้ำแข็ง,,101',
  'D0200,ข้าวเหนียวหมู,อาหาร,nobarcode,ห่อ,10,0,0,,,,,,y,อาหาร,y,'
].join('\n');
const imp = must('importProducts', T, csv);
eq([imp.created, imp.errors.length], [3, 0], 'import created 3: ' + JSON.stringify(imp.errors));
boot = must('bootstrap', T);
const water = boot.products.find(p => p.sku === 'W0001');
eq(water.onHand, 186, 'opening stock');
eq(boot.barcodes.filter(b => b.sku === 'W0001').length, 3, '3 barcodes for water');
ok(boot.barcodes.some(b => b.barcode === '08851234567890'), 'leading zero kept');
eq(boot.products.find(p => p.sku === 'D0101').plu, '101', 'PLU as string');
// re-import does not add opening stock again
must('importProducts', T, csv);
eq(must('bootstrap', T).products.find(p => p.sku === 'W0001').onHand, 186, 'no double opening stock');

// saveProduct validation + internal barcode
mustFail(/ชื่อ/, 'saveProduct', T, { name: '', price: 1 }, []);
const ib = must('newInternalBarcode', T);
ok(/^20\d{11}$/.test(ib), 'internal EAN13 ' + ib);
const sv = must('saveProduct', T, { name: 'ไข่ต้ม', category: 'อาหาร', price: 8, cost: 5, unit: 'ฟอง' }, [{ barcode: ib, unitName: 'ฟอง', multiplier: 1 }]);
mustFail(/ซ้ำ|ใช้กับสินค้า/, 'saveProduct', T, { name: 'ซ้ำ', price: 1 }, [{ barcode: ib, unitName: 'ชิ้น', multiplier: 1 }]);

// --- no shift: no sale
mustFail(/กะ/, 'commitSale', T, { saleUid: 'X0', lines: [{ sku: 'W0001', barcode: '08851234567890', qty: 1 }], payMethod: 'cash', received: 10 });

// --- open shift
const sh = must('openShift', T, 500, '');
ok(sh.shiftId, 'shift opened');
mustFail(/เปิด/, 'openShift', T, 500, '');

// --- cashier user
must('addUser', T, 'น้องมิว', 'cashier', '5678');
const mew = must('listUsers', T).find(u => u.name === 'น้องมิว');
const { token: C } = must('login', mew.userId, '5678', DEV);
mustFail(/เจ้าของ/, 'dailyReport', C, '2026-11-03');

// sale 1: cash, pack price 80 + 2 pieces, by cashier. Client-side price tampering ignored.
const r1 = must('commitSale', C, { saleUid: 'S1', payMethod: 'cash', received: 100,
  lines: [{ sku: 'W0001', barcode: '8851234567906', qty: 1, unitPrice: 1 }, { sku: 'W0001', barcode: '08851234567890', qty: 2 }] });
eq(r1.total, 94, 'pack 80 + 2x7');
eq(r1.change, 6, 'change');
ok(/^2611-000001$/.test(r1.billNo), 'bill no ' + r1.billNo);
eq(must('bootstrap', T).products.find(p => p.sku === 'W0001').onHand, 186 - 14, 'stock -14 pieces');
// idempotent retry
eq(must('commitSale', C, { saleUid: 'S1', payMethod: 'cash', received: 100, lines: [{ sku: 'W0001', barcode: '8851234567906', qty: 1 }] }).billNo, r1.billNo, 'same saleUid same bill');
eq(must('bootstrap', T).products.find(p => p.sku === 'W0001').onHand, 172, 'retry did not cut stock');

// not enough cash
mustFail(/ไม่พอ/, 'commitSale', C, { saleUid: 'S2', payMethod: 'cash', received: 1, lines: [{ sku: 'D0101', qty: 1 }] });
// open price required
mustFail(/ราคา/, 'commitSale', C, { saleUid: 'S3', payMethod: 'qr', lines: [{ sku: 'D0200', qty: 1 }] });
// discount needs approval for cashier
mustFail(/อนุมัติ/, 'commitSale', C, { saleUid: 'S4', payMethod: 'qr', billDiscount: 5, lines: [{ sku: 'D0101', qty: 2 }] });
mustFail(/PIN/, 'approve', C, '0000', 'DISCOUNT');
const ap = must('approve', C, '1234', 'DISCOUNT');
const r4 = must('commitSale', C, { saleUid: 'S4', payMethod: 'qr', billDiscount: 5, approvalId: ap.approvalId, lines: [{ sku: 'D0101', qty: 2 }, { sku: 'D0200', qty: 1, unitPrice: 35 }] });
eq([r4.subtotal, r4.discount, r4.total], [45, 5, 40], 'discounted qr sale');
// approval is one-time
mustFail(/อนุมัติ/, 'commitSale', C, { saleUid: 'S5', payMethod: 'qr', billDiscount: 1, approvalId: ap.approvalId, lines: [{ sku: 'D0101', qty: 1 }] });
// transfer sale
const r6 = must('commitSale', C, { saleUid: 'S6', payMethod: 'transfer', lines: [{ sku: sv.sku || must('bootstrap', T).products.find(p => p.name === 'ไข่ต้ม').sku, qty: 3 }] });
eq(r6.total, 24, 'transfer');

// bills + detail
const bills = must('listBills', T, '2026-11-03');
eq(bills.length, 3, '3 bills today');
eq(must('billDetail', T, r1.billNo).lines.length, 2, 'detail lines');

// void with approval
mustFail(/อนุมัติ/, 'voidSale', C, r6.billNo, 'ลูกค้าเปลี่ยนใจ', '');
const av = must('approve', C, '1234', 'VOID');
must('voidSale', C, r6.billNo, 'ลูกค้าเปลี่ยนใจ', av.approvalId);
mustFail(/ยกเลิก/, 'voidSale', T, r6.billNo, 'ซ้ำ', '');
const eggSku = must('bootstrap', T).products.find(p => p.name === 'ไข่ต้ม');
eq(eggSku.onHand, 0, 'void restores stock (0 -3 +3)');

// cash moves + drawer log
must('cashMove', C, 'OUT', 40, 'ค่าน้ำแข็ง');
must('cashMove', C, 'IN', 100, 'แลกเหรียญ');
mustFail(/จำนวน|เหตุผล/, 'cashMove', C, 'OUT', 0, '');
must('logDrawer', C, 'เปิดลิ้นชักโดยไม่ขาย');

// stock count needs approval for cashier
mustFail(/อนุมัติ/, 'setStockCount', C, 'W0001', 170, 'ตรวจนับ', '');
const as = must('approve', C, '1234', 'STOCK_ADJUST');
const adj = must('setStockCount', C, 'W0001', 170, 'ตรวจนับ', as.approvalId);
eq(adj.diff, -2, 'adjust diff');
eq(must('stockMoves', T, 'W0001').length, 4, 'OPEN, SALE x2? moves'); // OPEN + SALE(pack) + SALE(pieces) + ADJUST

// summary + report
const sum = must('shiftSummary', C);
eq([sum.cashSales, sum.qrSales, sum.transferSales, sum.cashIn, sum.cashOut, sum.expectedCash, sum.billCount, sum.voidCount],
   [94, 40, 0, 100, 40, 654, 2, 1], 'shift summary ' + JSON.stringify(sum));
const rep = must('dailyReport', T, '2026-11-03');
eq([rep.total, rep.billCount, rep.voidCount], [134, 2, 1], 'report totals');
eq(rep.hourly[10], 134, 'sales at 10:00 Bangkok');
ok(rep.exceptions.some(x => x.action === 'NO_SALE'), 'no-sale in exceptions');
ok(rep.exceptions.some(x => x.action === 'VOID') && rep.exceptions.some(x => x.action === 'DISCOUNT'), 'void/discount exceptions');
ok(rep.top[0].name === 'น้ำดื่ม 600 มล.' && rep.top[0].pieces === 14, 'top item in pieces');
ok(rep.grossProfit > 0, 'gross profit');

// close shift -> LINE push
const cl = must('closeShift', C, 650, 'ขาด 4');
eq(cl.diff, -4, 'diff');
ok(cl.lineSent && g.__fetches.length === 1 && g.__fetches[0].url.includes('line.me'), 'LINE push sent');
mustFail(/กะ/, 'commitSale', C, { saleUid: 'S9', payMethod: 'qr', lines: [{ sku: 'D0101', qty: 1 }] });
mustFail(/กะ/, 'voidSale', T, r1.billNo, 'หลังปิดกะ', '');

// audit + users + backup
ok(must('auditLog', T, 100).length > 5, 'audit log');
must('setUserActive', T, mew.userId, false);
mustFail(/PIN|ผู้ใช้/, 'login', mew.userId, '5678', DEV);
ok(must('backupNow', T), 'backup');
{
  const bk = g.__backups[g.__backups.length - 1];
  ok(bk && bk.getSheetByName('Products') && !bk.getSheetByName('Sheet1'), 'backup = new spreadsheet with the same sheets (no script copy)');
  eq(bk.getSheetByName('Users').data.length, g.__ss.getSheetByName('Users').data.length, 'backup copies data');
}
must('logout', T);
mustFail(/เข้าสู่ระบบ/, 'bootstrap', T);

// session expiry after 6h
const { token: T2 } = must('login', ownerId, '1234', DEV);
g.__advance(6 * 3600 * 1000 + 1000);
mustFail(/เข้าสู่ระบบ/, 'bootstrap', T2);

// PIN lockout after 5 tries
for (let i = 0; i < 5; i++) call('login', ownerId, '0000', DEV);
mustFail(/ลอง|รอ/, 'login', ownerId, '1234', DEV);

// ===================== Recipes (สูตรผสม) + raw materials =====================
{
  const h = makeContext({ now: '2026-11-04T05:00:00Z' });
  h.setup();
  const K = h.__props.API_KEY;
  const c2 = (fn, ...a) => JSON.parse(h.doPost({ postData: { contents: JSON.stringify({ key: K, fn, args: a }) } }).getContent());
  const m2 = (fn, ...a) => { const r = c2(fn, ...a); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  const f2 = (re, fn, ...a) => { const r = c2(fn, ...a); ok(!r.ok && re.test(r.error), fn + ' should fail ' + re + ' got ' + JSON.stringify(r)); };

  // Old sheet without the forSale column / Recipes sheet -> first status call migrates it.
  const prodSheet = h.__ss.getSheetByName('Products');
  prodSheet.data[0] = prodSheet.data[0].slice(0, 18);
  h.__ss.deleteSheet(h.__ss.getSheetByName('Recipes'));
  delete h.__props.SCHEMA_VERSION;
  h.createOwner('O', '1111');
  const st2 = m2('status');
  ok(h.__ss.getSheetByName('Recipes') && prodSheet.data[0][18] === 'forSale', 'schema migrated');
  const T3 = m2('login', st2.users[0].userId, '1111', 'Dcounter2').token;
  m2('registerDevice', T3, 'Dcounter2', 'เครื่อง');

  const cup = m2('saveProduct', T3, { name: 'แก้ว 22oz', type: 'nobarcode', cost: 0.96, price: 0, forSale: false }, []).sku;
  const lid = m2('saveProduct', T3, { name: 'ฝาโดม', type: 'nobarcode', cost: 0.56, price: 0, forSale: false }, []).sku;
  const straw = m2('saveProduct', T3, { name: 'หลอด', type: 'nobarcode', cost: 0.32, price: 0, forSale: false }, []).sku;
  const water = m2('saveProduct', T3, { name: 'น้ำ 600', type: 'barcode', cost: 4, price: 7 }, [{ barcode: '8850000000011', unitName: 'ชิ้น', multiplier: 1 }]).sku;
  m2('importProducts', T3, 'sku,name,openingStock\n' + [cup, lid, straw, water].map(k => k + ',,100').join('\n'));
  // import only adds opening stock to NEW products -> set counts instead
  [cup, lid, straw, water].forEach(k => m2('setStockCount', T3, k, 100, 'สต็อกเปิด', ''));

  f2(/อย่างน้อย 1/, 'saveProduct', T3, { name: 'ชุดว่าง', type: 'recipe', price: 5 }, [], []);
  const ice = m2('saveProduct', T3, { name: 'น้ำแข็งแก้ว', type: 'recipe', price: 5, quickKey: true, plu: '101' }, [{ barcode: '8851111111111', unitName: 'ชิ้น', multiplier: 1 }],
    [{ sku: cup, qty: 1 }, { sku: lid, qty: 1 }, { sku: straw, qty: 1 }]).sku;
  const combo = m2('saveProduct', T3, { name: 'น้ำ+น้ำแข็ง', type: 'recipe', price: 12 }, [], [{ sku: water, qty: 1 }, { sku: cup, qty: 1 }]).sku;
  f2(/สูตรซ้อนสูตร/, 'saveProduct', T3, { name: 'ซ้อน', type: 'recipe', price: 1 }, [], [{ sku: ice, qty: 1 }]);
  f2(/ส่วนประกอบของ/, 'saveProduct', T3, { sku: cup, name: 'แก้ว 22oz', type: 'recipe', price: 1 }, [], [{ sku: lid, qty: 1 }]);

  let b2 = m2('bootstrap', T3);
  const iceP = b2.products.find(p => p.sku === ice);
  eq(iceP.cost, 1.84, 'recipe cost = 0.96 + 0.56 + 0.32');
  eq(b2.barcodes.filter(b => b.sku === ice).length, 0, 'recipe keeps no barcodes');
  eq(b2.recipes.filter(r => r.sku === ice).length, 3, 'recipe rows returned');
  eq(b2.products.find(p => p.sku === cup).forSale, false, 'material flagged');
  eq(b2.products.find(p => p.sku === water).forSale, true, 'normal product for sale');
  ok(!m2('stockList', T3).some(r => r.sku === ice), 'recipe not in stock list');
  f2(/สูตรผสมไม่มีสต็อก/, 'setStockCount', T3, ice, 5, 'x', '');

  m2('openShift', T3, 0, '');
  f2(/วัตถุดิบ/, 'commitSale', T3, { saleUid: 'R0', payMethod: 'qr', lines: [{ sku: cup, qty: 1 }] });
  const rs = m2('commitSale', T3, { saleUid: 'R1', payMethod: 'qr', lines: [{ sku: ice, qty: 3 }, { sku: combo, qty: 2 }] });
  eq(rs.total, 39, '3x5 + 2x12');
  const on = () => Object.fromEntries(m2('bootstrap', T3).products.map(p => [p.sku, p.onHand]));
  let o = on();
  eq([o[cup], o[lid], o[straw], o[water]], [95, 97, 97, 98], 'components cut: cup 3+2, lid 3, straw 3, water 2');
  eq(o[ice], 0, 'recipe has no own stock moves');
  const mv = m2('stockMoves', T3, cup);
  ok(mv.some(x => /สูตร น้ำแข็งแก้ว/.test(x.note)), 'move note names the recipe');
  const rep2 = m2('dailyReport', T3, '2026-11-04');
  eq(rep2.grossProfit, round(39 - (3 * 1.84 + 2 * (4 + 0.96))), 'profit uses component costs');
  m2('voidSale', T3, rs.billNo, 'ทดสอบ', '');
  o = on();
  eq([o[cup], o[lid], o[straw], o[water]], [100, 100, 100, 100], 'void restores components');
  // switching a recipe back to a normal product removes its recipe rows
  m2('saveProduct', T3, { sku: combo, name: 'น้ำ+น้ำแข็ง', type: 'nobarcode', price: 12 }, [], []);
  eq(m2('bootstrap', T3).recipes.filter(r => r.sku === combo).length, 0, 'recipe rows cleared');
}

// ===================== FIFO cost =====================
{
  const h = makeContext({ now: '2026-11-05T03:00:00Z' });
  h.setup();
  const K = h.__props.API_KEY;
  const c3 = (fn, ...a) => JSON.parse(h.doPost({ postData: { contents: JSON.stringify({ key: K, fn, args: a }) } }).getContent());
  const m3 = (fn, ...a) => { const r = c3(fn, ...a); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  const f3 = (re, fn, ...a) => { const r = c3(fn, ...a); ok(!r.ok && re.test(r.error), fn + ' should fail ' + re + ' got ' + JSON.stringify(r)); };
  h.createOwner('O', '1111');
  const T4 = m3('login', m3('status').users[0].userId, '1111', 'Dcounter3xxxxxxxxxx').token;
  m3('registerDevice', T4, 'Dcounter3xxxxxxxxxx', 'เครื่อง');
  const X = m3('saveProduct', T4, { name: 'น้ำ X', type: 'barcode', price: 7 }, [
    { barcode: '8850000000101', unitName: 'ชิ้น', multiplier: 1 }, { barcode: '8850000000118', unitName: 'แพ็ค', multiplier: 12 }]).sku;
  const prod = () => m3('bootstrap', T4).products.find(p => p.sku === X);
  const lots = () => m3('lots', T4, X).map(l => [l.qtyLeft, l.unitCost]);
  eq(prod().cost, 0, 'new product has no cost until received');

  const r1 = m3('receive', T4, { receiptUid: 'RC-A', supplier: 'แม็คโคร', lines: [{ sku: X, qty: 10, unitCost: 4 }] });
  ok(/^RC2611-0001$/.test(r1.receiptNo), 'receipt no ' + r1.receiptNo);
  eq(m3('receive', T4, { receiptUid: 'RC-A', lines: [{ sku: X, qty: 10, unitCost: 4 }] }).duplicate, true, 'receive idempotent');
  m3('receive', T4, { receiptUid: 'RC-B', lines: [{ barcode: '8850000000118', qty: 2, unitCost: 54, expiryDate: '2027-01-31' }] });
  eq([prod().onHand, prod().cost], [34, 4], 'onHand 10 + 24; cost = oldest lot');
  eq(lots(), [[10, 4], [24, 4.5]], 'two lots, pack cost per piece 54/12');
  eq(m3('lots', T4, X)[1].expiryDate, '2027-01-31', 'expiry kept on lot');
  f3(/วันหมดอายุ/, 'receive', T4, { receiptUid: 'RC-x', lines: [{ sku: X, qty: 1, unitCost: 1, expiryDate: '31/01/27' }] });
  eq(m3('receipts', T4).length, 2, 'receipts list');

  m3('openShift', T4, 0, '');
  const s1 = m3('commitSale', T4, { saleUid: 'F1', payMethod: 'qr', lines: [{ sku: X, qty: 15 }] });
  const s2 = m3('commitSale', T4, { saleUid: 'F2', payMethod: 'qr', lines: [{ barcode: '8850000000118', qty: 1 }] });
  const cost = bill => m3('dailyReport', T4, '2026-11-05') && h.__ss.getSheetByName('SaleLines').data.filter(r => r[0] === bill).reduce((a, r) => a + r[11], 0);
  eq(cost(s1.billNo), 62.5, 'FIFO: 10 x 4 + 5 x 4.5');
  eq(cost(s2.billNo), 54, 'pack from the 4.5 lot');
  eq([prod().cost, lots()], [4.5, [[7, 4.5]]], 'first lot used up');
  m3('voidSale', T4, s1.billNo, 'ทดสอบ', '');
  eq(lots(), [[10, 4], [12, 4.5]], 'void puts pieces back into the same lots');
  eq(prod().cost, 4, 'head lot cost again');

  // Sell more than the lots hold
  const s3 = m3('commitSale', T4, { saleUid: 'F3', payMethod: 'qr', lines: [{ sku: X, qty: 25 }] });
  eq(cost(s3.billNo), 107.5, '10x4 + 12x4.5 + 3 missing at last cost 4.5');
  eq(prod().onHand, -3, 'negative stock');
  m3('receive', T4, { receiptUid: 'RC-C', lines: [{ sku: X, qty: 10, unitCost: 5 }] });
  eq([prod().onHand, lots()], [7, [[7, 5]]], 'new lot shortened by the deficit');

  // Count down / up
  m3('setStockCount', T4, X, 5, 'ตรวจนับ', '');
  eq(lots(), [[5, 5]], 'count down takes from lots');
  m3('setStockCount', T4, X, 9, 'ตรวจนับ', '');
  eq(lots(), [[5, 5], [4, 5]], 'count up adds a lot at last cost');

  // Recipe uses component FIFO cost; receiving a recipe is rejected
  const cup = m3('saveProduct', T4, { name: 'แก้ว', type: 'nobarcode', forSale: false }, []).sku;
  m3('receive', T4, { receiptUid: 'RC-D', lines: [{ sku: cup, qty: 2, unitCost: 1 }, { sku: cup, qty: 2, unitCost: 2 }] });
  const set = m3('saveProduct', T4, { name: 'ชุด', type: 'recipe', price: 20 }, [], [{ sku: X, qty: 1 }, { sku: cup, qty: 1 }]).sku;
  f3(/สูตรผสม/, 'receive', T4, { receiptUid: 'RC-E', lines: [{ sku: set, qty: 1, unitCost: 1 }] });
  const s4 = m3('commitSale', T4, { saleUid: 'F4', payMethod: 'qr', lines: [{ sku: set, qty: 3 }] });
  eq(cost(s4.billNo), 15 + 1 + 1 + 2, 'recipe: 3 x X @5 + cups 1,1,2');
  const rep3 = m3('dailyReport', T4, '2026-11-05');
  eq(rep3.grossProfit, round(rep3.total - (54 + 107.5 + 19)), 'report profit = sales - FIFO cost');

  // Migration from v2: stock without lots becomes an opening lot at the stored cost
  const oldSku = 'OLD1';
  const ps = h.__ss.getSheetByName('Products');
  const hdr = ps.data[0];
  const row = hdr.map(k => ({ sku: oldSku, name: 'ของเก่า', type: 'barcode', cost: 3.5, price: 5, active: true, onHand: 40 })[k] ?? '');
  ps.data.push(row);
  h.__props.SCHEMA_VERSION = '2';
  m3('status');
  eq(m3('lots', T4, oldSku).map(l => [l.qtyLeft, l.unitCost, l.receiptNo]), [[40, 3.5, 'OPENING']], 'migrated opening lot');
  m3('status');
  eq(m3('lots', T4, oldSku).length, 1, 'migration runs once');
}

// ===================== Stock count, write-off, expiring lots =====================
{
  const h = makeContext({ now: '2026-11-05T03:00:00Z' });
  h.setup();
  const K = h.__props.API_KEY;
  const c4 = (fn, ...a) => JSON.parse(h.doPost({ postData: { contents: JSON.stringify({ key: K, fn, args: a }) } }).getContent());
  const m4 = (fn, ...a) => { const r = c4(fn, ...a); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  const f4 = (re, fn, ...a) => { const r = c4(fn, ...a); ok(!r.ok && re.test(r.error), fn + ' should fail ' + re + ' got ' + JSON.stringify(r)); };
  h.createOwner('O', '1111');
  const DEV = 'Dcounter4xxxxxxxxxx';
  const T5 = m4('login', m4('status').users[0].userId, '1111', DEV).token;
  eq(m4('status').users[0].pinLen, 4, 'status tells the login screen the PIN length');
  m4('registerDevice', T5, DEV, 'เครื่อง');
  const A = m4('saveProduct', T5, { name: 'นม', type: 'nobarcode', price: 14 }, []).sku;
  const B = m4('saveProduct', T5, { name: 'ขนมปัง', type: 'nobarcode', price: 15 }, []).sku;
  m4('receive', T5, { receiptUid: 'R1', lines: [{ sku: A, qty: 10, unitCost: 10, expiryDate: '2026-11-06' }, { sku: B, qty: 5, unitCost: 8, expiryDate: '2026-11-20' }] });
  m4('receive', T5, { receiptUid: 'R2', lines: [{ sku: A, qty: 10, unitCost: 11, expiryDate: '2026-11-12' }] });
  const on = sku => m4('bootstrap', T5).products.find(p => p.sku === sku).onHand;

  // write-off from a specific (later) lot, then FIFO
  const lotsA = m4('lots', T5, A);
  const wo1 = m4('writeOff', T5, { sku: A, qty: 2, reason: 'หมดอายุ', lotId: lotsA[1].lotId });
  eq(wo1.cost, 22, 'write-off from chosen lot @11');
  eq(m4('lots', T5, A).map(l => l.qtyLeft), [10, 8], 'chosen lot reduced, oldest untouched');
  const wo2 = m4('writeOff', T5, { sku: A, qty: 3, reason: 'เสียหาย' });
  eq(wo2.cost, 30, 'FIFO write-off from oldest @10');
  f4(/เหตุผล/, 'writeOff', T5, { sku: A, qty: 1, reason: 'อื่นๆ' });
  f4(/เหลือ/, 'writeOff', T5, { sku: A, qty: 99, reason: 'หมดอายุ', lotId: lotsA[1].lotId });
  eq(on(A), 15, 'onHand 20 - 5');

  // count: A counted 12 (−3), B counted 7 (+2), B again no diff
  const cnt = m4('stockCount', T5, { countUid: 'CNT-1', note: 'สิ้นเดือน', lines: [{ sku: A, counted: 12 }, { sku: B, counted: 7 }, { sku: B, counted: '' }] });
  eq([cnt.counted, cnt.changed, cnt.minusValue, cnt.plusValue], [2, 2, 30, 16], 'count result: A -3 @10, B +2 @8');
  eq([on(A), on(B)], [12, 7], 'counted quantities');
  eq(m4('lots', T5, A).reduce((a, l) => a + l.qtyLeft, 0), 12, 'lots follow count');
  eq(m4('stockCount', T5, { countUid: 'CNT-1', lines: [{ sku: A, counted: 1 }] }).duplicate, true, 'count idempotent');

  const ov = m4('stockOverview', T5, 7);
  eq([ov.lossMonth, ov.expiryMonth, ov.useMonth], [30, 22, 0], 'this month: damaged 30, expired 22');
  eq(ov.expiring.map(l => [l.name, l.daysLeft]), [['นม', 1], ['นม', 7]], 'lots within 7 days (inclusive), bread on day 15 excluded');
  ok(ov.moves.some(m => m.type === 'WRITEOFF') && ov.moves.some(m => m.type === 'ADJUST'), 'recent moves');
  eq(round(ov.stockValue), round(m4('lots', T5, A).reduce((a, l) => a + l.qtyLeft * l.unitCost, 0) + 7 * 8), 'stock value from lots');
  ok(m4('dailyReport', T5, '2026-11-05').exceptions.some(x => x.action === 'WRITEOFF'), 'write-off in exceptions');

  // cashier needs approval
  m4('addUser', T5, 'แคช', 'cashier', '2222');
  const C5 = m4('login', m4('listUsers', T5).find(u => u.name === 'แคช').userId, '2222', DEV).token;
  f4(/อนุมัติ/, 'writeOff', C5, { sku: B, qty: 1, reason: 'เสียหาย' });
  f4(/อนุมัติ/, 'stockCount', C5, { countUid: 'CNT-2', lines: [{ sku: B, counted: 1 }] });

  // store use (เบิกใช้ในร้าน) is separate from write-off: an expense, not a loss
  f4(/เหตุผล/, 'writeOff', T5, { sku: B, qty: 1, reason: 'ใช้ในร้าน' });
  f4(/อนุมัติ/, 'storeUse', C5, { sku: B, qty: 1, note: 'น้ำให้ช่าง' });
  const su = m4('storeUse', T5, { sku: B, qty: 2, note: 'น้ำให้ช่าง' });
  eq(su.cost, 16, 'store use 2 @8');
  eq(on(B), 5, 'stock 7 - 2');
  const ov2 = m4('stockOverview', T5, 7);
  eq([ov2.lossMonth, ov2.expiryMonth, ov2.useMonth], [30, 22, 16], 'store use counted on its own');
  ok(ov2.moves[0].type === 'STORE_USE' && ov2.moves[0].note === 'น้ำให้ช่าง', 'store use in moves');
  ok(m4('dailyReport', T5, '2026-11-05').exceptions.some(x => x.action === 'STORE_USE'), 'store use in exceptions');
  f4(/ใช้ทำอะไร/, 'storeUse', T5, { lines: [{ sku: B, qty: 1 }] });
  const su2 = m4('storeUse', T5, { useUid: 'U-1', note: 'ทำความสะอาด', lines: [{ sku: A, qty: 1 }, { sku: B, qty: 1 }] });
  eq(m4('storeUse', T5, { useUid: 'U-1', note: 'ทำความสะอาด', lines: [{ sku: A, qty: 1 }, { sku: B, qty: 1 }] }).refNo, su2.refNo, 'store use idempotent');
  eq([on(A), on(B)], [11, 4], 'several lines in one go');
}

// ===================== Expiry management =====================
{
  const h = makeContext({ now: '2026-11-05T03:00:00Z' });   // 10:00 Bangkok, 5 Nov
  h.setup();
  const K = h.__props.API_KEY;
  const c6 = (fn, ...a) => JSON.parse(h.doPost({ postData: { contents: JSON.stringify({ key: K, fn, args: a }) } }).getContent());
  const m6 = (fn, ...a) => { const r = c6(fn, ...a); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  const f6 = (re, fn, ...a) => { const r = c6(fn, ...a); ok(!r.ok && re.test(r.error), fn + ' should fail ' + re + ' got ' + JSON.stringify(r)); };
  h.createOwner('O', '1111');
  const DEV = 'Dcounter6xxxxxxxxxx';
  let T6 = m6('login', m6('status').users[0].userId, '1111', DEV).token;
  m6('registerDevice', T6, DEV, 'เครื่อง');
  m6('addUser', T6, 'แคช', 'cashier', '2222');
  const cashId = m6('listUsers', T6).find(u => u.name === 'แคช').userId;
  let C6 = m6('login', cashId, '2222', DEV).token;
  const M = m6('saveProduct', T6, { name: 'นมเปรี้ยว', category: 'นม', type: 'nobarcode', price: 14, trackExpiry: true }, []).sku;
  eq(m6('bootstrap', T6).products.find(p => p.sku === M).trackExpiry, true, 'trackExpiry saved');
  f6(/วันหมดอายุ/, 'receive', T6, { receiptUid: 'E0', lines: [{ sku: M, qty: 5, unitCost: 10 }] });
  m6('receive', T6, { receiptUid: 'E1', lines: [
    { sku: M, qty: 6, unitCost: 10, expiryDate: '2026-11-05' },    // today
    { sku: M, qty: 8, unitCost: 10, expiryDate: '2026-11-06' },    // tomorrow
    { sku: M, qty: 10, unitCost: 10, expiryDate: '2026-11-15' }]}); // later
  let ex = m6('expiryList', T6);
  eq([ex.stats.expired, ex.stats.near, ex.todo.length], [1, 1, 2], 'today expired + tomorrow near (default 3 days)');
  eq(m6('bootstrap', T6).expiryTodo, 2, 'nav badge count');
  const today = ex.todo.find(r => r.todo === 'expired'), near = ex.todo.find(r => r.todo === 'near');

  // markdown the near lot: staff, no PIN
  f6(/ไม่เหลือแล้ว/, 'expiryAction', C6, { lotId: near.lotId, action: 'MARKDOWN', found: 0 });
  m6('expiryAction', C6, { lotId: near.lotId, action: 'MARKDOWN', found: 5, pct: 30 });
  ex = m6('expiryList', T6);
  eq(ex.todo.map(r => r.todo), ['expired'], 'marked-down lot leaves the to-do list');
  eq(ex.done[0].status, 'MARKDOWN', 'in done list');
  const md = m6('bootstrap', T6).markdowns;
  eq(md.map(x => [x.lotId, x.pct, x.left]), [[near.lotId, 30, 5]], 'markdown quota for the till');

  // sell with the markdown — cashier, no approval
  m6('openShift', C6, 0, '');
  const s1 = m6('commitSale', C6, { saleUid: 'MD1', payMethod: 'qr', lines: [{ sku: M, qty: 4, markdownLotId: near.lotId, markdownQty: 3 }] });
  eq([s1.subtotal, s1.discount, s1.total], [56, 12.6, 43.4], '3 pieces at -30% (14 x 3 x 0.3 = 12.60)');
  eq(m6('bootstrap', T6).markdowns[0].left, 2, 'quota used');
  f6(/อีก 2 ชิ้น/, 'commitSale', C6, { saleUid: 'MD2', payMethod: 'qr', lines: [{ sku: M, qty: 3, markdownLotId: near.lotId, markdownQty: 3 }] });
  f6(/อนุมัติ/, 'commitSale', C6, { saleUid: 'MD3', payMethod: 'qr', lines: [{ sku: M, qty: 2, markdownLotId: near.lotId, markdownQty: 1, lineDiscount: 1 }] });
  const a6 = m6('approve', C6, '1111', 'VOID');
  m6('voidSale', C6, s1.billNo, 'ทดสอบ', a6.approvalId);
  eq(m6('bootstrap', T6).markdowns[0].left, 5, 'void gives the quota back');
  ok(m6('dailyReport', T6, '2026-11-05').exceptions.some(x => x.action === 'MARKDOWN'), 'markdown logged');

  // close today's lot: nothing left on the shelf, no stock change
  const before = m6('bootstrap', T6).products.find(p => p.sku === M).onHand;
  m6('expiryAction', C6, { lotId: today.lotId, action: 'CLOSE', found: 0 });
  eq(m6('bootstrap', T6).products.find(p => p.sku === M).onHand, before, 'close does not move stock');
  eq(m6('expiryList', T6).todo.length, 0, 'nothing left to do today');

  // next day the marked-down lot expires -> back on the list, write off what is left (cashier needs PIN)
  h.__advance(86400000);
  T6 = m6('login', m6('status').users.find(u => u.role === 'owner').userId, '1111', DEV).token;
  C6 = m6('login', cashId, '2222', DEV).token;
  ex = m6('expiryList', T6);
  eq(ex.todo.map(r => [r.lotId, r.todo, r.status]), [[near.lotId, 'expired', 'MARKDOWN']], 'marked-down lot is due on its expiry day');
  f6(/อนุมัติ/, 'expiryAction', C6, { lotId: near.lotId, action: 'WRITEOFF', found: 4 });
  const ap = m6('approve', C6, '1111', 'STOCK_ADJUST');
  const wo = m6('expiryAction', C6, { lotId: near.lotId, action: 'WRITEOFF', found: 4, approvalId: ap.approvalId });
  eq(wo.cost, 40, 'write-off 4 @10 from that lot');
  eq(m6('lots', T6, M).find(l => l.lotId === near.lotId).qtyLeft, 4, 'taken from the chosen lot (8 - 4)');
  eq(m6('bootstrap', T6).markdowns.length, 0, 'quota cleared by write-off');
  eq(m6('expiryList', T6).todo.length, 0, 'done');

  // settings per category
  const es = m6('saveExpirySettings', T6, { 'นม': 12, '*': 2 }, 40);
  eq([es.warnDays['นม'], es.warnDays['*'], es.markdownPct], [12, 2, 40], 'expiry settings');
  eq(m6('expiryList', T6).todo.map(r => r.expiryDate), ['2026-11-15'], 'milk now warned 12 days ahead');
  f6(/เจ้าของ/, 'saveExpirySettings', C6, {}, 30);

  // found expired goods during a stock check -> write off on the Stock page; it shows on the Expiry page too
  m6('receive', T6, { receiptUid: 'E2', lines: [{ sku: M, qty: 3, unitCost: 11, expiryDate: '2026-11-04' }] });
  const old = m6('expiryList', T6).todo.find(r => r.expiryDate === '2026-11-04');
  ok(old && old.todo === 'expired', 'past-dated lot is due');
  m6('writeOff', T6, { sku: M, qty: 3, reason: 'หมดอายุ', lotId: old.lotId });
  m6('writeOff', T6, { sku: M, qty: 1, reason: 'เสียหาย' });
  ex = m6('expiryList', T6);
  ok(!ex.todo.some(r => r.lotId === old.lotId), 'stock-page expiry write-off closes the lot to-do');
  eq(ex.done.find(r => r.lotId === old.lotId).status, 'WRITEOFF', 'lot shown as written off');
  eq(ex.writeoffs.map(w => [w.source, w.qty, w.cost]), [['stock', 3, 33], ['expiry', 4, 40]], 'expiry write-off history from both pages (not damaged goods)');
  eq(ex.stats.lossMonth, 73, 'expiry loss this month = 33 + 40');
}


// ===================== Split payment + partial returns =====================
{
  const h = makeContext({ now: '2026-11-05T03:00:00Z' });
  h.setup();
  const K = h.__props.API_KEY;
  const c7 = (fn, ...a) => JSON.parse(h.doPost({ postData: { contents: JSON.stringify({ key: K, fn, args: a }) } }).getContent());
  const m7 = (fn, ...a) => { const r = c7(fn, ...a); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  const f7 = (re, fn, ...a) => { const r = c7(fn, ...a); ok(!r.ok && re.test(r.error), fn + ' should fail ' + re + ' got ' + JSON.stringify(r)); };
  h.createOwner('O', '1111');
  const DEV = 'Dcounter7xxxxxxxxxx';
  const T = m7('login', m7('status').users[0].userId, '1111', DEV).token;
  m7('registerDevice', T, DEV, 'เครื่อง');
  m7('addUser', T, 'แคช', 'cashier', '2222');
  const C = m7('login', m7('listUsers', T).find(u => u.name === 'แคช').userId, '2222', DEV).token;
  m7('importProducts', T, ['sku,name,category,type,unit,cost,price,minStock,openingStock',
    'A1,น้ำ,เครื่องดื่ม,nobarcode,ขวด,4,10,0,50', 'B1,ขนม,ขนม,nobarcode,ห่อ,12,20,0,50'].join('\n'));
  const onH = sku => m7('bootstrap', T).products.find(p => p.sku === sku).onHand;
  m7('openShift', C, 500, '');

  // split: 100 bill = 60 cash (customer gives 100) + 40 QR
  const lines = [{ sku: 'A1', qty: 4 }, { sku: 'B1', qty: 3 }];   // 40 + 60
  f7(/อย่างน้อย 2/, 'commitSale', C, { saleUid: 'SP0', payMethod: 'split', received: 100, lines, payments: [{ method: 'cash', amount: 100 }] });
  f7(/ต้องเท่ากับ 100/, 'commitSale', C, { saleUid: 'SP0', payMethod: 'split', received: 100, lines, payments: [{ method: 'cash', amount: 50 }, { method: 'qr', amount: 40 }] });
  f7(/เงินสดไม่พอ/, 'commitSale', C, { saleUid: 'SP0', payMethod: 'split', received: 50, lines, payments: [{ method: 'cash', amount: 60 }, { method: 'qr', amount: 40 }] });
  const sp = m7('commitSale', C, { saleUid: 'SP1', payMethod: 'split', received: 100, lines, payments: [{ method: 'cash', amount: 60 }, { method: 'qr', amount: 40 }] });
  eq([sp.total, sp.change, sp.payments], [100, 40, { cash: 60, qr: 40, transfer: 0 }], 'split: change only on the cash part');
  let sum = m7('shiftSummary', C);
  eq([sum.cashSales, sum.qrSales, sum.expectedCash], [60, 40, 560], 'shift counts each part');

  // bill with a bill discount: 2 A1 (20) + 1 B1 (20) = 40, bill discount 4 -> 36 cash
  const b2 = m7('commitSale', T, { saleUid: 'SP2', payMethod: 'cash', received: 36, billDiscount: 4, lines: [{ sku: 'A1', qty: 2 }, { sku: 'B1', qty: 1 }] });
  eq(b2.total, 36, 'discounted bill');
  const a1 = onH('A1');

  // partial return: cashier needs approval; 1 water back to stock, cash refund = 10 - 10% share = 9
  f7(/อนุมัติ/, 'returnSale', C, { returnUid: 'R1', billNo: b2.billNo, refundMethod: 'cash', restock: true, reason: 'ลูกค้าซื้อเกิน', lines: [{ lineNo: 1, qty: 1 }] });
  const ap = m7('approve', C, '1111', 'RETURN');
  f7(/เหตุผล/, 'returnSale', C, { returnUid: 'R1', billNo: b2.billNo, refundMethod: 'cash', restock: true, reason: '', lines: [{ lineNo: 1, qty: 1 }], approvalId: ap.approvalId });
  const r1 = m7('returnSale', C, { returnUid: 'R1', billNo: b2.billNo, refundMethod: 'cash', restock: true, reason: 'ลูกค้าซื้อเกิน', lines: [{ lineNo: 1, qty: 1 }], approvalId: ap.approvalId });
  eq(r1.total, 9, 'refund keeps the bill-discount share');
  eq(m7('returnSale', C, { returnUid: 'R1', billNo: b2.billNo, refundMethod: 'cash', restock: true, reason: 'x', lines: [{ lineNo: 1, qty: 1 }] }).duplicate, true, 'return idempotent');
  eq(onH('A1'), a1 + 1, 'restocked');
  ok(m7('lots', T, 'A1').some(l => l.receiptNo === r1.returnNo && l.unitCost === 4), 'returned goods back as a lot at sold cost');
  f7(/คืนได้อีก 1/, 'returnSale', T, { returnUid: 'R2', billNo: b2.billNo, refundMethod: 'cash', restock: true, reason: 'x', lines: [{ lineNo: 1, qty: 2 }] });
  f7(/คืนรายการที่เหลือ/, 'voidSale', T, b2.billNo, 'x', '');
  // rest of the bill by transfer, not restocked (damaged): total refunds = bill total exactly
  const r2 = m7('returnSale', T, { returnUid: 'R3', billNo: b2.billNo, refundMethod: 'transfer', reason: 'ของเสีย', lines: [{ lineNo: 1, qty: 1 }, { lineNo: 2, qty: 1 }] });
  eq([r2.total, r2.fullyReturned], [27, true], 'last return closes the bill: 36 - 9');
  eq(onH('B1'), 50 - 3, 'restocked (3 sold, 1 sold then returned)');
  const det = m7('billDetail', T, b2.billNo);
  eq([det.returnedTotal, det.returns.length, det.lines.map(l => l.returnedQty)], [36, 2, [2, 1]], 'bill detail shows returns');
  ok(m7('listBills', T).find(b => b.billNo === b2.billNo).returnedTotal === 36, 'bill list shows returned total');
  const bsD = m7('billSummary', T, '2026-11');
  eq([bsD.rows.length, bsD.rows[0].key, bsD.total.bills, bsD.total.total, bsD.total.returned, bsD.total.net, bsD.total.cash, bsD.total.qr],
    [1, '2026-11-05', 2, 136, 36, 100, 96, 40], 'bill summary by day');
  const bsM = m7('billSummary', T, '2026');
  eq([bsM.rows.map(r => r.key), bsM.total.net], [['2026-11'], 100], 'bill summary by month');
  f7(/ช่วงเวลา/, 'billSummary', T, '2026-1');
  eq(m7('findBills', T, b2.billNo).map(b => b.billNo), [b2.billNo], 'find bill by full number');
  ok(m7('findBills', T, b2.billNo.slice(-2)).some(b => b.billNo === b2.billNo), 'find bill by the last digits');
  eq(m7('findBills', T, '99999').length, 0, 'no match');
  f7(/อย่างน้อย 2/, 'findBills', T, '1');

  sum = m7('shiftSummary', C);
  eq([sum.cashRefunds, sum.otherRefunds, sum.expectedCash, sum.returnCount], [9, 27, 500 + 60 + 36 - 9, 2], 'cash refund leaves the drawer');
  const rep = m7('dailyReport', T, '2026-11-05');
  eq([rep.grossSales, rep.refundTotal, rep.total, rep.byPay], [136, 36, 100, { cash: 87, qr: 40, transfer: -27 }], 'daily report net of returns');
  ok(rep.exceptions.some(x => x.action === 'RETURN'), 'return logged');
  // filtered report
  const R = m7('report', T, { from: '2026-11-05', to: '2026-11-05' });
  eq([R.summary.gross, R.summary.refunds, R.summary.net, R.summary.bills, R.summary.cost, R.summary.profit], [136, 36, 100, 2, 52, 48], 'report summary (net of returns, restocked cost back)');
  eq(R.products.map(p => [p.sku, p.qty, p.revenue, p.cost, p.profit]), [['B1', 3, 60, 36, 24], ['A1', 4, 40, 16, 24]], 'profit by product');
  eq(R.categories.map(c => [c.category, c.revenue, c.share]), [['ขนม', 60, 60], ['เครื่องดื่ม', 40, 40]], 'profit by category');
  eq(m7('report', T, { from: '2026-11-05', category: 'ขนม' }).summary.net, 60, 'category filter');
  const RQ = m7('report', T, { from: '2026-11-05', pay: 'qr' });
  eq([RQ.summary.bills, RQ.summary.net], [1, 100], 'payment filter keeps bills paid partly by QR');
  eq(m7('report', T, { from: '2026-11-05', billType: 'return' }).summary.bills, 1, 'bills with returns');
  const RS = m7('report', T, { from: '2026-11-05' });
  eq(RS.staff.map(x => [x.name, x.bills]).sort(), [['O', 1], ['แคช', 1]], 'by staff');
  eq([RS.shifts.length, RS.shifts[0].status, RS.shifts[0].bills], [1, 'OPEN', 2], 'shift list (both bills on the counter shift)');
  ok(RS.stock.total > 0 && RS.stock.categories.length === 2, 'stock value by category');
  eq(m7('report', T, { from: '2026-11-01', to: '2026-11-05' }).daily.map(d => d.net), [0, 0, 0, 0, 100], 'daily series for a range');
  const RR = m7('report', T, { from: '2026-11-01', to: '2026-11-05' });
  eq([RR.trend.kind, RR.trend.keys.length, RR.trend.total[4], RR.trend.cats.map(c => [c.category, c.values[4]])], ['day', 5, 100, [['ขนม', 60], ['เครื่องดื่ม', 40]]], 'daily trend, total and by category');
  eq([RR.hours.kind, RR.hours.keys.length, RR.hours.days, RR.hours.total.reduce((a, v) => a + v, 0)], ['hour', 24, 5, 100], 'hours of the day summed over the range');
  eq(RR.history.map(h => [h.key, h.bills, h.net, h.profit]), [['2026-11-05', 2, 100, 48], ['2026-11-04', 0, 0, 0], ['2026-11-03', 0, 0, 0], ['2026-11-02', 0, 0, 0], ['2026-11-01', 0, 0, 0]], 'history rows, newest first');
  const RM = m7('report', T, { from: '2026-09-01', to: '2026-11-30', gran: 'month' });
  eq([RM.trend.kind, RM.trend.keys, RM.trend.total, RM.history.map(h => h.key), RM.summary.net], ['month', ['2026-09', '2026-10', '2026-11'], [0, 0, 100], ['2026-11', '2026-10', '2026-09'], 100], 'monthly mode');
  m7('writeOff', T, { sku: 'B1', qty: 1, reason: 'เสียหาย' });
  m7('importProducts', T, ['sku,name,category,type,unit,cost,price,minStock,openingStock', 'C1,ขาดทุน,ขนม,nobarcode,ชิ้น,10,8,0,1'].join('\n'));
  const RL = m7('report', T, { from: '2026-11-05' });
  eq([RL.summary.loss, RL.history[0].loss, RL.summary.after], [12, 12, 48 - 12], 'damaged goods lower profit after losses');
  ok(RL.exceptions.some(x => x.action === 'BELOW_COST' && x.ref === 'C1'), 'price below cost flagged in exceptions');
  // bulk price edit (owner only)
  f7(/เจ้าของ/, 'bulkPrice', C, [{ sku: 'A1', price: 12 }]);
  eq(m7('bulkPrice', T, [{ sku: 'A1', price: 12 }, { sku: 'B1', price: 20 }, { sku: 'C1', price: 15 }]).changed, 2, 'only real changes count (B1 unchanged)');
  const bp = m7('bootstrap', T).products;
  eq([bp.find(p => p.sku === 'A1').price, bp.find(p => p.sku === 'C1').price], [12, 15], 'prices saved');
  ok(m7('report', T, { from: '2026-11-05' }).exceptions.filter(x => x.action === 'PRICE_CHANGE').length >= 2, 'each change logged');
  f7(/ราคาไม่ถูกต้อง/, 'bulkPrice', T, [{ sku: 'A1', price: -1 }]);
  m7('bulkPrice', T, [{ sku: 'A1', price: 10 }]);   // back to the price later tests use
  f7(/เจ้าของ/, 'report', C, {});
  const closed = m7('closeShift', C, 587, '');
  eq(closed.diff, 0, 'drawer balances after split + refund');
  f7(/เปิดกะ/, 'returnSale', T, { returnUid: 'R4', billNo: sp.billNo, refundMethod: 'cash', restock: true, reason: 'x', lines: [{ lineNo: 1, qty: 1 }] });
  ok(m7('returnSale', T, { returnUid: 'R5', billNo: sp.billNo, refundMethod: 'transfer', restock: true, reason: 'x', lines: [{ lineNo: 1, qty: 1 }] }).total === 10, 'return from a closed shift by transfer');
  // returns always go back to stock; spoiled goods are written off later on the Stock page
  const a0 = onH('A1');
  m7('returnSale', T, { returnUid: 'R7', billNo: sp.billNo, refundMethod: 'transfer', reason: 'x', lines: [{ lineNo: 1, qty: 3, damaged: 1 }] });
  eq(onH('A1'), a0 + 3, 'all returned pieces back in stock (damaged is ignored)');
  // made-to-order drinks (recipes): refunded, never restocked
  const drink = m7('saveProduct', T, { name: 'กาแฟเย็น', type: 'recipe', price: 30 }, [], [{ sku: 'A1', qty: 1 }]).sku;
  m7('openShift', C, 500, '');
  const bd = m7('commitSale', C, { saleUid: 'SP9', payMethod: 'cash', received: 50, lines: [{ sku: drink, qty: 1 }, { sku: 'B1', qty: 1 }] });
  const aBefore = onH('A1');
  const r9 = m7('returnSale', T, { returnUid: 'R9', billNo: bd.billNo, refundMethod: 'cash', reason: 'ชงผิด', lines: [{ lineNo: 1, qty: 1 }] });
  eq([r9.total, r9.lines[0].restocked, onH('A1')], [30, false, aBefore], 'drink refunded, ingredients not put back');
  eq(m7('returnSale', T, { returnUid: 'R10', billNo: bd.billNo, refundMethod: 'cash', reason: 'x', lines: [{ lineNo: 2, qty: 1 }] }).total, 20, 'other lines of that bill still return');
  // offline outbox: the sale keeps the time it was made and the shift it was rung up in
  const shiftNow = m7('shiftSummary', C).shiftId;
  const madeAt = '2026-11-05T01:00:00.000Z';   // 2 h before the mock clock
  const off = m7('commitSale', C, { saleUid: 'OFF1', payMethod: 'cash', received: 10, offlineAt: madeAt, shiftId: shiftNow, lines: [{ sku: 'A1', qty: 1 }] });
  eq(new Date(off.createdAt).toISOString(), madeAt, 'offline sale keeps its own time');
  eq(m7('commitSale', C, { saleUid: 'OFF1', payMethod: 'cash', received: 10, offlineAt: madeAt, shiftId: shiftNow, lines: [{ sku: 'A1', qty: 1 }] }).billNo, off.billNo, 'resending from the outbox is idempotent');
  const fut = m7('commitSale', C, { saleUid: 'OFF2', payMethod: 'cash', received: 10, offlineAt: '2026-11-06T03:00:00.000Z', lines: [{ sku: 'A1', qty: 1 }] });
  ok(new Date(fut.createdAt).toISOString() !== '2026-11-06T03:00:00.000Z', 'a time in the future is ignored');
}

{
  // Full offline: PIN credentials for the counter, signed offline work, offline shift + cash moves, oversell flag
  const crypto = require('crypto');
  const sha = t => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
  const h = makeContext({ now: '2026-11-05T03:00:00Z' });
  h.setup();
  const K = h.__props.API_KEY;
  const c8 = (fn, ...a) => JSON.parse(h.doPost({ postData: { contents: JSON.stringify({ key: K, fn, args: a }) } }).getContent());
  const m8 = (fn, ...a) => { const r = c8(fn, ...a); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  h.createOwner('O', '1111');
  const DEV = 'Dcounter8xxxxxxxxxx';
  const ownerUid = m8('status').users[0].userId;
  const notCounter = m8('login', ownerUid, '1111', 'Dother');
  ok(!notCounter.offline, 'no offline credentials for a device that is not a counter');
  const T = m8('login', ownerUid, '1111', DEV).token;
  m8('registerDevice', T, DEV, 'เครื่อง');
  m8('addUser', T, 'แคช', 'cashier', '2222');
  m8('addUser', T, 'บี', 'cashier', '3333');
  const users = m8('listUsers', T);
  const cashUid = users.find(u => u.name === 'แคช').userId, beeUid = users.find(u => u.name === 'บี').userId;
  const lc = m8('login', cashUid, '2222', DEV);
  ok(lc.offline && lc.offline.salt && lc.offline.hash === sha(lc.offline.salt + ':2222'), 'counter gets salt+hash that match the PIN');
  const C = lc.token;
  const lo = m8('login', ownerUid, '1111', DEV).offline;
  const lb = m8('login', beeUid, '3333', DEV).offline;
  m8('importProducts', T, ['sku,name,category,type,unit,cost,price,minStock,openingStock',
    'A1,น้ำ,เครื่องดื่ม,nobarcode,ขวด,4,10,0,2'].join('\n'));
  const at = '2026-11-05T01:00:00.000Z';

  // shift opened offline by บี, resent twice
  const by = (cred, ref) => ({ userId: cred.userId, proof: sha(cred.hash + ':' + ref) });
  const sh1 = m8('openShift', C, 300, '', { openUid: 'OS1', openedAt: at, offlineBy: by(lb, 'OS1') });
  const sh1b = m8('openShift', C, 300, '', { openUid: 'OS1', openedAt: at, offlineBy: by(lb, 'OS1') });
  eq(sh1b.shiftId, sh1.shiftId, 'offline shift open is idempotent');
  eq([new Date(sh1.openedAt).toISOString(), sh1.userId], [at, beeUid], 'offline shift keeps its time and who opened it');
  ok(c8('openShift', C, 300, '').ok === false, 'a second normal open still fails');

  // cash move offline, resent
  m8('cashMove', C, 'OUT', 20, 'ค่าน้ำแข็ง', { moveId: 'CM1', at, shiftId: sh1.shiftId, offlineBy: by(lb, 'CM1') });
  const sm = m8('cashMove', C, 'OUT', 20, 'ค่าน้ำแข็ง', { moveId: 'CM1', at, shiftId: sh1.shiftId, offlineBy: by(lb, 'CM1') });
  eq([sm.cashOut, sm.expectedCash], [20, 280], 'offline cash move counted once');

  // sale signed by บี, with an offline owner approval for the discount; sells 3 when only 2 are on the shelf
  const sale = { saleUid: 'OFS1', payMethod: 'cash', received: 30, billDiscount: 2, offlineAt: at, shiftId: sh1.shiftId,
    offlineBy: by(lb, 'OFS1'), offlineApproval: by(lo, 'OFS1'), lines: [{ sku: 'A1', qty: 3 }] };
  const r1 = m8('commitSale', C, sale);
  const hdr = h.__sheet('Sales').find(x => x.saleUid === 'OFS1');
  eq([r1.total, hdr.userId], [28, beeUid], 'offline sale credited to the signed-in cashier');
  const log = h.__sheet('AuditLog');
  ok(log.some(l => l.action === 'DISCOUNT' && l.ref === r1.billNo && l.approvedBy === 'O'), 'offline owner approval is accepted');
  ok(log.some(l => l.action === 'OVERSELL' && l.ref === r1.billNo && /น้ำ 1 ชิ้น/.test(l.detail)), 'overselling is flagged');

  // bad signature: never lose the sale, but credit the session user and flag it
  const r2 = m8('commitSale', C, { saleUid: 'OFS2', payMethod: 'cash', received: 10, billDiscount: 1, offlineAt: at, shiftId: sh1.shiftId,
    offlineBy: { userId: beeUid, proof: 'bad' }, offlineApproval: { userId: ownerUid, proof: 'bad' }, lines: [{ sku: 'A1', qty: 1 }] });
  const h2 = h.__sheet('Sales').find(x => x.saleUid === 'OFS2');
  eq(h2.userId, cashUid, 'unverified offline user falls back to the session');
  ok(h.__sheet('AuditLog').some(l => l.action === 'OFFLINE_CHECK' && l.ref === r2.billNo && /ส่วนลด/.test(l.detail) && /ผู้ขาย/.test(l.detail)), 'unverified offline work is flagged');
  // PIN reset makes old credentials useless
  m8('resetPin', T, beeUid, '4444');
  m8('commitSale', C, { saleUid: 'OFS3', payMethod: 'cash', received: 10, offlineAt: at, shiftId: sh1.shiftId, offlineBy: by(lb, 'OFS3'), lines: [{ sku: 'A1', qty: 1 }] });
  eq(h.__sheet('Sales').find(x => x.saleUid === 'OFS3').userId, cashUid, 'old PIN credentials stop working after a reset');
  // approve also hands the owner credentials to the counter
  ok(m8('approve', C, '1111', 'DISCOUNT').offline.userId === ownerUid, 'approval returns owner credentials on a counter');
  const rep = m8('report', T, { from: '2026-11-05', to: '2026-11-05' });
  ok(rep.exceptions.some(e => e.action === 'OVERSELL'), 'oversell shows in the report exceptions');
}

{
  // Promotions: multi-buy, buy X get Y, combo; time windows; offline sales keep what the till charged
  const fs = require('fs'), path = require('path');
  eq(fs.readFileSync(path.join(__dirname, '../web/promo.js'), 'utf8'), fs.readFileSync(path.join(__dirname, '../gas/PromoEngine.gs'), 'utf8'), 'promo engine: browser and server copies are identical');
  const h = makeContext({ now: '2026-11-05T07:00:00Z' });   // Thu 14:00 Bangkok
  h.setup();
  const K = h.__props.API_KEY;
  const c9 = (fn, ...a) => JSON.parse(h.doPost({ postData: { contents: JSON.stringify({ key: K, fn, args: a }) } }).getContent());
  const m9 = (fn, ...a) => { const r = c9(fn, ...a); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  const f9 = (re, fn, ...a) => { const r = c9(fn, ...a); ok(!r.ok && re.test(r.error), fn + ' should fail ' + re + ' got ' + JSON.stringify(r)); };
  h.createOwner('O', '1111');
  const DEV = 'Dcounter9xxxxxxxxxx';
  const T = m9('login', m9('status').users[0].userId, '1111', DEV).token;
  m9('registerDevice', T, DEV, 'เครื่อง');
  m9('importProducts', T, ['sku,name,category,type,unit,cost,price,minStock,openingStock,barcode,barcodeUnit,multiplier,barcodePrice',
    'W1,น้ำ,เครื่องดื่ม,barcode,ขวด,4,7,0,100,8850000000101,ชิ้น,1,', 'W1,,,,,,,,,8850000000102,แพ็ค,6,40',
    'W2,โซดา,เครื่องดื่ม,barcode,ขวด,6,10,0,100,8850000000201,ชิ้น,1,',
    'C1,กาแฟ,เครื่องดื่มชง,nobarcode,แก้ว,10,30,0,100,,,,', 'B1,ขนมปัง,ขนม,nobarcode,ชิ้น,8,15,0,100,,,,',
    'K1,ลูกอม,ขนม,nobarcode,ชิ้น,1,5,0,100,,,,'].join('\n'));
  m9('openShift', T, 500, '');
  f9(/ถูกกว่า/, 'savePromo', T, { name: 'แพง', type: 'multi', items: ['W1'], buyQty: 2, price: 14 });
  f9(/ถูกกว่า/, 'savePromo', T, { name: 'เซ็ตแพง', type: 'combo', items: [{ sku: 'C1', qty: 1 }, { sku: 'B1', qty: 1 }], price: 45 });
  const pm = m9('savePromo', T, { name: 'น้ำ+โซดา 2 ขวด 15', type: 'multi', items: ['W1', 'W2'], buyQty: 2, price: 15 });
  m9('savePromo', T, { name: 'ลูกอม ซื้อ 2 แถม 1', type: 'bxgy', items: ['K1'], buyQty: 2, freeQty: 1 });
  m9('savePromo', T, { name: 'กาแฟ+ขนมปัง 40', type: 'combo', items: [{ sku: 'C1', qty: 1 }, { sku: 'B1', qty: 1 }], price: 40 });
  m9('savePromo', T, { name: 'เช้า ลูกอม', type: 'multi', items: ['K1'], buyQty: 2, price: 6, timeFrom: '06:00', timeTo: '10:00' });
  m9('savePromo', T, { name: 'เสาร์อาทิตย์', type: 'multi', items: ['B1'], buyQty: 2, price: 20, days: [0, 6] });
  f9(/ไม่เกิน 99/, 'savePromo', T, { name: 'x', type: 'single', items: ['W2'], discType: 'pct', value: 100 });
  f9(/ถูกกว่า/, 'savePromo', T, { name: 'x', type: 'single', items: ['W2'], discType: 'price', value: 12 });
  const sg = m9('savePromo', T, { name: 'โซดาลด 20%', type: 'single', items: ['W2'], discType: 'pct', value: 20 });
  ok(m9('bootstrap', T).promos.length === 6, 'till gets the active promotions');

  // single-item cut: 2 soda alone, multi-buy (needs pairs that save) takes them first: (10+10)->15 saves 5
  const rs = m9('commitSale', T, { saleUid: 'PS1', payMethod: 'cash', received: 50, lines: [{ sku: 'W2', qty: 3 }] });
  eq([rs.promoDiscount, rs.promos.map(a => a.name)], [7, ['น้ำ+โซดา 2 ขวด 15', 'โซดาลด 20%']], 'pair goes to the multi-buy, the third soda gets 20% off');
  m9('setPromoActive', T, sg.promoId, false);
  // 3 water + 1 soda: (10+7)->15 saves 2; (7+7) would cost more as a set, so stays normal; the pack is not eligible
  const r1 = m9('commitSale', T, { saleUid: 'P1', payMethod: 'cash', received: 200, lines: [{ sku: 'W1', qty: 3 }, { sku: 'W2', qty: 1 }, { barcode: '8850000000102', qty: 1 }] });
  eq([r1.subtotal, r1.promoDiscount, r1.total], [71, 2, 69], 'multi-buy across two products; packs keep their own price');
  eq(r1.promos.map(a => [a.name, a.times, a.discount]), [['น้ำ+โซดา 2 ขวด 15', 1, 2]], 'applied promotion on the receipt');
  eq(r1.lines.reduce((a, l) => a + l.promo, 0), 2, 'per-line promo adds up');
  // 7 candies: buy 2 get 1 -> 2 free (morning deal is outside its hours)
  const r2 = m9('commitSale', T, { saleUid: 'P2', payMethod: 'cash', received: 50, lines: [{ sku: 'K1', qty: 7 }] });
  eq([r2.promoDiscount, r2.total], [10, 25], 'buy 2 get 1 free, time window respected');
  // combo + weekend promo (Thursday: off)
  const r3 = m9('commitSale', T, { saleUid: 'P3', payMethod: 'cash', received: 100, lines: [{ sku: 'C1', qty: 1 }, { sku: 'B1', qty: 2 }] });
  eq([r3.promoDiscount, r3.total], [5, 55], 'combo once; the extra bread pays full price; weekend deal off on Thursday');
  // manual discount on top still needs the owner and must fit what is left
  f9(/เกินราคา/, 'commitSale', T, { saleUid: 'P4', payMethod: 'cash', received: 100, lines: [{ sku: 'C1', qty: 1, lineDiscount: 30 }, { sku: 'B1', qty: 1 }] });
  // switched off -> gone
  m9('setPromoActive', T, pm.promoId, false);
  eq(m9('commitSale', T, { saleUid: 'P5', payMethod: 'cash', received: 20, lines: [{ sku: 'W1', qty: 2 }] }).total, 14, 'switched-off promotion no longer applies');
  // offline sale: keeps the amounts the till charged
  const r6 = m9('commitSale', T, { saleUid: 'P6', payMethod: 'cash', received: 20, offlineAt: '2026-11-05T06:00:00.000Z', lines: [{ sku: 'W1', qty: 2 }],
    promo: { lines: [1], applied: [{ promoId: pm.promoId, name: 'น้ำ+โซดา 2 ขวด 15', times: 1, discount: 1 }] } });
  eq([r6.total, r6.promoDiscount], [13, 1], 'offline sale keeps the promotion the till applied');
  const rep = m9('report', T, { from: '2026-11-05', to: '2026-11-05' });
  eq(rep.summary.promo, 25, 'report totals promotion discounts');
  ok(rep.promos.find(p => p.name === 'น้ำ+โซดา 2 ขวด 15').discount === 8, 'report lists promotion use');
  // return part of a promo bill: refund what was actually paid for that line
  const ret = m9('returnSale', T, { returnUid: 'RP1', billNo: r3.billNo, refundMethod: 'cash', reason: 'x', lines: [{ lineNo: 1, qty: 1 }] });
  ok(ret.total < 30, 'refund of a combo item is its share after the promotion (' + ret.total + ')');
}

{
  // Customer-display slides: upload (owner), list, image, reorder, switch off, delete
  const h = makeContext({ now: '2026-11-05T03:00:00Z' });
  h.setup();
  const K = h.__props.API_KEY;
  const c = (fn, ...a) => JSON.parse(h.doPost({ postData: { contents: JSON.stringify({ key: K, fn, args: a }) } }).getContent());
  const m = (fn, ...a) => { const r = c(fn, ...a); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  h.createOwner('O', '1111');
  const T = m('login', m('status').users[0].userId, '1111', 'Dx').token;
  m('addUser', T, 'แคช', 'cashier', '2222');
  const C = m('login', m('listUsers', T).find(u => u.name === 'แคช').userId, '2222', 'Dx').token;
  const img = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-bytes').toString('base64');
  ok(!c('uploadSlide', C, { title: 'x', dataUrl: img }).ok, 'only the owner uploads slides');
  ok(!c('uploadSlide', T, { title: 'x', dataUrl: 'data:text/plain;base64,aGk=' }).ok, 'only images');
  const a = m('uploadSlide', T, { title: 'กาแฟใหม่', dataUrl: img, startDate: '2026-11-01', endDate: '2026-11-30' });
  const b = m('uploadSlide', T, { title: 'น้ำแข็ง', dataUrl: img });
  eq(m('listSlides', C).map(s => s.title), ['กาแฟใหม่', 'น้ำแข็ง'], 'slides listed in order');
  eq(m('slideImage', C, a.slideId).dataUrl, img, 'image comes back as uploaded');
  eq(m('saveSlide', T, { slideId: b.slideId, move: -1 }).map(s => s.title), ['น้ำแข็ง', 'กาแฟใหม่'], 'reorder');
  ok(m('saveSlide', T, { slideId: a.slideId, active: false }).find(s => s.slideId === a.slideId).active === false, 'switch off');
  ok(m('bootstrap', T).slides.length === 2 && m('bootstrap', T).settings.slideSeconds === '8', 'bootstrap carries slides + settings');
  eq(m('deleteSlide', T, a.slideId).map(s => s.title), ['น้ำแข็ง'], 'delete removes the row');
  ok(!Object.keys(h.__files).includes('FILE1'), 'deleted slide image is trashed in Drive');
}

{
  // Product photos: owner uploads, saving the product keeps it, replace trashes the old file, remove clears it
  const h = makeContext({ now: '2026-11-05T03:00:00Z' });
  h.setup();
  const K = h.__props.API_KEY;
  const c = (fn, ...a) => JSON.parse(h.doPost({ postData: { contents: JSON.stringify({ key: K, fn, args: a }) } }).getContent());
  const m = (fn, ...a) => { const r = c(fn, ...a); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  h.createOwner('O', '1111');
  const T = m('login', m('status').users[0].userId, '1111', 'Dx').token;
  m('importProducts', T, ['sku,name,category,type,unit,cost,price,minStock,openingStock', 'C1,กาแฟ,เครื่องดื่มชง,nobarcode,แก้ว,10,30,0,0'].join('\n'));
  const img = 'data:image/jpeg;base64,' + Buffer.from('photo-1').toString('base64');
  const up = m('uploadProductImage', T, 'C1', img);
  ok(up.image && m('bootstrap', T).products.find(p => p.sku === 'C1').image === up.image, 'product carries its photo id');
  eq(m('productImage', T, up.image).dataUrl, img, 'photo comes back');
  const batch = m('productImages', T, [up.image, 'nope']);
  eq([batch.images[up.image], batch.missing], [img, ['nope']], 'several photos in one call; unknown ids reported');
  const p0 = m('bootstrap', T).products.find(p => p.sku === 'C1');
  m('saveProduct', T, Object.assign({}, p0, { price: 35 }), [], []);
  eq(m('bootstrap', T).products.find(p => p.sku === 'C1').image, up.image, 'editing the product keeps the photo');
  const up2 = m('uploadProductImage', T, 'C1', 'data:image/jpeg;base64,' + Buffer.from('photo-2').toString('base64'));
  ok(up2.image !== up.image && !h.__files[up.image], 'new photo replaces and trashes the old one');
  ok(!c('productImage', T, up.image).ok, 'old photo id no longer served');
  m('removeProductImage', T, 'C1');
  eq(m('bootstrap', T).products.find(p => p.sku === 'C1').image, '', 'photo removed');
}

{
  // Accounting: wallets, opening float source, credit sales, customer payments, expenses, payables, deposit, P&L
  const h = makeContext({ now: '2026-11-05T03:00:00Z' });
  h.setup();
  const K = h.__props.API_KEY;
  const c = (fn, ...a) => JSON.parse(h.doPost({ postData: { contents: JSON.stringify({ key: K, fn, args: a }) } }).getContent());
  const m = (fn, ...a) => { const r = c(fn, ...a); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  h.createOwner('O', '1111');
  const DV = 'Dacc0000000000000001';
  let T = m('login', m('status').users[0].userId, '1111', DV).token;
  m('registerDevice', T, DV, 'เครื่อง 1');
  T = m('login', m('status').users[0].userId, '1111', DV).token;
  m('importProducts', T, ['sku,name,category,type,unit,cost,price,minStock,openingStock', 'W1,น้ำ,เครื่องดื่ม,nobarcode,ขวด,5,7,0,0'].join('\n'));
  const boot = m('bootstrap', T);
  eq(boot.wallets.map(w => w.walletId), ['WRESERVE', 'WBANK'], 'default wallets: cash reserve + bank');
  eq(boot.prevFloat, 0, 'first shift starts from 0 in the drawer');
  m('accSetup', T, { start: '2026-11-01', wallets: [
    { walletId: 'WRESERVE', name: 'เงินสดสำรอง', type: 'reserve', opening: 10000 },
    { walletId: 'WBANK', name: 'กสิกร', type: 'bank', opening: 50000, receivesQr: true }] });
  m('receive', T, { receiptUid: 'R1', supplier: 'แม็คโคร', payFrom: 'WBANK', lines: [{ sku: 'W1', qty: 12, unitCost: 5 }] });
  m('receive', T, { receiptUid: 'R2', supplier: 'เอเย่นต์', payFrom: 'credit', dueDate: '2026-11-20', lines: [{ sku: 'W1', qty: 2, unitCost: 5 }] });
  const sh = m('openShift', T, 1000, '', { source: 'owner' });
  ok(sh.shiftId, 'shift open');
  const line = [{ sku: 'W1', qty: 2 }];
  m('commitSale', T, { saleUid: 'A1', payMethod: 'cash', received: 20, lines: line });
  m('commitSale', T, { saleUid: 'A2', payMethod: 'qr', lines: [{ sku: 'W1', qty: 1 }] });
  const cr = m('commitSale', T, { saleUid: 'A3', payMethod: 'credit', customer: { customerId: 'CU1', name: 'ป้าแดง' }, lines: [{ sku: 'W1', qty: 1 }] });
  eq([cr.credit, cr.customer], [7, 'ป้าแดง'], 'credit bill names the customer');
  m('commitSale', T, { saleUid: 'A4', payMethod: 'credit', customer: { customerId: 'CU1' }, lines: [{ sku: 'W1', qty: 1 }] });
  const cs = m('customers', T);
  eq([cs.length, cs[0].name, cs[0].balance, cs[0].bills], [1, 'ป้าแดง', 14, 2], 'picking the same name again adds to that customer');
  ok(!c('custPay', T, { payUid: 'P0', customerId: 'CU1', amount: 20, method: 'cash' }).ok, 'cannot take more than owed');
  m('custPay', T, { payUid: 'P1', customerId: 'CU1', amount: 5, method: 'cash' });
  eq(m('custPay', T, { payUid: 'P1', customerId: 'CU1', amount: 5, method: 'cash' }).duplicate, true, 'customer payment idempotent');
  m('cashMove', T, 'OUT', 20, 'ค่าน้ำแข็ง', { kind: 'expense', category: 'น้ำแข็ง' });
  const sum = m('shiftSummary', T);
  eq([sum.creditSales, sum.custPayCash, sum.expectedCash], [14, 5, 999], 'credit sales stay out of the drawer, cash paid back goes in');
  m('saveExpense', T, { expUid: 'E1', date: '2026-11-04', category: 'ค่าไฟ / น้ำ', amount: 300, payFrom: 'WBANK', note: 'ค่าไฟ ต.ค.' });
  m('saveExpense', T, { expUid: 'E2', date: '2026-11-04', category: 'ซ่อมบำรุง', amount: 100, payFrom: 'credit', party: 'ช่างวิทย์', dueDate: '2026-11-10' });
  let aps = m('payables', T);
  eq(aps.map(p => [p.party, p.left]), [['ช่างวิทย์', 100], ['เอเย่นต์', 10]], 'payables from a credit expense and a credit receive, by due date');
  m('payPayable', T, aps[0].payableId, 100, 'WRESERVE');
  eq(m('payables', T).length, 1, 'paid payable leaves the list');
  ok(!c('closeShift', T, 999, '', { floatLeft: 500 }).ok, 'deposit needs a destination');
  m('closeShift', T, 999, '', { floatLeft: 500, depositTo: 'WBANK' });
  m('writeOff', T, { sku: 'W1', qty: 1, reason: m('bootstrap', T).products ? 'เสียหาย' : '' });
  const W = m('wallets', T, 'WBANK');
  const bank = W.wallets.find(w => w.walletId === 'WBANK'), res = W.wallets.find(w => w.walletId === 'WRESERVE');
  eq([bank.balance, bank.pending, res.balance], [50000 - 60 + 7 - 300, 499, 10000 - 100], 'wallet balances: receive, QR sale, expense, pending deposit, payable');
  eq(W.drawers[0].cash, 500, 'drawer keeps the float after closing');
  const dep = W.rows.find(r => r.kind === 'DEPOSIT');
  ok(dep && !dep.cleared, 'deposit waits until marked banked');
  m('setCleared', T, dep.txId, true);
  eq(m('wallets', T, 'WBANK').wallets.find(w => w.walletId === 'WBANK').balance, 50000 - 60 + 7 - 300 + 499, 'banked deposit counts');
  const A = m('accSummary', T, { from: '2026-11-01', to: '2026-11-05' });
  eq([A.f.netSales, A.f.cogs, A.f.waste, A.f.expenses, A.f.credit], [35, 25, 5, 420, 14], 'P&L figures');
  eq(A.f.net, 35 - 25 - 5 - 420, 'net profit');
  eq(A.f.byCat['น้ำแข็ง'], 20, 'drawer cash-out counted as an expense');
  eq(A.f.invests, 1000, 'first float from the owner counts as money put in');
  eq([A.stock.purchases, A.stock.start, A.stock.end, A.assets.stock], [70, 0, 40, 40], 'stock: bought 70, 8 bottles left at cost 5');
  eq([A.assets.receivable, A.assets.payable], [9, 10], 'customer owes 9, we owe the supplier 10');
  const sh2 = m('openShift', T, 500, '', {});
  eq(m('shiftSummary', T).prevFloat, 500, 'next shift carries the float');
  m('closeShift', T, 500, '', { floatLeft: 500 });
  m('openShift', T, 600, '', { source: 'WRESERVE' });
  eq(m('wallets', T).wallets.find(w => w.walletId === 'WRESERVE').balance, 9900 - 100, 'extra float taken from the cash reserve');
  const ex = m('expenses', T, { from: '2026-11-01', to: '2026-11-05' });
  eq(ex.rows.length, 3, 'expense list: bank, credit and drawer');
  eq(ex.purchases.map(p => p.status), ['ค้างจ่าย · ครบ 2026-11-20', 'จ่ายแล้ว'], 'purchases show how they were paid');
  const tax = m('accTax', T, '2026', false);
  eq([tax.income, tax.flat], [35, 21], 'tax: income and the 60% flat deduction');
  ok(tax.actual === 25 + 5 + 420, 'tax: actual expenses');
  ok(sh2.shiftId, 'shift 2');
}

{
  // Shop internet: device names by MAC (owner only)
  const h = makeContext({ now: '2026-11-15T03:00:00Z' });
  h.setup();
  const K = h.__props.API_KEY;
  const c = (fn, ...a) => JSON.parse(h.doPost({ postData: { contents: JSON.stringify({ key: K, fn, args: a }) } }).getContent());
  const m = (fn, ...a) => { const r = c(fn, ...a); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  h.createOwner('O', '1111');
  const T = m('login', m('status').users[0].userId, '1111', 'Dnet0000000000000001').token;
  m('addUser', T, 'มิว', 'cashier', '2222');
  const mew = m('listUsers', T).find(u => u.name === 'มิว');
  const TC = m('login', mew.userId, '2222', 'Dnet0000000000000001').token;
  ok(!c('netDevices', TC).ok, 'cashier cannot see the network list');
  ok(!c('saveNetDevice', T, { mac: '12:34' }).ok, 'bad MAC refused');
  m('saveNetDevice', T, { mac: '3c-52-82-1a-4f-09', name: 'POS หน้าร้าน', type: 'pc', locked: true, allowed: true });
  m('saveNetDevice', T, { mac: '3C:52:82:1A:4F:09', ownerId: mew.userId });
  m('saveNetDevice', T, { mac: 'D2:6F:3B:90:AE:14', name: 'HUAWEI-P30', allowed: false });
  let list = m('netDevices', T);
  eq(list.map(d => [d.mac, d.name, d.type, d.locked, d.allowed, d.ownerId]), [['3C:52:82:1A:4F:09', 'POS หน้าร้าน', 'pc', true, true, mew.userId], ['D2:6F:3B:90:AE:14', 'HUAWEI-P30', 'other', false, false, '']], 'devices saved, MAC normalised, partial update keeps fields');
  m('deleteNetDevice', T, 'D2:6F:3B:90:AE:14');
  eq(m('netDevices', T).length, 1, 'deleted device hidden');
  m('saveNetDevice', T, { mac: 'D2:6F:3B:90:AE:14', name: 'มือถือแบงค์', allowed: true });
  // whitelist from another screen: queued for the counter PC, which reports back
  m('saveNetDevice', T, { mac: 'aa-bb-cc-00-11-22', name: 'มือถือมิว', pending: 'allow' });
  let q = m('netDevices', T).find(d => d.mac === 'AA:BB:CC:00:11:22');
  eq([q.pending, q.allowed], ['allow', false], 'queued, not yet allowed');
  ok(/เครื่องสำคัญ/.test(c('saveNetDevice', T, { mac: '3C:52:82:1A:4F:09', pending: 'block' }).error), 'important device cannot be queued for blocking');
  ok(!c('netPending', T).ok, 'only a registered counter PC takes the queue');
  m('registerDevice', T, 'Dnet0000000000000001', 'เครื่องหน้าร้าน');
  eq(m('netPending', T).map(d => d.mac), ['AA:BB:CC:00:11:22'], 'counter sees the queue');
  m('netPendingDone', T, 'AA:BB:CC:00:11:22', false, 'WiFi เต็ม');
  eq(m('netDevices', T).find(d => d.mac === 'AA:BB:CC:00:11:22').pendingErr, 'WiFi เต็ม', 'failure kept with reason');
  m('netPendingDone', T, 'AA:BB:CC:00:11:22', true);
  q = m('netDevices', T).find(d => d.mac === 'AA:BB:CC:00:11:22');
  eq([q.pending, q.allowed, q.pendingErr], ['', true, ''], 'done: allowed');
  eq(m('netPending', T).length, 0, 'queue empty');
  eq(m('netDevices', T).find(d => d.mac === 'D2:6F:3B:90:AE:14').name, 'มือถือแบงค์', 'saved again after delete');
}

{
  // เริ่มใช้งานจริง: clear test data once (owner, PIN, phrase, backup first, never twice)
  const h = makeContext({ now: '2026-11-16T02:00:00Z' });
  h.setup();
  const K = h.__props.API_KEY;
  const c = (fn, ...a) => JSON.parse(h.doPost({ postData: { contents: JSON.stringify({ key: K, fn, args: a }) } }).getContent());
  const m = (fn, ...a) => { const r = c(fn, ...a); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  h.createOwner('O', '1111');
  const DEVA = 'Dlive000000000000001', DEVB = 'Dlive000000000000002';
  const T = m('login', m('status').users[0].userId, '1111', DEVA).token;
  m('registerDevice', T, DEVA, 'เครื่อง 1');
  m('registerDevice', T, DEVB, 'Test');
  m('saveProduct', T, { name: 'น้ำ', price: 10, cost: 5, type: 'nobarcode', unit: 'ขวด' });
  const sku = m('listProducts', T)[0].sku;
  m('receive', T, { receiptUid: 'R1', lines: [{ sku, qty: 10, unitCost: 5 }] });
  m('openShift', T, 500, '');
  m('commitSale', T, { saleUid: 'S1', payMethod: 'cash', received: 20, lines: [{ sku, qty: 2 }] });
  m('saveNetDevice', T, { mac: '3C:52:82:1A:4F:09', name: 'POS', allowed: true });
  m('addUser', T, 'มิว', 'cashier', '2222');
  const mew = m('listUsers', T).find(u => u.name === 'มิว');
  const TC = m('login', mew.userId, '2222', DEVA).token;
  ok(!c('goLive', TC, { pin: '2222', phrase: 'เริ่มใช้งานจริง' }).ok, 'cashier cannot go live');
  const pv = m('goLivePreview', T);
  ok(pv.counts.Sales === 1 && pv.counts.Lots >= 1 && pv.devices.length === 2 && !pv.liveSince, 'preview counts what will be cleared');
  ok(/PIN/.test(c('goLive', T, { pin: '9999', phrase: 'เริ่มใช้งานจริง' }).error), 'wrong PIN refused');
  ok(/คำยืนยัน/.test(c('goLive', T, { pin: '1111', phrase: 'เริ่ม' }).error), 'wrong phrase refused');
  eq(h.__ss.getSheetByName('Sales').getLastRow(), 2, 'nothing cleared by refused tries');
  const nb = h.__backups.length;
  const r = m('goLive', T, { pin: '1111', phrase: 'เริ่มใช้งานจริง', clearCatalog: false, keepDevices: [DEVA] });
  ok(h.__backups.length === nb + 1 && /ก่อนเริ่มใช้จริง/.test(r.backup), 'labelled backup made first');
  ['Sales', 'SaleLines', 'Shifts', 'Lots', 'LotUse', 'Receipts', 'StockMoves'].forEach(n => eq(h.__ss.getSheetByName(n).getLastRow(), 1, n + ' cleared, header kept'));
  const ps = m('listProducts', T);
  ok(ps.length === 1 && ps[0].onHand === 0, 'products kept, stock reset to 0');
  eq(m('listDevices', T).map(d => d.name), ['เครื่อง 1'], 'only the kept counter stays registered');
  eq(m('netDevices', T).length, 1, 'shop internet list kept');
  ok(m('listUsers', T).length === 2, 'users kept');
  ok(m('goLivePreview', T).liveSince, 'liveSince recorded');
  ok(/ไปแล้ว/.test(c('goLive', T, { pin: '1111', phrase: 'เริ่มใช้งานจริง', clearCatalog: true }).error), 'cannot run twice');
  eq(m('listProducts', T).length, 1, 'second press changed nothing');
  ok(m('auditLog', T, 10).some(a => a.action === 'GO_LIVE'), 'go-live logged');
  // after going live the shop works normally
  m('receive', T, { receiptUid: 'R2', lines: [{ sku, qty: 24, unitCost: 6 }] });
  eq(m('listProducts', T)[0].onHand, 24, 'first real receipt starts the stock');
  // opening stock: what was already on the shelves, entered once — a stock-in, not a "found extra" profit
  m('saveProduct', T, { name: 'ขนมปัง', price: 15, type: 'nobarcode', unit: 'ชิ้น' });
  const bread = m('listProducts', T).find(p => p.name === 'ขนมปัง').sku;
  ok(!c('startOpening', TC).ok, 'cashier cannot start the opening stock');
  m('startOpening', T);
  eq(m('status').settings.openingActive, '1', 'shop locked on every device');
  ok(/กำลังตั้งยอดเปิดร้าน/.test(c('commitSale', TC, { saleUid: 'LOCK1', payMethod: 'cash', received: 100, lines: [{ sku, qty: 1 }] }).error), 'no sales while counting');
  ok(/กำลังตั้งยอดเปิดร้าน/.test(c('receive', T, { receiptUid: 'LOCK2', lines: [{ sku, qty: 1, unitCost: 5 }] }).error), 'no receiving while counting');
  ok(!c('stockCount', TC, { countUid: 'OPC', lines: [{ sku: bread, counted: 1 }] }).ok, 'cashier cannot count opening stock');
  // the normal count, while the mode is on: stock = count, cost per piece, no approval, can be saved shelf by shelf
  const op = m('stockCount', T, { countUid: 'OP1', lines: [{ sku: bread, counted: 30, cost: 8 }] });
  m('stockCount', T, { countUid: 'OP2', lines: [{ sku, counted: 30 }] });
  ok(op.opening, 'saved as opening stock');
  const after = Object.fromEntries(m('listProducts', T).map(p => [p.name, p]));
  eq([after['ขนมปัง'].onHand, after['ขนมปัง'].cost, after['น้ำ'].onHand], [30, 8, 30], 'stock = the count');
  m('accSetup', T, { start: '2026-11-16', wallets: [{ name: 'กสิกร', type: 'bank', opening: 5000, receivesQr: true }] });
  m('finishOpening', T);
  eq([m('status').settings.openingActive, m('status').settings.openingDone], ['', '1'], 'unlocked and done');
  ok(/ครั้งเดียว/.test(c('startOpening', T).error), 'only once');
  ok(!m('stockCount', T, { countUid: 'C9', lines: [{ sku: bread, counted: 30 }] }).opening, 'after finishing, counts are regular counts again');
  const acc = m('accSummary', T, { from: '2026-01-01', to: '2026-12-31' });
  eq([acc.stock.shrink, acc.stock.opening], [0, 240 + 36], 'accounting: opening stock on its own line, not a gain');
  ok(m('auditLog', T, 20).some(a => a.action === 'STOCK_OPENING'), 'logged');
}

{
  // Minimum stock worked out from sales (and shelf life); a typed number wins
  const h = makeContext({ now: '2026-11-01T02:00:00Z' });
  h.setup();
  const K = h.__props.API_KEY;
  const c = (fn, ...a) => JSON.parse(h.doPost({ postData: { contents: JSON.stringify({ key: K, fn, args: a }) } }).getContent());
  const m = (fn, ...a) => { const r = c(fn, ...a); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  h.createOwner('O', '1111');
  const DEV = 'Dmin0000000000000001', uid = m('status').users[0].userId;
  let T = m('login', uid, '1111', DEV).token;
  m('registerDevice', T, DEV, 'เครื่อง 1');
  m('saveProduct', T, { name: 'โค้ก', price: 16, type: 'nobarcode', unit: 'กระป๋อง' });
  m('saveProduct', T, { name: 'ขนมปัง', price: 20, type: 'nobarcode', unit: 'ชิ้น' });
  m('saveProduct', T, { name: 'ไฟแช็ก', price: 10, type: 'nobarcode', unit: 'อัน', minManual: 30 });
  m('saveProduct', T, { name: 'นมสด', price: 15, type: 'nobarcode', unit: 'ขวด' });
  m('saveProduct', T, { name: 'โยเกิร์ต', price: 12, type: 'nobarcode', unit: 'ถ้วย' });
  const P = Object.fromEntries(m('listProducts', T).map(p => [p.name, p.sku]));
  m('receive', T, { receiptUid: 'R1', lines: [{ sku: P['โค้ก'], qty: 200, unitCost: 12, expiryDate: '2027-01-01' }, { sku: P['ขนมปัง'], qty: 100, unitCost: 15, expiryDate: '2026-11-07' }, { sku: P['ไฟแช็ก'], qty: 50, unitCost: 5 }] });
  m('receive', T, { receiptUid: 'Y0', supplier: 'ฟาร์มโคนม', lines: [{ sku: P['โยเกิร์ต'], qty: 100, unitCost: 8 }] });
  let r0 = m('recomputeMinStock', T);
  ok(r0.waiting >= 2, 'no history yet: waits instead of guessing');
  m('openShift', T, 500, '');
  for (let d = 0; d < 10; d++) {
    // the dairy van comes every 2 days with milk
    if (d % 2 === 0) m('receive', T, { receiptUid: 'M' + d, supplier: 'ฟาร์มโคนม', lines: [{ sku: P['นมสด'], qty: 10, unitCost: 10 }] });
    m('commitSale', T, { saleUid: 'S' + d, payMethod: 'cash', received: 300, lines: [{ sku: P['โค้ก'], qty: 4 }, { sku: P['ขนมปัง'], qty: 3 }, { sku: P['นมสด'], qty: 5 }, { sku: P['โยเกิร์ต'], qty: 1 }] });
    h.__advance(24 * 3600 * 1000);
    T = m('login', uid, '1111', DEV).token;
  }
  const r = m('recomputeMinStock', T);
  const ps = Object.fromEntries(m('listProducts', T).map(p => [p.name, p]));
  eq(ps['โค้ก'].avgDaily, 4, 'sold per day');
  eq(ps['โค้ก'].minStock, 28, 'coke: 4/day × 7 days cover');
  eq(ps['ขนมปัง'].shelfDays, 6, 'bread shelf life from its lot');
  eq(ps['ขนมปัง'].minStock, 9, 'bread: cover capped at half its 6-day shelf life (3 × 3)');
  eq([ps['ไฟแช็ก'].minStock, ps['ไฟแช็ก'].minManual], [30, 30], 'typed minimum wins');
  ok(r.auto >= 2 && r.manual === 1, 'summary counts');
  eq([ps['นมสด'].cycleDays, ps['นมสด'].minStock], [2, 10], 'milk restocked every 2 days: 5/day × 2');
  eq([ps['โยเกิร์ต'].cycleDays, ps['โยเกิร์ต'].minStock], [2, 2], 'yogurt received once: uses its supplier\'s 2-day rhythm');
  eq(ps['โค้ก'].cycleDays, '', 'coke received once from nobody known: falls back to the setting');
  m('saveProduct', T, Object.assign({}, ps['ไฟแช็ก'], { minManual: '' }));
  m('recomputeMinStock', T);
  eq(m('listProducts', T).find(p => p.name === 'ไฟแช็ก').minManual, '', 'cleared back to automatic');
  m('saveSettings', T, { reorderDays: '14' });
  m('recomputeMinStock', T);
  eq(m('listProducts', T).find(p => p.name === 'โค้ก').minStock, 56, 'longer restock cycle → higher minimum');
}

{
  // Delete a product: gone if never used, switched off if it has history
  const h = makeContext({ now: '2026-11-17T02:00:00Z' });
  h.setup();
  const K = h.__props.API_KEY;
  const c = (fn, ...a) => JSON.parse(h.doPost({ postData: { contents: JSON.stringify({ key: K, fn, args: a }) } }).getContent());
  const m = (fn, ...a) => { const r = c(fn, ...a); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  h.createOwner('O', '1111');
  const DEV = 'Ddel0000000000000001', uid = m('status').users[0].userId;
  const T = m('login', uid, '1111', DEV).token;
  m('registerDevice', T, DEV, 'เครื่อง 1');
  m('saveProduct', T, { name: 'พิมพ์ผิด', price: 10, type: 'barcode' }, [{ barcode: '8850000000017', unitName: 'ชิ้น', multiplier: 1 }]);
  m('saveProduct', T, { name: 'โค้ก', price: 16, type: 'nobarcode' });
  const P = Object.fromEntries(m('listProducts', T).map(p => [p.name, p.sku]));
  m('receive', T, { receiptUid: 'R1', lines: [{ sku: P['โค้ก'], qty: 10, unitCost: 12 }] });
  m('addUser', T, 'มิว', 'cashier', '2222');
  const TC = m('login', m('listUsers', T).find(u => u.name === 'มิว').userId, '2222', DEV).token;
  ok(!c('deleteProduct', TC, P['พิมพ์ผิด']).ok, 'cashier cannot delete products');
  ok(m('deleteProduct', T, P['พิมพ์ผิด']).deleted, 'unused product deleted');
  ok(!m('listProducts', T).some(p => p.name === 'พิมพ์ผิด') && !m('bootstrap', T).barcodes.some(b => b.barcode === '8850000000017'), 'its row and barcode are gone');
  {
    // rows are removed, not left blank — and an old blank gap gets cleaned up on the next delete
    m('saveProduct', T, { name: 'ก', price: 1, type: 'nobarcode' });
    m('saveProduct', T, { name: 'ข', price: 1, type: 'nobarcode' });
    const ps = h.__ss.getSheetByName('Products');
    const blankRows = () => ps.data.slice(1, ps.getLastRow()).filter(r => !(r || []).some(v => v !== '' && v !== undefined)).length;
    eq(blankRows(), 0, 'deleting a product leaves no blank row in Products');
    const bs = h.__ss.getSheetByName('Barcodes');
    eq(bs.data.slice(1, bs.getLastRow()).filter(r => !(r || []).some(v => v !== '' && v !== undefined)).length, 0, 'or in Barcodes');
    ps.data.splice(2, 0, ps.data[1].map(() => ''));   // a gap left by an older version
    ok(blankRows() === 1, 'gap set up');
    m('deleteProduct', T, m('listProducts', T).find(p => p.name === 'ข').sku);
    eq(blankRows(), 0, 'old gap removed with the next delete');
    ok(m('listProducts', T).some(p => p.name === 'ก'), 'other products untouched');
  }
  const r = m('deleteProduct', T, P['โค้ก']);
  ok(r.archived && /รับเข้า/.test(r.reason), 'product with history is switched off instead');
  eq(m('listProducts', T).find(p => p.name === 'โค้ก').active, false, 'still there, inactive');
  m('saveProduct', T, { name: 'ใหม่', price: 5, type: 'barcode' }, [{ barcode: '8850000000017', unitName: 'ชิ้น', multiplier: 1 }]);
  ok(m('bootstrap', T).barcodes.some(b => b.barcode === '8850000000017'), 'barcode of a deleted product can be used again');
}

{
  // Sale-screen rows (sub-groups) and drag-and-drop order
  const h = makeContext({ now: '2026-11-17T02:00:00Z' });
  h.setup();
  const K = h.__props.API_KEY;
  const c = (fn, ...a) => JSON.parse(h.doPost({ postData: { contents: JSON.stringify({ key: K, fn, args: a }) } }).getContent());
  const m = (fn, ...a) => { const r = c(fn, ...a); if (!r.ok) throw new Error(fn + ': ' + r.error); return r.data; };
  h.createOwner('O', '1111');
  const DEV = 'Dkey0000000000000001', uid = m('status').users[0].userId;
  const T = m('login', uid, '1111', DEV).token;
  ['โค้ก', 'สไปรท์', 'M-150', 'คาราบาว'].forEach(n => m('saveProduct', T, { name: n, price: 15, type: 'nobarcode', quickKey: true, quickKeyGroup: 'เครื่องดื่ม', quickKeyRow: n.length > 4 ? 'ชูกำลัง' : 'น้ำอัดลม' }));
  const P = () => Object.fromEntries(m('listProducts', T).map(p => [p.name, p]));
  eq([P()['โค้ก'].quickKeyRow, P()['คาราบาว'].quickKeyRow], ['น้ำอัดลม', 'ชูกำลัง'], 'row saved with the product');
  const s = Object.fromEntries(Object.entries(P()).map(([k, v]) => [k, v.sku]));
  m('addUser', T, 'มิว', 'cashier', '2222');
  const TC = m('login', m('listUsers', T).find(u => u.name === 'มิว').userId, '2222', DEV).token;
  ok(!c('saveKeyLayout', TC, 'เครื่องดื่ม', []).ok, 'cashier cannot rearrange keys');
  const r = m('saveKeyLayout', T, 'เครื่องดื่ม', [{ name: 'ชูกำลัง', skus: [s['คาราบาว'], s['M-150']] }, { name: 'น้ำอัดลม', skus: [s['สไปรท์'], s['โค้ก']] }]);
  eq(r.saved, 4, 'four keys saved');
  const q = P();
  eq(['คาราบาว', 'M-150', 'สไปรท์', 'โค้ก'].map(n => [q[n].quickKeyOrder, q[n].quickKeyRow]), [[1, 'ชูกำลัง'], [2, 'ชูกำลัง'], [3, 'น้ำอัดลม'], [4, 'น้ำอัดลม']], 'order and rows follow the screen');
  m('saveProduct', T, Object.assign({}, q['โค้ก'], { price: 16 }), []);
  eq(P()['โค้ก'].quickKeyRow, 'น้ำอัดลม', 'editing a product keeps its row');
  m('saveProduct', T, Object.assign({}, q['โค้ก'], { quickKeyRow: undefined }), []);
  eq(P()['โค้ก'].quickKeyRow, 'น้ำอัดลม', 'an older client without the field keeps the row');
  ok(/1–5 หลัก/.test(c('saveProduct', T, Object.assign({}, P()['โค้ก'], { plu: '885123' }), []).error), 'PLU of 6+ digits refused (would clash with barcodes)');
  ok(/1–5 หลัก/.test(c('saveProduct', T, Object.assign({}, P()['โค้ก'], { plu: 'A1' }), []).error), 'PLU must be digits');
  eq(m('saveProduct', T, Object.assign({}, P()['โค้ก'], { plu: '7' }), []).sku, s['โค้ก'], 'short PLU ok');
  // sub-group is a product field: saved on its own, returned with the save, used by reports and stock
  const sv = m('saveProduct', T, Object.assign({}, P()['โค้ก'], { subcategory: 'โคล่า', category: 'เครื่องดื่ม' }), []);
  ok(Array.isArray(sv.products) && sv.products.find(p => p.sku === s['โค้ก']).subcategory === 'โคล่า', 'save returns the fresh catalog');
  eq(P()['โค้ก'].subcategory, 'โคล่า', 'subcategory saved');
  ['สไปรท์', 'M-150', 'คาราบาว'].forEach(n => m('saveProduct', T, Object.assign({}, P()[n], { category: 'เครื่องดื่ม' }), []));
  eq(m('stockList', T).find(r => r.sku === s['คาราบาว']).subcategory, 'ชูกำลัง', 'stock list carries the subcategory');
  m('registerDevice', T, DEV, 'เครื่อง 1');
  m('openShift', T, 0, '', { floatSource: 'owner' });
  m('commitSale', T, { saleUid: 'K1', payMethod: 'cash', received: 100, lines: [{ sku: s['โค้ก'], qty: 2 }, { sku: s['คาราบาว'], qty: 1 }, { sku: s['M-150'], qty: 1 }] });
  const day = '2026-11-17';
  const rp = m('report', T, { from: day, to: day });
  const bev = rp.categories.find(c => c.category === 'เครื่องดื่ม');
  eq(bev.subs.map(x => [x.subcategory, x.revenue]).sort(), [['ชูกำลัง', 30], ['โคล่า', 30]], 'category broken down by subcategory');
  eq(rp.options.subcategories['เครื่องดื่ม'].sort(), ['ชูกำลัง', 'น้ำอัดลม', 'โคล่า'].sort(), 'filter options list subcategories');
  eq(m('report', T, { from: day, to: day, category: 'เครื่องดื่ม', subcategory: 'ชูกำลัง' }).summary.net, 30, 'subcategory filter');
  const tr = m('report', T, { from: day, to: day, category: 'เครื่องดื่ม' }).trend;
  eq(tr.cats.map(c => c.category).sort(), ['ชูกำลัง', 'โคล่า'], 'chart splits a chosen category by subcategory');
}

console.log('server tests passed:', pass);
