#!/bin/bash -e

# Run pretty-quick in full working directories (e.g. dev) and prettier in others (e.g. CI, "yarn deploy live -r")
if ! $(git rev-parse --is-shallow-repository) > /dev/null 2>&1; then
  PRETTIFY_CMD="yarn prettify:check"
else
  PRETTIFY_CMD="yarn prettify-all:check"
fi

$PRETTIFY_CMD && yarn typecheck && yarn test