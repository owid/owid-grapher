# Testing strategy

This document tells coding agents how to choose, discuss, and write tests when
changing this repository. It should also help engineers understand and review
those choices. It records the current testing regimes and proposes a direction
to validate against real changes, defects, runtime, and maintenance cost.

## Principles

1. **Test in proportion to risk.** A change does not deserve tests merely
   because it changed code. The test plan should reflect the importance of the
   behavior, the likelihood and impact of regression, and how easily a failure
   would otherwise be detected.
2. **Write tests for the reviewer to read first.** The ideal test suite is an
   inviting introduction to a pull request: it makes learning the scope,
   important behavior, and impact of the change pleasant before the reviewer
   reads its implementation. A small number of well-explained scenarios is
   more useful than comprehensive-looking test noise.
3. **Prefer the lowest-cost boundary that proves the claim.** Start with a
   deterministic unit or state-level test. Cross process, database, browser,
   rendering, packaging, or deployment boundaries only when the behavior
   depends on them.
4. **Test invariants and representative partitions, not permutations.** Derive
   the meaningful dimensions, identify equivalence classes and risky
   interactions, then choose cases that explain the rule. Do not generate a
   Cartesian product to increase a coverage number.
5. **Agree on intent with the user.** An agent must ask the engineer directing
   the work about testing strategy rather than silently generating tests. The
   engineer owns which claims are important; the agent helps expose options,
   risks, fixtures, and edge cases.
6. **Make failures actionable.** A failure should identify the behavior that
   regressed and provide enough diagnostics to reproduce it. Flaky tests are
   defects in the feedback system, not an accepted cost of broad coverage.

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

## Explain the rationale in the test file

Every meaningful group of tests should briefly explain:

- why this behavior is important enough to protect;
- the invariant or contract being protected; and
- how the scenarios below exercise that invariant.

Use terse domain language. In a short test file, put this explanation near the
top, after imports and before the tests. In a large file that covers several
behaviors, divide it into coherent `describe` sections and put a short
explanation before each group. Do not add a comment that merely restates the
test names or implementation.

The explanation and scenarios should form a readable outline of the change.
A reviewer opening the tests first should understand what matters, where the
behavioral boundaries are, and why omitted permutations are equivalent. Keep
incidental setup out of that narrative while leaving significant input values
visible.

## Choosing tests for a change

Before writing tests, an agent should discuss the strategy with the user. Use
these questions to make the options concrete rather than asking only “Should I
add tests?”:

1. **Behavior:** What user-visible behavior or system invariant changes?
2. **Risk:** What plausible regression would matter, and how severe would it
   be?
3. **Boundary:** What is the cheapest test boundary that would catch that
   regression for the right reason?
4. **Scenarios:** Which representative cases explain the rule? Which apparent
   permutations are equivalent and intentionally omitted?
5. **Evidence:** Which automated checks and manual observations demonstrate
   the result?
6. **Depth:** Should the change receive a minimal regression test, a focused
   set of representative cases, or broader boundary and failure coverage?

Offer two or three reasonable setups with their tradeoffs when the answer is
not obvious. Recommend one, but let the user choose the intended confidence
and maintenance cost. Record the resulting rationale in the test file and
summarize it in the pull request when it helps review.

The timing of this conversation depends on the work:

- **Regression or well-understood behavior change:** ask before implementation.
  Propose reproducing the undesired behavior with a failing test first; TDD is
  often the clearest way to prove that the test detects the bug and the change
  fixes it.
- **Large or exploratory feature:** do not force a detailed suite onto a design
  that is still moving. Iterate until the engineer is happy with the behavior.
  Before preparing the pull request, interview them about the important
  invariants, suitable test boundary, representative scenarios, failure cases,
  and desired depth. Then implement the agreed test plan.
- **Small, obvious change:** ask briefly or present the proposed strategy as a
  confirmable default. The user may decide that existing checks are sufficient.

A useful default by change shape is:

- **Refactor with no intended behavior change:** existing focused tests plus a
  broad detector where relevant (for example SVG or package tests). Add a test
  only if review reveals an undocumented invariant.
