// Menjalankan apps-script/Kode.gs di tiruan layanan Google (Drive & Sheets di memori) lewat server HTTP
// lokal, lalu menguji alur penerimaan pengaduan dari ujung ke ujung melawan tiruan itu.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const vm = require('vm');
const { createGoogle } = require('../src/google');
const { newSecret } = require('../src/google/appsscript');
const { processPengaduan } = require('../src/pipeline/intake');
const { createStore } = require('../src/state/store');
const { HEADER } = require('../src/google/sheets');

function iter(list) { let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; }

function fakeGoogle() {
  let seq = 0;
  const items = new Map();
  const mk = (name, parent, isFolder, bytes) => {
    const id = `ID${++seq}`;
    const it = { id, name, parent, isFolder, bytes, trashed: false };
    items.set(id, it);
    return api(it);
  };
  const api = it => ({
    getId: () => it.id, getName: () => it.name, getUrl: () => `https://drive.google.com/${it.id}`, isTrashed: () => it.trashed,
    getFoldersByName: n => iter([...items.values()].filter(x => x.parent === it.id && x.isFolder && x.name === n).map(api)),
    getFolders: () => iter([...items.values()].filter(x => x.parent === it.id && x.isFolder).map(api)),
    getFiles: () => iter([...items.values()].filter(x => x.parent === it.id && !x.isFolder).map(api)),
    createFolder: n => mk(n, it.id, true),
    createFile: blob => mk(blob.name, it.id, false, blob.bytes),
  });
  const root = mk('My Drive', null, true);
  const otomasi = root.createFolder('Otomasi');

  // Sheet: sel menyimpan { v: nilai tampil, f: rumus }.
  const cells = [HEADER.map(h => ({ v: h, f: '' })), [{ v: '1', f: '' }]];
  const sheet = {
    getLastRow: () => cells.length,
    getRange: (r, c, nr = 1, nc = 1) => ({
      getDisplayValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => String(cells[r - 1 + i]?.[c - 1 + j]?.v ?? ''))),
      getFormulas: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => cells[r - 1 + i]?.[c - 1 + j]?.f ?? '')),
      setValues: rows => rows.forEach((row, i) => {
        cells[r - 1 + i] = cells[r - 1 + i] || [];
        row.forEach((v, j) => {
          // Seperti Sheets: awalan petik memaksa teks; tanpa petik, "08/06/2026" akan jadi tanggal.
          const text = typeof v === 'string' && v.startsWith("'") ? v.slice(1) : (typeof v === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(v) ? 'TANGGAL!' : v);
          cells[r - 1 + i][c - 1 + j] = { v: text, f: '' };
        });
      }),
      setFormula: f => {
        const m = /^=HYPERLINK\("(.*)","(.*)"\)$/.exec(f);
        cells[r - 1] = cells[r - 1] || [];
        cells[r - 1][c - 1] = { v: m ? m[2] : '#ERROR!', f };
      },
      copyFormatToRange: () => {},
    }),
  };
  const props = {};
  const ctx = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; } }) },
    ContentService: { createTextOutput: text => ({ text, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'phraffyaworks@gmail.com' }) },
    DriveApp: { getFolderById: id => { const it = items.get(id); if (!it) throw new Error('No item with the given ID'); return api(it); }, getRootFolder: () => root },
    Utilities: { newBlob: (bytes, mime, name) => ({ bytes, mime, name }), base64Decode: s => Buffer.from(s, 'base64') },
    SpreadsheetApp: { openById: () => ({ getSheetByName: n => (n === 'Master Data' ? sheet : null) }), flush: () => {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Logger: { log() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Kode.gs'), 'utf8'), ctx);
  return { ctx, items, cells, otomasiId: otomasi.getId() };
}

// Server tiruan: seperti Apps Script, POST dijawab dengan pengalihan 302 ke alamat hasil.
function serve(ctx) {
  const hasil = new Map();
  let n = 0;
  const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', d => { body += d; });
      req.on('end', () => {
        const id = String(++n);
        hasil.set(id, ctx.doPost({ postData: { contents: body } }).text);
        res.writeHead(302, { Location: `/hasil/${id}` }).end();
      });
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(hasil.get(req.url.split('/').pop()));
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/exec` })));
}

const dataContoh = {
  nomor_agenda: '6346/AG-100.5/III/2026', tanggal_disposisi: '08/06/2026', perintah_disposisi: 'Untuk Sukel ke Kantah',
  tanggal_diterima: '09/04/2026', tanggal_surat: '24/02/2026', nomor_surat: '058/CL-LGL/IV/2026',
  pengadu_prinsipal: 'PT Razio Setia Mukti', penerima_kuasa: '', perihal: '=Permohonan perlindungan hukum',
  pokok_permasalahan: 'Pengadu memohon perlindungan hukum.', teradu: '-',
  objek_permasalahan: 'SHM No. 1467, Desa Sukamekar, Kabupaten Bekasi, Provinsi Jawa Barat',
  kota_kabupaten_objek: 'Kabupaten Bekasi', perlu_cek: [],
};

test('Apps Script: pemasangan kode rahasia dan penolakan kode salah', async () => {
  const g = fakeGoogle();
  const { server, url } = await serve(g.ctx);
  try {
    const secret = newSecret();
    const google = createGoogle({ appsScriptUrl: url, appsScriptSecret: secret, spreadsheetId: 'S', sheetMaster: 'Master Data' });
    await assert.rejects(google.client.call('ping'), /belum dipasangkan/);
    await google.client.call('pasang', { secret });
    assert.strictEqual((await google.client.call('ping')).akun, 'phraffyaworks@gmail.com');
    const lain = createGoogle({ appsScriptUrl: url, appsScriptSecret: newSecret(), spreadsheetId: 'S', sheetMaster: 'Master Data' });
    await assert.rejects(lain.client.call('ping'), /Kode rahasia salah/);
    await assert.rejects(lain.client.call('pasang', { secret: newSecret() }), /sudah dipasangkan/);
  } finally { server.close(); }
});

test('Apps Script: alur penerimaan lengkap ke Drive dan Master Data', async () => {
  const g = fakeGoogle();
  const { server, url } = await serve(g.ctx);
  try {
    const secret = newSecret();
    const google = createGoogle({ appsScriptUrl: url, appsScriptSecret: secret, spreadsheetId: 'S', sheetMaster: 'Master Data' });
    await google.client.call('pasang', { secret });
    const deps = {
      drive: google.drive, sheets: google.sheets, folderIndukId: g.otomasiId,
      extract: async () => ({ data: { ...dataContoh }, usage: {} }),
      store: createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'agen-'))),
    };
    assert.deepStrictEqual(await google.sheets.checkHeader(), { ok: true, beda: [] });

    const pdf = Buffer.from('%PDF-1.4 contoh');
    const r = await processPengaduan({ pdfBuffer: pdf, namaFileAsli: 'Document_1.pdf' }, deps);
    assert.strictEqual(r.status, 'ok');
    assert.deepStrictEqual(r.masalahSheet, []);

    const folder = [...g.items.values()].find(x => x.isFolder && x.name === 'PT Razio Setia Mukti - Kabupaten Bekasi');
    assert.ok(folder, 'folder pengadu dibuat');
    assert.strictEqual(folder.parent, g.otomasiId);
    const file = [...g.items.values()].find(x => !x.isFolder && x.parent === folder.id);
    assert.strictEqual(file.name, 'PT Razio Setia Mukti - Kabupaten Bekasi.pdf');
    assert.ok(Buffer.from(file.bytes).equals(pdf), 'isi PDF utuh');

    const row = g.cells[r.kasus.master.rowNumber - 1].map(c => c.v);
    assert.strictEqual(r.kasus.master.rowNumber, 3);
    assert.strictEqual(row[0], 2);
    assert.strictEqual(row[2], '08/06/2026', 'tanggal tetap teks');
    assert.strictEqual(row[9], '=Permohonan perlindungan hukum', 'teks berawalan = tidak jadi rumus');
    assert.strictEqual(row[13], 'Surat Pengaduan');
    assert.strictEqual(row[15], 'Menunggu');

    // Pengaduan dengan Nomor Surat sama tidak membuat apa pun.
    const jumlah = g.items.size;
    const dup = await processPengaduan({ pdfBuffer: pdf, namaFileAsli: 'Document_1.pdf' }, deps);
    assert.strictEqual(dup.status, 'duplikat');
    assert.strictEqual(g.items.size, jumlah);
  } finally { server.close(); }
});
