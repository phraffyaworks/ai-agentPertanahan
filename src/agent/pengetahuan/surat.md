# Aturan Nota Dinas dan Surat Keluar

Disusun dari contoh Word pengguna (Oktober 2026): Nota Dinas "Pelimpahan Berkas ke Sesdit PHPT" (acuannya dua nota terakhir, kasus Indahwati), Surat Keluar ke Kepala Kantor Pertanahan Kabupaten Bekasi dan Surat Keluar ke PT Cikarang Listrindo, Tbk. Tata letak sudah dikunci di alat `buat_nota_dinas` dan `buat_surat_keluar`.

## Alur
1. Tanyakan dulu yang belum jelas: jenis surat, tujuan, dan isi pokoknya (untuk Nota Dinas juga pengirimnya). Jangan menebak.
2. Tampilkan draf lengkap di chat: kepala surat, isi bernomor, penutup, penanda tangan, tembusan. Revisi sampai pengguna menyatakan setuju.
3. Panggil alatnya dengan isi yang disetujui, persis tanpa perubahan. Isi `tujuan_singkat` untuk nama file (mis. "Kantah Kab Bekasi", "Pengadu", "Sesditjen PSKP").
4. Nomor dan tanggal dikosongkan, diisi setelah penomoran. Kata sambung di pergantian halaman diatur pengguna sendiri; tidak perlu diingatkan.

## Jenis surat
- **Nota Dinas**: surat antarunit di dalam Kementerian, mis. pelimpahan berkas ke Direktorat Jenderal lain.
- **Surat Keluar**: surat ke pihak di luar Kementerian pusat, mis. Kantor Pertanahan, Kantor Wilayah, atau Pengadu.
- Contoh pelimpahan kasus Indahwati berisi dua Nota Dinas: dari Direktur Penanganan Sengketa Pertanahan kepada Sekretaris Direktorat Jenderal Penanganan Sengketa dan Konflik Pertanahan, lalu dari Sekretaris Direktorat Jenderal kepada Sekretaris Direktorat Jenderal Direktorat Jenderal Penetapan Hak dan Pendaftaran Tanah. Tanyakan apakah perlu satu atau keduanya.
- Isian Yth. untuk Sekretaris Direktorat Jenderal Penetapan Hak dan Pendaftaran Tanah ditulis persis "Sekretaris Direktorat Jenderal Direktorat Jenderal Penetapan Hak dan Pendaftaran Tanah" ("Direktorat Jenderal" memang dua kali; ditetapkan pengguna).

## Penanda tangan (ditetapkan pengguna)
Penanda tangan mengikuti pengirim surat:
- Dari Direktur Penanganan Sengketa Pertanahan: jabatan "Direktur Penanganan Sengketa Pertanahan", I Made Daging, A.Ptnh., M.H., NIP. 19690818 199103 1 004.
- Dari Sekretaris Direktorat Jenderal Penanganan Sengketa dan Konflik Pertanahan: jabatan tanda tangan "Sekretaris Direktorat Jenderal", Lalu Harisandi, S.ST., M.H., QCRO., NIP. 19800920 199903 1 001.
Surat Keluar selalu ditandatangani Direktur Penanganan Sengketa Pertanahan atas nama Direktur Jenderal Penanganan Sengketa dan Konflik Pertanahan ("a.n Direktur Jenderal" / "Direktur Penanganan Sengketa Pertanahan," / I Made Daging). Alat `buat_surat_keluar` memasangnya otomatis; jangan isi `penandatangan` kecuali pengguna meminta penanda tangan lain. Bila Nota Dinas dikirim pejabat lain, tanyakan nama, jabatan, dan NIP-nya. Awalan "NIP." dibuat otomatis.

## Nota Dinas
- Kepala: Yth., Dari, Tanggal (kosong), Lampiran (mis. "1 (Satu) Berkas"), Hal (mis. "Pelimpahan Berkas"). Nomor dikosongkan.
- Butir 1 "Rujukan:" dengan sub-butir peraturan yang relevan. Pada contoh: (a) Peraturan Menteri Agraria dan Tata Ruang/Kepala Badan Pertanahan Nasional Nomor 21 Tahun 2020 Tentang Penanganan dan Penyelesaian Kasus Pertanahan; (b) Peraturan Menteri Agraria dan Tata Ruang/Kepala Badan Pertanahan Nasional Nomor 06 Tahun 2025 Tentang Organisasi dan Tata Kerja Kementerian Agraria dan Tata Ruang/Badan Pertanahan Nasional.
- Butir berikutnya, pola contoh: "Sehubungan dengan rujukan tersebut di atas, bersama ini kami sampaikan surat pengaduan dari Saudara [Pengadu] (Pengadu) [nomor bila ada] tanggal ... perihal ... yang ditujukan kepada ... (Nomor Agenda ...)", lalu uraian singkat permasalahan, lalu alasan kewenangan dan penerusan: "... bersama ini kami sampaikan surat tersebut kepada Saudara untuk penanganan lebih lanjut."
- Penutup: "Demikian untuk menjadikan maklum."
- Tembusan pada contoh: "Direktur Jenderal Penanganan Sengketa dan Konflik Pertanahan."

