#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Démarrage en production sur Debian 13 (la machine qui héberge PostgreSQL)
#  Utilisation : sudo bash server-start.sh         (start)
#                sudo bash server-start.sh stop    (stop)
#                sudo bash server-start.sh status  (status)
#                sudo bash server-start.sh logs    (tail -f logs)
#  Variables d'env optionnelles :
#    SERVER_HOST=192.168.1.195      # IP que verra le frontend (auto-détectée sinon)
#    BACKEND_PORT=3000
#    FRONTEND_PORT=5173
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
LOGDIR="$ROOT/logs"
PIDDIR="$ROOT/run"
BACKEND_PID="$PIDDIR/backend.pid"
FRONTEND_PID="$PIDDIR/frontend.pid"
BACKEND_LOG="$LOGDIR/backend.log"
FRONTEND_LOG="$LOGDIR/frontend.log"

BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
SERVER_HOST="${SERVER_HOST:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
SERVER_HOST="${SERVER_HOST:-localhost}"

# ── Couleurs ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
log()  { printf "${CYAN}${BOLD}▶ %s${RESET}\n" "$1"; }
ok()   { printf "${GREEN}✔ %s${RESET}\n" "$1"; }
warn() { printf "${YELLOW}⚠ %s${RESET}\n" "$1"; }
err()  { printf "${RED}✖ %s${RESET}\n" "$1"; exit 1; }

mkdir -p "$LOGDIR" "$PIDDIR"

# ── Helpers PID ──────────────────────────────────────────────────────────────
is_alive() {
  local f="$1"
  [[ -f "$f" ]] && kill -0 "$(cat "$f")" 2>/dev/null
}
kill_pidfile() {
  local f="$1" name="$2"
  if is_alive "$f"; then
    local pid; pid="$(cat "$f")"
    kill "$pid" 2>/dev/null || true
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
    ok "$name arrêté (PID $pid)"
  fi
  rm -f "$f"
}
free_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k -n tcp "$port" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti:"$port" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
  fi
}

# ── Sous-commandes ───────────────────────────────────────────────────────────
cmd_stop() {
  log "Arrêt des serveurs..."
  kill_pidfile "$BACKEND_PID"  "Backend"
  kill_pidfile "$FRONTEND_PID" "Frontend"
  free_port "$BACKEND_PORT"
  free_port "$FRONTEND_PORT"
  ok "Tout est arrêté"
}

cmd_status() {
  printf "${BOLD}État des serveurs${RESET}\n"
  if is_alive "$BACKEND_PID"; then
    printf "  ${GREEN}● Backend${RESET}  PID $(cat $BACKEND_PID)  port $BACKEND_PORT\n"
  else
    printf "  ${RED}○ Backend${RESET}  arrêté\n"
  fi
  if is_alive "$FRONTEND_PID"; then
    printf "  ${GREEN}● Frontend${RESET} PID $(cat $FRONTEND_PID)  port $FRONTEND_PORT\n"
  else
    printf "  ${RED}○ Frontend${RESET} arrêté\n"
  fi
  printf "\n  URL : ${CYAN}http://$SERVER_HOST:$FRONTEND_PORT${RESET}\n"
  printf "  API : ${CYAN}http://$SERVER_HOST:$BACKEND_PORT/api${RESET}\n"
}

cmd_logs() {
  log "Logs (Ctrl+C pour quitter)..."
  touch "$BACKEND_LOG" "$FRONTEND_LOG"
  tail -F "$BACKEND_LOG" "$FRONTEND_LOG"
}

