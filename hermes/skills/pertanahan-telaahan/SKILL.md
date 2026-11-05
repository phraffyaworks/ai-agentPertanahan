---
name: pertanahan-telaahan
description: "Kaidah penulisan dan format Telaahan Staf pengaduan pertanahan (Permen ATR/BPN 21/2020). Gunakan sebelum menyusun draf Telaahan Staf atau memanggil buat_telaahan."
version: 1.0.0
metadata:
  hermes:
    category: pertanahan
    tags: [pertanahan, atr-bpn, sengketa]
---
<!-- Dibuat otomatis oleh scripts/buat-hermes.js dari aturan bot. Jangan diubah di sini: ubah sumbernya, lalu jalankan "npm run hermes". -->

# Telaahan Staf

### Kaidah penulisan Telaahan Staf per bab

Struktur tetap: Judul, I. Dasar, II. Para Pihak, III. Objek yang Dipermasalahkan, IV. Pokok Permasalahan, V. Dokumen Pendukung, VI. Uraian Kasus, VII. Hal-Hal yang Dianggap Penting, VIII. Kesimpulan.

Bahasa Indonesia formal, kaidah bahasa hukum sesuai EYD/PUEBI, tidak ambigu, tidak bertele-tele. Gunakan pola Subjek-Predikat-Objek-Keterangan dan kalimat tidak langsung. Istilah: **Pengadu** dan **Teradu**. Setelah bab Para Pihak, para pihak boleh disebut Pengadu/Teradu dan/atau dengan namanya.

#### Judul
Diambil dari pokok kasus (perihal + dugaan masalah + letak tanah lengkap sampai provinsi). Rata tengah, tebal.

#### I. Dasar
Satu kalimat: "Surat dari [nama, jabatan] [PT/instansi], bertindak untuk dan atas nama / selaku kuasa dari [prinsipal], tanggal ..., Nomor ..., perihal ..., ditujukan kepada ...". Jika pengirim bertindak sebagai kuasa, nama kuasa tetap ditulis, ditambah prinsipal akhir; kuasa perantara tidak disebut.

#### II. Para Pihak
Hanya "Pengadu: [nama]" dan "Teradu: [nama]". Tanpa alamat. Pihak yang tidak berkaitan langsung (mis. pemberi sewa) dikeluarkan.

#### III. Objek yang Dipermasalahkan
1. Tanah objek sengketa: (a) status tanah dengan **nomor hak dan desa/kelurahan**, (b) luas masing-masing hak atau klaim masing-masing pihak (irisan dari pengadu disebut "menurut Pengadu" dan "indikatif" bila berasal dari kajian internal), (c) letak lengkap sampai provinsi.
2. Tabel data sertipikat per hak: nomor hak/desa/tanggal terbit; surat ukur/gambar situasi (nomor dan tanggal); luas; atas nama.

#### IV. Pokok Permasalahan
Satu paragraf, sekitar 10-30 kata, mencakup seluruh inti (siapa memohon apa atas objek apa dengan dugaan apa).

#### V. Dokumen Pendukung
Daftar bernomor. Tulis jenis salinan: "Scan", "Fotokopi", "Cetakan", "Fotokopi salinan". Rincikan halaman/bagian bila hanya sebagian. **Jangan** memasukkan dokumen yang belum tersedia.

#### VI. Uraian Kasus
Cerita **menurut Pengadu**, mengalir, sampai Pengadu mengadu ke Kementerian. Setiap butir diawali "Bahwa". Butir 1 dan 2 tetap seperti di bawah; butir 3 dan seterusnya berurutan kronologis ketat.
- Butir 1: bukti perolehan hak Pengadu. Contoh: "Bahwa Pengadu memperoleh bidang tanah Hak Guna Bangunan Nomor .../... dari jual beli dengan ... berdasarkan Akta Jual Beli Nomor ... tanggal ..., yang dibuat oleh ... selaku Pejabat Pembuat Akta Tanah wilayah ..., sebagaimana catatan pada fotokopi sertipikat terlampir."
- Butir 2: asal-usul hak (mis. pemisahan dari hak induk, gambar situasi, surat ukur, pembukuan, penerbitan).
- Butir berikutnya: peristiwa menurut Pengadu dan lampirannya, sampai timbul masalah, lalu surat pengaduan ke Kementerian (nomor, tanggal, ditujukan kepada, tanggal diterima, isi pokok dalam butir bullet).
- Informasi dari pihak lain (mis. surat pihak ketiga) ditulis sebagai lampiran Pengadu: "Bahwa Pengadu melampirkan surat ... dengan informasi sebagai berikut: a. ...; b. ...; dan c. ...". Data yang bukan bersumber dari surat itu dijelaskan sumbernya ("sebagaimana fotokopi sertipikat terlampir").
- Tidak mencampur temuan dari Kantor Pertanahan atau analisis staf ke dalam cerita.
- Ringkas tahapan proses administratif menjadi satu kalimat bila tidak diperlukan rinciannya.

