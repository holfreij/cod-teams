#!/bin/bash
# Auto-deploy cod-teams when new commits are detected on main
eval "$(/home/rolf/.local/share/fnm/fnm env)"
REPO_DIR="/home/rolf/git/cod-teams"
WEB_DIR="/var/www/qmg.rolf.bible/html"
LOG_FILE="/home/rolf/git/cod-teams/deploy.log"

cd "$REPO_DIR" || exit 1

# Fetch latest changes
git fetch origin main --quiet 2>&1

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0
fi

echo "$(date): New commits detected ($LOCAL -> $REMOTE), deploying..." >> "$LOG_FILE"

git pull origin main --quiet 2>&1 >> "$LOG_FILE"
npm install --silent 2>&1 >> "$LOG_FILE"
npm run build -- --base=/ 2>&1 >> "$LOG_FILE"

if [ $? -eq 0 ]; then
    rsync -a --delete "$REPO_DIR/dist/" "$WEB_DIR/"

    # Install server dependencies and restart
    cd "$REPO_DIR/server" && npm install --silent 2>&1 >> "$LOG_FILE"
    if command -v pm2 &> /dev/null; then
        pm2 restart cod-teams-server 2>/dev/null || pm2 start index.js --name cod-teams-server 2>&1 >> "$LOG_FILE"
    elif systemctl is-active --quiet cod-teams-server; then
        sudo systemctl restart cod-teams-server 2>&1 >> "$LOG_FILE"
    fi
    cd "$REPO_DIR"

    echo "$(date): Deploy successful" >> "$LOG_FILE"
else
    echo "$(date): Build failed!" >> "$LOG_FILE"
fi
