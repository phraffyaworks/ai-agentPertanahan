// Akses Google Drive & Sheets lewat Web App Apps Script milik pengguna (apps-script/Kode.gs).
// Tidak memerlukan Client ID Google; izin tidak kedaluwarsa karena skrip berjalan atas nama pengguna.
const crypto = require('crypto');

const newSecret = () => crypto.randomBytes(32).toString('hex');
// Versi apps-script/Kode.gs yang dibutuhkan bot (Gmail dan Kalender mulai versi 2).
const VERSI_APPS_SCRIPT = 2;

function createAppsScriptClient({ url, secret }) {
  async function call(action, params = {}) {
    let res;
    try {
      // Apps Script menjawab POST dengan pengalihan (302) ke alamat hasil; fetch mengikutinya.
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, secret, ...params }),
        redirect: 'follow',
      });
    } catch (err) {
      throw new Error(`Tidak bisa menghubungi Apps Script: ${err.message}`);
    }
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Apps Script tidak menjawab dengan benar (HTTP ${res.status}). Pastikan alamat Web App benar dan "Who has access" = Anyone.`);
    }
    if (!data.ok) throw new Error(`Apps Script: ${data.error}`);
    return data.result;
  }
  return { call };
}

function createDriveViaAppsScript(client) {
  return {
    getFolder: id => client.call('driveGetFolder', { id }),
    findOrCreateFolder: (parentId, name) => client.call('driveFindOrCreateFolder', { parentId, name }),
    listNames: folderId => client.call('driveListNames', { folderId }),
    listChildren: folderId => client.call('driveListChildren', { folderId }),
    uploadFile: (folderId, name, buffer, mimeType) =>
      client.call('driveUpload', { folderId, name, mimeType, base64: buffer.toString('base64') }),
  };
}

function appsScriptSheetsBackend(client, spreadsheetId) {
  return {
    read: (sheet, startRow, endRow, numCols, mode) =>
      client.call('sheetRead', { spreadsheetId, sheet, startRow, endRow, numCols, mode }),
    append: async (sheet, values) => (await client.call('sheetAppend', { spreadsheetId, sheet, values })).rowNumber,
    setFormula: (sheet, row, col, formula) => client.call('sheetSetFormula', { spreadsheetId, sheet, row, col, formula }),
    setValue: (sheet, row, col, value) => client.call('sheetSetValue', { spreadsheetId, sheet, row, col, value }),
  };
}

function createGmailViaAppsScript(client) {
  return {
    search: (query, max) => client.call('gmailSearch', { query, max }),
    read: threadId => client.call('gmailRead', { threadId }),
    send: m => client.call('gmailSend', m),
    draft: m => client.call('gmailDraft', m),
    reply: (threadId, m) => client.call('gmailReply', { threadId, ...m }),
  };
}

function createCalendarViaAppsScript(client) {
  return {
    list: (start, end) => client.call('calList', { start, end }),
    create: e => client.call('calCreate', e),
    remove: eventId => client.call('calDelete', { eventId }),
  };
}

module.exports = {
  VERSI_APPS_SCRIPT, newSecret, createAppsScriptClient, createDriveViaAppsScript, appsScriptSheetsBackend,
  createGmailViaAppsScript, createCalendarViaAppsScript,
};
