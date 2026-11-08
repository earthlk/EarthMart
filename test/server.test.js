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
  const r2 = m7('returnSale', T, { returnUid: 'R3', billNo: b2.billNo, refundMethod: 'transfer', restock: false, reason: 'ของเสีย', lines: [{ lineNo: 1, qty: 1 }, { lineNo: 2, qty: 1 }] });
  eq([r2.total, r2.fullyReturned], [27, true], 'last return closes the bill: 36 - 9');
  eq(onH('B1'), 50 - 3 - 1, 'not restocked');
  const det = m7('billDetail', T, b2.billNo);
  eq([det.returnedTotal, det.returns.length, det.lines.map(l => l.returnedQty)], [36, 2, [2, 1]], 'bill detail shows returns');
  ok(m7('listBills', T).find(b => b.billNo === b2.billNo).returnedTotal === 36, 'bill list shows returned total');

  sum = m7('shiftSummary', C);
  eq([sum.cashRefunds, sum.otherRefunds, sum.expectedCash, sum.returnCount], [9, 27, 500 + 60 + 36 - 9, 2], 'cash refund leaves the drawer');
  const rep = m7('dailyReport', T, '2026-11-05');
  eq([rep.grossSales, rep.refundTotal, rep.total, rep.byPay], [136, 36, 100, { cash: 87, qr: 40, transfer: -27 }], 'daily report net of returns');
  ok(rep.exceptions.some(x => x.action === 'RETURN'), 'return logged');
  const closed = m7('closeShift', C, 587, '');
  eq(closed.diff, 0, 'drawer balances after split + refund');
  f7(/เปิดกะ/, 'returnSale', T, { returnUid: 'R4', billNo: sp.billNo, refundMethod: 'cash', restock: true, reason: 'x', lines: [{ lineNo: 1, qty: 1 }] });
  ok(m7('returnSale', T, { returnUid: 'R5', billNo: sp.billNo, refundMethod: 'transfer', restock: true, reason: 'x', lines: [{ lineNo: 1, qty: 1 }] }).total === 10, 'return from a closed shift by transfer');
}

console.log('server tests passed:', pass);
