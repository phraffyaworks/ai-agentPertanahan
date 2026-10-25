#!/usr/bin/env bash
# Pemasangan dashboard web (versi 2) di VPS Ubuntu, dijalankan sebagai root di Browser terminal hPanel:
#   bash <(curl -fsSL https://raw.githubusercontent.com/phraffyaworks/ai-agentPertanahan/v2-dashboard/deploy/pasang-dashboard.sh)
# Bot versi 1 (layanan agen-pertanahan) tidak disentuh. Aman dijalankan ulang untuk memperbarui kode atau pengaturan.
set -euo pipefail

REPO="${REPO:-https://github.com/phraffyaworks/ai-agentPertanahan.git}"
CABANG="${CABANG:-v2-dashboard}"
USER_BOT=agen
APP_DIR="/home/${USER_BOT}/agen-dashboard"
SERVICE=agen-dashboard

langkah() { echo; echo "=== $* ==="; }

[ "$(id -u)" -eq 0 ] || { echo "Jalankan sebagai root."; exit 1; }

langkah "1/7 Memasang paket dasar"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q git curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

langkah "2/7 Memastikan Node.js 22"
if ! command -v node >/dev/null || [ "$(node -v | sed 's/^v//; s/\..*//')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi
node --version

langkah "3/7 Memastikan pengguna '${USER_BOT}'"
id "${USER_BOT}" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "${USER_BOT}"

langkah "4/7 Mengambil kode dashboard (cabang ${CABANG})"
if [ -d "${APP_DIR}/.git" ]; then
  su - "${USER_BOT}" -c "cd '${APP_DIR}' && git fetch -q origin '${CABANG}' && git checkout -q '${CABANG}' && git merge -q --ff-only 'origin/${CABANG}'"
else
  su - "${USER_BOT}" -c "git clone -q --branch '${CABANG}' '${REPO}' '${APP_DIR}'"
fi
su - "${USER_BOT}" -c "cd '${APP_DIR}' && npm ci --omit=dev --no-audit --no-fund"
su - "${USER_BOT}" -c "cd '${APP_DIR}' && git log --oneline -1"

langkah "5/7 Pengaturan dashboard"
su - "${USER_BOT}" -c "cd '${APP_DIR}' && node scripts/setup-dashboard.js"
DOMAIN="$(grep -E '^WEB_BASE_URL=' "${APP_DIR}/.env" | sed 's#^WEB_BASE_URL=https://##')"
PORT="$(grep -E '^WEB_PORT=' "${APP_DIR}/.env" | cut -d= -f2)"
[ -n "${DOMAIN}" ] || { echo "WEB_BASE_URL belum terisi."; exit 1; }

langkah "6/7 Memasang Caddy (HTTPS otomatis) untuk ${DOMAIN}"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi
mkdir -p /etc/caddy/situs
cat > /etc/caddy/situs/agen-dashboard.caddy <<EOF
${DOMAIN} {
	encode zstd gzip
	reverse_proxy 127.0.0.1:${PORT}
}
EOF
# Caddyfile bawaan paket (halaman contoh di port 80) diganti; Caddyfile lain cukup ditambah baris import.
if grep -q '/usr/share/caddy' /etc/caddy/Caddyfile 2>/dev/null; then
  cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bawaan-$(date +%Y%m%d%H%M%S)"
  echo 'import /etc/caddy/situs/*.caddy' > /etc/caddy/Caddyfile
elif ! grep -q 'import /etc/caddy/situs/\*.caddy' /etc/caddy/Caddyfile 2>/dev/null; then
  echo 'import /etc/caddy/situs/*.caddy' >> /etc/caddy/Caddyfile
fi
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null && echo "Firewall UFW: port 80 dan 443 dibuka."
fi
systemctl enable --now caddy >/dev/null
systemctl reload caddy

langkah "7/7 Menjalankan dashboard sebagai layanan"
cp "${APP_DIR}/deploy/${SERVICE}.service" "/etc/systemd/system/${SERVICE}.service"
systemctl daemon-reload
systemctl enable "${SERVICE}" >/dev/null
systemctl restart "${SERVICE}"
sleep 3
systemctl --no-pager status "${SERVICE}" | head -n 3
if curl -fsS --max-time 10 "http://127.0.0.1:${PORT}/sehat" >/dev/null; then echo "Dashboard menjawab di server."; else echo "PERINGATAN: dashboard belum menjawab. Lihat log: journalctl -u ${SERVICE} -n 50"; fi
echo "Memeriksa HTTPS (sertifikat bisa butuh hingga 1 menit)..."
for i in 1 2 3 4 5 6; do
  if curl -fsS --max-time 10 "https://${DOMAIN}/sehat" >/dev/null 2>&1; then echo "HTTPS aktif: https://${DOMAIN}"; break; fi
  [ "$i" -eq 6 ] && echo "PERINGATAN: https://${DOMAIN} belum bisa dibuka. Pastikan DNS sudah mengarah ke VPS dan port 80/443 tidak diblokir firewall hPanel. Log: journalctl -u caddy -n 50"
  sleep 10
done

# Membuat akun super admin bila belum ada (skrip berhenti sendiri bila sudah ada).
echo
su - "${USER_BOT}" -c "cd '${APP_DIR}' && npm run --silent buat-admin"

echo
echo "Selesai. Buka https://${DOMAIN} di browser, lalu masuk dengan akun super admin."
echo "Bot versi 1 tetap berjalan seperti biasa (layanan agen-pertanahan)."
echo "Log dashboard: journalctl -u ${SERVICE} -f"
