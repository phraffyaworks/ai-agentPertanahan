const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const K = require('../src/web/keamanan');
const { createDb } = require('../src/web/db');
const { buatAplikasi } = require('../src/web/server');
const { buatLayananAgen } = require('../src/web/agenPengguna');
const { hitungPemakaian } = require('../src/web/harga');
const { jalankanAlat } = require('../src/agent/alat');
const { systemPrompt } = require('../src/agent/prompt');

const PROFIL = {
  pengolah_nama: 'Gita Lestari, S.H.', pengolah_nip: '198001012005012001', atasan_jabatan: 'Kepala Sub Direktorat Uji',
  atasan_nama: 'Siti Rahma, S.H., M.H.', atasan_nip: '197505052000032002', ttd_atas_nama: 'a.n Direktur Jenderal',
  ttd_jabatan: 'Direktur Penanganan Sengketa Pertanahan', ttd_nama: 'Ahmad Fauzi, A.Ptnh., M.H.', ttd_nip: '197001011995031001', kota: 'Jakarta',
};
const tunggu = async (cek, ms = 3000) => {
  const akhir = Date.now() + ms;
  for (;;) { const v = cek(); if (v) return v; if (Date.now() > akhir) throw new Error('waktu habis'); await new Promise(r => setTimeout(r, 15)); }
};

// Agen tiruan: memakai io persis seperti agen sungguhan (teks, persetujuan, dokumen, pemakaian).
function agenTiruan() {
  const panggilan = [];
  return {
    panggilan,
    anthropic: { files: { upload: async () => ({ id: `file_${panggilan.length}` }) } },
    async giliran(chatId, isi, io, ctx, opsi) {
      panggilan.push({ chatId, isi, ctx, opsi });
      io.catatPemakaian({ model: 'claude-sonnet-5-5', usage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 2000 }, durasi_ms: 1200 });
      await io.kirimTeks('Halo **Gita**, draf siap.');
      const j = await io.mintaPersetujuan('Membuat Telaahan Staf (.docx):\n• Disimpan di folder "Uji - Kota Bekasi"');
      if (j.setuju) await io.kirimDokumen(Buffer.from('PK\u0003\u0004 docx uji'), 'Telaahan Staff_Uji - Kota Bekasi.docx', 'Telaahan Staf');
      else await io.kirimTeks(`Baik, tidak dibuat. Catatan: ${j.catatan || '-'}`);
    },
  };
}

function siapkan() {
  const db = createDb(':memory:');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agen-chat-'));
  const agen = agenTiruan();
  const app = buatAplikasi({ db, konfigurasi: { cookieAman: false, percayaProksi: false, kunciUtama: crypto.randomBytes(32) },
    buatLayanan: ({ google }) => buatLayananAgen({ db, agen, google, dataDir }) });
  return { db, app, agen, dataDir };
}

async function masuk(app, db, email, nama = 'Gita') {
  const id = db.pengguna.buat({ email, nama, unit_kerja: 'Subdit Uji', sandi_hash: K.hashSandi('sandi pengguna uji'), status: 'aktif' });
  let cookie = '';
  const simpan = res => { for (const c of [].concat(res.headers['set-cookie'] || [])) cookie = `${cookie}; ${c.split(';')[0]}`; };
  let r = await app.inject({ method: 'GET', url: '/masuk' });
  simpan(r);
  const csrfPra = /name="_csrf" value="([^"]+)"/.exec(r.body)[1];
  r = await app.inject({ method: 'POST', url: '/masuk', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ _csrf: csrfPra, email, sandi: 'sandi pengguna uji' }).toString() });
  simpan(r);
  r = await app.inject({ method: 'GET', url: '/chat', headers: { cookie } });
  const csrf = /data-csrf="([^"]+)"/.exec(r.body)[1];
  return { id, cookie, csrf };
}

// Memuat halaman Chat berulang sampai isinya cocok (agen berjalan di latar belakang).
async function chatSampai(app, s, pola) {
  let html = '';
  for (let i = 0; i < 200; i++) {
    html = (await app.inject({ method: 'GET', url: '/chat', headers: { cookie: s.cookie } })).body;
    if (pola.test(html)) return html;
    await new Promise(res => setTimeout(res, 15));
  }
  throw new Error(`Halaman Chat tidak memuat ${pola}`);
}

async function kirimPesan(app, s, teks, berkas = []) {
  const fd = new FormData();
  fd.append('teks', teks);
  for (const b of berkas) fd.append('berkas', new Blob([b.isi], { type: b.mime }), b.nama);
  const req = new Request('http://x/chat/pesan', { method: 'POST', body: fd });
  return app.inject({ method: 'POST', url: '/chat/pesan', payload: Buffer.from(await req.arrayBuffer()),
    headers: { cookie: s.cookie, 'content-type': req.headers.get('content-type'), ...(s.csrf ? { 'x-csrf-token': s.csrf } : {}) } });
}

