// Tahap penerimaan pengaduan: baca PDF -> buat folder -> unggah PDF dengan nama baru -> catat di Master Data.
const { PERLU_CEK, isPerluCek, isKosong, folderName, pdfName, uniqueName } = require('../util/naming');
const { buildMasterRow, nextNumber, findDuplicate } = require('../google/sheets');
const { FIELDS } = require('../ai/extract');

const DATE_FIELDS = ['tanggal_disposisi', 'tanggal_diterima', 'tanggal_surat'];
const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

// Tanggal yang formatnya bukan dd/mm/yyyy diganti [PERLU CEK]; nilai aslinya disebut di alasan.
function normalizeDates(data) {
  const out = { ...data, perlu_cek: [...data.perlu_cek] };
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

async function processPengaduan({ pdfBuffer, namaFileAsli }, { extract, drive, sheets, store, folderIndukId }) {
  const header = await sheets.checkHeader();
  if (!header.ok) {
    const rinci = header.beda.map(b => `kolom ${b.kolom}: diharapkan "${b.harap}", tertulis "${b.ada}"`).join('; ');
    throw new IntakeStop(`Header tab Master Data berbeda dari format yang disepakati (${rinci}). Tidak ada yang ditulis.`);
  }

  const { data: raw, usage } = await extract(pdfBuffer);
  const data = normalizeDates(raw);

  const rows = await sheets.readRows();
  const dup = findDuplicate(rows, data.nomor_surat);
  if (dup) {
    return { status: 'duplikat', data, dupRow: dup.rowNumber, usage };
  }

  const folder = await drive.findOrCreateFolder(folderIndukId, folderName(data.pengadu_prinsipal, data.kota_kabupaten_objek, namaFileAsli));
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
  return { status: 'ok', kasus, data, masalahSheet: masalah, usage };
}

module.exports = { processPengaduan, normalizeDates, IntakeStop };
