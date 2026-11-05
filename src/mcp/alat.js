// Alat bot (src/agent/alat.js) dalam bentuk alat MCP untuk Hermes Agent. Isi, validasi, ringkasan, dan
// pembuat dokumen sama persis dengan bot Telegram. Bedanya:
// - berkas dirujuk dengan lokasi file yang diberikan Hermes, bukan ID B1, B2; hanya dari folder yang diizinkan
//   (bawaan: cache Hermes), supaya model tidak bisa mengunggah file lain di server, mis. .env;
// - persetujuan diminta server ini sendiri lewat MCP elicitation, berisi ringkasan yang sama dengan tombol
//   Setujui/Tolak di bot. Bila Hermes tidak mendukungnya, alat pengubah tidak dijalankan;
// - file Word juga disimpan di folder cache Hermes dan dikirim ke chat lewat baris "MEDIA:<lokasi>".
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { ALAT, jalankanAlat } = require('../agent/alat');
const { uniqueName } = require('../util/naming');
const { jenisBerkas } = require('./bacaBerkas');

const MIME = {
  '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.txt': 'text/plain', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const MAKS_DAFTAR = 30;
const KET_BERKAS = 'Lokasi lengkap file seperti yang ditulis Hermes, mis. "/home/hermes/.hermes/cache/documents/surat.pdf".';
const KET_MEDIA = ' Hasil alat berisi baris "MEDIA:<lokasi>"; salin baris itu persis ke balasan supaya file terkirim ke chat.';
// Alat pengubah yang menimpa atau menghapus data.
const MERUSAK = new Set(['ubah_master_data', 'hapus_acara']);

function pengaturanAlat(env = process.env) {
  const hermesHome = env.HERMES_HOME || path.join(os.homedir(), '.hermes');
  const folderBerkas = (env.BERKAS_DIRS || path.join(hermesHome, 'cache')).split(path.delimiter).filter(Boolean).map(d => path.resolve(d));
  return {
    hermesHome,
    folderBerkas,
    folderMasuk: env.BERKAS_MASUK_DIR || path.join(hermesHome, 'cache', 'documents'),
    folderKeluaran: env.KELUARAN_DIR || path.join(hermesHome, 'cache', 'documents', 'pertanahan'),
    waktuTungguMs: Number(env.PERSETUJUAN_TIMEOUT_DETIK || 600) * 1000,
  };
}

const diDalam = (file, dir) => file === dir || file.startsWith(dir + path.sep);

// Berkas dari pengguna, dirujuk dengan lokasi file. Bentuknya sama dengan penyimpanan berkas bot:
// ID berkas adalah nama filenya (untuk ringkasan persetujuan), dan dipetakan kembali ke lokasinya.
function createBerkasLokal({ folderBerkas }) {
  const lokasiDariId = new Map();
  function ambil(lokasi) {
    let asli = String(lokasi || '').trim();
    if (!path.isAbsolute(asli) && lokasiDariId.has(asli)) asli = lokasiDariId.get(asli);
    if (!path.isAbsolute(asli)) throw new Error(`Lokasi berkas harus lengkap (diawali "/"), bukan "${asli}".`);
    let file;
    try {
      file = fs.realpathSync(asli);
    } catch {
      throw new Error(`Berkas tidak ditemukan: ${asli}. Minta pengguna mengirim ulang berkasnya.`);
    }
    if (!folderBerkas.some(d => diDalam(file, d))) {
      throw new Error(`Berkas di luar folder yang diizinkan (${folderBerkas.join(', ')}). Hanya berkas kiriman pengguna yang boleh dipakai.`);
    }
    const st = fs.statSync(file);
    if (!st.isFile()) throw new Error(`Bukan file: ${asli}`);
    const nama = path.basename(file);
    lokasiDariId.set(nama, file);
    return { id: nama, nama, file, ukuran: st.size, mime: MIME[path.extname(nama).toLowerCase()] || 'application/octet-stream' };
  }
  return { ambil, isi: lokasi => fs.readFileSync(ambil(lokasi).file) };
}

function daftarBerkasMasuk(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, { withFileTypes: true }).filter(d => d.isFile())
    .map(d => { const file = path.join(folder, d.name); const st = fs.statSync(file); return { nama: d.name, lokasi: file, ukuran_kb: Math.round(st.size / 1024), diterima: st.mtime.toISOString() }; })
    .sort((a, b) => b.diterima.localeCompare(a.diterima)).slice(0, MAKS_DAFTAR);
}

// Skema alat bot dengan "berkas_id" diganti "berkas" (lokasi file).
function skemaMcp(schema) {
  if (!schema.properties?.berkas_id) return schema;
  const { berkas_id: _, ...lain } = schema.properties;
  return {
    ...schema,
    properties: { berkas: { type: 'string', description: KET_BERKAS }, ...lain },
    required: (schema.required || []).map(k => (k === 'berkas_id' ? 'berkas' : k)),
  };
}

