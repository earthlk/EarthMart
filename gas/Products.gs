/**
 * Products, barcodes (one SKU can have several: piece / pack / case), CSV import,
 * internal EAN-13 barcodes for items without a barcode.
 */

var PRODUCT_TYPES = ['barcode', 'nobarcode', 'recipe'];

/** Blank forSale (rows written before the column existed) means "sold at the counter". */
function forSale_(p) { return p.forSale === '' || p.forSale === undefined || p.forSale === null ? true : bool_(p.forSale); }

/** { recipeSku: [{ sku, qty }] } */
function recipesMap_() {
  var map = {};
  readAll_('Recipes').forEach(function (r) {
    var k = String(r.sku);
    (map[k] = map[k] || []).push({ sku: String(r.componentSku), qty: num_(r.qty) });
  });
  return map;
}

/** Cost of one recipe unit from the current component costs. */
function recipeCost_(comps, bySku) {
  return round2_((comps || []).reduce(function (a, c) { var p = bySku[c.sku]; return a + (p ? num_(p.cost) * c.qty : 0); }, 0));
}

/** Everything the client needs after login. */
function api_bootstrap(token) {
  return respond_(function () {
    var s = session_(token);
    return {
      user: { userId: s.userId, name: s.name, role: s.role },
      isCounter: isCounter_(s.deviceId),
      settings: publicSettings_(),
      products: productsForClient_(),
      recipes: readAll_('Recipes').map(function (r) { return { sku: String(r.sku), componentSku: String(r.componentSku), qty: num_(r.qty) }; }),
      barcodes: readAll_('Barcodes').map(function (b) {
        return { barcode: String(b.barcode), sku: String(b.sku), unitName: b.unitName,
                 multiplier: num_(b.multiplier) || 1, price: b.price === '' ? null : num_(b.price) };
      }),
      shift: openShiftForDevice_(s.deviceId),
      markdowns: activeMarkdowns_(),
      promos: promosForClient_(),
      expiryTodo: expiryTodoCount_()
    };
  });
}

/** All products incl. inactive (the products page can switch them back on); the sale screen filters by active. */
function productsForClient_() {
  var rows = readAll_('Products'), bySku = {}, rec = recipesMap_();
  rows.forEach(function (p) { bySku[String(p.sku)] = p; });
  return rows.map(function (p) {
    var o = productOut_(p);
    if (o.type === 'recipe') o.cost = recipeCost_(rec[o.sku], bySku);
    return o;
  });
}

function productOut_(p) {
  return {
    sku: String(p.sku), name: p.name, category: p.category, type: p.type || 'barcode', unit: p.unit || 'ชิ้น',
    cost: num_(p.cost), price: num_(p.price), minStock: num_(p.minStock), openPrice: bool_(p.openPrice),
    quickKey: bool_(p.quickKey), quickKeyGroup: p.quickKeyGroup || '', quickKeyOrder: num_(p.quickKeyOrder),
    icon: p.icon || '', color: p.color || '', plu: p.plu === '' ? '' : String(p.plu),
    active: bool_(p.active), onHand: num_(p.onHand), forSale: forSale_(p), trackExpiry: bool_(p.trackExpiry)
  };
}

function api_listProducts(token) {
  return respond_(function () {
    session_(token);
    return readAll_('Products').map(productOut_);
  });
}

/* ------------------------------------------------------------------ */
/* Save one product with its barcodes                                  */
/* ------------------------------------------------------------------ */

/**
 * product: { sku?, name, category, type, unit, cost, price, minStock, openPrice, quickKey,
 *            quickKeyGroup, quickKeyOrder, icon, color, plu, active }
 * barcodes: [{ barcode, unitName, multiplier, price? }]
 */
function api_saveProduct(token, product, barcodes, components) {
  return respond_(function () {
    var s = owner_(token);
    return withLock_(function () { return saveProduct_(s, product, barcodes || [], components || []); });
  });
}

