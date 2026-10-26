// Server dashboard web (Fastify). Berjalan di belakang Caddy (HTTPS) dan hanya mendengarkan 127.0.0.1.
// Tahap 1: daftar, masuk (2FA wajib untuk super admin), persetujuan pengguna, profil, panduan mulai.
const Fastify = require('fastify');
const K = require('./keamanan');
const H = require('./halaman');
const { validasiProfil } = require('./profil');
const { buatLayananGoogle } = require('./google');

const UMUR_SESI = { pengguna: 7 * 24 * 3600e3, admin: 12 * 3600e3 };
const BATAS_GAGAL = 5, KUNCI_MS = 15 * 60e3;
const UMUR_PRA2FA = 5 * 60e3;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buatAplikasi({ db, konfigurasi, log = false, buatKlienGoogle, buatLayanan = null }) {
  const aman = konfigurasi.cookieAman;
  const NAMA_SESI = aman ? '__Host-sid' : 'sid';
  const opsiCookie = (umurMs) => ({ path: '/', httpOnly: true, sameSite: 'lax', secure: aman, ...(umurMs ? { maxAge: Math.floor(umurMs / 1000) } : {}) });
  const kunci = konfigurasi.kunciUtama;
  const pra2fa = new Map();      // token -> { pengguna_id, kedaluwarsa, percobaan }
  const siapkan2fa = new Map();  // id_hash sesi -> rahasia TOTP sementara
  const google = buatLayananGoogle({ db, kunci, ...(buatKlienGoogle ? { buatKlien: buatKlienGoogle } : {}) });
  // Layanan agen dibuat oleh pemanggil (butuh layanan Google ini); tanpa agen, menu Chat menampilkan pemberitahuan.
  const agenWeb = buatLayanan ? buatLayanan({ google }) : null;
  const templateUrl = konfigurasi.templateGoogleId ? `https://docs.google.com/spreadsheets/d/${konfigurasi.templateGoogleId}/copy` : null;

  const app = Fastify({ logger: log, trustProxy: konfigurasi.percayaProksi, bodyLimit: 1024 * 1024 });
  app.register(require('@fastify/cookie'));
  app.register(require('@fastify/formbody'));
  app.register(require('@fastify/rate-limit'), { global: false });
  app.register(require('@fastify/multipart'), { limits: { fileSize: 20 * 1024 * 1024, files: 5, fields: 5, fieldSize: 200 * 1024 } });

  // Header keamanan untuk setiap respons.
  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('Content-Security-Policy', `default-src 'none'; style-src ${H.HASH_GAYA}; script-src 'self'; connect-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    reply.header('X-Frame-Options', 'DENY');
    if (aman) reply.header('Strict-Transport-Security', 'max-age=31536000');
    if (!reply.getHeader('Cache-Control')) reply.header('Cache-Control', 'no-store');
    return payload;
  });

  // Membaca sesi dari cookie.
  app.addHook('onRequest', async req => {
    req.akun = null;
    const sid = req.cookies[NAMA_SESI];
    if (!sid) return;
    const idHash = K.sha256(sid);
    const s = db.sesi.ambil(idHash);
    if (!s) return;
    db.sesi.sentuh(idHash);
    const p = db.pengguna.olehId(s.pengguna_id);
    req.akun = { ...s, id_hash: idHash, perlu2fa: p.peran === 'admin' && !p.totp_enc };
  });

  // Token CSRF: sesudah masuk memakai token sesi; sebelum masuk memakai cookie "csrf_pra" (double submit).
  function csrfPra(req, reply) {
    let t = req.cookies.csrf_pra;
    if (!t || t.length < 20) {
      t = K.tokenAcak(24);
      reply.setCookie('csrf_pra', t, { ...opsiCookie(), sameSite: 'strict' });
    }
    return t;
  }
  const csrfOf = (req, reply) => (req.akun ? req.akun.csrf : csrfPra(req, reply));
  app.addHook('preHandler', async (req, reply) => {
    if (req.method !== 'POST' || req.routeOptions.config?.tanpaCsrf) return;
    const kiriman = (req.body && req.body._csrf) || req.headers['x-csrf-token'] || '';
    const harap = req.akun ? req.akun.csrf : req.cookies.csrf_pra;
    if (!harap || !K.samaAman(kiriman, harap)) {
      return reply.code(403).type('text/html; charset=utf-8').send(H.halamanGalat({ judul: 'Formulir kedaluwarsa', teks: 'Halaman ini sudah terlalu lama dibuka. Muat ulang halaman, lalu kirim lagi.' }));
    }
  });

  const kirim = (reply, html, kode = 200) => reply.code(kode).type('text/html; charset=utf-8').send(html);
  const ip = req => req.ip;
  const catat = (req, aksi, rincian = null, sasaran_id = null) =>
    db.audit.catat({ pelaku_id: req.akun?.pengguna_id ?? null, sasaran_id, aksi, rincian, ip: ip(req) });

  function buatSesi(req, reply, p) {
    const sid = K.tokenAcak(32);
    const umur = p.peran === 'admin' ? UMUR_SESI.admin : UMUR_SESI.pengguna;
    db.sesi.buat({ id_hash: K.sha256(sid), pengguna_id: p.id, csrf: K.tokenAcak(24), umurMs: umur, ip: ip(req), perangkat: String(req.headers['user-agent'] || '').slice(0, 200) });
    reply.setCookie(NAMA_SESI, sid, opsiCookie(umur));
    reply.clearCookie('csrf_pra', { path: '/' });
  }

  // ---------- penjaga akses ----------
  const tujuanAwal = akun => (!akun ? '/masuk' : akun.status !== 'aktif' ? '/status'
    : akun.perlu2fa ? '/admin/2fa' : akun.peran === 'admin' ? '/admin' : '/mulai');
  const perluAktif = async (req, reply) => {
    if (!req.akun) return reply.redirect('/masuk');
    if (req.akun.status !== 'aktif') return reply.redirect('/status');
    if (req.akun.perlu2fa) return reply.redirect('/admin/2fa');
  };
  const perluAdmin = async (req, reply) => {
    await perluAktif(req, reply);
    if (reply.sent) return reply;
    if (req.akun.peran !== 'admin') return kirim(reply, H.halamanGalat({ judul: 'Tidak diizinkan', teks: 'Halaman ini khusus super admin.', akun: req.akun, csrf: req.akun.csrf }), 403);
  };
  const batasKirim = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.get('/', async (req, reply) => reply.redirect(tujuanAwal(req.akun)));
  app.get('/sehat', async () => ({ ok: true }));

  // ---------- daftar ----------
  app.get('/daftar', async (req, reply) => (req.akun ? reply.redirect('/') : kirim(reply, H.halamanDaftar({ csrf: csrfPra(req, reply) }))));
  app.post('/daftar', batasKirim, async (req, reply) => {
    const b = req.body || {};
    const nilai = { nama: String(b.nama || '').trim(), email: String(b.email || '').trim().toLowerCase(), unit_kerja: String(b.unit_kerja || '').trim() };
    const salah = {};
    if (!nilai.nama) salah.nama = 'Wajib diisi.';
    if (!RE_EMAIL.test(nilai.email)) salah.email = 'Alamat email tidak sah. Contoh: budi.santoso@gmail.com';
    else if (db.pengguna.olehEmail(nilai.email)) salah.email = 'Email ini sudah terdaftar. Silakan masuk.';
    if (!nilai.unit_kerja) salah.unit_kerja = 'Wajib diisi.';
    if (String(b.sandi || '').length < K.MIN_SANDI) salah.sandi = `Kata sandi minimal ${K.MIN_SANDI} karakter.`;
    else if (b.sandi !== b.sandi2) salah.sandi2 = 'Kedua kata sandi tidak sama.';
    if (Object.values(nilai).some(v => v.length > 200)) salah.nama = salah.nama || 'Isian terlalu panjang.';
    if (Object.keys(salah).length) return kirim(reply, H.halamanDaftar({ csrf: csrfPra(req, reply), nilai, salah }), 422);

    const id = db.pengguna.buat({ ...nilai, sandi_hash: K.hashSandi(b.sandi) });
    db.audit.catat({ pelaku_id: id, sasaran_id: id, aksi: 'daftar', ip: ip(req) });
    return kirim(reply, H.halamanMasuk({ csrf: csrfPra(req, reply), nilai: { email: nilai.email },
      pesan: { jenis: 'baik', teks: 'Pendaftaran berhasil. Akun Anda menunggu persetujuan pengelola; Anda tetap bisa masuk untuk melihat statusnya.' } }));
  });

  // ---------- masuk ----------
  app.get('/masuk', async (req, reply) => (req.akun ? reply.redirect('/') : kirim(reply, H.halamanMasuk({ csrf: csrfPra(req, reply) }))));
  app.post('/masuk', batasKirim, async (req, reply) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const sandi = String(req.body?.sandi || '');
    const p = db.pengguna.olehEmail(email);
    const gagal = teks => kirim(reply, H.halamanMasuk({ csrf: csrfPra(req, reply), nilai: { email }, salah: teks }), 401);
    if (!p) { K.cocokSandi(sandi, K.HASH_PALSU); return gagal('Email atau kata sandi salah.'); }
    if (p.terkunci_sampai && p.terkunci_sampai > Date.now()) {
      return gagal(`Terlalu banyak percobaan. Coba lagi setelah ${Math.ceil((p.terkunci_sampai - Date.now()) / 60e3)} menit.`);
    }
    if (!K.cocokSandi(sandi, p.sandi_hash)) {
      db.pengguna.catatGagal(p.id, BATAS_GAGAL, KUNCI_MS);
      db.audit.catat({ sasaran_id: p.id, aksi: 'masuk_gagal', ip: ip(req) });
      return gagal('Email atau kata sandi salah.');
    }
    db.pengguna.catatBerhasil(p.id);
    if (p.peran === 'admin' && p.totp_enc) {
      const t = K.tokenAcak(24);
      pra2fa.set(t, { pengguna_id: p.id, kedaluwarsa: Date.now() + UMUR_PRA2FA, percobaan: 0 });
      reply.setCookie('pra2fa', t, { ...opsiCookie(UMUR_PRA2FA), sameSite: 'strict' });
      return reply.redirect('/masuk/2fa', 303);
    }
    buatSesi(req, reply, p);
    db.audit.catat({ pelaku_id: p.id, sasaran_id: p.id, aksi: 'masuk', ip: ip(req) });
    return reply.redirect('/', 303);
  });

  app.get('/masuk/2fa', async (req, reply) => {
    const t = pra2fa.get(req.cookies.pra2fa || '');
    if (!t || t.kedaluwarsa < Date.now()) return reply.redirect('/masuk');
    return kirim(reply, H.halamanKode2fa({ csrf: csrfPra(req, reply) }));
  });
  app.post('/masuk/2fa', batasKirim, async (req, reply) => {
    const token = req.cookies.pra2fa || '';
    const t = pra2fa.get(token);
    if (!t || t.kedaluwarsa < Date.now()) { pra2fa.delete(token); return reply.redirect('/masuk', 303); }
    const p = db.pengguna.olehId(t.pengguna_id);
    if (!K.cekTotp(K.dekripsi(p.totp_enc, kunci), req.body?.kode)) {
      if (++t.percobaan >= BATAS_GAGAL) { pra2fa.delete(token); db.pengguna.catatGagal(p.id, 1, KUNCI_MS); return reply.redirect('/masuk', 303); }
      return kirim(reply, H.halamanKode2fa({ csrf: csrfPra(req, reply), salah: 'Kode salah atau sudah kedaluwarsa. Ketik kode terbaru dari aplikasi.' }), 401);
    }
    pra2fa.delete(token);
    reply.clearCookie('pra2fa', { path: '/' });
    buatSesi(req, reply, p);
    db.audit.catat({ pelaku_id: p.id, sasaran_id: p.id, aksi: 'masuk', rincian: { dua_langkah: true }, ip: ip(req) });
    return reply.redirect('/', 303);
  });

  app.post('/keluar', async (req, reply) => {
    if (req.akun) { db.sesi.hapus(req.akun.id_hash); catat(req, 'keluar'); }
    reply.clearCookie(NAMA_SESI, { path: '/' });
    return reply.redirect('/masuk', 303);
  });

  app.get('/status', async (req, reply) => {
    if (!req.akun) return reply.redirect('/masuk');
    if (req.akun.status === 'aktif') return reply.redirect('/');
    return kirim(reply, H.halamanStatus({ akun: req.akun, csrf: req.akun.csrf }));
  });

  // ---------- panduan mulai ----------
  app.get('/mulai', { preHandler: perluAktif }, async (req, reply) => {
    const id = req.akun.pengguna_id;
    const langkah = [
      { judul: 'Akun disetujui', keterangan: 'Akun Anda sudah aktif.', selesai: true },
      { judul: 'Isi profil penanda tangan', keterangan: 'Nama dan NIP yang akan tercetak di Telaahan Staf, Notula, dan surat.', selesai: !!db.profil.ambil(id), tautan: '/profil', tombol: 'Isi profil' },
      { judul: 'Hubungkan Google Drive dan Spreadsheet', keterangan: 'Supaya agen bisa menyimpan berkas dan mencatat Master Data di akun Google Anda sendiri.', selesai: !!db.google.ambil(id), tautan: '/google', tombol: 'Hubungkan Google' },
      { judul: 'Hubungkan Telegram', keterangan: 'Supaya Anda juga bisa memakai agen lewat Telegram.', selesai: false, segera: true },
      { judul: 'Pilih model AI', keterangan: 'Sementara memakai Claude Sonnet 5.5. Pilihan model lain menyusul.', selesai: true },
      { judul: 'Uji coba', keterangan: 'Buka Chat, sapa agen atau kirim satu PDF pengaduan, lalu tekan Tolak pada tombol persetujuan bila hanya mencoba.', selesai: db.pemakaian.jumlah(id) > 0, tautan: '/chat', tombol: 'Buka Chat' },
    ];
    return kirim(reply, H.halamanMulai({ akun: req.akun, csrf: req.akun.csrf, langkah }));
  });

  // ---------- profil ----------
  app.get('/profil', { preHandler: perluAktif }, async (req, reply) =>
    kirim(reply, H.halamanProfil({ akun: req.akun, csrf: req.akun.csrf, nilai: db.profil.ambil(req.akun.pengguna_id) || { kota: 'Jakarta' } })));
  app.post('/profil', { preHandler: perluAktif }, async (req, reply) => {
    const { data, salah } = validasiProfil(req.body || {});
    if (Object.keys(salah).length) return kirim(reply, H.halamanProfil({ akun: req.akun, csrf: req.akun.csrf, nilai: data, salah }), 422);
    db.profil.simpan(req.akun.pengguna_id, data);
    catat(req, 'profil_disimpan');
    return kirim(reply, H.halamanProfil({ akun: req.akun, csrf: req.akun.csrf, nilai: data, pesan: { jenis: 'baik', teks: 'Profil tersimpan.' } }));
  });


  // ---------- hubungkan Google ----------
  const halGoogle = (req, pesan = null, kode = 200) => {
    const id = req.akun.pengguna_id;
    const s = db.google.ambil(id) ? google.sambungan(id) : null;
    return { kode, html: H.halamanGoogle({ akun: req.akun, csrf: req.akun.csrf, sambungan: s, templateUrl, pesan,
      kode: s || !templateUrl ? null : google.kodeUntuk(id) }) };
  };
  app.get('/google', { preHandler: perluAktif }, async (req, reply) => { const h = halGoogle(req); return kirim(reply, h.html, h.kode); });
  app.get('/google/status', { preHandler: perluAktif }, async req => ({ tersambung: !!db.google.ambil(req.akun.pengguna_id) }));
  app.post('/google/periksa', { preHandler: perluAktif }, async (req, reply) => {
    const s = google.sambungan(req.akun.pengguna_id);
    if (!s) return reply.redirect('/google', 303);
    try {
      const r = await google.periksa(s);
      const h = halGoogle(req, { jenis: 'baik', teks: `Sambungan baik. Akun Google: ${r.akun}.` });
      return kirim(reply, h.html);
    } catch (err) {
      const h = halGoogle(req, { jenis: 'buruk', teks: err.message });
      return kirim(reply, h.html);
    }
  });
  app.post('/google/putus', { preHandler: perluAktif }, async (req, reply) => {
    const s = google.sambungan(req.akun.pengguna_id);
    // Minta skrip menghapus kode rahasianya juga, supaya bisa langsung disambungkan lagi dengan kode baru.
    let skripIkut = false;
    if (s) { try { await google.putuskanSkrip(s); skripIkut = true; } catch { skripIkut = false; } }
    db.google.hapus(req.akun.pengguna_id);
    catat(req, 'google_diputus', { skrip_ikut: skripIkut });
    const teks = skripIkut
      ? 'Sambungan Google diputus. Untuk menyambungkan lagi: buka tautan Aplikasi web (Apps Script → Terapkan → Kelola deployment), lalu ketik kode baru di bawah.'
      : 'Sambungan diputus di dashboard. Skrip di spreadsheet tidak bisa dihubungi, jadi sebelum menyambungkan lagi buka spreadsheet Anda, menu Agen Pertanahan → Putuskan sambungan.';
    const h = halGoogle(req, { jenis: 'info', teks });
    return kirim(reply, h.html);
  });
  // Dipanggil skrip Apps Script milik pengguna (bukan peramban), jadi tanpa cookie dan tanpa CSRF.
  app.post('/api/google/pasang', { config: { tanpaCsrf: true, rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const r = await google.terimaPasangan(req.body || {});
    return reply.code(r.status).send(r.isi);
  });
  const ASET = Object.fromEntries(['chat.js', 'tunggu-google.js'].map(n => [n, require('fs').readFileSync(require('path').join(__dirname, 'aset', n), 'utf8')]));
  app.get('/aset/:nama', async (req, reply) => {
    const isi = ASET[req.params.nama];
    if (!isi) return reply.callNotFound();
    return reply.type('application/javascript; charset=utf-8').header('Cache-Control', 'no-cache').send(isi);
  });


  // ---------- chat ----------
  const perluAgen = async (req, reply) => {
    await perluAktif(req, reply);
    if (reply.sent) return reply;
    if (!agenWeb) return kirim(reply, H.halamanGalat({ judul: 'Agen belum siap', teks: 'Pengelola belum memasang kunci Claude API untuk dashboard. Coba lagi nanti.', akun: req.akun, csrf: req.akun.csrf }), 503);
  };
  // Satu kejadian transkrip menjadi potongan HTML untuk peramban.
  const keTampil = (id, x) => (x.jenis === 'keputusan'
    ? { jenis: 'ganti', id: x.id, target: `s${x.untuk}`, html: H.renderPersetujuan(agenWeb.cariEntri(id, x.untuk) || { id: x.untuk, ringkasan: '' }, { keputusan: x }) }
    : { jenis: 'tambah', id: x.id, html: H.renderEntri(x, { menunggu: x.jenis === 'persetujuan' && agenWeb.masihMenunggu(id, x.id) }) });

  app.get('/chat', { preHandler: perluAgen }, async (req, reply) => {
    const t = agenWeb.tampilan(req.akun.pengguna_id);
    return kirim(reply, H.halamanChat({ akun: req.akun, csrf: req.akun.csrf, ...t }));
  });
  app.get('/chat/aliran', { preHandler: perluAgen }, async (req, reply) => {
    const id = req.akun.pengguna_id;
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' });
    // Header dan baris pertama dikirim segera; tanpa ini peramban baru tersambung saat ada data pertama.
    res.write('retry: 3000\n: tersambung\n\n');
    const kirimSse = obj => res.write(`data: ${JSON.stringify(obj)}

`);
    for (const x of agenWeb.entriSejak(id, req.query.sejak)) kirimSse(keTampil(id, x));
    const lepas = agenWeb.berlangganan(id, p => kirimSse(p.jenis === 'status' ? p : keTampil(id, p.entri)));
    const detak = setInterval(() => res.write(': detak\n\n'), 25000);
    res.on('close', () => { clearInterval(detak); lepas(); });
  });
  app.post('/chat/pesan', { preHandler: perluAgen }, async (req, reply) => {
    let teks = '';
    const berkas = [];
    try {
      for await (const part of req.parts()) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          if (buffer.length) berkas.push({ buffer, nama: part.filename || 'berkas', mime: part.mimetype || 'application/octet-stream' });
        } else if (part.fieldname === 'teks') {
          teks = String(part.value || '');
        }
      }
    } catch (err) {
      if (err.code === 'FST_REQ_FILE_TOO_LARGE') return reply.code(413).send({ ok: false, pesan: 'Berkas lebih dari 20 MB. Kecilkan ukurannya, lalu kirim lagi.' });
      if (err.code === 'FST_FILES_LIMIT') return reply.code(413).send({ ok: false, pesan: 'Paling banyak 5 berkas sekali kirim.' });
      throw err;
    }
    if (!teks.trim() && !berkas.length) return reply.code(400).send({ ok: false, pesan: 'Pesan kosong.' });
    await agenWeb.kirimPesan(req.akun.pengguna_id, { teks, berkas, saluran: 'web' });
    return { ok: true };
  });
  app.post('/chat/setuju/:id', { preHandler: perluAgen }, async req =>
    ({ ok: agenWeb.putuskan(req.akun.pengguna_id, req.params.id, req.body?.setuju === true) }));
  app.post('/chat/baru', { preHandler: perluAgen }, async (req, reply) => {
    if (!agenWeb.percakapanBaru(req.akun.pengguna_id)) {
      return kirim(reply, H.halamanGalat({ judul: 'Agen sedang bekerja', teks: 'Tunggu sampai agen selesai, lalu tekan Percakapan baru lagi.', akun: req.akun, csrf: req.akun.csrf }), 409);
    }
    catat(req, 'percakapan_baru');
    return reply.redirect('/chat', 303);
  });
  app.get('/unduh/:id', { preHandler: perluAgen }, async (req, reply) => {
    const id = req.akun.pengguna_id;
    const file = agenWeb.fileKeluaran(id, req.params.id);
    if (!file) return reply.callNotFound();
    const nama = agenWeb.namaKeluaran(id, req.params.id) || `${req.params.id}.docx`;
    return reply.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      .header('Content-Disposition', `attachment; filename="dokumen.docx"; filename*=UTF-8''${encodeURIComponent(nama)}`)
      .send(require('fs').createReadStream(file));
  });

  // ---------- pemakaian ----------
  app.get('/pemakaian', { preHandler: perluAktif }, async (req, reply) =>
    kirim(reply, H.halamanPemakaian({ akun: req.akun, csrf: req.akun.csrf, baris: db.pemakaian.perHari(req.akun.pengguna_id, Date.now() - 30 * 24 * 3600e3) })));


  // ---------- lupa kata sandi ----------
  // Super admin membuat tautan sekali pakai (berlaku 24 jam); pengguna membuat kata sandi barunya sendiri.
  const UMUR_RESET = 24 * 3600e3;
  const alamatDasar = req => konfigurasi.alamat || `${req.protocol}://${req.headers.host}`;
  app.post('/admin/pengguna/:id/reset-sandi', { preHandler: perluAdmin }, async (req, reply) => {
    const sasaran = db.pengguna.olehId(Number(req.params.id));
    if (!sasaran || sasaran.peran === 'admin' || sasaran.status !== 'aktif') {
      return kirim(reply, H.halamanAdminPengguna({ akun: req.akun, csrf: req.akun.csrf, daftar: db.pengguna.daftar(),
        pesan: { jenis: 'buruk', teks: 'Tautan kata sandi hanya bisa dibuat untuk pengguna aktif. Untuk akun super admin, pakai npm run atur-sandi di VPS.' } }), 400);
    }
    const token = K.tokenAcak(32);
    db.kodePasang.buat({ jenis: 'reset', kode_hash: K.sha256(token), pengguna_id: sasaran.id, umurMs: UMUR_RESET });
    catat(req, 'reset_sandi_dibuat', null, sasaran.id);
    return kirim(reply, H.halamanTautanReset({ akun: req.akun, csrf: req.akun.csrf, pengguna: sasaran,
      tautan: `${alamatDasar(req)}/atur-sandi/${token}`, kedaluwarsa: Date.now() + UMUR_RESET }));
  });
  const ambilReset = token => {
    const r = /^[\w-]{40,}$/.test(String(token || '')) ? db.kodePasang.cek('reset', K.sha256(token)) : null;
    return r ? { r, p: db.pengguna.olehId(r.pengguna_id) } : null;
  };
  const GALAT_RESET = 'Tautan ini salah, sudah dipakai, atau sudah kedaluwarsa. Minta tautan baru kepada super admin.';
  app.get('/atur-sandi/:token', async (req, reply) => {
    const x = ambilReset(req.params.token);
    return kirim(reply, H.halamanAturSandi({ csrf: csrfOf(req, reply), nama: x?.p.nama, galat: x ? null : GALAT_RESET }), x ? 200 : 404);
  });
  app.post('/atur-sandi/:token', batasKirim, async (req, reply) => {
    const x = ambilReset(req.params.token);
    if (!x) return kirim(reply, H.halamanAturSandi({ csrf: csrfOf(req, reply), galat: GALAT_RESET }), 404);
    const sandi = String(req.body?.sandi || ''), salah = {};
    if (sandi.length < K.MIN_SANDI) salah.sandi = `Kata sandi minimal ${K.MIN_SANDI} karakter.`;
    else if (sandi !== req.body?.sandi2) salah.sandi2 = 'Kedua kata sandi tidak sama.';
    if (Object.keys(salah).length) return kirim(reply, H.halamanAturSandi({ csrf: csrfOf(req, reply), nama: x.p.nama, salah }), 422);
    if (!db.kodePasang.pakai('reset', K.sha256(req.params.token))) return kirim(reply, H.halamanAturSandi({ csrf: csrfOf(req, reply), galat: GALAT_RESET }), 404);
    db.pengguna.ubahSandi(x.p.id, K.hashSandi(sandi));
    db.sesi.hapusMilik(x.p.id);
    db.audit.catat({ pelaku_id: x.p.id, sasaran_id: x.p.id, aksi: 'sandi_diganti', ip: ip(req) });
    if (req.akun) reply.clearCookie(NAMA_SESI, { path: '/' });
    return kirim(reply, H.halamanMasuk({ csrf: csrfPra(req, reply), nilai: { email: x.p.email },
      pesan: { jenis: 'baik', teks: 'Kata sandi baru tersimpan. Silakan masuk dengan kata sandi baru.' } }));
  });

  // ---------- super admin ----------
  app.get('/admin', { preHandler: perluAdmin }, async (req, reply) => reply.redirect('/admin/pengguna'));
  app.get('/admin/pengguna', { preHandler: perluAdmin }, async (req, reply) =>
    kirim(reply, H.halamanAdminPengguna({ akun: req.akun, csrf: req.akun.csrf, daftar: db.pengguna.daftar() })));
  app.post('/admin/pengguna/:id/status', { preHandler: perluAdmin }, async (req, reply) => {
    const sasaran = db.pengguna.olehId(Number(req.params.id));
    const status = String(req.body?.status || '');
    const tampil = (pesan, kode = 200) => kirim(reply, H.halamanAdminPengguna({ akun: req.akun, csrf: req.akun.csrf, daftar: db.pengguna.daftar(), pesan }), kode);
    if (!sasaran) return tampil({ jenis: 'buruk', teks: 'Pengguna tidak ditemukan.' }, 404);
    if (sasaran.peran === 'admin') return tampil({ jenis: 'buruk', teks: 'Status super admin tidak bisa diubah dari sini.' }, 400);
    if (!['aktif', 'dibekukan', 'ditolak'].includes(status)) return tampil({ jenis: 'buruk', teks: 'Tindakan tidak dikenal.' }, 400);
    db.pengguna.ubahStatus(sasaran.id, status, req.akun.pengguna_id);
    if (status !== 'aktif') db.sesi.hapusMilik(sasaran.id);
    catat(req, `status_${status}`, null, sasaran.id);
    const teks = { aktif: 'disetujui', dibekukan: 'dibekukan', ditolak: 'ditolak' }[status];
    return tampil({ jenis: 'baik', teks: `${sasaran.nama} ${teks}.` });
  });
  app.get('/admin/audit', { preHandler: perluAdmin }, async (req, reply) =>
    kirim(reply, H.halamanAudit({ akun: req.akun, csrf: req.akun.csrf, daftar: db.audit.terbaru(200) })));

  // Penyiapan 2FA super admin; wajib sebelum menu admin bisa dibuka.
  const perluAdmin2fa = async (req, reply) => {
    if (!req.akun) return reply.redirect('/masuk');
    if (req.akun.peran !== 'admin' || req.akun.status !== 'aktif') return reply.redirect('/');
  };
  app.get('/admin/2fa', { preHandler: perluAdmin2fa }, async (req, reply) => {
    if (!req.akun.perlu2fa) return reply.redirect('/admin');
    if (!siapkan2fa.has(req.akun.id_hash)) siapkan2fa.set(req.akun.id_hash, K.rahasiaTotp());
    const rahasia = siapkan2fa.get(req.akun.id_hash);
    return kirim(reply, H.halamanAdmin2fa({ akun: req.akun, csrf: req.akun.csrf, rahasia, uri: K.uriTotp(rahasia, req.akun.email) }));
  });
  app.post('/admin/2fa', { preHandler: perluAdmin2fa, ...batasKirim }, async (req, reply) => {
    if (!req.akun.perlu2fa) return reply.redirect('/admin', 303);
    const rahasia = siapkan2fa.get(req.akun.id_hash);
    if (!rahasia) return reply.redirect('/admin/2fa', 303);
    if (!K.cekTotp(rahasia, req.body?.kode)) {
      return kirim(reply, H.halamanAdmin2fa({ akun: req.akun, csrf: req.akun.csrf, rahasia, uri: K.uriTotp(rahasia, req.akun.email),
        salah: 'Kode belum cocok. Pastikan kunci diketik tanpa salah dan jam ponsel sudah benar, lalu ketik kode terbaru.' }), 401);
    }
    db.pengguna.simpanTotp(req.akun.pengguna_id, K.enkripsi(rahasia, kunci));
    siapkan2fa.delete(req.akun.id_hash);
    catat(req, '2fa_aktif');
    return reply.redirect('/admin', 303);
  });

  app.setNotFoundHandler((req, reply) => kirim(reply, H.halamanGalat({ judul: 'Halaman tidak ditemukan', teks: 'Alamat yang Anda buka tidak ada.', akun: req.akun, csrf: req.akun?.csrf }), 404));
  app.setErrorHandler((err, req, reply) => {
    if (err.statusCode === 429) return kirim(reply, H.halamanGalat({ judul: 'Terlalu cepat', teks: 'Terlalu banyak percobaan dalam waktu singkat. Tunggu satu menit, lalu coba lagi.' }), 429);
    req.log.error(err);
    return kirim(reply, H.halamanGalat({ judul: 'Terjadi kesalahan', teks: 'Maaf, terjadi kesalahan di server. Coba lagi beberapa saat lagi.' }), 500);
  });

  // Membersihkan sesi kedaluwarsa dan data sementara 2FA setiap jam.
  const pembersih = setInterval(() => {
    db.sesi.bersihkan();
    const kini = Date.now();
    for (const [t, v] of pra2fa) if (v.kedaluwarsa < kini) pra2fa.delete(t);
  }, 3600e3);
  pembersih.unref();
  app.addHook('onClose', async () => clearInterval(pembersih));

  return app;
}

module.exports = { buatAplikasi };
