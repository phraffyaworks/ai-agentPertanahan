const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { catatPengaduan, normalizeDates, IntakeStop } = require('../src/pipeline/intake');
const { buildMasterRow, nextNumber, findDuplicate, hyperlinkFormula, HEADER } = require('../src/google/sheets');
const { createStore } = require('../src/state/store');

const contoh = () => ({
  nomor_agenda: '6346/AG-100.5/III/2026', tanggal_disposisi: '08/06/2026', perintah_disposisi: 'Untuk Sukel ke Kantah',
  tanggal_diterima: '09/04/2026', tanggal_surat: '24/02/2026', nomor_surat: '058/CL-LGL/IV/2026',
  pengadu_prinsipal: 'PT Razio Setia Mukti', penerima_kuasa: '', perihal: 'Permohonan perlindungan hukum',
  pokok_permasalahan: 'Pengadu memohon perlindungan hukum atas SHM No. 1467 Desa Sukamekar.', teradu: '-',
  objek_permasalahan: 'SHM No. 1467, Desa Sukamekar, Kecamatan Tambelang, Kabupaten Bekasi, Provinsi Jawa Barat',
  kota_kabupaten_objek: 'Kabupaten Bekasi', perlu_cek: [],
});

function fakes({ rows = [], headerOk = true } = {}) {
  const log = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agen-'));
  return {
    log,
    deps: {
      folderIndukId: 'INDUK',
      sheets: {
        checkHeader: async () => (headerOk ? { ok: true, beda: [] } : { ok: false, beda: [{ kolom: 'B', harap: 'Nomor Agenda', ada: 'X' }] }),
        readRows: async () => rows,
        appendMasterRow: async (row, url) => { log.push(['append', row, url]); return { rowNumber: rows.length + 2, masalah: [] }; },
      },
      drive: {
        findOrCreateFolder: async (parent, name) => { log.push(['folder', parent, name]); return { id: 'F1', name, webViewLink: 'https://drive/F1', created: true }; },
        listNames: async () => ['PT Razio Setia Mukti - Kabupaten Bekasi.pdf'],
        uploadFile: async (folderId, name) => { log.push(['upload', folderId, name]); return { id: 'P1', name, webViewLink: 'https://drive/P1' }; },
      },
      store: createStore(dir),
    },
  };
}

test('alur lengkap: folder, PDF berganti nama, satu baris Master Data', async () => {
  const { deps, log } = fakes({ rows: [['1', 'x', '', '', '', '', '-']] });
  const r = await catatPengaduan({ pdfBuffer: Buffer.from('%PDF'), namaFileAsli: 'Document_261019.pdf', data: contoh() }, deps);
  assert.strictEqual(r.status, 'ok');
  assert.deepStrictEqual(log[0], ['folder', 'INDUK', 'PT Razio Setia Mukti - Kabupaten Bekasi']);
  // Nama sudah dipakai di folder itu -> diberi nomor.
  assert.deepStrictEqual(log[1], ['upload', 'F1', 'PT Razio Setia Mukti - Kabupaten Bekasi (2).pdf']);
  const [, row, url] = log[2];
  assert.strictEqual(row.length, HEADER.length);
  assert.strictEqual(row[0], 2);
  assert.strictEqual(row[14], '', 'Rencana TL dikosongkan');
  assert.strictEqual(row[15], 'Menunggu');
  assert.strictEqual(url, 'https://drive/P1');
  assert.strictEqual(r.kasus.master.rowNumber, 3);
  assert.strictEqual(deps.store.getCase(r.kasus.id).folder.id, 'F1');
});

test('Nomor Surat yang sudah ada: tidak membuat apa pun', async () => {
  const { deps, log } = fakes({ rows: [['1', '', '', '', '', '', '058/cl-lgl/iv/2026']] });
  const r = await catatPengaduan({ pdfBuffer: Buffer.from('%PDF'), data: contoh() }, deps);
  assert.strictEqual(r.status, 'duplikat');
  assert.strictEqual(r.dupRow, 2);
  assert.strictEqual(log.length, 0);
});

test('header berbeda: berhenti sebelum menulis apa pun', async () => {
  const { deps, log } = fakes({ headerOk: false });
  await assert.rejects(catatPengaduan({ pdfBuffer: Buffer.from('%PDF'), data: contoh() }, deps), IntakeStop);
  assert.strictEqual(log.length, 0);
});

test('tanggal berformat salah jadi [PERLU CEK] dengan alasan', () => {
  const d = normalizeDates({ ...contoh(), tanggal_surat: '24 Februari 2026', teradu: '[PERLU CEK]' });
  assert.strictEqual(d.tanggal_surat, '[PERLU CEK]');
  assert.ok(d.perlu_cek.some(p => p.kolom === 'tanggal_surat' && p.alasan.includes('24 Februari 2026')));
  assert.ok(d.perlu_cek.some(p => p.kolom === 'teradu'));
});

test('nomor urut, duplikat, dan rumus tautan', () => {
  assert.strictEqual(nextNumber([['1'], ['7'], ['']]), 8);
  assert.strictEqual(nextNumber([]), 1);
  assert.strictEqual(findDuplicate([['1', '', '', '', '', '', '-']], '-'), null);
  assert.strictEqual(hyperlinkFormula('https://a/b"c', 'Surat Pengaduan'), '=HYPERLINK("https://a/b""c","Surat Pengaduan")');
  assert.strictEqual(buildMasterRow(1, contoh())[13], '');
});
