---
name: add-synonym
description: Add search synonyms to the Algolia synonym list. Use when someone wants to add, update, or extend synonym groups for site search.
---

# Add Search Synonyms

Add or update synonym entries in `site/search/synonymUtils.ts` so that our Algolia-powered site search returns better results.

## Assumptions

- The user is on a macOS (Apple) laptop.
- The user may not be a developer — they may not have Node.js, Yarn, or even Homebrew installed. Guide them through any setup with clear explanations.

## Steps

1. **Start from a clean, up-to-date main branch.** Run:
   - `git checkout master` to switch to the main branch.
   - `git pull` to get the latest changes.
   - If either command fails (e.g. uncommitted changes), explain clearly what's happening and help resolve it. For uncommitted changes, `git stash` is usually the right fix.

2. Ask the user what synonyms they want to add. They can describe it in natural language (e.g. "add WHO as a synonym for World Health Organization" or "make 'EV' and 'electric vehicle' synonyms").

3. Read `site/search/synonymUtils.ts` to see the current synonym groups and section comments.

4. Determine whether the new terms belong in an existing synonym group or need a new one:
   - If any of the requested terms already appear in a group, add the new terms to that group.
   - If creating a new group, place it under the most appropriate section comment (Organizations, Health, Energy, etc.).
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

7. Commit to master following the commit message guidelines in `docs/agent-guidelines/commit-messages.md`:
   - Use ✨🤖 as prefix when adding terms to an existing synonym group.
   - Use 🎉🤖 as prefix when creating a new synonym group.
   - Keep the message short and descriptive, e.g. `✨🤖 Add "WHO" synonym for "World Health Organization"`.

8. Push the commit to the remote.

## Important notes

- Each synonym group is an array of equivalent terms — all terms in a group are treated as interchangeable for search.
- Country name synonyms are handled separately via the `countries` utility and should NOT be added to this file. If the user asks for a country synonym, explain this and point them to the country data instead — unless it's a geographic term not covered by the countries list (like "gaza", "palestine" which are already in the file).
- The synonyms in this file are pushed to Algolia during deployment via `baker/algolia/configureAlgolia.ts`. No manual Algolia action is needed.
- Common typos can be included as synonyms (see existing examples like "happyness", "c02").
