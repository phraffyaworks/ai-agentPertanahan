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

## Langkah 2 — Akses Google Drive dan Sheets

Kerjakan dengan akun **phraffyaworks@gmail.com** (pemilik folder Otomasi).

1. Buka https://console.cloud.google.com, lalu buat project baru, misalnya `Agen Pertanahan`.
2. Buka menu **APIs & Services → Library**. Cari dan aktifkan (**Enable**) dua API berikut:
   - **Google Drive API**
   - **Google Sheets API**
3. Buka menu **Google Auth Platform** (di sebagian tampilan masih bernama **OAuth consent screen**).
   - Isi nama aplikasi (misalnya `Agen Pertanahan`) dan email Anda.
   - Pada jenis pengguna (**Audience**), pilih **External**.
   - Tekan **Publish app** sehingga statusnya menjadi **In production**. Ini penting: bila statusnya masih *Testing*, izin dari Google kedaluwarsa setelah 7 hari dan bot berhenti bisa membuka Drive.
4. Buka **Clients → Create client**.
   - Application type: **Desktop app**.
   - Simpan **Client ID** dan **Client secret** yang muncul.

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
| `invalid_grant` pada Google | Izin Google kedaluwarsa atau dicabut. Pastikan status aplikasi **In production** (Langkah 2.3), lalu jalankan `npm run setup` lagi dan pilih ulangi izin Google. |
| `Kunci Claude API ditolak` | `ANTHROPIC_API_KEY` salah atau sudah dihapus. |
| `File lebih dari 20 MB` | Batas unduhan bot Telegram. Kecilkan ukuran PDF lalu kirim ulang. |
| `Header tab Master Data berbeda` | Judul kolom A–P di Database Raffy berubah. Kembalikan judulnya, atau minta penyesuaian program. |
