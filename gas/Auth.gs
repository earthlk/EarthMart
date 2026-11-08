/**
 * Users, PIN login, sessions, owner approvals, device registration.
 *
 * Every function called from the browser is named api_* and goes through respond_()
 * so errors come back as { ok:false, error } and Dates become ISO strings.
 */

var SESSION_SECONDS = 6 * 60 * 60;      // CacheService maximum
var APPROVAL_SECONDS = 5 * 60;
var MAX_PIN_TRIES = 5;

/* ------------------------------------------------------------------ */
/* Response wrapper                                                    */
/* ------------------------------------------------------------------ */

function respond_(fn) {
  try {
    return { ok: true, data: plain_(fn()) };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

/** JSON has no Date type — convert Dates to ISO strings and drop internal _row. */
function plain_(v) {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(plain_);
  if (v && typeof v === 'object') {
    var o = {};
    Object.keys(v).forEach(function (k) { if (k !== '_row') o[k] = plain_(v[k]); });
    return o;
  }
  return v;
}

/* ------------------------------------------------------------------ */
/* PIN hashing                                                         */
/* ------------------------------------------------------------------ */

function hashPin_(pin, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pin, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var h = (b & 0xff).toString(16); return h.length === 1 ? '0' + h : h; }).join('');
}

function validatePin_(pin) {
  if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN ต้องเป็นตัวเลข 4–6 หลัก');
}

function addUser_(name, role, pin) {
  validatePin_(pin);
  if (role !== 'owner' && role !== 'cashier') throw new Error('สิทธิ์ต้องเป็น owner หรือ cashier');
  var salt = uid_('');
  var user = {
    userId: uid_('U'),
    name: String(name).trim(),
    role: role,
    pinHash: hashPin_(pin, salt),
    salt: salt,
    active: true,
    createdAt: now_(),
    pinLen: String(pin).length
  };
  if (!user.name) throw new Error('ต้องใส่ชื่อ');
  append_('Users', user);
  return { userId: user.userId, name: user.name, role: user.role };
}

