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
.chat{display:flex;flex-direction:column;gap:12px;padding:8px 0 16px}
.pesan{display:flex;flex-direction:column;max-width:85%}.pesan.saya{align-self:flex-end;align-items:flex-end}.pesan.agen{align-self:flex-start}
.gelembung{background:var(--kartu);border:1px solid var(--garis);border-radius:12px;padding:10px 14px;white-space:pre-wrap;overflow-wrap:anywhere}
.pesan.saya .gelembung{background:var(--info-bg);border-color:transparent}
.waktu{font-size:.75rem;color:var(--pudar);margin-top:2px}
.lampiran{font-size:.85rem;color:var(--pudar);margin-top:4px}
.kartu-setuju{border:2px solid var(--utama);border-radius:12px;padding:14px;background:var(--kartu);max-width:85%}
.kartu-setuju .ringkasan{white-space:pre-wrap;margin:8px 0;overflow-wrap:anywhere}
.info-chat{align-self:center;font-size:.85rem;color:var(--pudar)}
.kirim{position:sticky;bottom:0;background:var(--bg);padding:12px 0;border-top:1px solid var(--garis)}
.kirim textarea{min-height:56px;resize:vertical}.kirim .baris{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:8px}
.kirim .tombol{margin-top:0}.status-agen{min-height:1.4em;color:var(--pudar);font-size:.9rem}
.gelembung pre,.gelembung code{white-space:pre-wrap}
.judul-chat{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.judul-chat h1{margin:0 auto 0 0}
.label-tipis{font-weight:400;color:var(--pudar);margin:0 0 4px}.pilih-berkas{width:auto;flex:1 1 220px}
.kode-besar{font:700 2.2rem/1.2 ui-monospace,Consolas,monospace;letter-spacing:.3em;background:var(--info-bg);border-radius:10px;padding:12px 18px;display:inline-block;margin:8px 0}
.bagian-langkah{counter-reset:l;list-style:none;padding:0}.bagian-langkah>li{counter-increment:l;position:relative;padding:0 0 20px 48px}
.bagian-langkah>li::before{content:counter(l);position:absolute;left:0;top:0;width:32px;height:32px;border-radius:50%;background:var(--utama);color:var(--utama-teks);display:grid;place-items:center;font-weight:700}
.bagian-langkah h3{margin:4px 0 6px;font-size:1.05rem}.bagian-langkah ol,.bagian-langkah ul{padding-left:20px;margin:6px 0}
.catatan{border-left:4px solid var(--utama);background:var(--info-bg);padding:10px 14px;border-radius:6px;margin:10px 0}
`;

function tata({ judul, isi, akun = null, csrf = '', pesan = null, skrip = null }) {
  const menu = akun ? `<nav>
      ${akun.status === 'aktif' && !akun.perlu2fa ? '<a href="/chat">Chat</a> <a href="/mulai">Mulai</a> <a href="/profil">Profil</a> <a href="/pemakaian">Pemakaian</a>' : ''}
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
    ${kolom({ nama: 'unit_kerja', label: 'Unit kerja', contoh: 'Subdit Penanganan Sengketa Penetapan Hak dan Pendaftaran Tanah', nilai: nilai.unit_kerja, salah: salah.unit_kerja, lengkapi: 'organization' })}
    ${kolom({ nama: 'nomor_wa', label: 'Nomor WhatsApp', contoh: '0812-3456-7890', jenis: 'tel', nilai: nilai.nomor_wa, salah: salah.nomor_wa, lengkapi: 'tel', bantuan: 'Dipakai super admin untuk mengirim tautan bila Anda lupa kata sandi.' })}
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
  <p><a href="/lupa-sandi">Lupa kata sandi?</a></p>
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

const halamanProfil = ({ akun, csrf, nilai = {}, salah = {}, pesan, nomorWa = '', salahWa = null }) => tata({ judul: 'Profil', akun, csrf, pesan, isi: `
<h1>Profil</h1>
<form method="post" action="/profil/kontak" novalidate class="kartu">${csrfInput(csrf)}
  <h2>Kontak</h2>
  ${kolom({ nama: 'nomor_wa', label: 'Nomor WhatsApp', contoh: '0812-3456-7890', jenis: 'tel', nilai: nomorWa, salah: salahWa, lengkapi: 'tel', bantuan: 'Super admin mengirim tautan kata sandi baru ke nomor ini bila Anda lupa kata sandi.' })}
  <button class="tombol kecil" type="submit">Simpan nomor</button>
</form>
<h2>Profil penanda tangan</h2>
<p class="pudar">Data ini dipakai agen saat membuat dokumen. Isi persis seperti yang harus tercetak.</p>
${Object.keys(salah).length ? '<div class="pemberitahuan buruk" role="alert">Ada isian yang perlu diperbaiki. Lihat tulisan merah di bawah.</div>' : ''}
<form method="post" action="/profil" novalidate class="kartu">${csrfInput(csrf)}
  ${KOLOM_PROFIL.map(k => k.bagian ? `<h2>${e(k.bagian)}</h2>` : kolom({ ...k, nilai: nilai[k.nama], salah: salah[k.nama], wajib: k.wajib !== false })).join('')}
  <button class="tombol" type="submit">Simpan profil</button>
</form>` });

// ---------- super admin ----------
const fmtWaktu = ms => (ms ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms)) : '—');

