// Menguji putaran asisten melawan server Claude tiruan (SSE) lewat ANTHROPIC_BASE_URL:
// pemanggilan alat, persetujuan/penolakan, dan riwayat yang hanya bertambah di akhir.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

function sse(msg) {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  let out = ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } });
  msg.content.forEach((b, index) => {
    if (b.type === 'text') {
      out += ev('content_block_start', { index, content_block: { type: 'text', text: '' } });
      out += ev('content_block_delta', { index, delta: { type: 'text_delta', text: b.text } });
    } else {
      out += ev('content_block_start', { index, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
      out += ev('content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } });
    }
    out += ev('content_block_stop', { index });
  });
  out += ev('message_delta', { delta: { stop_reason: msg.stop_reason, stop_sequence: null }, usage: { output_tokens: 1 } });
  return out + ev('message_stop', {});
}

async function fakeClaude(jawaban) {
  const permintaan = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      if (req.url.startsWith('/v1/files')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ id: 'file_tiruan_1', type: 'file', filename: 'x.pdf', mime_type: 'application/pdf', size_bytes: 4, created_at: new Date().toISOString() }));
      }
      permintaan.push({ url: req.url, headers: req.headers, body: JSON.parse(body) });
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end(sse(jawaban.shift()));
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, permintaan, url: `http://127.0.0.1:${server.address().port}` };
}

const dataPengaduan = {
  nomor_agenda: '6346/AG-100.5/III/2026', tanggal_disposisi: '08/06/2026', perintah_disposisi: 'Untuk Sukel ke Kantah',
  tanggal_diterima: '09/04/2026', tanggal_surat: '24/02/2026', nomor_surat: '058/CL-LGL/IV/2026',
  pengadu_prinsipal: 'PT Razio Setia Mukti', penerima_kuasa: '', perihal: 'Permohonan perlindungan hukum',
  pokok_permasalahan: 'Pengadu memohon perlindungan hukum.', teradu: '-',
  objek_permasalahan: 'SHM No. 1467, Desa Sukamekar, Kabupaten Bekasi, Provinsi Jawa Barat',
  kota_kabupaten_objek: 'Kabupaten Bekasi', perlu_cek: [],
};

function siapkan(baseUrl) {
  process.env.ANTHROPIC_BASE_URL = baseUrl;
  // Modul dimuat ulang supaya klien memakai alamat tiruan.
  for (const k of Object.keys(require.cache)) if (k.includes(`${path.sep}src${path.sep}`)) delete require.cache[k];
  const { createAgen } = require('../src/agent/agen');
  const { createRiwayat } = require('../src/agent/riwayat');
  const { createBerkasStore } = require('../src/agent/berkas');
  const { createStore } = require('../src/state/store');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agen-'));
  const riwayat = createRiwayat(dir);
  const agen = createAgen({ claude: { apiKey: 'sk-ant-uji', model: 'claude-sonnet-5-5', effort: 'medium' }, riwayat });
  const berkas = createBerkasStore(dir, agen.anthropic);
  const log = [];
  const ctx = {
    folderIndukId: 'INDUK', berkas, store: createStore(dir),
    sheets: {
      checkHeader: async () => ({ ok: true, beda: [] }), readRows: async () => [],
      appendMasterRow: async row => { log.push(['baris', row]); return { rowNumber: 2, masalah: [] }; },
    },
    drive: {
      findOrCreateFolder: async (p, name) => { log.push(['folder', name]); return { id: 'F1', name, webViewLink: 'https://drive/F1', created: true }; },
      listNames: async () => [],
      uploadFile: async (f, name) => { log.push(['unggah', name]); return { id: 'P1', name, webViewLink: 'https://drive/P1' }; },
    },
  };
  return { agen, riwayat, berkas, ctx, log };
}

const io = (jawab, terkirim, diminta) => ({
  kirimTeks: async t => terkirim.push(t),
  kirimDokumen: async () => {},
  mintaPersetujuan: async r => { diminta.push(r); return jawab; },
});

