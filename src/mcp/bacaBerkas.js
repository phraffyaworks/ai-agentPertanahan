// Membaca isi PDF atau foto dokumen lewat Claude, untuk agen di luar bot (Hermes).
// Hermes tidak meneruskan PDF ke model; tanpa alat ini teks harus diekstrak dengan OCR biasa,
// yang lemah untuk scan, tulisan tangan, dan cap. Claude membaca halaman seperti pada bot.
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk').default;

const JENIS = {
  '.pdf': { block: 'document', mime: 'application/pdf' },
  '.jpg': { block: 'image', mime: 'image/jpeg' },
  '.jpeg': { block: 'image', mime: 'image/jpeg' },
  '.png': { block: 'image', mime: 'image/png' },
  '.webp': { block: 'image', mime: 'image/webp' },
  '.gif': { block: 'image', mime: 'image/gif' },
};
const MAKS_BYTE = 30 * 1024 * 1024; // batas permintaan Claude 32 MB, termasuk base64

const PETUNJUK = `Salin seluruh isi dokumen terlampir apa adanya, halaman demi halaman, dalam bahasa aslinya.
- Awali setiap halaman dengan baris "=== Halaman N ===".
- Tulis teks persis seperti tertulis: nama, nomor, tanggal, NIP, angka, dan ejaan. Jangan memperbaiki, meringkas, atau menambah.
- Tulisan tangan, cap/stempel, paraf, dan lembar disposisi ikut disalin. Sebut jenisnya dalam kurung siku, mis. [Cap: ...], [Tulisan tangan: ...].
- Bagian yang tidak terbaca atau meragukan ditulis [TIDAK TERBACA] atau [RAGU: tebakan terbaik], jangan dikarang.
- Tabel ditulis baris per baris dengan pemisah " | ".
Jawab hanya dengan salinan isi dokumen.`;

function jenisBerkas(file) {
  const j = JENIS[path.extname(file).toLowerCase()];
  if (!j) throw new Error(`Jenis berkas tidak didukung: ${path.basename(file)}. Yang bisa dibaca: PDF, JPG, PNG, WEBP, GIF.`);
  return j;
}

function createPembaca({ claude }) {
  const client = claude.apiKey ? new Anthropic({ apiKey: claude.apiKey }) : null;
  let cadangan = true; // model cadangan bila ditolak pengaman; dimatikan bila API menolak parameternya

  async function baca(file) {
    if (!client) throw new Error('ANTHROPIC_API_KEY belum diisi di .env server MCP, jadi berkas tidak bisa dibaca.');
    const j = jenisBerkas(file);
    const data = fs.readFileSync(file);
    if (data.length > MAKS_BYTE) throw new Error(`Berkas terlalu besar (${Math.round(data.length / 1048576)} MB). Batasnya sekitar 30 MB.`);
    const lampiran = { type: j.block, source: { type: 'base64', media_type: j.mime, data: data.toString('base64') } };
    for (;;) {
      try {
        const msg = await client.beta.messages.stream({
          model: claude.model,
          max_tokens: 64000,
          ...(cadangan && { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
          thinking: { type: 'adaptive' },
          output_config: { effort: claude.effort || 'medium' },
          messages: [{ role: 'user', content: [lampiran, { type: 'text', text: PETUNJUK }] }],
        }).finalMessage();
        if (msg.stop_reason === 'refusal') throw new Error('Pengaman Claude menolak membaca berkas ini.');
        const teks = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        const potong = msg.stop_reason === 'max_tokens' ? '\n\n[PERINGATAN: salinan terpotong karena dokumen terlalu panjang. Minta pengguna mengirim bagian sisanya.]' : '';
        return { teks: teks + potong, model: msg.model, usage: msg.usage };
      } catch (err) {
        if (err instanceof Anthropic.BadRequestError && cadangan && /fallback/i.test(err.message)) {
          cadangan = false;
          continue;
        }
        if (err instanceof Anthropic.AuthenticationError) throw new Error('Kunci Claude API ditolak. Periksa ANTHROPIC_API_KEY.');
        if (err instanceof Anthropic.RateLimitError) throw new Error('Batas pemakaian Claude API tercapai. Coba lagi beberapa menit lagi.');
        if (err instanceof Anthropic.APIError) throw new Error(`Claude API error ${err.status ?? ''}: ${err.message}`);
        throw err;
      }
    }
  }

  return { baca };
}

module.exports = { createPembaca, jenisBerkas, JENIS };
