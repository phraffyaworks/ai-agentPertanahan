// Membuat Telaahan Staf (format lampiran Permen ATR/BPN 21/2020) dari data JSON, hasilnya Buffer .docx.
// Diadaptasi dari skill telaahan-staf-sengketa, dengan tata letak sesuai docs/KEPUTUSAN.md:
// Bookman Old Style 11 pt, spasi 1,5, A4, margin kiri-kanan 1,9 cm, ruang kop 5,3 cm di halaman 1,
// penomoran otomatis Word (Romawi/angka/huruf/bullet), gelar "S.Kom." dan NIP berawalan "NIP." berspasi.
const {
  SimpleField, Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, LevelFormat,
} = require('docx');

const DEF = {
  pengolah: { nama: 'Phraffya Machta Nugraha, S.Kom.', nip: '19910404 202321 1 026' },
  kasubdit: {
    jabatan: 'Kepala Sub Direktorat Penanganan Sengketa Penetapan Hak dan Pendaftaran Tanah',
    nama: 'Yanti Cahyati Saca Prawira, S.P.,S.H.,M.H.', nip: '19780314 200212 2 003',
  },
  kota: 'Jakarta',
};

// NIP 18 digit ditulis berspasi: 19910404 202321 1 026, dengan awalan "NIP.".
function formatNip(nip) {
  const d = String(nip || '').replace(/^\s*NIP\.?\s*/i, '').replace(/\s+/g, '');
  const isi = /^\d{18}$/.test(d) ? `${d.slice(0, 8)} ${d.slice(8, 14)} ${d.slice(14, 15)} ${d.slice(15)}` : String(nip || '').replace(/^\s*NIP\.?\s*/i, '');
  return `NIP. ${isi}`;
}

function buildTelaahan(D) {
const pengolah = { ...DEF.pengolah, ...(D.pengolah || {}) };
const kasubdit = { ...DEF.kasubdit, ...(D.kasubdit || {}) };
if (D.kesimpulan && !D.kesimpulan.kasus && !D.kesimpulan.tindak_lanjut) {
  throw new Error('Kesimpulan "Bukan Kasus" wajib menyebut tindak_lanjut (ditolak, dikembalikan, dilimpahkan, atau lainnya).');
}

const F = 'Bookman Old Style', S = 22;
const J = AlignmentType.JUSTIFIED, C = AlignmentType.CENTER;
const r = (t, o = {}) => new TextRun({ text: t, font: F, size: S, ...o });
// *teks* => miring
const runs = (t, o = {}) => t.split(/(\*[^*]+\*)/).filter(Boolean)
  .map(s => s.startsWith('*') ? r(s.slice(1, -1), { italics: true, ...o }) : r(s, o));
const LS = 360; // spasi 1,5
const SP = { after: 100, line: LS };

// ---------- numbering ----------
const runP = { run: { font: F, size: S } };
const lvl = (level, format, text, left, hang) => ({
  level, format, text, alignment: AlignmentType.LEFT,
  style: { paragraph: { indent: { left, hanging: hang } }, ...runP },
});
const listRef = ref => ({ reference: ref, levels: [
  lvl(0, LevelFormat.DECIMAL, '%1.', 992, 425),
  lvl(1, LevelFormat.LOWER_LETTER, '%2.', 1417, 425),
]});
const config = [
  { reference: 'bab', levels: [{ level: 0, format: LevelFormat.UPPER_ROMAN, text: '%1.',
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 567, hanging: 567 } }, run: { font: F, size: S, bold: true } } }] },
  ...['pihak', 'obj', 'dok', 'uraian', 'penting', 'simpul'].map(listRef),
  { reference: 'bul', levels: [lvl(0, LevelFormat.BULLET, '•', 1417, 425)] },
  { reference: 'tbl', levels: [lvl(0, LevelFormat.LOWER_LETTER, '%1.', 340, 340)] },
];

// ---------- paragraph helpers ----------
const BAB = t => new Paragraph({ numbering: { reference: 'bab', level: 0 }, keepNext: true,
  alignment: J, spacing: { before: 200, after: 100, line: LS }, children: [r(t, { bold: true })] });
const BODY = t => new Paragraph({ alignment: J, spacing: SP, indent: { left: 567 }, children: runs(t) });
const L = (ref, level, t, instance) => new Paragraph({ alignment: J, spacing: SP,
  numbering: instance === undefined ? { reference: ref, level } : { reference: ref, level, instance },
  children: runs(t) });
const BUL = (t, instance) => new Paragraph({ alignment: J, spacing: { after: 60, line: LS },
  numbering: { reference: 'bul', level: 0, instance }, children: runs(t) });
const asArray = v => Array.isArray(v) ? v : (v == null ? [] : [v]);

const c = [];
// Ruang kop surat 5,3 cm di halaman 1 = margin atas 2,54 cm + 1565 twips spasi sebelum judul.
c.push(new Paragraph({ alignment: C, spacing: { before: 1565, after: 120, line: LS }, children: [r('TELAAHAN STAF', { bold: true })] }));
c.push(new Paragraph({ alignment: C, spacing: { after: 200, line: LS }, children: [r(D.judul, { bold: true })] }));

// I. DASAR
c.push(BAB('DASAR'));
c.push(BODY(D.dasar));

// II. PARA PIHAK
c.push(BAB('PARA PIHAK'));
c.push(L('pihak', 0, 'Pengadu: ' + D.pengadu));
c.push(L('pihak', 0, 'Teradu: ' + D.teradu));

