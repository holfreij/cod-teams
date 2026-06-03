#!/bin/bash
# Hits the Supabase REST API to count as project activity, preventing the free
# tier from auto-pausing the project after 7 days of inactivity. Run twice
# weekly from cron. Reads credentials from the repo's .env (same file the Vite
# build uses).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${REPO_DIR}/.env"
LOG_FILE="${REPO_DIR}/supabase-keepalive.log"

if [ ! -f "$ENV_FILE" ]; then
    echo "$(date -Iseconds) ERROR: $ENV_FILE not found" >> "$LOG_FILE"
    exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

URL="${VITE_SUPABASE_URL:-}"
KEY="${VITE_SUPABASE_ANON_KEY:-}"

if [ -z "$URL" ] || [ -z "$KEY" ]; then
    echo "$(date -Iseconds) ERROR: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set in .env" >> "$LOG_FILE"
    exit 1
fi

# Accept either bare host or full URL in .env
[[ "$URL" == https://* ]] || URL="https://${URL}"

HTTP_CODE=$(curl -sS -o /tmp/supabase-keepalive-body -w '%{http_code}' \
    "${URL}/rest/v1/player_ratings?select=name&limit=1" \
    -H "apikey: ${KEY}" \
    -H "Authorization: Bearer ${KEY}")

if [ "$HTTP_CODE" = "200" ]; then
    echo "$(date -Iseconds) OK ${HTTP_CODE}" >> "$LOG_FILE"
    rm -f /tmp/supabase-keepalive-body
    exit 0
else
    echo "$(date -Iseconds) FAIL ${HTTP_CODE} body=$(cat /tmp/supabase-keepalive-body)" >> "$LOG_FILE"
    rm -f /tmp/supabase-keepalive-body
    exit 1
fi
