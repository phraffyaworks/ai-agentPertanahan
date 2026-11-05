// Menguji server MCP untuk Hermes lewat klien MCP sungguhan (transport di memori dan stdio):
// daftar alat, persetujuan lewat elicitation (setuju, tolak, batal, tidak didukung), berkas lewat lokasi file,
// file Word + baris MEDIA, baca_berkas dengan Claude tiruan, dan berkas Hermes yang selalu sesuai aturan bot.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { ElicitRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { buatServer } = require('../src/mcp/server');
const { buatAlatMcp } = require('../src/mcp/alat');
const { createPembaca } = require('../src/mcp/bacaBerkas');
const { createStore } = require('../src/state/store');
const { HEADER } = require('../src/google/sheets');
const contohTelaahan = require('./contoh/telaahan.json');

const ROOT = path.join(__dirname, '..');
const BARIS = ['1', '6346/AG', '', '', '', '', '058/X/2026', 'PT Uji', '', 'Perihal', 'Pokok', '-', 'Objek', 'Surat Pengaduan', '', 'Menunggu'];

async function siapkan({ jawab = 'accept', elicitation = true, pembaca } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-'));
  const cache = path.join(dir, 'cache');
  const masuk = path.join(cache, 'documents');
  fs.mkdirSync(masuk, { recursive: true });
  const log = [];
  const google = {
    drive: {
      getFolder: async id => ({ id, name: 'PT Uji - Kabupaten Bekasi', trashed: false }),
      listNames: async () => [],
      listChildren: async () => [],
      findOrCreateFolder: async (parent, name) => { log.push(['folder', parent, name]); return { id: 'F1', name, webViewLink: 'https://drive/F1', created: true }; },
      uploadFile: async (folderId, name, buf, mime) => { log.push(['upload', folderId, name, mime, buf.length]); return { id: 'D1', name, webViewLink: 'https://drive/D1' }; },
    },
    sheets: {
      checkHeader: async () => ({ ok: true, beda: [] }),
      readRows: async () => [BARIS],
      appendMasterRow: async (row, url) => { log.push(['append', row, url]); return { rowNumber: 3, masalah: [] }; },
      updateCell: async (baris, kolom, nilai) => { log.push(['cell', baris, kolom, nilai]); return { baris, kolom, nilai }; },
    },
  };
  const ctxDasar = { google, drive: google.drive, sheets: google.sheets, store: createStore(path.join(dir, 'data')), folderIndukId: 'INDUK' };
  const pengaturan = { folderBerkas: [cache], folderMasuk: masuk, folderKeluaran: path.join(masuk, 'pertanahan'), waktuTungguMs: 5000 };
  const dibaca = [];
  const pembacaTiruan = pembaca || { baca: async file => { dibaca.push(file); return { teks: '=== Halaman 1 ===\nSurat pengaduan PT Uji' }; } };
  const alat = buatAlatMcp({ ctxDasar, pembaca: pembacaTiruan, pengaturan, cacheBacaan: path.join(dir, 'bacaan') });
  const server = buatServer({ alat, waktuTungguMs: 5000 });
  const ditanya = [];
  const client = new Client({ name: 'uji', version: '1.0.0' }, { capabilities: elicitation ? { elicitation: {} } : {} });
  if (elicitation) {
    client.setRequestHandler(ElicitRequestSchema, async req => {
      ditanya.push(req.params.message);
      return jawab === 'accept' ? { action: 'accept', content: {} } : { action: jawab };
    });
  }
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const panggil = (name, args) => client.callTool({ name, arguments: args });
  return { client, panggil, log, ditanya, dibaca, dir, cache, masuk, pengaturan };
}
const teks = r => r.content.map(c => c.text).join('\n');

