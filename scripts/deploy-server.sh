#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-8.153.147.78}"
REMOTE_USER="${REMOTE_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/codex_remote}"
APP_DIR="${APP_DIR:-/opt/personal-portfolio}"
RELEASE="$(date +%Y%m%d%H%M%S)"
SSH=(ssh -i "$SSH_KEY" -o IdentitiesOnly=yes)
RSYNC=(rsync -az --delete -e "ssh -i $SSH_KEY -o IdentitiesOnly=yes")

npm run build

"${SSH[@]}" "$REMOTE_USER@$REMOTE_HOST" \
  "mkdir -p '$APP_DIR/releases/$RELEASE' '$APP_DIR/shared/data' '$APP_DIR/shared/uploads'"

"${RSYNC[@]}" dist package.json package-lock.json \
  "$REMOTE_USER@$REMOTE_HOST:$APP_DIR/releases/$RELEASE/"

"${SSH[@]}" "$REMOTE_USER@$REMOTE_HOST" "set -eu
cd '$APP_DIR/releases/$RELEASE'
npm ci --omit=dev
rm -rf data uploads
ln -s '$APP_DIR/shared/data' data
ln -s '$APP_DIR/shared/uploads' uploads
ln -sfn '$APP_DIR/releases/$RELEASE' '$APP_DIR/current'
systemctl restart personal-portfolio
systemctl reload nginx
find '$APP_DIR/releases' -mindepth 1 -maxdepth 1 -type d | sort | head -n -5 | xargs -r rm -rf
systemctl --no-pager --full status personal-portfolio | sed -n '1,18p'"
