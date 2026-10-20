// Memeriksa semua sambungan tanpa mengubah apa pun: Telegram, Google Drive, Google Sheets, Claude API.
// Pemakaian: npm run cek
const Anthropic = require('@anthropic-ai/sdk').default;
const { Bot } = require('grammy');
const { loadConfig } = require('../src/config');
const { createGoogle } = require('../src/google');

const hasil = [];
async function cek(nama, fn) {
  try { hasil.push(`OK     ${nama}: ${await fn()}`); }
  catch (err) { hasil.push(`GAGAL  ${nama}: ${err.message || err}`); }
}

async function main() {
  let config;
  try { config = loadConfig([]); } catch (err) { console.error(err.message); process.exit(1); }
  const env = (g, fn) => async () => { loadConfig([g]); return fn(); };

  await cek('Telegram', env('telegram', async () => {
    const me = await new Bot(config.telegram.token).api.getMe();
    return `bot @${me.username}; akun yang diizinkan: ${config.telegram.allowedUserIds.join(', ')}`;
  }));
  await cek('Google Drive', env('google', async () => {
    const f = await createGoogle(config.google).drive.getFolder(config.google.folderIndukId);
    if (f.trashed) throw new Error(`folder "${f.name}" ada di Sampah`);
    return `folder induk "${f.name}" (lewat ${createGoogle(config.google).mode})`;
  }));
  await cek('Google Sheets', env('google', async () => {
    const h = await createGoogle(config.google).sheets.checkHeader();
    if (!h.ok) throw new Error(`header Master Data berbeda: ${h.beda.map(b => `${b.kolom} "${b.ada}"`).join(', ')}`);
    return 'header Master Data A–P sesuai';
  }));
  await cek('Claude API', env('claude', async () => {
    const m = await new Anthropic({ apiKey: config.claude.apiKey }).models.retrieve(config.claude.model);
    return `model ${m.id} tersedia`;
  }));

  console.log(hasil.join('\n'));
  process.exit(hasil.some(h => h.startsWith('GAGAL')) ? 1 : 0);
}

main();