## Surat Keluar (sukel)
Pengguna menyebut kasusnya, tujuan sukel, dan isi pokoknya (mis. hasil penelitian atau jawaban atas pengaduan) lewat Telegram. Tujuan sukel ditentukan pengguna per surat; bila belum disebut, tanyakan. Bagian lain disiapkan bot:
1. **Data kasus** diambil dari Master Data (`lihat_master_data` dengan nama Pengadu): Nomor Surat, Tanggal Surat, Perihal, Pengadu (Prinsipal), Penerima Kuasa, dan Objek Permasalahan. Folder pengadu dari `lihat_folder`. Tanggal dd/mm/yyyy ditulis "24 April 2026". Bila Nomor Surat "-", bagian "Nomor ..." dihilangkan dari kalimat. Kolom yang kosong atau [PERLU CEK] ditanyakan, bukan dikarang. Pihak yang dituju surat pengaduan ("yang ditujukan kepada ...") tidak ada di Master Data: ambil dari PDF pengaduan bila tersedia di percakapan, atau tanyakan.
2. **Letak objek** menentukan instansi daerah: Kantor Pertanahan sesuai kota/kabupaten letak objek, dan Kantor Wilayah sesuai provinsinya (dari kolom Objek Permasalahan atau nama folder), bukan alamat para pihak.
3. **Tembusan** dipilih dari: Kepala Kantor Wilayah Badan Pertanahan Nasional Provinsi [provinsi]; Kepala Kantor Pertanahan [kota/kabupaten]; dan/atau Pengadu. Pihak yang menjadi tujuan surat tidak ditembuskan. Dalam draf, usulkan semua yang bukan tujuan, dengan urutan Kantor Wilayah, Kantor Pertanahan, Pengadu; pengguna yang menentukan akhirnya. Pengadu ditulis dengan nama Pengadu (Prinsipal) di Master Data; bila ada Penerima Kuasa, tanyakan apakah tembusan ditujukan kepada kuasanya.
4. **Penanda tangan** tetap dan dipasang otomatis (lihat bagian Penanda tangan).
5. Tampilkan draf lengkap, revisi sampai disetujui, lalu panggil `buat_surat_keluar`.

Format:
- Kepala: Nomor (kosong) dan "Jakarta," (tanggal kosong), Sifat (contoh: "Biasa"), Lampiran ("1 (satu) Berkas" atau "-"), Hal.
- Hal pada contoh: "Tindak Lanjut Atas Pengaduan [Pengadu]" (kepada Kantor Pertanahan), "Jawaban atas Pengaduan [Pengadu]" (kepada Pengadu).
- Alamat: "Yth. [tujuan]", "di -", lalu tempat: kota kedudukan kantor (mis. "Cikarang" untuk Kantor Pertanahan Kabupaten Bekasi) atau "Tempat". Bila kota kedudukan kantor tidak pasti, cek dengan pencarian web dan sebutkan sumbernya di draf, atau tanyakan.
- Pembuka: "Sehubungan dengan surat [pengaduan Pengadu / Saudara] Nomor ... tanggal ... perihal ... yang ditujukan kepada ..., bersama ini disampaikan hal-hal sebagai berikut:".
- Butir diawali "Bahwa ..." dan diakhiri titik koma; butir terakhir diakhiri titik. Kepada Pengadu, Pengadu disebut "Saudara".
- Penutup pada contoh: "Demikian disampaikan untuk dilaksanakan." (meminta tindakan, mis. kepada Kantor Pertanahan) atau "Demikian disampaikan untuk menjadi maklum." (pemberitahuan, mis. kepada Pengadu).
- Tembusan bernomor, diakhiri titik koma, yang terakhir titik.

## Penulisan
- Bahasa Indonesia formal, tidak ambigu, nama dan nomor persis sesuai berkas. Data yang belum diketahui ditanyakan, bukan dikarang.
- Istilah asing ditulis *miring* (mis. *pump house*). Satuan luas memakai "m²".
- Nama hak ditulis lengkap, mis. "Hak Guna Bangunan Nomor 289/Wangunharja".
