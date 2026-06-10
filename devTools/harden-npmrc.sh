#!/usr/bin/env bash
set -euo pipefail

echo "Updating npm..."

# Upgrade npm globally (so we have at least 11.10.0, which introduced min-release-age) and create a user npm config with stricter defaults.
npm install -g npm

if [[ -e "$HOME/.npmrc" ]]; then
    echo "ERROR: $HOME/.npmrc already exists. Please set the changes manually." >&2
    exit 1
fi

echo "Putting in place a ~/.npmrc file..."

cat >"$HOME/.npmrc" <<'EOF'
# These settings are intended to avoid supply chain attacks coming in via running npm or npx. They are recommended by OWID.
min-release-age=1 # days
ignore-scripts=true
EOF

echo "Done."
