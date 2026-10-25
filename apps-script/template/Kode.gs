/**
 * Agen Pertanahan: jembatan Google untuk dashboard (versi 3).
 *
 * Skrip ini menempel pada spreadsheet "Database Agen Pertanahan" milik pengguna dan berjalan atas nama
 * pengguna (Execute as: Me). Dashboard memakainya untuk mengelola folder, Master Data, email, dan jadwal
 * pengguna itu sendiri. Setiap perubahan tetap menunggu tombol Setujui di dashboard atau Telegram.
 *
 * Penyambungan: buka tautan Web App, lalu ketik kode 6 angka dari dashboard. Kode rahasia dibuat
 * otomatis dan dikirim langsung ke dashboard, jadi pengguna tidak perlu menyalin apa pun.
 *
 * Jangan ubah isi file ini, kecuali DASHBOARD saat membuat template (docs/TEMPLATE-GOOGLE.md).
 */

// Alamat dashboard. Diisi sekali oleh pengelola saat membuat template.
var DASHBOARD = 'https://GANTI-DENGAN-ALAMAT-DASHBOARD';

var VERSI = '3';
var PROP_KODE = 'KODE_RAHASIA';
var PROP_FOLDER = 'FOLDER_INDUK_ID';
var PROP_SHEET = 'SPREADSHEET_ID';
var NAMA_TAB = 'Master Data';
var NAMA_FOLDER = 'Agen Pertanahan';
// Harus sama dengan HEADER di src/google/sheets.js (dijaga uji otomatis).
var HEADER = ['No', 'Nomor Agenda', 'Tanggal Disposisi', 'Perintah Disposisi', 'Tanggal Diterima', 'Tanggal Surat',
  'Nomor Surat', 'Pengadu (Prinsipal)', 'Penerima Kuasa', 'Perihal', 'Pokok Permasalahan', 'Teradu',
  'Objek Permasalahan', 'File Pengaduan', 'Rencana TL', 'Status'];

// ---------- menu di spreadsheet ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Agen Pertanahan')
    .addItem('Cara menyambungkan ke dashboard', 'tampilkanPanduan')
    .addSeparator()
    .addItem('Putuskan sambungan', 'putuskanSambungan')
    .addToUi();
  // Simpan ID spreadsheet ini supaya halaman Web App bisa menemukannya.
  try { PropertiesService.getScriptProperties().setProperty(PROP_SHEET, SpreadsheetApp.getActiveSpreadsheet().getId()); } catch (e) {}
}

function tampilkanPanduan() {
  var html = HtmlService.createHtmlOutput(
    '<div style="font:14px/1.5 Arial,sans-serif">' +
    '<p>Ikuti panduan di dashboard, menu <b>Mulai</b> &rarr; <b>Hubungkan Google</b>. Ringkasnya:</p><ol>' +
    '<li>Klik <b>Ekstensi</b> &rarr; <b>Apps Script</b>.</li>' +
    '<li>Klik <b>Terapkan</b> (Deploy) &rarr; <b>Deployment baru</b> &rarr; jenis <b>Aplikasi web</b>.</li>' +
    '<li>Pastikan <b>Jalankan sebagai: Saya</b> dan <b>Yang memiliki akses: Siapa saja</b>, lalu <b>Terapkan</b>.</li>' +
    '<li>Berikan izin. Bila muncul &ldquo;Google belum memverifikasi aplikasi ini&rdquo;, klik <b>Lanjutan</b> lalu <b>Buka &hellip; (tidak aman)</b>. Skrip ini milik Anda sendiri.</li>' +
    '<li>Klik tautan <b>Aplikasi web</b>, lalu ketik kode 6 angka dari dashboard.</li></ol></div>')
    .setWidth(460).setHeight(360);
  SpreadsheetApp.getUi().showModalDialog(html, 'Menyambungkan ke dashboard');
}

