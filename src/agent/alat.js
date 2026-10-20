// Alat (tools) yang bisa dipakai asisten. Alat bertanda `ubah: true` mengubah data atau mengirim
// sesuatu keluar, sehingga selalu menunggu persetujuan pengguna lewat tombol di Telegram.
const { z } = require('zod');
const { HEADER } = require('../google/sheets');
const { FIELDS, catatPengaduan, rencanaNama } = require('../pipeline/intake');
const { uniqueName, PERLU_CEK } = require('../util/naming');
const { buildTelaahan } = require('../docs/telaahan');
const { buildNotula } = require('../docs/notula');

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const WIB = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'short' });
const waktu = iso => `${WIB.format(new Date(iso))} WIB`;
const potong = (s, n) => (String(s).length > n ? `${String(s).slice(0, n)}…` : String(s));
const json = v => JSON.stringify(v, null, 1);
const isoDate = z.string().refine(s => !Number.isNaN(Date.parse(s)), 'harus tanggal-waktu ISO 8601, mis. 2026-10-21T09:00:00+07:00');

const str = description => ({ type: 'string', description });
const KOLOM_UBAH = HEADER.filter(h => h !== 'No' && h !== 'File Pengaduan');

// ---------- skema data dokumen ----------
const Hak = z.object({
  judul: z.string(), nomor_desa_tanggal: z.string(), surat_ukur: z.string(), luas: z.string(), atas_nama: z.string(),
});
const Telaahan = z.object({
  judul: z.string(), dasar: z.string(), pengadu: z.string(), teradu: z.string(),
  objek: z.object({ status: z.string(), luas: z.string(), letak: z.string(), hak: z.array(Hak).min(1) }),
  pokok: z.string(), dokumen: z.array(z.string()),
  uraian: z.array(z.union([z.string(), z.object({ teks: z.string(), huruf: z.array(z.string()).optional(), bullet: z.array(z.string()).optional() })])),
  penting: z.array(z.string()),
  kesimpulan: z.object({ kasus: z.boolean(), tindak_lanjut: z.string().optional() }),
});
const Pihak = z.object({ nama: z.string(), alamat: z.string(), status: z.string() });
const Notula = z.object({
  nomor: z.string(), judul: z.string(), dasar: z.array(z.string()), tempat: z.string(), waktu: z.string(),
  pimpinan: z.object({ nama: z.string(), nip: z.string(), jabatan: z.string() }), pemapar: z.string(),
  objek: z.string(), pengadu: Pihak, teradu: Pihak, pokok_masalah: z.string(), akar_masalah: z.string(),
  tipologi: z.string(), klasifikasi: z.string(), kesimpulan: z.string(),
});

