# Rethinking `numberAbbreviation: "short"` (issue #5172)

> **Status:** implemented on branch `sig-fig-decimal-cap` (PR #6740, which
> also carries the sub-1 cap the changes build on); this doc lives on the
> `docs` branch. Full unit suite, typecheck, lint pass. Outstanding:
> visual check on staging and the SVG snapshot reference update
> (deliberately deferred; SVG tester not run).

## Problem

Slope chart labels show `$25.24k`. That's exactly as wide as `$25,240` but
harder to parse — the abbreviation buys nothing.

## Findings

1. **Why `k` saves nothing:** abbreviated values ignore the author's
   `numDecimalPlaces` and use a hard-coded rule of "always 2 decimals on the
   mantissa" (`getPrecision` in `formatValue.ts`) — so `.24k` is precisely as
   wide as the `,240` it replaces. This rule predates sig-fig rounding (added
   June 2024) and is a fixed-decimal mindset applied to what is inherently a
   significant-figures representation. Abbreviation only pays off on round
   numbers (axis ticks) or when it drops digits.
2. **`numberAbbreviation` conflates two independent dials:** the threshold
   where abbreviation starts (1k for `short`, 1M for `long`) and the suffix
   style (`M` vs ` million`).
3. **`numDecimalPlaces` is already not universally honored** — axis ticks
   override it, and abbreviations show _more_ decimals than configured (a
   `numDecimalPlaces: 0` column renders `$25.24k` today). Its de facto
   semantics are "maximum meaningful decimals": a ceiling, honored exactly on
   full-fidelity surfaces (tooltip, data table), not a mandate for every
   label. The sub-1 sig-fig cap (PR #6740) already follows this reading.

## Decision

For short label contexts (`formatValueShortWithAbbreviations`: slope charts,
map annotations, thumbnails, entity selector, tooltip fallback), three changes
that compose into three clean bands:

| band     | rule                                  | examples                         |
| -------- | ------------------------------------- | -------------------------------- |
| < 1k     | author's decimals, as today           | $0.55 · $999.99                  |
| 1k – 1M  | exact integer, decimals dropped       | $1,235 · $25,241 · $999,999      |
| ≥ 1M     | abbreviate at 3 sig figs (hard-coded) | $1.5M · $12.8M · $1.23B          |

Before/after on a column showing 2 decimals:

| value         | current  | final          |
| ------------- | -------- | -------------- |
| 1,234.56      | $1.23k   | **$1,235**     |
| 25,240.99     | $25.24k  | **$25,241**    |
| 123,456.78    | $123.46k | **$123,457**   |
| 12,840,000.75 | $12.84M  | **$12.8M**     |

Tooltips and the data table keep full author-configured precision — labels are
compression, not the record.

Percent values are exempt from both rules: they were never abbreviated, so
their configured decimals are honored at any magnitude (`1,234.56%` stays).
Guiding principle: the new rules only _replace_ the old abbreviation
override with a milder one — they never override `numDecimalPlaces` where it
used to be respected.

## Why, briefly

- **3 sig figs instead of "+2"** makes abbreviations genuinely short
  (`$12.8M` vs `$12.84M`, `847 million` vs `846.69 million`) and uniformly
  informative — the old rule's precision varied 3–5 sig figs with the
  mantissa width.
- **Threshold 1M** (revised from an interim 100k): with the decimal-drop in
  place, written-out labels are never wider than master's abbreviated forms
  (`621,352` = `621.35k`, 7 chars each), so the width argument for a lower
  threshold evaporated. 1M puts the notation seam on the natural linguistic
  boundary (`$950,000` next to `$1.5M` reads as two kinds of number), avoids
  within-chart mixes like `$89,500` next to `$128k` (GDP per capita straddles
  100k), unifies the `short` and `long` thresholds (the modes now differ only
  in suffix style), and matches the issue's original proposal. User-facing
  rule: value labels never use `k`; millions and up get `M`/`B`.
- **Drop decimals ≥ 1k** because keeping `$25,240.99` contradicts the premise:
  if two mantissa decimals on `$25.24k` are unread noise, cents on a
  five-digit number are too. The integer part stays exact, so the label
  matches the tooltip to the nearest unit.
- **Rejected alternatives:** per-value "use k only when shorter" (mixes
  `$95,000`/`$105k` arbitrarily within one chart); column-adaptive rules (same
  magnitude renders differently across charts); positional sig-figs like
  `$25,200` (second-guesses the author's explicit choice of decimal-places
  mode).

## Scope decisions

- **All `short` consumers adopt the new rule** (slope charts, map
  annotations, line/slope thumbnails, entity selector/picker, tooltip
  fallback, values API, scatter size legend) — worst-case label width doesn't
  grow, so layout risk is low.
- **Axis ticks are pinned to current behavior.** FacetChart (>2 facets) and
  MapSparkline keep abbreviating ticks from 1k (`$25k`): ticks are round
  numbers, so `k` genuinely saves ~3 chars per tick and axis width eats plot
  area. Issue #6279 stays a separate discussion. Mechanism: a new
  `abbreviationThreshold` option that these two call sites set to 1e3.
- **`long` abbreviations move to 3 sig figs too** (`12.84 million` →
  `12.8 million` in tooltips, bar labels, default axis ticks ≥1M) — one
  consistent precision rule for all abbreviations. The decimal-drop rule does
  NOT apply to `long`: tooltips remain the full-precision record.
- Sig-fig columns are only affected by the threshold change (`$25,200`
  instead of `$25.2k`).

## Implementation (done)

1. **Types** (`GrapherTypes.ts`): added `abbreviationThreshold?: number` to
   `TickFormattingOptions`; defaults to 1e6 for both modes, so the modes
   differ only in suffix style.
2. **`formatValue.ts`**:
    - `getType`: abbreviates from `abbreviationThreshold ?? 1e6` instead of
      hard-coded per-mode thresholds.
    - `getPrecision`: abbreviated (`s`-type) values round to a hard-coded 3
      significant figures in decimal-places mode; the `precisionPadding + 2`
      rule is deleted. Sig-fig columns keep using their
      `numSignificantFigures` — the setting deliberately has no effect
      outside sig-fig mode, since authors wouldn't expect it to. Existing
      trim logic keeps `$1.5M` vs sig-fig `$1.50M`.
    - Decimal-drop: in `short` mode, non-percent written-out values `≥ 1e3`
      get an effective `numDecimalPlaces` of 0. Percent values are exempt —
      they were never abbreviated, so the drop would introduce a new
      override of `numDecimalPlaces` rather than replace the old one. (The
      code doesn't gate on rounding mode; in sig-fig mode `numDecimalPlaces`
      only affects sub-1 values, so the drop is a no-op there.)
3. **Pinned ticks**: `FacetChart.tsx` and `MapSparkline.tsx` pass
   `abbreviationThreshold: 1e3`. (3 sig figs is safe for ticks: d3 ticks are
   1/2/5-multiples, ≤3 significant digits — strings unchanged.) No other
   call-site changes.
4. **Tests**: new "short abbreviation bands" describe in
   `formatValue.test.ts` (bands, boundaries like 999,999.99 → `$1,000,000`
   and 1,000,000 → `$1M`, decimal-drop, threshold override, sig-fig columns,
   negatives, percents) plus updated expectations there. Also
   updated: `Axis.test.ts` (setup only — now passes
   `abbreviationThreshold: 1e3` like the tick call sites),
   `GrapherValuesJson.test.ts` and
   `functions/_common/search/constructSearchResultDataTableContent.test.ts`
   (long-mode 3sf strings). `FacetChart.test.ts` needed no changes. Percent
   values keep their configured decimals (`1,234.56%` unchanged) — pinned in
   the bands describe.
5. **Verification**: typecheck, full unit suite (2,063 tests), lint, format
   all pass. Still outstanding: staging visual check (GDP/capita slope
   chart, map annotations, faceted ticks unchanged, tooltips) and the SVG
   snapshot reference update (`owid-grapher-svgs`) — deferred on purpose.

Known visual changes beyond slope charts (accepted): map annotations
`$25.24k → $25,241`, thumbnails, tooltip range fallback, values-API strings,
`12.84 million → 12.8 million`.

## Every rounding change vs master

The rounding changes live in two stacked branches.

### From `sig-fig-decimal-cap` (PR #6740, beneath this branch)

1. **Sub-1 cap on sig-fig rounding** (`getEffectiveRoundingMode`): sig-fig
   values below 1 that would show more decimals than `numDecimalPlaces`
   round to `numDecimalPlaces` instead. _Why:_ sig figs carry no information
   about a quantity's natural resolution — "0.902 deaths" when whole numbers
   are configured (#6157). _Effect:_ 0.902 at 0 dp → `<1`; values ≥1
   untouched; sig figs kept when they fit the cap (0.0012 at 5 dp stays
   `0.00120`).
2. **`<`-notation extended to capped values**: positive values below the
   cap's resolution render `<1` / `<0.01` rather than a bare `0`. _Why:_
   showing nonzero values as zero misrepresents them.
3. **Capped values keep sig-fig trailing zeros** (trim keyed on the
   _configured_ mode). _Why:_ one trailing-zero convention per sig-fig
   column. _Effect:_ 0.997 at 2 dp → `1.00`.
4. **Capped negatives that round to zero render `0`** (−0.4 at 0 dp → `0`,
   −0.7 → `-1`). _Why:_ negatives previously kept full sig-fig precision to
   avoid `-0`, an asymmetry with positives showing `<1`.
5. **Wording updates** (admin `DimensionCard` "…or fewer", explorer
   `ColumnGrammar` docs) — documentation only.

### From `short-number-abbreviation` (this branch)

6. **`short` threshold raised 1,000 → 1,000,000** (matching `long`, so the
   modes differ only in suffix style): compact labels write out everything
   below 1M. _Why:_ `$25.24k` is exactly as wide as `$25,240` (the 2-decimal
   mantissa replaces the comma group) but harder to parse (#5172), and with
   the decimal-drop in place written-out labels never exceed master's
   abbreviated widths, so nothing argued for a seam below the natural one at
   "million". Avoids within-chart notation mixes (`$89,500` next to
   `$128k`).
7. **New `abbreviationThreshold` option, set to 1e3 by the tick call sites**
   (`FacetChart`, `MapSparkline`). _Why:_ ticks are round numbers, where `k`
   genuinely saves ~3 chars/tick and axis width eats plot area (× facets);
   keeps #6279 separate. _Effect:_ faceted/sparkline axes pixel-identical to
   master; option is internal, not persisted.
8. **Abbreviations round to a hard-coded 3 significant figures instead of
   "+2 mantissa decimals"** (`getPrecision`) — `short` and `long`, in
   decimal-places mode; sig-fig columns keep using their
   `numSignificantFigures` (the setting deliberately has no effect outside
   sig-fig mode). _Why:_ abbreviation is inherently a sig-fig
   representation; the old rule predated sig-fig rounding, gave arbitrary
   magnitude-dependent 3–5 sf, and its extra decimals were what made `k`
   pointless. _Effect:_ `12.84 million → 12.8 million`,
   `$663.99 billion → $664 billion`; constant 3 meaningful digits (the
   escape hatch for an indicator needing more is switching it to sig-fig
   mode).
9. **Decimal-drop in `short` mode from 1,000 up**
   (`effectiveNumDecimalPlaces = 0`). _Why:_ once a value needs a thousands
   separator its fraction is noise (`.99` on 25,240 is 0.004%); the integer
   part stays exact so labels agree with tooltips to the nearest unit. With
   abbreviation precision hard-coded at 3 sig figs (change 8), the 1,000
   cutoff is not a second arbitrary constant but 10³ — the point where
   fractional digits fall below the same 3-significant-digit display budget.
   Alternatives evaluated and set aside: deriving the cutoff from
   `numSignificantFigures` (violates "no sig-fig effects outside sig-fig
   mode" and collapses to 10³ anyway once precision is hard-coded), a graded
   digit budget (adds a second constant), per-chart space-driven fallback
   (heavy, converges to the same output on tight surfaces; possible later
   complement). _Effect:_ `$25,240.99 → $25,241`; compact labels cap at
   `$999,999`; `long` contexts (tooltips) keep full decimals. Percent values
   are exempt — never abbreviated, so the drop would introduce a new
   override of `numDecimalPlaces` instead of replacing the old one
   (`1,234.56%` stays). Escape hatch: switch the column to sig-fig mode with
   a high `numSignificantFigures` (e.g. 7 renders `$25,240.99`).
10. **Adaptive precision for abbreviated axis ticks**
    (`abbreviationSignificantFigures`, set in `Axis.getTickFormattingOptions`).
    _Why:_ with abbreviations at a fixed 3 sig figs, ticks on a narrow
    domain at high magnitude (e.g. 10.02M–10.08M) would collide into
    duplicate labels ("10 million, 10 million, 10.1 million"). The axis
    mirrors its existing adaptive-decimals logic: when the tick spacing
    needs more than 3 significant figures, it passes the required precision
    (`sigFigs = magnitude(maxTick) − magnitude(minDist) + 1`). _Effect:_
    narrow-domain ticks render distinct (`10.02M / 10.03M / …`), matching
    master; ordinary axes compute ≤3 and are unaffected.

Changes 1–5 fix spurious precision at the _bottom_ of the scale (sub-1
values); 6–9 fix spurious precision and pointless abbreviation in the
_middle and top_ (thousands and up). Shared principle: `numDecimalPlaces`
and `numSignificantFigures` are ceilings on meaningful precision, honored
exactly on full-fidelity surfaces and interpreted per context everywhere
else.

## Common formatting bundles in the code

Recurring combinations of `TickFormattingOptions`, mostly hard-wired into
named column methods:

1. **Compact value labels** — `formatValueShortWithAbbreviations` =
   `numberAbbreviation: "short"` + unit only if `$`/`£`/`%`. Used by slope
   chart labels, map annotations, globe, line/slope thumbnails, entity
   selector & picker, scatter size legend, the tooltip's too-long fallback,
   the values API. Rounding is the three-band rule: author's decimals below
   1k (`$0.55`), whole numbers to 1M (`$25,241`, `$999,999`), 3-sig-fig
   abbreviations above (`$12.8M`). Long units are dropped — space is the
   point.
2. **The everyday format** — `formatValueShort` with no overrides =
   defaults (`numberAbbreviation: "long"`) + short unit. Used by tooltips,
   discrete bar labels, map/scatter tooltips. Author's settings honored in
   full below 1M (`25,240.99`), spelled-out 3-sig-fig abbreviations above
   (`12.3 million`). `formatValueLong` is identical but with the full unit
   text.
3. **Tooltip table cells** — `formatValueShort` + `trailingZeroes: true`:
   zeros kept (`1.10`) so column values align vertically.
4. **The data table** — `formatValueShort` + `numberAbbreviation: false`,
   forced `roundingMode: decimalPlaces`, `trailingZeroes: true`,
   `useNoBreakSpace: true`. The full-precision record: never abbreviates,
   ignores sig-fig mode so all rows round alike, pads zeros, keeps value and
   unit on one line.
5. **Axis ticks** — `formatForTick` = forced `decimalPlaces` +
   `numDecimalPlaces` computed from tick spacing (ticks need exactly enough
   decimals to distinguish neighbours). Faceted charts (>2 facets) and the
   map sparkline add `numberAbbreviation: "short"` +
   `abbreviationThreshold: 1e3` — the pinned combination that keeps round
   ticks as `25k`.
6. **Map legend bin edges** — `formatValueShort` + forced `decimalPlaces`:
   bin thresholds are author-chosen round numbers, shown exactly as
   configured rather than sig-fig-rounded.
7. **Stacked bar labels** — `formatValueShort` +
   `numDecimalPlaces: max(0, -magnitude + 2)`: a one-off magnitude-adaptive
   override giving ~2 significant digits via the decimal-places mechanism.

The pattern: 1–3 trust the author's settings and vary only compression; 4–7
override pieces of them because the context knows something the author can't
(alignment, tick spacing, bin exactness). Every context that shows less
precision has a fuller sibling (tooltip, data table, download) preserving
the record.

## Changed outputs (from updated test expectations)

Every test-suite expectation that changed, grouped by cause.

**Group 1 — `short` no longer abbreviates below 1M** (threshold 1k → 1M).
Strictly positive in decimal-places mode (more information, ~same width);
in sig-fig mode up to 3 chars wider (`12,300` vs `12.3k`) — the accepted cost
of the fixed rule, with trailing zeros honestly signalling the rounding:

| input      | options                | before  | after  |
| ---------- | ---------------------- | ------- | ------ |
| 1,000      | short                  | 1k      | 1,000  |
| 1,001      | short                  | 1k      | 1,001  |
| 1,009      | short                  | 1.01k   | 1,009  |
| 1,499      | short                  | 1.5k    | 1,499  |
| 12,345     | short                  | 12.35k  | 12,345 |
| 1,234      | short, 1 dp            | 1.23k   | 1,234  |
| 98,712.789 | short, 10 dp           | 98.71k  | 98,713 |
| 1,000      | short, sig-fig mode    | 1.00k   | 1,000  |
| 1,001      | short, sig-fig mode    | 1.00k   | 1,000  |
| 1,009      | short, sig-fig mode    | 1.01k   | 1,010  |
| 1,499      | short, sig-fig mode    | 1.50k   | 1,500  |
| 12,345     | short, sig-fig mode    | 12.3k   | 12,300 |
| 1,234      | short, 2 sf            | 1.2k    | 1,200  |
| 123,456    | short                  | 123.46k | 123,456 |
| 950,000    | short                  | 950k    | 950,000 |
| 999,999    | short                  | 1M      | 999,999 |

**Group 2 — abbreviations rounded to 3 sig figs instead of "+2 mantissa
decimals"** (`short` and `long`). Shorter and uniformly informative; the
watch item is that large values in tooltips now show 3 significant digits
instead of up to 5 (`$663.99 billion → $664 billion`) — the data table and
downloads still carry exact values, and switching a column to sig-fig mode
with a higher `numSignificantFigures` is the escape hatch if an indicator
needs more:

| input           | options                    | before         | after       |
| --------------- | -------------------------- | -------------- | ----------- |
| 12,345,678,901  | long (default)             | 12.35 billion  | 12.3 billion |
| 846,691,846.8   | long                       | 846.69 million | 847 million |
| 123,456,789,012 | long                       | 123.46 billion | 123 billion |
| 663,992,401,664 | values API / search tables | $663.99 billion | $664 billion |
| 682,030,000,000 | ditto                      | $682.03 billion | $682 billion |
| 233,420,000,000 | ditto                      | $233.42 billion | $233 billion |
| 252,540,000,000 | ditto                      | $252.54 billion | $253 billion |
| 69,270,000,000  | ditto                      | $69.27 billion  | $69.3 billion |

Note on decimals: within Group 2 the number of decimals now varies with the
mantissa (`1.24 billion` / `12.3 billion` / `123 billion`) so the total
information is constant at 3 significant digits — the old rule kept decimals
constant and let information vary (3–5 sig figs). Axis tick labels are
unchanged: `Axis.test.ts` only changed its setup to pass
`abbreviationThreshold: 1e3`, mirroring the pinned tick call sites.
