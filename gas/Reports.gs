/**
 * Daily report (owner only): sales, payment split, hourly, gross profit, top items, exceptions.
 */

var EXCEPTION_ACTIONS = ['VOID', 'DISCOUNT', 'OPEN_PRICE', 'CASH_IN', 'CASH_OUT', 'STOCK_ADJUST',
                         'PRICE_CHANGE', 'APPROVE_FAIL', 'NO_SALE'];

/** day: 'yyyy-MM-dd' in the shop time zone. Defaults to today. */
function api_dailyReport(token, day) {
  return respond_(function () {
    owner_(token);
    var d = day || fmtDate_(now_(), 'yyyy-MM-dd');
    var sameDay = function (v) { return v instanceof Date && fmtDate_(v, 'yyyy-MM-dd') === d; };

    var bills = readAll_('Sales').filter(function (b) { return sameDay(b.createdAt); });
    var paid = bills.filter(function (b) { return b.status !== 'VOID'; });
    var voided = bills.filter(function (b) { return b.status === 'VOID'; });
    var paidNos = {};
    paid.forEach(function (b) { paidNos[b.billNo] = true; });

    var byPay = { cash: 0, qr: 0, transfer: 0 };
    var hourly = [];
    for (var h = 0; h < 24; h++) hourly.push(0);
    var total = 0, discount = 0;
    paid.forEach(function (b) {
      var t = num_(b.total);
      total += t;
      discount += num_(b.discount);
      byPay[b.payMethod] = (byPay[b.payMethod] || 0) + t;
      hourly[Number(fmtDate_(b.createdAt, 'H'))] += t;
    });

    var cost = 0;
    var items = {};
    readAll_('SaleLines').forEach(function (l) {
      if (!paidNos[l.billNo]) return;
      cost += num_(l.cost);
      var k = String(l.sku);
      if (!items[k]) items[k] = { sku: k, name: l.name, pieces: 0, revenue: 0 };
      items[k].pieces += num_(l.qty) * (num_(l.multiplier) || 1);
      items[k].revenue += num_(l.lineTotal);
    });
    // Bill-level discounts are not spread over lines; profit uses bill totals.
    var top = Object.keys(items).map(function (k) { return items[k]; })
      .sort(function (a, b) { return b.revenue - a.revenue; }).slice(0, 10)
      .map(function (x) { x.revenue = round2_(x.revenue); return x; });

    var users = {};
    readAll_('Users').forEach(function (u) { users[u.userId] = u.name; });
    var exceptions = readAll_('AuditLog').filter(function (a) {
      return sameDay(a.createdAt) && EXCEPTION_ACTIONS.indexOf(a.action) >= 0;
    }).reverse().map(function (a) {
      return { createdAt: a.createdAt, action: a.action, ref: a.ref, detail: a.detail,
               user: users[a.userId] || '', approvedBy: a.approvedBy };
    });

    var lowStock = readAll_('Products').filter(function (p) {
      return bool_(p.active) && num_(p.minStock) > 0 && num_(p.onHand) <= num_(p.minStock);
    }).map(function (p) { return { sku: String(p.sku), name: p.name, onHand: num_(p.onHand), minStock: num_(p.minStock) }; });

    return {
      day: d,
      total: round2_(total),
      billCount: paid.length,
      avgBill: paid.length ? round2_(total / paid.length) : 0,
      discount: round2_(discount),
      grossProfit: round2_(total - cost),
      grossMargin: total ? Math.round((total - cost) / total * 1000) / 10 : 0,
      byPay: { cash: round2_(byPay.cash), qr: round2_(byPay.qr), transfer: round2_(byPay.transfer) },
      hourly: hourly.map(round2_),
      voidCount: voided.length,
      voidTotal: round2_(voided.reduce(function (a, b) { return a + num_(b.total); }, 0)),
      top: top,
      exceptions: exceptions,
      lowStock: lowStock
    };
  });
}
