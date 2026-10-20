const { loadConfig } = require('./config');
const { createGoogle } = require('./google');
const { createStore } = require('./state/store');
const { createRiwayat } = require('./agent/riwayat');
const { createBerkasStore } = require('./agent/berkas');
const { createAgen } = require('./agent/agen');
const { createBot } = require('./telegram/bot');

async function main() {
  const config = loadConfig();
  const google = createGoogle(config.google);
  console.log(`Akses Google lewat ${google.mode}.`);
  const riwayat = createRiwayat(config.dataDir);
  const agen = createAgen({ claude: config.claude, riwayat });
  const berkas = createBerkasStore(config.dataDir, agen.anthropic);
  // Layanan yang dipakai alat asisten.
  const ctxAlat = {
    google,
    drive: google.drive,
    sheets: google.sheets,
    store: createStore(config.dataDir),
    berkas,
    folderIndukId: config.google.folderIndukId,
  };
  if (!config.telegram.allowedUserIds.length) {
    console.warn('TELEGRAM_ALLOWED_USER_IDS masih kosong: bot hanya menjawab /id. Isi ID Anda di .env lalu jalankan ulang.');
  }
  const bot = createBot(config, { agen, riwayat, berkas, ctxAlat });
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => bot.stop());
  await bot.start({ onStart: me => console.log(`Bot @${me.username} berjalan. Tekan Ctrl+C untuk berhenti.`) });
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
