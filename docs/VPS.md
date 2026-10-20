# Memasang Agen di VPS Hostinger

Untuk VPS Ubuntu 26.04 LTS, diakses lewat **Browser terminal** di hPanel (menu VPS → server Anda → **Browser terminal**). Kerjakan setelah uji coba di komputer berhasil (docs/PANDUAN.md).

Ketik perintah satu blok demi satu blok. Teks setelah `#` hanya penjelasan.

## 1. Perbarui server dan buat pengguna khusus

Bot tidak dijalankan sebagai `root`, supaya bila ada celah keamanan, kerusakannya terbatas.

```
apt update && apt upgrade -y
apt install -y git curl
adduser --disabled-password --gecos "" agen
```

## 2. Pasang Node.js 22

```
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node --version
```

Hasilnya harus diawali `v22`. Bila perintah pertama gagal karena Ubuntu 26.04 belum didukung, hentikan dan kabari saya isi pesan galatnya.

## 3. Ambil kode dari GitHub

```
su - agen
git clone https://github.com/phraffyaworks/ai-agentPertanahan.git
cd ai-agentPertanahan
npm install --omit=dev
```

Bila repositorinya *private*, `git clone` akan meminta login. Langkah untuk itu akan saya tambahkan setelah repositori tersambung.

## 4. Isi .env

Isinya sama dengan `.env` di komputer uji coba Anda.

```
cp .env.example .env
nano .env
```

Tempel nilainya, simpan dengan **Ctrl+O**, Enter, lalu keluar dengan **Ctrl+X**. Kunci file agar hanya bisa dibaca pengguna `agen`:

```
chmod 600 .env
```

Refresh token Google dari komputer uji coba boleh dipakai ulang. Bila ingin membuat baru di VPS, jalankan `npm run authorize-google`, lalu ikuti cara "tempel alamat dari address bar".

## 5. Periksa sambungan

```
npm run cek
```

Keempat baris harus `OK`.

**Penting:** sebelum lanjut, matikan bot di komputer uji coba. Satu token bot Telegram hanya boleh dijalankan di satu tempat sekaligus.

## 6. Jalankan sebagai layanan (menyala 24 jam)

```
exit
cp /home/agen/ai-agentPertanahan/deploy/agen-pertanahan.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now agen-pertanahan
systemctl status agen-pertanahan
```

Status harus `active (running)`. Kirim satu PDF ke bot untuk mencoba.

## Perintah sehari-hari (sebagai root)

| Keperluan | Perintah |
|---|---|
| Melihat log | `journalctl -u agen-pertanahan -n 100 --no-pager` |
| Melihat log berjalan | `journalctl -u agen-pertanahan -f` (keluar: Ctrl+C) |
| Menyalakan ulang | `systemctl restart agen-pertanahan` |
| Memperbarui kode | `su - agen -c "cd ai-agentPertanahan && git pull && npm install --omit=dev"` lalu `systemctl restart agen-pertanahan` |

## Catatan keamanan

- Jangan membagikan password root, isi `.env`, atau token apa pun lewat chat mana pun.
- Bot tidak membuka port apa pun ke internet. Bot hanya menghubungi Telegram, Google, dan Claude.
- Status kasus tersimpan di `/home/agen/ai-agentPertanahan/data/kasus.json`. Folder itu ikut tercakup backup mingguan Hostinger.