// III. OBJEK
c.push(BAB('OBJEK YANG DIPERMASALAHKAN'));
c.push(L('obj', 0, 'Tanah objek sengketa:'));
const o = D.objek;
c.push(L('obj', 1, 'Status tanah: ' + o.status + ';'));
c.push(L('obj', 1, 'Luas tanah: ' + o.luas + ';'));
c.push(L('obj', 1, 'Letak tanah: ' + o.letak + '.'));
c.push(L('obj', 0, 'Data Sertipikat Hak Atas Tanah:'));

const hak = o.hak; // [{judul, nomor_desa_tanggal, surat_ukur, luas, atas_nama}]
const totalW = 9185, firstW = 2500; // lebar isi 9752 dikurangi indent 567
const otherW = Math.floor((totalW - firstW) / hak.length);
const W = [firstW, ...hak.map((_, i) => i === hak.length - 1 ? totalW - firstW - otherW * (hak.length - 1) : otherW)];
const bd = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const bs = { top: bd, bottom: bd, left: bd, right: bd };
const cell = (t, i, opt = {}) => new TableCell({
  borders: bs, width: { size: W[i], type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 },
  shading: opt.h ? { type: ShadingType.CLEAR, fill: 'D9D9D9', color: 'auto' } : undefined,
  children: [new Paragraph({ alignment: J, numbering: opt.n ? { reference: 'tbl', level: 0 } : undefined,
    children: [r(t, { bold: !!opt.h, size: 20 })] })],
});
const mk = (label, key, h = false) => new TableRow({ children: [
  cell(label, 0, { h, n: !h }), ...hak.map((x, i) => cell(h ? x.judul : (x[key] || '-'), i + 1, { h })) ] });
c.push(new Table({ width: { size: totalW, type: WidthType.DXA }, columnWidths: W,
  indent: { size: 567, type: WidthType.DXA }, rows: [
  mk('Uraian', 'judul', true),
  mk('Nomor Hak / Desa / Tanggal Penerbitan', 'nomor_desa_tanggal'),
  mk('Surat Ukur / Gambar Situasi', 'surat_ukur'),
  mk('Luas', 'luas'),
  mk('Atas nama', 'atas_nama'),
]}));
c.push(new Paragraph({ spacing: { after: 60 }, children: [] }));

// IV. POKOK PERMASALAHAN
c.push(BAB('POKOK PERMASALAHAN'));
c.push(BODY(D.pokok));

// V. DOKUMEN PENDUKUNG
c.push(BAB('DOKUMEN PENDUKUNG'));
D.dokumen.forEach(t => c.push(L('dok', 0, t)));

// VI. URAIAN KASUS
// item: string  | { teks, huruf:[...] } | { teks, bullet:[...] }
c.push(BAB('URAIAN KASUS'));
D.uraian.forEach((it, idx) => {
  if (typeof it === 'string') { c.push(L('uraian', 0, it)); return; }
  c.push(L('uraian', 0, it.teks));
  asArray(it.huruf).forEach(t => c.push(L('uraian', 1, t, idx + 1)));
  asArray(it.bullet).forEach(t => c.push(BUL(t, idx + 1)));
});

// VII. HAL-HAL YANG DIANGGAP PENTING
c.push(BAB('HAL-HAL YANG DIANGGAP PENTING'));
D.penting.forEach(t => c.push(L('penting', 0, t)));

// VIII. KESIMPULAN
c.push(BAB('KESIMPULAN'));
const k = D.kesimpulan;
c.push(L('simpul', 0, 'Setelah dilakukan kajian, pengaduan tersebut merupakan ' + (k.kasus ? 'Kasus.' : 'Bukan Kasus.')));
c.push(L('simpul', 0, 'Langkah Tindak Lanjut: ' + (k.tindak_lanjut || (k.kasus ? 'melakukan gelar kasus awal.' : ''))));

// Tanggal (field otomatis) rata kanan
const today = new Date();
const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const cache = `${today.getDate()} ${bulan[today.getMonth()]} ${today.getFullYear()}`;
c.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 300, after: 200, line: LS }, keepNext: true,
  children: [r((D.kota || DEF.kota) + ', '), new SimpleField('DATE \\@ "d MMMM yyyy"', cache)] }));

// Tanda tangan: dua tabel
const nb = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const nbs = { top: nb, bottom: nb, left: nb, right: nb };
const sigc = (t, b = false) => new Paragraph({ alignment: C, spacing: { after: 0 }, children: [r(t, { bold: b })] });
const sc = (ls, w = 4876) => new TableCell({ borders: nbs, width: { size: w, type: WidthType.DXA }, children: ls });
c.push(new Table({ width: { size: 9752, type: WidthType.DXA }, columnWidths: [4876, 4876], rows: [
  new TableRow({ cantSplit: true, children: [
    sc([sigc('')]),
    sc([sigc('Pengolah,', true), sigc(''), sigc(''), sigc(''), sigc(''), sigc(pengolah.nama), sigc(formatNip(pengolah.nip))]),
  ] }),
]}));
c.push(new Paragraph({ spacing: { after: 200 }, keepNext: true, children: [] }));
c.push(new Table({ alignment: C, width: { size: 5600, type: WidthType.DXA }, columnWidths: [5600], rows: [
  new TableRow({ cantSplit: true, children: [ sc([
    sigc('Mengetahui,', true), sigc(kasubdit.jabatan), sigc(''), sigc(''), sigc(''), sigc(''),
    sigc(kasubdit.nama), sigc(formatNip(kasubdit.nip)),
  ], 5600) ] }),
]}));

const doc = new Document({
  styles: { default: { document: { run: { font: F, size: S, language: { value: 'id-ID' } } } } }, // bahasa Indonesia: nama bulan di tanggal otomatis
  numbering: { config },
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 },
    margin: { top: 1440, bottom: 1440, left: 1077, right: 1077 } } }, children: c }],
});
return Packer.toBuffer(doc);
}

module.exports = { buildTelaahan, formatNip };
