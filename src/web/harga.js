// Penghitung token dan biaya per panggilan model, dari response.usage Claude API.
// Harga US$ per juta token dari https://platform.claude.com/docs/en/about-claude/pricing (dicek 25 Oktober 2026).
// Tahap 2: tabel ini dipindah ke menu Katalog LLM super admin supaya bisa diubah tanpa mengubah kode.
const HARGA = {
  'claude-sonnet-5-5': { masuk: 2, tulis5m: 2.5, tulis1j: 4, baca: 0.10, keluar: 10 },
  'claude-opus-5-5': { masuk: 4, tulis5m: 5, tulis1j: 8, baca: 0.20, keluar: 20 },
  // Haiku 5.5: harga ini untuk prompt sampai 100.000 token; di atasnya semua harga 5 kali lipat.
  'claude-haiku-5-5': { masuk: 0.10, tulis5m: 0.125, tulis1j: 0.20, baca: 0.01, keluar: 0.50, batasPrompt: 100000, kaliDiAtas: 5 },
  'claude-fable-5-1': { masuk: 10, tulis5m: 12.5, tulis1j: 20, baca: 0.25, keluar: 50 },
};
const HARGA_PENCARIAN_WEB = 10 / 1000; // US$10 per 1.000 pencarian

const hargaModel = model => {
  const kunci = Object.keys(HARGA).find(k => String(model || '').startsWith(k));
  return kunci ? HARGA[kunci] : null;
};

// Satu bagian usage (top-level atau satu entri usage.iterations) menjadi token dan biaya.
function hitungBagian(model, u = {}) {
  const tulis5m = u.cache_creation?.ephemeral_5m_input_tokens ?? u.cache_creation_input_tokens ?? 0;
  const tulis1j = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const t = {
    token_masuk: u.input_tokens || 0,
    token_keluar: u.output_tokens || 0,
    token_cache_baca: u.cache_read_input_tokens || 0,
    token_cache_tulis: tulis5m + tulis1j,
    pencarian_web: u.server_tool_use?.web_search_requests || 0,
  };
  const h = hargaModel(model);
  let biaya = null;
  if (h) {
    const prompt = t.token_masuk + t.token_cache_baca + t.token_cache_tulis;
    const kali = h.batasPrompt && prompt > h.batasPrompt ? h.kaliDiAtas : 1;
    biaya = (kali * (t.token_masuk * h.masuk + tulis5m * h.tulis5m + tulis1j * h.tulis1j + t.token_cache_baca * h.baca + t.token_keluar * h.keluar)) / 1e6
      + t.pencarian_web * HARGA_PENCARIAN_WEB;
  }
  return { ...t, biaya_usd: biaya };
}

// Bila usage.iterations ada (ringkasan otomatis, model cadangan), setiap langkah dijumlahkan dengan
// harga model yang menjalankannya; angka top-level hanya mencakup langkah terakhir.
function hitungPemakaian(model, usage = {}) {
  const bagian = Array.isArray(usage.iterations) && usage.iterations.length
    ? usage.iterations.map(it => hitungBagian(it.model || model, it))
    : [hitungBagian(model, usage)];
  const total = { token_masuk: 0, token_keluar: 0, token_cache_baca: 0, token_cache_tulis: 0, pencarian_web: 0, biaya_usd: 0, harga_diketahui: true };
  for (const b of bagian) {
    for (const k of ['token_masuk', 'token_keluar', 'token_cache_baca', 'token_cache_tulis', 'pencarian_web']) total[k] += b[k];
    if (b.biaya_usd == null) total.harga_diketahui = false; else total.biaya_usd += b.biaya_usd;
  }
  // Pencarian web di top-level dipakai bila iterasi tidak merincinya.
  if (!total.pencarian_web && usage.server_tool_use?.web_search_requests && bagian.length > 1) {
    total.pencarian_web = usage.server_tool_use.web_search_requests;
    total.biaya_usd += total.pencarian_web * HARGA_PENCARIAN_WEB;
  }
  return total;
}

module.exports = { HARGA, HARGA_PENCARIAN_WEB, hargaModel, hitungPemakaian };
