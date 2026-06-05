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
    - Prefer adding to an existing group, and **never create a new thematic _section_** (the `// Organizations`, `// Health`, … comment blocks).
    - **Exception for producers/organizations:** in the `// Organizations` section each producer is its _own_ array (e.g. `["imf", "international monetary fund"]`). Adding a new producer means adding a new array under that section — that's expected, not a "new group" in the forbidden sense. **Never merge two distinct organizations into one array**, since every term in an array is treated as interchangeable (that would make IMF and the OECD synonyms of each other).
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

## Conventions & lessons

These apply to synonyms in general (not just organizations) — apply them proactively and suggest the relevant variants to the user when you add a term:

- **Beware acronyms/terms that are common English words.** A synonym expands _every_ query containing that token, so a common-word term pollutes unrelated searches. The classic case is **WHO**: don't add the bare `"who"` for the World Health Organization, since "who has the highest income" would pull WHO datasets. When a term collides with a common word, flag it to the user and prefer the full name and/or a non-colliding variant. (`"un"` is borderline but accepted; `"pip"` is a real word but low practical risk on our corpus.)
- **Add Spanish/French variants** with an inline language comment:
    - Same in both languages → one comment: `"oms" /* spanish, french */` (WHO), `"vih"` (HIV), `"sida"` (AIDS), `"fmi"` (IMF), `"omc"` (WTO), `"ocde"` (OECD), `"onu"` (UN), etc.
    - Different per language → separate comments: `"acnur" /* spanish */`, `"hcr" /* french */` (UNHCR).
- **Add British/American spelling variants** where a term is commonly typed both ways: `organization` ↔ `organisation`, `programme` ↔ `program`, `centre` ↔ `center`, `labour` ↔ `labor`. **But skip** names whose official spelling is fixed and the variant is implausible (e.g. US agencies like CDC "Centers", BLS "Bureau of Labor Statistics").
- **A shorter query catches the longer one, so trim redundant prefixes/words.** `"bureau of labor statistics"` already matches every result of `"u.s. bureau of labor statistics"`, so don't add `us` / `u.s.` / `united states` / `united nations` / `un` prefixes — keep the shortest _distinctive_ form. Two guardrails: (a) don't trim so far the term becomes generic (`"development programme"` is too broad for UNDP — keep `"un development programme"`); (b) keep proper brand names intact (`"un tourism"` is the org's actual name; `"tourism"` is too broad).

## Important notes

- Each synonym group is an array of equivalent terms — all terms in a group are treated as interchangeable for search.
- If a same-day `add-synonym-<username>-<date>` branch and PR already exist, continue on them (commit + push to the open PR) rather than forcing a brand-new branch.
- When adding _producer/organization_ synonyms specifically, you can validate relevance against the data: real producers live in the grapher `origins` table, and you can rank them by how many published charts they back (join `origins` → `origins_variables` → `chart_dimensions` → `charts`) to focus on high-value omissions.
- Country name synonyms are handled separately via the `countries` utility and should NOT be added to this file. If the user asks for a country synonym, explain this and point them to the country data instead — unless it's a geographic term not covered by the countries list (like "gaza", "palestine" which are already in the file).
- The synonyms in this file are pushed to Algolia during deployment via `baker/algolia/configureAlgolia.ts`. No manual Algolia action is needed.
- Common typos can be included as synonyms (see existing examples like "happyness", "c02").