const HAK_SCHEMA = { type: 'object', properties: Object.fromEntries(['judul', 'nomor_desa_tanggal', 'surat_ukur', 'luas', 'atas_nama'].map(k => [k, { type: 'string' }])), required: ['judul', 'nomor_desa_tanggal', 'surat_ukur', 'luas', 'atas_nama'] };
const TELAAHAN_SCHEMA = {
  type: 'object',
  description: 'Isi Telaahan Staf sesuai kaidah. Teks *miring* untuk istilah asing.',
  properties: {
    judul: str('Judul di bawah "TELAAHAN STAF".'), dasar: str('Bab I, satu kalimat.'),
    pengadu: str('Bab II: nama Pengadu.'), teradu: str('Bab II: nama Teradu.'),
    objek: { type: 'object', properties: { status: str('III.1.a'), luas: str('III.1.b'), letak: str('III.1.c'), hak: { type: 'array', items: HAK_SCHEMA, description: 'III.2: satu entri per hak.' } }, required: ['status', 'luas', 'letak', 'hak'] },
    pokok: str('Bab IV.'), dokumen: { type: 'array', items: { type: 'string' }, description: 'Bab V.' },
    uraian: { type: 'array', description: 'Bab VI. Butir: teks biasa, atau {teks, huruf:[...]} untuk sub-butir a/b/c, atau {teks, bullet:[...]}.', items: { anyOf: [{ type: 'string' }, { type: 'object', properties: { teks: { type: 'string' }, huruf: { type: 'array', items: { type: 'string' } }, bullet: { type: 'array', items: { type: 'string' } } }, required: ['teks'] }] } },
    penting: { type: 'array', items: { type: 'string' }, description: 'Bab VII.' },
    kesimpulan: { type: 'object', properties: { kasus: { type: 'boolean' }, tindak_lanjut: str('Wajib bila Bukan Kasus. Bila Kasus, kosongkan (otomatis "melakukan gelar kasus awal.").') }, required: ['kasus'] },
  },
  required: ['judul', 'dasar', 'pengadu', 'teradu', 'objek', 'pokok', 'dokumen', 'uraian', 'penting', 'kesimpulan'],
};
const PIHAK_SCHEMA = { type: 'object', properties: { nama: { type: 'string' }, alamat: { type: 'string' }, status: { type: 'string' } }, required: ['nama', 'alamat', 'status'] };
const NOTULA_SCHEMA = {
  type: 'object',
  description: 'Isi Notula Gelar Kasus Awal. Isian yang belum diketahui diisi string kosong (otomatis jadi [PERLU CEK]).',
  properties: {
    nomor: str('Nomor notula.'), judul: str('Judul kasus satu paragraf.'), dasar: { type: 'array', items: { type: 'string' } },
    tempat: { type: 'string' }, waktu: str('Hari/tanggal/jam.'),
    pimpinan: { type: 'object', properties: { nama: { type: 'string' }, nip: str('Mis. "NIP. 19800920 199903 1 001".'), jabatan: { type: 'string' } }, required: ['nama', 'nip', 'jabatan'] },
    pemapar: { type: 'string' }, objek: { type: 'string' }, pengadu: PIHAK_SCHEMA, teradu: PIHAK_SCHEMA,
    pokok_masalah: { type: 'string' }, akar_masalah: { type: 'string' }, tipologi: { type: 'string' },
    klasifikasi: str('Berat/Sedang/Ringan.'), kesimpulan: str('Hasil gelar.'),
  },
  required: ['nomor', 'judul', 'dasar', 'tempat', 'waktu', 'pimpinan', 'pemapar', 'objek', 'pengadu', 'teradu', 'pokok_masalah', 'akar_masalah', 'tipologi', 'klasifikasi', 'kesimpulan'],
};

const EMAIL_PROPS = {
  kepada: str('Alamat email penerima; pisahkan dengan koma bila lebih dari satu.'),
  cc: str('Opsional.'), subjek: { type: 'string' }, isi: str('Isi email, teks biasa.'),
  lampiran_drive_ids: { type: 'array', items: { type: 'string' }, description: 'Opsional: ID file Google Drive yang dilampirkan.' },
};
const Email = z.object({ kepada: z.string().min(3), cc: z.string().optional(), subjek: z.string(), isi: z.string(), lampiran_drive_ids: z.array(z.string()).optional() });
const keEmail = e => ({ to: e.kepada, cc: e.cc || undefined, subject: e.subjek, body: e.isi, attachmentIds: e.lampiran_drive_ids });
const ringkasEmail = (judul, e) => [judul, `Kepada: ${e.kepada}`, e.cc ? `Cc: ${e.cc}` : null, `Subjek: ${e.subjek}`,
  e.lampiran_drive_ids?.length ? `Lampiran: ${e.lampiran_drive_ids.length} file Drive` : null, '', potong(e.isi, 1500)].filter(v => v !== null).join('\n');

async function namaFolder(ctx, folderId) {
  const f = await ctx.google.drive.getFolder(folderId);
  if (f.trashed) throw new Error(`Folder "${f.name}" ada di Sampah.`);
  return f;
}

async function simpanDocx(ctx, folderId, awalan, buffer, caption) {
  const folder = await namaFolder(ctx, folderId);
  const nama = uniqueName(`${awalan}_${folder.name}.docx`, await ctx.google.drive.listNames(folder.id));
  const file = await ctx.google.drive.uploadFile(folder.id, nama, buffer, DOCX_MIME);
  await ctx.kirimDokumen(buffer, nama, caption);
  return { nama, folder: folder.name, link: file.webViewLink };
}

