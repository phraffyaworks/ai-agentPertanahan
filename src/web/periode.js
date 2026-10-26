// Rentang waktu laporan pemakaian, dihitung dalam WIB (UTC+7, tanpa musim panas). Rentang: [sejak, sampai).
const WIB = 7 * 3600e3;
const HARI = 24 * 3600e3;

const PERIODE = [
  { kode: 'hari-ini', label: 'Hari ini' },
  { kode: '7-hari', label: '7 hari terakhir' },
  { kode: '30-hari', label: '30 hari terakhir' },
  { kode: 'bulan-ini', label: 'Bulan ini' },
  { kode: 'bulan-lalu', label: 'Bulan lalu' },
];
const BAWAAN = '30-hari';

const fmtTanggal = ms => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium' }).format(new Date(ms));
const fmtBulan = ms => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', month: 'long', year: 'numeric' }).format(new Date(ms));

function rentangPeriode(kode, kini = Date.now()) {
  const p = PERIODE.find(x => x.kode === kode) || PERIODE.find(x => x.kode === BAWAAN);
  const w = new Date(kini + WIB);
  const awalBulan = geser => Date.UTC(w.getUTCFullYear(), w.getUTCMonth() + geser, 1) - WIB;
  const [sejak, sampai] = {
    'hari-ini': [Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()) - WIB, kini + 1],
    '7-hari': [kini - 7 * HARI, kini + 1],
    '30-hari': [kini - 30 * HARI, kini + 1],
    'bulan-ini': [awalBulan(0), kini + 1],
    'bulan-lalu': [awalBulan(-1), awalBulan(0)],
  }[p.kode];
  const keterangan = p.kode.startsWith('bulan') ? fmtBulan(sejak)
    : p.kode === 'hari-ini' ? fmtTanggal(sejak) : `${fmtTanggal(sejak)} s.d. ${fmtTanggal(kini)}`;
  return { kode: p.kode, label: p.label, keterangan, sejak, sampai };
}

module.exports = { PERIODE, rentangPeriode };
