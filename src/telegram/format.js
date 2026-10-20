// Mengubah Markdown sederhana dari Claude menjadi HTML Telegram, dan memecah pesan panjang.
const BATAS = 3800; // batas Telegram 4096 karakter, disisakan untuk tag HTML

const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function keHtml(md) {
  const blok = [];
  let t = md.replace(/```[\w-]*\n?([\s\S]*?)```/g, (_, code) => `\u0000${blok.push(`<pre>${escape(code.trimEnd())}</pre>`) - 1}\u0000`);
  t = escape(t)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>')
    .replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')
    .replace(/^\s*[-*]\s+/gm, '• ');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => blok[Number(i)]);
}

// Dipecah di batas paragraf, lalu baris, lalu paksa bila satu baris terlalu panjang.
function pecah(teks, batas = BATAS) {
  const hasil = [];
  let sisa = teks.trim();
  while (sisa.length > batas) {
    let i = sisa.lastIndexOf('\n\n', batas);
    if (i < batas / 2) i = sisa.lastIndexOf('\n', batas);
    if (i < batas / 2) i = batas;
    hasil.push(sisa.slice(0, i).trim());
    sisa = sisa.slice(i).trim();
  }
  if (sisa) hasil.push(sisa);
  return hasil;
}

module.exports = { keHtml, pecah, escape };
