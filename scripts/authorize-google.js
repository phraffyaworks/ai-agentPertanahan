// Sekali jalan: meminta izin akses Google Drive & Sheets lalu menyimpan refresh token ke .env.
// Pemakaian: npm run authorize-google
const fs = require('fs');
const path = require('path');
const http = require('http');
const readline = require('readline');
const { loadConfig } = require('../src/config');
const { SCOPES, createOAuthClient } = require('../src/google/auth');

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/`;
const ENV_FILE = path.join(__dirname, '..', '.env');

function simpanKeEnv(token) {
  const line = `GOOGLE_REFRESH_TOKEN=${token}`;
  let isi = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  isi = /^GOOGLE_REFRESH_TOKEN=.*$/m.test(isi)
    ? isi.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, line)
    : `${isi.replace(/\n?$/, '\n')}${line}\n`;
  fs.writeFileSync(ENV_FILE, isi);
}

async function main() {
  const { google } = loadConfig(['googleClient']);
  const client = createOAuthClient({ ...google, redirectUri: REDIRECT });
  const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });

  console.log('\n1. Buka alamat ini di browser, masuk dengan akun Google pemilik folder Otomasi, lalu klik Izinkan:\n');
  console.log(url);
  console.log('\n2. Bila browser ada di komputer yang sama, proses selesai otomatis.');
  console.log('   Bila tidak (mis. dijalankan di VPS), browser akan menampilkan halaman gagal dimuat.');
  console.log('   Salin alamat lengkap dari address bar halaman itu, tempel di sini, lalu tekan Enter:\n');

  const code = await new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const c = new URL(req.url, REDIRECT).searchParams.get('code');
      res.end(c ? 'Berhasil. Silakan kembali ke terminal.' : 'Kode tidak ditemukan.');
      if (c) { server.close(); rl.close(); resolve(c); }
    }).listen(PORT, '127.0.0.1');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('line', line => {
      const s = line.trim();
      const c = s.startsWith('http') ? new URL(s).searchParams.get('code') : s;
      if (c) { server.close(); rl.close(); resolve(c); }
    });
  });

  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('Google tidak mengirim refresh token. Cabut akses aplikasi di https://myaccount.google.com/permissions lalu ulangi.');
  }
  simpanKeEnv(tokens.refresh_token);
  console.log('\nRefresh token tersimpan di .env (GOOGLE_REFRESH_TOKEN). Lanjutkan dengan: npm run cek');
}

main().catch(err => { console.error('\nGagal:', err.message || err); process.exit(1); });
