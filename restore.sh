#!/usr/bin/env bash
# ============================================================
#  restore.sh — Restauration PostgreSQL via tunnel SSH
#  Usage : ./restore.sh backend/backups/pj_20260606_120000.sql.gz
# ============================================================
set -euo pipefail

REMOTE_USER="clement"
REMOTE_HOST="192.168.1.195"
LOCAL_PORT="5432"
DB_NAME="pj"
DB_USER="postgres"
DB_PASS="postgres"

GRN='\033[0;32m'; YLW='\033[1;33m'; RED='\033[0;31m'; RST='\033[0m'
ok()  { printf "${GRN}✓  %s${RST}\n" "$*"; }
inf() { printf "${YLW}…  %s${RST}\n" "$*"; }
err() { printf "${RED}✗  %s${RST}\n" "$*"; exit 1; }

# ── Argument ──────────────────────────────────────────────────
BACKUP_FILE="${1:-}"
[[ -z "$BACKUP_FILE" ]] && err "Usage: ./restore.sh <fichier.sql.gz>"
[[ -f "$BACKUP_FILE" ]] || err "Fichier introuvable : $BACKUP_FILE"

printf "${RED}⚠  ATTENTION : cette opération va ÉCRASER la base '$DB_NAME'.${RST}\n"
printf "   Fichier source : %s\n\n" "$BACKUP_FILE"
read -r -p "   Taper 'OUI' pour confirmer : " CONFIRM
[[ "$CONFIRM" == "OUI" ]] || err "Restauration annulée."

# ── Tunnel SSH ────────────────────────────────────────────────
inf "Ouverture du tunnel SSH…"
lsof -ti:"$LOCAL_PORT" | xargs kill -9 2>/dev/null || true
ssh -f -N -L "${LOCAL_PORT}:localhost:${LOCAL_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" \
    -o StrictHostKeyChecking=no \
    -o ExitOnForwardFailure=yes \
    -o ConnectTimeout=10 \
    || err "Impossible d'ouvrir le tunnel SSH"
sleep 1
ok "Tunnel SSH actif"

# ── Restauration ──────────────────────────────────────────────
inf "Suppression et recréation de la base '$DB_NAME'…"
PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -p "$LOCAL_PORT" -U "$DB_USER" -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
    -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";" \
    -c "CREATE DATABASE \"${DB_NAME}\";" \
    > /dev/null
ok "Base recréée"

inf "Restauration du dump…"
gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASS" psql \
    -h 127.0.0.1 \
    -p "$LOCAL_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    > /dev/null
ok "Restauration terminée"

inf "Application des migrations Prisma…"
cd "$(dirname "$0")/backend"
npx prisma migrate deploy
ok "Migrations appliquées"

printf "\n${GRN}Base restaurée depuis : %s${RST}\n" "$BACKUP_FILE"
