// Teks pesan bot. Dikirim sebagai teks biasa (tanpa Markdown) supaya isi dari PDF tidak merusak format.
const LABEL = {
  nomor_agenda: 'Nomor Agenda',
  tanggal_disposisi: 'Tanggal Disposisi',
  perintah_disposisi: 'Perintah Disposisi',
  tanggal_diterima: 'Tanggal Diterima',
  tanggal_surat: 'Tanggal Surat',
  nomor_surat: 'Nomor Surat',
  pengadu_prinsipal: 'Pengadu (Prinsipal)',
  penerima_kuasa: 'Penerima Kuasa',
  perihal: 'Perihal',
  pokok_permasalahan: 'Pokok Permasalahan',
  teradu: 'Teradu',
  objek_permasalahan: 'Objek Permasalahan',
  kota_kabupaten_objek: 'Kota/Kabupaten objek',
  rencana_tl: 'Rencana TL',
};
const label = k => LABEL[k] || k;

const BANTUAN = [
  'Bot Pengaduan Pertanahan',
  '',
  'Kirim PDF pengaduan ke chat ini. Bot akan:',
  '1. membaca isinya,',
  '2. membuat folder "Nama Pengadu - Kota/Kabupaten" di folder Otomasi,',
  '3. menyimpan PDF dengan nama yang sama dengan foldernya,',
  '4. mencatat satu baris di Database Raffy (tab Master Data).',
  '',
  'Perintah: /bantuan, /id',
].join('\n');

function perluCekList(data) {
  if (!data.perlu_cek.length) return ['Kolom [PERLU CEK]: tidak ada.'];
  return ['Kolom [PERLU CEK] (mohon cek ke dokumen asli):', ...data.perlu_cek.map(p => `- ${label(p.kolom)}: ${p.alasan}`)];
}

function laporanSelesai({ kasus, data, masalahSheet }) {
  return [
    'Pengaduan sudah tercatat.',
    '',
    `Folder: ${kasus.folder.name}${kasus.folder.baru ? '' : ' (folder sudah ada sebelumnya, dipakai ulang)'}`,
    kasus.folder.url,
    `PDF: ${kasus.pdf.name}`,
    `Master Data: baris ${kasus.master.rowNumber} (No. ${kasus.master.no})`,
    '',
    `Pengadu: ${data.pengadu_prinsipal}`,
    `Teradu: ${data.teradu}`,
    `Nomor/Tanggal Surat: ${data.nomor_surat} / ${data.tanggal_surat}`,
    `Perihal: ${data.perihal}`,
    '',
    ...perluCekList(data),
    ...(masalahSheet.length ? ['', 'Peringatan spreadsheet:', ...masalahSheet.map(m => `- ${m}`)] : []),
    '',
    `ID kasus: ${kasus.id}`,
  ].join('\n');
}

function laporanDuplikat({ data, dupRow }) {
  return [
    `Nomor Surat ${data.nomor_surat} sudah tercatat di Master Data baris ${dupRow}.`,
    'Tidak ada folder, file, atau baris baru yang dibuat.',
  ].join('\n');
}

module.exports = { BANTUAN, laporanSelesai, laporanDuplikat, label };
