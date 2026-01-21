---
allowed-tools: Bash(git log:*), Bash(git commit:*), Bash(git add:*), Bash(git status:*)
description: Create a git commit according to our git styleguide (assumes code was written by an agent)
---

Create a git commit in this repo.

These instructions apply to creating new git commits. Below are the outputs of relevent prerequisites:

# Prerequisites

## Current git status

!`git status`

## Current branch

!`git branch --show-current`

## Recent commits

!`git log --oneline -10`

## Typecheck results (yarn typecheck)

!`yarn typecheck`

## Linter results (yarn testLintChanged)

!`yarn testLintChanged`

## Prettier results (yarn fixPrettierChanged)

!`yarn fixPrettierChanged`

# Instructions

Above are the outputs of the relevant prerequisites. Should there be any issues to deal with, fix them and run the corresponding command again

For the message, use an emoji from the table below as the start of the commit and add the 🤖 immediately afterwards to indicate this code was written by an AI. Have a look at the last 10 commit messages to get a sense for the style. If the change is simple, try to fit it into one short line, otherwise use a short first line, then an empty line and then create a terse but complete description of the changes.

emoji - when to use it
🎉 new feature for the user
🐛 bug fix for the user
✨ visible improvement over a current implementation without adding a new feature or fixing a bug
🔨 a code change that neither fixes a bug nor adds a feature for the user
📜 changes to the documentation
✅ adding missing tests, refactoring tests, etc. No production code change
🐝 upgrading dependencies, tooling, etc. No production code change
💄 formatting, missing semi colons, etc. No production code change
🚧 Work in progress - intermediate commits that will be explained later on
📊 Work on data updates (useful in etl repo)
