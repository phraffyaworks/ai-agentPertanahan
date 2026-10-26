// Skrip halaman Chat: mengirim pesan dan berkas, menerima balasan agen secara langsung (Server-Sent Events),
// serta tombol Setujui/Tolak. HTML setiap pesan dibuat dan di-escape di server.
(function () {
  var wadah = document.getElementById('percakapan');
  var form = document.getElementById('form-kirim');
  if (!wadah || !form) return;
  var csrf = form.getAttribute('data-csrf');
  var status = document.getElementById('status-agen');
  var teks = document.getElementById('teks');
  var berkas = document.getElementById('berkas');
  var tombol = document.getElementById('tombol-kirim');
  var terakhir = Number(wadah.getAttribute('data-terakhir')) || 0;
  var sibuk = status.textContent !== '';

  function tampilStatus(t, salah) { status.textContent = t; status.className = 'status-agen' + (salah ? ' pesan-salah' : ''); }
  function turun() { window.scrollTo(0, document.body.scrollHeight); }
  function tambah(html) {
    var kosong = document.getElementById('kosong');
    if (kosong) kosong.remove();
    wadah.insertAdjacentHTML('beforeend', html);
    turun();
  }

  var es = new EventSource('/chat/aliran?sejak=' + terakhir);
  es.onmessage = function (ev) {
    var p = JSON.parse(ev.data);
    if (p.jenis === 'status') { sibuk = p.sibuk; tampilStatus(p.sibuk ? 'Agen sedang bekerja…' : ''); return; }
    if (p.id) { if (p.id <= terakhir) return; terakhir = p.id; }
    if (p.jenis === 'ganti') { var el = document.getElementById(p.target); if (el) el.outerHTML = p.html; return; }
    if (p.jenis === 'tambah' && p.html) tambah(p.html);
  };
  es.onerror = function () { if (!sibuk) tampilStatus('Sambungan terputus, menyambung ulang…'); };
  es.onopen = function () { if (!sibuk) tampilStatus(''); };

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!teks.value.trim() && !berkas.files.length) return;
    var fd = new FormData();
    fd.append('teks', teks.value);
    for (var i = 0; i < berkas.files.length; i++) fd.append('berkas', berkas.files[i]);
    tombol.disabled = true;
    tombol.textContent = 'Mengirim…';
    fetch('/chat/pesan', { method: 'POST', body: fd, headers: { 'x-csrf-token': csrf }, credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.ok) throw new Error(j.pesan || ('Gagal mengirim (HTTP ' + r.status + '). Muat ulang halaman, lalu coba lagi.')); }); })
      .then(function () { teks.value = ''; berkas.value = ''; })
      .catch(function (err) { tampilStatus(err.message, true); })
      .then(function () { tombol.disabled = false; tombol.textContent = 'Kirim'; teks.focus(); });
  });

  teks.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); form.requestSubmit(); }
  });

  wadah.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-setuju]');
    if (!b) return;
    var kartu = b.closest('.kartu-setuju');
    var semua = kartu.querySelectorAll('button');
    for (var i = 0; i < semua.length; i++) semua[i].disabled = true;
    fetch('/chat/setuju/' + b.getAttribute('data-id'), {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ setuju: b.getAttribute('data-setuju') === '1' }),
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) { tampilStatus('Persetujuan ini sudah tidak berlaku. Halaman dimuat ulang.', true); setTimeout(function () { location.reload(); }, 1500); }
    }).catch(function () {
      tampilStatus('Gagal mengirim jawaban. Periksa koneksi, lalu coba lagi.', true);
      for (var i = 0; i < semua.length; i++) semua[i].disabled = false;
    });
  });

  turun();
})();
