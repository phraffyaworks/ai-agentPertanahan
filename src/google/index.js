// Memilih cara akses Google: Apps Script (bila APPS_SCRIPT_URL diisi) atau OAuth Client ID.
const { createAuthorizedClient } = require('./auth');
const { createDrive } = require('./drive');
const { createSheets, createSheetsService } = require('./sheets');
const {
  createAppsScriptClient, createDriveViaAppsScript, appsScriptSheetsBackend,
  createGmailViaAppsScript, createCalendarViaAppsScript,
} = require('./appsscript');

// Gmail dan Kalender hanya tersedia lewat Apps Script.
const tidakTersedia = nama => new Proxy({}, { get: () => async () => { throw new Error(`${nama} hanya tersedia bila akses Google lewat Apps Script.`); } });

function createGoogle(google) {
  if (google.appsScriptUrl) {
    const client = createAppsScriptClient({ url: google.appsScriptUrl, secret: google.appsScriptSecret });
    return {
      mode: 'Apps Script',
      client,
      drive: createDriveViaAppsScript(client),
      sheets: createSheetsService(appsScriptSheetsBackend(client, google.spreadsheetId), google),
      gmail: createGmailViaAppsScript(client),
      calendar: createCalendarViaAppsScript(client),
    };
  }
  const auth = createAuthorizedClient(google);
  return {
    mode: 'OAuth', drive: createDrive(auth), sheets: createSheets(auth, google),
    gmail: tidakTersedia('Gmail'), calendar: tidakTersedia('Kalender'),
  };
}

module.exports = { createGoogle };
