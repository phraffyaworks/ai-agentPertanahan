// Penyiapan .env dashboard (dipanggil deploy/pasang-dashboard.sh): alamat, kunci utama, template Google.
// Nilai yang sudah ada cukup dikonfirmasi dengan Enter. APP_MASTER_KEY dibuat sekali dan tidak pernah diganti.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns').promises;
const readline = require('readline');
const dotenv = require('dotenv');

const FILE = path.join(__dirname, '..', '.env');
const lama = fs.existsSync(FILE) ? dotenv.parse(fs.readFileSync(FILE)) : {};
// Jawaban dibaca baris demi baris lewat antrean, supaya tidak ada yang hilang saat menunggu pemeriksaan DNS.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const antrean = [], penunggu = [];
let tertutup = false;
rl.on('line', l => (penunggu.length ? penunggu.shift()(l) : antrean.push(l)));
rl.on('close', () => { tertutup = true; while (penunggu.length) penunggu.shift()(''); });
function tanya(teks, bawaan = '') {
  rl.setPrompt(bawaan ? `${teks} [${bawaan}]: ` : `${teks}: `);
  rl.prompt();
  const ambil = antrean.length ? Promise.resolve(antrean.shift()) : tertutup ? Promise.resolve('') : new Promise(r => penunggu.push(r));
  return ambil.then(j => j.trim() || bawaan);
}

// Pertanyaan rahasia: ketikan tidak ditampilkan di layar.
let senyap = false;
const tulisAsli = rl._writeToOutput.bind(rl);
rl._writeToOutput = t => { if (!senyap || t === rl.getPrompt()) tulisAsli(t); };
async function tanyaRahasia(teks, ada) {
  senyap = true;
  const j = await tanya(ada ? `${teks} (Enter = pakai yang tersimpan)` : teks);
  senyap = false;
  process.stdout.write('\n');
  return j;
}

// Menguji kunci Claude dengan meminta daftar model (gratis, tidak memakai token).
async function ujiKunciClaude(kunci) {
  try {
    const r = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      headers: { 'x-api-key': kunci, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(15000),
    });
    if (r.status === 200) return { ok: true };
    if (r.status === 401 || r.status === 403) return { ok: false, pesan: 'Kunci ditolak Anthropic. Periksa lagi, atau buat kunci baru di Claude Console.' };
    return { ok: false, pesan: `Anthropic menjawab HTTP ${r.status}.` };
  } catch (err) {
    return { ok: null, pesan: `Tidak bisa menghubungi Anthropic (${err.message}).` };
  }
}

async function ipPublik() {
  try {
    const res = await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(8000) });
    return (await res.text()).trim();
  } catch {
    return null;
  }
}

async function cekDns(host) {
  const [alamat, ip] = await Promise.all([dns.resolve4(host).catch(() => []), ipPublik()]);
  if (!alamat.length) return { ok: false, pesan: `Subdomain ${host} belum mengarah ke mana pun.` };
  if (ip && !alamat.includes(ip)) return { ok: false, pesan: `Subdomain ${host} mengarah ke ${alamat.join(', ')}, padahal IP server ini ${ip}.` };
  return { ok: true, pesan: `DNS benar: ${host} mengarah ke ${alamat.join(', ')}.` };
}

async function main() {
  console.log('Penyiapan dashboard. Tekan Enter untuk memakai nilai di dalam kurung.\n');
  let host;
  for (;;) {
    const bawaan = lama.WEB_BASE_URL ? new URL(lama.WEB_BASE_URL).host : 'agen.phraffyaworks.tech';
    host = (await tanya('Alamat dashboard (subdomain)', bawaan)).replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) { console.log('Alamat tidak sah. Contoh: agen.phraffyaworks.tech\n'); continue; }
    const d = await cekDns(host);
    console.log(d.pesan);
    if (d.ok) break;
    const ip = await ipPublik();
    console.log(`\nTambahkan dulu data DNS di hPanel: Domain → ${host.split('.').slice(-2).join('.')} → DNS / Nameserver → Kelola data DNS.`);
    console.log(`  Jenis: A   Nama: ${host.split('.').slice(0, -2).join('.') || '@'}   Mengarah ke: ${ip || '(IP VPS Anda di hPanel)'}   TTL: 3600`);
    console.log('Perubahan DNS biasanya aktif dalam 5–30 menit.');
    if ((await tanya('\nKetik "lanjut" untuk tetap melanjutkan, atau Enter untuk memeriksa lagi', '')).toLowerCase() === 'lanjut') break;
  }
  console.log('\nID template Google: lihat docs/TEMPLATE-GOOGLE.md. Boleh dikosongkan dulu dan diisi nanti dengan menjalankan pemasangan lagi.');
  const template = await tanya('ID template Google', lama.GOOGLE_TEMPLATE_ID || '');

  console.log('\nKontak super admin yang ditampilkan di halaman Lupa kata sandi (boleh kosong). Contoh: WhatsApp 0812-3456-7890 (Raffy)');
  const kontak = await tanya('Kontak super admin', lama.ADMIN_KONTAK || '');

  console.log('\nKunci Claude API untuk dashboard (dari Claude Console → API keys). Disarankan kunci baru khusus dashboard,');
  console.log('terpisah dari kunci bot versi 1, supaya biayanya terlihat terpisah. Ketikan tidak tampil di layar.');
  let kunciClaude = lama.ANTHROPIC_API_KEY || '';
  for (;;) {
    const j = await tanyaRahasia('Kunci Claude API', !!kunciClaude);
    if (j) kunciClaude = j;
    if (!kunciClaude) { console.log('Boleh dikosongkan dulu; menu Chat belum bisa dipakai sampai kunci diisi.'); break; }
    if (!/^sk-ant-/.test(kunciClaude)) { console.log('Kunci Claude diawali "sk-ant-". Coba lagi.'); kunciClaude = lama.ANTHROPIC_API_KEY || ''; continue; }
    const u = await ujiKunciClaude(kunciClaude);
    if (u.ok) { console.log('Kunci Claude diterima.'); break; }
    console.log(u.pesan);
    if (u.ok === null && (await tanya('Ketik "lanjut" untuk tetap menyimpan, atau Enter untuk mencoba lagi', '')).toLowerCase() === 'lanjut') break;
    kunciClaude = lama.ANTHROPIC_API_KEY || '';
  }
  rl.close();

  const nilai = {
    ...lama,
    WEB_BASE_URL: `https://${host}`,
    WEB_HOST: '127.0.0.1',
    WEB_PORT: lama.WEB_PORT || '3000',
    APP_MASTER_KEY: lama.APP_MASTER_KEY || crypto.randomBytes(32).toString('base64'),
    GOOGLE_TEMPLATE_ID: template,
    ANTHROPIC_API_KEY: kunciClaude,
    ADMIN_KONTAK: kontak,
  };
  const isi = ['# Dibuat oleh scripts/setup-dashboard.js. Jangan bagikan isi file ini.',
    ...Object.entries(nilai).map(([k, v]) => `${k}=${/[\s#"']/.test(v) ? JSON.stringify(v) : v}`)].join('\n') + '\n';
  fs.writeFileSync(FILE, isi, { mode: 0o600 });
  fs.chmodSync(FILE, 0o600);
  console.log(`\nPengaturan tersimpan di ${FILE} (hanya bisa dibaca pengguna agen).`);
  if (!lama.APP_MASTER_KEY) console.log('Kunci utama baru dibuat. JANGAN hapus atau ganti APP_MASTER_KEY setelah ada pengguna.');
}

main().catch(err => { console.error('Gagal:', err.message); process.exit(1); });
