#!/usr/bin/env bash
set -e

# ── Couleurs ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

log()  { printf "${CYAN}${BOLD}▶ %s${RESET}\n" "$1"; }
ok()   { printf "${GREEN}✔ %s${RESET}\n" "$1"; }
warn() { printf "${YELLOW}⚠ %s${RESET}\n" "$1"; }
err()  { printf "${RED}✖ %s${RESET}\n" "$1"; exit 1; }

printf "\n${BOLD}╔══════════════════════════════════════╗\n"
printf "║   Plateforme Personnelle — Local     ║\n"
printf "╚══════════════════════════════════════╝${RESET}\n\n"

# ── 0. Nettoyage des ports utilisés ───────────────────────────────────────────
log "Nettoyage des ports 3000 (backend) et 5173 (frontend)..."
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null || true
ok "Ports libérés"

# ── 1. Prérequis ──────────────────────────────────────────────────────────────
log "Vérification des prérequis..."
command -v node >/dev/null 2>&1 || err "Node.js manquant — installe-le via https://nodejs.org"
command -v npm  >/dev/null 2>&1 || err "npm manquant"
ok "Node $(node -v) · npm $(npm -v)"

# ── 2. Tunnel SSH vers PostgreSQL ─────────────────────────────────────────────
log "Ouverture du tunnel SSH vers PostgreSQL..."
# Ferme un éventuel tunnel existant sur le port 5432
lsof -ti:5432 | xargs kill -9 2>/dev/null || true
ssh -f -N -L 5432:localhost:5432 clement@192.168.1.195 \
  -o StrictHostKeyChecking=no \
  -o ExitOnForwardFailure=yes \
  -o ConnectTimeout=10
ok "Tunnel SSH actif (localhost:5432 → 192.168.1.195:5432)"

# ── 3. Backend — dépendances + migrations ─────────────────────────────────────
log "Préparation du backend..."
cd "$BACKEND"

[ -f .env ] || err "Fichier .env manquant dans backend/ — vérifie que DATABASE_URL pointe vers ta machine distante"

if [ ! -d node_modules ]; then
  warn "node_modules absent — installation..."
  npm install
fi

npx prisma generate
npx prisma migrate deploy || warn "Migrations déjà à jour"
ok "Backend prêt"

# ── 3. Frontend — dépendances ─────────────────────────────────────────────────
log "Préparation du frontend..."
cd "$FRONTEND"

if [ ! -d node_modules ]; then
  warn "node_modules absent — installation..."
  npm install
fi

if [ ! -f .env ]; then
  echo 'VITE_API_URL="http://localhost:3000/api"' > .env
  ok ".env frontend créé"
fi
ok "Frontend prêt"

# ── 4. Lancement dans des onglets Terminal séparés ────────────────────────────
log "Ouverture des serveurs..."

osascript <<EOF
tell application "Terminal"
  activate
  tell application "System Events" to keystroke "t" using command down
  delay 0.5
  do script "cd '$BACKEND' && clear && echo '🔵 BACKEND — http://localhost:3000' && npm run start:dev" in front window
  tell application "System Events" to keystroke "t" using command down
  delay 0.5
  do script "cd '$FRONTEND' && clear && echo '🟢 FRONTEND — http://localhost:5173' && npm run dev" in front window
end tell
EOF

# ── 5. Attente et ouverture du navigateur ─────────────────────────────────────
echo ""
log "Attente du démarrage des serveurs (max 45s chacun)..."

wait_for() {
  local label="$1" url="$2" max=45
  printf "  %s" "$label"
  for i in $(seq 1 $max); do
    if curl -s "$url" >/dev/null 2>&1; then
      printf "\n"; return 0
    fi
    printf "."
    sleep 1
  done
  printf "\n"
  err "$label n'a pas répondu après ${max}s — vérifie les logs dans le terminal correspondant"
}

wait_for "Backend " "http://localhost:3000/api/health"
ok "Backend  UP → http://localhost:3000/api"

wait_for "Frontend" "http://localhost:5173"
ok "Frontend UP → http://localhost:5173"

open "http://localhost:5173"

printf "\n${GREEN}${BOLD}✔ Tout est lancé !${RESET}\n"
printf "  Frontend → ${CYAN}http://localhost:5173${RESET}\n"
printf "  Backend  → ${CYAN}http://localhost:3000/api${RESET}\n"
printf "\n  ${YELLOW}Pour arrêter :${RESET} Ctrl+C dans les deux onglets Terminal\n\n"
