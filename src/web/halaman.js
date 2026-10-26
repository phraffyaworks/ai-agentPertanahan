// Halaman HTML dashboard. Dirender di server (tanpa kerangka JavaScript) supaya ringan dan cepat.
// Setiap teks dari pengguna WAJIB lewat e() agar tidak bisa menyisipkan HTML.

const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const GAYA = `
:root{--bg:#f6f7f9;--kartu:#fff;--teks:#1d232b;--pudar:#5b6573;--garis:#d9dde3;--utama:#1f5fbf;--utama-teks:#fff;
--baik:#1c7c3c;--baik-bg:#e7f5ec;--buruk:#b3261e;--buruk-bg:#fdecea;--info-bg:#eaf1fc}
@media (prefers-color-scheme:dark){:root{--bg:#14171c;--kartu:#1d2228;--teks:#e8ebef;--pudar:#a3acb8;--garis:#353c45;
--utama:#6ea2f5;--utama-teks:#0b1220;--baik:#6fd08f;--baik-bg:#16301f;--buruk:#f2a29c;--buruk-bg:#3a1b19;--info-bg:#1a2638}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--teks);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{background:var(--kartu);border-bottom:1px solid var(--garis)}
.atas{max-width:960px;margin:0 auto;padding:12px 16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.merek{font-weight:700;margin-right:auto;color:var(--teks);text-decoration:none}
nav{display:flex;gap:18px;align-items:center;flex-wrap:wrap}nav a,nav button{color:var(--utama);text-decoration:none;background:none;border:0;font:inherit;cursor:pointer;padding:4px 0}
nav form,.sebaris{display:inline}
main{max-width:960px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:1.6rem;margin:0 0 8px}h2{font-size:1.2rem;margin:28px 0 8px}
.kartu{background:var(--kartu);border:1px solid var(--garis);border-radius:10px;padding:20px;margin:16px 0}
.sempit{max-width:480px;margin-left:auto;margin-right:auto}
label{display:block;font-weight:600;margin:16px 0 4px}
.contoh{color:var(--pudar);font-size:.9rem;margin:2px 0 6px}
input,select,textarea{width:100%;padding:10px 12px;font:inherit;border:1px solid var(--garis);border-radius:8px;background:var(--kartu);color:var(--teks)}
input:focus,select:focus,textarea:focus{outline:3px solid var(--info-bg);border-color:var(--utama)}
.salah input{border-color:var(--buruk)}.pesan-salah{color:var(--buruk);font-size:.9rem;margin-top:4px}
.tombol{display:inline-block;background:var(--utama);color:var(--utama-teks);border:0;border-radius:8px;padding:12px 20px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;margin-top:20px}
.tombol.kedua{background:none;color:var(--utama);border:1px solid var(--utama)}
.tombol.kecil{padding:6px 12px;margin:0 4px 0 0;font-size:.9rem}
.tombol.bahaya{background:var(--buruk);color:#fff}
.pemberitahuan{border-radius:8px;padding:12px 16px;margin:16px 0}
.pemberitahuan.baik{background:var(--baik-bg);color:var(--baik)}.pemberitahuan.buruk{background:var(--buruk-bg);color:var(--buruk)}
.pemberitahuan.info{background:var(--info-bg)}
.langkah{list-style:none;padding:0;margin:0}
.langkah li{display:flex;gap:14px;align-items:flex-start;padding:16px 0;border-bottom:1px solid var(--garis)}
.langkah li:last-child{border-bottom:0}
.tanda{flex:0 0 32px;height:32px;border-radius:50%;display:grid;place-items:center;font-weight:700;border:2px solid var(--garis);color:var(--pudar)}
.tanda.selesai{background:var(--baik);border-color:var(--baik);color:#fff}
.langkah .isi{flex:1}.langkah .isi p{margin:2px 0;color:var(--pudar)}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--garis);vertical-align:top}
th{font-size:.9rem;color:var(--pudar)}
.lencana{display:inline-block;font-size:.8rem;padding:2px 10px;border-radius:999px;border:1px solid var(--garis)}
.lencana.aktif{background:var(--baik-bg);color:var(--baik);border-color:transparent}
.lencana.menunggu{background:var(--info-bg)}
.lencana.dibekukan,.lencana.ditolak{background:var(--buruk-bg);color:var(--buruk);border-color:transparent}
.gulir{overflow-x:auto}
code,.kode{font-family:ui-monospace,Consolas,monospace;background:var(--info-bg);padding:2px 6px;border-radius:4px;word-break:break-all}
.pudar{color:var(--pudar)}
.kode-besar{font:700 2.2rem/1.2 ui-monospace,Consolas,monospace;letter-spacing:.3em;background:var(--info-bg);border-radius:10px;padding:12px 18px;display:inline-block;margin:8px 0}
.bagian-langkah{counter-reset:l;list-style:none;padding:0}.bagian-langkah>li{counter-increment:l;position:relative;padding:0 0 20px 48px}
.bagian-langkah>li::before{content:counter(l);position:absolute;left:0;top:0;width:32px;height:32px;border-radius:50%;background:var(--utama);color:var(--utama-teks);display:grid;place-items:center;font-weight:700}
.bagian-langkah h3{margin:4px 0 6px;font-size:1.05rem}.bagian-langkah ol,.bagian-langkah ul{padding-left:20px;margin:6px 0}
.catatan{border-left:4px solid var(--utama);background:var(--info-bg);padding:10px 14px;border-radius:6px;margin:10px 0}
`;