test('harga: biaya dihitung dari usage, termasuk penjumlahan usage.iterations', () => {
  const a = hitungPemakaian('claude-sonnet-5-5', { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 2000 });
  assert.strictEqual(a.biaya_usd.toFixed(6), '0.007200');
  const b = hitungPemakaian('claude-sonnet-5-5', {
    input_tokens: 10, output_tokens: 10, server_tool_use: { web_search_requests: 2 },
    iterations: [{ type: 'compaction', input_tokens: 100000, output_tokens: 2000 }, { type: 'message', input_tokens: 5000, output_tokens: 1000, cache_creation_input_tokens: 4000 }],
  });
  assert.strictEqual(b.token_masuk, 105000);
  assert.strictEqual(b.token_cache_tulis, 4000);
  assert.strictEqual(b.pencarian_web, 2);
  // (105000*2 + 4000*2.5 + 3000*10)/1e6 + 2 pencarian * 0,01
  assert.strictEqual(b.biaya_usd.toFixed(6), '0.270000');
  assert.strictEqual(hitungPemakaian('model-tak-dikenal', { input_tokens: 5 }).harga_diketahui, false);
});

test('prompt: bot versi 1 tidak berubah; dashboard menambah blok pengguna setelah aturan umum', () => {
  assert.match(systemPrompt(), /^Anda adalah asisten pribadi pengguna, Penata Pertanahan Pertama/);
  const { aturanUmum, blokPengguna } = require('../src/agent/prompt');
  assert.ok(systemPrompt().endsWith(aturanUmum()));
  const blok = blokPengguna({ pengguna: { nama: 'Gita', unit_kerja: 'Subdit Uji' }, profil: PROFIL, googleTersambung: false });
  assert.match(blok, /Anda melayani Gita \(Subdit Uji\)/);
  assert.match(blok, /Gita Lestari, S\.H\., NIP\. 19800101 200501 2 001/);
  assert.match(blok, /BELUM tersambung/);
  assert.match(blokPengguna({ pengguna: { nama: 'X', unit_kerja: 'U' }, profil: null, googleTersambung: true }), /Profil penanda tangan BELUM diisi/);
});

test('alat dokumen memakai profil pengguna; tanpa profil di dashboard ditolak dengan pesan jelas', async () => {
  const contoh = require('./contoh/telaahan.json');
  const terkirim = [];
  const ctx = {
    google: { drive: { getFolder: async id => ({ id, name: 'Uji - Kota Bekasi' }), listNames: async () => [], uploadFile: async () => ({ webViewLink: 'L' }) } },
    kirimDokumen: async (buf, nama) => terkirim.push({ buf, nama }),
    mintaPersetujuan: async () => ({ setuju: true }),
    profil: require('../src/web/profil').keDokumen(PROFIL), wajibProfil: true,
  };
  const r = await jalankanAlat(ctx, { name: 'buat_telaahan', input: { folder_id: 'F1', data: contoh } });
  assert.ok(!r.is_error, r.content);
  const JSZip = require('jszip');
  const xml = await (await JSZip.loadAsync(terkirim[0].buf)).file('word/document.xml').async('string');
  assert.ok(xml.includes('Gita Lestari, S.H.') && xml.includes('NIP. 19800101 200501 2 001') && xml.includes('Siti Rahma, S.H., M.H.'));
  assert.ok(!xml.includes('Phraffya'), 'nama pengolah bawaan versi 1 tidak boleh muncul');
  const tanpa = await jalankanAlat({ ...ctx, profil: null }, { name: 'buat_telaahan', input: { folder_id: 'F1', data: contoh } });
  assert.ok(tanpa.is_error && /Profil penanda tangan belum diisi/.test(tanpa.content));
});

