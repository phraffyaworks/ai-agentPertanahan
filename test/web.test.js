const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const K = require('../src/web/keamanan');
const { createDb } = require('../src/web/db');
const { buatAplikasi } = require('../src/web/server');

const konfigurasi = { cookieAman: false, percayaProksi: false, kunciUtama: crypto.randomBytes(32) };

function siapkan() {
  const db = createDb(':memory:');
  const app = buatAplikasi({ db, konfigurasi });
  return { db, app };
}

// Peramban kecil untuk uji: menyimpan cookie dan mengambil token CSRF dari halaman.
function peramban(app) {
  const jar = {};
  let csrf = '';
  async function minta(method, url, form) {
    const res = await app.inject({
      method, url,
      headers: { cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
      payload: form ? new URLSearchParams(form).toString() : undefined,
    });
    for (const c of [].concat(res.headers['set-cookie'] || [])) {
      const [kv] = c.split(';');
      const [k, ...v] = kv.split('=');
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) delete jar[k]; else jar[k] = v.join('=');
    }
    const m = /name="_csrf" value="([^"]+)"/.exec(res.body);
    if (m) csrf = m[1];
    return res;
  }
  return {
    get: url => minta('GET', url),
    post: (url, form = {}) => minta('POST', url, { _csrf: csrf, ...form }),
    postTanpaCsrf: (url, form = {}) => minta('POST', url, form),
    jar,
  };
}

const DAFTAR = { nama: 'Budi Santoso', email: 'Budi@Contoh.id', unit_kerja: 'Kantor Pertanahan Kabupaten Bekasi', sandi: 'kata sandi panjang', sandi2: 'kata sandi panjang' };

async function buatAdmin(db, app) {
  db.pengguna.buat({ email: 'admin@contoh.id', nama: 'Admin', unit_kerja: 'Pusat', sandi_hash: K.hashSandi('sandi admin rahasia'), peran: 'admin', status: 'aktif' });
  const a = peramban(app);
  await a.get('/masuk');
  await a.post('/masuk', { email: 'admin@contoh.id', sandi: 'sandi admin rahasia' });
  const r = await a.get('/admin/2fa');
  const rahasia = /<span class="kode">([A-Z2-7 ]+)<\/span>/.exec(r.body)[1].replace(/ /g, '');
  const ok = await a.post('/admin/2fa', { kode: K.kodeTotp(rahasia) });
  assert.strictEqual(ok.headers.location, '/admin');
  return { a, rahasia };
}

