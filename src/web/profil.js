// Profil penanda tangan per pengguna: validasi isian dashboard dan pemetaan ke data pembuat dokumen.
const { KOLOM_PROFIL } = require('./halaman');

const KOLOM = KOLOM_PROFIL.filter(k => k.nama);
const bersih = v => String(v ?? '').replace(/\s+/g, ' ').trim();
// NIP disimpan sebagai 18 angka tanpa spasi; awalan "NIP." dan spasi dibuang.
const angkaNip = v => bersih(v).replace(/^NIP\.?\s*/i, '').replace(/\s/g, '');

function validasiProfil(masukan) {
  const data = {}, salah = {};
  for (const k of KOLOM) {
    const v = k.nip ? angkaNip(masukan[k.nama]) : bersih(masukan[k.nama]);
    data[k.nama] = v;
    if (!v) {
      if (k.wajib !== false) salah[k.nama] = 'Wajib diisi.';
    } else if (k.nip && !/^\d{18}$/.test(v)) {
      salah[k.nama] = `NIP harus 18 angka; yang terisi ${v.replace(/\D/g, '').length} angka.`;
    } else if (v.length > 200) {
      salah[k.nama] = 'Terlalu panjang (maksimal 200 karakter).';
    }
  }
  return { data, salah };
}

// Bentuk yang dipakai pembuat dokumen (src/docs): pengolah, kasubdit, kota, dan penanda tangan Surat Keluar.
const keDokumen = p => (p ? {
  pengolah: { nama: p.pengolah_nama, nip: p.pengolah_nip },
  kasubdit: { jabatan: p.atasan_jabatan, nama: p.atasan_nama, nip: p.atasan_nip },
  kota: p.kota,
  ttdSuratKeluar: { atas_nama: p.ttd_atas_nama || undefined, jabatan: p.ttd_jabatan, nama: p.ttd_nama, nip: p.ttd_nip },
} : null);

module.exports = { validasiProfil, keDokumen, angkaNip };
