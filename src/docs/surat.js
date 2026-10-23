// Membuat Nota Dinas dan Surat Keluar dari data JSON, hasilnya Buffer .docx.
// Tata letak disalin dari contoh Word pengguna (Oktober 2026):
// - Nota Dinas (dua nota terakhir pada contoh "Pelimpahan Berkas ke Sesdit PHPT"): A4, margin 2,54 cm
//   (margin bawah contoh 0,25 cm tidak dipakai, keputusan pengguna), judul NOTA DINAS di
//   ±4,7 cm dari atas ditambah dua kali Enter agar tidak menimpa kop (keputusan pengguna), kepala nota Yth./Dari/Tanggal/Lampiran/Hal berspasi 1, garis di bawahnya, isi spasi 1,5.
// - Surat Keluar (contoh "Kantah Kab Bekasi" dan "PT Cikarang Listrindo"): A4, margin kiri-kanan 1,9 cm,
//   ruang kop 5,3 cm di setiap halaman, Nomor/Sifat/Lampiran/Hal, "Jakarta," sejajar Nomor, isi spasi 1,5.
// Keduanya Bookman Old Style 11 pt, rata kanan-kiri, butir 1./a. otomatis, awalan "NIP." seperti dokumen
// lain. Nomor dan tanggal dikosongkan (diisi setelah penomoran) kecuali diberikan.
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, LevelFormat, HeightRule,
} = require('docx');
const { formatNip } = require('./telaahan');

const F = 'Bookman Old Style', S = 22, LS = 360;
const J = AlignmentType.JUSTIFIED, C = AlignmentType.CENTER, L = AlignmentType.LEFT;
const A4 = { width: 11906, height: 16838 };
// Tambahan jarak di atas judul Nota Dinas agar tidak menimpa kop (permintaan pengguna: 2 kali Enter).
const KOP_ENTER_NOTA_DINAS = 2;
// Penanda tangan tetap Surat Keluar (keputusan pengguna): Direktur PSP atas nama Direktur Jenderal.
const TTD_SURAT_KELUAR = {
  atas_nama: 'a.n Direktur Jenderal', jabatan: 'Direktur Penanganan Sengketa Pertanahan',
  nama: 'I Made Daging, A.Ptnh., M.H.', nip: '19690818 199103 1 004',
};
// Tembusan Surat Keluar selalu dimulai dengan Direktur Jenderal (keputusan pengguna).
const DIRJEN = 'Direktur Jenderal Penanganan Sengketa dan Konflik Pertanahan';
const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const r = (t, o = {}) => new TextRun({ text: t, font: F, size: S, ...o });
// *teks* => miring (istilah asing)
const runs = (t, o = {}) => String(t).split(/(\*[^*]+\*)/).filter(Boolean)
  .map(s => (s.startsWith('*') && s.endsWith('*') && s.length > 2 ? r(s.slice(1, -1), { italics: true, ...o }) : r(s, o)));
const kosong = v => v === undefined || v === null || String(v).trim() === '';

const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noB = { top: none, bottom: none, left: none, right: none };
const cell = (w, children, margins) => new TableCell({ borders: noB, width: { size: w, type: WidthType.DXA }, margins, children });
const table = (widths, rows) => new Table({
  width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths,
  borders: { ...noB, insideHorizontal: none, insideVertical: none }, rows,
});

