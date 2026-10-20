// Penyiapan terpandu: menanyakan setiap nilai, mengujinya langsung, lalu menyimpannya ke .env.
// Pemakaian: npm run setup   (aman dijalankan ulang; nilai lama bisa dipakai lagi dengan Enter)
const path = require('path');
const readline = require('readline/promises');
const { spawnSync } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk').default;
const { Bot } = require('grammy');
const { readEnv, setEnvValues } = require('../src/util/envfile');
const { newSecret, createAppsScriptClient } = require('../src/google/appsscript');
const { loadConfig } = require('../src/config');

const ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const env = readEnv(ENV_FILE);
const samar = v => (v.length > 8 ? `…${v.slice(-4)}` : '(terisi)');

async function tanya(kunci, judul, uji) {
  for (;;) {
    const lama = env[kunci];
    const isi = (await rl.question(`${judul}${lama ? ` [Enter = pakai ${samar(lama)}]` : ''}:\n> `)).trim() || lama;
    if (!isi) { console.log('  Wajib diisi.\n'); continue; }
    try {
      const info = uji ? await uji(isi) : null;
      if (info) console.log(`  OK: ${info}\n`);
      env[kunci] = isi;
      setEnvValues(ENV_FILE, { [kunci]: isi }, path.join(ROOT, '.env.example'));
      return isi;
    } catch (err) {
      console.log(`  Gagal: ${err.message || err}\n  Coba lagi.\n`);
    }
  }
}

// Mencari ID akun dari pesan yang baru dikirim ke bot, sehingga pengguna tidak perlu tahu ID-nya.
async function cariIdTelegram(token) {
  const bot = new Bot(token);
  const me = await bot.api.getMe();
  for (;;) {
    await rl.question(`Buka Telegram, kirim pesan apa saja (mis. "halo") ke @${me.username}, lalu tekan Enter di sini.`);
    let updates;
    try {
      updates = await bot.api.getUpdates({ timeout: 5 });
    } catch (err) {
      console.log(`  Gagal membaca pesan: ${err.message}. Pastikan bot tidak sedang dijalankan di komputer lain.\n`);
      continue;
    }
    const pengirim = new Map();
    for (const u of updates) {
      const m = u.message;
      if (m?.chat?.type === 'private' && m.from) pengirim.set(m.from.id, [m.from.first_name, m.from.last_name].filter(Boolean).join(' '));
    }
    if (!pengirim.size) { console.log('  Belum ada pesan masuk. Coba kirim lagi.\n'); continue; }
    for (const [id, nama] of pengirim) {
      const jwb = (await rl.question(`  Pesan dari "${nama}" (ID ${id}). Ini akun Anda? (y/t) `)).trim().toLowerCase();
      if (jwb === 'y') {
        // Tandai pesan sudah dibaca supaya tidak diproses ulang saat bot dijalankan.
        await bot.api.getUpdates({ offset: updates[updates.length - 1].update_id + 1, timeout: 0 });
        return String(id);
      }
    }
  }
}

function jalankan(script) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script)], { stdio: 'inherit', cwd: ROOT });
  return r.status === 0;
}

async function main() {
  console.log('\n=== Penyiapan Agen Pengaduan Pertanahan ===\n');

  console.log('Langkah A: Telegram');
  const token = await tanya('TELEGRAM_BOT_TOKEN', 'Tempel token bot dari @BotFather', async t => {
    const me = await new Bot(t).api.getMe();
    return `bot @${me.username}`;
  });
  if (env.TELEGRAM_ALLOWED_USER_IDS) {
    const ganti = (await rl.question(`ID Telegram yang diizinkan: ${env.TELEGRAM_ALLOWED_USER_IDS}. Ganti? (y/t) `)).trim().toLowerCase();
    if (ganti === 'y') delete env.TELEGRAM_ALLOWED_USER_IDS;
  }
  if (!env.TELEGRAM_ALLOWED_USER_IDS) {
    const id = await cariIdTelegram(token);
    env.TELEGRAM_ALLOWED_USER_IDS = id;
    setEnvValues(ENV_FILE, { TELEGRAM_ALLOWED_USER_IDS: id });
    console.log(`  OK: hanya akun ID ${id} yang dilayani bot.\n`);
  }

  console.log('Langkah B: Google Drive & Sheets (lewat Apps Script, lihat docs/APPS-SCRIPT.md)');
  // Kode rahasia dibuat di sini dan dipasangkan ke skrip; pengguna tidak perlu menyalinnya.
  if (!env.APPS_SCRIPT_SECRET) {
    env.APPS_SCRIPT_SECRET = newSecret();
    setEnvValues(ENV_FILE, { APPS_SCRIPT_SECRET: env.APPS_SCRIPT_SECRET }, path.join(ROOT, '.env.example'));
  }
  const { google } = loadConfig([]);
  await tanya('APPS_SCRIPT_URL', 'Tempel alamat Web App Apps Script (diawali https://script.google.com/macros/s/ dan diakhiri /exec)', async url => {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) {
      throw new Error('bentuknya bukan alamat Web App. Salin "Web app URL" yang diakhiri /exec.');
    }
    const client = createAppsScriptClient({ url, secret: env.APPS_SCRIPT_SECRET });
    await client.call('pasang', { secret: env.APPS_SCRIPT_SECRET });
    const { akun } = await client.call('ping');
    const folder = await client.call('driveGetFolder', { id: google.folderIndukId });
    return `terhubung sebagai ${akun}; folder induk "${folder.name}" bisa dibuka`;
  });

  console.log('Langkah C: Claude');
  await tanya('ANTHROPIC_API_KEY', 'Tempel kunci Claude API (diawali sk-ant-)', async k => {
    const m = await new Anthropic({ apiKey: k }).models.retrieve('claude-opus-5-5');
    return `model ${m.id} tersedia`;
  });

  rl.close();

  console.log('\nLangkah D: pemeriksaan akhir');
  process.exit(jalankan('cek-koneksi.js') ? 0 : 1);
}

main().catch(err => { console.error('\nGagal:', err.message || err); process.exit(1); });
