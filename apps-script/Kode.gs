/**
 * Jembatan Google Drive, Sheets, Gmail, dan Kalender untuk bot asisten pribadi.
 *
 * Skrip ini dijalankan atas nama pemilik akun (Execute as: Me), sehingga bot di VPS bisa
 * mengelola folder, Database Raffy, email, dan jadwal tanpa Client ID Google.
 * Bot selalu meminta persetujuan pengguna di Telegram sebelum mengubah data.
 * Setiap permintaan wajib membawa kode rahasia yang dipasangkan sekali oleh `npm run setup`.
 *
 * Jangan ubah isi file ini. Cara memasang: docs/APPS-SCRIPT.md
 */

var VERSI = '2';
var PROP_KODE = 'KODE_RAHASIA';

// Dibuka lewat browser: hanya untuk memastikan Web App sudah aktif.
function doGet() {
  return ContentService.createTextOutput('Web App Agen Pertanahan aktif (versi ' + VERSI + ').');
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var result = jalankan_(req);
    return balas_({ ok: true, result: result });
  } catch (err) {
    return balas_({ ok: false, error: String((err && err.message) || err) });
  }
}

function balas_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function jalankan_(req) {
  var props = PropertiesService.getScriptProperties();
  var tersimpan = props.getProperty(PROP_KODE);

  // Pemasangan pertama: kode rahasia dari bot disimpan. Sesudahnya kode tidak bisa diganti dari luar.
  if (req.action === 'pasang') {
    if (!req.secret || String(req.secret).length < 32) throw new Error('Kode rahasia terlalu pendek.');
    if (!tersimpan) { props.setProperty(PROP_KODE, req.secret); return { versi: VERSI, baru: true }; }
    if (tersimpan === req.secret) return { versi: VERSI, baru: false };
    throw new Error('Skrip sudah dipasangkan dengan kode lain. Bila ingin memasang ulang, jalankan fungsi resetKodeRahasia di editor Apps Script.');
  }
  if (!tersimpan) throw new Error('Skrip belum dipasangkan. Jalankan npm run setup di VPS.');
  if (req.secret !== tersimpan) throw new Error('Kode rahasia salah.');

  var aksi = AKSI_[req.action];
  if (!aksi) throw new Error('Aksi tidak dikenal: ' + req.action);
  return aksi(req);
}

