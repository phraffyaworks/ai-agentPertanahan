// Server MCP "pertanahan" untuk Hermes Agent (stdio). Menyediakan alat bot Telegram kepada Hermes:
// Master Data, folder Drive, Telaahan, Notula, Nota Dinas, Surat Keluar, Gmail, dan Kalender.
// Pemasangan: docs/HERMES.md. Bot Telegram (src/index.js) tidak terpengaruh.
const path = require('path');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { buatAlatMcp, pengaturanAlat } = require('./alat');

const VERSI = require('../../package.json').version;
const INSTRUKSI = [
  'Alat untuk pekerjaan penanganan pengaduan pertanahan. Muat skill pertanahan-* yang sesuai sebelum memakainya.',
  'Baca berkas kiriman pengguna dengan baca_berkas (bukan terminal/OCR).',
  'Alat yang mengubah data atau mengirim sesuatu meminta persetujuan pengguna sendiri; jangan minta konfirmasi teks terpisah, dan bila ditolak jangan ulangi tanpa perubahan.',
  'Bila hasil alat berisi baris "MEDIA:<lokasi>", salin baris itu persis ke balasan supaya file terkirim.',
].join(' ');

const SKEMA_KOSONG = { type: 'object', properties: {} };

function buatServer({ alat, waktuTungguMs }) {
  const server = new Server({ name: 'pertanahan', version: VERSI }, { capabilities: { tools: {} }, instructions: INSTRUKSI });

  // Persetujuan lewat MCP elicitation: Hermes menampilkannya sebagai tombol persetujuan di Telegram.
  // Hanya "accept" yang dianggap setuju; tolak, batal, dan habis waktu berarti tidak dikerjakan.
  async function mintaPersetujuan(ringkasan) {
    if (!server.getClientCapabilities()?.elicitation) {
      throw new Error('Hermes tidak mendukung permintaan persetujuan (MCP elicitation), jadi tindakan ini tidak dijalankan. Perbarui Hermes (hermes update) dan pastikan elicitation tidak dimatikan di config.yaml.');
    }
    const r = await server.elicitInput({ message: `${ringkasan}\n\nSetujui tindakan ini?`, requestedSchema: SKEMA_KOSONG }, { timeout: waktuTungguMs });
    return { setuju: r.action === 'accept', catatan: r.action === 'cancel' ? 'tidak dijawab atau dibatalkan' : null };
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: alat.daftar() }));
  server.setRequestHandler(CallToolRequestSchema, async req => alat.panggil(req.params.name, req.params.arguments, mintaPersetujuan));
  return server;
}

async function main() {
  // Keluaran standar khusus protokol MCP; pesan lain ke stderr.
  console.log = (...a) => console.error(...a);
  const { loadConfig } = require('../config');
  const { createGoogle } = require('../google');
  const { createStore } = require('../state/store');
  const { createPembaca } = require('./bacaBerkas');

  const config = loadConfig(['google']);
  const google = createGoogle(config.google);
  const pengaturan = pengaturanAlat();
  // Data server ini (catatan kasus, salinan bacaan berkas) disimpan di folder Hermes milik pengguna yang
  // menjalankannya, terpisah dari data bot (data/kasus.json), supaya dua proses tidak saling menimpa.
  const dataDir = process.env.MCP_DATA_DIR || path.join(pengaturan.hermesHome, 'pertanahan');
  const ctxDasar = {
    google, drive: google.drive, sheets: google.sheets, store: createStore(dataDir), folderIndukId: config.google.folderIndukId,
  };
  const alat = buatAlatMcp({ ctxDasar, pembaca: createPembaca({ claude: config.claude }), pengaturan, cacheBacaan: path.join(dataDir, 'bacaan') });
  const server = buatServer({ alat, waktuTungguMs: pengaturan.waktuTungguMs });
  await server.connect(new StdioServerTransport());
  console.error(`Server MCP pertanahan berjalan (akses Google lewat ${google.mode}).`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { buatServer, INSTRUKSI };
