# Testing strategy

Use this guide when choosing, writing, or reviewing tests. Tests should explain
important behavior to a reviewer and give agents a clear contract to preserve.
Optimize for useful evidence per line of maintained code, not a target test count
or the shortest possible suite.

## Agent checklist

1. **State the claim and risk.** What behavior matters, and what plausible wrong
   result should the test reject? Existing coverage may already be sufficient.
2. **Agree on the strategy.** Discuss the boundary, representative scenarios,
   failure cases, and depth with the engineer. Recommend a concrete plan. An
   already-agreed strategy carries forward; ask again only when a new risk or
   change of scope requires a decision.
3. **Choose the lowest-cost faithful boundary.** Start with deterministic
   in-process tests. Use a database, browser, renderer, built package, or Workers
   runtime when the claim depends on that boundary. Most changes need one or two
   regimes, not every regime below.
4. **Make the evidence discriminating.** Use explicit expected results that
   distinguish correct behavior from plausible regressions. For a bug fix,
   propose a failing test first and check that it fails for the expected reason.
5. **Make the tests readable on their own.** Name the rule, expose significant
   inputs, and explain non-obvious scenarios. Keep incidental setup subordinate
   to the behavior.
6. **Preserve existing guarantees when rewriting tests.** Follow the refactoring
   protocol below. Passing before and after is not evidence of equivalence.
7. **Run relevant checks and report their limits.** Static checks establish
   structural validity, not runtime behavior. Report incomplete checks and
   pre-existing failures separately from regressions.

For a well-understood regression, discuss the test plan and TDD before changing
production code. For exploratory work, agree on the important invariants once
the behavior stabilizes and before preparing the PR. For a small obvious change,
propose a brief default, including when existing checks suffice.

## Writing high-value tests

A meaningful group should explain why the behavior matters, which contract it
protects, and how its cases exercise that contract. Use a short comment where
names and fixtures do not already communicate the rationale; avoid boilerplate
that merely repeats the tests. Order cases around the rule, its boundaries, and
counterexamples.

### Assertions must distinguish plausible wrong results

Assert enough to reject the wrong outcomes that matter. Include completeness,
ordering, absence, and intermediate state when they are part of the contract.
A containment assertion does not prove exact membership or ranking; a row count
does not prove which rows survived. Empty results can satisfy an upper-bound
check, and an empty array can satisfy `every`.

Use exact comparisons for small contractual outputs. Project onto relevant
fields when unrelated metadata is incidental, but do not silently replace an
existing exact comparison with a weaker subset comparison during a refactor.
Snapshots are useful only when a reviewer can judge the output.

Expected results must be independent of the rule under test. A fixture helper
may call production code for incidental setup, but do not calculate the expected
answer with the transformation whose correctness the test claims to establish.
Integration tests may rely on separately tested helpers; be explicit about what
that reliance leaves unproven, and assert important conflicting values directly.

### Compress plumbing, preserve distinctions

- Use small fixture builders or request helpers for incidental setup. Keep
  behavior-defining input values and expected results at the call site.
- Use named table rows when setup, action, and assertion shape are the same.
  Include a readable case name in the failure output. Do not add conditional
  assertions to make unrelated scenarios fit one table.
- Keep separate cases when the rule, control flow, or failure explanation differs.
  Keep a multi-step scenario when the sequence itself is the regression, and
  assert intermediate states that make the sequence meaningful.
- Choose representative partitions and risky interactions. Explain why omitted
  cases are equivalent; similar final outputs alone do not establish equivalence
  across different paths or state transitions.
- Avoid generated Cartesian products without a distinct risk for each dimension.
  Small finite sets of contractual options can appropriately cover every option.
- Do not weaken assertions or add retries to hide flaky tests. Improve isolation,
  diagnostics, and fixtures instead.

For example, scatter label strategies can use three named rows: year → `"2000"`,
y → `"2"`, and x → `"1"`, sharing a point whose coordinates are visible in the
fixture. All three options remain covered. In contrast, the scatter-tab round
trip tests in `GrapherState.test.ts` need intermediate selection assertions and
separate cases for explicit user changes and scatter-only charts. Those are
distinct contracts, not interchangeable rows.

## Refactoring existing tests without losing guarantees

Treat a test rewrite as a change to the evidence. Preserve the boundary being
exercised as well as the assertions: a state test does not replace API persistence
evidence even when its expected values match.

1. **Inventory the old guarantees.** For each assertion or coherent assertion
   group, record its significant inputs, action/sequence, expected property,
   and replacement location. Include negative assertions and intermediate states.
   Test names are a starting point, not proof of what is currently covered.
