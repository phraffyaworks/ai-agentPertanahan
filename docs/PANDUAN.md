# Panduan Penyiapan

Panduan ini untuk menjalankan agen di komputer Anda sendiri selama tahap uji coba. Pemindahan ke VPS Hostinger dibahas terpisah setelah sistemnya rapi.

Yang akan Anda siapkan:

| No | Bahan | Dipakai untuk |
|---|---|---|
| 1 | Token bot Telegram | menerima PDF dan membalas di Telegram |
| 2 | Client ID dan Client secret Google | membuka folder Otomasi dan Database Raffy |
| 3 | Kunci Claude API | membaca isi PDF pengaduan |
| 4 | Node.js versi 22 | menjalankan program |

Semua nilai rahasia disimpan di file `.env` di komputer Anda. File itu tidak ikut terunggah ke GitHub.

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

## Langkah 4 — Memasang program

1. Pasang Node.js versi 22 (LTS) dari https://nodejs.org. Setelah selesai, buka Terminal (Windows: **Command Prompt**), lalu ketik:
   ```
   node --version
   ```
   Hasilnya harus diawali `v22`.
2. Unduh kode dari GitHub (`Code → Download ZIP`), lalu ekstrak, misalnya ke `Documents\ai-agentPertanahan`.
3. Di Terminal, masuk ke folder itu lalu pasang paket:
   ```
   cd Documents\ai-agentPertanahan
   npm install
   ```

## Langkah 5 — Mengisi file .env

1. Di folder program, salin file `.env.example` menjadi `.env`.
2. Buka `.env` dengan Notepad, lalu isi:
   - `TELEGRAM_BOT_TOKEN=` token dari Langkah 1
   - `GOOGLE_CLIENT_ID=` dan `GOOGLE_CLIENT_SECRET=` dari Langkah 2
   - `ANTHROPIC_API_KEY=` kunci dari Langkah 3
3. Biarkan `TELEGRAM_ALLOWED_USER_IDS` dan `GOOGLE_REFRESH_TOKEN` kosong dulu.

## Langkah 6 — Memberi izin Google

Di Terminal, jalankan:
```
npm run authorize-google
```
1. Buka alamat yang ditampilkan, lalu masuk dengan phraffyaworks@gmail.com.
2. Google akan memperingatkan bahwa aplikasi belum diverifikasi. Ini wajar karena aplikasinya buatan Anda sendiri. Pilih **Advanced → Go to Agen Pertanahan**, lalu **Continue/Izinkan**.
3. Setelah berhasil, refresh token tersimpan otomatis ke `.env`.

## Langkah 7 — Mengetahui ID Telegram Anda

1. Jalankan `npm start`.
2. Di Telegram, buka bot Anda, lalu kirim `/id`. Bot membalas dengan angka ID Anda.
3. Hentikan program dengan **Ctrl+C**. Isi angka itu di `.env`, misalnya `TELEGRAM_ALLOWED_USER_IDS=123456789`.

## Langkah 8 — Memeriksa sambungan

```
npm run cek
```
Keempat baris harus diawali `OK`: Telegram, Google Drive, Google Sheets, dan Claude API. Bila ada yang `GAGAL`, pesannya menyebutkan apa yang perlu diperbaiki.

## Langkah 9 — Uji coba

1. Jalankan `npm start`.
2. Kirim satu PDF pengaduan ke bot.
3. Setelah selesai, bot membalas dengan nama folder, nama PDF, nomor baris Master Data, dan daftar kolom `[PERLU CEK]`.
4. Cek hasilnya di folder Otomasi dan Database Raffy.

Program hanya berjalan selama jendela Terminal terbuka. Agar bot menyala 24 jam, program dipindahkan ke VPS (tahap 4).

---

## Bila ada masalah

| Pesan | Penyebab dan solusi |
|---|---|
| `Pengaturan belum diisi di file .env: ...` | Nilai yang disebut belum diisi di `.env`. |
| `invalid_grant` pada Google | Izin Google kedaluwarsa atau dicabut. Pastikan status aplikasi **In production** (Langkah 2.3), lalu ulangi Langkah 6. |
| `Kunci Claude API ditolak` | `ANTHROPIC_API_KEY` salah atau sudah dihapus. |
| `File lebih dari 20 MB` | Batas unduhan bot Telegram. Kecilkan ukuran PDF lalu kirim ulang. |
| `Header tab Master Data berbeda` | Judul kolom A–P di Database Raffy berubah. Kembalikan judulnya, atau minta penyesuaian program. |
