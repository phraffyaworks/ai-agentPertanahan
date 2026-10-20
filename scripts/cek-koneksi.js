// Memeriksa semua sambungan tanpa mengubah apa pun: Telegram, Google Drive, Google Sheets, Claude API.
// Pemakaian: npm run cek
const { Bot } = require('grammy');
const { loadConfig } = require('../src/config');
const { createGoogle } = require('../src/google');
const { createAgen } = require('../src/agent/agen');
const { VERSI_APPS_SCRIPT } = require('../src/google/appsscript');

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
  await cek('Apps Script', env('google', async () => {
    const g = createGoogle(config.google);
    if (!g.client) return 'tidak dipakai (akses lewat OAuth; Gmail dan Kalender tidak tersedia)';
    const { versi, akun } = await g.client.call('ping');
    if (Number(versi) < VERSI_APPS_SCRIPT) throw new Error(`skrip versi ${versi}, perlu versi ${VERSI_APPS_SCRIPT}. Perbarui skrip (docs/APPS-SCRIPT.md, bagian Memperbarui).`);
    return `versi ${versi}, akun ${akun}`;
  }));
  // Permintaan sungguhan dengan prompt, alat, dan pengaturan lengkap: memastikan API menerimanya.
  await cek('Claude API', env('claude', async () => {
    const jawab = await createAgen({ claude: config.claude, riwayat: null }).ujiCoba();
    return `model ${config.claude.model} menjawab: "${jawab.slice(0, 60)}"`;
  }));

  console.log(hasil.join('\n'));
  process.exit(hasil.some(h => h.startsWith('GAGAL')) ? 1 : 0);
}

main();
