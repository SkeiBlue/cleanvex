#!/usr/bin/env bash
# ============================================================
#  backup.sh — Sauvegarde PostgreSQL via tunnel SSH
#  Usage : ./backup.sh
# ============================================================
set -euo pipefail

# ── Config ────────────────────────────────────────────────────
REMOTE_USER="clement"
REMOTE_HOST="192.168.1.195"
LOCAL_PORT="5432"
DB_NAME="pj"
DB_USER="postgres"
DB_PASS="postgres"
BACKUP_DIR="$(cd "$(dirname "$0")/backend/backups" && pwd)"
TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

# ── Couleurs ──────────────────────────────────────────────────
GRN='\033[0;32m'; YLW='\033[1;33m'; RED='\033[0;31m'; RST='\033[0m'
ok()  { printf "${GRN}✓  %s${RST}\n" "$*"; }
inf() { printf "${YLW}…  %s${RST}\n" "$*"; }
err() { printf "${RED}✗  %s${RST}\n" "$*"; exit 1; }

# ── Dossier de backups ────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Tunnel SSH ────────────────────────────────────────────────
inf "Ouverture du tunnel SSH (port $LOCAL_PORT)…"
lsof -ti:"$LOCAL_PORT" | xargs kill -9 2>/dev/null || true
ssh -f -N -L "${LOCAL_PORT}:localhost:${LOCAL_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" \
    -o StrictHostKeyChecking=no \
    -o ExitOnForwardFailure=yes \
    -o ConnectTimeout=10 \
    || err "Impossible d'ouvrir le tunnel SSH vers $REMOTE_HOST"
sleep 1
ok "Tunnel SSH actif"

# ── Dump ─────────────────────────────────────────────────────
inf "Dump de la base '$DB_NAME'…"
PGPASSWORD="$DB_PASS" pg_dump \
    -h 127.0.0.1 \
    -p "$LOCAL_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-acl \
    | gzip > "$BACKUP_FILE"

SIZE="$(du -sh "$BACKUP_FILE" | cut -f1)"
ok "Backup créé : $BACKUP_FILE ($SIZE)"

# ── Rotation : garde les 10 derniers ─────────────────────────
BACKUPS=("$BACKUP_DIR"/${DB_NAME}_*.sql.gz)
if [[ ${#BACKUPS[@]} -gt 10 ]]; then
    inf "Rotation — suppression des plus anciens…"
    # shellcheck disable=SC2012
    ls -t "$BACKUP_DIR"/${DB_NAME}_*.sql.gz | tail -n +11 | xargs rm -f
    ok "Anciens backups supprimés (gardes les 10 derniers)"
fi

printf "\n${GRN}Backup terminé.${RST}\n"
