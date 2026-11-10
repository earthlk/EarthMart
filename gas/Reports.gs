/**
 * Daily report (owner only): sales, payment split, hourly, gross profit, top items, exceptions.
 */

var EXCEPTION_ACTIONS = ['VOID', 'DISCOUNT', 'OPEN_PRICE', 'CASH_IN', 'CASH_OUT', 'STOCK_ADJUST',
                         'PRICE_CHANGE', 'APPROVE_FAIL', 'NO_SALE', 'WRITEOFF', 'STOCK_COUNT', 'MARKDOWN', 'EXPIRY_CLOSE', 'STORE_USE', 'RETURN',
                         'OVERSELL', 'OFFLINE_CHECK'];

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
      var pp = payParts_(b);
      byPay.cash += pp.cash; byPay.qr += pp.qr; byPay.transfer += pp.transfer;
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
    // Returns on this day lower the day's sales (by refund method) and give back the cost of restocked goods.
    var grossSales = total, refundTotal = 0, retNos = {};
    var rets = readAll_('Returns').filter(function (r) { return sameDay(r.createdAt); });
    rets.forEach(function (r) {
      refundTotal += num_(r.total);
      byPay[r.refundMethod === 'cash' ? 'cash' : 'transfer'] -= num_(r.total);
      retNos[r.returnNo] = true;
    });
    readAll_('ReturnLines').forEach(function (l) { if (retNos[l.returnNo] && bool_(l.restocked)) cost -= num_(l.cost); });
    total -= refundTotal;
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
      total: round2_(total), grossSales: round2_(grossSales), refundTotal: round2_(refundTotal), returnCount: rets.length,
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

/* ------------------------------------------------------------------ */
/* Report with filters (owner): range + category / product / staff /   */
/* shift / payment / device / bill type                                 */
/* ------------------------------------------------------------------ */

/**
 * f = { from, to ('yyyy-MM-dd', inclusive), category, sku, userId, shiftId, pay ('cash'|'qr'|'transfer'),
 *       deviceId, billType ('discount'|'return'), slowDays }
 * Money per line is net of its share of the bill discount; refunds are counted on the day of the return
 * (restocked goods give their cost back). Profit = net sales − cost of goods.
 */
