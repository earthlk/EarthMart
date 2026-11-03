// End-to-end test of the Apps Script API through doPost, against an in-memory Sheets mock.
'use strict';
const assert = require('assert');
const { makeContext } = require('./gasmock');

const g = makeContext({ now: '2026-11-03T03:00:00Z' }); // 10:00 Bangkok
let pass = 0;
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
must('logout', T);
mustFail(/เข้าสู่ระบบ/, 'bootstrap', T);

// session expiry after 6h
const { token: T2 } = must('login', ownerId, '1234', DEV);
g.__advance(6 * 3600 * 1000 + 1000);
mustFail(/เข้าสู่ระบบ/, 'bootstrap', T2);

// PIN lockout after 5 tries
for (let i = 0; i < 5; i++) call('login', ownerId, '0000', DEV);
mustFail(/ลอง|รอ/, 'login', ownerId, '1234', DEV);

console.log('server tests passed:', pass);