test('chat: pesan, persetujuan, dokumen, pemakaian, dan isolasi antar pengguna', async () => {
  const { db, app, agen } = siapkan();
  const s = await masuk(app, db, 'gita@contoh.id');
  db.profil.simpan(s.id, PROFIL);

  assert.strictEqual((await kirimPesan(app, { ...s, csrf: '' }, 'halo')).statusCode, 403, 'tanpa token CSRF ditolak');
  const r = await kirimPesan(app, s, 'Tolong catat pengaduan ini', [{ isi: Buffer.from('%PDF-1.4 uji'), mime: 'application/pdf', nama: 'pengaduan.pdf' }]);
  assert.strictEqual(r.statusCode, 200, r.body);
  await tunggu(() => agen.panggilan.length === 1);
  const p = agen.panggilan[0];
  assert.strictEqual(p.chatId, `u${s.id}`);
  assert.ok(p.isi.some(b => b.type === 'document' && b.source.file_id) && p.isi.some(b => b.text === 'Tolong catat pengaduan ini'));
  assert.match(p.opsi.system[1].text, /Anda melayani Gita/);
  assert.ok(p.opsi.system[0].cache_control, 'aturan umum diberi penanda cache');
  assert.strictEqual(p.ctx.profil.pengolah.nama, 'Gita Lestari, S.H.');
  await assert.rejects(p.ctx.sheets.readRows(), /Google pengguna belum tersambung/);

  const hal = await chatSampai(app, s, /data-setuju="1"/);
  const idSetuju = /data-setuju="1" data-id="(\d+)"/.exec(hal)[1];
  assert.match(hal, /Halo <b>Gita<\/b>, draf siap\./);
  assert.match(hal, /Lampiran: B1 pengaduan\.pdf/);

  const j = await app.inject({ method: 'POST', url: `/chat/setuju/${idSetuju}`, payload: { setuju: true }, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });
  assert.deepStrictEqual(JSON.parse(j.body), { ok: true });
  const html = await chatSampai(app, s, /\/unduh\/D/);
  assert.match(html, /lencana aktif">Disetujui/);
  const idDok = /\/unduh\/(D[0-9a-z]+)/.exec(html)[1];
  const unduh = await app.inject({ method: 'GET', url: `/unduh/${idDok}`, headers: { cookie: s.cookie } });
  assert.strictEqual(unduh.statusCode, 200);
  assert.match(unduh.headers['content-disposition'], /Telaahan%20Staff_Uji%20-%20Kota%20Bekasi\.docx/);
  assert.ok(unduh.rawPayload.subarray(0, 2).toString() === 'PK');

  const pem = db.pemakaian.perHari(s.id, 0);
  assert.strictEqual(pem.length, 1);
  assert.strictEqual(pem[0].biaya_usd.toFixed(4), '0.0072');
  assert.match((await app.inject({ method: 'GET', url: '/pemakaian', headers: { cookie: s.cookie } })).body, /US\$0,0072/);

  // Pengguna lain tidak bisa mengunduh dokumen milik Gita dan tidak melihat percakapannya.
  const lain = await masuk(app, db, 'lain@contoh.id', 'Lain');
  assert.strictEqual((await app.inject({ method: 'GET', url: `/unduh/${idDok}`, headers: { cookie: lain.cookie } })).statusCode, 404);
  assert.ok(!(await app.inject({ method: 'GET', url: '/chat', headers: { cookie: lain.cookie } })).body.includes('pengaduan.pdf'));
  await app.close();
});

test('chat: teks yang dikirim saat persetujuan menunggu dihitung Tolak beserta catatannya', async () => {
  const { db, app, agen } = siapkan();
  const s = await masuk(app, db, 'h@contoh.id', 'Hana');
  db.profil.simpan(s.id, PROFIL);
  await kirimPesan(app, s, 'buat telaahan');
  await tunggu(() => agen.panggilan.length === 1);
  await chatSampai(app, s, /data-setuju/);
  await kirimPesan(app, s, 'ganti nama foldernya jadi Uji Baru');
  const html = await chatSampai(app, s, /Catatan: ganti nama foldernya/);
  assert.match(html, /lencana ditolak">Ditolak/);
  assert.match(html, /Catatan: ganti nama foldernya jadi Uji Baru/);
  assert.strictEqual(agen.panggilan.length, 1, 'teks penolakan tidak menjadi giliran baru');
  await app.close();
});

test('chat: aliran langsung (SSE) mengirim balasan agen ke peramban', { timeout: 10000 }, async () => {
  const { db, app } = siapkan();
  const s = await masuk(app, db, 'i@contoh.id', 'Indah');
  db.profil.simpan(s.id, PROFIL);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const port = app.server.address().port;
  const ac = new AbortController();
  const res = await fetch(`http://127.0.0.1:${port}/chat/aliran?sejak=0`, { headers: { cookie: s.cookie }, signal: ac.signal });
  assert.match(res.headers.get('content-type'), /text\/event-stream/);
  const pembaca = res.body.getReader();
  await kirimPesan(app, s, 'halo agen');
  let teks = '';
  const dekoder = new TextDecoder();
  while (!teks.includes('data-setuju=\\"1\\"')) {
    const { value, done } = await pembaca.read();
    if (done) break;
    teks += dekoder.decode(value);
  }
  assert.match(teks, /"jenis":"tambah"/);
  assert.match(teks, /Halo <b>Gita<\/b>, draf siap/);
  assert.ok(!teks.includes('Kedaluwarsa'), 'kartu persetujuan yang baru datang harus menampilkan tombol, bukan Kedaluwarsa');
  ac.abort();
  await app.close();
});
