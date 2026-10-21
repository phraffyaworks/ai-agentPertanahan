# Asisten Pribadi Pertanahan (Telegram)

Asisten pribadi berbasis Claude untuk Penata Pertanahan Pertama (Subdit Penanganan Sengketa Penetapan Hak dan Pendaftaran Tanah). Asisten diajak bicara lewat Telegram dan bekerja dengan Google Drive, Google Sheets (Database Raffy), Gmail, dan Google Calendar milik pengguna.

Penyiapan: [docs/PANDUAN.md](docs/PANDUAN.md), lalu [docs/APPS-SCRIPT.md](docs/APPS-SCRIPT.md) dan [docs/VPS.md](docs/VPS.md).

## Yang bisa dilakukan
- **Pengaduan:** kirim PDF, lalu asisten membaca, membuat folder `Nama Pengadu - Kota/Kabupaten` di Otomasi, menyimpan PDF dengan nama yang sama, dan mencatat satu baris di Master Data.
- **Master Data:** menjawab pertanyaan ("kasus mana yang masih Menunggu?") dan mengubah kolom (Rencana TL, Status, dan lainnya).
- **Telaahan Staf:** draf di chat, revisi lewat percakapan, lalu file .docx yang disimpan di folder pengadu dan dikirim ke Telegram.
- **Telaahan bertanda tangan dan Surat REFF:** berkas yang dikirim sebagai balasan disimpan ke folder pengadu, dan Status diperbarui.
- **Notula Gelar Kasus Awal:** dibuat langsung sebagai .docx setelah hasil gelar disampaikan.
- **Nota Dinas dan Surat Keluar:** draf di chat, revisi lewat percakapan, lalu file .docx berformat sesuai contoh Word pengguna, disimpan di folder pengadu dan dikirim ke Telegram.
- **Gmail:** mencari, membaca, membalas, mengirim, dan membuat draf email.
- **Kalender:** melihat, membuat, dan menghapus acara.
- **Tanya-jawab umum**, dengan pencarian web bila perlu.

Setiap tindakan yang mengubah data atau mengirim sesuatu menunggu tombol **Setujui/Tolak**. Membalas dengan teks saat tombol muncul berarti menolak sambil memberi arahan.

## Status

| Bagian | Status |
|---|---|
| Asisten percakapan, alat, persetujuan, riwayat | selesai ditulis dan lulus uji otomatis; belum diuji dengan akun asli |
| Apps Script (Drive, Sheets, Gmail, Kalender) | selesai, versi 2 |
| Dokumen Telaahan dan Notula (.docx) | selesai, tata letak sesuai docs/KEPUTUSAN.md |
| Nota Dinas dan Surat Keluar (.docx) | selesai, tata letak sesuai contoh Word pengguna; belum diuji dengan akun asli |
| Pemasangan VPS | satu perintah (docs/VPS.md) |

## Aturan yang dipegang

- Tidak ada asumsi. Data yang tidak terbaca atau meragukan ditulis `[PERLU CEK]` dan dilaporkan beserta alasannya. Data yang memang tidak ada di berkas ditulis `-`.
- Nama Pengadu adalah prinsipal, bukan kuasa. Kota/Kabupaten adalah letak objek tanah, bukan alamat para pihak.
- Bila Nomor Surat sudah tercatat, tidak ada folder, file, atau baris baru yang dibuat.
- Bila header Master Data berbeda dari format, proses berhenti sebelum menulis apa pun.
- Bot hanya melayani akun Telegram yang terdaftar di `TELEGRAM_ALLOWED_USER_IDS`.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm install` | memasang paket |
| `npm run setup` | penyiapan terpandu: token, Apps Script, kunci Claude, pemeriksaan |
| `npm run cek` | memeriksa Telegram, Drive, Sheets, Apps Script, dan Claude (termasuk satu permintaan uji) |
| `npm start` | menjalankan bot |
| `npm test` | menjalankan pengujian otomatis |

## Struktur

```
src/
  index.js              titik awal program
  config.js             membaca .env
  telegram/             bot Telegram, tombol persetujuan, format pesan
  agent/                asisten: putaran Claude (agen.js), alat (alat.js), prompt dan pengetahuan,
                        riwayat percakapan, berkas dari Telegram
  docs/                 pembuat .docx Telaahan Staf, Notula Gelar Kasus Awal, Nota Dinas, dan Surat Keluar
  google/               Drive dan Sheets: lewat Apps Script (bawaan) atau OAuth Client ID
  pipeline/intake.js    pencatatan pengaduan (folder, PDF, Master Data)
  state/store.js        catatan kasus di data/kasus.json
apps-script/Kode.gs     skrip jembatan Drive & Sheets yang dipasang di akun Google pengguna
scripts/                setup, cek-koneksi, authorize-google (hanya untuk cara OAuth)
test/                   pengujian otomatis
```