function saveProduct_(sess, input, barcodes, components) {
  components = components || [];
  var name = String(input.name || '').trim();
  if (!name) throw new Error('ต้องใส่ชื่อสินค้า');
  var price = num_(input.price);
  if (price < 0) throw new Error('ราคาขายติดลบไม่ได้');
  var type = PRODUCT_TYPES.indexOf(input.type) >= 0 ? input.type : 'barcode';

  var all = readAll_('Products');
  var sku = String(input.sku || '').trim();
  var existing = sku ? all.filter(function (p) { return String(p.sku) === sku; })[0] : null;
  if (!sku) sku = nextSku_(all);

  var plu = String(input.plu || '').trim();
  if (plu) {
    var dupPlu = all.filter(function (p) { return String(p.plu) === plu && String(p.sku) !== sku && bool_(p.active); })[0];
    if (dupPlu) throw new Error('PLU ' + plu + ' ซ้ำกับ ' + dupPlu.name);
  }

  // Recipe ("สูตรผสม"): no own stock or barcodes; selling it takes stock from its components.
  var bySku = {};
  all.forEach(function (p) { bySku[String(p.sku)] = p; });
  var comps = [];
  var rec = recipesMap_();
  if (type === 'recipe') {
    var seenC = {};
    components.forEach(function (c) {
      var csku = String(c.sku || '').trim(), q = round2_(num_(c.qty));
      if (!csku) return;
      var cp = bySku[csku];
      if (!cp) throw new Error('ไม่พบส่วนประกอบ ' + csku);
      if (csku === sku) throw new Error('ใส่สินค้าเป็นส่วนประกอบของตัวเองไม่ได้');
      if (cp.type === 'recipe') throw new Error(cp.name + ' เป็นสูตรผสม — ใส่สูตรซ้อนสูตรไม่ได้');
      if (!(q > 0)) throw new Error('จำนวนของ ' + cp.name + ' ต้องมากกว่า 0');
      if (seenC[csku]) throw new Error(cp.name + ' ซ้ำในสูตร');
      seenC[csku] = true;
      comps.push({ sku: csku, qty: q });
    });
    if (!comps.length) throw new Error('สูตรผสมต้องมีส่วนประกอบอย่างน้อย 1 รายการ');
    var usedIn = Object.keys(rec).filter(function (r) { return r !== sku && rec[r].some(function (c) { return c.sku === sku; }); })[0];
    if (usedIn) throw new Error('สินค้านี้เป็นส่วนประกอบของ ' + (bySku[usedIn] ? bySku[usedIn].name : usedIn) + ' — เปลี่ยนเป็นสูตรผสมไม่ได้');
    barcodes = [];
  }

  // Validate barcodes before writing anything.
  var clean = [];
  var seen = {};
  barcodes.forEach(function (b) {
    var code = String(b.barcode || '').trim();
    if (!code) return;
    if (!/^\d{6,14}$/.test(code)) throw new Error('บาร์โค้ด ' + code + ' ต้องเป็นตัวเลข 6–14 หลัก');
    if (seen[code]) throw new Error('บาร์โค้ด ' + code + ' ซ้ำในสินค้านี้');
    seen[code] = true;
    var mult = Math.round(num_(b.multiplier) || 1);
    if (mult < 1) throw new Error('จำนวนชิ้นต่อหน่วยต้องอย่างน้อย 1');
    clean.push({ barcode: code, sku: sku, unitName: String(b.unitName || (mult === 1 ? 'ชิ้น' : 'แพ็ค')),
                 multiplier: mult, price: b.price === '' || b.price === null || b.price === undefined ? '' : num_(b.price) });
  });
  var otherCodes = readAll_('Barcodes').filter(function (b) { return String(b.sku) !== sku; });
  clean.forEach(function (b) {
    var clash = otherCodes.filter(function (o) { return String(o.barcode) === b.barcode; })[0];
    if (clash) throw new Error('บาร์โค้ด ' + b.barcode + ' ใช้กับสินค้า ' + clash.sku + ' แล้ว');
  });

  var row = {
    sku: sku, name: name, category: String(input.category || '').trim(), type: type,
    // Cost comes from received lots (FIFO); a new product may start with a cost (e.g. from import) as a fallback.
    unit: String(input.unit || 'ชิ้น'), cost: type === 'recipe' ? recipeCost_(comps, bySku) : existing ? num_(existing.cost) : num_(input.cost), price: price,
    minStock: type === 'recipe' ? 0 : num_(input.minStock), forSale: type === 'recipe' ? true : input.forSale !== false,
    trackExpiry: type === 'recipe' ? false : !!input.trackExpiry,
    openPrice: !!input.openPrice, quickKey: !!input.quickKey, quickKeyGroup: String(input.quickKeyGroup || ''),
    quickKeyOrder: num_(input.quickKeyOrder), icon: String(input.icon || ''), color: String(input.color || ''),
    plu: plu, active: input.active === undefined ? true : !!input.active,
    onHand: existing ? num_(existing.onHand) : 0, updatedAt: now_()
  };

  if (existing) {
    row._row = existing._row;
    if (num_(existing.price) !== price) {
      log_(sess, 'PRICE_CHANGE', sku, name + ': ' + existing.price + ' → ' + price, '');
    }
    writeRow_('Products', row);
  } else {
    append_('Products', row);
    log_(sess, 'PRODUCT_ADD', sku, name, '');
  }
  replaceBarcodes_(sku, clean);
  if (type === 'recipe' || rec[sku]) replaceRecipe_(sku, comps);
  return { sku: sku };
}