#### VII. Hal-Hal yang Dianggap Penting
Semua penjelasan analitis dan hal yang kurang jelas: sifat indikatif overlay; tenggat lima tahun Pasal 32 ayat (2) PP 24/1997 bila relevan; urutan waktu terbit hak; hubungan hukum para pihak; kewenangan penandatangan/kuasa; kejanggalan data (NIK, nomor keputusan, kecamatan); tulisan tangan yang kurang terbaca; dokumen yang belum tersedia. Kalimat tidak langsung, netral, tidak menyimpulkan bersalah/benar.

#### VIII. Kesimpulan
1. "Setelah dilakukan kajian, pengaduan tersebut merupakan Kasus." atau "Bukan Kasus." (hanya dua kata itu yang berubah).
2. Langkah Tindak Lanjut. Bila Kasus: "melakukan gelar kasus awal." Bila Bukan Kasus: sebut tindak lanjut sesuai jenis pengaduan (ditolak, dikembalikan, dilimpahkan, atau tindak lanjut lainnya). Tanpa rincian langkah.

#### Penutup
"Jakarta, [tanggal otomatis]" rata kanan. Pengolah di kanan (rata tengah). Mengetahui (Kasubdit) di bawahnya, rata tengah halaman. Semuanya dibuat otomatis oleh alat `buat_telaahan`.

## File dokumen
Alat buat_telaahan, buat_notula, buat_nota_dinas, dan buat_surat_keluar menyimpan file di folder pengadu di Drive. Hasil alatnya berisi baris "MEDIA:<lokasi>": salin baris itu persis ke balasan supaya file .docx terkirim ke chat.

## Keputusan pengguna (aturan tetap; berlaku di atas aturan lain bila berbeda)

### Keputusan Pengguna

Catatan jawaban pengguna yang menjadi aturan tetap agen. Bila skill lama (telaahan-staf-sengketa, notula-gelar-kasus-awal, analis-pertanahan, alur-pengaduan-masuk) berbeda dengan catatan ini, yang berlaku catatan ini.

#### Bentuk asisten
- Asisten pribadi yang diajak bicara lewat Telegram. Claude membaca setiap pesan dan memutuskan tindakan.
- Model: Claude Sonnet 5.5 (`claude-sonnet-5-5`) dengan effort `medium`; bisa diganti lewat `CLAUDE_MODEL` dan `CLAUDE_EFFORT` di `.env`.
- Cakupan: semua kebutuhan pengguna, yaitu pekerjaan pengaduan pertanahan, Gmail, Google Calendar, dan tanya-jawab umum (dengan pencarian web).
- Sebelum mengubah data atau mengirim sesuatu (folder, berkas, Master Data, dokumen, email, acara), asisten **meminta persetujuan** lewat tombol Setujui/Tolak. Membaca data boleh langsung.

#### Alur dan penyimpanan
- Komunikasi lewat Telegram. Semua perubahan bisa dilakukan lewat chat.
- Folder induk: **Otomasi**. Setiap pengaduan mendapat subfolder `Nama Pengadu - Kota/Kabupaten`, dibuat oleh agen.
- PDF pengaduan disimpan dengan nama yang sama dengan foldernya, ditambah `.pdf`.
- Spreadsheet: **Database Raffy** di folder Otomasi, tab **Master Data**.
- Draf Telaahan dikirim di chat sampai disetujui, baru dibuat .docx.
- Telaahan yang sudah ditandatangani (PDF) dikirim sebagai **balasan (reply)** ke pesan kasusnya. File disimpan di folder pengadu sebagai `Telaahan Staff_<nama folder>_ttd.pdf`.
- Notula langsung dibuat .docx, tanpa draf di chat. Hasil gelar dikirim pengguna lewat chat.
- File .docx disimpan di folder pengadu **dan** dikirim ke Telegram. Nama file mengikuti nama folder:
  - `Telaahan Staff_<nama folder>.docx`
  - `Notula Gelar Kasus Awal_<nama folder>.docx`

#### Master Data
- Nilai Status:
  - `Menunggu`: saat pengaduan tercatat.
  - `Proses Penanganan`: setelah PDF Telaahan bertanda tangan diterima.
  - `Selesai`: setelah ada produk sukel. Pengguna membalas (reply) pesan kasusnya dengan kata "selesai" sambil mengunggah PDF Surat REFF. Agen menyimpan PDF itu di folder pengadu sebagai `Surat REFF_<nama folder>.pdf`, lalu mengubah Status menjadi `Selesai`.
- Rencana TL ditentukan pengguna lewat chat; tidak diisi otomatis.
- Pokok Permasalahan dan Teradu diisi saat pengaduan masuk, lalu diperbarui agar sama dengan Telaahan setelah Telaahan disetujui.

