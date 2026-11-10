/**
 * Product photos for the sale screen (quick keys). JPEG resized in the browser, kept in a Drive folder.
 * Products.image holds the Drive file id; a new photo gets a new id, so devices know to fetch it again.
 */

var IMAGE_MAX_BYTES = 600 * 1024;

function imagesFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('IMAGES_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* deleted: make a new one */ } }
  var f = DriveApp.createFolder(APP_NAME + ' Images');
  props.setProperty('IMAGES_FOLDER_ID', f.getId());
  return f;
}

function productRow_(sku) {
  var p = readAll_('Products').filter(function (x) { return String(x.sku) === String(sku); })[0];
  if (!p) throw new Error('ไม่พบสินค้า');
  return p;
}

/** dataUrl: 'data:image/jpeg;base64,…'. Returns the new image id. */
function api_uploadProductImage(token, sku, dataUrl) {
  return respond_(function () {
    var s = owner_(token);
    var m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(String(dataUrl || ''));
    if (!m) throw new Error('ไฟล์ต้องเป็นรูปภาพ');
    var bytes = Utilities.base64Decode(m[3]);
    if (bytes.length > IMAGE_MAX_BYTES) throw new Error('รูปใหญ่เกินไป');
    return withLock_(function () {
      var p = productRow_(sku);
      var file = imagesFolder_().createFile(Utilities.newBlob(bytes, m[1], String(p.sku) + '.' + (m[2] === 'jpeg' ? 'jpg' : m[2])));
      var old = p.image;
      p.image = file.getId(); p.updatedAt = now_();
      writeRow_('Products', p);
      if (old) { try { DriveApp.getFileById(old).setTrashed(true); } catch (e) { /* already gone */ } }
      log_(s, 'PRODUCT_IMAGE', p.sku, p.name, '');
      return { sku: String(p.sku), image: p.image };
    });
  });
}

function api_removeProductImage(token, sku) {
  return respond_(function () {
    var s = owner_(token);
    return withLock_(function () {
      var p = productRow_(sku);
      if (p.image) { try { DriveApp.getFileById(p.image).setTrashed(true); } catch (e) { /* already gone */ } }
      p.image = ''; p.updatedAt = now_();
      writeRow_('Products', p);
      log_(s, 'PRODUCT_IMAGE', p.sku, p.name + ' (ลบรูป)', '');
      return { sku: String(p.sku), image: '' };
    });
  });
}

/** The photo as a data URL (devices cache it by id). */
function api_productImage(token, imageId) {
  return respond_(function () {
    session_(token);
    var known = readAll_('Products').some(function (p) { return String(p.image) === String(imageId); });
    if (!known) throw new Error('ไม่พบรูป');
    var blob = DriveApp.getFileById(imageId).getBlob();
    return { image: imageId, dataUrl: 'data:' + (blob.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
  });
}