function halamanAdminPengguna({ akun, csrf, daftar, pesan }) {
  const { tampilWa } = require('./profil');
  const minta = daftar.filter(p => p.minta_reset).length;
  const tombol = (p, status, teks, kelas = '') => `<form class="sebaris" method="post" action="/admin/pengguna/${p.id}/status">
      ${csrfInput(csrf)}<input type="hidden" name="status" value="${status}"><button class="tombol kecil ${kelas}" type="submit">${teks}</button></form>`;
  const baris = daftar.map(p => `<tr>
      <td><strong>${e(p.nama)}</strong><br><span class="pudar">${e(p.email)}</span>${p.nomor_wa ? `<br><span class="pudar">WA ${e(tampilWa(p.nomor_wa))}</span>` : ''}
        ${p.minta_reset ? `<br><span class="lencana menunggu">Minta sandi baru · ${fmtWaktu(p.minta_reset)}</span>` : ''}</td>
      <td>${e(p.unit_kerja)}</td>
      <td><span class="lencana ${e(p.status)}">${e(p.status)}</span>${p.peran === 'admin' ? ' <span class="lencana">admin</span>' : ''}</td>
      <td>${fmtWaktu(p.dibuat)}</td>
      <td>${p.id === akun.pengguna_id || p.peran === 'admin' ? '' : [
        p.status !== 'aktif' ? tombol(p, 'aktif', p.status === 'menunggu' ? 'Setujui' : 'Aktifkan') : '',
        p.status === 'menunggu' ? tombol(p, 'ditolak', 'Tolak', 'kedua') : '',
        p.status === 'aktif' ? `<form class="sebaris" method="post" action="/admin/pengguna/${p.id}/reset-sandi">${csrfInput(csrf)}<button class="tombol kecil ${p.minta_reset ? '' : 'kedua'}" type="submit">Buat tautan sandi baru</button></form>` : '',
        // Tombol berbahaya selalu di paling akhir supaya tidak tertekan tanpa sengaja.
        p.status === 'aktif' ? tombol(p, 'dibekukan', 'Bekukan', 'bahaya') : '',
      ].join('')}</td></tr>`).join('');
  return tata({ judul: 'Pengguna', akun, csrf, pesan, isi: `
<h1>Pengguna</h1>
${minta ? `<div class="pemberitahuan info" role="status"><strong>${minta} pengguna meminta kata sandi baru.</strong> Klik <strong>Buat tautan sandi baru</strong> di barisnya, lalu kirim lewat WhatsApp.</div>` : ''}
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

// ---------- chat ----------
const { keHtml } = require('../telegram/format');
const jamMenit = ms => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

function renderPersetujuan(x, { menunggu = false, keputusan = null } = {}) {
  const status = menunggu
    ? `<div><button class="tombol kecil" type="button" data-setuju="1" data-id="${x.id}">Setujui</button>
       <button class="tombol kecil kedua" type="button" data-setuju="0" data-id="${x.id}">Tolak</button></div>
       <p class="pudar">Atau ketik perubahan yang Anda inginkan di kotak pesan; pesan Anda dihitung sebagai Tolak beserta catatannya.</p>`
    : keputusan ? `<span class="lencana ${keputusan.setuju ? 'aktif' : 'ditolak'}">${keputusan.setuju ? 'Disetujui' : 'Ditolak'}</span>${keputusan.catatan ? ` <span class="pudar">${e(keputusan.catatan)}</span>` : ''}`
      : '<span class="lencana">Kedaluwarsa</span> <span class="pudar">Agen dimulai ulang sebelum dijawab; tidak ada yang dikerjakan.</span>';
  return `<div class="kartu-setuju" id="s${x.id}"><strong>Persetujuan diperlukan</strong><div class="ringkasan">${e(x.ringkasan)}</div>${status}</div>`;
}

function renderEntri(x, opsi = {}) {
  switch (x.jenis) {
    case 'pengguna': return `<div class="pesan saya" id="e${x.id}"><div class="gelembung">${e(x.teks)}${(x.berkas || []).length
      ? `<div class="lampiran">Lampiran: ${x.berkas.map(b => e(`${b.id} ${b.nama}`)).join(', ')}</div>` : ''}</div><div class="waktu">${jamMenit(x.waktu)}</div></div>`;
    case 'agen': return `<div class="pesan agen" id="e${x.id}"><div class="gelembung">${keHtml(String(x.teks || ''))}</div><div class="waktu">${jamMenit(x.waktu)}</div></div>`;
    case 'dokumen': return `<div class="pesan agen" id="e${x.id}"><div class="gelembung">Dokumen siap: <a href="/unduh/${e(x.berkasId)}">${e(x.nama)}</a><div class="lampiran">Juga tersimpan di folder kasus di Google Drive Anda.</div></div></div>`;
    case 'persetujuan': return renderPersetujuan(x, opsi);
    case 'galat': return `<div class="pemberitahuan buruk" id="e${x.id}">${e(x.teks)}</div>`;
    case 'info': return `<div class="info-chat" id="e${x.id}">${e(x.teks)}</div>`;
    default: return '';
  }
}

function halamanChat({ akun, csrf, entri, menunggu, sibuk }) {
  const keputusan = new Map(entri.filter(x => x.jenis === 'keputusan').map(x => [x.untuk, x]));
  const isi = entri.map(x => renderEntri(x, { menunggu: menunggu.has(x.id), keputusan: keputusan.get(x.id) })).join('');
  const terakhir = entri.length ? entri[entri.length - 1].id : 0;
  return tata({ judul: 'Chat', akun, csrf, skrip: '/aset/chat.js', isi: `
<div class="judul-chat"><h1>Chat dengan agen</h1>
  <form class="sebaris" method="post" action="/chat/baru">${csrfInput(csrf)}<button class="tombol kecil kedua" type="submit">Percakapan baru</button></form></div>
<p class="pudar">Kirim PDF pengaduan, minta draf Telaahan, cek email, atau atur jadwal. Setiap perubahan data menunggu tombol Setujui dari Anda.</p>
<div class="chat" id="percakapan" data-terakhir="${terakhir}">${isi || '<div class="info-chat" id="kosong">Belum ada percakapan. Mulailah dengan menyapa agen atau mengirim PDF pengaduan.</div>'}</div>
<form class="kirim" id="form-kirim" data-csrf="${e(csrf)}">
  <div class="status-agen" id="status-agen" role="status">${sibuk ? 'Agen sedang bekerja…' : ''}</div>
  <label for="teks" class="label-tipis">Pesan (Enter untuk kirim, Shift+Enter untuk baris baru)</label>
  <textarea id="teks" name="teks" placeholder="Tulis pesan…"></textarea>
  <div class="baris"><input type="file" id="berkas" name="berkas" multiple accept=".pdf,.docx,.doc,.xlsx,image/*" class="pilih-berkas">
    <button class="tombol" type="submit" id="tombol-kirim">Kirim</button></div>
</form>` });
}

// ---------- pemakaian ----------
const angka = n => Number(n || 0).toLocaleString('id-ID');
const dolar = n => `US$${Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;

function halamanPemakaian({ akun, csrf, baris }) {
  const total = baris.reduce((t, r) => ({ panggilan: t.panggilan + r.panggilan, masuk: t.masuk + r.token_masuk + r.token_cache_baca + r.token_cache_tulis,
    keluar: t.keluar + r.token_keluar, biaya: t.biaya + r.biaya_usd }), { panggilan: 0, masuk: 0, keluar: 0, biaya: 0 });
  const isi = baris.map(r => `<tr><td>${e(r.hari)}</td><td>${e(r.model)}</td><td>${angka(r.panggilan)}</td>
    <td>${angka(r.token_masuk)}</td><td>${angka(r.token_cache_baca)}</td><td>${angka(r.token_cache_tulis)}</td><td>${angka(r.token_keluar)}</td><td>${dolar(r.biaya_usd)}</td></tr>`).join('');
  return tata({ judul: 'Pemakaian', akun, csrf, isi: `
<h1>Pemakaian 30 hari terakhir</h1>
<p class="pudar">Setiap panggilan model dicatat: token masuk (biasa, dibaca dari cache, ditulis ke cache), token keluar, dan perkiraan biaya menurut harga resmi penyedia.</p>
<div class="kartu"><strong>${angka(total.panggilan)}</strong> panggilan · <strong>${angka(total.masuk)}</strong> token masuk · <strong>${angka(total.keluar)}</strong> token keluar · perkiraan biaya <strong>${dolar(total.biaya)}</strong></div>
<div class="kartu gulir"><table><thead><tr><th>Tanggal</th><th>Model</th><th>Panggilan</th><th>Token masuk</th><th>Dari cache</th><th>Tulis cache</th><th>Token keluar</th><th>Biaya</th></tr></thead>
<tbody>${isi || '<tr><td colspan="8">Belum ada pemakaian.</td></tr>'}</tbody></table></div>` });
}

// ---------- atur ulang kata sandi ----------
const fmtTanggalJam = ms => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'short' }).format(new Date(ms));

function halamanTautanReset({ akun, csrf, pengguna, tautan, kedaluwarsa }) {
  const { tampilWa } = require('./profil');
  const teksWa = `Halo ${pengguna.nama}, ini tautan untuk membuat kata sandi baru Agen Pertanahan. Berlaku 24 jam dan hanya bisa dipakai sekali:\n${tautan}`;
  const wa = pengguna.nomor_wa ? `https://wa.me/${pengguna.nomor_wa}?text=${encodeURIComponent(teksWa)}` : null;
  return tata({ judul: 'Tautan kata sandi baru', akun, csrf, isi: `
<div class="kartu sempit">
  <h1>Tautan kata sandi baru</h1>
  <p>Untuk <strong>${e(pengguna.nama)}</strong> (${e(pengguna.email)}).</p>
  ${wa ? `<a class="tombol" href="${e(wa)}" target="_blank" rel="noopener">Kirim lewat WhatsApp ke ${e(tampilWa(pengguna.nomor_wa))}</a>
  <p class="pudar">WhatsApp terbuka dengan pesan berisi tautan; tinggal tekan kirim. Nomor ini nomor yang terdaftar di akun pengguna.</p>`
    : '<div class="pemberitahuan info">Pengguna belum mencatat nomor WhatsApp. Salin tautan di bawah dan kirim lewat email kedinasan atau saluran lain yang Anda yakini milik pengguna itu.</div>'}
  <p>Tautan:</p>
  <p class="kode">${e(tautan)}</p>
  <ul>
    <li>Berlaku sampai ${e(fmtTanggalJam(kedaluwarsa))} WIB, dan hanya bisa dipakai sekali.</li>
    <li>Pengguna membuat kata sandi barunya sendiri; Anda tidak pernah mengetahuinya.</li>
    <li>Setelah kata sandi diganti, semua sesi lama pengguna itu otomatis keluar.</li>
    <li>Pastikan tautan dikirim ke orang yang benar. Siapa pun yang memegang tautan ini bisa mengganti kata sandi akun tersebut.</li>
  </ul>
  <p><a href="/admin/pengguna">Kembali ke Pengguna</a></p>
</div>` });
}

const halamanLupaSandi = ({ csrf, terkirim = false, kontak = '', nilai = {} }) => tata({ judul: 'Lupa kata sandi', csrf, isi: `
<div class="kartu sempit">
  <h1>Lupa kata sandi</h1>
  ${terkirim ? `<div class="pemberitahuan baik" role="status">Permintaan sudah diterima. Bila email itu terdaftar, super admin akan mengirim tautan untuk membuat kata sandi baru ke nomor WhatsApp yang tercatat di akun Anda.</div>
  <p>Tautan itu berlaku 24 jam. Setelah menerimanya, buka tautan dan buat kata sandi baru Anda sendiri.</p>`
    : `<p>Ketik email akun Anda. Super admin akan mengirim tautan untuk membuat kata sandi baru ke nomor WhatsApp yang tercatat di akun Anda.</p>
  <form method="post" action="/lupa-sandi" novalidate>${csrfInput(csrf)}
    ${kolom({ nama: 'email', label: 'Email', jenis: 'email', nilai: nilai.email, lengkapi: 'email' })}
    <button class="tombol" type="submit">Kirim permintaan</button>
  </form>`}
  ${kontak ? `<p class="pudar">Bila mendesak, hubungi super admin: ${e(kontak)}</p>` : ''}
  <p><a href="/masuk">Kembali ke halaman Masuk</a></p>
</div>` });

const halamanAturSandi = ({ csrf, nama, salah = {}, galat = null }) => tata({ judul: 'Buat kata sandi baru', csrf, isi: `
<div class="kartu sempit">
  <h1>Buat kata sandi baru</h1>
  ${galat ? `<div class="pemberitahuan buruk" role="alert">${e(galat)}</div>` : `<p>Untuk akun <strong>${e(nama)}</strong>.</p>
  <form method="post" novalidate>${csrfInput(csrf)}
    ${kolom({ nama: 'sandi', label: 'Kata sandi baru', jenis: 'password', salah: salah.sandi, lengkapi: 'new-password', bantuan: 'Minimal 10 karakter. Boleh berupa kalimat yang mudah Anda ingat.' })}
    ${kolom({ nama: 'sandi2', label: 'Ulangi kata sandi baru', jenis: 'password', salah: salah.sandi2, lengkapi: 'new-password' })}
    <button class="tombol" type="submit">Simpan kata sandi</button>
  </form>`}
</div>` });

const halamanGalat = ({ judul, teks, akun = null, csrf = '' }) => tata({ judul, akun, csrf, isi: `<div class="kartu sempit"><h1>${e(judul)}</h1><p>${e(teks)}</p><p><a href="/">Kembali ke beranda</a></p></div>` });

// Hash gaya untuk Content-Security-Policy (style-src) tanpa 'unsafe-inline'.
const HASH_GAYA = `'sha256-${require('crypto').createHash('sha256').update(GAYA).digest('base64')}'`;

module.exports = {
  e, tata, HASH_GAYA, kolom, KOLOM_PROFIL,
  halamanDaftar, halamanMasuk, halamanKode2fa, halamanStatus, halamanMulai, halamanProfil,
  halamanAdminPengguna, halamanAdmin2fa, halamanAudit, halamanGalat, halamanGoogle, halamanChat, renderEntri, renderPersetujuan, halamanPemakaian, halamanTautanReset, halamanAturSandi, halamanLupaSandi,
};
