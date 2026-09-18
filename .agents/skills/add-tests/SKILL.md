---
name: add-tests
description: Inspect the current pull request, stacked pull requests, branch, or working-tree change; draft a risk-based test plan; interview the user to agree on what deserves testing, the faithful test boundary, representative cases, and explanatory comments; then implement the agreed tests. Use when asked to add tests, decide test coverage for current work, test a PR or PR stack, or turn a completed change into a reviewed test plan and test suite.
metadata:
    internal: true
---

# Add Tests

Build agreement on useful evidence before writing tests. Optimize for the
smallest suite that rejects plausible regressions, not for test count or blanket
coverage.

## 1. Read the testing policy

Read `docs/testing-strategy.md` in full before inspecting or proposing tests.
Treat it as authoritative. Also read every applicable `AGENTS.md` and any
area-specific testing documentation for files likely to change.

Do not edit tests or production code yet.

## 2. Establish the review range

Inspect the repository rather than asking the user to restate work that Git can
show. Start with:

- current branch, worktree status, recent commits, and upstream/tracking state;
- the current PR's title, body, base, commits, and changed files when GitHub CLI
  or equivalent PR metadata is available;
- both committed and uncommitted diffs;
- nearby production code, existing tests, fixtures, and test commands.

If the work is a PR stack, identify every PR layer and the parent/base of the
bottom PR. Review both:

1. the cumulative diff from the stack base to the current tip, to understand the
   final contract; and
2. each layer's diff and stated intent, to identify guarantees introduced or
   changed at that layer.

Do not assume the default branch is the right base. Prefer PR metadata and merge
bases. If stack metadata is unavailable, infer the likely range from local
history, state the inference, and ask the user to confirm it before relying on
the plan.

Separate unrelated dirty-worktree changes from the PR. Never discard or overwrite
them. Call out ambiguity that materially changes the proposed coverage.

## 3. Reconstruct the behavioral contract

Summarize the work in observable terms, not file-by-file implementation terms.
For each behavior, record:

- the claim the change makes;
- the plausible regression or wrong result worth rejecting;
- existing evidence that already protects it;
- the cheapest faithful test boundary;
- important boundaries, counterexamples, sequences, or integrations;
- what should deliberately remain untested and why.

Inspect existing tests deeply enough to avoid duplicating coverage and to follow
local helpers and conventions. Static checks are not runtime evidence. Do not
propose a database, browser, SVG, built-package, or external-runtime test unless
the claim depends on that boundary.

For a bug fix, determine whether a focused test can fail against the pre-fix
behavior for the expected reason. Recommend red/green verification when it is
safe and useful, but do not revert broad changes or disturb unrelated work merely
to demonstrate failure.

## 4. Present a first-draft plan

Present the draft before making changes. Keep it concrete enough that the user
can disagree with individual choices. Use this structure:

### Contract and risk

A short account of the behavior and the failures that matter.

### Existing evidence

Name relevant tests and say exactly what they already prove or fail to prove.

### Proposed tests

For each proposed test or coherent group, specify:

| Field | Content |
| --- | --- |
| Claim | Observable rule protected |
| Boundary | Unit/state/component, DB/API, browser, SVG, artifact, runtime, or manual |
| Cases | Representative success, boundary, failure, and sequence cases only where distinct |
| Evidence | Concrete assertions that distinguish correct behavior from likely regressions |
| Placement | Proposed test file or suite |
| Cost | Runtime, fixture, brittleness, or maintenance tradeoff |

Include the focused commands that would validate the finished tests.

### Deliberate exclusions

List tempting cases or higher-level regimes not proposed, with the equivalence,
low risk, existing evidence, or cost reasoning that justifies omitting them.

### Proposed explanatory comment

Show the exact draft comment that would appear above the test group. Match its
detail to the work:

- use no comment for an obvious local rule when names and fixtures explain it;
- use a few sentences for a feature spanning non-obvious cases;
- use several short paragraphs for a PR stack or core mechanism when reviewers
  need the architecture, partition choices, or intentional omissions.

Prefer a comment that explains strategy and case selection, not mechanics. For
example:

```ts
// These cases exercise the two ways a saved selection can become invalid:
// removing the selected option and loading a URL that names a missing option.
// We assert both visible state and serialized URL state because either can
// regress independently; other missing-option inputs follow the same path.
```

If no comment is warranted, show **No top-level comment proposed** and explain
how the test names and visible inputs carry the contract instead.

## 5. Interview the user

After the draft, stop and interview the user before editing. Ask decision-shaped
questions grounded in the inspected diff, not generic questions. Cover all of:

1. **Value:** Are the identified behaviors the ones worth protecting? Should any
   proposed case be removed or any omitted risk promoted?
2. **Boundary:** Does the user agree with the proposed test regime, especially
   any choice between a cheaper in-process test and a faithful integration,
   browser, renderer, artifact, or runtime boundary?
3. **Depth and explanation:** Is the number of scenarios appropriate, and is the
   exact draft top-of-test comment too sparse, right-sized, or too detailed?

Give a clear recommendation and the tradeoffs. When an interactive question tool
is available, ask one to three concise questions at a time with concrete options
and put the recommended option first. Otherwise ask in prose. Follow up on
disagreement until the claims, boundary, cases, assertion strength, and comment
level are explicit enough to implement.

Do not treat silence as approval. Do not start implementation until the user
agrees. Preserve the agreed plan across later turns unless new evidence or a scope
change requires another decision.

## 6. Implement the agreement

Once approved:

1. Add only the agreed tests and support code. Keep behavior-defining inputs and
   expected results visible; compress incidental plumbing.
2. Use explicit, discriminating assertions, including absence, ordering,
   completeness, or intermediate state where contractual.
3. Keep expected results independent of the production rule under test.
4. Add the agreed explanatory comment verbatim or report why new evidence makes
   a revision necessary before changing its substance.
5. For a well-understood regression, demonstrate the expected pre-fix failure
   when practical, then restore the implementation and show the passing result.
6. Run the focused tests first, then the relevant repository checks from
   `AGENTS.md`. Report environmental limits and pre-existing failures separately.

If implementation reveals a materially different risk, boundary, or required
scenario, stop and amend the plan with the user rather than silently expanding
the suite.

## 7. Report evidence

Summarize what each new test proves, what remains outside automated coverage, and
the exact commands and results. For stacks, distinguish cumulative guarantees
from tests that belong to an individual PR layer so reviewers can decide where
the test commit should live.
