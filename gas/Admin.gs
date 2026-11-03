/**
 * Settings, audit log, backup, triggers.
 */

var SECRET_SETTINGS = ['lineChannelToken'];
var settingsMemo_ = null;

function settingsMap_() {
  if (settingsMemo_) return settingsMemo_;
  var map = {};
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { map[k] = DEFAULT_SETTINGS[k]; });
  readAll_('Settings').forEach(function (r) { map[r.key] = r.value === null ? '' : String(r.value); });
  settingsMemo_ = map;
  return map;
}

function getSetting_(key) { return settingsMap_()[key] || ''; }

/** Settings safe to send to any logged-in browser (no secrets). */
function publicSettings_() {
  var m = settingsMap_();
  var out = {};
  Object.keys(m).forEach(function (k) { if (SECRET_SETTINGS.indexOf(k) < 0) out[k] = m[k]; });
  out.lineEnabled = !!(m.lineChannelToken && m.lineTargetId);
  return out;
}

function api_getSettings(token) {
  return respond_(function () {
    owner_(token);
    var s = publicSettings_();
    s.lineChannelToken = getSetting_('lineChannelToken') ? '••••••' : '';
    return s;
  });
}

/** Only known keys are saved. A secret left as '••••••' keeps its old value. */
function api_saveSettings(token, values) {
  return respond_(function () {
    var s = owner_(token);
    return withLock_(function () {
      var rows = readAll_('Settings');
      var byKey = {};
      rows.forEach(function (r) { byKey[r.key] = r; });
      var changed = [];
      Object.keys(values || {}).forEach(function (k) {
        if (!(k in DEFAULT_SETTINGS)) return;
        var v = String(values[k] === null || values[k] === undefined ? '' : values[k]).trim();
        if (SECRET_SETTINGS.indexOf(k) >= 0 && v === '••••••') return;
        if (k === 'promptPayId' && v && !/^(\d{10}|\d{13}|\d{15})$/.test(v.replace(/[-\s]/g, ''))) {
          throw new Error('พร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก, เลขบัตร/เลขผู้เสียภาษี 13 หลัก หรือ e-Wallet 15 หลัก');
        }
        if (k === 'promptPayId') v = v.replace(/[-\s]/g, '');
        if (byKey[k]) {
          if (String(byKey[k].value) !== v) { byKey[k].value = v; writeRow_('Settings', byKey[k]); changed.push(k); }
        } else {
          append_('Settings', { key: k, value: v });
          changed.push(k);
        }
      });
      settingsMemo_ = null;
      if (changed.length) log_(s, 'SETTINGS', '', changed.join(', '), '');
      return publicSettings_();
    });
  });
}

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

function log_(sess, action, ref, detail, approvedBy) {
  try {
    append_('AuditLog', {
      logId: uid_('L'), createdAt: now_(), userId: sess ? sess.userId : '', action: action,
      ref: ref || '', detail: detail || '', approvedBy: approvedBy || '', deviceId: sess ? sess.deviceId || '' : ''
    });
  } catch (e) {
    // Logging must never break a sale.
  }
}

function api_auditLog(token, limit) {
  return respond_(function () {
    owner_(token);
    var users = {};
    readAll_('Users').forEach(function (u) { users[u.userId] = u.name; });
    return readAll_('AuditLog').slice(-(limit || 200)).reverse().map(function (a) {
      return { createdAt: a.createdAt, user: users[a.userId] || '', action: a.action, ref: a.ref,
               detail: a.detail, approvedBy: a.approvedBy };
    });
  });
}

/* ------------------------------------------------------------------ */
/* Backup                                                              */
/* ------------------------------------------------------------------ */

/** Copies the whole spreadsheet into the backup folder and removes copies older than backupKeepDays. */
function backupNow() {
  var ss = ss_();
  var folderId = getSetting_('backupFolderId');
  var folder;
  if (folderId) {
    folder = DriveApp.getFolderById(folderId);
  } else {
    folder = DriveApp.createFolder(APP_NAME + ' Backup');
    saveSettingRaw_('backupFolderId', folder.getId());
  }
  var name = ss.getName() + ' backup ' + fmtDate_(now_(), 'yyyy-MM-dd HHmm');
  DriveApp.getFileById(ss.getId()).makeCopy(name, folder);

  var keep = num_(getSetting_('backupKeepDays')) || 30;
  var cutoff = new Date(now_().getTime() - keep * 24 * 60 * 60 * 1000);
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.getDateCreated() < cutoff) f.setTrashed(true);
  }
  return name;
}

function saveSettingRaw_(key, value) {
  var row = readAll_('Settings').filter(function (r) { return r.key === key; })[0];
  if (row) { row.value = value; writeRow_('Settings', row); }
  else append_('Settings', { key: key, value: value });
  settingsMemo_ = null;
}

function api_backupNow(token) {
  return respond_(function () {
    var s = owner_(token);
    var name = backupNow();
    log_(s, 'BACKUP', '', name, '');
    return name;
  });
}

/** Run once from the editor: daily backup at about 02:00. */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backupNow') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('backupNow').timeBased().everyDays(1).atHour(2).create();
  return 'ตั้ง Backup อัตโนมัติทุกวันเวลา ~02:00 แล้ว';
}
