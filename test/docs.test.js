const test = require('node:test');
const assert = require('node:assert');
const { buildTelaahan, formatNip } = require('../src/docs/telaahan');
const { buildNotula } = require('../src/docs/notula');
const contohTelaahan = require('./contoh/telaahan.json');
const contohNotula = require('./contoh/notula.json');

const isDocx = buf => buf.subarray(0, 2).toString() === 'PK';

test('Telaahan: docx terbentuk dengan format penanda tangan yang disepakati', async () => {
  const buf = await buildTelaahan(contohTelaahan);
  assert.ok(isDocx(buf));
  const xml = buf.toString('latin1');
  assert.ok(buf.length > 10000);
  assert.ok(!xml.includes('S.Kom<'), 'gelar tanpa titik tidak boleh muncul');
  assert.strictEqual(formatNip('197803142002122003'), 'NIP. 19780314 200212 2 003');
  assert.strictEqual(formatNip('NIP. 19910404 202321 1 026'), 'NIP. 19910404 202321 1 026');
});

test('Telaahan "Bukan Kasus" wajib menyebut tindak lanjut', () => {
  assert.throws(() => buildTelaahan({ ...contohTelaahan, kesimpulan: { kasus: false } }), /tindak_lanjut/);
});

test('Notula: docx terbentuk; isian kosong tidak menggagalkan', async () => {
  assert.ok(isDocx(await buildNotula(contohNotula)));
  assert.ok(isDocx(await buildNotula({ ...contohNotula, pimpinan: {}, tempat: '', waktu: '' })));
});

// Isi document.xml dari .docx (jszip ikut terpasang bersama paket docx).
const JSZip = require('jszip');
const { buildNotaDinas, buildSuratKeluar } = require('../src/docs/surat');
const contohNotaDinas = require('./contoh/nota-dinas.json');
const contohSuratKeluar = require('./contoh/surat-keluar.json');
const docXml = async buf => (await JSZip.loadAsync(buf)).file('word/document.xml').async('string');

test('Nota Dinas: format contoh pengguna (margin 2,54 cm, NIP bertitik, satu tembusan tanpa nomor)', async () => {
  const buf = await buildNotaDinas(contohNotaDinas);
  assert.ok(isDocx(buf));
  const xml = await docXml(buf);
  assert.match(xml, /w:top="1440"[^>]*w:right="1440"/);
  assert.ok(xml.includes('NOTA DINAS'));
  assert.ok(xml.includes('NIP. 19690818 199103 1 004'));
  assert.ok(xml.includes('Tembusan :'));
  // butir 1-4 dan sub-butir a/b bernomor otomatis, tembusan tunggal tidak
  assert.strictEqual((xml.match(/<w:numPr>/g) || []).length, 6);
});

test('Surat Keluar: ruang kop 5,3 cm, nomor kosong berpola putih, NIP bertitik, tembusan bernomor', async () => {
  const xml = await docXml(await buildSuratKeluar(contohSuratKeluar));
  assert.match(xml, /w:top="3005"[^>]*w:right="1077"/);
  assert.match(xml, /w:color w:val="FFFFFF"\/>.*?<w:t[^>]*>\.\.\.\/\.\.\.\.\.-800\.SK\.01\/[IVX]+\/\d{4}</);
  assert.ok(xml.includes('Jakarta,'));
  assert.ok(xml.includes('a.n Direktur Jenderal'));
  assert.ok(xml.includes('Direktur Penanganan Sengketa Pertanahan,'));
  assert.ok(xml.includes('NIP. 19690818 199103 1 004'));
  assert.ok(xml.includes('pump house') && xml.includes('<w:i/>'));
  // 4 butir + 6 sub-butir + 2 tembusan
  assert.strictEqual((xml.match(/<w:numPr>/g) || []).length, 12);
});

test('Surat Keluar: nomor dan tanggal yang diberikan tampil', async () => {
  const xml = await docXml(await buildSuratKeluar({ ...contohSuratKeluar, nomor: '12/800.SK.01/X/2026', tanggal: '21 Oktober 2026' }));
  assert.ok(xml.includes('12/800.SK.01/X/2026'));
  assert.ok(xml.includes('Jakarta, 21 Oktober 2026'));
  assert.ok(!xml.includes('<w:color w:val="FFFFFF"/>'), 'pola nomor putih tidak dipakai bila nomor diberikan');
});

test('Surat Keluar: tanpa penanda tangan, dipasang Direktur PSP a.n Direktur Jenderal', async () => {
  const { penandatangan: _, ...tanpaTtd } = contohSuratKeluar;
  const xml = await docXml(await buildSuratKeluar(tanpaTtd));
  for (const t of ['a.n Direktur Jenderal', 'Direktur Penanganan Sengketa Pertanahan,', 'I Made Daging, A.Ptnh., M.H.', 'NIP. 19690818 199103 1 004']) {
    assert.ok(xml.includes(t), t);
  }

  // Alat buat_surat_keluar menerima data tanpa penandatangan dan menampilkan penanda tangan tetap saat minta persetujuan.
  const { jalankanAlat } = require('../src/agent/alat');
  let ringkasan = '';
  const ctx = {
    google: { drive: { getFolder: async id => ({ id, name: 'PT Cikarang Listrindo - Kabupaten Bekasi' }), listNames: async () => [], uploadFile: async () => ({ webViewLink: 'L' }) } },
    kirimDokumen: async () => {},
    mintaPersetujuan: async r => { ringkasan = r; return { setuju: true }; },
  };
  const r = await jalankanAlat(ctx, { name: 'buat_surat_keluar', input: { folder_id: 'F1', tujuan_singkat: 'Kantah Kab Bekasi', data: tanpaTtd } });
  assert.ok(!r.is_error, r.content);
  assert.match(ringkasan, /a\.n Direktur Jenderal \/ Direktur Penanganan Sengketa Pertanahan \/ I Made Daging/);
  assert.match(JSON.parse(r.content).nama, /^Surat Keluar_Kantah Kab Bekasi_PT Cikarang Listrindo - Kabupaten Bekasi\.docx$/);
});