function tata({ judul, isi, akun = null, csrf = '', pesan = null, skrip = null }) {
  const menu = akun ? `<nav>
      ${akun.status === 'aktif' && !akun.perlu2fa ? '<a href="/mulai">Mulai</a> <a href="/profil">Profil</a>' : ''}
      ${akun.peran === 'admin' && akun.status === 'aktif' && !akun.perlu2fa ? '<a href="/admin">Super admin</a>' : ''}
      <form method="post" action="/keluar"><input type="hidden" name="_csrf" value="${e(csrf)}"><button type="submit">Keluar</button></form>
    </nav>` : '<nav><a href="/masuk">Masuk</a> <a href="/daftar">Daftar</a></nav>';
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(judul)} · Agen Pertanahan</title><style>${GAYA}</style>${skrip ? `<script src="${e(skrip)}" defer></script>` : ''}</head><body>
<header><div class="atas"><a class="merek" href="/">Agen Pertanahan</a>${menu}</div></header>
<main>${pesan ? `<div class="pemberitahuan ${e(pesan.jenis || 'info')}" role="status">${e(pesan.teks)}</div>` : ''}${isi}</main>
</body></html>`;
}

// Kolom isian: label, contoh isian, nilai lama, dan pesan salah di bawahnya.
function kolom({ nama, label, contoh = '', jenis = 'text', nilai = '', salah = null, wajib = true, lengkapi = 'off', bantuan = '' }) {
  return `<div class="${salah ? 'salah' : ''}">
    <label for="${e(nama)}">${e(label)}</label>
    ${contoh ? `<div class="contoh">Contoh: ${e(contoh)}</div>` : ''}${bantuan ? `<div class="contoh">${e(bantuan)}</div>` : ''}
    <input id="${e(nama)}" name="${e(nama)}" type="${e(jenis)}" value="${jenis === 'password' ? '' : e(nilai)}"
      autocomplete="${e(lengkapi)}"${wajib ? ' required' : ''}${salah ? ` aria-invalid="true" aria-describedby="${e(nama)}-salah"` : ''}>
    ${salah ? `<div class="pesan-salah" id="${e(nama)}-salah">${e(salah)}</div>` : ''}
  </div>`;
}

const csrfInput = csrf => `<input type="hidden" name="_csrf" value="${e(csrf)}">`;

// ---------- halaman akun ----------
const halamanDaftar = ({ csrf, nilai = {}, salah = {}, pesan }) => tata({ judul: 'Daftar', csrf, pesan, isi: `
<div class="kartu sempit">
  <h1>Daftar akun</h1>
  <p class="pudar">Untuk rekan di ATR/BPN. Akun aktif setelah disetujui pengelola.</p>
  <form method="post" action="/daftar" novalidate>${csrfInput(csrf)}
    ${kolom({ nama: 'nama', label: 'Nama lengkap', contoh: 'Budi Santoso', nilai: nilai.nama, salah: salah.nama, lengkapi: 'name' })}
    ${kolom({ nama: 'email', label: 'Email', contoh: 'budi.santoso@gmail.com', jenis: 'email', nilai: nilai.email, salah: salah.email, lengkapi: 'email' })}
    ${kolom({ nama: 'unit_kerja', label: 'Unit kerja', contoh: 'Kantor Pertanahan Kabupaten Bekasi', nilai: nilai.unit_kerja, salah: salah.unit_kerja, lengkapi: 'organization' })}
    ${kolom({ nama: 'sandi', label: 'Kata sandi', jenis: 'password', salah: salah.sandi, lengkapi: 'new-password', bantuan: 'Minimal 10 karakter. Boleh berupa kalimat yang mudah Anda ingat.' })}
    ${kolom({ nama: 'sandi2', label: 'Ulangi kata sandi', jenis: 'password', salah: salah.sandi2, lengkapi: 'new-password' })}
    <button class="tombol" type="submit">Daftar</button>
  </form>
  <p>Sudah punya akun? <a href="/masuk">Masuk</a></p>
