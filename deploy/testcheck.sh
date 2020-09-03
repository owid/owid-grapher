#!/bin/bash -e

# Run pretty-quick in full working directories (e.g. dev) and prettier in others (e.g. CI, "yarn deploy live -r")
# Not using "git rev-parse --is-inside-work-tree" to avoid printing a potentially confusing fatal error when ran outside
# a working copy in "yarn deploy live -r" scenarios.
# if $(git rev-parse --is-inside-work-tree) > /dev/null 2>&1 && ! $(git rev-parse --is-shallow-repository) > /dev/null 2>&1; then
if [ -d .git ] && ! $(git rev-parse --is-shallow-repository) > /dev/null 2>&1; then
  PRETTIFY_CMD="yarn prettify:check"
else
  PRETTIFY_CMD="yarn prettify-all:check"
fi

$PRETTIFY_CMD && yarn typecheck && yarn test