- **Bug fix:** first capture a minimal failing example at the lowest faithful
  boundary; make the fix; preserve the regression test. Use before/after
  evidence when practical.
- **New domain rule:** concise examples for the main rule, meaningful boundary
  conditions, and one counterexample. Prefer table-driven cases only when the
  table remains easier to understand than separate scenarios.
- **New or changed critical interaction:** state-level tests for rule detail
  plus one browser test for the integrated user journey.
- **Persistence or API change:** unit-test extracted logic and add focused
  database/API integration evidence for the actual boundary.
- **Rendering change:** focused semantic assertions for intent and SVG
  regression review for breadth.
- **Packaging or runtime change:** exercise the built artifact or deployed
  runtime rather than relying on source imports.
- **Trivial or mechanically safe change:** explain why existing checks are
  sufficient; adding no test can be the correct decision.

## Readability standard

Assume that a pull request reviewer will open the tests before the production
code. The tests should reward that choice: after one pass, the reviewer should
have a clear mental model of the behavior, the important invariants, the
change's impact, and the evidence that it works. Optimize for a coherent
reading experience, not only for execution:

- introduce each group with the terse rationale described above;
- describe outcomes in domain language rather than method-call language;
- order scenarios so they tell a story: normal behavior, meaningful boundary
  cases, then failures or counterexamples;
- make the reason for non-obvious scenarios explicit in the test name or a
  short comment;
- use realistic but minimal fixtures;
- extract setup that is incidental, but do not hide the values that make a
  scenario meaningful;
- assert the smallest stable observable result that proves the claim;
- avoid snapshots when reviewers cannot readily judge the serialized output;
  and
- do not weaken assertions or add retries merely to make an intermittent test
  pass.

For layered Grapher behavior, first state the precedence or inheritance rule,
then cover the distinct sources and the interactions most likely to violate
that rule. Do not mirror every layer against every chart type unless those
combinations genuinely have different behavior.

## Workflow for coding agents

Your job as a coding agent is to increase the quality of evidence, not the
quantity of test code:

1. Summarize the intended behavior and enumerate plausible risks.
2. At the appropriate time described above, interview the user about the test
   boundary, scenarios, failure cases, and desired depth. Offer concrete
   options and a recommendation.
3. For a regression, offer to reproduce the defect with a failing test before
   changing production code. Confirm that it fails for the expected reason.
4. Implement only the agreed representative scenarios. Introduce each group
   with its rationale and keep fixtures subordinate to the behavioral story.
5. Read the tests on their own, in the order a reviewer will encounter them.
   Rewrite them if they do not explain the change without production-code
   archaeology.
6. Run each relevant regime and report what its result proves. Do not present
   typechecking, linting, or formatting as behavioral evidence.
7. If review exposes an uncovered concern, propose one focused scenario and,
   where practical, demonstrate that it fails before adjusting the
   implementation.

Generated tests should not be accepted because they raise line or branch
coverage. Coverage can reveal unexamined code, but it cannot decide whether a
scenario is meaningful. Never generate permutations without explaining the
distinct risk represented by each one.

## Recommended experiments

Before changing the whole suite, run a few bounded experiments:

1. **Add direct Playwright coverage for two Grapher behaviors.** Choose one
   navigation/state journey (such as tab and URL synchronization) and one
   visual-control journey (such as binning). Keep each test centered on a
   single user story and record runtime and failure diagnostics.
2. **Compare direct Playwright with Gherkin.** Implement or rewrite one small
   behavior each way. Ask reviewers which version communicates intent better
   and measure the indirection and maintenance involved. Preserve support for
   both styles during the experiment.
3. **Pilot test rationales on substantial PRs.** Add the five-question
   rationale above to a small sample of pull requests, then assess whether it
   improves review and whether any question becomes boilerplate.
4. **Practice reviewer-added regression tests.** On suitable bug fixes, have a
   reviewer contribute one missing scenario before approval and record whether
   it exposed a real ambiguity or merely duplicated coverage.
5. **Classify failures for a month.** For each CI or pre-merge failure, record
   regime, true regression versus infrastructure/flakiness, time to diagnose,
   and whether the failure message identified the relevant behavior.

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
