#!/usr/bin/env bash
# ============================================================
#  security-test.sh — Tests de sécurité API (CDC §28)
#  Usage : ./security-test.sh [http://localhost:3001]
#  Le backend doit être lancé et au moins un user "admin" doit
#  exister (admin@example.com / ChangeMe123! par défaut).
# ============================================================
set -euo pipefail

BASE="${1:-http://localhost:3001}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASS="${ADMIN_PASS:-ChangeMe123!}"

# ── Couleurs ──────────────────────────────────────────────────
GRN='\033[0;32m'; RED='\033[0;31m'; YLW='\033[1;33m'
BLD='\033[1m'; RST='\033[0m'

PASS=0; FAIL=0
pass() { printf "${GRN}  ✓  PASS${RST}  %s\n" "$*"; ((PASS++)); }
fail() { printf "${RED}  ✗  FAIL${RST}  %s\n" "$*"; ((FAIL++)); }
section() { printf "\n${BLD}${YLW}▶ %s${RST}\n" "$*"; }

# ── Helpers ───────────────────────────────────────────────────
# status_of <url> [extra curl args...]
status_of() {
    local url="$1"; shift
    curl -s -o /dev/null -w "%{http_code}" "$url" "$@"
}

expect_status() {
    local label="$1" expected="$2" got="$3"
    if [[ "$got" == "$expected" ]]; then
        pass "$label (→ $got)"
    else
        fail "$label (attendu $expected, reçu $got)"
    fi
}

printf "\n${BLD}Security test suite${RST} — %s\n" "$BASE"
printf "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

# ════════════════════════════════════════════════
section "1. Endpoints protégés sans token"
# ════════════════════════════════════════════════

PROTECTED_ROUTES=(
    "/auth/me"
    "/profile"
    "/vehicles"
    "/stock/items"
    "/contacts"
    "/real-estate"
    "/agenda/tasks"
    "/documents"
    "/finances/transactions"
    "/core/errors"
)

for route in "${PROTECTED_ROUTES[@]}"; do
    code=$(status_of "$BASE$route")
    expect_status "GET $route sans token" "401" "$code"
done

# ════════════════════════════════════════════════
section "2. Token JWT invalide / falsifié"
# ════════════════════════════════════════════════

FAKE_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlLWlkIiwiZW1haWwiOiJoYWNrZXJAdGVzdC5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MDAwMDAwMDB9.FAKE_SIGNATURE"

for route in "/auth/me" "/vehicles" "/core/errors"; do
    code=$(status_of "$BASE$route" -H "Authorization: Bearer $FAKE_TOKEN")
    expect_status "GET $route avec fake token" "401" "$code"
done

# ════════════════════════════════════════════════
section "3. Token expiré (simulé)"
# ════════════════════════════════════════════════
# JWT signé avec bonne structure mais exp dans le passé
# (généré manuellement — header.payload.signature invalide)
EXPIRED_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMX0.invalid"
code=$(status_of "$BASE/auth/me" -H "Authorization: Bearer $EXPIRED_TOKEN")
expect_status "GET /auth/me avec token expiré/invalide" "401" "$code"

# ════════════════════════════════════════════════
section "4. Refresh token invalide"
# ════════════════════════════════════════════════
code=$(status_of "$BASE/auth/refresh" -X POST -H "Content-Type: application/json" --cookie "refresh_token=FAKE_REFRESH_TOKEN_THAT_DOES_NOT_EXIST")
expect_status "POST /auth/refresh avec faux cookie" "401" "$code"

# Refresh sans cookie du tout
code=$(status_of "$BASE/auth/refresh" -X POST -H "Content-Type: application/json")
expect_status "POST /auth/refresh sans cookie" "401" "$code"

# ════════════════════════════════════════════════
section "5. Login valide → obtention du token admin"
# ════════════════════════════════════════════════
LOGIN_RESP=$(curl -s -c /tmp/pj_sec_test_cookies.txt -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4 || true)

if [[ -z "$ADMIN_TOKEN" ]]; then
    fail "Login admin échoué — vérifier les credentials ($ADMIN_EMAIL)"
