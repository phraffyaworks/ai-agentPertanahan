#!/usr/bin/env bash
# Pemasangan otomatis di VPS Ubuntu, dijalankan sebagai root di Browser terminal hPanel:
#   bash <(curl -fsSL https://raw.githubusercontent.com/phraffyaworks/ai-agentPertanahan/main/deploy/pasang-vps.sh)
# Aman dijalankan ulang: bila sudah terpasang, kode diperbarui dan layanan dinyalakan ulang.
set -euo pipefail

REPO="${REPO:-https://github.com/phraffyaworks/ai-agentPertanahan.git}"
USER_BOT=agen
APP_DIR="/home/${USER_BOT}/ai-agentPertanahan"
SERVICE=agen-pertanahan

langkah() { echo; echo "=== $* ==="; }

[ "$(id -u)" -eq 0 ] || { echo "Jalankan sebagai root."; exit 1; }

langkah "1/6 Memperbarui server"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -y -q
apt-get install -y -q git curl ca-certificates

langkah "2/6 Memasang Node.js 22"
if ! command -v node >/dev/null || [ "$(node -v | sed 's/^v//; s/\..*//')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi
node --version

langkah "3/6 Membuat pengguna '${USER_BOT}'"
id "${USER_BOT}" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "${USER_BOT}"

langkah "4/6 Mengambil kode"
if [ -d "${APP_DIR}/.git" ]; then
  su - "${USER_BOT}" -c "cd '${APP_DIR}' && git pull --ff-only"
else
  su - "${USER_BOT}" -c "git clone '${REPO}' '${APP_DIR}'"
fi
su - "${USER_BOT}" -c "cd '${APP_DIR}' && npm ci --omit=dev"

langkah "5/6 Penyiapan akun (token dan kunci)"
if systemctl is-active --quiet "${SERVICE}"; then systemctl stop "${SERVICE}"; fi
su - "${USER_BOT}" -c "cd '${APP_DIR}' && npm run setup"

langkah "6/6 Menjalankan bot sebagai layanan"
cp "${APP_DIR}/deploy/${SERVICE}.service" "/etc/systemd/system/${SERVICE}.service"
systemctl daemon-reload
systemctl enable --now "${SERVICE}"
sleep 3
systemctl --no-pager status "${SERVICE}" | head -n 5

echo
echo "Selesai. Kirim satu PDF pengaduan ke bot Anda untuk mencoba."
echo "Melihat log: journalctl -u ${SERVICE} -f"