var AKSI_ = {
  ping: function () {
    return { versi: VERSI, akun: Session.getEffectiveUser().getEmail() };
  },

  driveGetFolder: function (p) {
    return infoBerkas_(DriveApp.getFolderById(p.id));
  },

  // Pakai folder yang sudah ada bila namanya sama; buat baru hanya bila belum ada.
  driveFindOrCreateFolder: function (p) {
    var induk = DriveApp.getFolderById(p.parentId);
    var it = induk.getFoldersByName(p.name);
    while (it.hasNext()) {
      var f = it.next();
      if (!f.isTrashed()) { var ada = infoBerkas_(f); ada.created = false; return ada; }
    }
    var baru = infoBerkas_(induk.createFolder(p.name));
    baru.created = true;
    return baru;
  },

  driveListNames: function (p) {
    var folder = DriveApp.getFolderById(p.folderId);
    var nama = [];
    [folder.getFiles(), folder.getFolders()].forEach(function (it) {
      while (it.hasNext()) { var x = it.next(); if (!x.isTrashed()) nama.push(x.getName()); }
    });
    return nama;
  },

  driveListChildren: function (p) {
    var folder = DriveApp.getFolderById(p.folderId);
    var isi = [];
    [folder.getFolders(), folder.getFiles()].forEach(function (it, i) {
      while (it.hasNext()) {
        var x = it.next();
        if (x.isTrashed()) continue;
        var info = infoBerkas_(x);
        info.jenis = i === 0 ? 'folder' : x.getMimeType();
        info.diubah = x.getLastUpdated().toISOString();
        isi.push(info);
      }
    });
    return isi;
  },

  driveUpload: function (p) {
    var blob = Utilities.newBlob(Utilities.base64Decode(p.base64), p.mimeType, p.name);
    return infoBerkas_(DriveApp.getFolderById(p.folderId).createFile(blob));
  },

  // Membaca baris startRow..endRow (endRow kosong = sampai baris terakhir yang berisi).
  sheetRead: function (p) {
    var sh = lembar_(p);
    var akhir = p.endRow || sh.getLastRow();
    if (akhir < p.startRow) return [];
    var r = sh.getRange(p.startRow, 1, akhir - p.startRow + 1, p.numCols);
    return p.mode === 'formula' ? r.getFormulas() : r.getDisplayValues();
  },

  // Menambah satu baris di bawah baris terakhir. Teks diberi awalan petik agar tidak dibaca
  // sebagai tanggal, angka, atau rumus. Format baris di atasnya disalin supaya tampilan seragam.
  sheetAppend: function (p) {
    var sh = lembar_(p);
    var kunci = LockService.getScriptLock();
    kunci.waitLock(30000);
    try {
      var baris = Math.max(sh.getLastRow(), 1) + 1;
      var n = p.values.length;
      var nilai = p.values.map(function (v) { return typeof v === 'string' && v !== '' ? "'" + v : v; });
      if (baris > 2) sh.getRange(baris - 1, 1, 1, n).copyFormatToRange(sh, 1, n, baris, baris);
      sh.getRange(baris, 1, 1, n).setValues([nilai]);
      SpreadsheetApp.flush();
      return { rowNumber: baris };
    } finally {
      kunci.releaseLock();
    }
  },

  // Mengisi satu sel dengan teks apa adanya (awalan petik: tidak dibaca sebagai tanggal/rumus).
  sheetSetValue: function (p) {
    var v = typeof p.value === 'string' && p.value !== '' ? "'" + p.value : p.value;
    lembar_(p).getRange(p.row, p.col).setValue(v);
    SpreadsheetApp.flush();
    return true;
  },

  sheetSetFormula: function (p) {
    lembar_(p).getRange(p.row, p.col).setFormula(p.formula);
    SpreadsheetApp.flush();
    return true;
  },

  // ---- Gmail ----
  gmailSearch: function (p) {
    return GmailApp.search(p.query || 'in:inbox', 0, Math.min(p.max || 10, 30)).map(function (t) {
      var msgs = t.getMessages();
      var last = msgs[msgs.length - 1];
      return {
        thread_id: t.getId(), subjek: t.getFirstMessageSubject(), dari: last.getFrom(),
        tanggal: last.getDate().toISOString(), jumlah_pesan: msgs.length, belum_dibaca: t.isUnread(),
        cuplikan: last.getPlainBody().replace(/\s+/g, ' ').slice(0, 200),
      };
    });
  },

  gmailRead: function (p) {
    var t = GmailApp.getThreadById(p.threadId);
    if (!t) throw new Error('Email tidak ditemukan.');
    return t.getMessages().map(function (m) {
      return {
        dari: m.getFrom(), kepada: m.getTo(), cc: m.getCc(), tanggal: m.getDate().toISOString(),
        subjek: m.getSubject(), isi: m.getPlainBody().slice(0, 12000),
        lampiran: m.getAttachments().map(function (a) { return a.getName(); }),
      };
    });
  },

  gmailSend: function (p) {
    GmailApp.sendEmail(p.to, p.subject, p.body, opsiEmail_(p));
    return true;
  },

  gmailDraft: function (p) {
    var d = GmailApp.createDraft(p.to, p.subject, p.body, opsiEmail_(p));
    return { draft_id: d.getId() };
  },

  gmailReply: function (p) {
    var t = GmailApp.getThreadById(p.threadId);
    if (!t) throw new Error('Email tidak ditemukan.');
    t.reply(p.body, opsiEmail_(p));
    return true;
  },

  // ---- Kalender (kalender utama akun) ----
  calList: function (p) {
    return CalendarApp.getDefaultCalendar().getEvents(new Date(p.start), new Date(p.end)).map(function (e) {
      return {
        event_id: e.getId(), judul: e.getTitle(), mulai: e.getStartTime().toISOString(),
        selesai: e.getEndTime().toISOString(), sepanjang_hari: e.isAllDayEvent(),
        lokasi: e.getLocation(), keterangan: e.getDescription().slice(0, 2000),
      };
    });
  },

  calCreate: function (p) {
    var opsi = { location: p.location || '', description: p.description || '' };
    if (p.guests) { opsi.guests = p.guests; opsi.sendInvites = true; }
    var e = CalendarApp.getDefaultCalendar().createEvent(p.title, new Date(p.start), new Date(p.end), opsi);
    return { event_id: e.getId() };
  },

  calDelete: function (p) {
    var e = CalendarApp.getDefaultCalendar().getEventById(p.eventId);
    if (!e) throw new Error('Acara tidak ditemukan.');
    e.deleteEvent();
    return true;
  },
};

function opsiEmail_(p) {
  var o = {};
  if (p.cc) o.cc = p.cc;
  if (p.bcc) o.bcc = p.bcc;
  if (p.attachmentIds && p.attachmentIds.length) {
    o.attachments = p.attachmentIds.map(function (id) { return DriveApp.getFileById(id).getBlob(); });
  }
  return o;
}

function infoBerkas_(f) {
  return { id: f.getId(), name: f.getName(), webViewLink: f.getUrl(), trashed: f.isTrashed() };
}

function lembar_(p) {
  var sh = SpreadsheetApp.openById(p.spreadsheetId).getSheetByName(p.sheet);
  if (!sh) throw new Error('Tab "' + p.sheet + '" tidak ditemukan.');
  return sh;
}

// Jalankan dari editor (pilih fungsi ini lalu klik Run) bila ingin memasangkan ulang dengan bot.
function resetKodeRahasia() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_KODE);
  Logger.log('Kode rahasia dihapus. Jalankan npm run setup di VPS untuk memasangkan ulang.');
}

// Jalankan dari editor untuk memunculkan jendela izin sebelum Deploy. Google meminta izin untuk
// semua layanan yang dipakai skrip ini (Drive, Sheets, Gmail, Kalender) sekaligus.
function izinkanAkses() {
  Logger.log('Izin sudah diberikan untuk akun ' + Session.getEffectiveUser().getEmail() + '. Lanjutkan ke Deploy.');
  Logger.log('Drive: ' + DriveApp.getRootFolder().getName() + '; Gmail: ' + GmailApp.getInboxUnreadCount()
    + ' email belum dibaca; Kalender: ' + CalendarApp.getDefaultCalendar().getName());
}
