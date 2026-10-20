# Memasang Agen di VPS Hostinger

Untuk VPS Ubuntu 26.04 LTS, diakses lewat **Browser terminal** di hPanel (menu VPS → server Anda → **Browser terminal**).

Syarat: kode sudah ada di cabang `main` repositori GitHub, dan repositorinya **public**. Bila repositori dibuat *private*, perintah di bawah perlu disesuaikan.

## Pemasangan (satu perintah)

1. Siapkan nilai dari Langkah 1–3 di docs/PANDUAN.md:
   - token bot Telegram;
   - Client ID dan Client secret Google;
   - kunci Claude API.
2. Buka hPanel → VPS → **Browser terminal**.
3. Tempel perintah ini, lalu tekan Enter:
   ```
   bash <(curl -fsSL https://raw.githubusercontent.com/phraffyaworks/ai-agentPertanahan/main/deploy/pasang-vps.sh)
   ```
4. Program berjalan sendiri:
   - memperbarui server;
   - memasang Node.js 22;
   - membuat pengguna khusus `agen` (bot tidak dijalankan sebagai root);
   - mengambil kode.
5. Program lalu menanyakan nilai satu per satu. Tempel setiap nilai, lalu tekan Enter.
   - Setiap nilai langsung diuji. Bila salah, program meminta ulang.
   - ID Telegram Anda dicari otomatis: program meminta Anda mengirim "halo" ke bot.
   - Untuk izin Google, program menampilkan sebuah alamat. Buka alamat itu di browser HP atau laptop, lalu izinkan aksesnya.
   - Setelah itu browser menampilkan halaman yang gagal dimuat. Itu wajar. Salin alamat lengkap dari address bar, lalu tempel kembali di terminal.
6. Terakhir, bot dijalankan sebagai layanan yang menyala 24 jam, juga setelah server reboot. Kirim satu PDF ke bot untuk mencoba.

Perintah yang sama dipakai lagi untuk memperbarui kode. Nilai yang sudah tersimpan cukup dikonfirmasi dengan Enter.

## Perintah sehari-hari (sebagai root)

| Keperluan | Perintah |
|---|---|
| Melihat log | `journalctl -u agen-pertanahan -n 100 --no-pager` |
| Melihat log berjalan | `journalctl -u agen-pertanahan -f` (keluar: Ctrl+C) |
| Menyalakan ulang | `systemctl restart agen-pertanahan` |
| Memperbarui kode | jalankan lagi perintah pemasangan di atas |

## Catatan keamanan

- Jangan membagikan password root, isi `.env`, atau token apa pun lewat chat mana pun.
- Bot tidak membuka port apa pun ke internet. Bot hanya menghubungi Telegram, Google, dan Claude.
- Status kasus tersimpan di `/home/agen/ai-agentPertanahan/data/kasus.json`. Folder itu ikut tercakup backup mingguan Hostinger.