else
    pass "Login admin → token obtenu"

    # ── 6. Routes accessibles avec token valide ──────────
    section "6. Routes accessibles avec token admin valide"
    for route in "/auth/me" "/vehicles" "/core/errors"; do
        code=$(status_of "$BASE$route" -H "Authorization: Bearer $ADMIN_TOKEN")
        expect_status "GET $route avec token admin" "200" "$code"
    done

    # ── 7. Isolation données utilisateurs ────────────────
    section "7. Login utilisateur standard (si disponible)"
    USER_RESP=$(curl -s -c /tmp/pj_sec_test_cookies_user.txt -X POST "$BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"user@example.com","password":"ChangeMe123!"}' 2>/dev/null || true)
    USER_TOKEN=$(echo "$USER_RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4 || true)

    if [[ -n "$USER_TOKEN" ]]; then
        code=$(status_of "$BASE/core/errors" -H "Authorization: Bearer $USER_TOKEN")
        expect_status "GET /core/errors avec token user (doit être 403)" "403" "$code"
    else
        printf "  ${YLW}⊘  SKIP${RST}  Pas d'utilisateur standard trouvé (user@example.com)\n"
    fi

    # ── 8. Tentative d'accès à un véhicule d'un autre user ─
    section "8. Isolation des ressources (IDOR check)"
    # Créer un véhicule avec le compte admin, puis tenter d'y accéder si user standard existe
    CREATE_RESP=$(curl -s -X POST "$BASE/vehicles" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"name":"Test-Sec-Vehicle","type":"car","status":"active","mileage":0}')
    VEHICLE_ID=$(echo "$CREATE_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)

    if [[ -n "$VEHICLE_ID" && -n "$USER_TOKEN" ]]; then
        code=$(status_of "$BASE/vehicles/$VEHICLE_ID" -H "Authorization: Bearer $USER_TOKEN")
        expect_status "GET /vehicles/$VEHICLE_ID avec token d'un autre user (doit être 403/404)" "404" "$code"
    elif [[ -n "$VEHICLE_ID" ]]; then
        printf "  ${YLW}⊘  SKIP${RST}  IDOR check (pas de 2e utilisateur disponible)\n"
    fi

    # Nettoyage
    if [[ -n "$VEHICLE_ID" ]]; then
        curl -s -X DELETE "$BASE/vehicles/$VEHICLE_ID" \
            -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
    fi

    # ── 9. Refresh token rotation ─────────────────────────
    section "9. Refresh token — rotation et réutilisation"
    # Utiliser le refresh token (cookie stocké par le login)
    REFRESH_RESP=$(curl -s -b /tmp/pj_sec_test_cookies.txt -c /tmp/pj_sec_test_cookies2.txt \
        -X POST "$BASE/auth/refresh" -H "Content-Type: application/json")
    NEW_TOKEN=$(echo "$REFRESH_RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4 || true)
    if [[ -n "$NEW_TOKEN" ]]; then
        pass "Refresh token valide → nouvel access token obtenu"
        # Le token original ne devrait plus être accepté après refresh (rotation)
        # On ne peut pas tester ça sans délai, donc on vérifie juste que le nouveau token fonctionne
        code=$(status_of "$BASE/auth/me" -H "Authorization: Bearer $NEW_TOKEN")
        expect_status "Nouveau token post-refresh fonctionne" "200" "$code"
    else
        fail "Refresh token n'a pas retourné de nouveau token"
    fi
fi

# ════════════════════════════════════════════════
# Rapport final
# ════════════════════════════════════════════════
TOTAL=$((PASS + FAIL))
printf "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
printf "${BLD}Résultats : %d/%d tests passés${RST}\n" "$PASS" "$TOTAL"
if [[ "$FAIL" -eq 0 ]]; then
    printf "${GRN}${BLD}✓ Tous les tests de sécurité sont OK.${RST}\n\n"
    exit 0
else
    printf "${RED}${BLD}✗ %d test(s) échoué(s) — voir ci-dessus.${RST}\n\n" "$FAIL"
    exit 1
fi
