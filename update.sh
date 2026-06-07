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

# ── 3. Backend ────────────────────────────────────────────────
log "Backend : npm ci…"
(cd backend && npm ci --omit=dev=false) || err "npm ci backend a échoué"
log "Backend : prisma generate…"
(cd backend && npx prisma generate) || err "prisma generate a échoué"
log "Backend : prisma migrate deploy…"
(cd backend && npx prisma migrate deploy) || err "prisma migrate a échoué"
log "Backend : build…"
(cd backend && npm run build) || err "build backend a échoué"
ok "Backend prêt"

# ── 4. Frontend ───────────────────────────────────────────────
log "Frontend : npm ci…"
(cd frontend && npm ci) || err "npm ci frontend a échoué"
log "Frontend : build…"
(cd frontend && npm run build) || err "build frontend a échoué"
ok "Frontend prêt"

# ── 5. Restart (best effort) ──────────────────────────────────
log "Restart application…"
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart all && ok "pm2 restart OK"
elif command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet monespace 2>/dev/null; then
  systemctl restart monespace && ok "systemd restart OK"
else
  echo "⚠  Aucun gestionnaire détecté (pm2/systemd). Restart manuel requis."
fi

ok "Mise à jour terminée — ${AFTER_SHA:0:7}"
