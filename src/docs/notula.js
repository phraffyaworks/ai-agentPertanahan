// Pembuat Notula Gelar Kasus Awal (Lampiran V Permen ATR/BPN No. 21 Tahun 2020), hasilnya Buffer .docx.
// Diambil dari skill notula-gelar-kasus-awal; format 3 halaman sudah dikunci di sini.
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType,
        BorderStyle, WidthType, ShadingType, VerticalAlign, TabStopType, LevelFormat, LevelSuffix } = require('docx');

const FONT = 'Bookman Old Style', SZ = 22, LS = 360, W = 9752;
const PC = '[PERLU CEK]';
const L = AlignmentType.LEFT, J = AlignmentType.JUSTIFIED, C = AlignmentType.CENTER;
const v = x => (x !== undefined && x !== null && String(x).trim() !== '') ? String(x) : PC;   // kosong -> [PERLU CEK]

function buildNotula(D) {
// Nilai bawaan tetap (bukan asumsi): notulis. Pimpinan dan pemapar HARUS datang dari data.
const NOTULIS = { nama: 'Phraffya Machta Nugraha, S.Kom.', nip: 'NIP. 19910404 202321 1 026', ...(D.notulis || {}) };
const PIMP = D.pimpinan || {};                       // { nama, nip, jabatan }
const pimpJabatan = v(PIMP.jabatan);

function runs(text, o = {}) {                         // setiap [PERLU CEK] disorot kuning
  return text.split(PC).flatMap((part, i, arr) => {
    const out = [];
    if (part) out.push(new TextRun({ text: part, font: FONT, size: SZ, bold: o.bold }));
    if (i < arr.length - 1) out.push(new TextRun({ text: PC, font: FONT, size: SZ, bold: true,
      shading: { type: ShadingType.CLEAR, fill: 'FFFF00', color: 'auto' } }));
    return out;
  });
}
const para = (text, o = {}) => new Paragraph({
  alignment: o.align || J, keepNext: o.keepNext,
  spacing: { line: LS, before: o.before || 0, after: o.after || 0 },
  indent: o.left !== undefined ? { left: o.left, hanging: o.hanging || 0 } : undefined,
  children: runs(text, o),
});
// butir bernomor otomatis: level 0 = I., 1 = a., 2 = 1)
const li = (level, text, o = {}) => new Paragraph({
  numbering: { reference: 'outline', level },
  alignment: o.align || (level === 0 ? L : J),
  pageBreakBefore: o.pageBreakBefore,
  spacing: { line: LS, before: o.before || 0 },
  indent: o.indent, tabStops: o.tab ? [{ type: TabStopType.LEFT, position: o.tab }] : undefined,
  children: runs(text, { bold: o.bold }),
});
const head = t => li(0, t, { bold: true, before: 160 });
const sub = (t, o) => li(1, t, o);
const num = t => li(2, t);
const numKv = (label, value) => li(2, `${label}\t: ${value}`, { indent: { left: 4000, hanging: 2866 }, tab: 4000, align: L });
const kvP = (start, col, label, value) => new Paragraph({ alignment: L, spacing: { line: LS },
  indent: { left: col, hanging: col - start }, tabStops: [{ type: TabStopType.LEFT, position: col }],
  children: runs(`${label}\t: ${value}`) });
const body = t => para(v(t), { left: 1134 });

const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noB = { top: none, bottom: none, left: none, right: none };
const line = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const allB = { top: line, bottom: line, left: line, right: line };

// Tabel tindak lanjut: kolom ceklis SELALU kosong (diisi manual oleh pengguna)
function cell(text, w, o = {}) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: allB, verticalAlign: VerticalAlign.CENTER,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ alignment: o.align || L, spacing: { line: 276 }, children: runs(text, { bold: o.bold }) })],
  });
}
const CW = [700, 5818, 2100];
const tl = [
  ['a.', 'Surat kepada instansi lain (kewenangan instansi lain)'],
  ['b.', 'Surat kepada Kakanwil/Kakantah untuk Penanganan'],
  ['c.', 'Tanggapan/jawaban kepada pengadu'],
  ['d.', 'Kertas kerja Penelitian sebagai dasar Penelitian'],
];
const tabel = new Table({
  width: { size: 8618, type: WidthType.DXA }, columnWidths: CW, indent: { size: 1134, type: WidthType.DXA },
  rows: [
    new TableRow({ tableHeader: true, children: [
      cell('No', CW[0], { bold: true, align: C, fill: 'D9D9D9' }),
      cell('Tindak Lanjut (Pasal 8 ayat (3))', CW[1], { bold: true, fill: 'D9D9D9' }),
      cell('Ceklis', CW[2], { bold: true, align: C, fill: 'D9D9D9' })] }),
    ...tl.map(r => new TableRow({ cantSplit: true, children: [
      cell(r[0], CW[0], { align: C }), cell(r[1], CW[1]), cell('', CW[2])] })),
  ],
});

