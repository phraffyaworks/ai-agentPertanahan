// Penyimpanan status kasus di file JSON lokal (data/kasus.json). Cukup untuk satu pengguna.
// Ditulis ke file sementara lalu di-rename agar file tidak rusak bila proses terhenti di tengah.
const fs = require('fs');
const path = require('path');

function createStore(dataDir) {
  const file = path.join(dataDir, 'kasus.json');
  fs.mkdirSync(dataDir, { recursive: true });
  let state = { cases: {} };
  if (fs.existsSync(file)) state = JSON.parse(fs.readFileSync(file, 'utf8'));

  function save() {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, file);
  }

  function newCaseId(now = new Date()) {
    const p = n => String(n).padStart(2, '0');
    const base = `K-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
    let id = base;
    for (let i = 2; state.cases[id]; i++) id = `${base}-${i}`;
    return id;
  }

  function putCase(c) {
    state.cases[c.id] = { ...state.cases[c.id], ...c, diperbarui: new Date().toISOString() };
    save();
    return state.cases[c.id];
  }

  const getCase = id => state.cases[id] || null;

  return { newCaseId, putCase, getCase };
}

module.exports = { createStore };
