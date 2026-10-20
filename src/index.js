const { loadConfig } = require('./config');
const { createGoogle } = require('./google');
const { createExtractor } = require('./ai/extract');
const { createStore } = require('./state/store');
const { createBot } = require('./telegram/bot');

async function main() {
  const config = loadConfig();
  const google = createGoogle(config.google);
  console.log(`Akses Google lewat ${google.mode}.`);
  const deps = {
    drive: google.drive,
    sheets: google.sheets,
    extract: createExtractor(config.claude),
    store: createStore(config.dataDir),
    folderIndukId: config.google.folderIndukId,
  };
  if (!config.telegram.allowedUserIds.length) {
    console.warn('TELEGRAM_ALLOWED_USER_IDS masih kosong: bot hanya menjawab /id. Isi ID Anda di .env lalu jalankan ulang.');
  }
  const bot = createBot(config, deps);
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => bot.stop());
  await bot.start({ onStart: me => console.log(`Bot @${me.username} berjalan. Tekan Ctrl+C untuk berhenti.`) });
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
