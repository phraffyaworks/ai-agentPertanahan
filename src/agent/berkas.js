// Berkas yang dikirim pengguna lewat Telegram. Setiap berkas mendapat ID pendek (B1, B2, ...),
// salinannya disimpan di data/berkas, dan (bila bisa dibaca Claude) diunggah sekali ke Files API
// supaya bisa dirujuk lintas giliran percakapan dengan file_id, tanpa mengirim ulang isinya.
const fs = require('fs');
const path = require('path');
const { toFile } = require('@anthropic-ai/sdk');

const DAPAT_DIBACA = {
  'application/pdf': 'document',
  'text/plain': 'document',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
};

function createBerkasStore(dataDir, anthropic) {
  const dir = path.join(dataDir, 'berkas');
  const indexFile = path.join(dir, 'index.json');
  fs.mkdirSync(dir, { recursive: true });
  let state = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : { seq: 0, items: {} };
  const save = () => {
    fs.writeFileSync(`${indexFile}.tmp`, JSON.stringify(state, null, 2));
    fs.renameSync(`${indexFile}.tmp`, indexFile);
  };

  async function simpan(buffer, nama, mime) {
    const id = `B${++state.seq}`;
    const ext = path.extname(nama || '') || '';
    const file = path.join(dir, `${id}${ext}`);
    fs.writeFileSync(file, buffer);
    const item = { id, nama, mime, ukuran: buffer.length, file, diterima: new Date().toISOString(), file_id: null };
    const jenis = DAPAT_DIBACA[mime];
    if (jenis) {
      const up = await anthropic.files.upload({ file: await toFile(buffer, nama || `${id}${ext}`, { type: mime }) });
      item.file_id = up.id;
    }
    state.items[id] = item;
    save();
    return item;
  }

  const ambil = id => {
    const item = state.items[String(id || '').trim().toUpperCase()];
    if (!item) throw new Error(`Berkas ${id} tidak ditemukan.`);
    return item;
  };
  const isi = id => fs.readFileSync(ambil(id).file);
  const daftar = () => Object.values(state.items).map(({ id, nama, mime, ukuran, diterima }) => ({ id, nama, mime, ukuran, diterima }));

  // Blok konten untuk pesan pengguna: label teks + dokumen/gambar (bila bisa dibaca).
  function blokKonten(item) {
    const label = { type: 'text', text: `[Berkas ${item.id}: ${item.nama} (${item.mime}, ${Math.round(item.ukuran / 1024)} KB)]` };
    const jenis = DAPAT_DIBACA[item.mime];
    if (!jenis || !item.file_id) {
      return [{ ...label, text: `${label.text} Isi berkas jenis ini tidak bisa dibaca langsung, tetapi bisa disimpan ke Drive.` }];
    }
    const source = { type: 'file', file_id: item.file_id };
    return [label, jenis === 'image' ? { type: 'image', source } : { type: 'document', source, title: item.nama }];
  }

  return { simpan, ambil, isi, daftar, blokKonten };
}

module.exports = { createBerkasStore };