const ALAT = [
  // ---------------- Pertanahan: Master Data & Drive ----------------
  {
    name: 'lihat_master_data',
    description: 'Membaca baris tab Master Data di Database Raffy. Bisa disaring dengan kata kunci (dicari di semua kolom) dan/atau Status.',
    input_schema: { type: 'object', properties: { cari: str('Opsional: kata kunci.'), status: str('Opsional: mis. "Menunggu".'), maks: { type: 'integer', description: 'Opsional, bawaan 20.' } } },
    zod: z.object({ cari: z.string().optional(), status: z.string().optional(), maks: z.number().int().positive().optional() }),
    async run(ctx, i) {
      const rows = (await ctx.google.sheets.readRows()).map((r, idx) => ({ baris: idx + 2, ...Object.fromEntries(HEADER.map((h, j) => [h, r[j] ?? ''])) }))
        .filter(r => r.No !== '' || r['Nomor Surat'] !== '');
      const cari = (i.cari || '').toLowerCase();
      const hasil = rows.filter(r => (!cari || Object.values(r).join(' ').toLowerCase().includes(cari))
        && (!i.status || String(r.Status).toLowerCase() === i.status.toLowerCase()));
      return json({ total_cocok: hasil.length, baris: hasil.slice(-(i.maks || 20)) });
    },
  },
  {
    name: 'lihat_folder',
    description: 'Daftar isi folder Google Drive (subfolder dan file, beserta ID dan tautannya). Tanpa folder_id: isi folder induk Otomasi, yaitu folder-folder pengadu.',
    input_schema: { type: 'object', properties: { folder_id: str('Opsional.') } },
    zod: z.object({ folder_id: z.string().optional() }),
    run: async (ctx, i) => json(await ctx.google.drive.listChildren(i.folder_id || ctx.folderIndukId)),
  },
  {
    name: 'lihat_berkas',
    description: 'Daftar berkas yang pernah dikirim pengguna di Telegram (ID B1, B2, ...).',
    input_schema: { type: 'object', properties: {} },
    zod: z.object({}),
    run: async ctx => json(ctx.berkas.daftar().slice(-30)),
  },
  {
    name: 'catat_pengaduan',
    ubah: true,
    description: 'Mencatat pengaduan baru dari berkas PDF: membuat folder "Nama Pengadu - Kota/Kabupaten" di Otomasi, menyimpan PDF dengan nama yang sama, dan menambah satu baris Master Data (Status "Menunggu", Rencana TL kosong). Semua isian dibaca dari berkas; yang tidak ada ditulis "-", yang tidak terbaca/meragukan "[PERLU CEK]" dan dicantumkan di perlu_cek.',
    input_schema: {
      type: 'object',
      properties: {
        berkas_id: str('ID berkas PDF pengaduan, mis. "B1".'),
        ...Object.fromEntries(Object.entries(FIELDS).map(([k, d]) => [k, str(d)])),
        perlu_cek: { type: 'array', items: { type: 'object', properties: { kolom: { type: 'string' }, alasan: { type: 'string' } }, required: ['kolom', 'alasan'] } },
      },
      required: ['berkas_id', ...Object.keys(FIELDS), 'perlu_cek'],
    },
    zod: z.object({ berkas_id: z.string(), ...Object.fromEntries(Object.keys(FIELDS).map(k => [k, z.string()])), perlu_cek: z.array(z.object({ kolom: z.string(), alasan: z.string() })) }),
    ringkasan: async (ctx, i) => {
      const b = ctx.berkas.ambil(i.berkas_id);
      const n = rencanaNama(i, b.nama);
      return ['Mencatat pengaduan baru:', `• Folder baru di Otomasi: ${n.folder}`, `• PDF ${b.id} (${b.nama}) disimpan sebagai: ${n.pdf}`,
        '• Master Data: 1 baris baru, Status "Menunggu"', `• Nomor/Tanggal Surat: ${i.nomor_surat} / ${i.tanggal_surat}`,
        `• Pengadu: ${i.pengadu_prinsipal}`, `• Teradu: ${i.teradu}`, `• Perihal: ${potong(i.perihal, 200)}`,
        i.perlu_cek.length ? `• ${PERLU_CEK}: ${i.perlu_cek.map(p => p.kolom).join(', ')}` : null].filter(Boolean).join('\n');
    },
    async run(ctx, i) {
      const b = ctx.berkas.ambil(i.berkas_id);
      if (b.mime !== 'application/pdf') throw new Error(`Berkas ${b.id} bukan PDF.`);
      const { berkas_id: _, ...data } = i;
      const r = await catatPengaduan({ pdfBuffer: ctx.berkas.isi(b.id), namaFileAsli: b.nama, data }, ctx);
      if (r.status === 'duplikat') return `Tidak dicatat: Nomor Surat ${data.nomor_surat} sudah ada di Master Data baris ${r.dupRow}. Tidak ada yang dibuat.`;
      return json({
        hasil: 'tercatat', folder: r.kasus.folder.name, folder_id: r.kasus.folder.id, folder_link: r.kasus.folder.url,
        folder_sudah_ada_sebelumnya: !r.kasus.folder.baru, pdf: r.kasus.pdf.name, baris_master_data: r.kasus.master.rowNumber,
        no: r.kasus.master.no, perlu_cek: r.data.perlu_cek, peringatan_spreadsheet: r.masalahSheet,
      });
    },
  },
  {
    name: 'ubah_master_data',
    ubah: true,
    description: `Mengubah satu kolom pada satu baris Master Data. Kolom yang bisa diubah: ${KOLOM_UBAH.join(', ')}.`,
    input_schema: { type: 'object', properties: { baris: { type: 'integer', description: 'Nomor baris spreadsheet (2 atau lebih).' }, kolom: { type: 'string', enum: KOLOM_UBAH }, nilai: { type: 'string' } }, required: ['baris', 'kolom', 'nilai'] },
    zod: z.object({ baris: z.number().int().min(2), kolom: z.enum(KOLOM_UBAH), nilai: z.string() }),
    ringkasan: async (ctx, i) => {
      const r = (await ctx.google.sheets.readRows())[i.baris - 2] || [];
      const lama = r[HEADER.indexOf(i.kolom)] ?? '';
      return `Mengubah Master Data baris ${i.baris} (${r[HEADER.indexOf('Pengadu (Prinsipal)')] || 'baris kosong'}), kolom "${i.kolom}":\n• Sebelumnya: ${potong(lama || '(kosong)', 500)}\n• Menjadi: ${potong(i.nilai, 500)}`;
    },
    run: async (ctx, i) => json(await ctx.google.sheets.updateCell(i.baris, i.kolom, i.nilai)),
  },
  {
    name: 'simpan_berkas_ke_drive',
    ubah: true,
    description: 'Menyimpan berkas dari Telegram ke folder Drive dengan nama tertentu, mis. Telaahan bertanda tangan ("Telaahan Staff_<nama folder>_ttd.pdf") atau Surat REFF.',
    input_schema: { type: 'object', properties: { berkas_id: { type: 'string' }, folder_id: { type: 'string' }, nama_file: str('Nama file lengkap dengan ekstensi.') }, required: ['berkas_id', 'folder_id', 'nama_file'] },
    zod: z.object({ berkas_id: z.string(), folder_id: z.string(), nama_file: z.string().min(1) }),
    ringkasan: async (ctx, i) => {
      const b = ctx.berkas.ambil(i.berkas_id);
      const f = await namaFolder(ctx, i.folder_id);
      return `Menyimpan berkas ${b.id} (${b.nama}) ke folder "${f.name}" sebagai:\n${i.nama_file}`;
    },
    async run(ctx, i) {
      const b = ctx.berkas.ambil(i.berkas_id);
      const f = await namaFolder(ctx, i.folder_id);
      const nama = uniqueName(i.nama_file, await ctx.google.drive.listNames(f.id));
      const file = await ctx.google.drive.uploadFile(f.id, nama, ctx.berkas.isi(b.id), b.mime || 'application/octet-stream');
      return json({ tersimpan: nama, folder: f.name, link: file.webViewLink });
    },
  },
  {
    name: 'buat_telaahan',
    ubah: true,
    description: 'Membuat file Word Telaahan Staf dari isi yang sudah DISETUJUI pengguna di chat, menyimpannya di folder pengadu sebagai "Telaahan Staff_<nama folder>.docx", dan mengirimnya ke chat.',
    input_schema: { type: 'object', properties: { folder_id: str('ID folder pengadu.'), data: TELAAHAN_SCHEMA }, required: ['folder_id', 'data'] },
    zod: z.object({ folder_id: z.string(), data: Telaahan }),
    ringkasan: async (ctx, i) => {
      const f = await namaFolder(ctx, i.folder_id);
      return `Membuat Telaahan Staf (.docx):\n• Disimpan di folder "${f.name}" sebagai Telaahan Staff_${f.name}.docx\n• Dikirim juga ke chat ini\n• Kesimpulan: ${i.data.kesimpulan.kasus ? 'Kasus' : 'Bukan Kasus'}`;
    },
    async run(ctx, i) {
      const buf = await buildTelaahan(i.data);
      return json(await simpanDocx(ctx, i.folder_id, 'Telaahan Staff', buf, 'Telaahan Staf'));
    },
  },
  {
    name: 'buat_notula',
    ubah: true,
    description: 'Membuat file Word Notula Gelar Kasus Awal (3 halaman, format terkunci), menyimpannya di folder pengadu sebagai "Notula Gelar Kasus Awal_<nama folder>.docx", dan mengirimnya ke chat.',
    input_schema: { type: 'object', properties: { folder_id: str('ID folder pengadu.'), data: NOTULA_SCHEMA }, required: ['folder_id', 'data'] },
    zod: z.object({ folder_id: z.string(), data: Notula }),
    ringkasan: async (ctx, i) => {
      const f = await namaFolder(ctx, i.folder_id);
      const kosong = Object.entries(i.data).filter(([, v]) => typeof v === 'string' && !v.trim()).map(([k]) => k);
      return `Membuat Notula Gelar Kasus Awal (.docx):\n• Disimpan di folder "${f.name}" sebagai Notula Gelar Kasus Awal_${f.name}.docx\n• Dikirim juga ke chat ini${kosong.length ? `\n• Akan bertanda ${PERLU_CEK}: ${kosong.join(', ')}` : ''}`;
    },
    async run(ctx, i) {
      const buf = await buildNotula(i.data);
      return json(await simpanDocx(ctx, i.folder_id, 'Notula Gelar Kasus Awal', buf, 'Notula Gelar Kasus Awal'));
    },
  },

  // ---------------- Gmail ----------------
  {
    name: 'cari_email',
    description: 'Mencari email di Gmail pengguna dengan sintaks pencarian Gmail (mis. "is:unread", "from:kantah newer_than:7d", "subject:undangan").',
    input_schema: { type: 'object', properties: { kueri: { type: 'string' }, maks: { type: 'integer', description: 'Opsional, bawaan 10, maks 30.' } }, required: ['kueri'] },
    zod: z.object({ kueri: z.string(), maks: z.number().int().positive().optional() }),
    run: async (ctx, i) => json(await ctx.google.gmail.search(i.kueri, i.maks || 10)),
  },
  {
    name: 'baca_email',
    description: 'Membaca isi lengkap satu percakapan email (thread) dari hasil cari_email.',
    input_schema: { type: 'object', properties: { thread_id: { type: 'string' } }, required: ['thread_id'] },
    zod: z.object({ thread_id: z.string() }),
    run: async (ctx, i) => json(await ctx.google.gmail.read(i.thread_id)),
  },
  {
    name: 'kirim_email',
    ubah: true,
    description: 'Mengirim email baru dari Gmail pengguna.',
    input_schema: { type: 'object', properties: EMAIL_PROPS, required: ['kepada', 'subjek', 'isi'] },
    zod: Email,
    ringkasan: async (ctx, i) => ringkasEmail('Mengirim email:', i),
    run: async (ctx, i) => { await ctx.google.gmail.send(keEmail(i)); return 'Email terkirim.'; },
  },
  {
    name: 'buat_draf_email',
    ubah: true,
    description: 'Menyimpan email sebagai draf di Gmail (tidak dikirim).',
    input_schema: { type: 'object', properties: EMAIL_PROPS, required: ['kepada', 'subjek', 'isi'] },
    zod: Email,
    ringkasan: async (ctx, i) => ringkasEmail('Menyimpan draf email di Gmail:', i),
    run: async (ctx, i) => json(await ctx.google.gmail.draft(keEmail(i))),
  },
  {
    name: 'balas_email',
    ubah: true,
    description: 'Membalas percakapan email (thread) kepada pengirimnya.',
    input_schema: { type: 'object', properties: { thread_id: { type: 'string' }, subjek_asal: str('Subjek email yang dibalas, untuk ditampilkan saat minta persetujuan.'), isi: { type: 'string' }, cc: str('Opsional.') }, required: ['thread_id', 'subjek_asal', 'isi'] },
    zod: z.object({ thread_id: z.string(), subjek_asal: z.string(), isi: z.string(), cc: z.string().optional() }),
    ringkasan: async (ctx, i) => `Membalas email "${i.subjek_asal}"${i.cc ? ` (Cc: ${i.cc})` : ''}:\n\n${potong(i.isi, 1500)}`,
    run: async (ctx, i) => { await ctx.google.gmail.reply(i.thread_id, { body: i.isi, cc: i.cc || undefined }); return 'Balasan terkirim.'; },
  },

  // ---------------- Kalender ----------------
  {
    name: 'lihat_jadwal',
    description: 'Melihat acara di Google Calendar utama pengguna pada rentang waktu tertentu.',
    input_schema: { type: 'object', properties: { mulai: str('ISO 8601, mis. 2026-10-21T00:00:00+07:00'), selesai: str('ISO 8601') }, required: ['mulai', 'selesai'] },
    zod: z.object({ mulai: isoDate, selesai: isoDate }),
    run: async (ctx, i) => json(await ctx.google.calendar.list(i.mulai, i.selesai)),
  },
  {
    name: 'buat_acara',
    ubah: true,
    description: 'Membuat acara di Google Calendar utama. Bila ada tamu, undangan dikirim ke mereka.',
    input_schema: { type: 'object', properties: { judul: { type: 'string' }, mulai: str('ISO 8601 dengan zona waktu, mis. 2026-10-21T09:00:00+07:00'), selesai: str('ISO 8601'), lokasi: str('Opsional.'), keterangan: str('Opsional.'), tamu: str('Opsional: email tamu, pisahkan koma.') }, required: ['judul', 'mulai', 'selesai'] },
    zod: z.object({ judul: z.string(), mulai: isoDate, selesai: isoDate, lokasi: z.string().optional(), keterangan: z.string().optional(), tamu: z.string().optional() }),
    ringkasan: async (ctx, i) => [`Membuat acara di Kalender:`, `• ${i.judul}`, `• Mulai: ${waktu(i.mulai)}`, `• Selesai: ${waktu(i.selesai)}`,
      i.lokasi ? `• Lokasi: ${i.lokasi}` : null, i.tamu ? `• Undangan dikirim ke: ${i.tamu}` : null, i.keterangan ? `• Keterangan: ${potong(i.keterangan, 300)}` : null].filter(Boolean).join('\n'),
    run: async (ctx, i) => json(await ctx.google.calendar.create({ title: i.judul, start: i.mulai, end: i.selesai, location: i.lokasi, description: i.keterangan, guests: i.tamu })),
  },
  {
    name: 'hapus_acara',
    ubah: true,
    description: 'Menghapus satu acara dari Google Calendar (event_id dari lihat_jadwal).',
    input_schema: { type: 'object', properties: { event_id: { type: 'string' }, judul: str('Judul acara, untuk ditampilkan.'), mulai: str('Waktu mulai acara, untuk ditampilkan.') }, required: ['event_id', 'judul', 'mulai'] },
    zod: z.object({ event_id: z.string(), judul: z.string(), mulai: isoDate }),
    ringkasan: async (ctx, i) => `Menghapus acara dari Kalender:\n• ${i.judul}\n• ${waktu(i.mulai)}`,
    run: async (ctx, i) => { await ctx.google.calendar.remove(i.event_id); return 'Acara dihapus.'; },
  },
];