#### Format Telaahan Staf
- Tata letak mengikuti skill analis-pertanahan: Bookman Old Style 11 pt, spasi 1,5, A4, margin kiri-kanan 1,9 cm, atas-bawah 2,54 cm, ruang kop 5,3 cm di halaman 1.
- Nama dan NIP penanda tangan: `Phraffya Machta Nugraha, S.Kom.` dan `NIP. 19910404 202321 1 026` (bergelar dengan titik, awalan `NIP.`, NIP berspasi). Berlaku juga untuk Kasubdit.
- Kasubdit (blok "Mengetahui"): `Sofyan Hadi Syam, S.H., M.Kn.`, `NIP. 19810603 200502 1 001` (sejak November 2026, menggantikan Yanti Cahyati Saca Prawira).
- Tanggal memakai tanggal otomatis Word (ikut berubah saat file dibuka).
- Setelah bab Para Pihak, para pihak boleh disebut "Pengadu"/"Teradu" dan/atau dengan namanya.
- Uraian Kasus: Butir 1 perolehan hak Pengadu, Butir 2 asal-usul hak, butir selanjutnya kronologis ketat.
- Bab Dasar bila pengirim kuasa: nama kuasa tetap ditulis, ditambah prinsipal akhir, tanpa kuasa perantara.

#### Format Notula Gelar Kasus Awal
- Tipologi dan Klasifikasi dikirim pengguna lewat chat bersama hasil gelar.
- Judul disusun dengan pola "Permasalahan … atas Tanah Seluas … antara … dan … Terletak di …" (seperti contoh Notula Cikarang), bukan disalin dari judul Telaahan.

#### Format Nota Dinas dan Surat Keluar
- Dua jenis surat: Nota Dinas dan Surat Keluar. Tata letak mengikuti contoh Word yang dikirim pengguna (Oktober 2026): Nota Dinas "Pelimpahan Berkas ke Sesdit PHPT", Surat Keluar ke Kantor Pertanahan Kabupaten Bekasi, dan Surat Keluar ke PT Cikarang Listrindo, Tbk. Aturan isinya di src/agent/pengetahuan/surat.md.
- Acuan Nota Dinas: dua nota terakhir pada contoh (Direktur kepada Sekretaris Direktorat Jenderal, dan Sekretaris Direktorat Jenderal kepada Sekretaris Direktorat Jenderal Direktorat Jenderal Penetapan Hak dan Pendaftaran Tanah).
- Tujuan nota ke Ditjen Penetapan Hak dan Pendaftaran Tanah ditulis "Sekretaris Direktorat Jenderal Direktorat Jenderal Penetapan Hak dan Pendaftaran Tanah" ("Direktorat Jenderal" dua kali, sesuai contoh).
- Huruf Bookman Old Style 10,5–11 pt (contoh memakai 11 pt, dan itu yang dipakai), paragraf rata kanan-kiri.
- Awalan NIP diseragamkan menjadi `NIP.` (berspasi) di semua dokumen, termasuk Surat Keluar.
- Margin bawah Nota Dinas 2,54 cm (bukan 0,25 cm seperti contoh).
- Judul Nota Dinas diberi tambahan dua kali Enter (dua baris kosong berspasi 1,15) di atas jarak dasar ±4,7 cm, karena kop yang dipakai masih tertimpa judul (Oktober 2026). Jumlahnya diatur lewat `KOP_ENTER_NOTA_DINAS` di `src/docs/surat.js`.
- Draf surat dikirim di chat sampai disetujui, baru dibuat .docx. File disimpan di folder pengadu dan dikirim ke Telegram:
  - `Nota Dinas_<tujuan singkat>_<nama folder>.docx`
  - `Surat Keluar_<tujuan singkat>_<nama folder>.docx`
- Nomor dan tanggal surat dikosongkan. Kata sambung di pergantian halaman diatur pengguna sendiri.
- Penanda tangan: Direktur Penanganan Sengketa Pertanahan adalah I Made Daging, A.Ptnh., M.H.; Sekretaris Direktorat Jenderal Penanganan Sengketa dan Konflik Pertanahan adalah Lalu Harisandi, S.ST., M.H., QCRO.
- Surat Keluar (sukel):
  - Aturan penulisan sama dengan dokumen lain.
  - Penanda tangan selalu Direktur Penanganan Sengketa Pertanahan atas nama Direktur Jenderal Penanganan Sengketa dan Konflik Pertanahan.
  - Tembusan nomor 1 selalu Direktur Jenderal Penanganan Sengketa dan Konflik Pertanahan, lalu Kantor Wilayah BPN Provinsi, Kantor Pertanahan, dan/atau Pengadu.
  - Baris atas nama ditulis "a.n Direktur Jenderal".
  - Tujuan sukel bergantung pada kasusnya dan disampaikan pengguna lewat Telegram.

#### Lingkungan
- Akses Google Drive & Sheets lewat Apps Script milik pengguna (docs/APPS-SCRIPT.md), karena tombol Publish app di Google Cloud tidak bisa dipakai dan status Testing membuat izin habis setiap 7 hari.
- Uji coba di komputer Windows maupun Linux.
- Server: VPS Hostinger KVM 2 (2 CPU, 8 GB RAM, 100 GB), Ubuntu 26.04 LTS, lokasi Kuala Lumpur, diakses lewat terminal di hPanel.
