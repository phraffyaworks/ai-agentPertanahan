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