test('MCP: daftar alat sama dengan bot, berkas lewat lokasi file, anotasi baca/ubah, dan instruksi server', async () => {
  const { client } = await siapkan();
  const { tools } = await client.listTools();
  const nama = tools.map(t => t.name);
  assert.strictEqual(tools.length, 19);
  for (const n of ['lihat_berkas', 'baca_berkas', 'lihat_master_data', 'catat_pengaduan', 'buat_telaahan', 'buat_notula', 'buat_nota_dinas', 'buat_surat_keluar', 'kirim_email', 'hapus_acara']) assert.ok(nama.includes(n), n);
  const per = Object.fromEntries(tools.map(t => [t.name, t]));
  assert.strictEqual(per.lihat_master_data.annotations.readOnlyHint, true);
  assert.strictEqual(per.baca_berkas.annotations.readOnlyHint, true);
  assert.strictEqual(per.catat_pengaduan.annotations.readOnlyHint, false);
  assert.strictEqual(per.hapus_acara.annotations.destructiveHint, true);
  assert.ok(per.catat_pengaduan.inputSchema.properties.berkas && !per.catat_pengaduan.inputSchema.properties.berkas_id);
  assert.ok(per.catat_pengaduan.inputSchema.required.includes('berkas'));
  assert.match(per.buat_telaahan.description, /MEDIA:/);
  assert.doesNotMatch(per.buat_acara.description, /MEDIA:/);
  assert.match(client.getInstructions(), /baca_berkas/);
});

test('MCP: alat baca langsung jalan tanpa persetujuan', async () => {
  const { panggil, ditanya } = await siapkan();
  const r = await panggil('lihat_master_data', { cari: 'PT Uji' });
  assert.ok(!r.isError);
  assert.match(teks(r), /"total_cocok": 1/);
  assert.strictEqual(ditanya.length, 0);
});

test('MCP: alat pengubah menanyakan ringkasan yang sama dengan bot; hanya "accept" yang dijalankan', async () => {
  let t = await siapkan({ jawab: 'accept' });
  let r = await t.panggil('ubah_master_data', { baris: 2, kolom: 'Rencana TL', nilai: 'Gelar Awal' });
  assert.strictEqual(t.ditanya.length, 1);
  assert.match(t.ditanya[0], /Mengubah Master Data baris 2 \(PT Uji\), kolom "Rencana TL"/);
  assert.match(t.ditanya[0], /Setujui tindakan ini\?$/);
  assert.deepStrictEqual(t.log, [['cell', 2, 'Rencana TL', 'Gelar Awal']]);
  assert.ok(!r.isError);

  for (const jawab of ['decline', 'cancel']) {
    t = await siapkan({ jawab });
    r = await t.panggil('ubah_master_data', { baris: 2, kolom: 'Rencana TL', nilai: 'Gelar Awal' });
    assert.strictEqual(t.log.length, 0, jawab);
    assert.match(teks(r), /TIDAK menyetujui/, jawab);
  }
});

test('MCP: tanpa dukungan persetujuan (elicitation), alat pengubah ditolak dan tidak menjalankan apa pun', async () => {
  const t = await siapkan({ elicitation: false });
  const r = await t.panggil('ubah_master_data', { baris: 2, kolom: 'Status', nilai: 'Selesai' });
  assert.strictEqual(r.isError, true);
  assert.match(teks(r), /tidak mendukung permintaan persetujuan/);
  assert.strictEqual(t.log.length, 0);
  // Alat baca tetap bisa dipakai.
  assert.ok(!(await t.panggil('lihat_master_data', {})).isError);
});

test('MCP: masukan alat tetap divalidasi seperti di bot', async () => {
  const t = await siapkan();
  const r = await t.panggil('ubah_master_data', { baris: 1, kolom: 'No', nilai: 'x' });
  assert.strictEqual(r.isError, true);
  assert.match(teks(r), /Masukan alat tidak sah/);
  assert.strictEqual(t.ditanya.length, 0);
});

test('MCP: buat_telaahan menyimpan ke Drive, menyalin .docx ke cache Hermes, dan memberi baris MEDIA', async () => {
  const t = await siapkan();
  const r = await t.panggil('buat_telaahan', { folder_id: 'F1', data: contohTelaahan });
  assert.ok(!r.isError, teks(r));
  assert.match(t.ditanya[0], /Membuat Telaahan Staf \(\.docx\)/);
  const [, folderId, nama, mime] = t.log.find(l => l[0] === 'upload');
  assert.strictEqual(folderId, 'F1');
  assert.strictEqual(nama, 'Telaahan Staff_PT Uji - Kabupaten Bekasi.docx');
  assert.match(mime, /wordprocessingml/);
  const media = /^MEDIA:(.+)$/m.exec(teks(r))[1];
  assert.strictEqual(media, path.join(t.pengaturan.folderKeluaran, nama));
  assert.strictEqual(fs.readFileSync(media).subarray(0, 2).toString(), 'PK');
  // Nama yang sudah ada di cache diberi nomor, file lama tidak ditimpa.
  const r2 = await t.panggil('buat_telaahan', { folder_id: 'F1', data: contohTelaahan });
  assert.match(teks(r2), /MEDIA:.+ \(2\)\.docx$/m);
});

