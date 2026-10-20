// Aturan penamaan folder dan file (disepakati dengan pengguna):
//   folder  : "<Nama Pengadu> - <Kota/Kabupaten>"      contoh "PT Razio Setia Mukti - Kabupaten Bekasi"
//   PDF     : sama dengan nama folder + ".pdf"
//   TTD     : "Telaahan Staff_<nama folder>_ttd.pdf"
//   REFF    : "Surat REFF_<nama folder>.pdf"
const PERLU_CEK = '[PERLU CEK]';

const isPerluCek = v => typeof v === 'string' && v.includes(PERLU_CEK);
const isKosong = v => v === undefined || v === null || String(v).trim() === '' || String(v).trim() === '-';

// Hapus karakter yang bermasalah di nama file/folder: / \ : * ? " < > |
function sanitizeName(s) {
  return String(s || '')
    .replace(/[\/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
}

// Bagian yang tidak terbaca ditulis [PERLU CEK]. Bila keduanya tidak terbaca, pakai nama file asli
// supaya tidak bentrok dengan kasus lain.
function folderName(pengadu, kotaKabupaten, namaFileAsli) {
  const bagian = v => (isKosong(v) || isPerluCek(v) ? PERLU_CEK : sanitizeName(v));
  const p = bagian(pengadu);
  const k = bagian(kotaKabupaten);
  if (p === PERLU_CEK && k === PERLU_CEK) {
    return `${PERLU_CEK} ${sanitizeName(String(namaFileAsli || 'tanpa nama').replace(/\.pdf$/i, ''))}`;
  }
  return `${p} - ${k}`;
}

const pdfName = folder => `${folder}.pdf`;
const signedTelaahanName = folder => `Telaahan Staff_${folder}_ttd.pdf`;

// Bila nama sudah dipakai di folder yang sama, tambahkan " (2)", " (3)", dst. sebelum ekstensi.
function uniqueName(name, existingNames) {
  const taken = new Set(existingNames);
  if (!taken.has(name)) return name;
  const m = name.match(/^(.*?)(\.[^.]+)?$/);
  for (let i = 2; ; i++) {
    const candidate = `${m[1]} (${i})${m[2] || ''}`;
    if (!taken.has(candidate)) return candidate;
  }
}

module.exports = { PERLU_CEK, isPerluCek, isKosong, sanitizeName, folderName, pdfName, signedTelaahanName, uniqueName };
