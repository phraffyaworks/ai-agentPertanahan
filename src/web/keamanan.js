// Fungsi keamanan dashboard: hash kata sandi, enkripsi rahasia, token acak, dan kode 2FA (TOTP).
// Hanya memakai modul crypto bawaan Node, tanpa paket tambahan.
const crypto = require('crypto');

// ---------- kata sandi (scrypt) ----------
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const MIN_SANDI = 10;

function hashSandi(sandi) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(sandi, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

function cocokSandi(sandi, tersimpan) {
  const [jenis, N, r, p, salt, hash] = String(tersimpan || '').split('$');
  if (jenis !== 'scrypt' || !hash) return false;
  const harap = Buffer.from(hash, 'base64');
  const dapat = crypto.scryptSync(String(sandi), Buffer.from(salt, 'base64'), harap.length, { N: Number(N), r: Number(r), p: Number(p) });
  return crypto.timingSafeEqual(harap, dapat);
}

// Hash palsu untuk menyamakan waktu respons saat email tidak terdaftar.
const HASH_PALSU = hashSandi(crypto.randomBytes(16).toString('hex'));

// ---------- enkripsi rahasia (AES-256-GCM) ----------
// Kunci utama 32 byte (base64) dari APP_MASTER_KEY di .env. Format hasil: v1:iv:tag:isi (base64).
function kunciUtama(base64) {
  const k = Buffer.from(String(base64 || ''), 'base64');
  if (k.length !== 32) throw new Error('APP_MASTER_KEY harus 32 byte dalam base64. Buat dengan: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
  return k;
}

function enkripsi(teks, kunci) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', kunci, iv);
  const isi = Buffer.concat([c.update(String(teks), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), isi.toString('base64')].join(':');
}

function dekripsi(sandiTeks, kunci) {
  const [v, iv, tag, isi] = String(sandiTeks || '').split(':');
  if (v !== 'v1' || !isi) throw new Error('Data terenkripsi tidak dikenali.');
  const d = crypto.createDecipheriv('aes-256-gcm', kunci, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(isi, 'base64')), d.final()]).toString('utf8');
}

// ---------- token acak ----------
const tokenAcak = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const samaAman = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
// Kode angka untuk dipasangkan (mis. Google, Telegram): mudah diketik orang awam.
const kodeAngka = (digit = 6) => String(crypto.randomInt(0, 10 ** digit)).padStart(digit, '0');

// ---------- TOTP (RFC 6238: SHA-1, 30 detik, 6 digit) ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(buf) {
  let bits = '', out = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}

function dariBase32(s) {
  const bits = String(s).toUpperCase().replace(/[\s=]/g, '').split('')
    .map(ch => { const i = B32.indexOf(ch); if (i < 0) throw new Error('Kunci 2FA tidak sah.'); return i.toString(2).padStart(5, '0'); }).join('');
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

const rahasiaTotp = () => base32(crypto.randomBytes(20));

function kodeTotp(rahasia, waktuMs = Date.now(), langkah = 30, digit = 6) {
  const hitung = Buffer.alloc(8);
  hitung.writeBigUInt64BE(BigInt(Math.floor(waktuMs / 1000 / langkah)));
  const h = crypto.createHmac('sha1', dariBase32(rahasia)).update(hitung).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digit).padStart(digit, '0');
}

// Menerima kode dari periode sekarang serta satu periode sebelum dan sesudahnya (jam HP sedikit meleset).
function cekTotp(rahasia, kode, waktuMs = Date.now()) {
  const k = String(kode || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(k)) return false;
  return [-1, 0, 1].some(d => samaAman(kodeTotp(rahasia, waktuMs + d * 30000), k));
}

const uriTotp = (rahasia, email, penerbit = 'Agen Pertanahan') =>
  `otpauth://totp/${encodeURIComponent(`${penerbit}:${email}`)}?secret=${rahasia}&issuer=${encodeURIComponent(penerbit)}&algorithm=SHA1&digits=6&period=30`;

module.exports = {
  MIN_SANDI, hashSandi, cocokSandi, HASH_PALSU,
  kunciUtama, enkripsi, dekripsi,
  tokenAcak, sha256, samaAman, kodeAngka,
  base32, dariBase32, rahasiaTotp, kodeTotp, cekTotp, uriTotp,
};