</div>` });

const halamanMasuk = ({ csrf, nilai = {}, salah = null, pesan }) => tata({ judul: 'Masuk', csrf, pesan, isi: `
<div class="kartu sempit">
  <h1>Masuk</h1>
  ${salah ? `<div class="pemberitahuan buruk" role="alert">${e(salah)}</div>` : ''}
  <form method="post" action="/masuk" novalidate>${csrfInput(csrf)}
    ${kolom({ nama: 'email', label: 'Email', jenis: 'email', nilai: nilai.email, lengkapi: 'email' })}
    ${kolom({ nama: 'sandi', label: 'Kata sandi', jenis: 'password', lengkapi: 'current-password' })}
    <button class="tombol" type="submit">Masuk</button>
  </form>
  <p>Belum punya akun? <a href="/daftar">Daftar</a></p>
  <p class="pudar">Lupa kata sandi? Hubungi pengelola untuk mengatur ulang.</p>
</div>` });

const halamanKode2fa = ({ csrf, salah = null }) => tata({ judul: 'Verifikasi dua langkah', csrf, isi: `
<div class="kartu sempit">
  <h1>Verifikasi dua langkah</h1>
  <p>Buka aplikasi authenticator di ponsel Anda, lalu ketik 6 angka untuk Agen Pertanahan.</p>
  ${salah ? `<div class="pemberitahuan buruk" role="alert">${e(salah)}</div>` : ''}
  <form method="post" action="/masuk/2fa">${csrfInput(csrf)}
    ${kolom({ nama: 'kode', label: 'Kode 6 angka', contoh: '123456', lengkapi: 'one-time-code' })}
    <button class="tombol" type="submit">Lanjut</button>
  </form>