test('MCP: berkas dirujuk dengan lokasi file dan hanya dari folder yang diizinkan', async () => {
  const t = await siapkan();
  const pdf = path.join(t.masuk, 'Surat Pengaduan.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4 uji');
  let r = await t.panggil('simpan_berkas_ke_drive', { berkas: pdf, folder_id: 'F1', nama_file: 'Surat REFF_PT Uji - Kabupaten Bekasi.pdf' });
  assert.ok(!r.isError, teks(r));
  assert.match(t.ditanya[0], /Menyimpan berkas Surat Pengaduan\.pdf/);
  assert.deepStrictEqual(t.log.at(-1).slice(0, 4), ['upload', 'F1', 'Surat REFF_PT Uji - Kabupaten Bekasi.pdf', 'application/pdf']);

  const rahasia = path.join(t.dir, '.env');
  fs.writeFileSync(rahasia, 'KUNCI=rahasia');
  const n = t.log.length;
  for (const lokasi of [rahasia, path.join(t.cache, '..', '.env'), 'relatif.pdf', path.join(t.masuk, 'tidak-ada.pdf')]) {
    r = await t.panggil('simpan_berkas_ke_drive', { berkas: lokasi, folder_id: 'F1', nama_file: 'x.pdf' });
    assert.strictEqual(r.isError, true, lokasi);
  }
  assert.strictEqual(t.log.length, n, 'tidak ada yang diunggah');

  // catat_pengaduan memakai lokasi file yang sama.
  r = await t.panggil('catat_pengaduan', {
    berkas: pdf, nomor_agenda: '1/AG', tanggal_disposisi: '01/11/2026', perintah_disposisi: 'Telaah', tanggal_diterima: '02/11/2026',
    tanggal_surat: '30/10/2026', nomor_surat: '099/BARU/2026', pengadu_prinsipal: 'Budi', penerima_kuasa: '', perihal: 'Pengaduan',
    pokok_permasalahan: 'Pengadu memohon perlindungan hukum.', teradu: '-', objek_permasalahan: 'SHM 1/Desa A, Kabupaten Bekasi',
    kota_kabupaten_objek: 'Kabupaten Bekasi', perlu_cek: [],
  });
  assert.ok(!r.isError, teks(r));
  assert.match(t.ditanya.at(-1), /PDF Surat Pengaduan\.pdf \(Surat Pengaduan\.pdf\) disimpan sebagai: Budi - Kabupaten Bekasi\.pdf/);
  assert.deepStrictEqual(t.log.find(l => l[0] === 'folder'), ['folder', 'INDUK', 'Budi - Kabupaten Bekasi']);
  assert.strictEqual(t.log.find(l => l[0] === 'append')[1].length, HEADER.length);
});

test('MCP: baca_berkas memakai pembaca Claude sekali per isi berkas, dan lihat_berkas menampilkan kiriman terbaru', async () => {
  const t = await siapkan();
  const pdf = path.join(t.masuk, 'pengaduan.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4 isi');
  let r = await t.panggil('baca_berkas', { berkas: pdf });
  assert.match(teks(r), /Isi berkas pengaduan\.pdf:\n\n=== Halaman 1 ===/);
  r = await t.panggil('baca_berkas', { berkas: pdf });
  assert.match(teks(r), /dari bacaan sebelumnya/);
  assert.strictEqual(t.dibaca.length, 1);
  assert.strictEqual(t.ditanya.length, 0);

  fs.writeFileSync(path.join(t.masuk, 'catatan.txt'), 'x');
  r = await t.panggil('baca_berkas', { berkas: path.join(t.masuk, 'catatan.txt') });
  assert.strictEqual(r.isError, true);
  assert.match(teks(r), /Jenis berkas tidak didukung/);

  const daftar = JSON.parse(teks(await t.panggil('lihat_berkas', {})));
  assert.deepStrictEqual(daftar.berkas.map(b => b.nama).sort(), ['catatan.txt', 'pengaduan.pdf']);
  assert.strictEqual(daftar.berkas.find(b => b.nama === 'pengaduan.pdf').lokasi, pdf);
});

// ---------- pembaca Claude melawan server tiruan ----------
function sseTeks(text, stop = 'end_turn') {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  return ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } })
    + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
    + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } })
    + ev('content_block_stop', { index: 0 })
    + ev('message_delta', { delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 5 } })
    + ev('message_stop', {});
}

