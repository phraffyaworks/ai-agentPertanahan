// Memeriksa sambungan server MCP Hermes tanpa mengubah apa pun: Google Drive, Sheets, Apps Script,
// kunci Claude untuk baca_berkas, dan folder berkas Hermes. Pemakaian: npm run cek-mcp
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk').default;
const { loadConfig } = require('../src/config');
const { createGoogle } = require('../src/google');
const { VERSI_APPS_SCRIPT } = require('../src/google/appsscript');
const { pengaturanAlat } = require('../src/mcp/alat');

const hasil = [];
async function cek(nama, fn) {
  try { hasil.push(`OK     ${nama}: ${await fn()}`); }
  catch (err) { hasil.push(`GAGAL  ${nama}: ${err.message || err}`); }
}

async function main() {
  let config;
  try { config = loadConfig(['google']); } catch (err) { console.error(err.message); process.exit(1); }
  const google = createGoogle(config.google);

  await cek('Google Drive', async () => {
    const f = await google.drive.getFolder(config.google.folderIndukId);
    if (f.trashed) throw new Error(`folder "${f.name}" ada di Sampah`);
    return `folder induk "${f.name}"`;
  });
  await cek('Google Sheets', async () => {
    const h = await google.sheets.checkHeader();
    if (!h.ok) throw new Error(`header Master Data berbeda: ${h.beda.map(b => `${b.kolom} "${b.ada}"`).join(', ')}`);
    return 'header Master Data A–P sesuai';
  });
  await cek('Apps Script', async () => {
    if (!google.client) throw new Error('APPS_SCRIPT_URL belum diisi; Gmail dan Kalender tidak tersedia');
    const { versi, akun } = await google.client.call('ping');
    if (Number(versi) < VERSI_APPS_SCRIPT) throw new Error(`skrip versi ${versi}, perlu versi ${VERSI_APPS_SCRIPT}`);
    return `versi ${versi}, akun ${akun}`;
  });
  // Hanya membaca keterangan model (gratis), untuk memastikan kunci dan nama model diterima.
  await cek('Claude API (baca_berkas)', async () => {
    if (!config.claude.apiKey) throw new Error('ANTHROPIC_API_KEY belum diisi; alat baca_berkas tidak bisa dipakai');
    const m = await new Anthropic({ apiKey: config.claude.apiKey }).models.retrieve(config.claude.model);
    return `model ${m.id} tersedia`;
  });
  await cek('Folder berkas Hermes', async () => {
    const p = pengaturanAlat();
    const ada = fs.existsSync(p.folderMasuk);
    return `${ada ? 'ada' : 'belum ada (dibuat Hermes saat berkas pertama diterima)'}: ${p.folderMasuk}; file Word disimpan di ${p.folderKeluaran}`;
  });

  console.log(hasil.join('\n'));
  process.exit(hasil.some(h => h.startsWith('GAGAL')) ? 1 : 0);
}

main();
