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
function buildMasterRow(no, d) {
  return [
    no, d.nomor_agenda, d.tanggal_disposisi, d.perintah_disposisi, d.tanggal_diterima, d.tanggal_surat,
    d.nomor_surat, d.pengadu_prinsipal, d.penerima_kuasa, d.perihal, d.pokok_permasalahan, d.teradu,
    d.objek_permasalahan, '', d.rencana_tl, STATUS_AWAL,
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

function createSheets(auth, { spreadsheetId, sheetMaster }) {
  const api = makeSheets({ version: 'v4', auth });
  const S = quoteSheet(sheetMaster);
  const lastCol = colLetter(HEADER.length - 1);

  async function getValues(range, valueRenderOption = 'FORMATTED_VALUE') {
    const res = await api.spreadsheets.values.get({ spreadsheetId, range, valueRenderOption });
    return res.data.values || [];
  }

  // Berhenti bila header berbeda: pemetaan kolom bisa salah.
  async function checkHeader() {
    const [actual = []] = await getValues(`${S}!A1:${lastCol}1`);
    const beda = HEADER.map((h, i) => ({ kolom: colLetter(i), harap: h, ada: (actual[i] || '').trim() }))
      .filter(x => x.harap !== x.ada);
    return { ok: beda.length === 0, beda };
  }

  const readRows = () => getValues(`${S}!A2:${lastCol}`);

  async function appendMasterRow(row, pdfUrl) {
    const res = await api.spreadsheets.values.append({
      spreadsheetId,
      range: `${S}!A:${lastCol}`,
      valueInputOption: 'RAW', // teks dari PDF tidak boleh terbaca sebagai rumus; tanggal tetap teks
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });
    const m = /![A-Z]+(\d+)/.exec(res.data.updates.updatedRange);
    const rowNumber = Number(m[1]);
    const cell = `${S}!${colLetter(COL_FILE)}${rowNumber}`;
    await api.spreadsheets.values.update({
      spreadsheetId, range: cell, valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[hyperlinkFormula(pdfUrl, 'Surat Pengaduan')]] },
    });
    // Baca ulang untuk memastikan isinya benar, terutama tautan di kolom N.
    const [written = []] = await getValues(`${S}!A${rowNumber}:${lastCol}${rowNumber}`);
    const [[formula] = []] = await getValues(cell, 'FORMULA');
    const masalah = [];
    if ((written[COL_FILE] || '') !== 'Surat Pengaduan' || !String(formula || '').includes(pdfUrl)) {
      masalah.push(`Tautan di kolom ${colLetter(COL_FILE)} tidak terbaca benar (tampil: "${written[COL_FILE] || ''}").`);
    }
    row.forEach((v, i) => {
      if (i !== COL_FILE && String(v) !== String(written[i] ?? '')) masalah.push(`Kolom ${colLetter(i)} berbeda setelah ditulis.`);
    });
    return { rowNumber, masalah };
  }

  return { checkHeader, readRows, appendMasterRow };
}

module.exports = { HEADER, STATUS_AWAL, PERLU_CEK, buildMasterRow, hyperlinkFormula, nextNumber, findDuplicate, createSheets };