test('baca_berkas: PDF dikirim sebagai dokumen base64 dengan model cadangan; ditolak API -> diulang tanpa cadangan', async t => {
  const permintaan = [];
  let tolakCadangan = true;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      const b = JSON.parse(body);
      permintaan.push({ headers: req.headers, body: b });
      if (b.fallbacks && tolakCadangan) {
        tolakCadangan = false;
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'fallbacks: not supported' } }));
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end(sseTeks('=== Halaman 1 ===\nKepada Yth. Menteri'));
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const lama = process.env.ANTHROPIC_BASE_URL;
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  t.after(() => { if (lama === undefined) delete process.env.ANTHROPIC_BASE_URL; else process.env.ANTHROPIC_BASE_URL = lama; });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baca-'));
  const pdf = path.join(dir, 'a.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4 uji');
  const pembaca = createPembaca({ claude: { apiKey: 'sk-uji', model: 'claude-sonnet-5-5', effort: 'medium' } });
  const r = await pembaca.baca(pdf);
  assert.strictEqual(r.teks, '=== Halaman 1 ===\nKepada Yth. Menteri');
  assert.strictEqual(permintaan.length, 2);
  const [pertama, kedua] = permintaan;
  assert.strictEqual(pertama.body.fallbacks, 'default');
  assert.match(pertama.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.strictEqual(kedua.body.fallbacks, undefined);
  const [lampiran, petunjuk] = kedua.body.messages[0].content;
  assert.deepStrictEqual(lampiran, { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from('%PDF-1.4 uji').toString('base64') } });
  assert.match(petunjuk.text, /\[TIDAK TERBACA\]/);
  assert.strictEqual(kedua.body.model, 'claude-sonnet-5-5');
  assert.deepStrictEqual(kedua.body.thinking, { type: 'adaptive' });

  await assert.rejects(createPembaca({ claude: {} }).baca(pdf), /ANTHROPIC_API_KEY belum diisi/);
});

test('server MCP stdio: hanya protokol di stdout, 19 alat tersedia', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stdio-'));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(ROOT, 'src', 'mcp', 'server.js')],
    env: {
      PATH: process.env.PATH, HOME: dir, APPS_SCRIPT_URL: 'https://script.google.com/macros/s/uji/exec',
      APPS_SCRIPT_SECRET: 'rahasia-uji', DATA_DIR: path.join(dir, 'data'),
    },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'uji', version: '1.0.0' }, { capabilities: { elicitation: {} } });
  await client.connect(transport);
  t.after(() => client.close());
  const { tools } = await client.listTools();
  assert.strictEqual(tools.length, 19);
  assert.strictEqual(client.getServerVersion().name, 'pertanahan');
});

test('berkas Hermes (SOUL.md dan skill) sesuai aturan bot terbaru', () => {
  const { bangun } = require('../scripts/buat-hermes');
  const berkas = bangun();
  for (const [rel, isi] of Object.entries(berkas)) {
    assert.strictEqual(fs.readFileSync(path.join(ROOT, 'hermes', rel), 'utf8'), isi, `${rel} belum diperbarui: jalankan "npm run hermes"`);
  }
  assert.deepStrictEqual(Object.keys(berkas).sort(), ['SOUL.md', 'SOUL-tambahan.md', ...['pengaduan', 'notula', 'surat', 'telaahan'].map(n => path.join('skills', `pertanahan-${n}`, 'SKILL.md'))].sort());
  assert.match(berkas['SOUL-tambahan.md'], /baca_berkas/);
  assert.match(berkas['SOUL-tambahan.md'], /MEDIA:<lokasi>/);
  for (const f of ['SOUL.md', 'SOUL-tambahan.md']) assert.match(berkas[f], /Jangan mencari nama atau identitas para pihak/, f);
  const soul = berkas['SOUL.md'];
  assert.doesNotMatch(soul, /\[Berkas B<n>/);
  assert.match(soul, /baca_berkas/);
  assert.match(berkas[path.join('skills', 'pertanahan-pengaduan', 'SKILL.md')], /Sofyan Hadi Syam/);
  for (const [rel, isi] of Object.entries(berkas)) {
    if (!rel.endsWith('SKILL.md')) continue;
    assert.match(isi, /^---\nname: pertanahan-[a-z]+\ndescription: ".+"\nversion: /, rel);
    assert.ok(isi.length < 24000, `${rel} terlalu panjang untuk satu skill (${isi.length})`);
  }
});
