# Menduplikasi Bot ke Hermes Agent

Panduan ini menyambungkan alat dan aturan bot @phraffaiotomation_bot ke Hermes Agent di VPS yang sama.

**Hasilnya:**
- Hermes bisa mencatat pengaduan, membaca Master Data, dan membuat Telaahan, Notula, Nota Dinas, serta Surat Keluar dengan format yang **sama persis** dengan bot. Kode pembuat dokumennya sama.
- Setiap tindakan yang mengubah data atau mengirim sesuatu tetap menunggu persetujuan Anda. Ringkasannya sama dengan tombol Setujui/Tolak di bot.

**Yang tidak berubah:**
- Bot lama (layanan `agen-pertanahan`, cabang `main`) tetap berjalan seperti biasa.
- Kedua bot memakai folder Otomasi dan Database Raffy yang sama. Jangan mengerjakan kasus yang sama di dua bot sekaligus.
  - Bila Nomor Surat sudah tercatat, pengaduan tidak akan dicatat dua kali.

**Ada dua fase:**
- **Fase A (sekarang):** sambungkan ke Hermes yang sudah ada.
- **Fase B (disarankan, setelah Fase A berjalan baik):** pindahkan Hermes dari pengguna `root` ke pengguna biasa. Panduan keamanan Hermes melarang gateway berjalan sebagai root.

**Di mana langkah ini dikerjakan:**
- Semua perintah dijalankan di **Browser terminal hPanel** (hPanel → VPS → Browser terminal), sebagai root, kecuali disebut lain.
- **Telegram hanya untuk uji coba** (langkah A8).
- Jangan meminta Hermes menjalankan perintah ini lewat chat. Perintahnya menyentuh file rahasia dan pengaturan Hermes sendiri, dan sambungan chat terputus saat gateway dinyalakan ulang.
- Kode sumbernya ada di GitHub (cabang `hermes-mcp`). Langkah A2 mengunduhnya ke VPS.
- Jangan menempel isi `.env`, token, atau kunci API ke chat mana pun.
- Bila ada perintah yang menampilkan pesan galat, berhenti dan kirim pesan galatnya.

---

## Fase A: Sambungkan ke Hermes (±20 menit)

### A1. Perbarui Hermes
```
hermes update
hermes --version
```
Versi harus lebih baru dari `v0.22.5`. Versi baru dibutuhkan untuk mengunci skill (langkah A6).

### A2. Ambil kode server MCP
```
git clone -q --branch hermes-mcp https://github.com/phraffyaworks/ai-agentPertanahan.git /opt/agen-pertanahan-mcp
cd /opt/agen-pertanahan-mcp && npm ci --omit=dev --no-audit --no-fund
```
Folder ini terpisah dari folder bot (`/home/agen/ai-agentPertanahan`), jadi bot tidak tersentuh.

### A3. Isi pengaturan server MCP
Perintah ini menyalin tiga baris dari `.env` bot tanpa menampilkannya: alamat Apps Script, kode rahasia Apps Script, dan kunci Claude.
```
grep -E '^(APPS_SCRIPT_URL|APPS_SCRIPT_SECRET|ANTHROPIC_API_KEY)=' /home/agen/ai-agentPertanahan/.env > /opt/agen-pertanahan-mcp/.env
chmod 600 /opt/agen-pertanahan-mcp/.env
grep -oE '^[A-Z_]+=' /opt/agen-pertanahan-mcp/.env
```
Perintah terakhir hanya menampilkan nama pengaturannya, tanpa isinya. Harus muncul tiga baris: `APPS_SCRIPT_URL=`, `APPS_SCRIPT_SECRET=`, `ANTHROPIC_API_KEY=`.
- **Kunci Claude** dipakai alat `baca_berkas` untuk membaca PDF pengaduan, termasuk scan, tulisan tangan, dan cap, dengan cara yang sama seperti bot. Biayanya tercatat di kunci itu. Bila ingin biayanya terpisah, buat kunci baru di Claude Console, lalu ganti baris `ANTHROPIC_API_KEY` di file ini dengan `nano`.
- **Bila suatu hari Anda menjalankan `npm run setup` lagi di bot**, kode rahasia Apps Script ikut berganti. Ulangi langkah A3 setelahnya.

### A4. Periksa sambungan
```
cd /opt/agen-pertanahan-mcp && npm run cek-mcp
```
Kelima baris harus diawali `OK` (Google Drive, Google Sheets, Apps Script, Claude API, Folder berkas Hermes). Baris terakhir boleh bertuliskan "belum ada".