function findUser_(userId) {
  var u = readAll_('Users').filter(function (x) { return x.userId === userId; })[0];
  if (!u || !bool_(u.active)) throw new Error('ไม่พบผู้ใช้');
  return u;
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

function cache_() { return CacheService.getScriptCache(); }

function api_login(userId, pin, deviceId) {
  return respond_(function () {
    var tries = num_(cache_().get('tries_' + userId));
    if (tries >= MAX_PIN_TRIES) throw new Error('ใส่ PIN ผิดหลายครั้ง รอ 5 นาทีแล้วลองใหม่');
    var u = findUser_(userId);
    if (hashPin_(String(pin), u.salt) !== u.pinHash) {
      cache_().put('tries_' + userId, String(tries + 1), 300);
      throw new Error('PIN ไม่ถูกต้อง');
    }
    cache_().remove('tries_' + userId);
    if (num_(u.pinLen) !== String(pin).length) { u.pinLen = String(pin).length; writeRow_('Users', u); }   // users created before pinLen existed
    var token = uid_('S') + uid_('');
    var sess = { userId: u.userId, name: u.name, role: u.role, deviceId: deviceId || '' };
    cache_().put('sess_' + token, JSON.stringify(sess), SESSION_SECONDS);
    log_(sess, 'LOGIN', '', '', '');
    return { token: token, user: { userId: u.userId, name: u.name, role: u.role } };
  });
}

function api_logout(token) {
  return respond_(function () {
    cache_().remove('sess_' + token);
    return true;
  });
}

/** Throws unless the token is a live session. Refreshes its lifetime. */
function session_(token) {
  if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
  var raw = cache_().get('sess_' + token);
  if (!raw) throw new Error('หมดเวลาเข้าสู่ระบบ กรุณาเข้าใหม่');
  cache_().put('sess_' + token, raw, SESSION_SECONDS);
  return JSON.parse(raw);
}

function owner_(token) {
  var s = session_(token);
  if (s.role !== 'owner') throw new Error('เฉพาะเจ้าของร้าน');
  return s;
}

/* ------------------------------------------------------------------ */
/* Owner approval (discount, void, stock adjust by cashier)            */
/* ------------------------------------------------------------------ */

/** Owner types their PIN on the cashier's screen. Returns a one-time approval id. */
function api_approve(token, pin, action) {
  return respond_(function () {
    var s = session_(token);
    var owners = readAll_('Users').filter(function (u) { return u.role === 'owner' && bool_(u.active); });
    var match = owners.filter(function (u) { return hashPin_(String(pin), u.salt) === u.pinHash; })[0];
    if (!match) {
      log_(s, 'APPROVE_FAIL', action, '', '');
      throw new Error('PIN เจ้าของไม่ถูกต้อง');
    }
    var id = uid_('A');
    cache_().put('appr_' + id, JSON.stringify({ ownerId: match.userId, ownerName: match.name, action: action }), APPROVAL_SECONDS);
    return { approvalId: id, ownerName: match.name };
  });
}

/**
 * Returns the approving owner's name. Owners approve themselves.
 * Throws if a cashier has no valid approval for this action.
 */
function consumeApproval_(sess, approvalId, action) {
  if (sess.role === 'owner') return sess.name;
  if (!approvalId) throw new Error('ต้องให้เจ้าของใส่ PIN อนุมัติ');
  var raw = cache_().get('appr_' + approvalId);
  if (!raw) throw new Error('การอนุมัติหมดเวลา ให้เจ้าของใส่ PIN ใหม่');
  var a = JSON.parse(raw);
  if (a.action !== action) throw new Error('การอนุมัติไม่ตรงกับรายการ');
  cache_().remove('appr_' + approvalId);
  return a.ownerName;
}

/* ------------------------------------------------------------------ */
/* Users (owner only)                                                  */
/* ------------------------------------------------------------------ */

function api_listUsers(token) {
  return respond_(function () {
    owner_(token);
    return readAll_('Users').map(function (u) {
      return { userId: u.userId, name: u.name, role: u.role, active: bool_(u.active) };
    });
  });
}

function api_addUser(token, name, role, pin) {
  return respond_(function () {
    var s = owner_(token);
    var u = withLock_(function () { return addUser_(name, role, String(pin)); });
    log_(s, 'USER_ADD', u.userId, u.name + ' (' + role + ')', '');
    return u;
  });
}

function api_resetPin(token, userId, pin) {
  return respond_(function () {
    var s = owner_(token);
    validatePin_(String(pin));
    var u = findUser_(userId);
    u.salt = uid_('');
    u.pinHash = hashPin_(String(pin), u.salt);
    u.pinLen = String(pin).length;
    writeRow_('Users', u);
    log_(s, 'USER_PIN_RESET', userId, u.name, '');
    return true;
  });
}

function api_setUserActive(token, userId, active) {
  return respond_(function () {
    var s = owner_(token);
    var u = readAll_('Users').filter(function (x) { return x.userId === userId; })[0];
    if (!u) throw new Error('ไม่พบผู้ใช้');
    if (!active && u.role === 'owner') {
      var others = readAll_('Users').filter(function (x) { return x.role === 'owner' && bool_(x.active) && x.userId !== userId; });
      if (!others.length) throw new Error('ต้องมีเจ้าของอย่างน้อย 1 คน');
    }
    u.active = !!active;
    writeRow_('Users', u);
    log_(s, active ? 'USER_ENABLE' : 'USER_DISABLE', userId, u.name, '');
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Devices                                                             */
/* ------------------------------------------------------------------ */

/** True when this browser was registered as a front-counter machine. */
function isCounter_(deviceId) {
  if (!deviceId) return false;
  return readAll_('Devices').some(function (d) {
    return d.deviceId === deviceId && d.type === 'counter' && bool_(d.active);
  });
}

function requireCounter_(sess) {
  if (!isCounter_(sess.deviceId)) {
    throw new Error('ใช้ได้เฉพาะเครื่องหน้าร้านที่ลงทะเบียนแล้ว (ตั้งค่า › เครื่อง)');
  }
}

function api_registerDevice(token, deviceId, name) {
  return respond_(function () {
    var s = owner_(token);
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(deviceId || '')) throw new Error('รหัสเครื่องไม่ถูกต้อง');
    return withLock_(function () {
      var existing = readAll_('Devices').filter(function (d) { return d.deviceId === deviceId; })[0];
      if (existing) {
        existing.active = true;
        existing.name = name || existing.name;
        existing.type = 'counter';
        writeRow_('Devices', existing);
      } else {
        append_('Devices', {
          deviceId: deviceId, name: name || 'เครื่องหน้าร้าน', type: 'counter',
          registeredBy: s.userId, registeredAt: now_(), active: true
        });
      }
      log_(s, 'DEVICE_REGISTER', deviceId, name || '', '');
      return true;
    });
  });
}

function api_unregisterDevice(token, deviceId) {
  return respond_(function () {
    var s = owner_(token);
    var d = readAll_('Devices').filter(function (x) { return x.deviceId === deviceId; })[0];
    if (!d) throw new Error('ไม่พบเครื่อง');
    d.active = false;
    writeRow_('Devices', d);
    log_(s, 'DEVICE_UNREGISTER', deviceId, d.name, '');
    return true;
  });
}

function api_listDevices(token) {
  return respond_(function () {
    owner_(token);
    return readAll_('Devices').filter(function (d) { return bool_(d.active); });
  });
}
