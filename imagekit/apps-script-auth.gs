/**
 * Auth endpoint ImageKit untuk Meja Operator (Google Apps Script, gratis).
 *
 * Fungsi: menandatangani permintaan unggah (token/expire/signature) dan menghapus berkas,
 * supaya PRIVATE KEY ImageKit tidak pernah ada di aplikasi/browser.
 *
 * CARA PASANG (sekali saja, sekitar 3 menit)
 *  1. Buka https://script.google.com > Proyek baru > hapus isi bawaan > tempel seluruh kode ini.
 *  2. Klik ikon roda gigi "Project Settings" > "Script Properties" > Add script property:
 *        Nama: IMAGEKIT_PRIVATE_KEY      Nilai: private key dari ImageKit Dashboard > Developer options
 *     (Opsional) ALLOWED_FOLDER = /meja-operator  -> hapus berkas hanya boleh di folder ini.
 *  3. Klik Deploy > New deployment > jenis "Web app":
 *        Execute as: Me        Who has access: Anyone
 *     Salin "Web app URL" (berakhiran /exec).
 *  4. Tempel URL itu di aplikasi: Koneksi Supabase > ImageKit > Auth Endpoint
 *     (atau di .env: VITE_IMAGEKIT_AUTH_ENDPOINT). Klik "Tes".
 *
 * Mengubah kode? Deploy > Manage deployments > Edit > Version: New version (URL tetap sama).
 */

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    var privateKey = PropertiesService.getScriptProperties().getProperty('IMAGEKIT_PRIVATE_KEY');
    if (!privateKey) return out_({ error: 'IMAGEKIT_PRIVATE_KEY belum diisi di Script Properties.' });

    if (p.action === 'delete') return out_(deleteFile_(p.fileId, privateKey));
    return out_(auth_(privateKey)); // action=auth (bawaan)
  } catch (err) {
    return out_({ error: String(err && err.message ? err.message : err) });
  }
}

function auth_(privateKey) {
  var token = Utilities.getUuid();
  var expire = Math.floor(Date.now() / 1000) + 30 * 60; // 30 menit (maksimal 1 jam)
  var sigBytes = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_1,
    token + expire,
    privateKey
  );
  var signature = sigBytes
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); })
    .join('');
  return { token: token, expire: expire, signature: signature };
}

function deleteFile_(fileId, privateKey) {
  if (!fileId || !/^[A-Za-z0-9_-]+$/.test(fileId)) return { error: 'fileId tidak valid.' };
  var auth = 'Basic ' + Utilities.base64Encode(privateKey + ':');
  var allowed = PropertiesService.getScriptProperties().getProperty('ALLOWED_FOLDER');
  if (allowed) {
    var info = UrlFetchApp.fetch('https://api.imagekit.io/v1/files/' + fileId + '/details', {
      method: 'get', headers: { Authorization: auth }, muteHttpExceptions: true
    });
    if (info.getResponseCode() !== 200) return { ok: false, error: 'Berkas tidak ditemukan.' };
    var path = (JSON.parse(info.getContentText()).filePath || '');
    if (path.indexOf(allowed) !== 0) return { ok: false, error: 'Berkas di luar folder yang diizinkan.' };
  }
  var res = UrlFetchApp.fetch('https://api.imagekit.io/v1/files/' + fileId, {
    method: 'delete', headers: { Authorization: auth }, muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  return { ok: code === 204 || code === 404, status: code };
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
