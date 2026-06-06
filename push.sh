#!/usr/bin/env bash
# ─────────────────────────────────────────────
#  push.sh — Publier les mises à jour sur GitHub
#  Usage :
#    ./push.sh                       → interactif (demande message)
#    ./push.sh "message de commit"   → message direct
#    ./push.sh --auto "message"      → silencieux (pas de prompt, pour scripts)
# ─────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

BOLD="\033[1m"
GREEN="\033[32m"
CYAN="\033[36m"
YELLOW="\033[33m"
RED="\033[31m"
GREY="\033[90m"
RESET="\033[0m"

log()  { echo -e "${CYAN}▶${RESET}  $*"; }
ok()   { echo -e "${GREEN}✓${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
err()  { echo -e "${RED}✗${RESET}  $*"; exit 1; }
sep()  { echo -e "${GREY}──────────────────────────────────────────${RESET}"; }

# ── Mode auto (appelé par les scripts) ────────
AUTO=false
if [ "$1" = "--auto" ]; then
  AUTO=true
  shift
fi

COMMIT_MSG="${1:-}"

echo ""
echo -e "${BOLD}  🚀  Dashboard Personnel — Push GitHub${RESET}"
sep

# ── 1. Remote ─────────────────────────────────
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE_URL" ]; then
  if [ "$AUTO" = true ]; then
    err "Aucun remote configuré. Lance './push.sh' manuellement une première fois."
  fi
  warn "Aucun remote 'origin' configuré."
  echo -e "  ${BOLD}URL GitHub${RESET} (ex: https://github.com/user/repo.git) :"
  read -r -p "  → " GITHUB_URL
  [ -z "$GITHUB_URL" ] && err "URL vide. Annulé."
  git remote add origin "$GITHUB_URL"
  ok "Remote ajouté : $GITHUB_URL"
else
  ok "Remote : $REMOTE_URL"
fi

# ── 2. Statut ─────────────────────────────────
sep
log "Analyse des changements…"
echo ""

CHANGED=$(git diff --name-only)
STAGED=$(git diff --cached --name-only)
UNTRACKED=$(git ls-files --others --exclude-standard \
  | grep -v "^\.claude/" \
  | grep -v "\.zip$" \
  | grep -v "dev-dist/" \
  | grep -v "package-lock 2" \
  || true)

if [ -z "$CHANGED" ] && [ -z "$STAGED" ] && [ -z "$UNTRACKED" ]; then
  ok "Rien à committer. Push en cours…"
else
  [ -n "$STAGED"    ] && echo -e "${GREEN}  Stagés :${RESET}"    && echo "$STAGED"    | sed 's/^/    ✓ /'
  [ -n "$CHANGED"   ] && echo -e "${YELLOW}  Modifiés :${RESET}"  && echo "$CHANGED"   | sed 's/^/    ~ /'
  [ -n "$UNTRACKED" ] && echo -e "${CYAN}  Nouveaux :${RESET}"   && echo "$UNTRACKED" | sed 's/^/    + /'
  echo ""

  # Message de commit
  if [ -z "$COMMIT_MSG" ]; then
    if [ "$AUTO" = true ]; then
      COMMIT_MSG="chore: update $(date '+%d/%m/%Y %H:%M')"
    else
      echo -e "  ${BOLD}Message de commit${RESET} (Entrée = auto) :"
      read -r -p "  → " COMMIT_MSG
      [ -z "$COMMIT_MSG" ] && COMMIT_MSG="chore: update $(date '+%d/%m/%Y %H:%M')"
    fi
  fi
  ok "Message : $COMMIT_MSG"
  echo ""

  # Stage + commit
  log "Stage des fichiers…"
  git add -A
  git reset HEAD ".claude/"        2>/dev/null || true
  git reset HEAD "*.zip"           2>/dev/null || true
  git reset HEAD "frontend/dev-dist/" 2>/dev/null || true
  git reset HEAD "frontend/package-lock 2.json" 2>/dev/null || true

  STAGED_FINAL=$(git diff --cached --name-only)
  if [ -n "$STAGED_FINAL" ]; then
    git commit -m "$COMMIT_MSG"
    ok "Commit créé."
  fi
fi

# ── 3. Push ───────────────────────────────────
sep
log "Push vers GitHub…"
echo ""
BRANCH=$(git rev-parse --abbrev-ref HEAD)

if git push -u origin "$BRANCH" 2>&1; then
  echo ""
  sep
  echo -e "${GREEN}${BOLD}  ✅  Push réussi !${RESET}"
  REPO_URL=$(git remote get-url origin | sed 's/\.git$//' | sed 's|git@github.com:|https://github.com/|')
  echo -e "  ${GREY}Branche :${RESET} $BRANCH"
  echo -e "  ${GREY}Repo    :${RESET} $REPO_URL"
  sep
else
  err "Push échoué. Vérifie tes droits GitHub."
fi
echo ""