### A5. Daftarkan server MCP dan pengaman di Hermes
```
hermes mcp add pertanahan --command node --args /opt/agen-pertanahan-mcp/src/mcp/server.js
hermes config set mcp_servers.pertanahan.timeout 900
hermes config set mcp_servers.pertanahan.elicitation.timeout 600
hermes config set skills.external_dirs '["/opt/agen-pertanahan-mcp/hermes/skills"]'
hermes config set skills.write_approval true
hermes config set memory.write_approval true
hermes config set approvals.mode manual
hermes mcp test pertanahan
```
- Bila `hermes mcp add` menanyakan alat mana yang diaktifkan, pilih **semua**.
- `hermes mcp test pertanahan` harus melaporkan sambungan berhasil dan 19 alat.
- Maksud setiap pengaturan:
  - `timeout 900` dan `elicitation.timeout 600`: Hermes menunggu jawaban persetujuan Anda dan pembacaan PDF panjang sampai 10–15 menit.
  - `skills.external_dirs`: skill pertanahan dibaca langsung dari folder server MCP.
  - `write_approval`: Hermes tidak boleh mengubah skill dan ingatannya sendiri tanpa persetujuan Anda.
  - `approvals.mode manual`: perintah terminal yang berbahaya selalu ditanyakan dulu.
- Bandingkan hasilnya dengan `hermes/config-contoh.yaml` (perintah `hermes config edit` membuka file pengaturannya).

### A6. Tambahkan aturan pertanahan ke SOUL.md dan kunci skill
**Bila Anda sudah punya SOUL.md sendiri**, jangan ditimpa. Simpan cadangannya, lalu sambungkan tambahan pendek di akhirnya:
```
cp ~/.hermes/SOUL.md ~/.hermes/SOUL.md.cadangan
cat /opt/agen-pertanahan-mcp/hermes/SOUL-tambahan.md >> ~/.hermes/SOUL.md
```
- Tambahan ini berisi lima aturan: memuat skill pertanahan, membaca berkas dengan `baca_berkas`, tidak menebak, persetujuan, dan baris MEDIA.
- Perintah `cat ... >>` cukup dijalankan **sekali**. Bila dijalankan dua kali, tambahannya tertulis dua kali; pulihkan dengan `cp ~/.hermes/SOUL.md.cadangan ~/.hermes/SOUL.md`, lalu jalankan lagi sekali.

**Bila belum punya SOUL.md sendiri**, pakai versi lengkap yang meniru gaya bot:
```
cp /opt/agen-pertanahan-mcp/hermes/SOUL.md ~/.hermes/SOUL.md
```

Lalu kunci keempat skill pertanahan:
```
for s in pengaduan telaahan notula surat; do hermes curator lock pertanahan-$s; done
```
Bila `hermes curator lock` tidak dikenal, versi Hermes Anda belum diperbarui. Ulangi A1, atau sementara pakai `hermes curator pin`. Pin hanya mencegah skill dihapus, bukan diubah; pengaman `write_approval` tetap berlaku.

### A7. Nyalakan ulang gateway Hermes
Gateway adalah bagian Hermes yang tersambung ke Telegram. Menyalakannya ulang membuat Hermes memuat server MCP, skill, dan SOUL.md yang baru.
```
hermes gateway restart
hermes gateway status
```
- Bila `status` menyebut layanan sistem (system service), jalankan `hermes gateway restart --system`.
- Selama gateway menyala ulang (beberapa detik), bot Hermes di Telegram tidak menjawab.

### A8. Uji coba di bot Telegram Hermes
1. Kirim "halo". Hermes harus menjawab dalam bahasa Indonesia.
2. Kirim "kasus apa saja yang masih Menunggu di Master Data?". Hermes memakai `lihat_master_data` tanpa meminta persetujuan.
3. Kirim satu PDF pengaduan.
   - Hermes membaca isinya dengan `baca_berkas`, lalu meminta persetujuan untuk mencatatnya.
   - Pesan persetujuan berisi ringkasan seperti di bot: folder baru, nama PDF, baris Master Data, dan kolom [PERLU CEK].
   - Pada uji pertama, tekan **tolak**.
4. Saat menyetujui tindakan sungguhan, **selalu pilih tombol yang berarti "izinkan sekali"** (Allow Once / Once).
   - Jangan pilih Session atau Always.
   - Jangan pernah mengetik `/yolo`.
   - Jawaban yang tidak datang dalam 10 menit dianggap ditolak.
5. Setelah dokumen Word dibuat, file .docx terkirim ke chat dan tersimpan di folder pengadu di Drive.

---

## Fase B: Pindahkan Hermes dari root ke pengguna biasa (disarankan)

