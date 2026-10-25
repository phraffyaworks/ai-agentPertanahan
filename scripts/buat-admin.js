// Membuat akun super admin dashboard (sekali saja): npm run buat-admin
// Kata sandi diketik tanpa tampil di layar. Verifikasi dua langkah disiapkan saat pertama kali masuk.
const readline = require('readline');
const { muatKonfigurasiWeb } = require('../src/web/konfigurasi');
const { createDb } = require('../src/web/db');
const { hashSandi, MIN_SANDI } = require('../src/web/keamanan');

function tanya(teks, sembunyi = false) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (sembunyi) rl._writeToOutput = s => { if (s.includes(teks)) process.stdout.write(s); };
    rl.question(teks, jawab => { rl.close(); if (sembunyi) process.stdout.write('\n'); resolve(jawab.trim()); });
  });
}

async function main() {
  const db = createDb(muatKonfigurasiWeb().fileDb);
  if (db.pengguna.jumlahAdmin()) {
    console.log('Super admin sudah ada. Skrip ini tidak membuat akun kedua.');
    return;
  }
  console.log('Membuat akun super admin dashboard.\n');
  const nama = await tanya('Nama lengkap: ');
  const email = (await tanya('Email: ')).toLowerCase();
  const unit = await tanya('Unit kerja: ');
  let sandi = '';
  for (;;) {
    sandi = await tanya(`Kata sandi (minimal ${MIN_SANDI} karakter, tidak tampil saat diketik): `, true);
    if (sandi.length < MIN_SANDI) { console.log('Terlalu pendek. Coba lagi.'); continue; }
    if (sandi !== await tanya('Ulangi kata sandi: ', true)) { console.log('Tidak sama. Coba lagi.'); continue; }
    break;
  }
  if (!nama || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !unit) {
    console.log('Nama, email, dan unit kerja wajib diisi dengan benar. Jalankan lagi skrip ini.');
    process.exitCode = 1;
    return;
  }
  const id = db.pengguna.buat({ email, nama, unit_kerja: unit, sandi_hash: hashSandi(sandi), peran: 'admin', status: 'aktif' });
  db.audit.catat({ pelaku_id: id, sasaran_id: id, aksi: 'admin_dibuat' });
  console.log('\nSuper admin dibuat. Buka dashboard, masuk, lalu ikuti langkah verifikasi dua langkah.');
  db.tutup();
}

main().catch(err => { console.error('Gagal:', err.message); process.exit(1); });
