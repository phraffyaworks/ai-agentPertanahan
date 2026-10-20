// Login Google memakai OAuth akun pengguna sendiri (bukan service account), karena folder dan
// spreadsheet ada di Drive pribadi pengguna. Refresh token didapat sekali lewat
// `npm run authorize-google`.
const { OAuth2Client } = require('google-auth-library');

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
];

function createOAuthClient({ clientId, clientSecret, redirectUri }) {
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

function createAuthorizedClient(google) {
  const client = createOAuthClient(google);
  client.setCredentials({ refresh_token: google.refreshToken });
  return client;
}

module.exports = { SCOPES, createOAuthClient, createAuthorizedClient };
