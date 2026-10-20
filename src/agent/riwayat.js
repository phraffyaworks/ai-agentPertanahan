// Riwayat percakapan per chat, disimpan di data/percakapan/<chat>.json.
// Riwayat hanya ditambah di bagian akhir (append-only): blok thinking Claude terikat pada isi
// percakapan sebelumnya, jadi giliran lama tidak boleh diubah atau dihapus.
const fs = require('fs');
const path = require('path');

function createRiwayat(dataDir) {
  const dir = path.join(dataDir, 'percakapan');
  fs.mkdirSync(dir, { recursive: true });
  const fileOf = chatId => path.join(dir, `${chatId}.json`);

  function load(chatId) {
    const file = fileOf(chatId);
    const messages = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).messages : [];
    const save = () => {
      fs.writeFileSync(`${file}.tmp`, JSON.stringify({ messages }));
      fs.renameSync(`${file}.tmp`, file);
    };
    // Bila bot berhenti saat alat sedang menunggu (mis. menunggu persetujuan), tutup alat itu
    // dengan hasil "dibatalkan" supaya percakapan tetap sah untuk dilanjutkan.
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant' && Array.isArray(last.content)) {
      const pending = last.content.filter(b => b.type === 'tool_use');
      if (pending.length) {
        messages.push({
          role: 'user',
          content: pending.map(b => ({
            type: 'tool_result', tool_use_id: b.id, is_error: true,
            content: 'Dibatalkan: bot dimulai ulang sebelum tindakan ini selesai. Tindakan belum dikerjakan.',
          })),
        });
        save();
      }
    }
    return {
      messages,
      push(msg) { messages.push(msg); save(); },
    };
  }

  // Memulai percakapan baru; riwayat lama disimpan dengan cap waktu.
  function reset(chatId) {
    const file = fileOf(chatId);
    if (fs.existsSync(file)) fs.renameSync(file, file.replace(/\.json$/, `.${Date.now()}.arsip.json`));
  }

  return { load, reset };
}

module.exports = { createRiwayat };
