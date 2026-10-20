const { Readable } = require('stream');
const { drive: makeDrive } = require('@googleapis/drive');

const FOLDER_MIME = 'application/vnd.google-apps.folder';
// Nilai string di query Drive diapit petik tunggal; petik dan garis miring terbalik harus di-escape.
const q = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function createDrive(auth) {
  const api = makeDrive({ version: 'v3', auth });

  async function list(query, fields = 'files(id, name, mimeType, webViewLink)') {
    const files = [];
    let pageToken;
    do {
      const res = await api.files.list({ q: query, fields: `nextPageToken, ${fields}`, pageSize: 1000, pageToken });
      files.push(...res.data.files);
      pageToken = res.data.nextPageToken;
    } while (pageToken);
    return files;
  }

  async function getFolder(id) {
    const res = await api.files.get({ fileId: id, fields: 'id, name, mimeType, webViewLink, trashed' });
    return res.data;
  }

  async function findFolder(parentId, name) {
    const found = await list(`${q(parentId)} in parents and name = ${q(name)} and mimeType = '${FOLDER_MIME}' and trashed = false`);
    return found[0] || null;
  }

  // Pakai folder yang sudah ada bila namanya sama; buat baru hanya bila belum ada.
  async function findOrCreateFolder(parentId, name) {
    const existing = await findFolder(parentId, name);
    if (existing) return { ...existing, created: false };
    const res = await api.files.create({
      requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
      fields: 'id, name, webViewLink',
    });
    return { ...res.data, created: true };
  }

  async function listNames(folderId) {
    const files = await list(`${q(folderId)} in parents and trashed = false`, 'files(name)');
    return files.map(f => f.name);
  }

  async function uploadFile(folderId, name, buffer, mimeType) {
    const res = await api.files.create({
      requestBody: { name, parents: [folderId] },
      media: { mimeType, body: Readable.from(buffer) },
      fields: 'id, name, webViewLink',
    });
    return res.data;
  }

  return { getFolder, findFolder, findOrCreateFolder, listNames, uploadFile };
}

module.exports = { createDrive };