function replaceRecipe_(sku, comps) {
  var keep = readAll_('Recipes').filter(function (r) { return String(r.sku) !== sku; });
  var sh = sheet_('Recipes');
  var width = SCHEMA.Recipes.length;
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, width).clearContent();
  var all = keep.concat(comps.map(function (c) { return { sku: sku, componentSku: c.sku, qty: c.qty }; }))
    .map(function (r) { return toRow_('Recipes', r); });
  if (all.length) sh.getRange(2, 1, all.length, width).setValues(all);
}

function nextSku_(all) {
  var max = 0;
  all.forEach(function (p) {
    var m = /^P(\d+)$/.exec(String(p.sku));
    if (m) max = Math.max(max, Number(m[1]));
  });
  return 'P' + ('0000' + (max + 1)).slice(-5);
}

/** Rewrite the Barcodes sheet without this SKU's rows, then add the new ones. */
function replaceBarcodes_(sku, rows) {
  var keep = readAll_('Barcodes').filter(function (b) { return String(b.sku) !== sku; });
  var sh = sheet_('Barcodes');
  var width = SCHEMA.Barcodes.length;
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, width).clearContent();
  var all = keep.concat(rows).map(function (b) { return toRow_('Barcodes', b); });
  if (all.length) sh.getRange(2, 1, all.length, width).setValues(all);
}

/* ------------------------------------------------------------------ */
/* Internal barcode for items without one (EAN-13, prefix 20)          */
/* ------------------------------------------------------------------ */