</div>` });

const KET_STATUS = {
  menunggu: ['Menunggu persetujuan', 'Akun Anda sudah terdaftar dan sedang menunggu persetujuan pengelola. Silakan masuk lagi nanti.'],
  dibekukan: ['Akun dibekukan', 'Akun Anda sedang dibekukan. Hubungi pengelola untuk informasi lebih lanjut.'],
  ditolak: ['Pendaftaran ditolak', 'Pendaftaran Anda tidak disetujui. Hubungi pengelola bila menurut Anda ini keliru.'],
};
const halamanStatus = ({ akun, csrf }) => {
  const [judul, teks] = KET_STATUS[akun.status] || ['Status akun', ''];
  return tata({ judul, akun, csrf, isi: `<div class="kartu sempit"><h1>${e(judul)}</h1><p>${e(teks)}</p></div>` });
};

// ---------- panduan mulai ----------
function halamanMulai({ akun, csrf, langkah }) {
  const butir = langkah.map((l, i) => `<li>
    <span class="tanda ${l.selesai ? 'selesai' : ''}" aria-hidden="true">${l.selesai ? '&#10003;' : i + 1}</span>
    <div class="isi"><strong>${e(l.judul)}</strong>${l.selesai ? ' <span class="lencana aktif">Selesai</span>' : ''}
      <p>${e(l.keterangan)}</p>
      ${l.tautan && !l.selesai ? `<a class="tombol kecil" href="${e(l.tautan)}">${e(l.tombol || 'Kerjakan')}</a>` : ''}
      ${l.tautan && l.selesai ? `<a href="${e(l.tautan)}">Ubah</a>` : ''}
      ${l.segera ? '<p><em>Langkah ini sedang disiapkan.</em></p>' : ''}
    </div></li>`).join('');
  const sisa = langkah.filter(l => !l.selesai).length;
  return tata({ judul: 'Mulai', akun, csrf, isi: `
<h1>Selamat datang, ${e(akun.nama)}</h1>
<p class="pudar">${sisa ? `Selesaikan ${sisa} langkah berikut, berurutan dari atas. Setiap langkah dicek otomatis.` : 'Semua langkah selesai. Agen siap dipakai.'}</p>
<div class="kartu"><ol class="langkah">${butir}</ol></div>` });
}

// ---------- profil ----------
const KOLOM_PROFIL = [
  { bagian: 'Pengolah (nama Anda di Telaahan Staf dan Notula)' },
  { nama: 'pengolah_nama', label: 'Nama lengkap dan gelar', contoh: 'Budi Santoso, S.H.', bantuan: 'Tulis gelar dengan titik, persis seperti di dokumen resmi.' },
  { nama: 'pengolah_nip', label: 'NIP', contoh: '19800101 200501 1 001', bantuan: '18 angka. Spasi boleh ada atau tidak.', nip: true },
  { bagian: 'Atasan langsung (blok "Mengetahui" di Telaahan Staf)' },
  { nama: 'atasan_jabatan', label: 'Jabatan', contoh: 'Kepala Sub Direktorat Penanganan Sengketa Penetapan Hak dan Pendaftaran Tanah' },
  { nama: 'atasan_nama', label: 'Nama lengkap dan gelar', contoh: 'Siti Rahma, S.H., M.H.' },
  { nama: 'atasan_nip', label: 'NIP', contoh: '19750505 200003 2 002', nip: true },
  { bagian: 'Penanda tangan Surat Keluar' },
  { nama: 'ttd_atas_nama', label: 'Baris atas nama', contoh: 'a.n Direktur Jenderal', wajib: false, bantuan: 'Kosongkan bila surat tidak ditandatangani atas nama pejabat lain.' },
  { nama: 'ttd_jabatan', label: 'Jabatan', contoh: 'Direktur Penanganan Sengketa Pertanahan' },
  { nama: 'ttd_nama', label: 'Nama lengkap dan gelar', contoh: 'Ahmad Fauzi, A.Ptnh., M.H.' },
  { nama: 'ttd_nip', label: 'NIP', contoh: '19700101 199503 1 001', nip: true },
  { bagian: 'Lain-lain' },
  { nama: 'kota', label: 'Kota di tanggal dokumen', contoh: 'Jakarta' },
];

const halamanProfil = ({ akun, csrf, nilai = {}, salah = {}, pesan }) => tata({ judul: 'Profil', akun, csrf, pesan, isi: `
<h1>Profil penanda tangan</h1>
<p class="pudar">Data ini dipakai agen saat membuat dokumen. Isi persis seperti yang harus tercetak.</p>
${Object.keys(salah).length ? '<div class="pemberitahuan buruk" role="alert">Ada isian yang perlu diperbaiki. Lihat tulisan merah di bawah.</div>' : ''}
<form method="post" action="/profil" novalidate class="kartu">${csrfInput(csrf)}
  ${KOLOM_PROFIL.map(k => k.bagian ? `<h2>${e(k.bagian)}</h2>` : kolom({ ...k, nilai: nilai[k.nama], salah: salah[k.nama], wajib: k.wajib !== false })).join('')}
  <button class="tombol" type="submit">Simpan profil</button>
