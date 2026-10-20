// Inti asisten: satu giliran percakapan = memanggil Claude, menjalankan alat yang dipanggil,
// mengulang sampai Claude selesai menjawab. Riwayat disimpan per chat (append-only).
const Anthropic = require('@anthropic-ai/sdk').default;
const { systemPrompt } = require('./prompt');
const { toolDefinitions, jalankanAlat } = require('./alat');

const MAKS_PUTARAN = 25;
// Fitur lanjutan beserta header beta-nya. Bila API menolak salah satunya (400 yang menyebut namanya),
// fitur itu dimatikan selama bot berjalan dan permintaan diulang, supaya percakapan tidak macet.
const FITUR = {
  ringkasan: { beta: 'compact-2026-01-12', pola: /context_management|compact/i },      // ringkasan otomatis percakapan panjang
  cadangan: { beta: 'server-side-fallback-2026-07-01', pola: /fallback/i },           // model cadangan bila ditolak pengaman
  ikatanThinking: { beta: 'thinking-binding-controls-2026-08-01', pola: /block_binding/i }, // blok thinking tak sah dibuang, bukan galat
  cache: { pola: /cache_control/i },
  alirMasukan: { pola: /eager_input_streaming/i },
};
const INSTRUKSI_RINGKASAN = 'Ringkasan wajib memuat: kasus yang dibahas (nama folder, folder_id, baris Master Data, status), '
  + 'ID berkas (B1, B2, ...) beserta isinya yang penting, draf Telaahan atau Notula terakhir yang belum final beserta revisi yang diminta, '
  + 'keputusan dan instruksi pengguna, serta tindakan yang sudah dan belum disetujui. Tulis dalam bahasa Indonesia.';

const WIB = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'short' });
const capWaktu = (now = new Date()) => `[${WIB.format(now)} WIB]`;

function createAgen({ claude, riwayat }) {
  const client = new Anthropic({ apiKey: claude.apiKey });
  const system = [{ type: 'text', text: systemPrompt() }];
  const aktif = Object.fromEntries(Object.keys(FITUR).map(k => [k, true]));

  const params = messages => ({
    model: claude.model,
    max_tokens: 32000,
    betas: Object.keys(FITUR).filter(k => aktif[k] && FITUR[k].beta).map(k => FITUR[k].beta),
    ...(aktif.cadangan && { fallbacks: 'default' }),
    thinking: aktif.ikatanThinking ? { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } } : { type: 'adaptive' },
    output_config: { effort: claude.effort || 'medium' },
    ...(aktif.ringkasan && { context_management: { edits: [{ type: 'compact_20260112', instructions: INSTRUKSI_RINGKASAN }] } }),
    ...(aktif.cache && { cache_control: { type: 'ephemeral' } }),
    system,
    tools: toolDefinitions().map(t => (aktif.alirMasukan || !('eager_input_streaming' in t) ? t : (({ eager_input_streaming: _, ...x }) => x)(t))),
    messages,
  });

  async function panggil(messages) {
    for (;;) {
      try {
        return await client.beta.messages.stream(params(messages)).finalMessage();
      } catch (err) {
        if (err instanceof Anthropic.BadRequestError) {
          const fitur = Object.keys(FITUR).find(k => aktif[k] && FITUR[k].pola.test(err.message));
          if (fitur) {
            aktif[fitur] = false;
            console.warn(`Fitur "${fitur}" ditolak API dan dimatikan: ${err.message}`);
            continue;
          }
        }
        if (err instanceof Anthropic.AuthenticationError) throw new Error('Kunci Claude API ditolak. Periksa ANTHROPIC_API_KEY.');
        if (err instanceof Anthropic.RateLimitError) throw new Error('Batas pemakaian Claude API tercapai. Coba lagi beberapa menit lagi.');
        if (err instanceof Anthropic.APIError) throw new Error(`Claude API error ${err.status ?? ''}: ${err.message}`);
        throw err;
      }
    }
  }

  // io: { kirimTeks(teks), kirimDokumen(buffer, nama, caption), mintaPersetujuan(ringkasan) }
  // ctx: layanan untuk alat (google, berkas, store, folderIndukId, ...)
  async function giliran(chatId, isiPengguna, io, ctx) {
    const h = riwayat.load(chatId);
    h.push({ role: 'user', content: [{ type: 'text', text: capWaktu() }, ...isiPengguna] });
    const alatCtx = { ...ctx, kirimDokumen: io.kirimDokumen, mintaPersetujuan: io.mintaPersetujuan };

    for (let putaran = 0; putaran < MAKS_PUTARAN; putaran++) {
      const msg = await panggil(h.messages);
      h.push({ role: 'assistant', content: msg.content });

      const teks = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      if (teks) await io.kirimTeks(teks);

      if (msg.stop_reason === 'refusal') {
        await io.kirimTeks('Maaf, permintaan ini tidak bisa diproses oleh pengaman Claude.');
        return;
      }
      if (msg.stop_reason === 'pause_turn') continue;

      const panggilan = msg.content.filter(b => b.type === 'tool_use');
      if (!panggilan.length) return;

      const hasil = [];
      for (const b of panggilan) {
        // Masukan alat bisa terpotong bila batas panjang tercapai; jangan dijalankan.
        const r = msg.stop_reason === 'max_tokens'
          ? { is_error: true, content: 'Masukan alat terpotong karena jawaban terlalu panjang. Bagi menjadi bagian lebih kecil.' }
          : await jalankanAlat(alatCtx, b);
        hasil.push({ type: 'tool_result', tool_use_id: b.id, ...r });
      }
      h.push({ role: 'user', content: hasil });
    }
    await io.kirimTeks('Proses berhenti karena terlalu banyak langkah. Silakan beri instruksi lanjutan.');
  }

  // Uji singkat dengan pengaturan lengkap (prompt, alat, beta) untuk memastikan permintaan diterima API.
  async function ujiCoba() {
    const msg = await panggil([{ role: 'user', content: 'Uji koneksi. Balas dengan satu kata: siap' }]);
    const mati = Object.keys(aktif).filter(k => !aktif[k]);
    const jawab = msg.content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim() || `(stop_reason: ${msg.stop_reason})`;
    return mati.length ? `${jawab} (fitur dimatikan karena ditolak API: ${mati.join(', ')})` : jawab;
  }

  return { giliran, ujiCoba, anthropic: client };
}

module.exports = { createAgen };
