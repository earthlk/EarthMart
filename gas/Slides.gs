/**
 * Customer-display slides: posters the owner uploads (JPEG, resized in the browser), kept in a Drive folder.
 * The counter downloads each image once and keeps it on the device, so the display works offline.
 * Promotion slides are made on the counter from the live promotions; nothing is stored for them.
 */

var SLIDE_MAX_BYTES = 1.5 * 1024 * 1024;

function slidesFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SLIDES_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* deleted: make a new one */ } }
  var f = DriveApp.createFolder(APP_NAME + ' Slides');
  props.setProperty('SLIDES_FOLDER_ID', f.getId());
  return f;
}

function slideRow_(r) {
  return { slideId: String(r.slideId), title: r.title || '', startDate: r.startDate instanceof Date ? fmtDate_(r.startDate, 'yyyy-MM-dd') : String(r.startDate || '').slice(0, 10),
           endDate: r.endDate instanceof Date ? fmtDate_(r.endDate, 'yyyy-MM-dd') : String(r.endDate || '').slice(0, 10),
           active: bool_(r.active), sort: num_(r.sort), updatedAt: r.updatedAt };
}

function slidesForClient_() {
  return readAll_('Slides').filter(function (r) { return String(r.slideId); }).map(slideRow_)
    .sort(function (a, b) { return a.sort - b.sort; });
}

function api_listSlides(token) {
  return respond_(function () { session_(token); return slidesForClient_(); });
}

/** The image as a data URL (the counter caches it). */
function api_slideImage(token, slideId) {
  return respond_(function () {
    session_(token);
    var r = readAll_('Slides').filter(function (x) { return String(x.slideId) === String(slideId); })[0];
    if (!r) throw new Error('ไม่พบสไลด์');
    var blob = DriveApp.getFileById(r.fileId).getBlob();
    return { slideId: r.slideId, dataUrl: 'data:' + (r.mime || 'image/jpeg') + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
  });
}

/** s = { title, dataUrl ('data:image/jpeg;base64,…'), startDate, endDate } */
function api_uploadSlide(token, s) {
  return respond_(function () {
    var sess = owner_(token);
    s = s || {};
    var m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(String(s.dataUrl || ''));
    if (!m) throw new Error('ไฟล์ต้องเป็นรูปภาพ');
    var bytes = Utilities.base64Decode(m[3]);
    if (bytes.length > SLIDE_MAX_BYTES) throw new Error('รูปใหญ่เกินไป');
    var start = dateOnly_(s.startDate), end = dateOnly_(s.endDate);
    if (start && end && end < start) throw new Error('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
    return withLock_(function () {
      var id = uid_('SL');
      var file = slidesFolder_().createFile(Utilities.newBlob(bytes, m[1], id + '.' + (m[2] === 'jpeg' ? 'jpg' : m[2])));
      var rows = readAll_('Slides');
      var row = { slideId: id, title: String(s.title || '').trim(), fileId: file.getId(), mime: m[1], startDate: start, endDate: end, active: true,
                  sort: rows.reduce(function (a, r) { return Math.max(a, num_(r.sort)); }, 0) + 1, createdAt: now_(), updatedAt: now_() };
      append_('Slides', row);
      log_(sess, 'SLIDE_ADD', id, row.title, '');
      return slideRow_(row);
    });
  });
}

/** s = { slideId, title?, startDate?, endDate?, active?, move?: -1 | 1 } */
function api_saveSlide(token, s) {
  return respond_(function () {
    owner_(token);
    return withLock_(function () {
      var rows = readAll_('Slides').filter(function (r) { return String(r.slideId); }).sort(function (a, b) { return num_(a.sort) - num_(b.sort); });
      var i = -1;
      rows.forEach(function (r, k) { if (String(r.slideId) === String(s.slideId)) i = k; });
      if (i < 0) throw new Error('ไม่พบสไลด์');
      var r = rows[i];
      if (s.title !== undefined) r.title = String(s.title).trim();
      if (s.startDate !== undefined) r.startDate = dateOnly_(s.startDate);
      if (s.endDate !== undefined) r.endDate = dateOnly_(s.endDate);
      if (s.active !== undefined) r.active = !!s.active;
      var j = s.move ? i + (s.move < 0 ? -1 : 1) : -1;
      if (j >= 0 && j < rows.length) {
        var t = num_(rows[j].sort); rows[j].sort = num_(r.sort); r.sort = t;
        if (rows[j].sort === r.sort) r.sort += s.move < 0 ? -1 : 1;
        rows[j].updatedAt = now_(); writeRow_('Slides', rows[j]);
      }
      r.updatedAt = now_();
      writeRow_('Slides', r);
      return slidesForClient_();
    });
  });
}

function api_deleteSlide(token, slideId) {
  return respond_(function () {
    var sess = owner_(token);
    return withLock_(function () {
      var r = readAll_('Slides').filter(function (x) { return String(x.slideId) === String(slideId); })[0];
      if (!r) throw new Error('ไม่พบสไลด์');
      try { DriveApp.getFileById(r.fileId).setTrashed(true); } catch (e) { /* already gone */ }
      sheet_('Slides').getRange(r._row, 1, 1, SCHEMA.Slides.length).setValues([SCHEMA.Slides.map(function () { return ''; })]);
      log_(sess, 'SLIDE_DELETE', r.slideId, r.title, '');
      return slidesForClient_();
    });
  });
}
