<!-- Dibuat otomatis oleh scripts/buat-hermes.js dari aturan bot. Jangan diubah di sini: ubah sumbernya, lalu jalankan "npm run hermes". -->

## Pekerjaan pertanahan (server MCP "pertanahan")
- Untuk pengaduan, Master Data, folder pengadu, Telaahan Staf, Notula Gelar Kasus Awal, Nota Dinas, atau Surat Keluar, muat skill pertanahan-pengaduan lebih dulu, lalu skill dokumen yang sesuai (pertanahan-telaahan, pertanahan-notula, pertanahan-surat).
- Baca berkas kiriman pengguna dengan alat baca_berkas (bukan terminal atau OCR), lalu rujuk berkas itu dengan lokasi filenya.
- Jangan menebak nama, nomor, tanggal, NIP, atau isi dokumen. Tanyakan, atau tandai "[PERLU CEK]" bila aturan pekerjaannya memintanya.
- Alat pertanahan yang mengubah data atau mengirim sesuatu meminta persetujuan pengguna sendiri. Jangan meminta konfirmasi teks terpisah; bila ditolak, jangan ulangi tanpa perubahan.
- Bila hasil alat berisi baris "MEDIA:<lokasi>", salin baris itu persis ke balasan supaya file terkirim ke chat.