function api_report(token, f) {
  return respond_(function () {
    owner_(token);
    f = f || {};
    var today = fmtDate_(now_(), 'yyyy-MM-dd');
    var from = /^\d{4}-\d{2}-\d{2}$/.test(f.from || '') ? f.from : today;
    var to = /^\d{4}-\d{2}-\d{2}$/.test(f.to || '') ? f.to : from;
    if (to < from) { var t = from; from = to; to = t; }
    var inRange = function (v) { if (!(v instanceof Date)) return false; var d = fmtDate_(v, 'yyyy-MM-dd'); return d >= from && d <= to; };
    var oneDay = from === to;

    var products = {};
    readAll_('Products').forEach(function (p) { products[String(p.sku)] = p; });
    var users = {}, devices = {};
    readAll_('Users').forEach(function (u) { users[u.userId] = u.name; });
    readAll_('Devices').forEach(function (d) { devices[d.deviceId] = d.name; });
    var rec = recipesMap_();

    // ---- bills in range that pass the bill-level filters
    var allBills = readAll_('Sales').filter(function (b) { return inRange(b.createdAt); });
    var billOk = function (b) {
      if (f.userId && b.userId !== f.userId) return false;
      if (f.shiftId && b.shiftId !== f.shiftId) return false;
      if (f.deviceId && b.deviceId !== f.deviceId) return false;
      if (f.pay && !(payParts_(b)[f.pay] > 0)) return false;
      if (f.billType === 'discount' && !(num_(b.discount) > 0)) return false;
      if (f.billType === 'return' && !(num_(b.returnedTotal) > 0)) return false;
      return true;
    };
    var bills = allBills.filter(billOk);
    var paid = bills.filter(function (b) { return b.status !== 'VOID'; });
    var voids = bills.filter(function (b) { return b.status === 'VOID'; });
    var billBy = {};
    paid.forEach(function (b) { billBy[b.billNo] = b; });

    // ---- lines of those bills, with the bill-discount share spread over them
    var linesBy = {};
    readAll_('SaleLines').forEach(function (l) { if (billBy[l.billNo]) (linesBy[l.billNo] = linesBy[l.billNo] || []).push(l); });
    var lineOk = function (l) {
      var p = products[String(l.sku)] || {};
      if (f.sku && String(l.sku) !== String(f.sku)) return false;
      if (f.category && (p.category || '') !== f.category) return false;
      return true;
    };
    var byProduct = {}, hourly = [], daily = {}, byPay = { cash: 0, qr: 0, transfer: 0 };
    for (var h = 0; h < 24; h++) hourly.push(0);
    var S = { gross: 0, cost: 0, discount: 0, bills: 0, pieces: 0 };
    var prod = function (sku, name) {
      var p = products[sku] || {};
      return byProduct[sku] || (byProduct[sku] = { sku: sku, name: p.name || name, category: p.category || '', unit: p.unit || '',
        recipe: !!(rec[sku] && rec[sku].length), qty: 0, revenue: 0, cost: 0, refunds: 0, returnedQty: 0, bills: 0 });
    };
    var staff = {};
    var st = function (uid) { return staff[uid] || (staff[uid] = { userId: uid, name: users[uid] || uid, bills: 0, net: 0, discount: 0, voids: 0, voidTotal: 0, returns: 0, refunds: 0 }); };
    paid.forEach(function (b) {
      var ls = linesBy[b.billNo] || [];
      var sumLT = ls.reduce(function (a, l) { return a + num_(l.lineTotal); }, 0);
      var billDisc = num_(b.discount) - ls.reduce(function (a, l) { return a + num_(l.lineDiscount); }, 0);
      var got = 0, any = false;
      ls.forEach(function (l) {
        if (!lineOk(l)) return;
        any = true;
        var lt = num_(l.lineTotal);
        var net = sumLT ? lt - billDisc * lt / sumLT : 0;
        var x = prod(String(l.sku), l.name);
        var pcs = num_(l.qty) * (num_(l.multiplier) || 1);
        x.qty += pcs; x.revenue += net; x.cost += num_(l.cost); x.bills++;
        S.cost += num_(l.cost); S.pieces += pcs;
        got += net;
      });
      if (!any) return;
      S.gross += got; S.bills++;
      S.discount += f.sku || f.category ? 0 : num_(b.discount);
      var share = num_(b.total) ? got / num_(b.total) : 0;
      var pp = payParts_(b);
      byPay.cash += pp.cash * share; byPay.qr += pp.qr * share; byPay.transfer += pp.transfer * share;
      hourly[Number(fmtDate_(b.createdAt, 'H'))] += got;
      var dk = fmtDate_(b.createdAt, 'yyyy-MM-dd');
      daily[dk] = (daily[dk] || 0) + got;
      var s1 = st(b.userId); s1.bills++; s1.net += got; s1.discount += num_(b.discount);
    });
    voids.forEach(function (b) { var s1 = st(b.userId); s1.voids++; s1.voidTotal += num_(b.total); });

    // ---- returns made in the range (on bills that pass the filters)
    var retBills = {};
    readAll_('Sales').forEach(function (b) { if (num_(b.returnedTotal) > 0) retBills[b.billNo] = b; });
    var rets = readAll_('Returns').filter(function (r) { return inRange(r.createdAt) && retBills[r.billNo] && billOk(retBills[r.billNo]); });
    var retNo = {};
    rets.forEach(function (r) { retNo[r.returnNo] = r; });
    var refunds = 0, retCount = 0;
    readAll_('ReturnLines').forEach(function (l) {
      var r = retNo[l.returnNo];
      if (!r || !lineOk(l)) return;
      var x = prod(String(l.sku), l.name);
      var back = bool_(l.restocked) ? num_(l.cost) : 0;
      x.refunds += num_(l.refund); x.returnedQty += num_(l.qty) * (num_(l.multiplier) || 1); x.cost -= back;
      refunds += num_(l.refund); S.cost -= back;
      byPay[r.refundMethod === 'cash' ? 'cash' : 'transfer'] -= num_(l.refund);
      var dk = fmtDate_(r.createdAt, 'yyyy-MM-dd');
      daily[dk] = (daily[dk] || 0) - num_(l.refund);
      var s1 = st(r.userId); s1.refunds += num_(l.refund);
    });
    rets.forEach(function (r) { retCount++; st(r.userId).returns++; });

    var net = S.gross - refunds;
    var plist = Object.keys(byProduct).map(function (k) {
      var x = byProduct[k];
      x.revenue = round2_(x.revenue - x.refunds); x.cost = round2_(x.cost); x.refunds = round2_(x.refunds);
      x.profit = round2_(x.revenue - x.cost); x.margin = x.revenue ? Math.round(x.profit / x.revenue * 1000) / 10 : 0;
      x.qty = round2_(x.qty - x.returnedQty);
      return x;
    }).sort(function (a, b) { return b.revenue - a.revenue; });
    var cats = {};
    plist.forEach(function (x) {
      var c = cats[x.category] || (cats[x.category] = { category: x.category || 'ไม่มีหมวด', items: 0, qty: 0, revenue: 0, cost: 0 });
      c.items++; c.qty += x.qty; c.revenue += x.revenue; c.cost += x.cost;
    });
    var clist = Object.keys(cats).map(function (k) {
      var c = cats[k]; c.revenue = round2_(c.revenue); c.cost = round2_(c.cost); c.profit = round2_(c.revenue - c.cost);
      c.margin = c.revenue ? Math.round(c.profit / c.revenue * 1000) / 10 : 0; c.share = net ? Math.round(c.revenue / net * 1000) / 10 : 0;
      return c;
    }).sort(function (a, b) { return b.revenue - a.revenue; });

    // ---- shifts that were open during the range
    var shifts = readAll_('Shifts').filter(function (s) {
      var o = s.openedAt instanceof Date ? fmtDate_(s.openedAt, 'yyyy-MM-dd') : '';
      var c = s.closedAt instanceof Date ? fmtDate_(s.closedAt, 'yyyy-MM-dd') : today;
      return o && o <= to && c >= from && (!f.userId || s.userId === f.userId) && (!f.deviceId || s.deviceId === f.deviceId);
    }).reverse().map(function (s) {
      var sb = allBills.filter(function (b) { return b.shiftId === s.shiftId && b.status !== 'VOID'; });
      return { shiftId: s.shiftId, device: devices[s.deviceId] || s.deviceId, user: users[s.userId] || '', closedBy: users[s.closedBy] || '',
        openedAt: s.openedAt, closedAt: s.closedAt || '', status: s.status, bills: sb.length,
        sales: round2_(sb.reduce(function (a, b) { return a + num_(b.total); }, 0)),
        openingCash: num_(s.openingCash), expectedCash: s.expectedCash === '' ? null : num_(s.expectedCash),
        countedCash: s.countedCash === '' ? null : num_(s.countedCash), diff: s.diff === '' ? null : num_(s.diff),
        voidCount: num_(s.voidCount), note: s.note || '' };
    });

    // ---- stock: value by category, slow movers
    var vals = lotValues_();
    var lastSold = {};
    var saleDate = {};
    readAll_('Sales').forEach(function (b) { if (b.status !== 'VOID' && b.createdAt instanceof Date) saleDate[b.billNo] = b.createdAt; });
    readAll_('SaleLines').forEach(function (l) {
      var d = saleDate[l.billNo];
      if (!d) return;
      var comps = rec[String(l.sku)];
      (comps && comps.length ? comps.map(function (c) { return c.sku; }) : [String(l.sku)]).forEach(function (k) {
        if (!lastSold[k] || d > lastSold[k]) lastSold[k] = d;
      });
    });
    var slowDays = num_(f.slowDays) || 30;
    var cutoff = new Date(now_().getTime() - slowDays * 86400000);
    var stockCats = {}, slow = [];
    Object.keys(products).forEach(function (k) {
      var p = products[k];
      if (!bool_(p.active) || p.type === 'recipe') return;
      if (f.category && (p.category || '') !== f.category) return;
      var on = num_(p.onHand), v = round2_(vals[k] || 0);
      var c = stockCats[p.category || ''] || (stockCats[p.category || ''] = { category: p.category || 'ไม่มีหมวด', items: 0, pieces: 0, value: 0 });
      if (on > 0) { c.items++; c.pieces += on; c.value += v; }
      if (on > 0 && (!lastSold[k] || lastSold[k] < cutoff)) {
        slow.push({ sku: k, name: p.name, category: p.category || '', unit: p.unit || '', onHand: on, value: v,
          lastSold: lastSold[k] || '', days: lastSold[k] ? Math.floor((now_() - lastSold[k]) / 86400000) : null, forSale: forSale_(p) });
      }
    });
    var scList = Object.keys(stockCats).map(function (k) { var c = stockCats[k]; c.value = round2_(c.value); return c; })
      .filter(function (c) { return c.items; }).sort(function (a, b) { return b.value - a.value; });
    var stockTotal = round2_(scList.reduce(function (a, c) { return a + c.value; }, 0));
    scList.forEach(function (c) { c.share = stockTotal ? Math.round(c.value / stockTotal * 1000) / 10 : 0; });
    slow.sort(function (a, b) { return b.value - a.value; });

    var exceptions = readAll_('AuditLog').filter(function (a) {
      return inRange(a.createdAt) && EXCEPTION_ACTIONS.indexOf(a.action) >= 0 && (!f.userId || a.userId === f.userId) && (!f.deviceId || a.deviceId === f.deviceId);
    }).reverse().slice(0, 200).map(function (a) {
      return { createdAt: a.createdAt, action: a.action, ref: a.ref, detail: a.detail, user: users[a.userId] || '', approvedBy: a.approvedBy };
    });

    var days = [];
    if (!oneDay) {
      for (var d = new Date(from + 'T00:00:00Z'); fmtYmdUtc_(d) <= to && days.length < 400; d = new Date(d.getTime() + 86400000)) {
        var k2 = fmtYmdUtc_(d); days.push({ day: k2, net: round2_(daily[k2] || 0) });
      }
    }
    // ---- charts: trend per day / per month over the range; hours of the day summed over the whole range
    var month = f.gran === 'month';
    var keyOfB = function (dt) { return month ? fmtDate_(dt, 'yyyy-MM') : fmtDate_(dt, 'yyyy-MM-dd'); };
    var bucketKeys = [];
    if (month) {
      for (var mk = from.slice(0, 7); mk <= to.slice(0, 7) && bucketKeys.length < 60;) {
        bucketKeys.push(mk);
        mk = fmtYmdUtc_(new Date(Date.UTC(Number(mk.slice(0, 4)), Number(mk.slice(5, 7)), 1))).slice(0, 7);
      }
    } else {
      for (var dd = new Date(from + 'T00:00:00Z'); fmtYmdUtc_(dd) <= to && bucketKeys.length < 400; dd = new Date(dd.getTime() + 86400000)) bucketKeys.push(fmtYmdUtc_(dd));
    }
    var trend = chartSeries_(from, to, keyOfB, bucketKeys, billOk, lineOk, products);
    trend.kind = month ? 'month' : 'day';
    var hours = chartSeries_(from, to, function (dt) { return fmtDate_(dt, 'H'); }, hourly.map(function (_, i) { return String(i); }), billOk, lineOk, products);
    hours.kind = 'hour'; hours.days = bucketKeys.length;

    // ---- history table: one row per day / month with profit and the cost of goods lost
    var lost = outflowBy_(from, to, keyOfB);
    var hist = {};
    bucketKeys.forEach(function (k) { hist[k] = { key: k, bills: 0, net: 0, cost: 0, loss: 0, expiry: 0, use: 0 }; });
    paid.forEach(function (b) {
      var k = keyOfB(b.createdAt), hrow = hist[k];
      if (!hrow) return;
      var ls = linesBy[b.billNo] || [];
      var sumLT = ls.reduce(function (a, l) { return a + num_(l.lineTotal); }, 0);
      var billDisc = num_(b.discount) - ls.reduce(function (a, l) { return a + num_(l.lineDiscount); }, 0);
      var any = false;
      ls.forEach(function (l) {
        if (!lineOk(l)) return;
        any = true;
        var lt = num_(l.lineTotal);
        hrow.net += sumLT ? lt - billDisc * lt / sumLT : 0;
        hrow.cost += num_(l.cost);
      });
      if (any) hrow.bills++;
    });
    readAll_('ReturnLines').forEach(function (l) {
      var r = retNo[l.returnNo];
      if (!r || !lineOk(l)) return;
      var hrow = hist[keyOfB(r.createdAt)];
      if (!hrow) return;
      hrow.net -= num_(l.refund);
      if (bool_(l.restocked)) hrow.cost -= num_(l.cost);
    });
    var lineFilter = !!(f.sku || f.category);
    Object.keys(lost.rows).forEach(function (k) {
      if (!hist[k]) return;
      var o = lost.rows[k];
      hist[k].loss += lineFilter ? o.bySku(f.sku, f.category, products).loss : o.loss;
      hist[k].expiry += lineFilter ? o.bySku(f.sku, f.category, products).expiry : o.expiry;
      hist[k].use += lineFilter ? o.bySku(f.sku, f.category, products).use : o.use;
    });
    var history = bucketKeys.slice().reverse().map(function (k) {
      var h = hist[k];
      ['net', 'cost', 'loss', 'expiry', 'use'].forEach(function (q) { h[q] = round2_(h[q]); });
      h.profit = round2_(h.net - h.cost);
      h.margin = h.net ? Math.round(h.profit / h.net * 1000) / 10 : 0;
      h.after = round2_(h.profit - h.loss - h.expiry - h.use);
      return h;
    });
    var lossT = history.reduce(function (a, h) { a.loss += h.loss; a.expiry += h.expiry; a.use += h.use; return a; }, { loss: 0, expiry: 0, use: 0 });

    // ---- price alerts for the exception list: selling below cost / thin margin
    var alerts = [];
    Object.keys(products).forEach(function (k) {
      var p = products[k];
      if (!bool_(p.active) || !forSale_(p)) return;
      var c = p.type === 'recipe' ? recipeCost_(rec[k], products) : num_(p.cost);
      if (c > 0 && num_(p.price) > 0 && num_(p.price) < c) alerts.push({ action: 'BELOW_COST', ref: k, detail: p.name + ' ราคา ' + num_(p.price) + ' ต่ำกว่าทุน ' + round2_(c) + ' บาท', user: '', approvedBy: '', createdAt: '' });
    });
    plist.forEach(function (x) {
      if (x.revenue > 0 && x.margin < 10 && !alerts.some(function (a) { return a.ref === x.sku; }))
        alerts.push({ action: 'LOW_MARGIN', ref: x.sku, detail: x.name + ' กำไร ' + x.margin + '% (ขาย ' + x.revenue + ' ทุน ' + x.cost + ')', user: '', approvedBy: '', createdAt: '' });
    });
    var cost = round2_(S.cost);
    return {
      from: from, to: to, oneDay: oneDay, gran: month ? 'month' : 'day', trend: trend, hours: hours, history: history,
      summary: { gross: round2_(S.gross), refunds: round2_(refunds), net: round2_(net), bills: S.bills, avgBill: S.bills ? round2_(S.gross / S.bills) : 0,
                 pieces: round2_(S.pieces), discount: round2_(S.discount), cost: cost, profit: round2_(net - cost),
                 margin: net ? Math.round((net - cost) / net * 1000) / 10 : 0,
                 voids: voids.length, voidTotal: round2_(voids.reduce(function (a, b) { return a + num_(b.total); }, 0)), returns: retCount,
                 loss: round2_(lossT.loss), expiry: round2_(lossT.expiry), use: round2_(lossT.use),
                 after: round2_(net - cost - lossT.loss - lossT.expiry - lossT.use) },
      byPay: { cash: round2_(byPay.cash), qr: round2_(byPay.qr), transfer: round2_(byPay.transfer) },
      hourly: hourly.map(round2_), daily: days,
      products: plist, categories: clist,
      staff: Object.keys(staff).map(function (k) { var x = staff[k]; ['net', 'discount', 'voidTotal', 'refunds'].forEach(function (q) { x[q] = round2_(x[q]); }); x.net = round2_(x.net - x.refunds); return x; })
        .sort(function (a, b) { return b.net - a.net; }),
      shifts: shifts, stock: { total: stockTotal, categories: scList }, slow: slow.slice(0, 200), slowDays: slowDays,
      exceptions: alerts.concat(exceptions),
      options: {
        categories: Object.keys(Object.keys(products).reduce(function (a, k) { if (products[k].category) a[products[k].category] = 1; return a; }, {})).sort(),
        users: Object.keys(users).map(function (k) { return { userId: k, name: users[k] }; }),
        devices: Object.keys(devices).map(function (k) { return { deviceId: k, name: devices[k] }; }),
        shifts: shifts.map(function (s) { return { shiftId: s.shiftId, label: fmtDate_(s.openedAt, 'd/M HH:mm') + ' · ' + s.user + ' · ' + s.device }; })
      }
    };
  });
}