function eanCheckDigit_(twelve) {
  var sum = 0;
  for (var i = 0; i < 12; i++) sum += Number(twelve.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

function api_newInternalBarcode(token) {
  return respond_(function () {
    owner_(token);
    return withLock_(function () {
      var props = PropertiesService.getScriptProperties();
      var used = {};
      readAll_('Barcodes').forEach(function (b) { used[String(b.barcode)] = true; });
      var seq = num_(props.getProperty('INTERNAL_SEQ'));
      var code;
      do {
        seq++;
        var twelve = '20' + ('0000000000' + seq).slice(-10);
        code = twelve + eanCheckDigit_(twelve);
      } while (used[code]);
      props.setProperty('INTERNAL_SEQ', String(seq));
      return code;
    });
  });
}

/* ------------------------------------------------------------------ */
/* CSV import                                                          */
/* ------------------------------------------------------------------ */

/**
 * Columns (header row required, any order):
 *   sku, name, category, type, unit, cost, price, minStock, openingStock,
 *   barcode, barcodeUnit, multiplier, barcodePrice, quickKey, quickKeyGroup, openPrice, plu
 * Several rows with the same sku add several barcodes (piece / pack / case).
 */
function api_importProducts(token, csvText) {
  return respond_(function () {
    var s = owner_(token);
    var rows = parseCsv_(String(csvText || ''));
    if (rows.length < 2) throw new Error('ไม่พบข้อมูล — ต้องมีหัวตารางและอย่างน้อย 1 แถว');
    var head = rows[0].map(function (h) { return String(h).trim(); });
    if (head.indexOf('name') < 0) throw new Error('หัวตารางต้องมีคอลัมน์ name');
    var idx = function (h) { return head.indexOf(h); };
    var get = function (r, h) { var i = idx(h); return i < 0 ? '' : String(r[i] === undefined ? '' : r[i]).trim(); };

    // Group rows by sku (or by name when sku is empty).
    var groups = {};
    var order = [];
    var errors = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (r.join('').trim() === '') continue;
      var key = get(r, 'sku') || ('name:' + get(r, 'name'));
      if (!groups[key]) { groups[key] = { first: r, line: i + 1, barcodes: [] }; order.push(key); }
      var code = get(r, 'barcode');
      if (code) groups[key].barcodes.push({
        barcode: code, unitName: get(r, 'barcodeUnit') || '', multiplier: get(r, 'multiplier') || 1,
        price: get(r, 'barcodePrice')
      });
    }

    var created = 0, updated = 0, opening = [];
    withLock_(function () {
      order.forEach(function (key) {
        var g = groups[key];
        var r = g.first;
        try {
          var sku = get(r, 'sku');
          var before = sku ? readAll_('Products').some(function (p) { return String(p.sku) === sku; }) : false;
          var existingCodes = sku ? readAll_('Barcodes').filter(function (b) { return String(b.sku) === sku; })
            .map(function (b) { return { barcode: String(b.barcode), unitName: b.unitName, multiplier: b.multiplier, price: b.price }; }) : [];
          var merged = existingCodes.filter(function (b) {
            return !g.barcodes.some(function (n) { return n.barcode === b.barcode; });
          }).concat(g.barcodes);
          var res = saveProduct_(s, {
            sku: sku, name: get(r, 'name'), category: get(r, 'category'), type: get(r, 'type') || 'barcode',
            unit: get(r, 'unit') || 'ชิ้น', cost: get(r, 'cost'), price: get(r, 'price'), minStock: get(r, 'minStock'),
            quickKey: bool_(get(r, 'quickKey').toLowerCase() === 'y' ? true : get(r, 'quickKey').toUpperCase()),
            quickKeyGroup: get(r, 'quickKeyGroup'),
            openPrice: bool_(get(r, 'openPrice').toLowerCase() === 'y' ? true : get(r, 'openPrice').toUpperCase()),
            plu: get(r, 'plu')
          }, merged);
          if (before) updated++; else created++;
          var open = get(r, 'openingStock');
          if (open !== '' && !before && num_(open) > 0) opening.push({ sku: res.sku, qty: num_(open), cost: num_(get(r, 'cost')) });
        } catch (e) {
          errors.push('แถว ' + g.line + ': ' + e.message);
        }
      });
      if (opening.length) {
        var ctx = fifoOpen_();
        opening.forEach(function (o) { fifoAddLot_(ctx, { sku: o.sku, receiptNo: 'IMPORT', qtyIn: o.qty, unitCost: o.cost, note: 'สต็อกเปิดจากนำเข้า' }); });
        fifoFlush_(ctx);
        addStockMoves_(s, opening.map(function (o) {
          return { sku: o.sku, qtyPieces: o.qty, type: 'OPEN', refNo: 'IMPORT', note: 'สต็อกเปิดจากนำเข้า' };
        }));
      }
    });
    log_(s, 'PRODUCT_IMPORT', '', 'เพิ่ม ' + created + ' · แก้ ' + updated + ' · ผิดพลาด ' + errors.length, '');
    return { created: created, updated: updated, errors: errors };
  });
}

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, CRLF). */
function parseCsv_(text) {
  var rows = [], row = [], field = '', q = false;
  text = text.replace(/^﻿/, '');
  for (var i = 0; i < text.length; i++) {
    var c = text.charAt(i);
    if (q) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text.charAt(i + 1) === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * Owner: change many prices at once. changes = [{ sku, price }] (piece price) and/or [{ barcode, price }] (pack price).
 * Each change is logged as PRICE_CHANGE. Unchanged prices are skipped. → { changed }
 */
function api_bulkPrice(token, changes) {
  return respond_(function () {
    var s = owner_(token);
    if (!changes || !changes.length) throw new Error('ยังไม่มีราคาที่แก้');
    if (changes.length > 500) throw new Error('แก้ได้ครั้งละไม่เกิน 500 รายการ');
    return withLock_(function () {
      var products = {}, codes = {};
      readAll_('Products').forEach(function (p) { products[String(p.sku)] = p; });
      readAll_('Barcodes').forEach(function (b) { codes[String(b.barcode)] = b; });
      var changed = 0, touched = {};
      changes.forEach(function (c) {
        var price = round2_(num_(c.price));
        if (!(price >= 0) || String(c.price) === '' || c.price === null) throw new Error('ราคาไม่ถูกต้อง');
        if (c.barcode) {
          var b = codes[String(c.barcode)];
          if (!b) throw new Error('ไม่พบบาร์โค้ด ' + c.barcode);
          if (round2_(num_(b.price)) === price) return;
          var pp = products[String(b.sku)] || {};
          log_(s, 'PRICE_CHANGE', b.sku, (pp.name || b.sku) + ' (' + b.unitName + '): ' + num_(b.price) + ' → ' + price, '');
          b.price = price;
          writeRow_('Barcodes', b);
          touched[String(b.sku)] = true;
          changed++;
        } else {
          var p = products[String(c.sku)];
          if (!p) throw new Error('ไม่พบสินค้า ' + c.sku);
          if (round2_(num_(p.price)) === price) return;
          log_(s, 'PRICE_CHANGE', p.sku, p.name + ': ' + num_(p.price) + ' → ' + price, '');
          p.price = price;
          touched[String(p.sku)] = true;
          changed++;
        }
      });
      Object.keys(touched).forEach(function (k) { var p = products[k]; p.updatedAt = now_(); writeRow_('Products', p); });
      return { changed: changed };
    });
  });
}