</form>` });

// ---------- super admin ----------
const fmtWaktu = ms => (ms ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms)) : '—');

function halamanAdminPengguna({ akun, csrf, daftar, pesan }) {
  const tombol = (p, status, teks, kelas = '') => `<form class="sebaris" method="post" action="/admin/pengguna/${p.id}/status">
      ${csrfInput(csrf)}<input type="hidden" name="status" value="${status}"><button class="tombol kecil ${kelas}" type="submit">${teks}</button></form>`;
  const baris = daftar.map(p => `<tr>
      <td><strong>${e(p.nama)}</strong><br><span class="pudar">${e(p.email)}</span></td>
      <td>${e(p.unit_kerja)}</td>
      <td><span class="lencana ${e(p.status)}">${e(p.status)}</span>${p.peran === 'admin' ? ' <span class="lencana">admin</span>' : ''}</td>
      <td>${fmtWaktu(p.dibuat)}</td>
      <td>${p.id === akun.pengguna_id || p.peran === 'admin' ? '' : [
        p.status !== 'aktif' ? tombol(p, 'aktif', p.status === 'menunggu' ? 'Setujui' : 'Aktifkan') : '',
        p.status === 'menunggu' ? tombol(p, 'ditolak', 'Tolak', 'kedua') : '',
        p.status === 'aktif' ? tombol(p, 'dibekukan', 'Bekukan', 'bahaya') : '',
      ].join('')}</td></tr>`).join('');
  return tata({ judul: 'Pengguna', akun, csrf, pesan, isi: `
<h1>Pengguna</h1>
<p><a href="/admin/audit">Log audit</a></p>
<div class="kartu gulir"><table><thead><tr><th>Nama</th><th>Unit kerja</th><th>Status</th><th>Mendaftar</th><th>Tindakan</th></tr></thead>
<tbody>${baris || '<tr><td colspan="5">Belum ada pengguna.</td></tr>'}</tbody></table></div>` });
}

const halamanAdmin2fa = ({ akun, csrf, rahasia, uri, salah = null }) => tata({ judul: 'Siapkan verifikasi dua langkah', akun, csrf, isi: `
<div class="kartu sempit">
  <h1>Siapkan verifikasi dua langkah</h1>
  <p>Akun super admin wajib memakai kode dari aplikasi authenticator, misalnya Google Authenticator atau Microsoft Authenticator.</p>
  <ol>
    <li>Pasang aplikasi authenticator di ponsel Anda.</li>
    <li>Di aplikasi, pilih <strong>Tambah akun</strong>, lalu <strong>Masukkan kunci penyiapan</strong>.</li>
    <li>Isi nama akun <strong>Agen Pertanahan</strong>, lalu ketik kunci ini:<br><span class="kode">${e(rahasia.replace(/(.{4})/g, '$1 ').trim())}</span></li>
    <li>Ketik 6 angka yang muncul di aplikasi ke kolom di bawah.</li>
  </ol>
  <p class="pudar">Bila aplikasi meminta tautan, pakai: <span class="kode">${e(uri)}</span></p>
  ${salah ? `<div class="pemberitahuan buruk" role="alert">${e(salah)}</div>` : ''}
  <form method="post" action="/admin/2fa">${csrfInput(csrf)}
    ${kolom({ nama: 'kode', label: 'Kode 6 angka', contoh: '123456', lengkapi: 'one-time-code' })}
    <button class="tombol" type="submit">Aktifkan</button>
  </form>
