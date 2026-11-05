---
name: pertanahan-surat
description: "Aturan Nota Dinas dan Surat Keluar (sukel) pertanahan: jenis surat, penanda tangan, kepala surat, isi, tembusan, dan pembuatan file lewat buat_nota_dinas atau buat_surat_keluar. Gunakan setiap kali pengguna meminta nota dinas, pelimpahan, surat keluar, atau jawaban atas pengaduan."
version: 1.0.0
metadata:
  hermes:
    category: pertanahan
    tags: [pertanahan, atr-bpn, sengketa]
---
<!-- Dibuat otomatis oleh scripts/buat-hermes.js dari aturan bot. Jangan diubah di sini: ubah sumbernya, lalu jalankan "npm run hermes". -->

# Nota Dinas dan Surat Keluar

### Aturan Nota Dinas dan Surat Keluar

Disusun dari contoh Word pengguna (Oktober 2026): Nota Dinas "Pelimpahan Berkas ke Sesdit PHPT" (acuannya dua nota terakhir, kasus Indahwati), Surat Keluar ke Kepala Kantor Pertanahan Kabupaten Bekasi dan Surat Keluar ke PT Cikarang Listrindo, Tbk. Tata letak sudah dikunci di alat `buat_nota_dinas` dan `buat_surat_keluar`.

#### Alur
1. Tanyakan dulu yang belum jelas: jenis surat, tujuan, dan isi pokoknya (untuk Nota Dinas juga pengirimnya). Jangan menebak.
2. Tampilkan draf lengkap di chat: kepala surat, isi bernomor, penutup, penanda tangan, tembusan. Revisi sampai pengguna menyatakan setuju.
3. Panggil alatnya dengan isi yang disetujui, persis tanpa perubahan. Isi `tujuan_singkat` untuk nama file (mis. "Kantah Kab Bekasi", "Pengadu", "Sesditjen PSKP").
4. Nomor dan tanggal dikosongkan, diisi setelah penomoran. Kata sambung di pergantian halaman diatur pengguna sendiri; tidak perlu diingatkan.

#### Jenis surat
- **Nota Dinas**: surat antarunit di dalam Kementerian, mis. pelimpahan berkas ke Direktorat Jenderal lain.
- **Surat Keluar**: surat ke pihak di luar Kementerian pusat, mis. Kantor Pertanahan, Kantor Wilayah, atau Pengadu.
- Contoh pelimpahan kasus Indahwati berisi dua Nota Dinas: dari Direktur Penanganan Sengketa Pertanahan kepada Sekretaris Direktorat Jenderal Penanganan Sengketa dan Konflik Pertanahan, lalu dari Sekretaris Direktorat Jenderal kepada Sekretaris Direktorat Jenderal Direktorat Jenderal Penetapan Hak dan Pendaftaran Tanah. Tanyakan apakah perlu satu atau keduanya.
- Isian Yth. untuk Sekretaris Direktorat Jenderal Penetapan Hak dan Pendaftaran Tanah ditulis persis "Sekretaris Direktorat Jenderal Direktorat Jenderal Penetapan Hak dan Pendaftaran Tanah" ("Direktorat Jenderal" memang dua kali; ditetapkan pengguna).

#### Penanda tangan (ditetapkan pengguna)
Penanda tangan mengikuti pengirim surat:
- Dari Direktur Penanganan Sengketa Pertanahan: jabatan "Direktur Penanganan Sengketa Pertanahan", I Made Daging, A.Ptnh., M.H., NIP. 19690818 199103 1 004.
- Dari Sekretaris Direktorat Jenderal Penanganan Sengketa dan Konflik Pertanahan: jabatan tanda tangan "Sekretaris Direktorat Jenderal", Lalu Harisandi, S.ST., M.H., QCRO., NIP. 19800920 199903 1 001.
Surat Keluar selalu ditandatangani Direktur Penanganan Sengketa Pertanahan atas nama Direktur Jenderal Penanganan Sengketa dan Konflik Pertanahan ("a.n Direktur Jenderal" / "Direktur Penanganan Sengketa Pertanahan," / I Made Daging). Alat `buat_surat_keluar` memasangnya otomatis; jangan isi `penandatangan` kecuali pengguna meminta penanda tangan lain. Bila Nota Dinas dikirim pejabat lain, tanyakan nama, jabatan, dan NIP-nya. Awalan "NIP." dibuat otomatis.

