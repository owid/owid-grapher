---
name: add-tests
description: Inspect the current pull request, stacked pull requests, branch, or working-tree change; draft a risk-based test plan; interview the user to agree on what deserves testing, the faithful test boundary, representative cases, and explanatory comments; then implement the agreed tests. Use when asked to add tests, decide test coverage for current work, test a PR or PR stack, or turn a completed change into a reviewed test plan and test suite. Pass `decide-for-me` to skip the interview and have the agent take its own recommendations.
metadata:
    internal: true
---

# Add Tests

Build agreement on useful evidence before writing tests. Optimize for the
smallest suite that rejects plausible regressions, not for test count or blanket
coverage.

## Modes

- **Interview (default).** Draft a plan, interview the user, and implement only
  what they agree to.
- **Decide-for-me (opt-in).** Use this mode only when the user explicitly asks
  for it: they pass `decide-for-me` as an argument, or say they don't want to be
  interviewed and you should make the testing decisions yourself. Everything
  else stays the same: read the policy, inspect the scope, draft the plan with
  the same care, then take your own recommendation at every decision point that
  would otherwise go to the user. Record each such decision and your reasons, and
  include them in the final report (step 7) so the user can review them
  afterwards. Never infer this mode from silence, urgency, or a
  non-interactive session.

## 1. Read the testing policy

Read `docs/testing-strategy.md` in full before inspecting or proposing tests.
Treat it as authoritative. Also read every applicable `AGENTS.md` and any
area-specific testing documentation for files likely to change.

Do not edit tests or production code yet.

## 2. Establish the review range

If the user names specific files, modules, or behaviors to test, that is the
scope: treat their current behavior as the contract and skip the PR and stack
inspection below, while still reading nearby code, callers, and existing tests.

Otherwise, inspect the repository rather than asking the user to restate work
that Git can show. Start with:

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

| Field     | Content                                                                           |
| --------- | --------------------------------------------------------------------------------- |
| Claim     | Observable rule protected                                                         |
| Boundary  | Unit/state/component, DB/API, browser, SVG, artifact, runtime, or manual          |
| Cases     | Representative success, boundary, failure, and sequence cases only where distinct |
| Evidence  | Concrete assertions that distinguish correct behavior from likely regressions     |
| Placement | Proposed test file or suite                                                       |
| Cost      | Runtime, fixture, brittleness, or maintenance tradeoff                            |

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

In decide-for-me mode, skip this interview: answer each of the three questions
yourself with your recommended option, write down the answer and the tradeoff
you accepted, and proceed to implementation with that as the agreed plan. Ask
anyway only if a decision would be destructive or reach outside the requested
scope, such as changing production code or adding a new dependency.

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
6. Check that the suite rejects breakage. List the decision points in the code
   under test: guard clauses, fallbacks and defaults (`??`, `||`, ternaries),
   predicate edges (what counts as empty, `<` versus `<=`), and special cases.
   Break each one temporarily, for example by dropping the guard, flipping the
   comparison, or swapping the fallback. Run the focused tests, confirm that at
   least one fails, then restore the code exactly. This is a check, not a
   production change, so do it even when told not to modify production code;
   confirm with `git diff` that the code is restored. Make the breaks with direct
   edits; if you write a helper script, put it outside the repository and delete
   it afterwards, so that `git status` shows only the new tests. A decision
   point that no test catches either gets a test or goes under deliberate
   exclusions with a reason. Also re-check any test that claims to exercise an edge, such as
   floating-point tolerance, against the corresponding broken version.
7. Run the focused tests first, then the relevant repository checks from
   `AGENTS.md`. Report environmental limits and pre-existing failures separately.

If implementation reveals a materially different risk, boundary, or required
scenario, stop and amend the plan with the user rather than silently expanding
the suite. In decide-for-me mode, amend the plan yourself and record the change
and its reason for the final report.

## 7. Report evidence

Summarize what each new test proves, what remains outside automated coverage, and
the exact commands and results, including which temporary breakages the suite
caught and which it didn't. For stacks, distinguish cumulative guarantees
from tests that belong to an individual PR layer so reviewers can decide where
the test commit should live. In decide-for-me mode, also list the decisions you
made on the user's behalf (value, boundary, depth and comment level) with a
one-line reason each.
