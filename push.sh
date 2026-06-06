#!/usr/bin/env bash
# ─────────────────────────────────────────────
#  push.sh — Publier les mises à jour sur GitHub
#  Usage : ./push.sh [message de commit optionnel]
# ─────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

# ── Couleurs ──────────────────────────────────
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

echo ""
echo -e "${BOLD}  🚀  Dashboard Personnel — Push GitHub${RESET}"
sep

# ── 1. Vérifier que git est initialisé ────────
if [ ! -d ".git" ]; then
  err "Pas de dépôt git trouvé. Lance 'git init' d'abord."
fi

# ── 2. Remote GitHub ───────────────────────────
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$REMOTE_URL" ]; then
  warn "Aucun remote 'origin' configuré."
  echo ""
  echo -e "  ${BOLD}URL GitHub${RESET} (ex: https://github.com/tonpseudo/pj.git) :"
  read -r -p "  → " GITHUB_URL
  echo ""
  if [ -z "$GITHUB_URL" ]; then
    err "URL vide. Annulé."
  fi
  git remote add origin "$GITHUB_URL"
  ok "Remote ajouté : $GITHUB_URL"
else
  ok "Remote : $REMOTE_URL"
fi

# ── 3. Statut du dépôt ────────────────────────
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
  ok "Rien à committer. Tentative de push…"
  echo ""
else
  # Afficher les fichiers modifiés
  if [ -n "$STAGED" ]; then
    echo -e "${GREEN}  Déjà stagés :${RESET}"
    echo "$STAGED" | sed 's/^/    ✓ /'
  fi
  if [ -n "$CHANGED" ]; then
    echo -e "${YELLOW}  Modifiés :${RESET}"
    echo "$CHANGED" | sed 's/^/    ~ /'
  fi
  if [ -n "$UNTRACKED" ]; then
    echo -e "${CYAN}  Nouveaux fichiers :${RESET}"
    echo "$UNTRACKED" | sed 's/^/    + /'
  fi
  echo ""

  # ── 4. Message de commit ──────────────────
  if [ -n "$1" ]; then
    COMMIT_MSG="$1"
    ok "Message : $COMMIT_MSG"
  else
    echo -e "  ${BOLD}Message de commit${RESET} (Entrée = message auto) :"
    read -r -p "  → " COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
      COMMIT_MSG="chore: update $(date '+%d/%m/%Y %H:%M')"
    fi
  fi
  echo ""

  # ── 5. Stage + commit ─────────────────────
  log "Stage des fichiers…"
  # Stager les modifiés + nouveaux (en excluant les artefacts)
  git add -A
  git reset HEAD ".claude/" 2>/dev/null || true
  git reset HEAD "*.zip" 2>/dev/null || true
  git reset HEAD "frontend/dev-dist/" 2>/dev/null || true
  git reset HEAD "frontend/package-lock 2.json" 2>/dev/null || true

  STAGED_FINAL=$(git diff --cached --name-only)
  if [ -z "$STAGED_FINAL" ]; then
    ok "Rien de nouveau à committer."
  else
    git commit -m "$COMMIT_MSG"
    ok "Commit créé : '$COMMIT_MSG'"
  fi
fi

# ── 6. Push ───────────────────────────────────
sep
log "Push vers GitHub…"
echo ""

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if git push -u origin "$BRANCH" 2>&1; then
  echo ""
  sep
  echo -e "${GREEN}${BOLD}  ✅  Push réussi !${RESET}"
  echo ""
  REMOTE_URL=$(git remote get-url origin)
  REPO_URL=$(echo "$REMOTE_URL" | sed 's/\.git$//' | sed 's|git@github.com:|https://github.com/|')
  echo -e "  ${GREY}Branche :${RESET} $BRANCH"
  echo -e "  ${GREY}Repo    :${RESET} $REPO_URL"
  echo -e "  ${GREY}Commits :${RESET} $(git rev-list --count origin/$BRANCH 2>/dev/null || git rev-list --count HEAD) au total"
  sep
else
  echo ""
  err "Push échoué. Vérifie tes droits GitHub ou l'URL du remote."
fi
echo ""
