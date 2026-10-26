// Database dashboard (SQLite bawaan Node). Semua waktu disimpan sebagai milidetik sejak epoch.
// Setiap fungsi yang membaca data milik pengguna selalu menerima pengguna_id, supaya data tidak tercampur.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Migrasi berurutan; nomor versi disimpan di PRAGMA user_version.
const MIGRASI = [
  `CREATE TABLE pengguna (
     id INTEGER PRIMARY KEY,
     email TEXT NOT NULL UNIQUE,
     nama TEXT NOT NULL,
     unit_kerja TEXT NOT NULL,
     sandi_hash TEXT NOT NULL,
     peran TEXT NOT NULL DEFAULT 'pengguna' CHECK (peran IN ('pengguna', 'admin')),
     status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'aktif', 'dibekukan', 'ditolak')),
     totp_enc TEXT,
     gagal_masuk INTEGER NOT NULL DEFAULT 0,
     terkunci_sampai INTEGER,
     dibuat INTEGER NOT NULL,
     disetujui INTEGER,
     disetujui_oleh INTEGER
   );
   CREATE TABLE sesi (
     id_hash TEXT PRIMARY KEY,
     pengguna_id INTEGER NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
     csrf TEXT NOT NULL,
     dibuat INTEGER NOT NULL,
     kedaluwarsa INTEGER NOT NULL,
     terakhir INTEGER NOT NULL,
     ip TEXT,
     perangkat TEXT
   );
   CREATE TABLE profil (
     pengguna_id INTEGER PRIMARY KEY REFERENCES pengguna(id) ON DELETE CASCADE,
     data TEXT NOT NULL,
     diubah INTEGER NOT NULL
   );
   CREATE TABLE google (
     pengguna_id INTEGER PRIMARY KEY REFERENCES pengguna(id) ON DELETE CASCADE,
     url_enc TEXT NOT NULL,
     rahasia_enc TEXT NOT NULL,
     folder_induk_id TEXT,
     spreadsheet_id TEXT,
     sheet_master TEXT NOT NULL DEFAULT 'Master Data',
     tersambung INTEGER NOT NULL
   );
   CREATE TABLE telegram (
     telegram_id INTEGER PRIMARY KEY,
     pengguna_id INTEGER NOT NULL UNIQUE REFERENCES pengguna(id) ON DELETE CASCADE,
     tersambung INTEGER NOT NULL
   );
   CREATE TABLE kode_pasang (
     jenis TEXT NOT NULL CHECK (jenis IN ('google', 'telegram', 'reset')),
     kode_hash TEXT NOT NULL,
     pengguna_id INTEGER NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
     kedaluwarsa INTEGER NOT NULL,
     dipakai INTEGER,
     PRIMARY KEY (jenis, kode_hash)
   );
   CREATE TABLE pemakaian (
     id INTEGER PRIMARY KEY,
     pengguna_id INTEGER NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
     waktu INTEGER NOT NULL,
     saluran TEXT NOT NULL,
     penyedia TEXT NOT NULL,
     model TEXT NOT NULL,
     token_masuk INTEGER NOT NULL DEFAULT 0,
     token_keluar INTEGER NOT NULL DEFAULT 0,
     token_cache_baca INTEGER NOT NULL DEFAULT 0,
     token_cache_tulis INTEGER NOT NULL DEFAULT 0,
     pencarian_web INTEGER NOT NULL DEFAULT 0,
     biaya_usd REAL NOT NULL DEFAULT 0,
     durasi_ms INTEGER,
     berhasil INTEGER NOT NULL DEFAULT 1
   );
   CREATE INDEX pemakaian_pengguna_waktu ON pemakaian (pengguna_id, waktu);
   CREATE TABLE audit (
     id INTEGER PRIMARY KEY,
     waktu INTEGER NOT NULL,
     pelaku_id INTEGER,
     sasaran_id INTEGER,
     aksi TEXT NOT NULL,
     rincian TEXT,
     ip TEXT
   );
   CREATE INDEX audit_waktu ON audit (waktu);`,
  // 2: nomor WhatsApp pengguna (untuk mengirim tautan kata sandi) dan tanda permintaan atur ulang sandi.
  `ALTER TABLE pengguna ADD COLUMN nomor_wa TEXT;
   ALTER TABLE pengguna ADD COLUMN minta_reset INTEGER;`,
];

const STATUS = ['menunggu', 'aktif', 'dibekukan', 'ditolak'];

function createDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

  const versi = db.prepare('PRAGMA user_version').get().user_version;
  MIGRASI.slice(versi).forEach((sql, i) => {
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${versi + i + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  });

  const q = sql => db.prepare(sql);
  const now = () => Date.now();

  const pengguna = {
    buat: ({ email, nama, unit_kerja, sandi_hash, peran = 'pengguna', status = 'menunggu', nomor_wa = null }) =>
      Number(q(`INSERT INTO pengguna (email, nama, unit_kerja, sandi_hash, peran, status, dibuat, nomor_wa)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(email, nama, unit_kerja, sandi_hash, peran, status, now(), nomor_wa).lastInsertRowid),
    olehEmail: email => q('SELECT * FROM pengguna WHERE email = ?').get(email),
    olehId: id => q('SELECT * FROM pengguna WHERE id = ?').get(id),
    daftar: () => q(`SELECT id, email, nama, unit_kerja, peran, status, dibuat, disetujui, nomor_wa, minta_reset FROM pengguna
                     ORDER BY CASE WHEN minta_reset IS NOT NULL THEN 0 WHEN status = 'menunggu' THEN 1 ELSE 2 END, dibuat DESC`).all(),
    ubahNomorWa: (id, nomor_wa) => q('UPDATE pengguna SET nomor_wa = ? WHERE id = ?').run(nomor_wa, id),
    // Permintaan "lupa kata sandi" dari halaman Masuk; dihapus saat super admin membuat tautan.
    tandaiMintaReset: id => q('UPDATE pengguna SET minta_reset = ? WHERE id = ?').run(now(), id),
    hapusMintaReset: id => q('UPDATE pengguna SET minta_reset = NULL WHERE id = ?').run(id),
    jumlahMintaReset: () => q('SELECT COUNT(*) AS n FROM pengguna WHERE minta_reset IS NOT NULL').get().n,
    jumlahAdmin: () => q("SELECT COUNT(*) AS n FROM pengguna WHERE peran = 'admin'").get().n,
    ubahStatus: (id, status, olehId) => {
      if (!STATUS.includes(status)) throw new Error(`Status tidak dikenal: ${status}`);
      q(`UPDATE pengguna SET status = ?, disetujui = CASE WHEN ? = 'aktif' THEN ? ELSE disetujui END,
         disetujui_oleh = CASE WHEN ? = 'aktif' THEN ? ELSE disetujui_oleh END WHERE id = ?`)
        .run(status, status, now(), status, olehId, id);
    },
    ubahSandi: (id, sandi_hash) => q('UPDATE pengguna SET sandi_hash = ?, gagal_masuk = 0, terkunci_sampai = NULL WHERE id = ?').run(sandi_hash, id),
    simpanTotp: (id, totp_enc) => q('UPDATE pengguna SET totp_enc = ? WHERE id = ?').run(totp_enc, id),
    catatGagal: (id, batas, kunciMs) => {
      const p = q('SELECT gagal_masuk FROM pengguna WHERE id = ?').get(id);
      const gagal = (p ? p.gagal_masuk : 0) + 1;
      q('UPDATE pengguna SET gagal_masuk = ?, terkunci_sampai = ? WHERE id = ?')
        .run(gagal >= batas ? 0 : gagal, gagal >= batas ? now() + kunciMs : null, id);
    },
    catatBerhasil: id => q('UPDATE pengguna SET gagal_masuk = 0, terkunci_sampai = NULL WHERE id = ?').run(id),
  };

  const sesi = {
    buat: ({ id_hash, pengguna_id, csrf, umurMs, ip, perangkat }) =>
      q(`INSERT INTO sesi (id_hash, pengguna_id, csrf, dibuat, kedaluwarsa, terakhir, ip, perangkat)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id_hash, pengguna_id, csrf, now(), now() + umurMs, now(), ip, perangkat),
    ambil: id_hash => q(`SELECT s.*, p.email, p.nama, p.peran, p.status FROM sesi s JOIN pengguna p ON p.id = s.pengguna_id
                         WHERE s.id_hash = ? AND s.kedaluwarsa > ?`).get(id_hash, now()),
    sentuh: id_hash => q('UPDATE sesi SET terakhir = ? WHERE id_hash = ?').run(now(), id_hash),
    hapus: id_hash => q('DELETE FROM sesi WHERE id_hash = ?').run(id_hash),
    hapusMilik: pengguna_id => q('DELETE FROM sesi WHERE pengguna_id = ?').run(pengguna_id),
    bersihkan: () => q('DELETE FROM sesi WHERE kedaluwarsa <= ?').run(now()),
  };

  const profil = {
    ambil: pengguna_id => {
      const r = q('SELECT data FROM profil WHERE pengguna_id = ?').get(pengguna_id);
      return r ? JSON.parse(r.data) : null;
    },
    simpan: (pengguna_id, data) => q(`INSERT INTO profil (pengguna_id, data, diubah) VALUES (?, ?, ?)
      ON CONFLICT(pengguna_id) DO UPDATE SET data = excluded.data, diubah = excluded.diubah`).run(pengguna_id, JSON.stringify(data), now()),
  };

  const kodePasang = {
    buat: ({ jenis, kode_hash, pengguna_id, umurMs }) => {
      q('DELETE FROM kode_pasang WHERE jenis = ? AND (pengguna_id = ? OR kedaluwarsa <= ?)').run(jenis, pengguna_id, now());
      q('INSERT INTO kode_pasang (jenis, kode_hash, pengguna_id, kedaluwarsa) VALUES (?, ?, ?, ?)')
        .run(jenis, kode_hash, pengguna_id, now() + umurMs);
    },
    cek: (jenis, kode_hash) => q('SELECT * FROM kode_pasang WHERE jenis = ? AND kode_hash = ? AND dipakai IS NULL AND kedaluwarsa > ?').get(jenis, kode_hash, now()),
    // Mengambil dan menandai kode terpakai dalam satu langkah; kode hanya berlaku sekali.
    pakai: (jenis, kode_hash) => {
      const r = q('SELECT * FROM kode_pasang WHERE jenis = ? AND kode_hash = ? AND dipakai IS NULL AND kedaluwarsa > ?').get(jenis, kode_hash, now());
      if (!r) return null;
      q('UPDATE kode_pasang SET dipakai = ? WHERE jenis = ? AND kode_hash = ?').run(now(), jenis, kode_hash);
      return r;
    },
  };

  // Sambungan Google per pengguna. URL dan kode rahasia disimpan terenkripsi oleh pemanggil.
  const google = {
    ambil: pengguna_id => q('SELECT * FROM google WHERE pengguna_id = ?').get(pengguna_id),
    simpan: g => q(`INSERT INTO google (pengguna_id, url_enc, rahasia_enc, folder_induk_id, spreadsheet_id, sheet_master, tersambung)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(pengguna_id) DO UPDATE SET url_enc = excluded.url_enc,
        rahasia_enc = excluded.rahasia_enc, folder_induk_id = excluded.folder_induk_id, spreadsheet_id = excluded.spreadsheet_id,
        sheet_master = excluded.sheet_master, tersambung = excluded.tersambung`)
      .run(g.pengguna_id, g.url_enc, g.rahasia_enc, g.folder_induk_id, g.spreadsheet_id, g.sheet_master || 'Master Data', now()),
    hapus: pengguna_id => q('DELETE FROM google WHERE pengguna_id = ?').run(pengguna_id),
  };

  const pemakaian = {
    catat: r => q(`INSERT INTO pemakaian (pengguna_id, waktu, saluran, penyedia, model, token_masuk, token_keluar,
        token_cache_baca, token_cache_tulis, pencarian_web, biaya_usd, durasi_ms, berhasil)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(r.pengguna_id, r.waktu ?? now(), r.saluran, r.penyedia, r.model,
      r.token_masuk || 0, r.token_keluar || 0, r.token_cache_baca || 0, r.token_cache_tulis || 0, r.pencarian_web || 0,
      r.biaya_usd || 0, r.durasi_ms ?? null, r.berhasil === false ? 0 : 1),
    jumlah: pengguna_id => q('SELECT COUNT(*) AS n FROM pemakaian WHERE pengguna_id = ?').get(pengguna_id).n,
    // Ringkasan per hari untuk satu pengguna (atau semua bila pengguna_id null), sejak waktu tertentu.
    perHari: (pengguna_id, sejak) => q(`SELECT date(waktu / 1000, 'unixepoch', '+7 hours') AS hari, model,
        SUM(token_masuk) AS token_masuk, SUM(token_keluar) AS token_keluar,
        SUM(token_cache_baca) AS token_cache_baca, SUM(token_cache_tulis) AS token_cache_tulis,
        SUM(biaya_usd) AS biaya_usd, COUNT(*) AS panggilan
      FROM pemakaian WHERE (? IS NULL OR pengguna_id = ?) AND waktu >= ?
      GROUP BY hari, model ORDER BY hari DESC, model`).all(pengguna_id, pengguna_id, sejak),
  };

  const audit = {
    catat: ({ pelaku_id = null, sasaran_id = null, aksi, rincian = null, ip = null }) =>
      q('INSERT INTO audit (waktu, pelaku_id, sasaran_id, aksi, rincian, ip) VALUES (?, ?, ?, ?, ?, ?)')
        .run(now(), pelaku_id, sasaran_id, aksi, rincian == null ? null : JSON.stringify(rincian), ip),
    terbaru: (batas = 100) => q(`SELECT a.*, p.email AS pelaku_email, s.email AS sasaran_email FROM audit a
        LEFT JOIN pengguna p ON p.id = a.pelaku_id LEFT JOIN pengguna s ON s.id = a.sasaran_id
        ORDER BY a.id DESC LIMIT ?`).all(batas),
  };

  return { db, pengguna, sesi, profil, kodePasang, google, pemakaian, audit, tutup: () => db.close() };
}

module.exports = { createDb, STATUS };
