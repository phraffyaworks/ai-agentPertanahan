// Pengaturan dashboard web, dibaca dari .env yang sama dengan bot.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const { kunciUtama } = require('./keamanan');

const ambil = (nama, bawaan) => {
  const v = process.env[nama];
  return v !== undefined && v.trim() !== '' ? v.trim() : bawaan;
};

function muatKonfigurasiWeb() {
  const alamat = ambil('WEB_BASE_URL', 'http://localhost:3000');
  return {
    alamat,
    host: ambil('WEB_HOST', '127.0.0.1'),
    port: Number(ambil('WEB_PORT', '3000')),
    fileDb: ambil('WEB_DB', path.join(__dirname, '..', '..', 'data', 'web.db')),
    // Cookie "Secure" wajib di HTTPS; hanya dimatikan untuk uji di komputer sendiri (http://localhost).
    cookieAman: !alamat.startsWith('http://'),
    // Caddy berjalan di server yang sama, jadi hanya 127.0.0.1 yang dipercaya sebagai proksi.
    percayaProksi: '127.0.0.1',
    kunciUtama: kunciUtama(ambil('APP_MASTER_KEY', '')),
  };
}

module.exports = { muatKonfigurasiWeb };