2. **Separate structure from stronger evidence.** First preserve inputs, expected
   values, matcher strength, checkpoints, and test boundary while naming cases,
   extracting plumbing, or grouping tests. Put added or strengthened assertions
   in a subsequent commit or stacked PR. Record gaps between names and actual
   assertions rather than silently claiming the old suite protected them.
3. **Account for every removal.** Map each removed assertion to an equivalent
   replacement. Removing a case as redundant requires an explanation of why its
   inputs and path add no distinct protection. Any intentional reduction in
   protection must be an explicit review decision.
4. **Check the mapping and execution.** Run the focused suite before and after.
   Compare assertions and case inputs, not just test counts or line coverage.
   For an important or ambiguous guarantee, temporarily introduce a targeted
   defect and verify whether old and new tests reject it for the intended reason.
   Restore the defect and rerun the final suite. Mutation checks add confidence;
   they are not a proof of equivalence and need not be exhaustive.
5. **Keep review bounded.** Prefer one coherent behavior group per PR. Put the
   preservation mapping, intentional evidence changes, and validation results in
   the PR's Details block. Avoid maintaining a second permanent copy of the suite
   or a general-purpose test DSL solely to shorten a pilot.

Example preservation mapping:

| Existing evidence                                                         | Replacement                                                     | Evidence change                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| One deduplicated topic for an original query plus its synonym             | Same query, synonym map, and count assertion behind named setup | None                                  |
| A test name claims the highest score wins, but only checks count          | Add an explicit expected score in a follow-up                   | Stronger evidence; a pre-existing gap |
| A tab round trip checks empty → populated → empty selection and URL state | Keep all checkpoints in the same scenario                       | None                                  |

A useful review asks: which plausible defects can these tests detect, where can
I see the expected behavior, and what evidence changed? LOC and runtime are
secondary measurements; neither measures semantic preservation.

## What exists today

The repository already has useful tests at several boundaries. The problem is
less a lack of mechanisms than an unclear shared model for choosing between
them.

### Static verification

The main CI workflow runs TypeScript project-reference checking, oxlint,
format checking, and a generated-Raycast-snippet consistency check. BundleMon
builds the public-site bundle and enforces compressed JS and CSS budgets.
These are fast, broad change detectors, but they do not establish runtime
behavior and should not be presented as behavioral test coverage.

### In-process tests (Vitest)

The default `vitest.config.ts` suite is the largest and fastest behavioral
regime. It covers pure functions, state models, parsers, URL migrations,
serializers, React components in a DOM-like environment, chart layout, and
other code across packages and applications. React Testing Library cleanup is
installed globally.

These tests are the default for:

- pure transformations and domain rules;
- state transitions and derived values;
- rendering behavior that does not require a browser engine;
- regression examples with small, explicit fixtures; and
- contracts between modules that can be exercised in one process.

Their main risk is over-testing implementation details or constructing large
fixtures whose purpose is hard to see. Tests should name observable rules and
keep setup close to the minimum necessary to demonstrate them.

### Database and admin API integration tests

`make dbtest` starts a dedicated MySQL 8 container, applies migrations, and
runs the tests selected by `vitest.db.config.ts`. The suite covers database
behavior and admin API flows against a real application and database. It is
serialized because tests currently share a database and a fixed application
port, and cleanup must prevent state leaking between tests.

Use this regime for claims that depend on SQL semantics, migrations, triggers,
views, constraints, transactions, persistence, or the assembled admin HTTP
boundary. Keep business logic that does not require MySQL in the faster
in-process suite.

### Browser behavioral tests (Playwright with BDD generation)

The Playwright setup currently generates tests from feature files and runs
them in Chromium, Firefox, and WebKit. The checked-in scenarios cover search
flows and Wikipedia-archive request behavior against a running baked site.
The scripts support local interactive use, but these tests are not part of the
main GitHub Actions CI workflow.

This is an underused capability. Browser tests are the appropriate evidence
for critical behavior that crosses real browser layout/events, navigation and
history, accessibility interactions, network requests, or integration between
the baked site and an embedded Grapher. Candidate journeys include changing
Grapher tabs, manipulating bins or selections, preserving URL state, and
checking a small set of high-value site journeys.

The valuable boundary here is Playwright, not necessarily the Gherkin
translation layer. The repository should experiment with direct Playwright
tests alongside the existing feature-based tests and compare readability,
diagnostics, reuse, and authoring cost before standardizing on either style.

### SVG output regression tests

The SVG tester renders stored production-like chart, Grapher-view,
multi-dimensional-view, and thumbnail fixtures and compares normalized SVG
output with references in a sibling repository. It gives unusually broad
rendering coverage without browser interaction and produces artifacts for
human inspection when output changes.

