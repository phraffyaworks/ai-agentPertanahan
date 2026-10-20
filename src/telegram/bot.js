// Bot Telegram sebagai antarmuka asisten. Semua pesan (teks, PDF, foto) diteruskan ke asisten;
// tindakan yang mengubah data menunggu tombol Setujui/Tolak.
const { Bot, InlineKeyboard, InputFile } = require('grammy');
const { keHtml, pecah, escape } = require('./format');

// Bot API Telegram hanya bisa mengunduh file sampai 20 MB.
const MAX_BYTES = 20 * 1024 * 1024;
// Pesan yang datang hampir bersamaan (mis. beberapa file atau file + keterangan) digabung jadi satu giliran.
const JEDA_GABUNG_MS = 1500;

const BANTUAN = [
  'Saya asisten pribadi Anda. Ajak saya bicara seperti biasa, misalnya:',
  '• kirim PDF pengaduan baru untuk dicatat',
  '• "kasus mana yang masih Menunggu?"',
  '• "buatkan draf Telaahan untuk PT ..."',
  '• "cek email yang belum dibaca"',
  '• "jadwalkan rapat besok jam 9 sampai 10"',
  '',
  'Setiap tindakan yang mengubah data atau mengirim sesuatu akan saya mintakan persetujuan dengan tombol.',
  '',
  'Perintah: /baru (mulai percakapan baru), /id, /bantuan',
].join('\n');

