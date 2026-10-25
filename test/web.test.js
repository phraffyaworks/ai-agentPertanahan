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