test('keamanan: hash sandi, enkripsi, dan TOTP sesuai vektor RFC 6238', () => {
  const h = K.hashSandi('rahasia sekali');
  assert.ok(K.cocokSandi('rahasia sekali', h));
  assert.ok(!K.cocokSandi('rahasia sekalI', h));
  const kunci = crypto.randomBytes(32);
  const s = K.enkripsi('kunci-api-sk-123', kunci);
  assert.ok(!s.includes('kunci-api'));
  assert.strictEqual(K.dekripsi(s, kunci), 'kunci-api-sk-123');
  assert.throws(() => K.dekripsi(s, crypto.randomBytes(32)));
  const rahasia = K.base32(Buffer.from('12345678901234567890'));
  assert.strictEqual(rahasia, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.strictEqual(K.kodeTotp(rahasia, 59e3), '287082');
  assert.strictEqual(K.kodeTotp(rahasia, 1111111109e3), '081804');
  assert.ok(K.cekTotp(rahasia, '287082', 59e3 + 25e3));
  assert.ok(!K.cekTotp(rahasia, '287082', 59e3 + 120e3));
});

test('daftar: akun menunggu persetujuan, lalu aktif setelah disetujui super admin', async () => {
  const { db, app } = siapkan();
  const u = peramban(app);
  await u.get('/daftar');
  const r = await u.post('/daftar', DAFTAR);
  assert.strictEqual(r.statusCode, 200);
  assert.match(r.body, /menunggu persetujuan/);
  const p = db.pengguna.olehEmail('budi@contoh.id');
  assert.strictEqual(p.status, 'menunggu');
  assert.ok(!p.sandi_hash.includes('kata sandi'));

  await u.post('/masuk', { email: 'budi@contoh.id', sandi: DAFTAR.sandi });
  assert.strictEqual((await u.get('/mulai')).headers.location, '/status');
  assert.match((await u.get('/status')).body, /Menunggu persetujuan/);

  const { a } = await buatAdmin(db, app);
  assert.match((await a.get('/admin/pengguna')).body, /Budi Santoso/);
  await a.post(`/admin/pengguna/${p.id}/status`, { status: 'aktif' });
  assert.strictEqual(db.pengguna.olehId(p.id).status, 'aktif');
  const mulai = await u.get('/mulai');
  assert.strictEqual(mulai.statusCode, 200);
  assert.match(mulai.body, /Selamat datang, Budi Santoso/);
  assert.ok(db.audit.terbaru().some(x => x.aksi === 'status_aktif' && x.sasaran_id === p.id));
  await app.close();
});

test('daftar: isian salah ditunjukkan per kolom, email ganda ditolak', async () => {
  const { app } = siapkan();
  const u = peramban(app);
  await u.get('/daftar');
  const r = await u.post('/daftar', { nama: '', email: 'bukan-email', unit_kerja: 'X', sandi: 'pendek', sandi2: 'pendek' });
  assert.strictEqual(r.statusCode, 422);
  assert.match(r.body, /Alamat email tidak sah/);
  assert.match(r.body, /minimal 10 karakter/);
  await u.post('/daftar', DAFTAR);
  const v = peramban(app);
  await v.get('/daftar');
  assert.match((await v.post('/daftar', DAFTAR)).body, /sudah terdaftar/);
  await app.close();
});

test('CSRF: kiriman formulir tanpa token ditolak', async () => {
  const { db, app } = siapkan();
  const u = peramban(app);
  await u.get('/daftar');
  assert.strictEqual((await u.postTanpaCsrf('/daftar', DAFTAR)).statusCode, 403);
  assert.strictEqual(db.pengguna.olehEmail('budi@contoh.id'), undefined);
  await app.close();
});

test('masuk: lima kali salah sandi mengunci akun 15 menit', async () => {
  const { db, app } = siapkan();
  db.pengguna.buat({ email: 'c@contoh.id', nama: 'C', unit_kerja: 'U', sandi_hash: K.hashSandi('sandi yang benar'), status: 'aktif' });
  const u = peramban(app);
  await u.get('/masuk');
  for (let i = 0; i < 5; i++) assert.strictEqual((await u.post('/masuk', { email: 'c@contoh.id', sandi: 'salah sekali' })).statusCode, 401);
  const r = await u.post('/masuk', { email: 'c@contoh.id', sandi: 'sandi yang benar' });
  assert.match(r.body, /Terlalu banyak percobaan/);
  await app.close();
});

test('super admin: wajib 2FA; pengguna biasa tidak bisa membuka menu admin', async () => {
  const { db, app } = siapkan();
  const { rahasia } = await buatAdmin(db, app);
  // Masuk ulang: setelah sandi benar, kode 2FA diminta.
  const a = peramban(app);
  await a.get('/masuk');
  const r = await a.post('/masuk', { email: 'admin@contoh.id', sandi: 'sandi admin rahasia' });
  assert.strictEqual(r.headers.location, '/masuk/2fa');
  assert.strictEqual((await a.get('/admin/pengguna')).headers.location, '/masuk');
  await a.get('/masuk/2fa');
  assert.strictEqual((await a.post('/masuk/2fa', { kode: '000000' })).statusCode, 401);
  assert.strictEqual((await a.post('/masuk/2fa', { kode: K.kodeTotp(rahasia) })).headers.location, '/');
  assert.strictEqual((await a.get('/admin/pengguna')).statusCode, 200);

  db.pengguna.buat({ email: 'd@contoh.id', nama: 'D', unit_kerja: 'U', sandi_hash: K.hashSandi('sandi pengguna d'), status: 'aktif' });
  const u = peramban(app);
  await u.get('/masuk');
  await u.post('/masuk', { email: 'd@contoh.id', sandi: 'sandi pengguna d' });
  assert.strictEqual((await u.get('/admin/pengguna')).statusCode, 403);
  await app.close();
});

test('profil: NIP harus 18 angka; tersimpan per pengguna', async () => {
  const { db, app } = siapkan();
  const id = db.pengguna.buat({ email: 'e@contoh.id', nama: 'E', unit_kerja: 'U', sandi_hash: K.hashSandi('sandi pengguna e'), status: 'aktif' });
  const u = peramban(app);
  await u.get('/masuk');
  await u.post('/masuk', { email: 'e@contoh.id', sandi: 'sandi pengguna e' });
  await u.get('/profil');
  const isi = {
    pengolah_nama: 'Budi Santoso, S.H.', pengolah_nip: '19800101 2005', atasan_jabatan: 'Kepala Sub Direktorat',
    atasan_nama: 'Siti, S.H.', atasan_nip: '197505052000032002', ttd_atas_nama: '', ttd_jabatan: 'Direktur', ttd_nama: 'Ahmad, M.H.', ttd_nip: 'NIP. 19700101 199503 1 001', kota: 'Jakarta',
  };
  const salah = await u.post('/profil', isi);
  assert.strictEqual(salah.statusCode, 422);
  assert.match(salah.body, /NIP harus 18 angka; yang terisi 12 angka/);
  assert.strictEqual(db.profil.ambil(id), null);
  const ok = await u.post('/profil', { ...isi, pengolah_nip: '19800101 200501 1 001' });
  assert.strictEqual(ok.statusCode, 200);
  const p = db.profil.ambil(id);
  assert.strictEqual(p.pengolah_nip, '198001012005011001');
  assert.strictEqual(p.ttd_nip, '197001011995031001');
  assert.match((await u.get('/mulai')).body, /Isi profil penanda tangan<\/strong> <span class="lencana aktif">Selesai/);
  await app.close();
});

test('tampilan: teks pengguna di-escape dan header keamanan terpasang', async () => {
  const { db, app } = siapkan();
  db.pengguna.buat({ email: 'x@contoh.id', nama: '<script>alert(1)</script>', unit_kerja: 'U', sandi_hash: K.hashSandi('sandi pengguna x'), status: 'aktif' });
  const u = peramban(app);
  await u.get('/masuk');
  await u.post('/masuk', { email: 'x@contoh.id', sandi: 'sandi pengguna x' });
  const r = await u.get('/mulai');
  assert.ok(!r.body.includes('<script>alert(1)</script>'));
  assert.ok(r.body.includes('&lt;script&gt;'));
  assert.match(r.headers['content-security-policy'], /default-src 'none'/);
  assert.strictEqual(r.headers['x-frame-options'], 'DENY');
  assert.match(String(r.headers['set-cookie'] || '') + Object.keys(u.jar).join(','), /sid/);
  await app.close();
});

// ---------- penyambungan Google ----------
const fs = require('fs');
const { HEADER } = require('../src/google/sheets');

function skripTiruan({ versi = '3', header = HEADER, gagalKirim = null } = {}) {
  const terdaftar = new Map(); // url -> rahasia
  const email = []; // email yang dikirim lewat gmailSend
  const buatKlien = ({ url, secret }) => ({
    call: async (action, params) => {
      if (terdaftar.get(url) !== secret) throw new Error('Apps Script: Kode rahasia salah.');
      if (action === 'ping') return { versi, akun: 'budi.uji@gmail.com' };
      if (action === 'header') return header;
      if (action === 'putus') { terdaftar.delete(url); return true; }
      if (action === 'gmailSend') { if (gagalKirim) throw new Error(gagalKirim); email.push({ url, ...params }); return true; }
      throw new Error(`aksi ${action} tidak ditiru`);
    },
  });
  return { terdaftar, email, buatKlien };
}

async function penggunaAktifDenganGoogle(opsi = {}) {
  const db = createDb(':memory:');
  const tiruan = skripTiruan(opsi);
  const app = buatAplikasi({ db, konfigurasi: { ...konfigurasi, templateGoogleId: 'TEMPLATE_ID_UJI_1234567890' }, buatKlienGoogle: tiruan.buatKlien });
  const id = db.pengguna.buat({ email: 'g@contoh.id', nama: 'Gita', unit_kerja: 'U', sandi_hash: K.hashSandi('sandi pengguna g'), status: 'aktif' });
  const u = peramban(app);
  await u.get('/masuk');
  await u.post('/masuk', { email: 'g@contoh.id', sandi: 'sandi pengguna g' });
  const hal = await u.get('/google');
  const kode = /<div class="kode-besar"[^>]*>(\d{6})<\/div>/.exec(hal.body)[1];
  const url = 'https://script.google.com/macros/s/AKfycbUjiCobaPenyambunganGoogle1234/exec';
  const rahasia = 'r'.repeat(64);
  tiruan.terdaftar.set(url, rahasia);
  const kirimPasangan = isi => app.inject({ method: 'POST', url: '/api/google/pasang', payload: {
    kode, url, rahasia, spreadsheetId: 'SPREADSHEET_ID_UJI_123456789', folderId: 'FOLDER_ID_UJI_1234567890', sheet: 'Master Data', ...isi } });
  return { db, app, u, id, kode, url, hal, kirimPasangan };
}

test('Google: halaman menampilkan kode 6 angka dan tautan salin template', async () => {
  const { app, hal, u, kode } = await penggunaAktifDenganGoogle();
  assert.match(hal.body, /https:\/\/docs\.google\.com\/spreadsheets\/d\/TEMPLATE_ID_UJI_1234567890\/copy/);
  assert.match(hal.body, /Yang memiliki akses/);
  // Memuat ulang halaman tidak mengganti kode yang masih berlaku.
  assert.ok((await u.get('/google')).body.includes(`>${kode}</div>`));
  assert.deepStrictEqual(JSON.parse((await u.get('/google/status')).body), { tersambung: false });
  await app.close();
});

test('Google: pasangan dari skrip diterima, diperiksa balik, dan disimpan terenkripsi', async () => {
  const { db, app, u, id, url, kirimPasangan } = await penggunaAktifDenganGoogle();
  assert.strictEqual((await kirimPasangan({ kode: '000000' })).statusCode, 400);
  const r = await kirimPasangan();
  assert.strictEqual(r.statusCode, 200, r.body);
  assert.deepStrictEqual(JSON.parse(r.body), { ok: true, nama: 'Gita' });
  const g = db.google.ambil(id);
  assert.ok(g && !g.url_enc.includes('script.google.com') && !g.rahasia_enc.includes('rrrr'));
  assert.strictEqual(g.spreadsheet_id, 'SPREADSHEET_ID_UJI_123456789');
  assert.deepStrictEqual(JSON.parse((await u.get('/google/status')).body), { tersambung: true });
  assert.match((await u.get('/google')).body, /Google tersambung/);
  assert.match((await u.get('/mulai')).body, /Hubungkan Google Drive dan Spreadsheet<\/strong> <span class="lencana aktif">Selesai/);
  // Kode hanya berlaku sekali.
  assert.strictEqual((await kirimPasangan()).statusCode, 400);
  assert.match((await u.post('/google/periksa')).body, /Sambungan baik\. Akun Google: budi\.uji@gmail\.com/);
  assert.ok(db.audit.terbaru().some(a => a.aksi === 'google_tersambung'));
  // Putuskan: skrip ikut dihapus kode rahasianya, lalu bisa disambungkan lagi dengan kode baru.
  const putus = await u.post('/google/putus');
  assert.match(putus.body, /Sambungan Google diputus\. Untuk menyambungkan lagi/);
  assert.strictEqual(db.google.ambil(id), undefined);
  const kodeBaru = /<div class="kode-besar"[^>]*>(\d{6})<\/div>/.exec(putus.body)[1];
  assert.ok(kodeBaru);
  assert.strictEqual(url.endsWith('/exec'), true);
  await app.close();
});

test('Google: skrip versi lama, judul kolom berubah, atau alamat /dev ditolak dengan pesan yang jelas', async () => {
  let t = await penggunaAktifDenganGoogle({ versi: '2' });
  assert.match(JSON.parse((await t.kirimPasangan()).body).pesan, /Versi skrip 2, padahal yang dibutuhkan versi 3/);
  await t.app.close();
  t = await penggunaAktifDenganGoogle({ header: HEADER.map((h, i) => (i === 6 ? 'No Surat' : h)) });
  assert.match(JSON.parse((await t.kirimPasangan()).body).pesan, /kolom G \(seharusnya "Nomor Surat"\)/);
  assert.strictEqual(t.db.google.ambil(t.id), undefined);
  await t.app.close();
  t = await penggunaAktifDenganGoogle();
  assert.match(JSON.parse((await t.kirimPasangan({ url: 'https://script.google.com/macros/s/AKfycbUjiCobaPenyambunganGoogle1234/dev' })).body).pesan, /berakhiran \/exec/);
  await t.app.close();
});

test('Google: judul kolom di template Apps Script sama dengan Master Data', () => {
  const kodeGs = fs.readFileSync(require('path').join(__dirname, '..', 'apps-script', 'template', 'Kode.gs'), 'utf8');
  const daftar = /var HEADER = \[([\s\S]*?)\];/.exec(kodeGs)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
  assert.deepStrictEqual(daftar, HEADER);
  assert.match(kodeGs, /var VERSI = '3';/);
});

// ---------- lupa kata sandi ----------
test('lupa sandi: super admin membuat tautan sekali pakai; pengguna membuat sandi baru sendiri', async () => {
  const { db, app } = siapkan();
  const id = db.pengguna.buat({ email: 'lupa@contoh.id', nama: 'Lupa', unit_kerja: 'U', sandi_hash: K.hashSandi('sandi lama sekali'), status: 'aktif' });
  const u = peramban(app);
  await u.get('/masuk');
  await u.post('/masuk', { email: 'lupa@contoh.id', sandi: 'sandi lama sekali' });
  assert.strictEqual((await u.get('/mulai')).statusCode, 200);
  // Pengguna biasa tidak bisa membuat tautan.
  assert.strictEqual((await u.post(`/admin/pengguna/${id}/reset-sandi`)).statusCode, 403);

  const { a } = await buatAdmin(db, app);
  await a.get('/admin/pengguna');
  const r = await a.post(`/admin/pengguna/${id}/reset-sandi`);
  assert.strictEqual(r.statusCode, 200);
  const tautan = /\/atur-sandi\/([\w-]+)/.exec(r.body)[0];
  assert.ok(db.audit.terbaru().some(x => x.aksi === 'reset_sandi_dibuat' && x.sasaran_id === id));

  const tamu = peramban(app);
  assert.match((await tamu.get(tautan)).body, /Untuk akun <strong>Lupa<\/strong>/);
  assert.strictEqual((await tamu.post(tautan, { sandi: 'pendek', sandi2: 'pendek' })).statusCode, 422);
  const ok = await tamu.post(tautan, { sandi: 'sandi baru yang panjang', sandi2: 'sandi baru yang panjang' });
  assert.match(ok.body, /Kata sandi baru tersimpan/);
  // Sesi lama keluar, sandi lama tidak berlaku, tautan tidak bisa dipakai lagi.
  assert.strictEqual((await u.get('/mulai')).headers.location, '/masuk');
  const v = peramban(app);
  await v.get('/masuk');
  assert.strictEqual((await v.post('/masuk', { email: 'lupa@contoh.id', sandi: 'sandi lama sekali' })).statusCode, 401);
  assert.strictEqual((await v.post('/masuk', { email: 'lupa@contoh.id', sandi: 'sandi baru yang panjang' })).headers.location, '/');
  assert.strictEqual((await peramban(app).get(tautan)).statusCode, 404);
  assert.strictEqual((await peramban(app).get('/atur-sandi/tautan-palsu-yang-tidak-pernah-dibuat-oleh-siapa-pun-123')).statusCode, 404);
  await app.close();
});

test('lupa sandi: tautan lama gugur saat tautan baru dibuat, dan kedaluwarsa setelah 24 jam', async () => {
  const { db, app } = siapkan();
  const id = db.pengguna.buat({ email: 'k@contoh.id', nama: 'K', unit_kerja: 'U', sandi_hash: K.hashSandi('sandi lama sekali'), status: 'aktif' });
  const { a } = await buatAdmin(db, app);
  await a.get('/admin/pengguna');
  const t1 = /\/atur-sandi\/([\w-]+)/.exec((await a.post(`/admin/pengguna/${id}/reset-sandi`)).body)[0];
  await a.get('/admin/pengguna');
  const t2 = /\/atur-sandi\/([\w-]+)/.exec((await a.post(`/admin/pengguna/${id}/reset-sandi`)).body)[0];
  assert.strictEqual((await peramban(app).get(t1)).statusCode, 404);
  assert.strictEqual((await peramban(app).get(t2)).statusCode, 200);
  db.db.prepare("UPDATE kode_pasang SET kedaluwarsa = ? WHERE jenis = 'reset'").run(Date.now() - 1);
  assert.strictEqual((await peramban(app).get(t2)).statusCode, 404);
  await app.close();
});

// Menyambungkan Google satu akun langsung di database (tanpa alur kode 6 angka).
function sambungkanGoogle(db, tiruan, pengguna_id) {
  const url = `https://script.google.com/macros/s/AKfycbSkripPengguna${pengguna_id}xxxxxxxxxxxx/exec`, rahasia = 's'.repeat(64);
  tiruan.terdaftar.set(url, rahasia);
  db.google.simpan({ pengguna_id, url_enc: K.enkripsi(url, konfigurasi.kunciUtama), rahasia_enc: K.enkripsi(rahasia, konfigurasi.kunciUtama),
    folder_induk_id: 'FOLDER_ID_UJI_1234567890', spreadsheet_id: 'SPREADSHEET_ID_UJI_123456789' });
  return url;
}
async function sampai(syarat, batasMs = 3000) {
  const akhir = Date.now() + batasMs;
  while (!syarat()) {
    if (Date.now() > akhir) throw new Error('Kondisi tidak tercapai');
    await new Promise(r => setTimeout(r, 10));
  }
}

test('lupa sandi: tautan dikirim otomatis ke email terdaftar lewat Gmail super admin, berlaku 1 jam', async () => {
  const db = createDb(':memory:');
  const tiruan = skripTiruan();
  const app = buatAplikasi({ db, konfigurasi, buatKlienGoogle: tiruan.buatKlien });
  const u = peramban(app);
  await u.get('/daftar');
  await u.post('/daftar', DAFTAR);
  const p = db.pengguna.olehEmail('budi@contoh.id');
  db.pengguna.ubahStatus(p.id, 'aktif', null);
  const { a } = await buatAdmin(db, app);
  const urlAdmin = sambungkanGoogle(db, tiruan, db.pengguna.olehEmail('admin@contoh.id').id);

  // Jawaban sama untuk email terdaftar maupun tidak.
  const tamu = peramban(app);
  await tamu.get('/lupa-sandi');
  const r1 = await tamu.post('/lupa-sandi', { email: 'tidak.ada@contoh.id' });
  const r2 = await tamu.post('/lupa-sandi', { email: 'Budi@Contoh.id' });
  assert.match(r1.body, /tautan untuk membuat kata sandi baru sudah dikirim ke email tersebut/);
  assert.match(r1.body, /berjudul <strong>Kata sandi baru Agen Pertanahan<\/strong>/);
  assert.strictEqual(r1.body.replace(/value="[^"]*"/g, ''), r2.body.replace(/value="[^"]*"/g, ''));
  await sampai(() => tiruan.email.length === 1);
  const m = tiruan.email[0];
  assert.strictEqual(m.url, urlAdmin);
  assert.strictEqual(m.to, 'budi@contoh.id');
  assert.strictEqual(m.subject, 'Kata sandi baru Agen Pertanahan');
  assert.match(m.body, /^Halo Budi Santoso,/);
  const tautan = /\/atur-sandi\/[\w-]+/.exec(m.body)[0];
  const kode = db.db.prepare("SELECT kedaluwarsa FROM kode_pasang WHERE jenis = 'reset'").get();
  assert.ok(Math.abs(kode.kedaluwarsa - (Date.now() + 3600e3)) < 60e3);
  await sampai(() => db.audit.terbaru().some(x => x.aksi === 'reset_email_terkirim' && x.sasaran_id === p.id));
  assert.strictEqual(db.pengguna.olehId(p.id).minta_reset, null);

  // Permintaan ulang dalam 10 menit tidak mengirim email lagi.
  await tamu.post('/lupa-sandi', { email: 'budi@contoh.id' });
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(tiruan.email.length, 1);

  const ok = await tamu.post(tautan, { sandi: 'sandi baru yang panjang', sandi2: 'sandi baru yang panjang' });
  assert.match(ok.body, /Kata sandi baru tersimpan/);

  // Super admin: keterangan pengirim, email uji, dan kirim tautan dari daftar pengguna.
  const hal = await a.get('/admin/pengguna');
  assert.match(hal.body, /dikirim otomatis lewat Gmail yang tersambung di akun <strong>Admin<\/strong>/);
  assert.match((await a.post('/admin/uji-email')).body, /Email uji sudah dikirim ke admin@contoh\.id/);
  assert.strictEqual(tiruan.email[1].to, 'admin@contoh.id');
  await a.get('/admin/pengguna');
  const kirimUlang = await a.post(`/admin/pengguna/${p.id}/reset-sandi`);
  assert.match(kirimUlang.body, /Tautan kata sandi baru sudah dikirim ke budi@contoh\.id\. Berlaku 24 jam\./);
  assert.doesNotMatch(kirimUlang.body, /atur-sandi\//);
  assert.strictEqual(tiruan.email[2].to, 'budi@contoh.id');
  assert.ok(db.audit.terbaru().some(x => x.aksi === 'reset_sandi_dikirim' && x.sasaran_id === p.id));
  await app.close();
});

test('lupa sandi: email gagal terkirim tampil di super admin, lalu tautan dikirim manual lewat aplikasi email', async () => {
  const db = createDb(':memory:');
  const tiruan = skripTiruan({ gagalKirim: 'Apps Script: Service invoked too many times for one day: email.' });
  const app = buatAplikasi({ db, konfigurasi, buatKlienGoogle: tiruan.buatKlien });
  const id = db.pengguna.buat({ email: 'budi@contoh.id', nama: 'Budi', unit_kerja: 'U', sandi_hash: K.hashSandi('sandi lama sekali'), status: 'aktif' });
  const { a } = await buatAdmin(db, app);

  // Google super admin belum tersambung.
  assert.match((await a.get('/admin/pengguna')).body, /Email lupa kata sandi belum bisa terkirim/);
  const uji = await a.post('/admin/uji-email');
  assert.strictEqual(uji.statusCode, 502);
  assert.match(uji.body, /Google super admin belum tersambung/);
  const tamu = peramban(app);
  await tamu.get('/lupa-sandi');
  await tamu.post('/lupa-sandi', { email: 'budi@contoh.id' });
  await sampai(() => db.pengguna.olehId(id).minta_reset);
  assert.ok(db.audit.terbaru().some(x => x.aksi === 'reset_email_gagal' && x.sasaran_id === id));
  const daftar = await a.get('/admin/pengguna');
  assert.match(daftar.body, /1 permintaan kata sandi baru gagal terkirim lewat email/);
  assert.match(daftar.body, /Email sandi gagal terkirim/);
  const t = await a.post(`/admin/pengguna/${id}/reset-sandi`);
  assert.match(t.body, /Google super admin belum tersambung/);
  assert.match(t.body, /href="mailto:budi@contoh\.id\?subject=Kata%20sandi%20baru%20Agen%20Pertanahan&amp;body=[^"]*atur-sandi%2F/);
  assert.strictEqual(db.pengguna.olehId(id).minta_reset, null);
  assert.doesNotMatch((await a.get('/admin/pengguna')).body, /gagal terkirim lewat email/);

  // Google tersambung tetapi Gmail menolak: alasannya ditampilkan.
  sambungkanGoogle(db, tiruan, db.pengguna.olehEmail('admin@contoh.id').id);
  await a.get('/admin/pengguna');
  const t2 = await a.post(`/admin/pengguna/${id}/reset-sandi`);
  assert.match(t2.body, /Email otomatis gagal terkirim: Apps Script: Service invoked too many times/);
  assert.strictEqual((await peramban(app).get(/\/atur-sandi\/[\w-]+/.exec(t2.body)[0])).statusCode, 200);
  await app.close();
});

test('database: kolom nomor WhatsApp lama dihapus saat pembaruan, data akun tetap ada', () => {
  const file = require('path').join(require('os').tmpdir(), `uji-migrasi-${process.pid}-${Date.now()}.db`);
  let db = createDb(file);
  db.pengguna.buat({ email: 'lama@contoh.id', nama: 'Lama', unit_kerja: 'U', sandi_hash: 'x', status: 'aktif' });
  // Meniru database versi 2 yang masih punya nomor WhatsApp.
  db.db.exec("ALTER TABLE pengguna ADD COLUMN nomor_wa TEXT; UPDATE pengguna SET nomor_wa = '6281234567890'; PRAGMA user_version = 2;");
  db.tutup();
  db = createDb(file);
  const kolom = db.db.prepare('PRAGMA table_info(pengguna)').all().map(k => k.name);
  assert.ok(!kolom.includes('nomor_wa'));
  assert.strictEqual(db.db.prepare('PRAGMA user_version').get().user_version, 3);
  assert.strictEqual(db.pengguna.olehEmail('lama@contoh.id').nama, 'Lama');
  db.tutup();
  for (const f of [file, `${file}-wal`, `${file}-shm`]) fs.rmSync(f, { force: true });
});

// ---------- laporan pemakaian super admin ----------
const { rentangPeriode } = require('../src/web/periode');

test('periode: rentang dihitung dalam WIB, termasuk pergantian bulan dan tahun', () => {
  const kini = Date.UTC(2026, 9, 26, 2, 0); // 26 Oktober 2026 pukul 09.00 WIB
  const hari = rentangPeriode('hari-ini', kini);
  assert.strictEqual(hari.sejak, Date.UTC(2026, 9, 25, 17, 0));
  assert.strictEqual(rentangPeriode('bulan-ini', kini).sejak, Date.UTC(2026, 8, 30, 17, 0));
  const lalu = rentangPeriode('bulan-lalu', kini);
  assert.deepStrictEqual([lalu.sejak, lalu.sampai], [Date.UTC(2026, 7, 31, 17, 0), Date.UTC(2026, 8, 30, 17, 0)]);
  assert.strictEqual(lalu.keterangan, 'September 2026');
  // 1 November pukul 01.00 WIB masih 31 Oktober menurut UTC.
  assert.strictEqual(rentangPeriode('bulan-ini', Date.UTC(2026, 9, 31, 18, 0)).sejak, Date.UTC(2026, 9, 31, 17, 0));
  assert.strictEqual(rentangPeriode('bulan-lalu', Date.UTC(2027, 0, 15, 5, 0)).sejak, Date.UTC(2026, 10, 30, 17, 0));
  assert.strictEqual(rentangPeriode('tidak-dikenal', kini).kode, '30-hari');
  assert.strictEqual(rentangPeriode('7-hari', kini).sejak, kini - 7 * 24 * 3600e3);
});

test('super admin: pemakaian per pengguna dan per model, rincian per hari; pengguna biasa ditolak', async () => {
  const { db, app } = siapkan();
  const budi = db.pengguna.buat({ email: 'budi@contoh.id', nama: 'Budi Santoso', unit_kerja: 'Subdit A', sandi_hash: K.hashSandi('sandi budi panjang'), status: 'aktif' });
  const sari = db.pengguna.buat({ email: 'sari@contoh.id', nama: 'Sari Dewi', unit_kerja: 'Subdit B', sandi_hash: K.hashSandi('sandi sari panjang'), status: 'aktif' });
  db.pengguna.buat({ email: 'tunggu@contoh.id', nama: 'Masih Menunggu', unit_kerja: 'U', sandi_hash: 'x' });
  const catat = (pengguna_id, r) => db.pemakaian.catat({ pengguna_id, saluran: 'web', penyedia: 'anthropic', model: 'claude-sonnet-5-5', ...r });
  catat(budi, { token_masuk: 1000, token_keluar: 200, token_cache_baca: 5000, token_cache_tulis: 300, biaya_usd: 0.01 });
  catat(budi, { token_masuk: 500, token_keluar: 100, pencarian_web: 2, biaya_usd: 0.03 });
  catat(sari, { model: 'claude-opus-5-5', token_masuk: 9000, token_keluar: 3000, biaya_usd: 0.5 });
  catat(budi, { token_masuk: 77777, biaya_usd: 9, waktu: Date.now() - 31 * 24 * 3600e3 }); // di luar 30 hari

  const u = peramban(app);
  await u.get('/masuk');
  await u.post('/masuk', { email: 'budi@contoh.id', sandi: 'sandi budi panjang' });
  assert.strictEqual((await u.get('/admin/pemakaian')).statusCode, 403);

  const { a } = await buatAdmin(db, app);
  const r = await a.get('/admin/pemakaian');
  assert.strictEqual(r.statusCode, 200);
  assert.match(r.body, /<strong aria-current="page">30 hari terakhir<\/strong>/);
  assert.match(r.body, /<strong>3<\/strong> panggilan · <strong>15\.800<\/strong> token masuk · <strong>3\.300<\/strong> token keluar/);
  // Urut dari biaya terbesar; pengguna yang belum disetujui dan tanpa pemakaian tidak tampil; admin aktif tampil dengan nol.
  assert.ok(r.body.indexOf('Sari Dewi') < r.body.indexOf('Budi Santoso'));
  assert.doesNotMatch(r.body, /Masih Menunggu/);
  assert.match(r.body, /admin@contoh\.id/);
  assert.doesNotMatch(r.body, /77\.777/);
  assert.match(r.body, /<td>claude-opus-5-5<\/td><td>1<\/td>/);
  assert.match(r.body, /<td>claude-sonnet-5-5<\/td><td>2<\/td>\s*<td>6\.800<\/td><td>300<\/td><td>2<\/td>/);
  assert.match(r.body, new RegExp(`href="/admin/pemakaian/${budi}\\?periode=30-hari">Rincian`));
  assert.match((await a.get('/admin/pemakaian?periode=bulan-lalu')).body, /<strong aria-current="page">Bulan lalu<\/strong>/);

  const rinci = await a.get(`/admin/pemakaian/${budi}?periode=30-hari`);
  assert.match(rinci.body, /Pemakaian: Budi Santoso/);
  assert.match(rinci.body, /<strong>2<\/strong> panggilan · <strong>6\.800<\/strong> token masuk · <strong>300<\/strong> token keluar/);
  assert.strictEqual((await a.get('/admin/pemakaian/99999')).statusCode, 404);
  assert.match((await a.get('/admin/pengguna')).body, /<a href="\/admin\/pemakaian">Pemakaian<\/a>/);
  await app.close();
});
