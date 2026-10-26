// Membuat tautan kata sandi baru dari terminal VPS, terutama untuk akun super admin yang lupa kata sandi
// atau kehilangan ponsel 2FA:  su - agen -c "cd agen-dashboard && npm run atur-sandi"
const readline = require('readline');
const { muatKonfigurasiWeb } = require('../src/web/konfigurasi');
const { createDb } = require('../src/web/db');
const K = require('../src/web/keamanan');

const UMUR = 24 * 3600e3;
// Jawaban dibaca lewat antrean baris, supaya tidak ada yang hilang.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const antrean = [], penunggu = [];
let tertutup = false;
rl.on('line', l => (penunggu.length ? penunggu.shift()(l) : antrean.push(l)));
rl.on('close', () => { tertutup = true; while (penunggu.length) penunggu.shift()(''); });
function tanya(teks) {
  rl.setPrompt(teks);
  rl.prompt();
  const j = antrean.length ? Promise.resolve(antrean.shift()) : tertutup ? Promise.resolve('') : new Promise(r => penunggu.push(r));
  return j.then(x => x.trim());
}

async function main() {
  const konfigurasi = muatKonfigurasiWeb();
  const db = createDb(konfigurasi.fileDb);
  const email = (await tanya('Email akun: ')).toLowerCase();
  const p = db.pengguna.olehEmail(email);
  if (!p) { console.log('Akun dengan email itu tidak ditemukan.'); process.exitCode = 1; return; }
  if (p.peran === 'admin' && p.totp_enc && /^y/i.test(await tanya('Hapus juga verifikasi dua langkah (bila ponsel hilang)? Ketik "ya" atau Enter untuk tidak: '))) {
    db.pengguna.simpanTotp(p.id, null);
    db.audit.catat({ sasaran_id: p.id, aksi: '2fa_dihapus_terminal' });
    console.log('Verifikasi dua langkah dihapus. Saat masuk berikutnya, Anda diminta menyiapkannya lagi.');
  }
  const token = K.tokenAcak(32);
  db.kodePasang.buat({ jenis: 'reset', kode_hash: K.sha256(token), pengguna_id: p.id, umurMs: UMUR });
  db.audit.catat({ sasaran_id: p.id, aksi: 'reset_sandi_dibuat_terminal' });
  console.log(`\nBuka tautan ini di browser (berlaku 24 jam, sekali pakai):\n${konfigurasi.alamat}/atur-sandi/${token}\n`);
  console.log('Jangan bagikan tautan ini ke orang lain.');
  db.tutup();
}

main().catch(err => { console.error('Gagal:', err.message); process.exitCode = 1; }).finally(() => rl.close());
