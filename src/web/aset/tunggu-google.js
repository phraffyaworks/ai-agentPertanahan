// Halaman Hubungkan Google: memeriksa setiap 4 detik dan memuat ulang halaman begitu Google tersambung.
(function () {
  var t = setInterval(function () {
    fetch('/google/status', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.tersambung) { clearInterval(t); location.reload(); } })
      .catch(function () {});
  }, 4000);
})();
