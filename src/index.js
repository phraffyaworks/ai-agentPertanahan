const { loadConfig } = require('./config');
const { createAuthorizedClient } = require('./google/auth');
const { createDrive } = require('./google/drive');
const { createSheets } = require('./google/sheets');
const { createExtractor } = require('./ai/extract');
const { createStore } = require('./state/store');
const { createBot } = require('./telegram/bot');

async function main() {
  const config = loadConfig();
  const auth = createAuthorizedClient(config.google);
  const deps = {
    drive: createDrive(auth),
    sheets: createSheets(auth, config.google),
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