</div>` });

function halamanAudit({ akun, csrf, daftar }) {
  const baris = daftar.map(a => `<tr><td>${fmtWaktu(a.waktu)}</td><td>${e(a.pelaku_email || '—')}</td><td>${e(a.aksi)}</td>
      <td>${e(a.sasaran_email || '')}</td><td class="pudar">${e(a.ip || '')}</td></tr>`).join('');
  return tata({ judul: 'Log audit', akun, csrf, isi: `<h1>Log audit</h1><p><a href="/admin/pengguna">Kembali ke Pengguna</a></p>
<div class="kartu gulir"><table><thead><tr><th>Waktu</th><th>Pelaku</th><th>Aksi</th><th>Sasaran</th><th>IP</th></tr></thead>
<tbody>${baris || '<tr><td colspan="5">Belum ada catatan.</td></tr>'}</tbody></table></div>` });
}


// ---------- hubungkan Google ----------
const tombolUI = (id, en) => `<strong>${e(id)}</strong>${en ? ` <span class="pudar">(${e(en)})</span>` : ''}`;

function halamanGoogle({ akun, csrf, sambungan, kode, templateUrl, pesan }) {
  if (sambungan) {
    return tata({ judul: 'Google', akun, csrf, pesan, isi: `
<h1>Google tersambung</h1>
<div class="kartu">
  <p><span class="lencana aktif">Tersambung</span> sejak ${fmtWaktu(sambungan.tersambung)}</p>
  <p>Spreadsheet Master Data: <a href="https://docs.google.com/spreadsheets/d/${e(sambungan.spreadsheetId)}" target="_blank" rel="noopener">buka spreadsheet</a><br>
     Folder pengaduan: <a href="https://drive.google.com/drive/folders/${e(sambungan.folderIndukId)}" target="_blank" rel="noopener">buka folder</a></p>
  <form class="sebaris" method="post" action="/google/periksa">${csrfInput(csrf)}<button class="tombol kecil" type="submit">Periksa sambungan</button></form>
  <form class="sebaris" method="post" action="/google/putus">${csrfInput(csrf)}<button class="tombol kecil kedua" type="submit">Putuskan sambungan</button></form>
  <p class="pudar">Memutuskan sambungan juga menghapus kode rahasia di skrip Anda, sehingga bisa disambungkan lagi cukup dengan kode baru.</p>
</div>` });
  }
  if (!templateUrl) {
    return tata({ judul: 'Google', akun, csrf, isi: `<div class="kartu sempit"><h1>Hubungkan Google</h1>
      <div class="pemberitahuan info">Template belum disiapkan pengelola. Silakan coba lagi nanti.</div></div>` });
  }
  const jam = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date(kode.kedaluwarsa));
  return tata({ judul: 'Hubungkan Google', akun, csrf, pesan, skrip: '/aset/tunggu-google.js', isi: `
