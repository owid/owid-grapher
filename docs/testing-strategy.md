# Testing strategy

Use this guide when choosing, writing, or reviewing tests. Tests should explain
important behavior to reviewers and give agents a clear contract to preserve.
Optimize for useful evidence, not test count or minimum suite size.

## Agent checklist

1. **State the claim and risk.** What behavior matters, and what plausible wrong
   result must the test reject? Existing coverage may already be enough.
2. **Agree on the strategy.** Discuss the boundary, representative scenarios,
   failure cases, and depth with the engineer, then recommend a concrete plan.
   Carry an agreed plan forward unless a new risk or scope change needs a decision.
3. **Choose the cheapest faithful boundary.** Prefer deterministic in-process
   tests, but use MySQL, a browser, the SVG renderer, a built package, or the
   Workers runtime when the claim depends on it. Most changes need only one or
   two regimes.
4. **Use discriminating evidence.** Assert explicit results that distinguish
   correct behavior from plausible regressions. For a well-understood bug, propose
   a failing test first and confirm that it fails for the expected reason.
5. **Make tests self-explanatory.** Name the rule, expose significant inputs, and
   keep incidental setup subordinate. Explain the strategy in proportion to the
   change: perhaps nothing for an obvious tweak, a few sentences for a feature,
   or several paragraphs for a stack that changes a core mechanism.
6. **Preserve guarantees when rewriting.** Follow the refactoring protocol below;
   passing before and after does not prove equivalence.
7. **Run relevant checks and report limits.** Static checks prove structural
   validity, not runtime behavior. Separate incomplete or pre-existing failures
   from regressions.

For well-understood regressions and changes suited to red/green TDD, discuss the
test plan and TDD before changing code. For exploratory work, agree on invariants
once behavior stabilizes and before preparing the PR. For a small, obvious change,
propose a brief default, including when existing checks suffice. Use property-based
tests where they fit, such as checking serialization round trips.

## Writing high-value tests

A meaningful test group says why the behavior matters, which contract it protects,
and how its cases exercise that contract. Prefer names and fixtures that make this
clear; add explanatory prose when it provides context that the tests cannot
express clearly on their own. Organize cases around the rule, its boundaries, and
counterexamples.

### Write tests as executable review guides

Test suites should help reviewers understand the behavioral contract of the code:
how an API is intended to be used, which invariants it preserves, and which
plausible failures it must reject. Prefer clear suite structure, test names,
fixtures, and assertions over explanatory prose when they are sufficient, but do
reach for prose to make substantial new test files easier to understand.

Add a file-level overview when the purpose or organization of a new test suite is
not obvious from the tests themselves. For a focused suite, this may be one or two
sentences describing the protected contract. For a substantial feature or a change
to a core architectural mechanism, explain:

- the responsibility and boundary under test;
- the intended use of the API or mechanism;
- the key invariants;
- the important failure modes;
- and, where useful, how the suite and its core assertions demonstrate them.

Write the overview as enduring documentation of the behavior, not as a history of
the PR that introduced it. Keep significant inputs and expected results visible in
individual tests, and update the overview when the suite's contract or organization
changes. Do not add a header that merely repeats the filename or test names.

### Make assertions discriminating

Assert the parts of the result that define the contract, including completeness,
ordering, absence, and intermediate state where relevant. Containment does not
prove exact membership or ranking; a row count does not identify the surviving
rows; empty results can satisfy upper-bound checks and `every`.

Use exact comparisons for small contractual outputs. When unrelated metadata is
incidental, project onto relevant fields, but do not weaken an existing exact
comparison during a refactor. Use snapshots only when a reviewer can judge them.

Expected results must be independent of the rule under test. Production code may
help with incidental fixture setup, but it must not calculate the expected answer
for the transformation being tested. Integration tests may rely on separately
tested helpers; state what that leaves unproven and assert important conflicts
directly.

### Compress plumbing, preserve distinctions

- Extract small builders or request helpers for incidental setup; keep
  behavior-defining inputs and expected results at the call site.
- Keep builders local until several suites need the same semantic vocabulary.
  Promote shared test helpers deliberately, and do not add test-only exports to a
  published package unless that consumer-visible surface is intentional.
- Use named table rows when setup, action, and assertion shape are the same. Keep
  unrelated rules or control flow separate instead of adding conditional assertions.
- Preserve multi-step scenarios when the sequence is the regression, including
  meaningful intermediate assertions.
- Choose representative partitions and risky interactions. Explain why omitted
  cases are equivalent; similar outputs do not prove equivalent paths or transitions.
- Avoid Cartesian products without a distinct risk for each dimension. Exhaustive
  coverage is appropriate for small finite sets of contractual options.
- Fix flaky isolation, diagnostics, or fixtures; do not hide failures with weaker
  assertions or retries.
- Make generated fixtures deterministic by default. Randomized helpers should accept
  a seed; genuinely randomized or property-based runs should report the seed on
  failure so the case can be reproduced.
- Keep assertions and behavior-producing setup inside named tests or their hooks.
  Suite callbacks should organize and register tests, not perform verification at
  collection time.

### Make failures reviewable

A regression suite is useful only if a reviewer can understand and act on its
results. For suites that can produce many failures or diffs, preserve enough context
to diagnose each result, distinguish unchecked work from an actual failure, and
prioritize the most consequential changes. When review is long-running, make progress
resumable where practical without allowing stored results to outlive the run they
describe.

