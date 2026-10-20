// Memilih cara akses Google: Apps Script (bila APPS_SCRIPT_URL diisi) atau OAuth Client ID.
const { createAuthorizedClient } = require('./auth');
const { createDrive } = require('./drive');
const { createSheets, createSheetsService } = require('./sheets');
const { createAppsScriptClient, createDriveViaAppsScript, appsScriptSheetsBackend } = require('./appsscript');

function createGoogle(google) {
  if (google.appsScriptUrl) {
    const client = createAppsScriptClient({ url: google.appsScriptUrl, secret: google.appsScriptSecret });
    return {
      mode: 'Apps Script',
      client,
      drive: createDriveViaAppsScript(client),
      sheets: createSheetsService(appsScriptSheetsBackend(client, google.spreadsheetId), google),
    };
  }
  const auth = createAuthorizedClient(google);
  return { mode: 'OAuth', drive: createDrive(auth), sheets: createSheets(auth, google) };
}

module.exports = { createGoogle };