const ALAT_BACA_BERKAS = {
  name: 'baca_berkas',
  description: 'Membaca seluruh isi PDF atau foto dokumen kiriman pengguna (termasuk scan, tulisan tangan, cap, dan lembar disposisi) dan mengembalikan salinan teksnya per halaman. Pakai alat ini, bukan terminal atau OCR, sebelum mencatat pengaduan atau menyusun dokumen dari berkas itu.',
  inputSchema: { type: 'object', properties: { berkas: { type: 'string', description: KET_BERKAS } }, required: ['berkas'] },
  annotations: { title: 'Baca berkas', readOnlyHint: true, openWorldHint: false },
};
const ALAT_LIHAT_BERKAS = {
  name: 'lihat_berkas',
  description: `Daftar berkas terbaru yang dikirim pengguna (maks. ${MAKS_DAFTAR}), beserta lokasi filenya. Pakai bila lokasi berkas tidak ada lagi di percakapan.`,
  inputSchema: { type: 'object', properties: {} },
  annotations: { title: 'Lihat berkas', readOnlyHint: true, openWorldHint: false },
};

function buatAlatMcp({ ctxDasar, pembaca, pengaturan = pengaturanAlat(), cacheBacaan = null }) {
  const berkas = createBerkasLokal(pengaturan);
  const ctx = { ...ctxDasar, berkas };
  const dariBot = ALAT.filter(a => a.name !== 'lihat_berkas');

  const daftar = () => [
    ALAT_LIHAT_BERKAS,
    ALAT_BACA_BERKAS,
    ...dariBot.map(a => ({
      name: a.name,
      description: a.description + (a.name.startsWith('buat_') && a.name !== 'buat_acara' && a.name !== 'buat_draf_email' ? KET_MEDIA : ''),
      inputSchema: skemaMcp(a.input_schema),
      annotations: { readOnlyHint: !a.ubah, ...(a.ubah && { destructiveHint: MERUSAK.has(a.name) }) },
    })),
  ];

  async function bacaBerkas(lokasi) {
    const b = berkas.ambil(lokasi);
    jenisBerkas(b.file);
    const isi = fs.readFileSync(b.file);
    const kunci = crypto.createHash('sha256').update(isi).digest('hex');
    const simpanan = cacheBacaan && path.join(cacheBacaan, `${kunci}.txt`);
    if (simpanan && fs.existsSync(simpanan)) return `Isi berkas ${b.nama} (dari bacaan sebelumnya):\n\n${fs.readFileSync(simpanan, 'utf8')}`;
    const r = await pembaca.baca(b.file);
    if (simpanan) {
      fs.mkdirSync(cacheBacaan, { recursive: true });
      fs.writeFileSync(simpanan, r.teks);
    }
    return `Isi berkas ${b.nama}:\n\n${r.teks}`;
  }

  // mintaPersetujuan: async (ringkasan) => { setuju, catatan? }; melempar galat bila tidak bisa bertanya.
  async function panggil(nama, masukan, mintaPersetujuan) {
    const hasil = (teks, galat = false) => ({ content: [{ type: 'text', text: teks }], ...(galat && { isError: true }) });
    try {
      if (nama === 'lihat_berkas') return hasil(JSON.stringify({ folder: pengaturan.folderMasuk, berkas: daftarBerkasMasuk(pengaturan.folderMasuk) }, null, 1));
      if (nama === 'baca_berkas') return hasil(await bacaBerkas(masukan?.berkas));
    } catch (err) {
      return hasil(`Gagal: ${err.message || err}`, true);
    }
    if (!dariBot.some(a => a.name === nama)) return hasil(`Alat tidak dikenal: ${nama}`, true);

    const input = { ...(masukan || {}) };
    if ('berkas' in input) {
      input.berkas_id = input.berkas;
      delete input.berkas;
    }
    const file = [];
    const ctxPanggil = {
      ...ctx,
      mintaPersetujuan,
      kirimDokumen: async (buffer, namaFile) => {
        fs.mkdirSync(pengaturan.folderKeluaran, { recursive: true });
        const tujuan = path.join(pengaturan.folderKeluaran, uniqueName(namaFile, fs.readdirSync(pengaturan.folderKeluaran)));
        fs.writeFileSync(tujuan, buffer);
        file.push(tujuan);
      },
    };
    const r = await jalankanAlat(ctxPanggil, { name: nama, input });
    const media = file.length ? `\n\nFile untuk pengguna (salin baris berikut persis ke balasan):\n${file.map(f => `MEDIA:${f}`).join('\n')}` : '';
    return hasil(String(r.content) + media, !!r.is_error);
  }

  return { daftar, panggil };
}

module.exports = { buatAlatMcp, pengaturanAlat, createBerkasLokal };
