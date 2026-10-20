// Pencatatan pengaduan baru: buat folder -> unggah PDF dengan nama baru -> catat di Master Data.
// Isi data (field di bawah) dibaca asisten dari PDF; fungsi ini hanya menuliskannya.
const { PERLU_CEK, isPerluCek, isKosong, folderName, pdfName, uniqueName } = require('../util/naming');
const { buildMasterRow, nextNumber, findDuplicate } = require('../google/sheets');

const FIELDS = {
  nomor_agenda: 'Nomor agenda pada lembar disposisi.',
  tanggal_disposisi: 'Tanggal pada lembar disposisi, format dd/mm/yyyy.',
  perintah_disposisi: 'Isi perintah disposisi persis sebagaimana tertulis.',
  tanggal_diterima: 'Tanggal surat diterima menurut cap/stempel penerimaan, format dd/mm/yyyy.',
  tanggal_surat: 'Tanggal surat pengaduan, format dd/mm/yyyy.',
  nomor_surat: 'Nomor surat pengaduan.',
  pengadu_prinsipal: 'Nama Pengadu (prinsipal), bukan penerima kuasa.',
  penerima_kuasa: 'Nama penerima kuasa sebagaimana tertulis. String kosong bila surat tidak melibatkan kuasa.',
  perihal: 'Perihal surat pengaduan persis sebagaimana tertulis.',
  pokok_permasalahan: 'Satu kalimat 10-30 kata: siapa memohon apa atas objek apa dengan dugaan apa. Gunakan sebutan "Pengadu".',
  teradu: 'Nama pihak Teradu.',
  objek_permasalahan: 'Hak atas tanah (jenis dan nomor), desa/kelurahan, kecamatan, kota/kabupaten, provinsi.',
  kota_kabupaten_objek: 'Kota/kabupaten letak OBJEK permasalahan (bukan alamat pengadu atau teradu), diawali "Kota " atau "Kabupaten ", mis. "Kabupaten Bekasi".',
};

const DATE_FIELDS = ['tanggal_disposisi', 'tanggal_diterima', 'tanggal_surat'];
const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

// Tanggal yang formatnya bukan dd/mm/yyyy diganti [PERLU CEK]; nilai aslinya disebut di alasan.
function normalizeDates(data) {
  const out = { ...data, perlu_cek: [...(data.perlu_cek || [])] };
  for (const f of DATE_FIELDS) {
    const v = String(out[f] || '').trim();
    if (isKosong(v) || isPerluCek(v) || DATE_RE.test(v)) continue;
    out[f] = PERLU_CEK;
    out.perlu_cek.push({ kolom: f, alasan: `format tanggal tidak dikenali ("${v}")` });
  }
  // Pastikan setiap kolom berisi [PERLU CEK] tercantum di daftar perlu_cek.
  for (const k of Object.keys(FIELDS)) {
    if (isPerluCek(out[k]) && !out.perlu_cek.some(p => p.kolom === k)) {
      out.perlu_cek.push({ kolom: k, alasan: 'tidak terbaca atau meragukan' });
    }
  }
  return out;
}

class IntakeStop extends Error {}

// Nama folder dan PDF yang akan dipakai, untuk ditampilkan saat meminta persetujuan.
function rencanaNama(data, namaFileAsli) {
  const folder = folderName(data.pengadu_prinsipal, data.kota_kabupaten_objek, namaFileAsli);
  return { folder, pdf: pdfName(folder) };
}

async function catatPengaduan({ pdfBuffer, namaFileAsli, data: masukan }, { drive, sheets, store, folderIndukId }) {
  const header = await sheets.checkHeader();
  if (!header.ok) {
    const rinci = header.beda.map(b => `kolom ${b.kolom}: diharapkan "${b.harap}", tertulis "${b.ada}"`).join('; ');
    throw new IntakeStop(`Header tab Master Data berbeda dari format yang disepakati (${rinci}). Tidak ada yang ditulis.`);
  }

  const data = normalizeDates(masukan);
  const rows = await sheets.readRows();
  const dup = findDuplicate(rows, data.nomor_surat);
  if (dup) return { status: 'duplikat', data, dupRow: dup.rowNumber };

  const folder = await drive.findOrCreateFolder(folderIndukId, rencanaNama(data, namaFileAsli).folder);
  const namaPdf = uniqueName(pdfName(folder.name), await drive.listNames(folder.id));
  const pdf = await drive.uploadFile(folder.id, namaPdf, pdfBuffer, 'application/pdf');

  const no = nextNumber(rows);
  const { rowNumber, masalah } = await sheets.appendMasterRow(buildMasterRow(no, data), pdf.webViewLink);

  const kasus = store.putCase({
    id: store.newCaseId(),
    status: 'TERDAFTAR',
    folder: { id: folder.id, name: folder.name, url: folder.webViewLink, baru: folder.created },
    pdf: { id: pdf.id, name: pdf.name, url: pdf.webViewLink, namaAsli: namaFileAsli },
    master: { no, rowNumber },
    data,
  });
  return { status: 'ok', kasus, data, masalahSheet: masalah };
}

module.exports = { FIELDS, catatPengaduan, normalizeDates, rencanaNama, IntakeStop };
