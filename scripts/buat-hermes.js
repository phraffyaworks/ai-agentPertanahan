// Membangkitkan berkas untuk Hermes Agent dari aturan bot, supaya keduanya memakai aturan yang sama:
//   hermes/SOUL.md                     cara berkomunikasi dan persetujuan (selalu dimuat Hermes)
//   hermes/SOUL-tambahan.md            versi pendek, untuk disambung ke SOUL.md milik pengguna
//   hermes/skills/pertanahan-*/SKILL.md alur pengaduan, Telaahan, Notula, Nota Dinas/Surat Keluar
// Sumber: src/agent/prompt.js, docs/KEPUTUSAN.md, src/agent/pengetahuan/*.md.
// Jalankan "npm run hermes" setiap kali sumber itu berubah; "--cek" hanya memeriksa (dipakai uji otomatis).
const fs = require('fs');
const path = require('path');
const { systemPrompt } = require('../src/agent/prompt');

const ROOT = path.join(__dirname, '..');
const KELUAR = path.join(ROOT, 'hermes');
const baca = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8').trim();
const VERSI = require('../package.json').version;
const PERINGATAN = '<!-- Dibuat otomatis oleh scripts/buat-hermes.js dari aturan bot. Jangan diubah di sini: ubah sumbernya, lalu jalankan "npm run hermes". -->';

// Bagian prompt bot di antara dua judul.
function bagian(teks, dari, sampai) {
  const a = teks.indexOf(dari);
  const b = sampai ? teks.indexOf(sampai) : teks.length;
  if (a < 0 || b < 0 || b < a) throw new Error(`Judul "${dari}" atau "${sampai}" tidak ditemukan di prompt bot.`);
  return teks.slice(a, b).trim();
}

// Penyesuaian kalimat yang khusus bot Telegram. Setiap teks lama wajib ada, supaya perubahan prompt bot ketahuan.
function ganti(teks, pasangan) {
  return pasangan.reduce((t, [lama, baru]) => {
    if (!t.includes(lama)) throw new Error(`Teks yang akan disesuaikan untuk Hermes tidak ditemukan: "${lama.slice(0, 60)}..."`);
    return t.replace(lama, baru);
  }, teks);
}

