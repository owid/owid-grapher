#!/usr/bin/env bash
# Stops everything `make up.headless` started. Called by `make down.headless`.
set -o errexit
set -o pipefail

echo '==> Stopping background dev servers'
pkill -f 'adminSiteServer/app.ts' 2>/dev/null || true
pkill -f 'vite dev --config vite.config-site.mts' 2>/dev/null || true
make down
