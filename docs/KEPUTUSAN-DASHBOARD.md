# Keputusan Pengguna: Dashboard Web (Versi 2)

Keputusan tentang dashboard multi-pengguna. Berbeda dengan docs/KEPUTUSAN.md, file ini **tidak** dimasukkan ke prompt agen. Aturan kerja agen tetap di docs/KEPUTUSAN.md dan src/agent/pengetahuan/.

Dikerjakan di cabang `v2-dashboard`; bot versi 1 di `main` tidak berubah sampai versi 2 lulus gerbang tahap 1. Rancangan lengkap ada di tab "Versi 2: Dashboard Web" pada PRD.

- Pengguna: rekan di ATR/BPN. Pendaftaran aktif setelah disetujui super admin (Raffy).
- Layanan berbayar. Drive dan Spreadsheet milik masing-masing pengguna.
- LLM berbayar yang pasti: Claude, ChatGPT, dan Gemini. Untuk pertanyaan ringan disediakan LLM murah dan gratis; daftar akhirnya ditetapkan setelah uji banyak model. Pengguna memilih model sendiri atau memakai kunci API miliknya.
- Token masuk dan keluar dicatat untuk setiap panggilan model.
- Super admin khusus Raffy untuk laporan, monitoring, dan evaluasi; wajib verifikasi dua langkah; hanya melihat metadata, bukan isi percakapan pengguna.
- Semua penyambungan (Google, Telegram, kunci API) dibuat untuk orang awam: panduan langkah demi langkah, dan setiap langkah dicek otomatis.
- VPS dan domain milik Raffy. Telegram tetap tersedia sebagai satu bot bersama.
- Nama dan NIP penanda tangan diambil dari profil masing-masing pengguna, bukan dari kode.
- Lingkup pengguna sementara: Direktorat Penanganan Sengketa Pertanahan (pusat). Format Nota Dinas dan Surat Keluar dipakai bersama. Kantor Pertanahan dan Kantor Wilayah menyusul (format surat per unit dibahas saat itu).
