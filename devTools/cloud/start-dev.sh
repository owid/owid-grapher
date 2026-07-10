#!/bin/bash
# devTools/cloud/start-dev.sh — tmux-free `make up` for cloud sandboxes
set -euo pipefail
[ -f .env ] || cp .env.example-grapher .env
docker compose -f docker-compose.grapher.yml up -d
devTools/docker/wait-for-mysql.sh
mkdir -p logs
nohup yarn startAdminDevServer > logs/admin.log 2>&1 &
nohup yarn startSiteFront > logs/vite.log 2>&1 &
echo "admin: http://localhost:3030  site: http://localhost:8090"
