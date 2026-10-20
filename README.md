# Agen Pengaduan Pertanahan

Agen AI untuk Penata Pertanahan Pertama (Subdit Penanganan Sengketa Penetapan Hak dan Pendaftaran Tanah). Agen ini menghubungkan Telegram, Google Drive, Google Sheets, dan Claude.

Penyiapan langkah demi langkah ada di [docs/PANDUAN.md](docs/PANDUAN.md).

## Alur

1. Pengguna mengirim PDF pengaduan ke bot Telegram.
2. Agen membaca PDF, lalu:
   - membuat folder `Nama Pengadu - Kota/Kabupaten` di folder **Otomasi**;
   - menyimpan PDF dengan nama yang sama dengan foldernya;
   - mencatat satu baris di **Database Raffy**, tab **Master Data** (kolom A–P, Status `Menunggu`).
3. *(tahap berikutnya)* Draf Telaahan Staf dikirim ke Telegram dan direvisi lewat chat. Setelah disetujui, dibuat .docx, lalu disimpan ke Drive dan dikirim ke Telegram.
4. *(tahap berikutnya)* Telaahan yang sudah ditandatangani dikirim sebagai balasan (*reply*) ke pesan kasusnya. Agen menyimpannya sebagai `Telaahan Staff_<nama folder>_ttd.pdf` di folder pengadu.
5. *(tahap berikutnya)* Pengguna mengirim hasil gelar lewat chat. Agen langsung membuat .docx Notula Gelar Kasus Awal, lalu menyimpannya ke Drive dan mengirimnya ke Telegram.

## Status tahapan

| Tahap | Isi | Status |
|---|---|---|
| 1 | Persiapan akun (Telegram, Google, Claude) | panduan tersedia |
| 2 | Penerimaan PDF, folder, nama file, Master Data | selesai ditulis, belum diuji dengan akun asli |
| 3 | Draf Telaahan, revisi via chat, .docx, TTD, Notula | belum |
| 4 | Pemindahan ke VPS Hostinger | panduan tersedia (docs/VPS.md) |

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
| `npm run cek` | memeriksa sambungan Telegram, Drive, Sheets, dan Claude |
| `npm start` | menjalankan bot |
| `npm test` | menjalankan pengujian otomatis |

## Struktur

```
src/
  index.js              titik awal program
  config.js             membaca .env
  telegram/             bot dan teks pesan
  ai/extract.js         membaca PDF dengan Claude (model claude-opus-5-5)
  google/               Drive dan Sheets: lewat Apps Script (bawaan) atau OAuth Client ID
  pipeline/intake.js    alur penerimaan pengaduan
  state/store.js        status kasus di data/kasus.json
apps-script/Kode.gs     skrip jembatan Drive & Sheets yang dipasang di akun Google pengguna
scripts/                setup, cek-koneksi, authorize-google (hanya untuk cara OAuth)
test/                   pengujian otomatis
```
