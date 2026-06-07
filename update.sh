#!/usr/bin/env bash
# ============================================================
#  update.sh — Mise à jour MonEspace depuis GitHub
#  Usage : ./update.sh
#  Doit être exécuté depuis la racine du projet.
#  Lancé par POST /api/admin/system/update (admin only).
# ============================================================
set -euo pipefail

cd "$(dirname "$0")"

LOCK_FILE="/tmp/monespace-update.lock"
LOG_DIR="logs"
TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
LOG_FILE="${LOG_DIR}/update_${TIMESTAMP}.log"

mkdir -p "$LOG_DIR"

# ── Lock ──────────────────────────────────────────────────────
if [ -e "$LOCK_FILE" ]; then
  echo "✗ Une mise à jour est déjà en cours (lock: $LOCK_FILE)" >&2
  exit 1
fi
echo "$$" > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# Redirige tout vers le log (et garde stdout pour le job tracker)
exec > >(tee -a "$LOG_FILE") 2>&1

GRN='\033[0;32m'; YLW='\033[1;33m'; RED='\033[0;31m'; RST='\033[0m'
log() { printf "${YLW}▶${RST}  %s\n" "$*"; }
ok()  { printf "${GRN}✓${RST}  %s\n" "$*"; }
err() { printf "${RED}✗${RST}  %s\n" "$*" >&2; exit 1; }

echo "==========================================="
echo "  MonEspace — Mise à jour $TIMESTAMP"
echo "==========================================="

# ── 1. Backup DB (best effort) ────────────────────────────────
if [ -x "./backup.sh" ]; then
  log "Backup DB pré-update…"
  if ./backup.sh; then ok "Backup OK"; else echo "⚠  Backup échoué, on continue"; fi
else
  echo "⚠  backup.sh introuvable, skip"
fi

# ── 2. Git fetch + reset ──────────────────────────────────────
BRANCH="${GITHUB_BRANCH:-master}"
log "Git fetch origin/$BRANCH…"
git fetch origin "$BRANCH" || err "git fetch a échoué"
BEFORE_SHA="$(git rev-parse HEAD)"
git reset --hard "origin/$BRANCH" || err "git reset a échoué"
AFTER_SHA="$(git rev-parse HEAD)"
ok "Checkout ${BEFORE_SHA:0:7} → ${AFTER_SHA:0:7}"

# Détecte l'URL publique pour le build frontend (VITE_API_URL).
# Si l'admin a positionné SERVER_HOST en env (ou que server-start.sh tourne déjà),
# on s'aligne dessus pour ne pas casser le login après MAJ.
SERVER_HOST="${SERVER_HOST:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
SERVER_HOST="${SERVER_HOST:-localhost}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
VITE_API_URL_VAL="http://${SERVER_HOST}:${BACKEND_PORT}/api"
log "Build frontend ciblera : $VITE_API_URL_VAL"

# ── 3. Backend ────────────────────────────────────────────────
log "Backend : install (include dev)…"
(cd backend && NODE_ENV= npm install --include=dev --production=false --no-audit --no-fund) \
  || err "npm install backend a échoué"
log "Backend : prisma generate…"
(cd backend && npx prisma generate) || err "prisma generate a échoué"
log "Backend : prisma migrate deploy…"
(cd backend && npx prisma migrate deploy) || err "prisma migrate a échoué"
log "Backend : build…"
(cd backend && npm run build) || err "build backend a échoué"
ok "Backend prêt"

# ── 4. Frontend ───────────────────────────────────────────────
log "Frontend : install (include dev)…"
(cd frontend && NODE_ENV= npm install --include=dev --production=false --no-audit --no-fund) \
  || err "npm install frontend a échoué"
log "Frontend : build ($VITE_API_URL_VAL)…"
(cd frontend && VITE_API_URL="$VITE_API_URL_VAL" npm run build) \
  || err "build frontend a échoué"
ok "Frontend prêt"

# ── 5. Restart (best effort) ──────────────────────────────────
log "Restart application…"
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet monespace 2>/dev/null; then
  systemctl restart monespace && ok "systemd restart OK"
elif command -v pm2 >/dev/null 2>&1; then
  pm2 restart all && ok "pm2 restart OK"
elif [ -x ./server-start.sh ]; then
  # Stratégie pour install nohup-based (server-start.sh) :
  # on relance via le script qui gère les PIDs et le rebuild.
  SERVER_HOST="$SERVER_HOST" BACKEND_PORT="$BACKEND_PORT" \
    bash ./server-start.sh restart && ok "server-start.sh restart OK"
else
  echo "⚠  Aucun gestionnaire détecté. Restart manuel requis."
fi

ok "Mise à jour terminée — ${AFTER_SHA:0:7}"
