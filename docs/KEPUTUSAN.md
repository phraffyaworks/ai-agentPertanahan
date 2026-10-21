# Keputusan Pengguna

Catatan jawaban pengguna yang menjadi aturan tetap agen. Bila skill lama (telaahan-staf-sengketa, notula-gelar-kasus-awal, analis-pertanahan, alur-pengaduan-masuk) berbeda dengan catatan ini, yang berlaku catatan ini.

## Bentuk asisten
- Asisten pribadi yang diajak bicara lewat Telegram. Claude membaca setiap pesan dan memutuskan tindakan.
- Model: Claude Sonnet 5.5 (`claude-sonnet-5-5`) dengan effort `medium`; bisa diganti lewat `CLAUDE_MODEL` dan `CLAUDE_EFFORT` di `.env`.
- Cakupan: semua kebutuhan pengguna, yaitu pekerjaan pengaduan pertanahan, Gmail, Google Calendar, dan tanya-jawab umum (dengan pencarian web).
- Sebelum mengubah data atau mengirim sesuatu (folder, berkas, Master Data, dokumen, email, acara), asisten **meminta persetujuan** lewat tombol Setujui/Tolak. Membaca data boleh langsung.

## Alur dan penyimpanan
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

## Master Data
- Nilai Status:
  - `Menunggu`: saat pengaduan tercatat.
  - `Proses Penanganan`: setelah PDF Telaahan bertanda tangan diterima.
  - `Selesai`: setelah ada produk sukel. Pengguna membalas (reply) pesan kasusnya dengan kata "selesai" sambil mengunggah PDF Surat REFF. Agen menyimpan PDF itu di folder pengadu sebagai `Surat REFF_<nama folder>.pdf`, lalu mengubah Status menjadi `Selesai`.
- Rencana TL ditentukan pengguna lewat chat; tidak diisi otomatis.
- Pokok Permasalahan dan Teradu diisi saat pengaduan masuk, lalu diperbarui agar sama dengan Telaahan setelah Telaahan disetujui.

## Format Telaahan Staf
- Tata letak mengikuti skill analis-pertanahan: Bookman Old Style 11 pt, spasi 1,5, A4, margin kiri-kanan 1,9 cm, atas-bawah 2,54 cm, ruang kop 5,3 cm di halaman 1.
- Nama dan NIP penanda tangan: `Phraffya Machta Nugraha, S.Kom.` dan `NIP. 19910404 202321 1 026` (bergelar dengan titik, awalan `NIP.`, NIP berspasi). Berlaku juga untuk Kasubdit.
- Tanggal memakai tanggal otomatis Word (ikut berubah saat file dibuka).
- Setelah bab Para Pihak, para pihak boleh disebut "Pengadu"/"Teradu" dan/atau dengan namanya.
- Uraian Kasus: Butir 1 perolehan hak Pengadu, Butir 2 asal-usul hak, butir selanjutnya kronologis ketat.
- Bab Dasar bila pengirim kuasa: nama kuasa tetap ditulis, ditambah prinsipal akhir, tanpa kuasa perantara.

## Format Notula Gelar Kasus Awal
- Tipologi dan Klasifikasi dikirim pengguna lewat chat bersama hasil gelar.
- Judul disusun dengan pola "Permasalahan … atas Tanah Seluas … antara … dan … Terletak di …" (seperti contoh Notula Cikarang), bukan disalin dari judul Telaahan.

## Format Nota Dinas dan Surat Keluar
- Dua jenis surat: Nota Dinas dan Surat Keluar. Tata letak mengikuti contoh Word yang dikirim pengguna (Oktober 2026): Nota Dinas "Pelimpahan Berkas ke Sesdit PHPT", Surat Keluar ke Kantor Pertanahan Kabupaten Bekasi, dan Surat Keluar ke PT Cikarang Listrindo, Tbk. Aturan isinya di src/agent/pengetahuan/surat.md.
- Huruf Bookman Old Style 10,5–11 pt (contoh memakai 11 pt, dan itu yang dipakai), paragraf rata kanan-kiri.

## Lingkungan
- Akses Google Drive & Sheets lewat Apps Script milik pengguna (docs/APPS-SCRIPT.md), karena tombol Publish app di Google Cloud tidak bisa dipakai dan status Testing membuat izin habis setiap 7 hari.
- Uji coba di komputer Windows maupun Linux.
- Server: VPS Hostinger KVM 2 (2 CPU, 8 GB RAM, 100 GB), Ubuntu 26.04 LTS, lokasi Kuala Lumpur, diakses lewat terminal di hPanel.