// Butir 1./a. sama pada kedua jenis surat: angka di tepi, teks di 0,75 cm; huruf di 0,75 cm, teks di 1,5 cm.
const numbering = { config: [
  { reference: 'butir', levels: [
    { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: L, style: { paragraph: { indent: { left: 426, hanging: 426 } }, run: { font: F, size: S } } },
    { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2.', alignment: L, style: { paragraph: { indent: { left: 851, hanging: 425 } }, run: { font: F, size: S } } },
  ] },
  { reference: 'tembusan', levels: [
    { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: L, style: { paragraph: { indent: { left: 426, hanging: 426 } }, run: { font: F, size: S } } },
  ] },
] };

// item: string | { teks, huruf: [...] }
function butir(daftar, spacing) {
  return daftar.flatMap(it => {
    const p = (level, t) => new Paragraph({ numbering: { reference: 'butir', level }, alignment: J, spacing, children: runs(t) });
    if (typeof it === 'string') return [p(0, it)];
    return [p(0, it.teks), ...(it.huruf || []).map(t => p(1, t))];
  });
}

// Satu tembusan ditulis tanpa nomor (contoh Nota Dinas); dua atau lebih diberi nomor (contoh Surat Keluar).
function tembusan(daftar, judul, spacing) {
  if (!daftar || !daftar.length) return [];
  const p = (t, num) => new Paragraph({ alignment: num ? J : L, spacing, numbering: num ? { reference: 'tembusan', level: 0 } : undefined, children: runs(t) });
  return [p(judul), ...(daftar.length === 1 ? [p(daftar[0])] : daftar.map(t => p(t, true)))];
}

// Tembusan Surat Keluar: Direktur Jenderal di nomor 1 (tidak dobel), tiap butir diakhiri titik koma, yang terakhir titik.
function tembusanSuratKeluar(daftar = []) {
  const bersih = t => String(t).trim().replace(/[;.,\s]+$/, '');
  const lain = daftar.map(bersih).filter(t => t && t.toLowerCase() !== DIRJEN.toLowerCase());
  const semua = [DIRJEN, ...lain];
  return semua.map((t, i) => `${t}${i === semua.length - 1 ? '.' : ';'}`);
}

const dokumen = (margin, children) => Packer.toBuffer(new Document({
  styles: { default: { document: { run: { font: F, size: S, language: { value: 'id-ID' } } } } },
  numbering,
  sections: [{ properties: { page: { size: A4, margin } }, children }],
}));

// ---------------- Nota Dinas ----------------
// D: { kepada, dari, lampiran, hal, butir[], penutup, penandatangan: {jabatan, nama, nip}, tembusan[], nomor?, tanggal? }
function buildNotaDinas(D) {
  const W = [1497, 287, 7243]; // lebar isi 9027 (A4 dikurangi margin 2,54 cm kiri-kanan)
  // Label berspasi 1,15 (gaya Normal contoh), isian berspasi 1.
  const sLabel = { after: 0, line: 276 }, s1 = { after: 0, line: 240 };
  const kv = (label, nilai) => new TableRow({ children: [
    cell(W[0], [new Paragraph({ spacing: sLabel, children: [r(label)] })]),
    cell(W[1], [new Paragraph({ spacing: sLabel, children: [r(':')] })]),
    cell(W[2], [new Paragraph({ alignment: J, spacing: s1, children: runs(nilai || '') })]),
  ] });
  const isiSpasi = { after: 0, line: LS };
  const ttd = (t, spacing) => new Paragraph({ alignment: C, indent: { left: 3600 }, keepNext: true, keepLines: true, spacing, children: [r(t)] });
  const p = D.penandatangan;

  return dokumen({ top: 1440, bottom: 1440, left: 1440, right: 1440 }, [
    // Ruang kop di atas judul: 1240 twips (±4,7 cm dari tepi atas, sesuai contoh) ditambah KOP_ENTER_NOTA_DINAS
    // kali Enter, karena kop yang dipakai pengguna masih tertimpa judul. Satu Enter = satu baris kosong
    // berspasi 1,15 seperti gaya Normal contoh. Bila masih kurang atau berlebih, ubah KOP_ENTER_NOTA_DINAS.
    ...Array.from({ length: KOP_ENTER_NOTA_DINAS }, (_, i) =>
      new Paragraph({ spacing: { before: i === 0 ? 1240 : 0, after: 0, line: 276 }, children: [] })),
    new Paragraph({ alignment: C, spacing: { before: 0, after: 0, line: 240 }, children: [r('NOTA DINAS', { bold: true })] }),
    new Paragraph({ spacing: { after: 0 }, children: [r(`${' '.repeat(36)}Nomor :${kosong(D.nomor) ? '' : ` ${D.nomor}`}`)] }),
    new Paragraph({ spacing: { after: 0 }, children: [] }),
    table(W, [kv('Yth.', D.kepada), kv('Dari', D.dari), kv('Tanggal', D.tanggal), kv('Lampiran', D.lampiran), kv('Hal', D.hal)]),
    // Garis pemisah selebar isi, pengganti garis gambar pada contoh.
    new Paragraph({ spacing: { after: 0, line: 240 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } }, children: [] }),
    new Paragraph({ spacing: { after: 0, line: 240 }, children: [] }),
    ...butir(D.butir, isiSpasi),
    new Paragraph({ alignment: J, indent: { firstLine: 1701 }, spacing: isiSpasi, children: runs(D.penutup) }),
    new Paragraph({ spacing: { after: 0, line: 240 }, children: [] }),
    ttd(p.jabatan, { after: 200, line: 276 }),
    ttd('', { after: 200, line: 276 }),
    ttd(p.nama, { after: 0 }),
    new Paragraph({ alignment: C, indent: { left: 3600 }, keepLines: true, spacing: { after: 0 }, children: [r(formatNip(p.nip))] }),
    ...[1, 2, 3].map(() => new Paragraph({ spacing: { after: 0 }, children: [] })),
    ...tembusan(D.tembusan, 'Tembusan :', { after: 0 }),
  ]);
}