function putuskanSambungan() {
  var ui = SpreadsheetApp.getUi();
  var jawab = ui.alert('Putuskan sambungan?', 'Agen tidak akan bisa memakai Google Anda sampai disambungkan lagi dengan kode baru dari dashboard.', ui.ButtonSet.YES_NO);
  if (jawab !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().deleteProperty(PROP_KODE);
  ui.alert('Sambungan diputus. Untuk menyambungkan lagi, buka tautan Aplikasi web dan ketik kode baru dari dashboard.');
}

// ---------- halaman Web App ----------
function doGet() {
  var t = HtmlService.createTemplateFromFile('Pasang');
  t.tersambung = !!PropertiesService.getScriptProperties().getProperty(PROP_KODE);
  t.dashboard = DASHBOARD;
  return t.evaluate().setTitle('Sambungkan Agen Pertanahan').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Dipanggil halaman Pasang.html (google.script.run). Menyiapkan tab Master Data dan folder induk,
// membuat kode rahasia, lalu mengirimkannya ke dashboard bersama kode 6 angka dari pengguna.
function pasang(kode) {
  kode = String(kode || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(kode)) throw new Error('Kode harus 6 angka.');
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(PROP_KODE)) throw new Error('Skrip ini sudah tersambung. Untuk menyambungkan ulang, buka spreadsheet, menu Agen Pertanahan > Putuskan sambungan.');
  var url = ScriptApp.getService().getUrl();
  if (!url || !/\/exec$/.test(url)) throw new Error('Buka halaman ini lewat tautan Aplikasi web yang berakhiran /exec, bukan /dev.');

  var ss = siapkanSpreadsheet_();
  var folder = siapkanFolder_(ss);
  var rahasia = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  props.setProperty(PROP_KODE, rahasia);

  var res;
  try {
    res = UrlFetchApp.fetch(DASHBOARD + '/api/google/pasang', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ kode: kode, url: url, rahasia: rahasia, spreadsheetId: ss.getId(), folderId: folder.getId(),
        sheet: NAMA_TAB, email: Session.getEffectiveUser().getEmail(), versi: VERSI }),
    });
  } catch (err) {
    props.deleteProperty(PROP_KODE);
    throw new Error('Tidak bisa menghubungi dashboard di ' + DASHBOARD + '. Periksa koneksi, lalu coba lagi.');
  }
  var data = {};
  try { data = JSON.parse(res.getContentText()); } catch (e) {}
  if (res.getResponseCode() !== 200 || !data.ok) {
    props.deleteProperty(PROP_KODE);
    throw new Error(data.pesan || ('Dashboard menolak (HTTP ' + res.getResponseCode() + '). Coba lagi dengan kode baru.'));
  }
  return { nama: data.nama || '', folder: folder.getName(), spreadsheet: ss.getName() };
}

function siapkanSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var id = PropertiesService.getScriptProperties().getProperty(PROP_SHEET);
    if (!id) throw new Error('Buka dulu spreadsheet salinan Anda sekali, lalu muat ulang halaman ini.');
    ss = SpreadsheetApp.openById(id);
  }
  var sh = ss.getSheetByName(NAMA_TAB);
  if (!sh) sh = ss.insertSheet(NAMA_TAB, 0);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return ss;
}

function siapkanFolder_(ss) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_FOLDER);
  if (id) {
    try { var lama = DriveApp.getFolderById(id); if (!lama.isTrashed()) return lama; } catch (e) {}
  }
  var parents = DriveApp.getFileById(ss.getId()).getParents();
  var induk = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var it = induk.getFoldersByName(NAMA_FOLDER);
  var folder = null;
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) { folder = f; break; } }
  if (!folder) folder = induk.createFolder(NAMA_FOLDER);
  props.setProperty(PROP_FOLDER, folder.getId());
  return folder;
}

// ---------- permintaan dari dashboard ----------
function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var tersimpan = PropertiesService.getScriptProperties().getProperty(PROP_KODE);
    if (!tersimpan) throw new Error('Skrip belum tersambung ke dashboard.');
    if (req.secret !== tersimpan) throw new Error('Kode rahasia salah.');
    var aksi = AKSI_[req.action];
    if (!aksi) throw new Error('Aksi tidak dikenal: ' + req.action);
    return balas_({ ok: true, result: aksi(req) });
  } catch (err) {
    return balas_({ ok: false, error: String((err && err.message) || err) });
  }
}

function balas_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

var AKSI_ = {
  ping: function () {
    return { versi: VERSI, akun: Session.getEffectiveUser().getEmail() };
  },

  // Membaca baris judul tab Master Data, untuk diperiksa dashboard.
  header: function (p) {
    var sh = lembar_(p);
    return sh.getLastRow() ? sh.getRange(1, 1, 1, HEADER.length).getDisplayValues()[0] : [];
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


// Jalankan dari editor (pilih fungsi ini, klik Run) untuk memunculkan jendela izin lebih awal.
function izinkanAkses() {
  Logger.log('Izin sudah diberikan untuk ' + Session.getEffectiveUser().getEmail()
    + '. Drive: ' + DriveApp.getRootFolder().getName() + '; Gmail: ' + GmailApp.getInboxUnreadCount()
    + ' belum dibaca; Kalender: ' + CalendarApp.getDefaultCalendar().getName()
    + '; akses internet: ' + UrlFetchApp.fetch(DASHBOARD + '/sehat', { muteHttpExceptions: true }).getResponseCode());
}
