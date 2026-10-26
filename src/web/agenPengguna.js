// Agen untuk banyak pengguna dashboard. Setiap pengguna punya satu percakapan (dipakai bersama web dan
// Telegram), berkas, riwayat, dan transkrip sendiri di data/pengguna/<id>/. Inti agen dan 18 alatnya sama
// dengan bot versi 1; yang berbeda hanya data per pengguna: profil, Google, dan blok prompt pengguna.
const fs = require('fs');
const path = require('path');
const { createRiwayat } = require('../agent/riwayat');
const { createBerkasStore } = require('../agent/berkas');
const { createStore } = require('../state/store');
const { aturanUmum, blokPengguna } = require('../agent/prompt');
const { keDokumen } = require('./profil');
const { hitungPemakaian } = require('./harga');

const PERAN = 'Anda adalah asisten pribadi bagi pegawai di lingkungan Direktorat Penanganan Sengketa Pertanahan, Direktorat Jenderal Penanganan Sengketa dan Konflik Pertanahan, Kementerian ATR/BPN. Pengguna berbicara dengan Anda lewat dashboard web atau Telegram. Siapa pengguna yang sedang Anda layani ada di bagian "Pengguna yang sedang dilayani" di akhir prompt ini.';
const BATAS_TAMPIL = 300;

// Transkrip tampilan (bukan riwayat model): satu baris JSON per kejadian, bernomor urut.
function createTranskrip(dir) {
  const file = path.join(dir, 'transkrip.jsonl');
  let isi = null;
  const muat = () => {
    if (!isi) isi = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
    return isi;
  };
  return {
    tambah(entri) {
      const semua = muat();
      const e = { id: (semua.length ? semua[semua.length - 1].id : 0) + 1, waktu: Date.now(), ...entri };
      fs.appendFileSync(file, `${JSON.stringify(e)}\n`);
      semua.push(e);
      return e;
    },
    terakhir: (n = BATAS_TAMPIL) => muat().slice(-n),
    sejak: id => muat().filter(e => e.id > id),
  };
}

// Pengganti layanan Google selama pengguna belum menyambungkan Google: setiap pemakaian alat
// mendapat pesan yang jelas, bukan galat teknis.
const belumTersambung = new Proxy({}, {
  get: () => async () => { throw new Error('Google pengguna belum tersambung. Minta pengguna membuka menu Mulai, lalu Hubungkan Google.'); },
});