// Tanda tangan: Notulis Gelar di kanan (rata tengah dalam blok); Mengetahui di tengah halaman
const sc = (t, o = {}) => new Paragraph({ alignment: C, keepNext: o.last ? false : true,
  spacing: { line: LS, before: o.before || 0 }, children: runs(t, o) });
const half = W / 2;
const sigNotulis = new Table({
  width: { size: W, type: WidthType.DXA }, columnWidths: [half, half],
  rows: [new TableRow({ cantSplit: true, children: [
    new TableCell({ width: { size: half, type: WidthType.DXA }, borders: noB, children: [sc(' ')] }),
    new TableCell({ width: { size: half, type: WidthType.DXA }, borders: noB, children: [
      sc(v(D.kota_tanggal || `Jakarta, ${PC} 2026`)), sc('Notulis Gelar,'), sc(' ', { before: 600 }),
      sc(NOTULIS.nama, { bold: true }), sc(NOTULIS.nip)] }),
  ] })],
});
const sigPimpinan = [
  sc('Mengetahui:', { before: 240 }), sc('Pimpinan Gelar,'), sc(pimpJabatan), sc(' ', { before: 600 }),
  sc(v(PIMP.nama), { bold: true }), sc(v(PIMP.nip), { last: true }),
];

const pg = D.pecah_halaman_para_pihak !== false;
const P = D.pengadu || {}, T = D.teradu || {};
const children = [
  // hal. 1: ruang kop surat 5,3 cm = margin atas 2,54 cm + 1565 twips
  para('NOTULA GELAR KASUS AWAL', { bold: true, align: C, before: 1565 }),
  para(`No. ${v(D.nomor)}`, { align: C }),
  para(v(D.judul), { bold: true, align: C, before: 200, after: 80 }),

  head('DASAR'),
  ...((D.dasar && D.dasar.length ? D.dasar : [PC]).map(t => sub(t))),

  head('PELAKSANAAN'),
  sub('Tempat dan waktu'),
  numKv('Tempat', v(D.tempat)),
  numKv('Hari/tanggal/jam', v(D.waktu)),
  sub('Pelaksana'),
  numKv('Pimpinan Rapat', PIMP.nama ? `${PIMP.nama} selaku ${pimpJabatan}` : PC),
  numKv('Pemapar', v(D.pemapar)),
  numKv('Peserta', '(Daftar Peserta Terlampir)'),
  sub('Objek sengketa/konflik/perkara'),
  body(D.objek),
  li(1, 'Para pihak', { pageBreakBefore: pg }),
  num('Pihak pengadu/pemohon:'),
  kvP(1701, 3000, 'Nama', v(P.nama)), kvP(1701, 3000, 'Alamat', v(P.alamat)), kvP(1701, 3000, 'Status', v(P.status)),
  num('Pihak teradu/termohon:'),
  kvP(1701, 3000, 'Nama', v(T.nama)), kvP(1701, 3000, 'Alamat', v(T.alamat)), kvP(1701, 3000, 'Status', v(T.status)),
  sub('Pokok Masalah'), body(D.pokok_masalah),
  sub('Akar Masalah'), body(D.akar_masalah),
  sub('Tipologi Kasus'), body(D.tipologi),
  sub('Klasifikasi Kasus'), body(D.klasifikasi),

  head('HASIL GELAR KASUS AWAL'),
  sub('Kesimpulan'), body(D.kesimpulan),
  li(1, 'Tindak Lanjut Penanganan', { pageBreakBefore: true }),
  tabel,
  para(' ', { before: 120, keepNext: true }),
  sigNotulis,
  ...sigPimpinan,
];

const lvl = (level, format, text, left, hanging, o = {}) => ({
  level, format, text, alignment: L, suffix: o.suffix,
  style: { paragraph: { indent: { left, hanging } }, run: { font: FONT, size: SZ, bold: o.bold } },
});
const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: SZ, language: { value: 'id-ID' } } } } },
  numbering: { config: [{ reference: 'outline', levels: [
    lvl(0, LevelFormat.UPPER_ROMAN, '%1.', 567, 567, { bold: true }),
    lvl(1, LevelFormat.LOWER_LETTER, '%2.', 1134, 567),
    lvl(2, LevelFormat.DECIMAL, '%3)', 1701, 567, { suffix: LevelSuffix.SPACE }),
  ] }] },
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 },
    margin: { top: 1440, bottom: 1440, left: 1077, right: 1077 } } }, children }],
});
return Packer.toBuffer(doc);
}

module.exports = { buildNotula };
