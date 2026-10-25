# Membuat Template Google (sekali saja, oleh pengelola)

Pengguna dashboard menyambungkan Google dengan menyalin satu spreadsheet template. Template ini berisi skrip penghubung (`apps-script/template`). Anda cukup membuatnya **sekali**. Setelah itu semua pengguna memakai template yang sama.

Waktu: sekitar 10 menit. Kerjakan di komputer.

## 1. Buat spreadsheet template

1. Buka [sheets.new](https://sheets.new) dengan akun Google Anda. Spreadsheet kosong baru terbuka.
2. Klik judul **Spreadsheet tanpa judul** di kiri atas, lalu ganti menjadi `Database Agen Pertanahan`.
3. Biarkan isinya kosong. Tab **Master Data** dan baris judulnya dibuat otomatis saat pengguna menyambungkan.

## 2. Pasang skrip

1. Di spreadsheet itu, klik **Ekstensi** (Extensions) → **Apps Script**. Jendela baru terbuka.
2. Klik **Proyek tanpa judul** di kiri atas, lalu ganti menjadi `Agen Pertanahan`.
3. Isi file `Kode.gs`:
   - Klik file **Kode.gs** di panel kiri, lalu hapus semua isinya.
   - Buka [Kode.gs di GitHub](https://github.com/phraffyaworks/ai-agentPertanahan/blob/v2-dashboard/apps-script/template/Kode.gs), klik tombol **Copy raw file**, lalu tempel ke editor.
   - Periksa baris `var DASHBOARD = 'https://agen.phraffyaworks.tech';`. Biarkan bila dashboard memakai alamat itu. Bila memakai alamat lain, ganti alamatnya, tanpa garis miring di akhir.
4. Tambah file `Pasang`:
   - Klik tanda **+** di samping **File** → **HTML**.
   - Beri nama `Pasang` (tanpa `.html`), hapus isinya, lalu tempel isi [Pasang.html](https://github.com/phraffyaworks/ai-agentPertanahan/blob/v2-dashboard/apps-script/template/Pasang.html).
5. Isi file `appsscript.json`:
   - Klik ikon roda gigi **Setelan project** (Project Settings) di kiri.
   - Centang **Tampilkan file manifes "appsscript.json" di editor**.
   - Kembali ke **Editor** (ikon `< >`), klik **appsscript.json**, hapus isinya, lalu tempel isi [appsscript.json](https://github.com/phraffyaworks/ai-agentPertanahan/blob/v2-dashboard/apps-script/template/appsscript.json).
6. Klik ikon **Simpan** (disket) atau tekan Ctrl+S.

**Jangan** klik Terapkan (Deploy) di template. Setiap pengguna menerapkan salinannya sendiri.

## 3. Bagikan template

1. Kembali ke tab spreadsheet. Klik **Bagikan** (Share) di kanan atas.
2. Di bagian **Akses umum**, ubah **Dibatasi** menjadi **Siapa saja yang memiliki link**, dengan peran **Pelihat** (Viewer).
3. Klik **Selesai**.

Pengguna hanya bisa melihat dan menyalin, tidak bisa mengubah template. Skrip tidak berisi rahasia apa pun.

## 4. Masukkan ID template ke dashboard

1. Lihat alamat spreadsheet di browser:
   `https://docs.google.com/spreadsheets/d/`**`1AbC...xyz`**`/edit`
2. ID template adalah bagian tebal, yaitu teks di antara `/d/` dan `/edit`.
3. Di VPS, isi ID itu ke `.env` dashboard:
   ```
   GOOGLE_TEMPLATE_ID=1AbC...xyz
   ```
4. Nyalakan ulang dashboard. Tombol **Salin template** di menu **Mulai → Hubungkan Google** akan langsung memakai template ini.

## Memperbarui skrip

Bila skrip template diperbarui, salinan lama milik pengguna **tidak** ikut berubah. Dashboard memeriksa versi skrip setiap kali menyambungkan. Bila versinya lama, pengguna diminta menyalin ulang template.