// ---------------- Surat Keluar ----------------
// D: { sifat, lampiran, hal, kepada, di, pembuka, butir[], penutup,
//      penandatangan?: {atas_nama?, jabatan, nama, nip} (bawaan TTD_SURAT_KELUAR), tembusan[] (tanpa Direktur Jenderal),
//      nomor?, tanggal? }
function buildSuratKeluar(D) {
  const W = [1600, 250, 7902]; // lebar isi 9752 (A4 dikurangi margin 1,9 cm kiri-kanan)
  const s = { line: LS };
  const tepi = { left: 10, right: 10 };
  const kv = (label, isi, indentKanan, tinggi) => new TableRow({ height: tinggi ? { value: tinggi, rule: HeightRule.ATLEAST } : undefined, children: [
    cell(W[0], [new Paragraph({ spacing: s, children: [r(label)] })], tepi),
    cell(W[1], [new Paragraph({ spacing: s, children: [r(':')] })], tepi),
    cell(W[2], [new Paragraph({ spacing: s, indent: indentKanan ? { right: indentKanan } : undefined, children: isi })], tepi),
  ] });
  // Nomor belum ada: pola nomor ditulis putih (tidak tercetak) seperti contoh, supaya "Jakarta," tetap di posisinya.
  const [bulan, tahun] = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'numeric', year: 'numeric' }).format(new Date()).split('/');
  const pola = `.../.....-800.SK.01/${ROMAWI[bulan - 1]}/${tahun}`;
  const nomor = kosong(D.nomor)
    ? [r(pola, { color: 'FFFFFF' }), r(' '.repeat(21), { color: 'FFFFFF' })]
    : [r(D.nomor), r(' '.repeat(Math.max(4, pola.length + 21 - String(D.nomor).length)))];
  const p = D.penandatangan || TTD_SURAT_KELUAR;
  const ttd = (t, before = 0) => new Paragraph({ alignment: C, keepNext: true, keepLines: true, spacing: { before, line: LS }, children: [r(t)] });
  const jabatan = String(p.jabatan).trim().replace(/,?$/, ',');

  return dokumen({ top: 3005, bottom: 1440, left: 1077, right: 1077 }, [
    table(W, [
      kv('Nomor', [...nomor, r(`Jakarta,${kosong(D.tanggal) ? '' : ` ${D.tanggal}`}`)]),
      kv('Sifat', runs(D.sifat)),
      kv('Lampiran', runs(D.lampiran)),
      kv('Hal', runs(D.hal), 4065, 943),
    ]),
    new Paragraph({ alignment: J, spacing: s, children: runs(`Yth. ${D.kepada}`) }),
    new Paragraph({ alignment: J, spacing: s, children: [r('di -')] }),
    new Paragraph({ alignment: J, spacing: { after: 200, line: LS }, children: [r(`    ${D.di}`)] }),
    new Paragraph({ alignment: J, indent: { firstLine: 993 }, spacing: { after: 200, line: LS }, children: runs(D.pembuka) }),
    ...butir(D.butir, s),
    new Paragraph({ alignment: J, indent: { left: 426, firstLine: 567 }, spacing: s, children: runs(D.penutup) }),
    new Paragraph({ spacing: s, children: [] }),
    table([4800, 4952], [new TableRow({ cantSplit: true, children: [
      cell(4800, [new Paragraph({ spacing: s, children: [] })]),
      cell(4952, [
        ...(kosong(p.atas_nama) ? [] : [ttd(p.atas_nama)]),
        ttd(jabatan), ttd('', 200), ttd('', 200), ttd(p.nama),
        new Paragraph({ alignment: C, keepLines: true, spacing: s, children: [r(formatNip(p.nip))] }),
      ]),
    ] })]),
    ...[1, 2, 3].map(() => new Paragraph({ spacing: s, children: [] })),
    ...tembusan(tembusanSuratKeluar(D.tembusan), 'Tembusan:', s),
  ]);
}

module.exports = { buildNotaDinas, buildSuratKeluar, tembusanSuratKeluar, TTD_SURAT_KELUAR };
