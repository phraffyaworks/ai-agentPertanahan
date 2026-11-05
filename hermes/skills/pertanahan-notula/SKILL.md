---
name: pertanahan-notula
description: "Aturan Notula Gelar Kasus Awal (Lampiran V Permen ATR/BPN 21/2020): isian wajib yang ditanyakan, aturan isi, dan pembuatan file lewat buat_notula. Gunakan setiap kali pengguna menyampaikan hasil gelar atau meminta notula gelar kasus awal."
version: 1.0.0
metadata:
  hermes:
    category: pertanahan
    tags: [pertanahan, atr-bpn, sengketa]
---
<!-- Dibuat otomatis oleh scripts/buat-hermes.js dari aturan bot. Jangan diubah di sini: ubah sumbernya, lalu jalankan "npm run hermes". -->

# Notula Gelar Kasus Awal

### Aturan Notula Gelar Kasus Awal

Disusun dari Telaahan Staf kasusnya (Lampiran V Permen ATR/BPN No. 21 Tahun 2020). File .docx dibuat dengan alat `buat_notula`; format 3 halaman sudah dikunci di alat itu. Notula langsung dibuat sebagai file, tanpa draf di chat.

#### Yang wajib ditanyakan bila belum disebut pengguna (jangan diasumsikan)
- Hasil gelar (kesimpulan). Contoh kasus Cikarang: akan dilaksanakan Penelitian.
- Tipologi dan Klasifikasi kasus (Berat/Sedang/Ringan): pengguna yang menyampaikan.
- Pimpinan gelar: nama, NIP, jabatan, apakah Plh. Tanyakan; jangan diasumsikan. Pejabat saat ini menurut pengguna: Direktur Penanganan Sengketa Pertanahan I Made Daging, A.Ptnh., M.H., NIP. 19690818 199103 1 004; Sekretaris Direktorat Jenderal Lalu Harisandi, S.ST., M.H., QCRO., NIP. 19800920 199903 1 001.
- Pemapar, tempat, hari/tanggal/jam, alamat pengadu dan teradu, nomor notula.
Isian yang tetap tidak diketahui dibiarkan kosong; alat mengisinya `[PERLU CEK]` (disorot kuning).

#### Aturan isi
- Judul: disusun dengan pola "Permasalahan [jenis] [hak/nomor/desa] Seluas [luas] atas nama [pihak 1] dengan [hak/nomor/desa] atas nama [pihak 2] Seluas [luas] Terletak di [lokasi lengkap sampai provinsi]" dalam satu paragraf, seperti contoh: "Permasalahan Dugaan Tumpang Tindih Hak Guna Bangunan Nomor 289/Wangunharja Seluas 303 m² atas nama PT Cikarang Listrindo Tbk dengan Hak Milik Nomor 01558/Wangunharja atas nama Yanah Maryanah Seluas 8.950 m² Terletak di Desa Wangunharja, Kecamatan Cikarang Utara, Kabupaten Bekasi, Provinsi Jawa Barat". Bukan disalin dari judul Telaahan.
- Dasar: (a) Surat Pengaduan (pengadu, tanggal, nomor, perihal), (b) Telaahan Staf tanggal penandatanganan (tanpa nomor bila tidak bernomor). Butir SK Tim hanya bila memang ada.
- Objek, Para pihak (nama, alamat, status pemegang hak), Pokok Masalah: dari Telaahan Staf.
- Akar Masalah: telaahan umumnya tidak punya bab itu; susun hanya dari fakta yang tertulis di telaahan, lalu minta pengguna mengonfirmasi.
- Kota/Kabupaten dan lokasi adalah letak objek permasalahan, bukan alamat para pihak.
- Bila telaahan tidak konsisten (mis. nomor sertipikat berbeda antarbagian), laporkan perbedaannya kepada pengguna dan tanyakan nilai yang benar.
- Tabel Tindak Lanjut (Pasal 8 ayat (3) huruf a–d): kolom Ceklis selalu kosong, diisi pengguna secara manual.
- Notulis bawaan: Phraffya Machta Nugraha, S.Kom., NIP. 19910404 202321 1 026.
- Tempat dan tanggal penandatanganan: "Jakarta, [PERLU CEK] <tahun berjalan>"; tanggal dan bulan diisi pengguna setelah Kasubag TU memberi nomor.
- Gelar ditulis lengkap dengan titik (mis. "S.Kom.") dan NIP berawalan "NIP." berspasi.

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
