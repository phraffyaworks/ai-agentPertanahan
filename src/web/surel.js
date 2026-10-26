// Email dari dashboard (tautan kata sandi baru), dikirim lewat Gmail akun Google super admin yang tersambung.
// Tidak butuh layanan email tambahan: skrip Apps Script milik super admin menjalankan GmailApp.sendEmail.
const fmtWaktu = ms => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'short' }).format(new Date(ms));
const SUBJEK_SANDI = 'Kata sandi baru Agen Pertanahan';

function buatSurel({ db, google }) {
  // Akun super admin yang Gmail-nya dipakai, atau null bila belum ada yang menyambungkan Google.
  const pengirim = () => db.pengguna.adminBerGoogle() || null;

  async function kirim({ ke, subjek, isi }) {
    const p = pengirim();
    if (!p) throw new Error('Google super admin belum tersambung.');
    await google.kirimEmail(p.id, { to: ke, subject: subjek, body: isi });
    return p;
  }

  const kirimTautanSandi = ({ pengguna, tautan, kedaluwarsa, alamat }) => kirim({
    ke: pengguna.email,
    subjek: SUBJEK_SANDI,
    isi: `Halo ${pengguna.nama},

Ada permintaan untuk membuat kata sandi baru akun Agen Pertanahan Anda (${pengguna.email}).
Buka tautan di bawah ini, lalu ketik kata sandi baru Anda:

${tautan}

Tautan berlaku sampai ${fmtWaktu(kedaluwarsa)} WIB dan hanya bisa dipakai sekali.

Bila Anda tidak meminta kata sandi baru, abaikan email ini. Kata sandi Anda tidak berubah.
Jangan teruskan email ini kepada siapa pun.

Agen Pertanahan
${alamat}
`,
  });

  const kirimUji = ({ pengguna, alamat }) => kirim({
    ke: pengguna.email,
    subjek: 'Uji email Agen Pertanahan',
    isi: `Halo ${pengguna.nama},

Ini email uji dari dashboard Agen Pertanahan (${alamat}).
Bila email ini sampai, tautan lupa kata sandi juga bisa terkirim ke pengguna.
`,
  });

  return { pengirim, kirim, kirimTautanSandi, kirimUji, SUBJEK_SANDI };
}

module.exports = { buatSurel, SUBJEK_SANDI };