function fmtYmdUtc_(d) { return d.toISOString().slice(0, 10); }

/**
 * Net sales per bucket and per category between from..to (days, inclusive): lines net of the bill-discount share,
 * minus refunds on the day of the return. keyOf(date) gives the bucket; keys fixes the order (empty buckets = 0).
 * → { keys, total: [..], cats: [{ category, values: [..], sum }] } (categories by size, top 7 + "อื่น ๆ").
 */
function chartSeries_(from, to, keyOf, keys, billOk, lineOk, products) {
  var inR = function (v) { if (!(v instanceof Date)) return false; var d = fmtDate_(v, 'yyyy-MM-dd'); return d >= from && d <= to; };
  var idx = {};
  keys.forEach(function (k, i) { idx[k] = i; });
  var total = keys.map(function () { return 0; });
  var cats = {};
  var add = function (dt, cat, v) {
    var i = idx[keyOf(dt)];
    if (i === undefined) return;
    total[i] += v;
    var c = cats[cat] || (cats[cat] = keys.map(function () { return 0; }));
    c[i] += v;
  };
  var bills = {};
  readAll_('Sales').forEach(function (b) { if (b.status !== 'VOID' && billOk(b)) bills[b.billNo] = b; });
  var lines = {};
  readAll_('SaleLines').forEach(function (l) { var b = bills[l.billNo]; if (b && inR(b.createdAt)) (lines[l.billNo] = lines[l.billNo] || []).push(l); });
  Object.keys(lines).forEach(function (no) {
    var b = bills[no], ls = lines[no];
    var sumLT = ls.reduce(function (a, l) { return a + num_(l.lineTotal); }, 0);
    var disc = num_(b.discount) - ls.reduce(function (a, l) { return a + num_(l.lineDiscount); }, 0);
    ls.forEach(function (l) {
      if (!lineOk(l)) return;
      var lt = num_(l.lineTotal);
      add(b.createdAt, (products[String(l.sku)] || {}).category || 'ไม่มีหมวด', sumLT ? lt - disc * lt / sumLT : 0);
    });
  });
  var rets = {};
  readAll_('Returns').forEach(function (r) { if (inR(r.createdAt) && bills[r.billNo]) rets[r.returnNo] = r; });
  readAll_('ReturnLines').forEach(function (l) {
    var r = rets[l.returnNo];
    if (r && lineOk(l)) add(r.createdAt, (products[String(l.sku)] || {}).category || 'ไม่มีหมวด', -num_(l.refund));
  });
  var list = Object.keys(cats).map(function (k) { return { category: k, values: cats[k], sum: cats[k].reduce(function (a, v) { return a + v; }, 0) }; })
    .sort(function (a, b) { return b.sum - a.sum; });
  if (list.length > 8) {
    var rest = list.slice(7), other = { category: 'อื่น ๆ', values: keys.map(function () { return 0; }), sum: 0 };
    rest.forEach(function (c) { c.values.forEach(function (v, i) { other.values[i] += v; }); other.sum += c.sum; });
    list = list.slice(0, 7).concat([other]);
  }
  list.forEach(function (c) { c.values = c.values.map(round2_); c.sum = round2_(c.sum); });
  return { keys: keys, total: total.map(round2_), cats: list };
}

