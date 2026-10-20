// Membaca PDF pengaduan dengan Claude dan mengambil data untuk folder + baris Master Data.
const Anthropic = require('@anthropic-ai/sdk').default;
const { z } = require('zod');
const { PERLU_CEK } = require('../util/naming');

const FIELDS = {
  nomor_agenda: 'Nomor agenda pada lembar disposisi.',
  tanggal_disposisi: 'Tanggal pada lembar disposisi, format dd/mm/yyyy.',
  perintah_disposisi: 'Isi perintah disposisi persis sebagaimana tertulis.',
  tanggal_diterima: 'Tanggal surat diterima menurut cap/stempel penerimaan, format dd/mm/yyyy.',
  tanggal_surat: 'Tanggal surat pengaduan, format dd/mm/yyyy.',
  nomor_surat: 'Nomor surat pengaduan.',
  pengadu_prinsipal: 'Nama Pengadu (prinsipal), bukan penerima kuasa.',
  penerima_kuasa: 'Nama penerima kuasa sebagaimana tertulis. String kosong bila surat tidak melibatkan kuasa.',
  perihal: 'Perihal surat pengaduan persis sebagaimana tertulis.',
  pokok_permasalahan: 'Satu kalimat 10-30 kata: siapa memohon apa atas objek apa dengan dugaan apa. Gunakan sebutan "Pengadu".',
  teradu: 'Nama pihak Teradu.',
  objek_permasalahan: 'Hak atas tanah (jenis dan nomor), desa/kelurahan, kecamatan, kota/kabupaten, provinsi.',
  kota_kabupaten_objek: 'Kota/kabupaten letak OBJEK permasalahan (bukan alamat pengadu atau teradu), diawali "Kota " atau "Kabupaten ", mis. "Kabupaten Bekasi".',
  rencana_tl: 'Rencana tindak lanjut, diambil dari perintah disposisi.',
};

const SCHEMA = {
  type: 'object',
  properties: {
    ...Object.fromEntries(Object.entries(FIELDS).map(([k, description]) => [k, { type: 'string', description }])),
    perlu_cek: {
      type: 'array',
      description: 'Setiap kolom yang diisi [PERLU CEK], beserta alasannya.',
      items: {
        type: 'object',
        properties: { kolom: { type: 'string' }, alasan: { type: 'string' } },
        required: ['kolom', 'alasan'],
        additionalProperties: false,
      },
    },
  },
  required: [...Object.keys(FIELDS), 'perlu_cek'],
  additionalProperties: false,
};

const Result = z.object({
  ...Object.fromEntries(Object.keys(FIELDS).map(k => [k, z.string()])),
  perlu_cek: z.array(z.object({ kolom: z.string(), alasan: z.string() })),
});

const SYSTEM = `Anda membantu Penata Pertanahan di Direktorat Jenderal Penanganan Sengketa dan Konflik Pertanahan, Kementerian ATR/BPN, mencatat berkas pengaduan yang baru masuk. Berkas biasanya terdiri atas lembar disposisi, surat pengaduan, dan lampiran; banyak halaman hasil scan dan tulisan tangan.

Pengguna tidak ingin ada asumsi. Aturannya:
- Salin data sebagaimana tertulis di berkas. Jangan mengarang nama, nomor, atau tanggal.
- Data yang memang tidak ada di berkas ditulis "-".
- Data yang ada tetapi tidak terbaca atau meragukan (tulisan tangan, cap, scan buram) ditulis "${PERLU_CEK}", dan kolomnya dicantumkan di perlu_cek beserta alasannya.
- Tanggal ditulis dd/mm/yyyy, mis. 12/09/2026.
- Pengadu adalah prinsipal. Bila surat dikirim oleh kuasa, kuasanya ditulis di penerima_kuasa.
- Kota/kabupaten adalah letak objek tanah yang dipermasalahkan, bukan alamat para pihak.`;

class ExtractionError extends Error {}

function createExtractor({ apiKey, model }) {
  const client = new Anthropic({ apiKey });

  return async function extractPengaduan(pdfBuffer) {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 16000,
      // Bila model menolak karena pengaman, API mengulang permintaan di model cadangan yang dianjurkan.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBuffer.toString('base64') } },
          { type: 'text', text: 'Baca seluruh halaman berkas pengaduan ini, lalu isi semua kolom.' },
        ],
      }],
    });
    let msg;
    try {
      msg = await stream.finalMessage();
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) throw new ExtractionError('Kunci Claude API ditolak. Periksa ANTHROPIC_API_KEY di .env.');
      if (err instanceof Anthropic.RateLimitError) throw new ExtractionError('Batas pemakaian Claude API tercapai. Coba lagi beberapa menit lagi.');
      if (err instanceof Anthropic.BadRequestError) throw new ExtractionError(`Permintaan ke Claude ditolak: ${err.message}`);
      if (err instanceof Anthropic.APIError) throw new ExtractionError(`Claude API error ${err.status ?? ''}: ${err.message}`);
      throw err;
    }
    if (msg.stop_reason === 'refusal') throw new ExtractionError('Claude menolak memproses berkas ini.');
    if (msg.stop_reason === 'max_tokens') throw new ExtractionError('Jawaban Claude terpotong (batas panjang tercapai).');
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    let parsed;
    try {
      parsed = Result.parse(JSON.parse(text));
    } catch {
      throw new ExtractionError('Hasil pembacaan Claude tidak sesuai format.');
    }
    return { data: parsed, usage: msg.usage, model: msg.model };
  };
}

module.exports = { createExtractor, ExtractionError, FIELDS, SCHEMA };