Measure representative runtime, memory, or artifact-size costs when changing a
high-volume test path. Report the trade-off rather than weakening evidence solely to
make the suite faster. Detection remains the test's job; ranking and summaries help
reviewers triage results but must not silently redefine what passes.

## Refactoring tests without losing guarantees

A test rewrite changes the evidence. Preserve both the boundary and the assertions:
a state test does not replace API persistence evidence, even with the same values.

1. **Inventory existing guarantees.** For each assertion or coherent group, record
   significant inputs, action or sequence, expected property, and replacement.
   Include negative assertions and intermediate states; names alone are not proof.
2. **Separate restructuring from stronger evidence.** First preserve inputs,
   values, matcher strength, checkpoints, and boundary while improving structure.
   Add stronger assertions in a later commit or stacked PR, and record gaps between
   test names and actual evidence.
3. **Account for every removal.** Map each removed assertion to an equivalent
   replacement. Explain why any removed case adds no distinct protection; reducing
   protection requires an explicit review decision.
4. **Compare evidence, not counts.** Run the focused suite before and after, then
   compare assertions and inputs. For an important or ambiguous guarantee,
   temporarily introduce a targeted defect and confirm both suites reject it for
   the intended reason. Restore it and rerun. Mutation checks add confidence but
   do not prove equivalence.
5. **Keep review bounded.** Prefer one coherent behavior group per PR. Put the
   preservation mapping, intentional evidence changes, and validation results in
   the PR's Details block. Do not maintain a duplicate suite or build a general
   test DSL merely to shorten a pilot.

Example preservation mapping:

| Existing evidence                                                         | Replacement                                                     | Evidence change                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| One deduplicated topic for an original query plus its synonym             | Same query, synonym map, and count assertion behind named setup | None                                  |
| A test name claims the highest score wins, but only checks count          | Add an explicit expected score in a follow-up                   | Stronger evidence; a pre-existing gap |
| A tab round trip checks empty → populated → empty selection and URL state | Keep all checkpoints in the same scenario                       | None                                  |

A useful review asks which plausible defects the tests detect, where expected
behavior is visible, and what evidence changed. LOC and runtime are secondary;
neither measures semantic preservation.

## Repository test regimes

Choose the regime whose boundary the claim depends on. These are complementary,
not levels every change must climb.

### Static verification

The main CI workflow runs TypeScript project-reference checks, oxlint, formatting,
and generated-Raycast-snippet consistency checks. BundleMon builds the public-site
bundle and enforces compressed JS and CSS budgets. These catch broad structural
changes but do not establish runtime behavior.

### In-process tests (Vitest)

The default `vitest.config.ts` suite covers pure functions, state models, parsers,
URL migrations, serializers, React components in a DOM-like environment, chart
layout, and other package and application code. React Testing Library cleanup is
global.

This is the default for transformations, domain rules, state transitions, derived
values, rendering that needs no browser engine, small regression fixtures, and
in-process module contracts. Test observable rules and avoid large, opaque fixtures
or implementation-detail assertions.

### Database and admin API integration tests

`make dbtest` starts a dedicated MySQL 8 container, applies migrations, and runs
`vitest.db.config.ts`. Use it for SQL semantics, migrations, triggers, views,
constraints, transactions, persistence, and the assembled admin HTTP boundary.
The suite is serialized because tests share a database and fixed application port,
so cleanup must prevent leakage. Keep logic that does not require MySQL in Vitest.

### Browser behavioral tests

Direct Playwright tests run in Chromium, Firefox, and WebKit. Current scenarios
cover search and Wikipedia-archive requests against a running baked site; they are
not in the main GitHub Actions CI workflow.

Use browser tests for critical behavior involving real layout and events,
navigation/history, accessibility interactions, network requests, or the baked
site plus embedded Grapher. High-value candidates include tabs, bins, selections,
URL state, and a small set of critical journeys. Keep the tests readable as direct
user journeys, with shared helpers limited to incidental setup and repeated locators.

### SVG output regression tests

The SVG tester renders production-like chart, Grapher-view, multidimensional-view,
and thumbnail fixtures, then compares normalized output with references in a
sibling repository. Use it when Grapher rendering may change. It detects broad
visual changes but does not explain correctness; focused tests should name key
invariants, and humans must classify diffs and keep references current.

### Built-package contract tests

The Grapher package workflow builds and packs the publishable artifact, then checks
JS imports, DOM mounting, declarations, metadata, and export/type resolution.
These tests sit outside Vitest because the artifact must exist first. Use them for
consumer-visible contracts that source tests and repository typechecking cannot prove.

### Runtime and external-service tests

`functions/test` includes Node integration tests and opt-in E2E tests against a real
Workers runtime or services such as Algolia and R2. They protect runtime and service
assumptions that mocks cannot prove, but external state makes them slower and less
deterministic. Keep them narrow, clearly labelled, and outside the fast suite unless
their environment is reliable.

### Bespoke project tests and builds

The separate `bespoke` workspace has its own required typecheck, Vitest, and build
jobs, preserving its independent dependency graph. Projects can add focused tests
for domain logic and reusable helpers.

## Regime summary

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
