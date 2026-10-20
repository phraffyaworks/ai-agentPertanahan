# Memasang Apps Script (akses Google Drive & Sheets)

Bot memakai Apps Script milik Anda untuk membuat folder, menyimpan PDF, dan mengisi Database Raffy. Cara ini tidak memerlukan Google Cloud atau Client ID, dan izinnya tidak kedaluwarsa.

Kerjakan **sekali saja**, di browser laptop, dengan akun **phraffyaworks@gmail.com**. Kira-kira 10 menit.

Hasil akhirnya satu alamat **Web app URL** (diakhiri `/exec`). Alamat itu nanti ditempel saat pemasangan di VPS.

---

## Langkah 1. Buat proyek baru
1. Buka **https://script.new**
2. Bila diminta login, masuk dengan **phraffyaworks@gmail.com**.
3. ✅ Terbuka editor bertuliskan **Untitled project**, dengan file **Code.gs** berisi `function myFunction() { }`.

## Langkah 2. Beri nama proyek
1. Klik tulisan **Untitled project** di kiri atas.
2. Ketik `masAI Pertanahan`, lalu klik **Rename**.

## Langkah 3. Tempel skrip
1. Di tab baru, buka **https://raw.githubusercontent.com/phraffyaworks/ai-agentPertanahan/main/apps-script/Kode.gs**
2. Tekan **Ctrl+A**, lalu **Ctrl+C**, untuk menyalin semua isinya.
3. Kembali ke editor Apps Script. Klik di dalam isi **Code.gs**, tekan **Ctrl+A**, lalu **Delete**, sampai kosong.
4. Tekan **Ctrl+V** untuk menempel.
5. Tekan **Ctrl+S** atau klik ikon disket (**Save project**).
6. ✅ Baris pertama isinya `/**` dan baris berikutnya `* Jembatan Google Drive & Sheets ...`.

## Langkah 4. Beri izin
1. Di bilah atas editor, ada kotak pilihan fungsi (di sebelah tombol **Debug**). Pilih **izinkanAkses**.
2. Klik **Run**.
3. Muncul jendela **Authorization required**. Klik **Review permissions**.
4. Pilih akun **phraffyaworks@gmail.com**.
5. Muncul **"Google hasn't verified this app"**. Klik **Advanced**, lalu **Go to masAI Pertanahan (unsafe)**.
6. Di halaman izin, **centang semua kotak** (atau **Select all**), lalu klik **Continue**.
7. ✅ Di bagian **Execution log** di bawah, muncul `Izin sudah diberikan untuk akun phraffyaworks@gmail.com`.

Bila yang muncul justru **"Access blocked"**, berhenti di sini dan kirim tangkapan layarnya ke saya.

## Langkah 5. Deploy sebagai Web App
1. Klik tombol biru **Deploy** di kanan atas, lalu pilih **New deployment**.
2. Klik ikon roda gigi di sebelah **Select type**, lalu pilih **Web app**.
3. Isi:
   - **Description**: `Bot`
   - **Execute as**: **Me (phraffyaworks@gmail.com)**
   - **Who has access**: **Anyone**
4. Klik **Deploy**. Bila diminta izin lagi, ulangi Langkah 4 nomor 3–6.
5. ✅ Muncul **Web app URL**, bentuknya `https://script.google.com/macros/s/AKfy.../exec`. Klik **Copy**, lalu simpan di catatan pribadi.
6. Klik **Done**.

## Langkah 6. Cek
1. Buka **Web app URL** tadi di tab baru.
2. ✅ Tampil tulisan `Web App Agen Pertanahan aktif (versi 1).`

Selesai. Alamat ini ditempel di VPS saat program menanyakan **"Tempel alamat Web App Apps Script"** (lihat docs/VPS.md).

---

## Catatan

- **"Who has access: Anyone"** artinya alamat itu bisa dihubungi dari VPS tanpa login Google. Isinya tetap aman: setiap permintaan wajib membawa kode rahasia yang dibuat dan dipasangkan otomatis oleh `npm run setup`. Permintaan tanpa kode itu ditolak.
- Jangan membagikan **Web app URL** ke orang lain.
- **Bila skrip diperbarui** (saya akan memberi tahu), tempel skrip baru di Code.gs dan simpan. Lalu buka **Deploy → Manage deployments**, klik ikon pensil, pilih **Version: New version**, dan klik **Deploy**. Alamatnya tetap sama.
- **Memasangkan ulang** (misalnya VPS diganti): di editor, pilih fungsi **resetKodeRahasia**, klik **Run**, lalu jalankan `npm run setup` di VPS.
- Project Google Cloud ("masAI Pertanahan" maupun "phraff-aiotomation") tidak dipakai lagi. Boleh dibiarkan.