# ── Démarrage (par défaut) ───────────────────────────────────────────────────
cmd_start() {
  printf "\n${BOLD}╔═══════════════════════════════════════════════╗\n"
  printf "║   MonEspace — Production (Debian)            ║\n"
  printf "╚═══════════════════════════════════════════════╝${RESET}\n\n"

  # 0. Stop préventif (idempotent)
  log "Nettoyage des anciens process..."
  kill_pidfile "$BACKEND_PID"  "Backend"  >/dev/null 2>&1 || true
  kill_pidfile "$FRONTEND_PID" "Frontend" >/dev/null 2>&1 || true
  free_port "$BACKEND_PORT"
  free_port "$FRONTEND_PORT"
  ok "Ports $BACKEND_PORT et $FRONTEND_PORT libres"

  # 1. Prérequis
  log "Vérification des prérequis..."
  command -v node >/dev/null || err "Node.js manquant — installe-le (apt install nodejs / nvm)"
  command -v npm  >/dev/null || err "npm manquant"
  ok "Node $(node -v) · npm $(npm -v)"

  # 2. PostgreSQL local
  log "Vérification de PostgreSQL local..."
  if ! ss -tln 2>/dev/null | grep -q ':5432 '; then
    warn "Postgres ne semble pas écouter sur 5432 — tentative de démarrage..."
    if systemctl list-unit-files | grep -q '^postgresql@'; then
      systemctl start 'postgresql@*-main' 2>/dev/null || true
    fi
    systemctl start postgresql 2>/dev/null || true
    sleep 2
    ss -tln 2>/dev/null | grep -q ':5432 ' || err "Postgres injoignable sur 5432 — vérifie 'systemctl status postgresql@17-main'"
  fi
  ok "Postgres écoute sur 5432"

  # 3. Backend
  log "Préparation du backend..."
  cd "$BACKEND"
  [[ -f .env ]] || err "backend/.env manquant — crée-le avec DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET"
  # Même chose côté backend : Nest CLI, ts-node, typescript sont en devDeps
  if [[ ! -d node_modules ]] || [[ ! -x node_modules/.bin/nest ]]; then
    warn "node_modules incomplet — réinstallation avec devDeps..."
    rm -rf node_modules
    NODE_ENV= npm install --include=dev --no-audit --no-fund
  fi
  npx prisma generate
  npx prisma migrate deploy || warn "Migrations déjà à jour"
  npm run build
  ok "Backend prêt (dist/main.js)"

  # 4. Frontend (build de prod)
  log "Préparation du frontend (build pour $SERVER_HOST)..."
  cd "$FRONTEND"
  # On force --include=dev car typescript/vite sont en devDependencies
  # et sont indispensables au build, même en mode prod.
  if [[ ! -d node_modules ]] || [[ ! -x node_modules/.bin/tsc ]]; then
    warn "node_modules incomplet — réinstallation avec devDeps..."
    rm -rf node_modules
    NODE_ENV= npm install --include=dev --no-audit --no-fund
  fi
  # API URL vue depuis le navigateur du client
  VITE_API_URL="http://$SERVER_HOST:$BACKEND_PORT/api" npm run build
  ok "Frontend buildé dans dist/"

  # 5. Lancement des deux process en arrière-plan
  log "Lancement des serveurs..."
  cd "$BACKEND"
  PORT="$BACKEND_PORT" NODE_ENV=production \
    nohup node dist/main >>"$BACKEND_LOG" 2>&1 &
  echo $! > "$BACKEND_PID"
  ok "Backend démarré (PID $(cat $BACKEND_PID))"

  cd "$FRONTEND"
  # `serve` est installé via npx au premier lancement
  nohup npx --yes serve -s dist -l "$FRONTEND_PORT" >>"$FRONTEND_LOG" 2>&1 &
  echo $! > "$FRONTEND_PID"
  ok "Frontend démarré (PID $(cat $FRONTEND_PID))"

  # 6. Attente
  log "Attente du démarrage (max 60s)..."
  for i in $(seq 1 60); do
    if curl -fs "http://localhost:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
      ok "Backend UP"
      break
    fi
    sleep 1
    [[ $i -eq 60 ]] && err "Backend n'a pas répondu — voir $BACKEND_LOG"
  done

  for i in $(seq 1 30); do
    if curl -fs "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
      ok "Frontend UP"
      break
    fi
    sleep 1
    [[ $i -eq 30 ]] && err "Frontend n'a pas répondu — voir $FRONTEND_LOG"
  done

  printf "\n${GREEN}${BOLD}✔ MonEspace est en ligne${RESET}\n"
  printf "  Frontend → ${CYAN}http://$SERVER_HOST:$FRONTEND_PORT${RESET}\n"
  printf "  API      → ${CYAN}http://$SERVER_HOST:$BACKEND_PORT/api${RESET}\n"
  printf "  Logs     → ${CYAN}sudo bash $0 logs${RESET}\n"
  printf "  Stop     → ${CYAN}sudo bash $0 stop${RESET}\n\n"
}

# ── Dispatch ─────────────────────────────────────────────────────────────────
case "${1:-start}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_stop; cmd_start ;;
  status)  cmd_status ;;
  logs)    cmd_logs ;;
  *)       err "Usage : $0 [start|stop|restart|status|logs]" ;;
esac