Use it when Grapher rendering may change. It is a broad change detector, not a
substitute for a focused behavioral test: an intentional visual diff says
that output changed, while a named test explains the invariant that must hold.
Reference freshness and human classification of diffs are part of the regime.

### Built-package contract tests

The Grapher package workflow builds and packs the publishable artifact, then
checks JS imports, DOM mounting, bundled declarations, package metadata, and
exports/type resolution. These tests deliberately sit outside the default
Vitest suite because the artifact must exist first.

Use this boundary for consumer-visible package contracts that source-level
tests and repository typechecking cannot prove.

### Runtime-specific and external-service tests

The `functions/test` area includes Node-level integration tests and opt-in E2E
tests that run handlers in a real Workers runtime or contact services such as
Algolia and R2. They protect compatibility and integration assumptions that a
mock cannot establish, but external state makes them slower and less
deterministic. They should be narrowly scoped, clearly labelled, and kept out
of the fast suite unless their environment can be made reliable.

### Bespoke project tests and builds

The separate `bespoke` workspace has its own typecheck, Vitest, and build jobs.
This respects its independent dependency graph while still making all three
checks required on pull requests. Individual projects can add tests for their
domain logic and reusable helpers.

## Proposed regimes and responsibilities

| Regime                      | Primary question                                               | Good targets                                                                                   | Avoid                                                    |
| --------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Static checks               | Is the change structurally valid and within policy?            | types, lint rules, formatting, generated files, bundle budgets                                 | claims about runtime behavior                            |
| Unit/state/component        | Does a domain rule or UI state transition hold?                | transformations, invariants, parsers, chart state, focused components                          | internal call sequences and exhaustive combinations      |
| DB/API integration          | Does behavior survive the real persistence or server boundary? | migrations, SQL, transactions, admin endpoints                                                 | logic that can be proven without MySQL                   |
| Browser behavior            | Can a user complete a critical journey in a real browser?      | Grapher interactions, URL/history, keyboard/pointer behavior, cross-page flows, network policy | every rendering or validation branch                     |
| Render regression           | Did broad serialized visual output change?                     | SVGs, chart views, mdims, thumbnails                                                           | explaining why a behavior is correct                     |
| Artifact/consumer contract  | Does what we ship work outside the monorepo?                   | package exports, declarations, mounting built code                                             | source-only implementation rules                         |
| Runtime/service integration | Do deployment-runtime and external-service assumptions hold?   | Workers APIs, R2, Algolia                                                                      | behavior that can be deterministic in process            |
| Exploratory/manual          | Are appearance and unfamiliar interactions acceptable?         | intentional visual review, novel or hard-to-automate UX                                        | repeatable critical regressions that should be automated |

These regimes are complementary rather than levels that every change must
climb. Most changes should use only one or two.

## Recommended experiments

Start with bounded changes to existing tests before adding new infrastructure:

1. Refactor the `findTopicAndRegionFilters` group in `searchUtils.test.ts` using
   named setup options, preserving every existing assertion. Then address any
   gaps between its names and evidence in a separate PR.
2. Apply the same protocol to download-table tests in `GrapherState.test.ts`.
   Make row eligibility and original-time contracts explicit without removing
   chart-specific cases.
3. Simplify chart API request plumbing while preserving the ownership lifecycle,
   persistence checks, and timestamps/version assertions. Review explicit
   expected layer values separately from a structural rewrite.
4. Use the small scatter-label table as a mechanically reviewable example of
   compression without removing cases.

For each pilot, record the preservation mapping, focused run results, meaningful
assertion changes, and any targeted defect checks. Ask reviewers whether they can
understand the contract without production-code archaeology and trace old
assertions to their replacements. Avoid numeric LOC-reduction targets.

Separately, experiment with direct Playwright tests for a critical tab/URL journey
and a visual-control journey. Compare one small behavior with the existing
Gherkin style for readability, diagnostics, fixture stability, and authoring
cost before standardizing. Browser infrastructure and new journey coverage are
separate decisions from making existing in-process tests easier to review.

## Decisions still to make

- Which browser journeys are important enough to block merges, and which
  should run on a schedule or against staging?
- Should direct Playwright become the default while Gherkin remains available
  only where non-code feature text has a clear audience?
- How should browser tests receive stable data while still representing baked
  site and Grapher integration accurately?
- Which owners triage failures and remove or repair flaky tests?
- What runtime budget should each feedback tier have (local focused, pull
  request, scheduled, and release/deployment)?
- Can database tests gain isolated databases and dynamic ports so they can run
  safely in parallel?
- Which SVG suites should be required automatically for rendering changes, and
  how should intentional reference updates be reviewed?

The answers should follow evidence from the experiments rather than a target
count of tests or a universal testing pyramid.
