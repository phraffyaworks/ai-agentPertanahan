# Panduan Penyiapan

Langkah 1–3 harus dikerjakan sendiri karena memakai akun Anda (Telegram, Google, Claude). Kira-kira 15–20 menit. Sesudah itu, pemasangan di VPS berjalan otomatis.

Yang akan Anda siapkan:

| No | Bahan | Dipakai untuk |
|---|---|---|
| 1 | Token bot Telegram | menerima PDF dan membalas di Telegram |
| 2 | Client ID dan Client secret Google | membuka folder Otomasi dan Database Raffy |
| 3 | Kunci Claude API | membaca isi PDF pengaduan |
| 4 | Node.js versi 22 | menjalankan program |

Simpan sementara nilai-nilai itu di catatan pribadi. Nilainya nanti ditempel langsung di VPS, bukan dikirim lewat chat.

---

## Langkah 1 — Membuat bot Telegram

1. Di Telegram, cari **@BotFather** (bercentang biru), lalu tekan **Start**.
2. Kirim `/newbot`.
3. Isi nama bot, misalnya `Agen Pengaduan Raffy`.
4. Isi username bot. Harus diakhiri `bot`, misalnya `raffy_pengaduan_bot`.
5. BotFather mengirim token, bentuknya seperti `123456789:AAH...`. Simpan token ini; jangan dibagikan.

## Langkah 2 — Akses Google Drive dan Sheets (Client ID dan Client secret)

Kerjakan di browser laptop dengan akun **phraffyaworks@gmail.com** (pemilik folder Otomasi). Gratis, tidak perlu kartu kredit.

**A. Buat project**
1. Buka https://console.cloud.google.com/projectcreate
2. Isi *Project name*, misalnya `Agen Pertanahan`, lalu tekan **Create**.
3. Pastikan nama project itu tampil di bagian atas halaman. Bila belum, pilih project itu di sana sebelum lanjut ke langkah berikutnya.

**B. Aktifkan dua API**
1. Buka https://console.cloud.google.com/apis/library/drive.googleapis.com lalu tekan **Enable**.
2. Buka https://console.cloud.google.com/apis/library/sheets.googleapis.com lalu tekan **Enable**.

**C. Isi identitas aplikasi**
1. Buka https://console.cloud.google.com/auth/overview lalu tekan **Get started**.
2. Isi formulirnya:
   - *App name*: `Agen Pertanahan`
   - *User support email*: email Anda
   - *Audience*: **External**
   - *Contact information*: email Anda
3. Centang persetujuan, lalu tekan **Create**.

**D. Terbitkan aplikasi (wajib)**
1. Buka https://console.cloud.google.com/auth/audience
2. Tekan **Publish app**, lalu **Confirm**. Status harus menjadi **In production**.

Bila statusnya masih *Testing*, izin Google kedaluwarsa setelah 7 hari dan bot berhenti bisa membuka Drive. Aplikasi tidak perlu diverifikasi Google karena hanya Anda yang memakainya.

**E. Buat Client ID**
1. Buka https://console.cloud.google.com/auth/clients lalu tekan **Create client**.
2. *Application type*: **Desktop app**. *Name*: `Bot VPS`. Tekan **Create**.
3. Jendela yang muncul menampilkan **Client ID** (diakhiri `.apps.googleusercontent.com`) dan **Client secret** (diawali `GOCSPX-`).
4. Salin keduanya ke catatan pribadi, atau tekan **Download JSON**. Client secret bisa jadi hanya ditampilkan sekali. Bila terlewat, buat client baru.

## Langkah 3 — Kunci Claude API

1. Buka https://platform.claude.com, lalu masuk atau daftar.
2. Di menu **Billing**, isi saldo kecil untuk uji coba. Anda juga bisa memasang batas pemakaian bulanan.
3. Di menu **API Keys**, buat kunci baru, lalu simpan nilainya (diawali `sk-ant-`). Kunci hanya ditampilkan sekali.

## Langkah 4 — Memasang di VPS (otomatis)

Setelah Langkah 1–3 selesai, ikuti [docs/VPS.md](VPS.md). Isinya cukup satu perintah yang ditempel di Browser terminal hPanel. Program akan menanyakan token dan kunci dari Langkah 1–3 satu per satu, mengujinya, lalu menjalankan bot 24 jam.

## (Opsional) Menjalankan di komputer sendiri

Hanya bila ingin mencoba di komputer sebelum di VPS. Jangan jalankan bot di komputer dan di VPS bersamaan, karena satu token bot hanya boleh dipakai di satu tempat.

1. Pasang Node.js versi 22 (LTS).
   - **Windows:** unduh installer dari https://nodejs.org.
   - **Linux (Ubuntu/Debian):** `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -` lalu `sudo apt-get install -y nodejs`.
2. Unduh kode dari GitHub (`Code → Download ZIP`), lalu ekstrak.
3. Buka Terminal (Windows: **Command Prompt**) di folder itu, lalu jalankan:
   ```
   npm install
   npm run setup
   npm start
   ```
   `npm run setup` menanyakan semua nilai, mengujinya, dan menyimpannya ke file `.env`. Selama bot berjalan, jendela Terminal harus tetap terbuka.

## Bila ada masalah

| Pesan | Penyebab dan solusi |
|---|---|
| `Pengaturan belum diisi di file .env: ...` | Nilai yang disebut belum diisi di `.env`. |
| `invalid_grant` pada Google | Izin Google kedaluwarsa atau dicabut. Pastikan status aplikasi **In production** (Langkah 2D), lalu jalankan `npm run setup` lagi dan pilih ulangi izin Google. |
| `Kunci Claude API ditolak` | `ANTHROPIC_API_KEY` salah atau sudah dihapus. |
| `File lebih dari 20 MB` | Batas unduhan bot Telegram. Kecilkan ukuran PDF lalu kirim ulang. |
| `Header tab Master Data berbeda` | Judul kolom A–P di Database Raffy berubah. Kembalikan judulnya, atau minta penyesuaian program. |
