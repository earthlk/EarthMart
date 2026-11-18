/**
 * Shop internet whitelist: names and owners for devices (by MAC). The router itself is driven by the
 * helper on the counter PC (tools/windows/EarthMart-NetHelper.ps1); this sheet keeps the names so every
 * screen shows the same list, and remembers devices the owner chose not to allow.
 */

var NET_TYPES = ['phone', 'pc', 'tablet', 'camera', 'other'];

function normMac_(mac) {
  var m = String(mac || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (m.length !== 12) throw new Error('MAC ต้องมี 12 หลัก (0-9, A-F)');
  return m.match(/../g).join(':');
}

function api_netDevices(token) {
  return respond_(function () {
    owner_(token);
    return readAll_('NetDevices').filter(function (d) { return d.note !== '__deleted'; }).map(function (d) {
      return { mac: d.mac, name: d.name, type: d.type || 'other', ownerId: d.ownerId || '', locked: bool_(d.locked), allowed: bool_(d.allowed), note: d.note || '', updatedAt: d.updatedAt,
               pending: d.pending || '', pendingErr: d.pendingErr || '' };
    });
  });
}

/** d = { mac, name, type, ownerId, locked, allowed, note } — upsert by MAC. */
function api_saveNetDevice(token, d) {
  return respond_(function () {
    var s = owner_(token);
    d = d || {};
    var mac = normMac_(d.mac);
    return withLock_(function () {
      var row = readAll_('NetDevices').filter(function (x) { return x.mac === mac; })[0];
      var fresh = !row;
      if (row && row.note === '__deleted') row.note = '';
      row = row || { mac: mac };
      if (d.name !== undefined) row.name = String(d.name || '').trim().slice(0, 60);
      if (d.type !== undefined) row.type = NET_TYPES.indexOf(d.type) >= 0 ? d.type : 'other';
      if (d.ownerId !== undefined) row.ownerId = String(d.ownerId || '');
      if (d.locked !== undefined) row.locked = !!d.locked;
      if (d.allowed !== undefined) row.allowed = !!d.allowed;
      if (d.note !== undefined) row.note = String(d.note || '').slice(0, 200);
      // From a phone / other PC: ask the counter PC to put it into (or take it out of) the router
      if (d.pending !== undefined) {
        var want = d.pending === 'allow' || d.pending === 'block' ? d.pending : '';
        if (want === 'block' && bool_(row.locked)) throw new Error('เครื่องสำคัญ — ปิดสิทธิ์ไม่ได้ (เอาติ๊ก "เครื่องสำคัญ" ออกก่อน)');
        row.pending = want; row.pendingErr = '';
      }
      row.updatedAt = now_(); row.updatedBy = s.userId;
      if (fresh) append_('NetDevices', row); else writeRow_('NetDevices', row);
      log_(s, 'NET_DEVICE', mac, (row.name || '') + ' · ' + (row.pending === 'allow' ? 'ขออนุญาต (รอเครื่องหน้าร้าน)' : row.pending === 'block' ? 'ขอปิดสิทธิ์ (รอเครื่องหน้าร้าน)' : row.allowed ? 'อนุญาต' : 'ไม่อนุญาต'), '');
      return { mac: mac };
    });
  });
}

function api_deleteNetDevice(token, mac) {
  return respond_(function () {
    var s = owner_(token);
    var m = normMac_(mac);
    return withLock_(function () {
      var row = readAll_('NetDevices').filter(function (x) { return x.mac === m; })[0];
      if (!row) return { mac: m };
      row.note = '__deleted'; row.allowed = false; row.locked = false; row.updatedAt = now_(); row.updatedBy = s.userId;
      writeRow_('NetDevices', row);
      log_(s, 'NET_DEVICE_DEL', m, row.name || '', '');
      return { mac: m };
    });
  });
}


/** Counter PC: whitelist changes asked for from other screens, still to be sent to the router. */
function api_netPending(token) {
  return respond_(function () {
    var s = session_(token);
    requireCounter_(s);
    return readAll_('NetDevices').filter(function (d) { return d.note !== '__deleted' && (d.pending === 'allow' || d.pending === 'block'); }).map(function (d) {
      return { mac: d.mac, name: d.name || '', pending: d.pending, locked: bool_(d.locked) };
    });
  });
}

/** Counter PC reports back: done → allowed follows the request; failed → keep it waiting with the reason. */
function api_netPendingDone(token, mac, ok, err) {
  return respond_(function () {
    var s = session_(token);
    requireCounter_(s);
    var m = normMac_(mac);
    return withLock_(function () {
      var row = readAll_('NetDevices').filter(function (x) { return x.mac === m; })[0];
      if (!row || !row.pending) return { mac: m };
      if (ok) {
        row.allowed = row.pending === 'allow';
        log_(s, 'NET_DEVICE', m, (row.name || '') + ' · ' + (row.allowed ? 'อนุญาต' : 'ไม่อนุญาต') + ' (ส่งเข้าเราเตอร์แล้ว)', '');
        row.pending = ''; row.pendingErr = '';
      } else {
        row.pendingErr = String(err || 'ส่งเข้าเราเตอร์ไม่สำเร็จ').slice(0, 200);
      }
      row.updatedAt = now_();
      writeRow_('NetDevices', row);
      return { mac: m, allowed: bool_(row.allowed), pending: row.pending || '' };
    });
  });
}
