#!/bin/bash

# Copy this file to .devcontainer-personal-setup.sh (gitignored)
# and customize as needed for your own devcontainer setup.

set -euo pipefail

# Pi coding agent
npm install -g @mariozechner/pi-coding-agent

# Claude Code
npm install -g @anthropic-ai/claude-code

# Codex CLI
npm install -g @openai/codex
