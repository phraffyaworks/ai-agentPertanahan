const { Bot } = require('grammy');
const { processPengaduan, IntakeStop } = require('../pipeline/intake');
const { ExtractionError } = require('../ai/extract');
const { BANTUAN, laporanSelesai, laporanDuplikat } = require('./messages');

// Bot API Telegram hanya bisa mengunduh file sampai 20 MB.
const MAX_BYTES = 20 * 1024 * 1024;

// Antrean FIFO: PDF diproses satu per satu sesuai urutan kiriman.
function createQueue() {
  let tail = Promise.resolve();
  let waiting = 0;
  return {
    push(job) {
      waiting++;
      const position = waiting;
      tail = tail.then(job).catch(() => {}).finally(() => { waiting--; });
      return position;
    },
  };
}

function createBot(config, deps) {
  const bot = new Bot(config.telegram.token);
  const allowed = new Set(config.telegram.allowedUserIds);
  const queue = createQueue();

  // /id boleh dipakai siapa saja: dipakai saat penyiapan untuk mengetahui ID akun Telegram sendiri.
  bot.command('id', ctx => ctx.reply(`ID Telegram Anda: ${ctx.from.id}`));

  // Selain /id, bot hanya melayani akun yang terdaftar di TELEGRAM_ALLOWED_USER_IDS.
  bot.use(async (ctx, next) => {
    if (ctx.from && allowed.has(ctx.from.id)) return next();
    console.warn(`Ditolak: pesan dari ID ${ctx.from?.id}`);
    if (ctx.chat?.type === 'private') await ctx.reply('Maaf, bot ini hanya melayani akun yang terdaftar.');
  });

  bot.command(['start', 'bantuan'], ctx => ctx.reply(BANTUAN));

  bot.on('message:document', async ctx => {
    const doc = ctx.message.document;
    const isPdf = doc.mime_type === 'application/pdf' || /\.pdf$/i.test(doc.file_name || '');
    if (!isPdf) return ctx.reply('Yang diterima hanya file PDF.');
    if (doc.file_size > MAX_BYTES) {
      return ctx.reply('File lebih dari 20 MB, batas unduhan bot Telegram. Kecilkan ukuran PDF lalu kirim ulang.');
    }
    const replyTo = { reply_parameters: { message_id: ctx.message.message_id } };
    const pos = queue.push(() => handlePdf(ctx, doc, replyTo));
    await ctx.reply(pos > 1 ? `Diterima. Antrean ke-${pos}.` : 'Diterima. Sedang dibaca, mohon tunggu.', replyTo);
  });

  async function handlePdf(ctx, doc, replyTo) {
    try {
      const file = await ctx.api.getFile(doc.file_id);
      const res = await fetch(`https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`);
      if (!res.ok) throw new Error(`Gagal mengunduh file dari Telegram (HTTP ${res.status}).`);
      const pdfBuffer = Buffer.from(await res.arrayBuffer());

      const hasil = await processPengaduan({ pdfBuffer, namaFileAsli: doc.file_name }, deps);
      if (hasil.status === 'duplikat') return await ctx.reply(laporanDuplikat(hasil), replyTo);

      const sent = await ctx.reply(laporanSelesai(hasil), replyTo);
      deps.store.linkMessage(ctx.chat.id, sent.message_id, hasil.kasus.id);
      console.log(`Kasus ${hasil.kasus.id} tercatat. Token: masuk ${hasil.usage?.input_tokens}, keluar ${hasil.usage?.output_tokens}`);
    } catch (err) {
      const known = err instanceof IntakeStop || err instanceof ExtractionError;
      console.error('Gagal memproses PDF:', err);
      await ctx.reply(`Gagal memproses ${doc.file_name || 'PDF'}: ${known ? err.message : 'kesalahan teknis, lihat log server.'}`, replyTo)
        .catch(() => {});
    }
  }

  bot.on('message:text', ctx => ctx.reply('Untuk saat ini bot baru menerima PDF pengaduan. Draf Telaahan dan revisi lewat chat menyusul di tahap berikutnya.'));

  bot.catch(err => console.error('Error bot:', err.error));
  return bot;
}

module.exports = { createBot, createQueue };
