// Membaca dan menulis nilai di file .env tanpa mengubah baris lain (komentar tetap utuh).
const fs = require('fs');

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

// Nilai yang sudah ada diganti di tempatnya; yang belum ada ditambahkan di akhir. File hanya bisa
// dibaca pemiliknya (chmod 600) karena berisi rahasia.
function setEnvValues(file, values, templateFile) {
  let isi = fs.existsSync(file) ? fs.readFileSync(file, 'utf8')
    : templateFile && fs.existsSync(templateFile) ? fs.readFileSync(templateFile, 'utf8') : '';
  for (const [k, v] of Object.entries(values)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    const line = `${k}=${v}`;
    isi = re.test(isi) ? isi.replace(re, () => line) : `${isi.replace(/\n?$/, '\n')}${line}\n`;
  }
  fs.writeFileSync(file, isi, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

module.exports = { readEnv, setEnvValues };
