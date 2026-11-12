# Review guidelines

How pull requests in this repository get reviewed. Written for authors, reviewers and the agents that help them.

## Risk

The author reviews every PR in full before merging it, also when an agent wrote the code. An agent never merges. A PR can also get a risk tier, which says whether a second person should review it and tells that reviewer how much time to spend.

| Tier           | Second review | What the reviewer does                                            |
| -------------- | ------------- | ----------------------------------------------------------------- |
| `risk: low`    | not needed    | nothing                                                           |
| `risk: medium` | recommended   | a focused look at the places the Risk line names, not a full read |
| `risk: high`   | needed        | reads the whole change and tries it on staging where that applies |

The tier is a recommendation. The PR owner decides whether to ask for a review and when to merge. An owner who disagrees with the tier changes the label and says why in the Risk line; those cases are what this file gets corrected from.

### How the tier shows on a PR

- A label: `risk: low`, `risk: medium` or `risk: high`.
- A Risk line at the top of the description (after the attribution line, if there is one): the tier, the reason that decided it, and what a second reviewer should look at. For example: "**Risk: medium.** Changes how row labels are laid out on four chart types, and the SVG tester is muted by `staging-viz`. Look through the SVG diff report at narrow widths."

### How to judge

Risk is about what happens if the change is wrong, not about its size or which folder it sits in. Three questions decide the tier:

1. **Who is affected, and how badly?** A site that is broken or shows wrong data or wrong charts is the worst outcome. Content that is stale or missing because a deploy was missed or delayed is a step below: readers still see a correct, slightly older site. Something only staff see is a step below that. Emails to readers, embeds and the public API count as reader-facing.
2. **Would anyone notice?** A failure that CI, the SVG tester, a type error or a broken staging build would show is less risky than one that quietly produces wrong output. Judge by the outcome and not by the single request: a deploy that stops arriving is noticed within hours even if no error is shown.
3. **How is it undone?** Reverting a commit is cheap. A migration that ran in production, data that was deleted or rewritten, a published package version, or a change that must land or be reverted together with one in another repository are not.

A change that is public, silent and hard to reverse is high wherever its files are. A change that fails loudly, affects only developers and is undone by a revert is low even when it is large.

The areas listed below are prompts for these questions, not verdicts. Each comes with the reason it is listed; when that reason doesn't apply to the change at hand, the three questions win, and the Risk line says so.

**When you are unsure about the change, pick the higher tier.** That rule is for doubt about what the change does. It is not for a list entry that matches on paper while the questions clearly point lower.

### What moves a tier

- **Evidence lowers it by one.** A byte-identical bake diff, a compile-time exhaustiveness check or an SVG diff the author has read lowers real risk. Name the evidence in the Risk line, along with what it doesn't cover, so the reviewer tests the gaps.
- **Safety that the diff can't show doesn't lower it.** If the change is only safe because of something outside the repository (a service account's permissions, DNS records, a pipeline in another repository, a claim about production rows), that is not a mitigation the rater can count. It becomes a reviewer-focus item instead.
- **The riskiest part sets the tier.** A PR that mixes docs with a removed guard is rated on the guard.
- **Whose code it is.** Know who wrote and maintains the code the PR changes, and whether that is the PR's author. A change to code someone else knows better is more likely to miss something the diff doesn't show, so it tips a borderline tier up, and the Risk line names that person as the one to ask.
- **Rate against the base branch.** A PR into an unreleased feature branch reaches nobody on merge, and is usually low. The risk is judged again when the feature branch merges.

### Areas where a mistake is usually expensive (high)

- **Schema migrations in `db/migration/`**, because they are hard to undo once they have run in production. A small, reversible data migration on rows that nothing reads is judged by who reads those rows.
- **Code that deletes or rewrites stored data on its own or irreversibly**: migrations, bake steps, sync jobs, bulk scripts. Stored data includes content in Google Docs and files in R2, not only MySQL.
- **Changes to who can do what**: authentication, permission checks, removing a guard, anything that handles untrusted input, and credentials that grant write access. A key that is meant to be public is not a secret.
- **GitHub workflows that handle secrets, run on untrusted input, or change or skip required checks.** Other workflows are judged on the three questions.
- **Changes that can make the bake write a broken or wrong site.**
- **`functions/` code on the request path of public routes**, because it runs on every request and has no bake step to catch an error first.
- **The public API, schema or documented behaviour of a published package** (`@ourworldindata/grapher`, `@ourworldindata/gdoc-pipeline`, `@ourworldindata/grapher-editor`), because outside consumers pick it up on the next release and a published version can't be taken back. The other packages under `packages/` are internal. Moving bundled dependencies around or changing how a chart is drawn is not an API change.

### Usually medium

- Changes to what readers see on many pages or charts at once (baker output, shared site components, chart rendering) where tests or the SVG diff cover part of the behaviour but not all of it. A helper shared by several chart types counts as many charts, even when the PR is about one.
- A rendering change with the `staging-viz` label, which mutes the SVG tester, unless the description says the author read the diff report.
- Deploy triggering and release tooling: when and how a bake, a deploy or a package release starts. The worst case is stale content or a late release.
- Admin features that authors rely on daily, and admin actions that delete or rewrite data only for drafts or unpublished items, behind a confirmation. The guard is what the reviewer checks.
- Admin features whose output is public, such as redirects.
- Refactors of code with thin test coverage.
- Performance changes to baking or data loading.
- A dependency change that moves the resolved version of a runtime package on the render or bake path.

### Usually low

Docs, tests, devTools, agent instructions (including ones that describe a pipeline without being it), a single self-contained bespoke project, staff-only or feature-flagged UI, rendering changes whose SVG diff the author has looked at, and dependency changes that move no resolved runtime version.

### Rating a PR

Rating is opt-in for now: nothing rates a PR unless its owner asks. Run the `/owid-staff:rate-pr-risk` skill on the PR. It rates with a fresh agent, which matters because the session that wrote the change tends to rate its own work as safe. Rate again when later commits change what the PR touches.
