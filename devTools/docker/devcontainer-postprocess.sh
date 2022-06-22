#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

sudo chown node node_modules || true
sudo mkdir /owid-content || true
sudo chown node:node /owid-content || true