#### Nota Dinas
- Kepala: Yth., Dari, Tanggal (kosong), Lampiran (mis. "1 (Satu) Berkas"), Hal (mis. "Pelimpahan Berkas"). Nomor dikosongkan.
- Butir 1 "Rujukan:" dengan sub-butir peraturan yang relevan. Pada contoh: (a) Peraturan Menteri Agraria dan Tata Ruang/Kepala Badan Pertanahan Nasional Nomor 21 Tahun 2020 Tentang Penanganan dan Penyelesaian Kasus Pertanahan; (b) Peraturan Menteri Agraria dan Tata Ruang/Kepala Badan Pertanahan Nasional Nomor 06 Tahun 2025 Tentang Organisasi dan Tata Kerja Kementerian Agraria dan Tata Ruang/Badan Pertanahan Nasional.
- Butir berikutnya, pola contoh: "Sehubungan dengan rujukan tersebut di atas, bersama ini kami sampaikan surat pengaduan dari Saudara [Pengadu] (Pengadu) [nomor bila ada] tanggal ... perihal ... yang ditujukan kepada ... (Nomor Agenda ...)", lalu uraian singkat permasalahan, lalu alasan kewenangan dan penerusan: "... bersama ini kami sampaikan surat tersebut kepada Saudara untuk penanganan lebih lanjut."
- Penutup: "Demikian untuk menjadikan maklum."
- Tembusan pada contoh: "Direktur Jenderal Penanganan Sengketa dan Konflik Pertanahan."

#### Surat Keluar (sukel)
Pengguna menyebut kasusnya, tujuan sukel, dan isi pokoknya (mis. hasil penelitian atau jawaban atas pengaduan) lewat Telegram. Tujuan sukel ditentukan pengguna per surat; bila belum disebut, tanyakan. Bagian lain disiapkan bot:
1. **Data kasus** diambil dari Master Data (`lihat_master_data` dengan nama Pengadu): Nomor Surat, Tanggal Surat, Perihal, Pengadu (Prinsipal), Penerima Kuasa, dan Objek Permasalahan. Folder pengadu dari `lihat_folder`. Tanggal dd/mm/yyyy ditulis "24 April 2026". Bila Nomor Surat "-", bagian "Nomor ..." dihilangkan dari kalimat. Kolom yang kosong atau [PERLU CEK] ditanyakan, bukan dikarang. Pihak yang dituju surat pengaduan ("yang ditujukan kepada ...") tidak ada di Master Data: ambil dari PDF pengaduan bila tersedia di percakapan, atau tanyakan.
2. **Letak objek** menentukan instansi daerah: Kantor Pertanahan sesuai kota/kabupaten letak objek, dan Kantor Wilayah sesuai provinsinya (dari kolom Objek Permasalahan atau nama folder), bukan alamat para pihak.
3. **Tembusan** nomor 1 selalu Direktur Jenderal Penanganan Sengketa dan Konflik Pertanahan (dipasang otomatis oleh alat). Berikutnya dipilih dari: Kepala Kantor Wilayah Badan Pertanahan Nasional Provinsi [provinsi]; Kepala Kantor Pertanahan [kota/kabupaten]; dan/atau Pengadu. Pihak yang menjadi tujuan surat tidak ditembuskan. Dalam draf, usulkan semua yang bukan tujuan, dengan urutan Kantor Wilayah, Kantor Pertanahan, Pengadu; pengguna yang menentukan akhirnya. Draf di chat tetap menampilkan Direktur Jenderal di nomor 1. Pengadu ditulis dengan nama Pengadu (Prinsipal) di Master Data; bila ada Penerima Kuasa, tanyakan apakah tembusan ditujukan kepada kuasanya.
4. **Penanda tangan** tetap dan dipasang otomatis (lihat bagian Penanda tangan).
5. Tampilkan draf lengkap, revisi sampai disetujui, lalu panggil `buat_surat_keluar`.

Format:
- Kepala: Nomor (kosong) dan "Jakarta," (tanggal kosong), Sifat (contoh: "Biasa"), Lampiran ("1 (satu) Berkas" atau "-"), Hal.
- Hal pada contoh: "Tindak Lanjut Atas Pengaduan [Pengadu]" (kepada Kantor Pertanahan), "Jawaban atas Pengaduan [Pengadu]" (kepada Pengadu).
- Alamat: "Yth. [tujuan]", "di -", lalu tempat: kota kedudukan kantor (mis. "Cikarang" untuk Kantor Pertanahan Kabupaten Bekasi) atau "Tempat". Bila kota kedudukan kantor tidak pasti, cek dengan pencarian web dan sebutkan sumbernya di draf, atau tanyakan.
- Pembuka: "Sehubungan dengan surat [pengaduan Pengadu / Saudara] Nomor ... tanggal ... perihal ... yang ditujukan kepada ..., bersama ini disampaikan hal-hal sebagai berikut:".
- Butir diawali "Bahwa ..." dan diakhiri titik koma; butir terakhir diakhiri titik. Kepada Pengadu, Pengadu disebut "Saudara".
- Penutup pada contoh: "Demikian disampaikan untuk dilaksanakan." (meminta tindakan, mis. kepada Kantor Pertanahan) atau "Demikian disampaikan untuk menjadi maklum." (pemberitahuan, mis. kepada Pengadu).
- Tembusan bernomor, diakhiri titik koma, yang terakhir titik (dibuat otomatis).

#### Penulisan
- Bahasa Indonesia formal, tidak ambigu, nama dan nomor persis sesuai berkas. Data yang belum diketahui ditanyakan, bukan dikarang.
- Istilah asing ditulis *miring* (mis. *pump house*). Satuan luas memakai "m²".
- Nama hak ditulis lengkap, mis. "Hak Guna Bangunan Nomor 289/Wangunharja".

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
