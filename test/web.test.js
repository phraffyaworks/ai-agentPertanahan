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

const DAFTAR = { nama: 'Budi Santoso', email: 'Budi@Contoh.id', unit_kerja: 'Kantor Pertanahan Kabupaten Bekasi', nomor_wa: '0812 3456 7890', sandi: 'kata sandi panjang', sandi2: 'kata sandi panjang' };

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

function skripTiruan({ versi = '3', header = HEADER } = {}) {
  const terdaftar = new Map(); // url -> rahasia
  const buatKlien = ({ url, secret }) => ({
    call: async (action) => {
      if (terdaftar.get(url) !== secret) throw new Error('Apps Script: Kode rahasia salah.');
      if (action === 'ping') return { versi, akun: 'budi.uji@gmail.com' };
      if (action === 'header') return header;
      if (action === 'putus') { terdaftar.delete(url); return true; }
      throw new Error(`aksi ${action} tidak ditiru`);
    },
  });
  return { terdaftar, buatKlien };
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

test('lupa sandi: permintaan dari halaman Masuk tampil di super admin; tautan dikirim lewat WhatsApp ke nomor terdaftar', async () => {
  const { db, app } = siapkan();
  const u = peramban(app);
  await u.get('/daftar');
  const salahWa = await u.post('/daftar', { ...DAFTAR, nomor_wa: '12345' });
  assert.match(salahWa.body, /Nomor WhatsApp tidak sah/);
  await u.post('/daftar', DAFTAR);
  const p = db.pengguna.olehEmail('budi@contoh.id');
  assert.strictEqual(p.nomor_wa, '6281234567890');
  db.pengguna.ubahStatus(p.id, 'aktif', null);

  // Jawaban sama untuk email terdaftar maupun tidak.
  const tamu = peramban(app);
  await tamu.get('/lupa-sandi');
  const r1 = await tamu.post('/lupa-sandi', { email: 'tidak.ada@contoh.id' });
  const r2 = await tamu.post('/lupa-sandi', { email: 'Budi@Contoh.id' });
  assert.match(r1.body, /Permintaan sudah diterima/);
  assert.strictEqual(r1.body.replace(/value="[^"]*"/g, ''), r2.body.replace(/value="[^"]*"/g, ''));
  assert.ok(db.pengguna.olehId(p.id).minta_reset);

  const { a } = await buatAdmin(db, app);
  const daftar = await a.get('/admin/pengguna');
  assert.match(daftar.body, /1 pengguna meminta kata sandi baru/);
  assert.match(daftar.body, /Minta sandi baru/);
  assert.match(daftar.body, /WA 0812-3456-7890/);
  const t = await a.post(`/admin/pengguna/${p.id}/reset-sandi`);
  assert.match(t.body, /href="https:\/\/wa\.me\/6281234567890\?text=[^"]*atur-sandi%2F/);
  assert.match(t.body, /Kirim lewat WhatsApp ke 0812-3456-7890/);
  assert.strictEqual(db.pengguna.olehId(p.id).minta_reset, null);
  assert.doesNotMatch((await a.get('/admin/pengguna')).body, /meminta kata sandi baru/);
  await app.close();
});

test('profil: nomor WhatsApp bisa diubah sendiri dan divalidasi', async () => {
  const { db, app } = siapkan();
  const id = db.pengguna.buat({ email: 'w@contoh.id', nama: 'W', unit_kerja: 'U', sandi_hash: K.hashSandi('sandi pengguna w'), status: 'aktif' });
  const u = peramban(app);
  await u.get('/masuk');
  await u.post('/masuk', { email: 'w@contoh.id', sandi: 'sandi pengguna w' });
  await u.get('/profil');
  assert.strictEqual((await u.post('/profil/kontak', { nomor_wa: '021-555' })).statusCode, 422);
  assert.match((await u.post('/profil/kontak', { nomor_wa: '+62 813 1111 2222' })).body, /Nomor WhatsApp tersimpan/);
  assert.strictEqual(db.pengguna.olehId(id).nomor_wa, '6281311112222');
  await app.close();
});