/**
 * Cost of goods that left without a sale, per bucket: loss (damaged / lost), expiry, store use.
 * → { rows: { key: { loss, expiry, use, bySku(sku, category, products) } } }
 */
function outflowBy_(from, to, keyOf) {
  var kind = {};
  readAll_('StockMoves').forEach(function (m) {
    if (m.type === 'STORE_USE') kind[m.refNo] = 'use';
    else if (m.type === 'WRITEOFF') kind[m.refNo] = String(m.note).indexOf('หมดอายุ') === 0 ? 'expiry'
      : String(m.note).indexOf('ใช้ในร้าน') === 0 ? 'use' : 'loss';
  });
  var rows = {};
  readAll_('LotUse').forEach(function (u) {
    var k = kind[u.refNo];
    if (!k || !(u.createdAt instanceof Date)) return;
    var d = fmtDate_(u.createdAt, 'yyyy-MM-dd');
    if (d < from || d > to) return;
    var b = keyOf(u.createdAt);
    var r = rows[b] || (rows[b] = { loss: 0, expiry: 0, use: 0, items: [], bySku: function (sku, cat, products) {
      var o = { loss: 0, expiry: 0, use: 0 };
      this.items.forEach(function (it) {
        if (sku && it.sku !== String(sku)) return;
        if (cat && ((products[it.sku] || {}).category || '') !== cat) return;
        o[it.kind] += it.v;
      });
      return o;
    } });
    var v = num_(u.qty) * num_(u.unitCost);
    r[k] += v;
    r.items.push({ sku: String(u.sku), kind: k, v: v });
  });
  return { rows: rows };
}
