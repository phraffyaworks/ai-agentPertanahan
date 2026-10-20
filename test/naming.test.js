const test = require('node:test');
const assert = require('node:assert');
const { folderName, pdfName, signedTelaahanName, sanitizeName, uniqueName, PERLU_CEK } = require('../src/util/naming');

test('nama folder mengikuti format "Nama Pengadu - Kota/Kabupaten"', () => {
  assert.strictEqual(folderName('PT Razio Setia Mukti', 'Kabupaten Bekasi', 'x.pdf'), 'PT Razio Setia Mukti - Kabupaten Bekasi');
});

test('nama PDF dan TTD mengikuti nama folder', () => {
  const f = 'PT Razio Setia Mukti - Kabupaten Bekasi';
  assert.strictEqual(pdfName(f), 'PT Razio Setia Mukti - Kabupaten Bekasi.pdf');
  assert.strictEqual(signedTelaahanName(f), 'Telaahan Staff_PT Razio Setia Mukti - Kabupaten Bekasi_ttd.pdf');
});

test('karakter terlarang dibuang', () => {
  assert.strictEqual(sanitizeName('CV A/B: "Maju"*?'), 'CV A B Maju');
});

test('bagian tak terbaca jadi [PERLU CEK]; bila keduanya, pakai nama file asli', () => {
  assert.strictEqual(folderName(PERLU_CEK, 'Kota Bogor', 'a.pdf'), `${PERLU_CEK} - Kota Bogor`);
  assert.strictEqual(folderName('-', PERLU_CEK, 'Document_1.pdf'), `${PERLU_CEK} Document_1`);
});

test('nama yang sudah dipakai diberi nomor', () => {
  assert.strictEqual(uniqueName('A.pdf', ['A.pdf', 'A (2).pdf']), 'A (3).pdf');
  assert.strictEqual(uniqueName('A.pdf', ['B.pdf']), 'A.pdf');
});

test('file .env: nilai diganti di tempat, komentar tetap, izin 600', () => {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const { readEnv, setEnvValues } = require('../src/util/envfile');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-'));
  const tpl = path.join(dir, '.env.example'); const f = path.join(dir, '.env');
  fs.writeFileSync(tpl, '# komentar\nA=\nB=lama\n');
  setEnvValues(f, { B: 'baru$&', C: 'tambah' }, tpl);
  assert.strictEqual(fs.readFileSync(f, 'utf8'), '# komentar\nA=\nB=baru$&\nC=tambah\n');
  assert.deepStrictEqual(readEnv(f), { A: '', B: 'baru$&', C: 'tambah' });
  assert.strictEqual(fs.statSync(f).mode & 0o777, 0o600);
});
