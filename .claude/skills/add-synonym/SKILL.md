---
name: add-synonym
description: Add search synonyms to the Algolia synonym list. Use when someone wants to add, update, or extend synonym groups for site search.
metadata:
    internal: true
---

# Add Search Synonyms

Add or update synonym entries in `site/search/synonymUtils.ts` so that our Algolia-powered site search returns better results.

## Assumptions

- The user is on a macOS (Apple) laptop.
- The user may not be a developer — they may not have Node.js, Yarn, or even Homebrew installed. Guide them through any setup with clear explanations.

## Steps

1. **Start from a clean, up-to-date main branch and create a feature branch.** Run:
    - `git checkout master` to switch to the main branch.
    - `git pull` to get the latest changes.
    - If either command fails (e.g. uncommitted changes), explain clearly what's happening and help resolve it. For uncommitted changes, `git stash` is usually the right fix.
    - Create and checkout a new branch: `git checkout -b add-synonym-<username>-<date>` where `<username>` is the GitHub username and `<date>` is today's date as YYYYMMDD (e.g. `add-synonym-bastianherre-20260413`).

2. Ask the user what synonyms they want to add. They can describe it in natural language (e.g. "add WHO as a synonym for World Health Organization" or "make 'EV' and 'electric vehicle' synonyms").

3. Read `site/search/synonymUtils.ts` to see the current synonym groups and section comments.

4. Determine which existing synonym group the new terms belong in:
    - Find the group where the requested terms best fit and add the new terms to it.
    - Never create a new synonym group — always add to an existing one.
    - Preserve the existing formatting: each group is an array of strings, groups are separated by blank lines between sections.

5. Edit the file. Use double quotes for all strings. Keep entries in the same style as surrounding code.

6. Validate the change. Before running any commands, check that the environment is ready:
    - Run `which yarn` to check if Yarn is available.
    - If Yarn is not found, explain to the user: "I need to install a couple of tools to validate the changes. This is a one-time setup." Then:
        - Check if Node.js is installed (`which node`). If not, install it via `brew install node` (install Homebrew first via its install script if `which brew` fails).
        - Install Yarn via `corepack enable && corepack prepare yarn@stable --activate`. If corepack is not available, fall back to `npm install -g yarn`.
        - Run `yarn install` to install project dependencies.
    - If Yarn is found but `node_modules` doesn't exist, run `yarn install` first.
    - Then run:
        - `yarn fixFormatChanged > /dev/null 2>&1 && yarn typecheck` and fix any errors.
        - `yarn testLintChanged` and fix any errors.
        - `yarn test run --reporter dot site/search/synonymUtils.test.ts` and fix any errors.

7. **Pause and ask the user to confirm** the changes look correct before proceeding. Show them what was added and wait for their go-ahead.

8. Commit to the feature branch with a message in this exact format:
    - Prefix: `✨🤖`
    - Followed by a short description, e.g. `✨🤖 Add "WHO" synonym for "World Health Organization"`
    - Add `Co-Authored-By: Claude <noreply@anthropic.com>` as a trailer.

9. Push the branch and create a PR:
    - Push with `git push -u origin HEAD`.
    - Create a PR with `gh pr create --title "<same as commit message>" --body "" --reviewer edomt`.

## Important notes

- Each synonym group is an array of equivalent terms — all terms in a group are treated as interchangeable for search.
- Country name synonyms are handled separately via the `countries` utility and should NOT be added to this file. If the user asks for a country synonym, explain this and point them to the country data instead — unless it's a geographic term not covered by the countries list (like "gaza", "palestine" which are already in the file).
- The synonyms in this file are pushed to Algolia during deployment via `baker/algolia/configureAlgolia.ts`. No manual Algolia action is needed.
- Common typos can be included as synonyms (see existing examples like "happyness", "c02").