function createBot(config, { agen, riwayat, berkas, ctxAlat }) {
  const bot = new Bot(config.telegram.token);
  const allowed = new Set(config.telegram.allowedUserIds);
  const chats = new Map(); // chatId -> { antrean: [], timer, berjalan, menunggu: {resolve} }
  const persetujuan = new Map(); // id -> { resolve, chatId }
  let seqSetuju = 0;

  const state = chatId => {
    if (!chats.has(chatId)) chats.set(chatId, { antrean: [], timer: null, berjalan: false, menunggu: null });
    return chats.get(chatId);
  };

  async function kirimTeks(chatId, teks) {
    for (const bagian of pecah(teks)) {
      try {
        await bot.api.sendMessage(chatId, keHtml(bagian), { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
      } catch {
        await bot.api.sendMessage(chatId, bagian, { link_preview_options: { is_disabled: true } });
      }
    }
  }

  function mintaPersetujuan(chatId, ringkasan) {
    const id = String(++seqSetuju);
    const s = state(chatId);
    return new Promise(resolve => {
      const selesai = jawab => { persetujuan.delete(id); s.menunggu = null; resolve(jawab); };
      persetujuan.set(id, { selesai, chatId });
      s.menunggu = { id, selesai };
      const tombol = new InlineKeyboard().text('✅ Setujui', `ok:${id}`).text('❌ Tolak', `no:${id}`);
      bot.api.sendMessage(chatId, `<b>Persetujuan diperlukan</b>\n${escape(ringkasan)}`, { parse_mode: 'HTML', reply_markup: tombol })
        .catch(err => { console.error('Gagal mengirim permintaan persetujuan:', err); selesai({ setuju: false, catatan: 'gagal menampilkan tombol persetujuan' }); });
    });
  }

  async function prosesAntrean(chatId) {
    const s = state(chatId);
    if (s.berjalan || !s.antrean.length) return;
    s.berjalan = true;
    const isi = s.antrean.splice(0).flat();
    const mengetik = setInterval(() => bot.api.sendChatAction(chatId, 'typing').catch(() => {}), 4500);
    bot.api.sendChatAction(chatId, 'typing').catch(() => {});
    try {
      await agen.giliran(chatId, isi, {
        kirimTeks: t => kirimTeks(chatId, t),
        kirimDokumen: (buf, nama, caption) => bot.api.sendDocument(chatId, new InputFile(buf, nama), { caption }),
        mintaPersetujuan: r => mintaPersetujuan(chatId, r),
      }, ctxAlat);
    } catch (err) {
      console.error('Gagal memproses giliran:', err);
      await kirimTeks(chatId, `Maaf, terjadi kesalahan: ${err.message || err}`).catch(() => {});
    } finally {
      clearInterval(mengetik);
      s.berjalan = false;
      if (s.antrean.length) prosesAntrean(chatId);
    }
  }

  // Menerima satu potongan isi pesan. Bila asisten sedang menunggu persetujuan, pesan teks
  // dianggap jawaban "tidak" beserta catatannya (mis. "ganti nama foldernya jadi ...").
  function terima(chatId, potongan, teksUntukPersetujuan) {
    const s = state(chatId);
    if (s.menunggu) {
      s.menunggu.selesai({ setuju: false, catatan: teksUntukPersetujuan || 'pengguna mengirim pesan baru' });
      if (teksUntukPersetujuan) return; // teksnya sudah disampaikan lewat hasil alat
    }
    s.antrean.push(potongan);
    clearTimeout(s.timer);
    s.timer = setTimeout(() => prosesAntrean(chatId), JEDA_GABUNG_MS);
  }

  const kutipan = msg => {
    const r = msg.reply_to_message;
    const t = r && (r.text || r.caption);
    return t ? [{ type: 'text', text: `(Membalas pesan: «${t.slice(0, 600)}»)` }] : [];
  };

  // /id boleh dipakai siapa saja: dipakai saat penyiapan untuk mengetahui ID akun Telegram sendiri.
  bot.command('id', ctx => ctx.reply(`ID Telegram Anda: ${ctx.from.id}`));

  // Selain /id, bot hanya melayani akun yang terdaftar di TELEGRAM_ALLOWED_USER_IDS.
  bot.use(async (ctx, next) => {
    if (ctx.from && allowed.has(ctx.from.id)) return next();
    console.warn(`Ditolak: pesan dari ID ${ctx.from?.id}`);
    if (ctx.chat?.type === 'private') await ctx.reply('Maaf, bot ini hanya melayani akun yang terdaftar.');
  });

  bot.command(['start', 'bantuan'], ctx => ctx.reply(BANTUAN));
  bot.command('baru', async ctx => {
    const s = state(ctx.chat.id);
    if (s.berjalan) return ctx.reply('Tunggu sampai proses saat ini selesai, lalu kirim /baru lagi.');
    riwayat.reset(ctx.chat.id);
    await ctx.reply('Percakapan baru dimulai. Riwayat lama disimpan sebagai arsip.');
  });

  bot.on('callback_query:data', async ctx => {
    const [aksi, id] = ctx.callbackQuery.data.split(':');
    const p = persetujuan.get(id);
    if (!p) return ctx.answerCallbackQuery({ text: 'Permintaan ini sudah tidak berlaku.' });
    const setuju = aksi === 'ok';
    p.selesai({ setuju });
    await ctx.answerCallbackQuery({ text: setuju ? 'Disetujui' : 'Ditolak' });
    const asli = ctx.callbackQuery.message?.text || '';
    await ctx.editMessageText(`${escape(asli)}\n\n<b>${setuju ? '✅ Disetujui' : '❌ Ditolak'}</b>`, { parse_mode: 'HTML' }).catch(() => {});
  });

  bot.on('message:text', ctx => {
    if (ctx.message.text.startsWith('/')) return ctx.reply('Perintah tidak dikenal. Ketik /bantuan.');
    const teks = ctx.message.text;
    terima(ctx.chat.id, [...kutipan(ctx.message), { type: 'text', text: teks }], teks);
  });

  async function terimaFile(ctx, fileId, nama, mime, ukuran) {
    if (ukuran > MAX_BYTES) {
      return ctx.reply('File lebih dari 20 MB, batas unduhan bot Telegram. Kecilkan ukurannya lalu kirim ulang, atau simpan langsung ke Drive.');
    }
    try {
      const file = await ctx.api.getFile(fileId);
      const res = await fetch(`https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const item = await berkas.simpan(Buffer.from(await res.arrayBuffer()), nama, mime);
      const caption = ctx.message.caption ? [{ type: 'text', text: ctx.message.caption }] : [];
      terima(ctx.chat.id, [...kutipan(ctx.message), ...berkas.blokKonten(item), ...caption], null);
    } catch (err) {
      console.error('Gagal menerima file:', err);
      await ctx.reply(`Gagal menerima file ${nama}: ${err.message}`);
    }
  }

  bot.on('message:document', ctx => {
    const d = ctx.message.document;
    return terimaFile(ctx, d.file_id, d.file_name || 'berkas', d.mime_type || 'application/octet-stream', d.file_size || 0);
  });
  bot.on('message:photo', ctx => {
    const p = ctx.message.photo[ctx.message.photo.length - 1]; // resolusi terbesar
    return terimaFile(ctx, p.file_id, `foto_${ctx.message.message_id}.jpg`, 'image/jpeg', p.file_size || 0);
  });
  bot.on('message', ctx => ctx.reply('Jenis pesan ini belum bisa saya baca. Kirim teks, PDF, atau foto.'));

  bot.catch(err => console.error('Error bot:', err.error));
  return bot;
}

module.exports = { createBot };