// Judul dokumen sumber diturunkan dua tingkat supaya berada di bawah judul skill.
const turunkan = md => md.replace(/^(#{1,4}) /gm, (_, h) => `${h}## `);

function bangun() {
  const prompt = systemPrompt();
  const pembuka = bagian(prompt, '', '## Cara berkomunikasi');
  const komunikasi = ganti(bagian(prompt, '## Cara berkomunikasi', '## Persetujuan'), [
    ['- Setiap pesan pengguna diawali waktu saat itu (WIB). Pakai itu untuk memahami "hari ini", "besok", dan sebagainya; zona waktu Asia/Jakarta (+07:00).',
      '- Zona waktu pengguna Asia/Jakarta (+07:00, WIB). Bila tanggal hari ini tidak jelas, pastikan dulu; jangan menebak.'],
    ['- Berkas dari pengguna muncul sebagai "[Berkas B<n>: nama]" disertai isinya. Rujuk berkas dengan ID itu saat memakai alat.',
      '- Berkas dari pengguna muncul sebagai catatan Hermes berisi lokasi filenya ("It is saved at: <lokasi>"). Baca isinya dengan alat baca_berkas (bukan terminal atau OCR), lalu rujuk berkas dengan lokasi itu (isian "berkas") saat memakai alat lain. Bila lokasinya tidak ada lagi di percakapan, pakai lihat_berkas.'],
  ]);
  const persetujuan = ganti(bagian(prompt, '## Persetujuan', '## Alur pekerjaan pengaduan'), [
    ['otomatis menampilkan tombol Setujui/Tolak kepada pengguna', 'otomatis meminta persetujuan pengguna lewat tombol persetujuan Hermes'],
  ]);
  const alur = ganti(bagian(prompt, '## Alur pekerjaan pengaduan', '## Keputusan pengguna'), [
    ['baca seluruh halaman, lalu panggil catat_pengaduan', 'baca seluruh halaman dengan baca_berkas, lalu panggil catat_pengaduan'],
  ]);
  const email = bagian(prompt, '## Email dan jadwal', null);
  const keputusan = `## Keputusan pengguna (aturan tetap; berlaku di atas aturan lain bila berbeda)\n\n${turunkan(baca('docs/KEPUTUSAN.md'))}`;
  const dokumen = '## File dokumen\nAlat buat_telaahan, buat_notula, buat_nota_dinas, dan buat_surat_keluar menyimpan file di folder pengadu di Drive. Hasil alatnya berisi baris "MEDIA:<lokasi>": salin baris itu persis ke balasan supaya file .docx terkirim ke chat.';

  const soul = [PERINGATAN, pembuka, komunikasi, persetujuan, email,
    '## Pekerjaan pertanahan\nUntuk pengaduan, Master Data, folder pengadu, Telaahan Staf, Notula Gelar Kasus Awal, Nota Dinas, atau Surat Keluar, muat skill pertanahan-pengaduan lebih dulu, lalu skill dokumen yang sesuai (pertanahan-telaahan, pertanahan-notula, pertanahan-surat). Semua alatnya berasal dari server MCP "pertanahan".',
    dokumen].join('\n\n');

  const skill = (nama, deskripsi, isi) => [
    '---', `name: ${nama}`, `description: ${JSON.stringify(deskripsi)}`, `version: ${VERSI}`,
    'metadata:', '  hermes:', '    category: pertanahan', '    tags: [pertanahan, atr-bpn, sengketa]', '---',
  ].join('\n') + '\n' + [PERINGATAN, ...isi].join('\n\n');

  const skills = {
    'pertanahan-pengaduan': skill('pertanahan-pengaduan',
      'Alur kerja pengaduan pertanahan (Subdit Penanganan Sengketa Penetapan Hak dan Pendaftaran Tanah, ATR/BPN): mencatat PDF pengaduan baru, Master Data di Database Raffy, folder pengadu di Otomasi, Telaahan bertanda tangan, Surat REFF, dan status kasus. Gunakan setiap kali pengguna mengirim PDF pengaduan, bertanya tentang kasus atau Master Data, atau meminta Telaahan, Notula, Nota Dinas, atau Surat Keluar.',
      ['# Pengaduan pertanahan', pembuka, persetujuan, alur, dokumen, keputusan]),
    'pertanahan-telaahan': skill('pertanahan-telaahan',
      'Kaidah penulisan dan format Telaahan Staf pengaduan pertanahan (Permen ATR/BPN 21/2020). Gunakan sebelum menyusun draf Telaahan Staf atau memanggil buat_telaahan.',
      ['# Telaahan Staf', turunkan(baca('src/agent/pengetahuan/kaidah-telaahan.md')), dokumen, keputusan]),
    'pertanahan-notula': skill('pertanahan-notula',
      'Aturan Notula Gelar Kasus Awal (Lampiran V Permen ATR/BPN 21/2020): isian wajib yang ditanyakan, aturan isi, dan pembuatan file lewat buat_notula. Gunakan setiap kali pengguna menyampaikan hasil gelar atau meminta notula gelar kasus awal.',
      ['# Notula Gelar Kasus Awal', turunkan(baca('src/agent/pengetahuan/notula.md')), dokumen, keputusan]),
    'pertanahan-surat': skill('pertanahan-surat',
      'Aturan Nota Dinas dan Surat Keluar (sukel) pertanahan: jenis surat, penanda tangan, kepala surat, isi, tembusan, dan pembuatan file lewat buat_nota_dinas atau buat_surat_keluar. Gunakan setiap kali pengguna meminta nota dinas, pelimpahan, surat keluar, atau jawaban atas pengaduan.',
      ['# Nota Dinas dan Surat Keluar', turunkan(baca('src/agent/pengetahuan/surat.md')), dokumen, keputusan]),
  };

  // Untuk pengguna yang sudah punya SOUL.md sendiri: cukup disambung di akhirnya.
  const tambahan = ['## Pekerjaan pertanahan (server MCP "pertanahan")',
    'Dalam pekerjaan pertanahan, aturan di bawah ini berlaku di atas gaya persona.',
    '- Untuk pengaduan, Master Data, folder pengadu, Telaahan Staf, Notula Gelar Kasus Awal, Nota Dinas, atau Surat Keluar, muat skill pertanahan-pengaduan lebih dulu, lalu skill dokumen yang sesuai (pertanahan-telaahan, pertanahan-notula, pertanahan-surat).',
    '- Pakai bahasa Indonesia formal dan sapa pengguna dengan "Anda", tanpa humor, metafora, atau bahasa gaul, baik di draf, ringkasan kasus, maupun dokumen dinas. Di chat, pakai teks biasa dan daftar bernomor, tanpa tabel.',
    '- Baca berkas kiriman pengguna dengan alat baca_berkas (bukan terminal atau OCR), lalu rujuk berkas itu dengan lokasi filenya.',
    '- Jangan menebak nama, nomor, tanggal, NIP, atau isi dokumen. Tanyakan, atau tandai "[PERLU CEK]" bila aturan pekerjaannya memintanya.',
    '- Alat pertanahan yang mengubah data atau mengirim sesuatu meminta persetujuan pengguna sendiri. Jangan meminta konfirmasi teks terpisah; bila ditolak, jangan ulangi tanpa perubahan.',
    '- Bila hasil alat berisi baris "MEDIA:<lokasi>", salin baris itu persis ke balasan supaya file terkirim ke chat.'].join('\n');

  const berkas = { 'SOUL.md': soul, 'SOUL-tambahan.md': `${PERINGATAN}\n\n${tambahan}` };
  for (const [nama, isi] of Object.entries(skills)) berkas[path.join('skills', nama, 'SKILL.md')] = isi;
  return Object.fromEntries(Object.entries(berkas).map(([k, v]) => [k, `${v.trim()}\n`]));
}

function main() {
  const cek = process.argv.includes('--cek');
  const berkas = bangun();
  const beda = [];
  for (const [rel, isi] of Object.entries(berkas)) {
    const file = path.join(KELUAR, rel);
    const lama = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (lama === isi) continue;
    beda.push(rel);
    if (!cek) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, isi);
    }
  }
  if (cek && beda.length) {
    console.error(`Berkas Hermes belum diperbarui: ${beda.join(', ')}. Jalankan "npm run hermes".`);
    process.exitCode = 1;
  } else {
    console.log(beda.length ? `Diperbarui: ${beda.join(', ')}` : 'Berkas Hermes sudah sesuai aturan bot.');
  }
}

if (require.main === module) main();

module.exports = { bangun };
