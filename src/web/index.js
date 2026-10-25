// Menjalankan dashboard web: npm run web
const { muatKonfigurasiWeb } = require('./konfigurasi');
const { createDb } = require('./db');
const { buatAplikasi } = require('./server');

async function main() {
  const konfigurasi = muatKonfigurasiWeb();
  const db = createDb(konfigurasi.fileDb);
  const app = buatAplikasi({ db, konfigurasi, log: { level: 'info' } });
  await app.listen({ host: konfigurasi.host, port: konfigurasi.port });
  console.log(`Dashboard berjalan di ${konfigurasi.alamat} (mendengarkan ${konfigurasi.host}:${konfigurasi.port}).`);
  if (!db.pengguna.jumlahAdmin()) console.log('Belum ada super admin. Buat dengan: npm run buat-admin');
  const berhenti = async () => { await app.close(); db.tutup(); process.exit(0); };
  process.on('SIGTERM', berhenti);
  process.on('SIGINT', berhenti);
}

main().catch(err => {
  console.error('Dashboard gagal dijalankan:', err.message);
  process.exit(1);
});
