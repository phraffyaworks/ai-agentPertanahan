const { sheets: makeSheets } = require('@googleapis/sheets');
const { PERLU_CEK, isKosong, isPerluCek } = require('../util/naming');

// Header tab "Master Data" (kolom A–P) sesuai skill alur-pengaduan-masuk dan file Database Raffy.
const HEADER = [
  'No', 'Nomor Agenda', 'Tanggal Disposisi', 'Perintah Disposisi', 'Tanggal Diterima', 'Tanggal Surat',
  'Nomor Surat', 'Pengadu (Prinsipal)', 'Penerima Kuasa', 'Perihal', 'Pokok Permasalahan', 'Teradu',
  'Objek Permasalahan', 'File Pengaduan', 'Rencana TL', 'Status',
];
const COL_NOMOR_SURAT = HEADER.indexOf('Nomor Surat');
const COL_FILE = HEADER.indexOf('File Pengaduan');
const STATUS_AWAL = 'Menunggu';

const quoteSheet = name => `'${String(name).replace(/'/g, "''")}'`;
const colLetter = i => String.fromCharCode(65 + i);

// Satu baris Master Data dari hasil pembacaan pengaduan. Kolom N diisi rumus terpisah.
// Rencana TL (O) dikosongkan: pengguna yang menentukannya lewat chat.
function buildMasterRow(no, d) {
  return [
    no, d.nomor_agenda, d.tanggal_disposisi, d.perintah_disposisi, d.tanggal_diterima, d.tanggal_surat,
    d.nomor_surat, d.pengadu_prinsipal, d.penerima_kuasa, d.perihal, d.pokok_permasalahan, d.teradu,
    d.objek_permasalahan, '', d.rencana_tl ?? '', STATUS_AWAL,
  ];
}

const hyperlinkFormula = (url, label) => `=HYPERLINK("${String(url).replace(/"/g, '""')}","${label}")`;

function nextNumber(rows) {
  const nums = rows.map(r => Number(String(r[0] || '').trim())).filter(Number.isFinite);
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

// Nomor Surat yang kosong, "-", atau [PERLU CEK] tidak dipakai untuk cek duplikat.
function findDuplicate(rows, nomorSurat) {
  if (isKosong(nomorSurat) || isPerluCek(nomorSurat)) return null;
  const key = String(nomorSurat).trim().toLowerCase();
  const idx = rows.findIndex(r => String(r[COL_NOMOR_SURAT] || '').trim().toLowerCase() === key);
  return idx === -1 ? null : { rowNumber: idx + 2, row: rows[idx] };
}

// Logika Master Data tidak bergantung pada cara akses Google. "backend" menyediakan:
//   read(sheet, startRow, endRow|null, numCols, mode)  mode 'display' (teks tampil) atau 'formula'
//   append(sheet, values) -> nomor baris   (nilai ditulis apa adanya, tidak dibaca sebagai rumus/tanggal)
//   setFormula(sheet, row, col, formula)   (col mulai dari 1)
function createSheetsService(backend, { sheetMaster }) {
  const N = HEADER.length;
  const read = (start, end, mode = 'display') => backend.read(sheetMaster, start, end, N, mode);

  // Berhenti bila header berbeda: pemetaan kolom bisa salah.
  async function checkHeader() {
    const [actual = []] = await read(1, 1);
    const beda = HEADER.map((h, i) => ({ kolom: colLetter(i), harap: h, ada: String(actual[i] || '').trim() }))
      .filter(x => x.harap !== x.ada);
    return { ok: beda.length === 0, beda };
  }

  const readRows = () => read(2, null);

  async function appendMasterRow(row, pdfUrl) {
    const rowNumber = await backend.append(sheetMaster, row);
    await backend.setFormula(sheetMaster, rowNumber, COL_FILE + 1, hyperlinkFormula(pdfUrl, 'Surat Pengaduan'));
    // Baca ulang untuk memastikan isinya benar, terutama tautan di kolom N.
    const [written = []] = await read(rowNumber, rowNumber);
    const [formulas = []] = await read(rowNumber, rowNumber, 'formula');
    const masalah = [];
    if ((written[COL_FILE] || '') !== 'Surat Pengaduan' || !String(formulas[COL_FILE] || '').includes(pdfUrl)) {
      masalah.push(`Tautan di kolom ${colLetter(COL_FILE)} tidak terbaca benar (tampil: "${written[COL_FILE] || ''}").`);
    }
    row.forEach((v, i) => {
      if (i !== COL_FILE && String(v) !== String(written[i] ?? '')) masalah.push(`Kolom ${colLetter(i)} berbeda setelah ditulis.`);
    });
    return { rowNumber, masalah };
  }

  return { checkHeader, readRows, appendMasterRow };
}

// Backend lewat Google Sheets API dengan login OAuth (Client ID).
function googleApiBackend(auth, spreadsheetId) {
  const api = makeSheets({ version: 'v4', auth });
  const rangeOf = (sheet, start, end, numCols) => `${quoteSheet(sheet)}!A${start}:${colLetter(numCols - 1)}${end || ''}`;
  return {
    async read(sheet, start, end, numCols, mode) {
      const res = await api.spreadsheets.values.get({
        spreadsheetId, range: rangeOf(sheet, start, end, numCols),
        valueRenderOption: mode === 'formula' ? 'FORMULA' : 'FORMATTED_VALUE',
      });
      return res.data.values || [];
    },
    async append(sheet, values) {
      const res = await api.spreadsheets.values.append({
        spreadsheetId, range: `${quoteSheet(sheet)}!A:${colLetter(values.length - 1)}`,
        valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [values] },
      });
      return Number(/![A-Z]+(\d+)/.exec(res.data.updates.updatedRange)[1]);
    },
    async setFormula(sheet, row, col, formula) {
      await api.spreadsheets.values.update({
        spreadsheetId, range: `${quoteSheet(sheet)}!${colLetter(col - 1)}${row}`,
        valueInputOption: 'USER_ENTERED', requestBody: { values: [[formula]] },
      });
    },
  };
}

const createSheets = (auth, { spreadsheetId, sheetMaster }) =>
  createSheetsService(googleApiBackend(auth, spreadsheetId), { sheetMaster });

module.exports = {
  HEADER, STATUS_AWAL, PERLU_CEK, buildMasterRow, hyperlinkFormula, nextNumber, findDuplicate,
  createSheetsService, createSheets,
};