test('PDF -> catat_pengaduan -> disetujui -> tercatat; riwayat append-only', async () => {
  const fc = await fakeClaude([
    { stop_reason: 'tool_use', content: [{ type: 'text', text: 'Saya catat pengaduannya.' }, { type: 'tool_use', id: 'tu_1', name: 'catat_pengaduan', input: { berkas_id: 'B1', ...dataPengaduan } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Sudah tercatat di baris 2.' }] },
  ]);
  try {
    const { agen, berkas, ctx, log } = siapkan(fc.url);
    const b = await berkas.simpan(Buffer.from('%PDF'), 'Document_1.pdf', 'application/pdf');
    const terkirim = []; const diminta = [];
    await agen.giliran(111, berkas.blokKonten(b), io({ setuju: true }, terkirim, diminta), ctx);

    assert.deepStrictEqual(terkirim, ['Saya catat pengaduannya.', 'Sudah tercatat di baris 2.']);
    assert.match(diminta[0], /PT Razio Setia Mukti - Kabupaten Bekasi\.pdf/);
    assert.deepStrictEqual(log.map(x => x[0]), ['folder', 'unggah', 'baris']);

    const [r1, r2] = fc.permintaan;
    assert.match(r1.headers['anthropic-beta'], /compact-2026-01-12/);
    assert.match(r1.headers['anthropic-beta'], /thinking-binding-controls-2026-08-01/);
    assert.strictEqual(r1.body.model, 'claude-sonnet-5-5');
    assert.deepStrictEqual(r1.body.output_config, { effort: 'medium' });
    assert.strictEqual(r1.body.fallbacks, 'default');
    assert.deepStrictEqual(r1.body.thinking, { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } });
    assert.match(r1.body.messages[0].content[0].text, /^\[.+ WIB\]$/);
    assert.deepStrictEqual(r1.body.messages[0].content[2].source, { type: 'file', file_id: 'file_tiruan_1' });
    // Permintaan kedua = permintaan pertama + giliran baru di akhir (system, tools, awalan sama persis).
    assert.deepStrictEqual(r2.body.system, r1.body.system);
    assert.deepStrictEqual(r2.body.tools, r1.body.tools);
    assert.deepStrictEqual(r2.body.messages.slice(0, r1.body.messages.length), r1.body.messages);
    const hasil = r2.body.messages.at(-1).content[0];
    assert.strictEqual(hasil.type, 'tool_result');
    assert.strictEqual(hasil.tool_use_id, 'tu_1');
    assert.match(hasil.content, /"hasil": "tercatat"/);
  } finally { fc.server.close(); }
});

test('ditolak dengan catatan: tidak ada yang dikerjakan, catatan sampai ke Claude', async () => {
  const fc = await fakeClaude([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_1', name: 'catat_pengaduan', input: { berkas_id: 'B1', ...dataPengaduan } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Baik, saya ubah.' }] },
  ]);
  try {
    const { agen, berkas, ctx, log } = siapkan(fc.url);
    const b = await berkas.simpan(Buffer.from('%PDF'), 'a.pdf', 'application/pdf');
    await agen.giliran(222, berkas.blokKonten(b), io({ setuju: false, catatan: 'nama pengadu salah' }, [], []), ctx);
    assert.strictEqual(log.length, 0);
    const hasil = fc.permintaan[1].body.messages.at(-1).content[0];
    assert.match(hasil.content, /TIDAK menyetujui/);
    assert.match(hasil.content, /nama pengadu salah/);
  } finally { fc.server.close(); }
});

test('masukan alat tidak sah dikembalikan sebagai galat tanpa meminta persetujuan', async () => {
  const fc = await fakeClaude([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_1', name: 'ubah_master_data', input: { baris: 1, kolom: 'No', nilai: 'x' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Maaf.' }] },
  ]);
  try {
    const { agen, ctx } = siapkan(fc.url);
    const diminta = [];
    await agen.giliran(333, [{ type: 'text', text: 'ubah' }], io({ setuju: true }, [], diminta), ctx);
    assert.strictEqual(diminta.length, 0);
    const hasil = fc.permintaan[1].body.messages.at(-1).content[0];
    assert.strictEqual(hasil.is_error, true);
    assert.match(hasil.content, /Masukan alat tidak sah/);
  } finally { fc.server.close(); }
});

test('riwayat: alat yang menggantung saat bot berhenti ditutup sebagai dibatalkan', () => {
  const { createRiwayat } = require('../src/agent/riwayat');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'riwayat-'));
  const r = createRiwayat(dir);
  const h = r.load(9);
  h.push({ role: 'user', content: 'halo' });
  h.push({ role: 'assistant', content: [{ type: 'tool_use', id: 'tu_9', name: 'kirim_email', input: {} }] });
  const ulang = r.load(9).messages;
  assert.strictEqual(ulang.length, 3);
  assert.deepStrictEqual(ulang[0], { role: 'user', content: 'halo' });
  assert.strictEqual(ulang[2].content[0].tool_use_id, 'tu_9');
  assert.match(ulang[2].content[0].content, /Dibatalkan/);
});

test('fitur yang ditolak API (400) dimatikan lalu permintaan diulang', async () => {
  const permintaan = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      const b = JSON.parse(body);
      permintaan.push(b);
      if (b.fallbacks) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'fallbacks: Extra inputs are not permitted' } }));
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end(sse({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'siap' }] }));
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const { agen } = siapkan(`http://127.0.0.1:${server.address().port}`);
    const jawab = await agen.ujiCoba();
    assert.match(jawab, /^siap \(fitur dimatikan karena ditolak API: cadangan\)$/);
    assert.strictEqual(permintaan.length, 2);
    assert.strictEqual(permintaan[1].fallbacks, undefined);
    assert.ok(permintaan[1].context_management, 'fitur lain tetap aktif');
  } finally { server.close(); }
});
