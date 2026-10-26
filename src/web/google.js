// Sambungan Google per pengguna lewat Apps Script versi 3 (apps-script/template).
// Alur: dashboard menampilkan kode 6 angka -> pengguna mengetiknya di halaman Web App miliknya ->
// skrip mengirim alamat, kode rahasia, dan ID spreadsheet/folder ke /api/google/pasang ->
// dashboard memeriksa balik skrip itu (ping dan judul Master Data) sebelum menyimpannya.
const K = require('./keamanan');
const { HEADER } = require('../google/sheets');
const { createAppsScriptClient } = require('../google/appsscript');
const { createGoogle } = require('../google');

const VERSI_SKRIP = '3';
const UMUR_KODE = 10 * 60e3;
const RE_URL = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]{20,}\/exec$/;
const RE_ID = /^[\w-]{20,}$/;

function buatLayananGoogle({ db, kunci, buatKlien = createAppsScriptClient }) {
  const kodeTampil = new Map(); // pengguna_id -> { kode, kedaluwarsa }; DB hanya menyimpan hash-nya

  // Kode yang sama dipakai ulang selama masih berlaku lebih dari 2 menit, supaya tidak berganti saat halaman dimuat ulang.
  function kodeUntuk(pengguna_id) {
    const ada = kodeTampil.get(pengguna_id);
    if (ada && ada.kedaluwarsa - Date.now() > 2 * 60e3 && db.kodePasang.cek('google', K.sha256(ada.kode))) return ada;
    const kode = K.kodeAngka(6);
    db.kodePasang.buat({ jenis: 'google', kode_hash: K.sha256(kode), pengguna_id, umurMs: UMUR_KODE });
    const baru = { kode, kedaluwarsa: Date.now() + UMUR_KODE };
    kodeTampil.set(pengguna_id, baru);
    return baru;
  }

  // Memeriksa skrip: versi, akun Google, dan judul kolom Master Data. Melempar galat yang bisa dibaca orang awam.
  async function periksa({ url, rahasia, spreadsheetId, sheet }) {
    const klien = buatKlien({ url, secret: rahasia });
    let ping;
    try {
      ping = await klien.call('ping');
    } catch (err) {
      throw new Error(`Skrip tidak bisa dihubungi (${err.message}). Pastikan "Yang memiliki akses" diisi "Siapa saja", lalu deploy ulang.`);
    }
    if (String(ping.versi) !== VERSI_SKRIP) throw new Error(`Versi skrip ${ping.versi}, padahal yang dibutuhkan versi ${VERSI_SKRIP}. Salin ulang template dari dashboard.`);
    const judul = await klien.call('header', { spreadsheetId, sheet });
    const beda = HEADER.map((h, i) => ({ kolom: String.fromCharCode(65 + i), harap: h, ada: String(judul[i] || '').trim() })).filter(x => x.harap !== x.ada);
    if (beda.length) {
      throw new Error(`Judul kolom Master Data berbeda di kolom ${beda.map(b => `${b.kolom} (seharusnya "${b.harap}")`).join(', ')}. Jangan ubah baris judul.`);
    }
    return { akun: ping.akun };
  }

  // Dipanggil skrip milik pengguna. Mengembalikan { status, isi } untuk dijawab sebagai JSON.
  async function terimaPasangan(b = {}) {
    const tolak = (status, pesan) => ({ status, isi: { ok: false, pesan } });
    const kode = String(b.kode || '');
    if (!/^\d{6}$/.test(kode)) return tolak(400, 'Kode harus 6 angka.');
    const baris = db.kodePasang.cek('google', K.sha256(kode));
    if (!baris) return tolak(400, 'Kode salah atau sudah kedaluwarsa. Lihat kode terbaru di dashboard, lalu coba lagi.');
    if (!RE_URL.test(String(b.url || ''))) return tolak(400, 'Alamat Web App tidak dikenali. Buka halaman lewat tautan Aplikasi web yang berakhiran /exec.');
    if (String(b.rahasia || '').length < 32 || !RE_ID.test(String(b.spreadsheetId || '')) || !RE_ID.test(String(b.folderId || ''))) {
      return tolak(400, 'Data dari skrip tidak lengkap. Salin ulang template dari dashboard.');
    }
    const sheet = String(b.sheet || 'Master Data');
    let hasil;
    try {
      hasil = await periksa({ url: b.url, rahasia: b.rahasia, spreadsheetId: b.spreadsheetId, sheet });
    } catch (err) {
      return tolak(400, err.message);
    }
    if (!db.kodePasang.pakai('google', K.sha256(kode))) return tolak(400, 'Kode sudah dipakai. Lihat kode terbaru di dashboard.');
    db.google.simpan({
      pengguna_id: baris.pengguna_id, url_enc: K.enkripsi(b.url, kunci), rahasia_enc: K.enkripsi(b.rahasia, kunci),
      folder_induk_id: b.folderId, spreadsheet_id: b.spreadsheetId, sheet_master: sheet,
    });
    kodeTampil.delete(baris.pengguna_id);
    db.audit.catat({ pelaku_id: baris.pengguna_id, sasaran_id: baris.pengguna_id, aksi: 'google_tersambung', rincian: { akun: hasil.akun } });
    const p = db.pengguna.olehId(baris.pengguna_id);
    return { status: 200, isi: { ok: true, nama: p ? p.nama : '' } };
  }

  // Data sambungan yang sudah didekripsi, untuk membuat klien Google pengguna.
  function sambungan(pengguna_id) {
    const g = db.google.ambil(pengguna_id);
    if (!g) return null;
    return { url: K.dekripsi(g.url_enc, kunci), rahasia: K.dekripsi(g.rahasia_enc, kunci), spreadsheetId: g.spreadsheet_id,
      folderIndukId: g.folder_induk_id, sheet: g.sheet_master, tersambung: g.tersambung };
  }

  // Layanan Google (drive, sheets, gmail, calendar) milik satu pengguna, dengan bentuk yang sama seperti versi 1.
  function untukPengguna(pengguna_id) {
    const s = sambungan(pengguna_id);
    if (!s) return null;
    return { folderIndukId: s.folderIndukId, ...createGoogle({ appsScriptUrl: s.url, appsScriptSecret: s.rahasia, spreadsheetId: s.spreadsheetId, sheetMaster: s.sheet }) };
  }

  const putuskanSkrip = ({ url, rahasia }) => buatKlien({ url, secret: rahasia }).call('putus');

  return { kodeUntuk, periksa, putuskanSkrip, terimaPasangan, sambungan, untukPengguna, UMUR_KODE };
}

module.exports = { buatLayananGoogle, VERSI_SKRIP, RE_URL };