<h1>Hubungkan Google Drive dan Spreadsheet</h1>
<p class="pudar">Sekitar 5 menit. Agen akan memakai Drive, Spreadsheet, Gmail, dan Kalender di akun Google Anda sendiri, dan selalu meminta persetujuan Anda sebelum mengubah apa pun.</p>
<div class="catatan">Kerjakan di komputer, dengan akun Google yang ingin Anda pakai untuk pekerjaan ini. Biarkan halaman ini tetap terbuka; halaman akan berubah sendiri setelah tersambung.</div>
<ol class="bagian-langkah kartu">
  <li><h3>Salin template ke Drive Anda</h3>
    <p>Klik tombol di bawah. Bila diminta, pilih akun Google yang benar (lihat foto profil di pojok kanan atas), lalu klik ${tombolUI('Buat salinan', 'Make a copy')}.</p>
    <a class="tombol kecil" href="${e(templateUrl)}" target="_blank" rel="noopener">Salin template</a>
    <p class="pudar">Hasilnya: spreadsheet baru di Drive Anda, lengkap dengan skrip penghubungnya.</p></li>
  <li><h3>Buka skripnya</h3>
    <p>Di spreadsheet salinan, klik menu ${tombolUI('Ekstensi', 'Extensions')} &rarr; ${tombolUI('Apps Script')}. Jendela baru terbuka.</p></li>
  <li><h3>Terapkan sebagai aplikasi web</h3>
    <ol>
      <li>Klik tombol biru ${tombolUI('Terapkan', 'Deploy')} di kanan atas &rarr; ${tombolUI('Deployment baru', 'New deployment')}.</li>
      <li>Klik ikon roda gigi di samping ${tombolUI('Pilih jenis', 'Select type')} &rarr; ${tombolUI('Aplikasi web', 'Web app')}.</li>
      <li>Periksa dua isian ini:
        <ul><li>${tombolUI('Jalankan sebagai', 'Execute as')}: <strong>Saya</strong> (email Anda)</li>
            <li>${tombolUI('Yang memiliki akses', 'Who has access')}: <strong>Siapa saja</strong> (Anyone)</li></ul></li>
      <li>Klik ${tombolUI('Terapkan', 'Deploy')}.</li>
    </ol></li>
  <li><h3>Beri izin</h3>
    <ol>
      <li>Klik ${tombolUI('Otorisasi akses', 'Authorize access')}, lalu pilih akun Google Anda.</li>
      <li>Muncul peringatan <em>&ldquo;Google belum memverifikasi aplikasi ini&rdquo;</em>. Ini wajar, karena skripnya milik Anda sendiri. Klik ${tombolUI('Lanjutan', 'Advanced')} &rarr; ${tombolUI('Buka … (tidak aman)', 'Go to … (unsafe)')}.</li>
      <li>Klik ${tombolUI('Izinkan', 'Allow')}.</li>
    </ol></li>
  <li><h3>Ketik kode ini</h3>
    <p>Di jendela Apps Script, klik tautan di bawah tulisan ${tombolUI('Aplikasi web', 'Web app')} (berakhiran <span class="kode">/exec</span>). Halaman &ldquo;Sambungkan ke Agen Pertanahan&rdquo; terbuka. Ketik kode ini, lalu klik ${tombolUI('Sambungkan')}:</p>
    <div class="kode-besar" aria-label="Kode ${e(kode.kode.split('').join(' '))}">${e(kode.kode)}</div>
    <p class="pudar">Berlaku sampai pukul ${e(jam)} WIB. Muat ulang halaman ini bila sudah lewat.</p></li>
</ol>
<div class="kartu"><h2>Bila ada yang tidak berhasil</h2><ul>
  <li><strong>Tombol Terapkan tidak ada:</strong> pastikan Anda membuka Apps Script dari menu Ekstensi di spreadsheet <em>salinan</em>, bukan template.</li>
  <li><strong>Halaman Web App meminta masuk Google atau menolak akses:</strong> isian &ldquo;Yang memiliki akses&rdquo; belum &ldquo;Siapa saja&rdquo;. Ulangi langkah 3 dengan ${tombolUI('Terapkan', 'Deploy')} &rarr; ${tombolUI('Kelola deployment', 'Manage deployments')}, ubah isiannya, lalu simpan.</li>
  <li><strong>Pesan &ldquo;kode salah atau kedaluwarsa&rdquo;:</strong> muat ulang halaman ini dan ketik kode yang baru.</li>
  <li>Pesan lain dari halaman Web App sudah menyebut penyebab dan langkah perbaikannya.</li>
</ul></div>` });
}

const halamanGalat = ({ judul, teks, akun = null, csrf = '' }) => tata({ judul, akun, csrf, isi: `<div class="kartu sempit"><h1>${e(judul)}</h1><p>${e(teks)}</p><p><a href="/">Kembali ke beranda</a></p></div>` });

// Hash gaya untuk Content-Security-Policy (style-src) tanpa 'unsafe-inline'.
const HASH_GAYA = `'sha256-${require('crypto').createHash('sha256').update(GAYA).digest('base64')}'`;

module.exports = {
  e, tata, HASH_GAYA, kolom, KOLOM_PROFIL,
  halamanDaftar, halamanMasuk, halamanKode2fa, halamanStatus, halamanMulai, halamanProfil,
  halamanAdminPengguna, halamanAdmin2fa, halamanAudit, halamanGalat, halamanGoogle,
};
