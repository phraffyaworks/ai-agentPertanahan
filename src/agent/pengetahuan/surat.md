# Aturan Nota Dinas dan Surat Keluar

Disusun dari contoh Word pengguna (Oktober 2026): Nota Dinas "Pelimpahan Berkas ke Sesdit PHPT" (acuannya dua nota terakhir, kasus Indah Soetanto), Surat Keluar ke Kepala Kantor Pertanahan Kabupaten Bekasi dan Surat Keluar ke PT Cikarang Listrindo, Tbk. Tata letak sudah dikunci di alat `buat_nota_dinas` dan `buat_surat_keluar`.

## Alur
1. Tanyakan dulu yang belum jelas: jenis surat, tujuan, penanda tangan, dan isi pokoknya. Jangan menebak.
2. Tampilkan draf lengkap di chat: kepala surat, isi bernomor, penutup, penanda tangan, tembusan. Revisi sampai pengguna menyatakan setuju.
3. Panggil alatnya dengan isi yang disetujui, persis tanpa perubahan. Isi `tujuan_singkat` untuk nama file (mis. "Kantah Kab Bekasi", "Pengadu", "Sesditjen PSKP").
4. Nomor dan tanggal dikosongkan, diisi setelah penomoran. Kata sambung di pergantian halaman diatur pengguna sendiri; tidak perlu diingatkan.

## Jenis surat
- **Nota Dinas**: surat antarunit di dalam Kementerian, mis. pelimpahan berkas ke Direktorat Jenderal lain.
- **Surat Keluar**: surat ke pihak di luar Kementerian pusat, mis. Kantor Pertanahan, Kantor Wilayah, atau Pengadu.
- Contoh pelimpahan kasus Indah Soetanto berisi dua Nota Dinas: dari Direktur Penanganan Sengketa Pertanahan kepada Sekretaris Direktorat Jenderal Penanganan Sengketa dan Konflik Pertanahan, lalu dari Sekretaris Direktorat Jenderal kepada Sekretaris Direktorat Jenderal Penetapan Hak dan Pendaftaran Tanah. Tanyakan apakah perlu satu atau keduanya.

## Penanda tangan (ditetapkan pengguna)
Penanda tangan mengikuti pengirim surat:
- Dari Direktur Penanganan Sengketa Pertanahan: jabatan "Direktur Penanganan Sengketa Pertanahan", I Made Daging, A.Ptnh., M.H., NIP 19690818 199103 1 004.
- Dari Sekretaris Direktorat Jenderal Penanganan Sengketa dan Konflik Pertanahan: jabatan tanda tangan "Sekretaris Direktorat Jenderal", Lalu Harisandi, S.ST., M.H., QCRO., NIP 19800920 199903 1 001.
Pada Surat Keluar, Direktur menandatangani atas nama Direktur Jenderal: `atas_nama` "a.n Direktur Jenderal", jabatan "Direktur Penanganan Sengketa Pertanahan". Bila pengirimnya pejabat lain, tanyakan nama, jabatan, dan NIP-nya. Awalan "NIP." dibuat otomatis.

## Nota Dinas
- Kepala: Yth., Dari, Tanggal (kosong), Lampiran (mis. "1 (Satu) Berkas"), Hal (mis. "Pelimpahan Berkas"). Nomor dikosongkan.
- Butir 1 "Rujukan:" dengan sub-butir peraturan yang relevan. Pada contoh: (a) Peraturan Menteri Agraria dan Tata Ruang/Kepala Badan Pertanahan Nasional Nomor 21 Tahun 2020 Tentang Penanganan dan Penyelesaian Kasus Pertanahan; (b) Peraturan Menteri Agraria dan Tata Ruang/Kepala Badan Pertanahan Nasional Nomor 06 Tahun 2025 Tentang Organisasi dan Tata Kerja Kementerian Agraria dan Tata Ruang/Badan Pertanahan Nasional.
- Butir berikutnya, pola contoh: "Sehubungan dengan rujukan tersebut di atas, bersama ini kami sampaikan surat pengaduan dari Saudara [Pengadu] (Pengadu) [nomor bila ada] tanggal ... perihal ... yang ditujukan kepada ... (Nomor Agenda ...)", lalu uraian singkat permasalahan, lalu alasan kewenangan dan penerusan: "... bersama ini kami sampaikan surat tersebut kepada Saudara untuk penanganan lebih lanjut."
- Penutup: "Demikian untuk menjadikan maklum."
- Tembusan pada contoh: "Direktur Jenderal Penanganan Sengketa dan Konflik Pertanahan."

## Surat Keluar
- Kepala: Nomor (kosong) dan "Jakarta," (tanggal kosong), Sifat (contoh: "Biasa"), Lampiran ("1 (satu) Berkas" atau "-"), Hal.
- Hal pada contoh: "Tindak Lanjut Atas Pengaduan [Pengadu]" (kepada Kantor Pertanahan), "Jawaban atas Pengaduan [Pengadu]" (kepada Pengadu).
- Alamat: "Yth. [tujuan]", "di -", lalu tempat: kota kedudukan kantor (mis. "Cikarang" untuk Kantor Pertanahan Kabupaten Bekasi) atau "Tempat".
- Pembuka: "Sehubungan dengan surat [pengaduan Pengadu / Saudara] Nomor ... tanggal ... perihal ... yang ditujukan kepada ..., bersama ini disampaikan hal-hal sebagai berikut:".
- Butir diawali "Bahwa ..." dan diakhiri titik koma; butir terakhir diakhiri titik. Kepada Pengadu, Pengadu disebut "Saudara".
- Penutup pada contoh: "Demikian disampaikan untuk dilaksanakan." (meminta tindakan, mis. kepada Kantor Pertanahan) atau "Demikian disampaikan untuk menjadi maklum." (pemberitahuan, mis. kepada Pengadu).
- Tembusan bernomor, diakhiri titik koma, yang terakhir titik. Contoh: Direktur Jenderal Penanganan Sengketa dan Konflik Pertanahan; Kepala Kantor Wilayah Badan Pertanahan Nasional Provinsi [provinsi]; Kepala Kantor Pertanahan [kota/kabupaten] (bila surat kepada Pengadu).

## Penulisan
- Bahasa Indonesia formal, tidak ambigu, nama dan nomor persis sesuai berkas. Data yang belum diketahui ditanyakan, bukan dikarang.
- Istilah asing ditulis *miring* (mis. *pump house*). Satuan luas memakai "m²".
- Nama hak ditulis lengkap, mis. "Hak Guna Bangunan Nomor 289/Wangunharja".
