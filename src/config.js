// Membaca pengaturan dari file .env. Nilai rahasia (token, kunci API) hanya boleh ada di .env.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

// ID bawaan diambil dari Drive pengguna (folder "Otomasi" dan spreadsheet "Database Raffy").
const DEFAULTS = {
  DRIVE_FOLDER_INDUK_ID: '1oZlzZd7kGSbr556ido6B6pJ_1eiVScZd',
  SPREADSHEET_ID: '16oEsge3_1bmdrMf_j_5KDDYL2_DilODbuLaILg0bYJs',
  SHEET_MASTER: 'Master Data',
  CLAUDE_MODEL: 'claude-sonnet-5-5',
  CLAUDE_EFFORT: 'medium',
  DATA_DIR: path.join(__dirname, '..', 'data'),
};

const GROUPS = {
  // TELEGRAM_ALLOWED_USER_IDS boleh kosong saat penyiapan pertama: bot hanya melayani /id.
  telegram: ['TELEGRAM_BOT_TOKEN'],
  // Akses Google lewat Apps Script (bawaan). OAuth Client ID hanya dipakai bila APPS_SCRIPT_URL kosong
  // dan GOOGLE_CLIENT_ID diisi.
  google: () => (!get('APPS_SCRIPT_URL') && get('GOOGLE_CLIENT_ID')
    ? ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN']
    : ['APPS_SCRIPT_URL', 'APPS_SCRIPT_SECRET']),
  googleClient: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  claude: ['ANTHROPIC_API_KEY'],
};

function get(name) {
  const v = process.env[name];
  return v !== undefined && v.trim() !== '' ? v.trim() : DEFAULTS[name];
}

// groups: daftar kelompok pengaturan yang wajib ada, mis. ['telegram', 'google'].
function loadConfig(groups = ['telegram', 'google', 'claude']) {
  const missing = groups.flatMap(g => (typeof GROUPS[g] === 'function' ? GROUPS[g]() : GROUPS[g])).filter(n => !get(n));
  if (missing.length) {
    throw new Error(`Pengaturan belum diisi di file .env: ${[...new Set(missing)].join(', ')}. Jalankan penyiapan: su - agen -c "cd ai-agentPertanahan && npm run setup"`);
  }
  const allowed = (get('TELEGRAM_ALLOWED_USER_IDS') || '')
    .split(',').map(s => s.trim()).filter(Boolean).map(Number);
  return {
    telegram: { token: get('TELEGRAM_BOT_TOKEN'), allowedUserIds: allowed },
    google: {
      appsScriptUrl: get('APPS_SCRIPT_URL'),
      appsScriptSecret: get('APPS_SCRIPT_SECRET'),
      clientId: get('GOOGLE_CLIENT_ID'),
      clientSecret: get('GOOGLE_CLIENT_SECRET'),
      refreshToken: get('GOOGLE_REFRESH_TOKEN'),
      folderIndukId: get('DRIVE_FOLDER_INDUK_ID'),
      spreadsheetId: get('SPREADSHEET_ID'),
      sheetMaster: get('SHEET_MASTER'),
    },
    claude: { apiKey: get('ANTHROPIC_API_KEY'), model: get('CLAUDE_MODEL'), effort: get('CLAUDE_EFFORT') },
    dataDir: get('DATA_DIR'),
  };
}

module.exports = { loadConfig };