const BY_NAME = Object.fromEntries(ALAT.map(a => [a.name, a]));

// Definisi untuk API Claude. Urutan tetap supaya awalan permintaan (dan cache) tidak berubah.
const toolDefinitions = () => [
  ...ALAT.map(a => ({ name: a.name, description: a.description, input_schema: a.input_schema, eager_input_streaming: true })),
  { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
];

// Menjalankan satu panggilan alat. Alat pengubah menunggu persetujuan lewat ctx.mintaPersetujuan.
async function jalankanAlat(ctx, block) {
  const alat = BY_NAME[block.name];
  if (!alat) return { is_error: true, content: `Alat tidak dikenal: ${block.name}` };
  const parsed = alat.zod.safeParse(block.input);
  if (!parsed.success) {
    return { is_error: true, content: `Masukan alat tidak sah: ${parsed.error.issues.map(x => `${x.path.join('.') || '(akar)'}: ${x.message}`).join('; ')}` };
  }
  const input = parsed.data;
  try {
    if (alat.ubah) {
      const ringkas = await alat.ringkasan(ctx, input);
      const jawab = await ctx.mintaPersetujuan(ringkas);
      if (!jawab.setuju) {
        return {
          content: `Pengguna TIDAK menyetujui tindakan ini; tidak ada yang dikerjakan.${jawab.catatan ? ` Pesan pengguna: "${jawab.catatan}"` : ''} Jangan ulangi tanpa perubahan; ikuti pesan pengguna atau tanyakan apa yang perlu diubah.`,
        };
      }
    }
    return { content: String(await alat.run(ctx, input)) };
  } catch (err) {
    return { is_error: true, content: `Gagal: ${err.message || err}` };
  }
}

module.exports = { ALAT, toolDefinitions, jalankanAlat };
