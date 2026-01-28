---
name: gt-create-pr-branch
description: Create a new branch with the Graphite CLI, commit all current working tree changes, and submit the PR, while excluding plan markdown files by stashing them first and restoring afterward. Use when asked to make a Graphite branch + commit + PR and to follow repo commit-message rules.
---

# Graphite Branch + PR

## Overview

Create a Graphite branch, commit all current changes, and submit the PR while protecting any plan markdown files via stashing and following repo commit-message rules. Prefer the Graphite command that creates the branch and accepts a commit message in one step, then immediately submit the PR.

## Workflow

### 1) Review working tree

- Run `git status --porcelain` and collect the changed/untracked files.

### 2) Detect plan markdown files

- Open each changed `.md` file and decide if it is a plan.
- Treat a file as a plan if it contains plan-like structure such as:
    - A heading like "Plan", "Steps", "Implementation plan", or "Task list".
    - Task checkboxes like `- [ ]` or `- [x]` that describe steps.
    - Explicit planning language in the first section ("Plan:", "Next steps:").
- Treat README-style docs, guides, or changelogs as normal docs to commit.
- If unsure, ask the user before stashing.

### 3) Stash plan files (exclude from commit)

- For each plan file, run `git stash push -m "stash plan: <file>" -- <path>`.
- Record the stash references to restore later.

### 4) Choose a branch name, build a commit message, and create the branch

- Pick a branch name using 2-5 words in kebab-case (example: `search-toggle-copy`) based on the highest-impact change.
- Read and apply the repo instructions at `docs/agent-guidelines/commit-messages.md`
- Use `gt create -a <branch-name> -m "<message>"`; if the name conflicts, add a short suffix.

### 5) Submit PR

- Use `gt submit --ai` to open a draft PR with auto-generated title and description.

### 6) Restore plan files

- Restore each stashed plan with `git stash pop` (or `git stash pop <ref>` if multiple).
- Confirm the plan file is back and still uncommitted.

## Edge cases

- If `gt` is unavailable or its commands are unclear, run `gt --help` and ask the user before proceeding.
- If there are no changes to commit, do not create a branch; report and stop.