function buatLayananAgen({ db, agen, google, dataDir }) {
  const keadaan = new Map();
  const sistemUmum = { type: 'text', text: `${PERAN}\n\n${aturanUmum()}`, cache_control: { type: 'ephemeral' } };

  function st(id) {
    if (!keadaan.has(id)) {
      const dir = path.join(dataDir, 'pengguna', String(id));
      fs.mkdirSync(path.join(dir, 'keluaran'), { recursive: true });
      keadaan.set(id, {
        dir, riwayat: createRiwayat(dir), berkas: createBerkasStore(dir, agen.anthropic), store: createStore(dir),
        transkrip: createTranskrip(dir), antrean: [], berjalan: false, menunggu: new Map(), pelanggan: new Set(),
      });
    }
    return keadaan.get(id);
  }

  function siarkan(id, pesan) {
    for (const kirim of st(id).pelanggan) { try { kirim(pesan); } catch { /* pelanggan terputus */ } }
  }
  function catatTampil(id, entri) {
    const e = st(id).transkrip.tambah(entri);
    siarkan(id, { jenis: 'entri', entri: e });
    return e;
  }
  const setStatus = (id, sibuk) => siarkan(id, { jenis: 'status', sibuk });

  function berlangganan(id, kirim) {
    const s = st(id);
    s.pelanggan.add(kirim);
    return () => s.pelanggan.delete(kirim);
  }

  function io(id, saluran) {
    const s = st(id);
    let seq = 0;
    return {
      kirimTeks: async teks => { catatTampil(id, { jenis: 'agen', teks }); },
      kirimDokumen: async (buffer, nama) => {
        const berkasId = `D${Date.now().toString(36)}${(seq++).toString(36)}`;
        fs.writeFileSync(path.join(s.dir, 'keluaran', `${berkasId}.docx`), buffer);
        catatTampil(id, { jenis: 'dokumen', berkasId, nama });
      },
      // Dicatat sebagai "menunggu" lebih dulu, baru disiarkan, supaya peramban langsung menerima tombolnya.
      mintaPersetujuan: ringkasan => new Promise(resolve => {
        const e = s.transkrip.tambah({ jenis: 'persetujuan', ringkasan });
        s.menunggu.set(e.id, { resolve });
        siarkan(id, { jenis: 'entri', entri: e });
      }),
      catatPemakaian: ({ model, usage, durasi_ms }) => {
        const h = hitungPemakaian(model, usage);
        db.pemakaian.catat({ pengguna_id: id, saluran, penyedia: 'anthropic', model, ...h, biaya_usd: h.biaya_usd, durasi_ms });
      },
    };
  }

  function ctxAlat(id) {
    const s = st(id);
    const g = google.untukPengguna(id);
    return {
      google: g || { drive: belumTersambung, sheets: belumTersambung, gmail: belumTersambung, calendar: belumTersambung },
      drive: g ? g.drive : belumTersambung,
      sheets: g ? g.sheets : belumTersambung,
      folderIndukId: g ? g.folderIndukId : null,
      store: s.store,
      berkas: s.berkas,
      profil: keDokumen(db.profil.ambil(id)),
      wajibProfil: true,
    };
  }

  function sistem(id) {
    const pengguna = db.pengguna.olehId(id);
    return [sistemUmum, { type: 'text', text: blokPengguna({ pengguna, profil: db.profil.ambil(id), googleTersambung: !!db.google.ambil(id) }) }];
  }

  async function proses(id) {
    const s = st(id);
    if (s.berjalan || !s.antrean.length) return;
    s.berjalan = true;
    // Pesan yang menumpuk selama agen bekerja digabung menjadi satu giliran, seperti bot versi 1.
    const tumpuk = s.antrean.splice(0);
    const isi = tumpuk.flatMap(t => t.isi), saluran = tumpuk[tumpuk.length - 1].saluran;
    setStatus(id, true);
    try {
      await agen.giliran(`u${id}`, isi, io(id, saluran), ctxAlat(id), { system: sistem(id), riwayat: s.riwayat });
    } catch (err) {
      console.error(`Gagal memproses giliran pengguna ${id}:`, err);
      catatTampil(id, { jenis: 'galat', teks: `Maaf, terjadi kesalahan: ${err.message || err}` });
    } finally {
      s.berjalan = false;
      setStatus(id, s.antrean.length > 0);
      if (s.antrean.length) proses(id);
    }
  }

  // Pesan baru dari pengguna. Bila agen sedang menunggu persetujuan, teks pengguna dianggap Tolak
  // beserta catatannya (sama seperti bot versi 1), misalnya "ganti nama foldernya jadi ...".
  async function kirimPesan(id, { teks = '', berkas = [], saluran = 'web' }) {
    const s = st(id);
    teks = String(teks || '').trim();
    if (!teks && !berkas.length) throw new Error('Pesan kosong.');
    const tersimpan = [];
    for (const b of berkas) tersimpan.push(await s.berkas.simpan(b.buffer, b.nama, b.mime));
    catatTampil(id, { jenis: 'pengguna', teks, berkas: tersimpan.map(b => ({ id: b.id, nama: b.nama })), saluran });

    const menunggu = [...s.menunggu.keys()];
    if (menunggu.length) {
      for (const sid of menunggu) putuskan(id, sid, false, tersimpan.length ? 'pengguna mengirim berkas baru' : teks);
      if (teks && !tersimpan.length) return; // catatan sudah diteruskan ke agen lewat hasil alat
    }
    s.antrean.push({ isi: [...tersimpan.flatMap(b => s.berkas.blokKonten(b)), ...(teks ? [{ type: 'text', text: teks }] : [])], saluran });
    proses(id);
  }

  function putuskan(id, idPersetujuan, setuju, catatan = null) {
    const s = st(id);
    const p = s.menunggu.get(Number(idPersetujuan));
    if (!p) return false;
    s.menunggu.delete(Number(idPersetujuan));
    catatTampil(id, { jenis: 'keputusan', untuk: Number(idPersetujuan), setuju: !!setuju, catatan: catatan || undefined });
    p.resolve(setuju ? { setuju: true } : { setuju: false, ...(catatan ? { catatan } : {}) });
    return true;
  }

  function percakapanBaru(id) {
    const s = st(id);
    if (s.berjalan) return false;
    s.riwayat.reset(`u${id}`);
    catatTampil(id, { jenis: 'info', teks: 'Percakapan baru dimulai. Riwayat lama disimpan sebagai arsip.' });
    return true;
  }

  const fileKeluaran = (id, berkasId) => {
    if (!/^D[0-9a-z]+$/.test(String(berkasId))) return null;
    const f = path.join(st(id).dir, 'keluaran', `${berkasId}.docx`);
    return fs.existsSync(f) ? f : null;
  };
  const namaKeluaran = (id, berkasId) => (st(id).transkrip.terakhir(Infinity).find(e => e.jenis === 'dokumen' && e.berkasId === berkasId) || {}).nama;

  const tampilan = id => {
    const s = st(id);
    return { entri: s.transkrip.terakhir(), menunggu: new Set(s.menunggu.keys()), sibuk: s.berjalan || s.antrean.length > 0 };
  };
  const entriSejak = (id, sejak) => st(id).transkrip.sejak(Number(sejak) || 0);
  const cariEntri = (id, eid) => st(id).transkrip.terakhir(Infinity).find(e => e.id === Number(eid)) || null;
  const masihMenunggu = (id, eid) => st(id).menunggu.has(Number(eid));

  return { kirimPesan, putuskan, percakapanBaru, berlangganan, tampilan, entriSejak, cariEntri, masihMenunggu, fileKeluaran, namaKeluaran };
}

module.exports = { buatLayananAgen, createTranskrip };
