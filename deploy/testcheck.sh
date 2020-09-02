#!/bin/bash -e

# Run pretty-quick in git working directories (e.g. dev) and prettier in others (e.g. yarn deploy live -r)
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  PRETTIFY_CMD="yarn prettify:check"
else
  PRETTIFY_CMD="yarn prettify-all:check"
fi

$PRETTIFY_CMD && yarn typecheck && yarn test