Saat ini Hermes terpasang di `/root/.hermes`, jadi semua alatnya, termasuk terminal, berjalan dengan hak penuh atas server. Di Fase B, Hermes dipasang ulang untuk pengguna `hermes`, lalu pengaturan, ingatan, dan skill Anda disalin ke sana. Server MCP dan skill pertanahan tetap di `/opt/agen-pertanahan-mcp`, milik root, sehingga Hermes tidak bisa mengubahnya.

### B1. Hentikan gateway yang berjalan sebagai root
```
hermes gateway status
hermes gateway stop
hermes gateway stop --system
systemctl disable hermes-gateway 2>/dev/null; systemctl --user disable hermes-gateway 2>/dev/null; true
```
Salah satu perintah `stop` boleh menampilkan galat bila layanan jenis itu tidak ada.

### B2. Buat pengguna dan pasang Hermes untuknya
```
adduser --disabled-password --gecos "" hermes
su - hermes -c "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash -s -- --non-interactive"
```

### B3. Salin pengaturan, ingatan, dan skill dari root
```
for x in config.yaml .env auth.json SOUL.md memories skills cron; do [ -e /root/.hermes/$x ] && cp -a /root/.hermes/$x /home/hermes/.hermes/; done
chown -R hermes:hermes /home/hermes/.hermes
chmod 600 /home/hermes/.hermes/.env
chgrp hermes /opt/agen-pertanahan-mcp/.env && chmod 640 /opt/agen-pertanahan-mcp/.env
su - hermes -c "hermes doctor"
```
- Baris `chgrp` membuat pengguna `hermes` boleh membaca `.env` server MCP, tetapi tidak boleh mengubahnya.
- `hermes doctor` harus tidak menampilkan masalah berat.

### B4. Jalankan gateway sebagai layanan pengguna `hermes`
```
loginctl enable-linger hermes
su - hermes -c 'export XDG_RUNTIME_DIR=/run/user/$(id -u); hermes gateway install'
su - hermes -c 'export XDG_RUNTIME_DIR=/run/user/$(id -u); hermes gateway status'
```
- `enable-linger` membuat layanan menyala sendiri setelah VPS di-reboot.
- Bila muncul galat seperti "Failed to connect to bus", berhenti dan kirim pesannya.

### B5. Uji lagi
Ulangi langkah A8.
- Mulai sekarang, perintah Hermes dijalankan sebagai pengguna `hermes`, misalnya:
  ```
  su - hermes -c 'export XDG_RUNTIME_DIR=/run/user/$(id -u); hermes update'
  ```
- Folder `/root/.hermes` lama biarkan dulu sebagai cadangan. Jangan dihapus sampai Hermes baru sudah berjalan baik beberapa hari.

---

## Memperbarui

Bila ada perubahan aturan atau format (misalnya pejabat penanda tangan berganti), perbarui bot seperti biasa, lalu jalankan sebagai root:
```
cd /opt/agen-pertanahan-mcp && git pull -q && npm ci --omit=dev --no-audit --no-fund
```
Setelah itu, nyalakan ulang gateway Hermes seperti di langkah A7 atau B4.
- Skill ikut terbarui dengan sendirinya, karena dibaca langsung dari folder ini.
- SOUL.md tidak ikut terbarui. Bila isi `hermes/SOUL-tambahan.md` berubah, sesuaikan SOUL.md Anda sendiri.

Skill dan SOUL.md dibuat dari aturan bot (`docs/KEPUTUSAN.md`, `src/agent/pengetahuan/`, `src/agent/prompt.js`) dengan `npm run hermes`. Uji otomatis memastikan keduanya tidak pernah tertinggal dari aturan bot.

## Cara kerja singkat

| Bagian | Isi |
|---|---|
| `src/mcp/server.js` | server MCP "pertanahan" (stdio) yang dijalankan Hermes |
| `src/mcp/alat.js` | 19 alat: 17 alat bot (kode yang sama), `lihat_berkas`, dan `baca_berkas` |
| `src/mcp/bacaBerkas.js` | membaca PDF atau foto lewat Claude, karena Hermes sendiri tidak meneruskan PDF ke model |
| `hermes/SOUL.md`, `hermes/skills/` | aturan bot dalam bentuk yang dibaca Hermes |
| Persetujuan | diminta server lewat MCP *elicitation*. Hermes menampilkannya sebagai tombol persetujuan di Telegram. Selain "setuju", semua jawaban (termasuk tidak dijawab) berarti tidak dikerjakan. Bila Hermes tidak mendukungnya, alat pengubah tidak berjalan sama sekali |
| Berkas | hanya berkas di folder cache Hermes (`~/.hermes/cache`) yang boleh dibaca atau diunggah, supaya file lain di server, misalnya `.env`, tidak bisa terkirim |
