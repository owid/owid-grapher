# Data page column heights

Measures how tall the two columns of the "What you should know about this
indicator" section end up on data pages, so that layout decisions about that
section can be made against real rendered pages instead of guesses.

`DatapageColumnHeights.json` is the committed output of a full sweep run on
**2026-07-29** at a **1440×900** viewport. `measureColumnHeights.mjs`
regenerates it.

## Running it

```
node devTools/datapageColumnHeights/measureColumnHeights.mjs
```

It enumerates every `/grapher/` URL in the site's sitemap, renders each one in
headless Chromium at a 1440px-wide viewport, and writes one JSON object per
page to a `.jsonl` file plus a `.summary.json` of the aggregate statistics.
`--base` points it at another host (a staging server, or `http://localhost:3030`
with the dev stack up), `--limit` cuts it short for a smoke run, and
`--concurrency` controls how many pages render in parallel. The full sweep is
several thousand page loads and takes a while.

Pages that don't render the two-column section are skipped and don't appear in
the output: the single-column "About this data" layout has no left column, and
neither does the `indicator-metadata-box` layout.

## What it measures, and the gotcha

Both columns are items of the **same CSS grid row**, which has
`align-items: stretch`. That makes the two grid items exactly as tall as each
other on every single page — `getBoundingClientRect().height` on the column
wrappers returns pixel-identical numbers site-wide and tells you nothing. Only
the **content** height inside each column is meaningful, so the script measures:

- **left** — `.key-info__content`, the descriptionKey bullets plus the collapsed
  "How is this data described by its producer?" toggle
- **right** — `.key-data-block`, the key data table

Note also that there is **no `.key-info__left` class** in the production markup.
The left grid item carries `col-start-1 span-cols-8`; only the right one has a
BEM class (`.key-info__right`). Selecting `.key-info__left` silently matches
nothing.

Toggles are measured in their collapsed state, which is what a reader sees
first. The script also records each page's top-level `descriptionKey` bullet
count, counted in the DOM by the same rule `countDescriptionKeyBullets()`
applies to the markdown — nested bullets belong to their parent and don't count.

This is a desktop-only measurement. The columns only sit side by side at
desktop widths; the layout stacks on narrow screens, where the question of
which column ends in blank space doesn't arise.

## Findings

Across the **1,633** data pages that render the two-column section (gap below is
left minus right, so negative means the right column is taller):

|                                  | pages | share |
| -------------------------------- | ----- | ----- |
| right (metadata) column taller   | 1,225 | 75%   |
| left (description) column taller | 408   | 25%   |
| ties                             | 0     | —     |

Median gap **−137px**; p5 −264, p25 −206, p75 −0.2, p95 +266.

The single biggest driver is pages with no bullets at all: **598 of the 1,633
(37%) have an empty `descriptionKey`**, which leaves their left column at
exactly **58px** — nothing but the collapsed producer toggle. The right column
is taller on all 598 of them.

The gap is monotone in bullet count, which makes bullet count a usable switch:

| bullets | pages | left column taller | median gap |
| ------- | ----- | ------------------ | ---------- |
| 0       | 598   | 0%                 | −206px     |
| 1–2     | 429   | 4%                 | −136px     |
| 3–5     | 387   | 47%                | −7px       |
| 6–9     | 202   | 96%                | +191px     |
| 10+     | 17    | 100%               | +491px     |

**At 6 or more bullets the left column is the taller one on 211 of 219 pages
(96%)**, and below that the right column usually is. That crossover is where
`LEFT_COLUMN_TALLER_BULLET_COUNT = 6` in `site/AboutThisData.tsx` comes from: it
places the newsletter card in whichever column is expected to be the shorter
one, so the card fills space that would otherwise be blank.

If page content shifts enough that the crossover moves, re-running the sweep is
what should decide the new threshold. Read the counting caveat below before
relying on the bullet-count columns of that table.

## Caveat: the committed run counted bullets more loosely than the site does

The `nBullets` column of the 2026-07-29 file was produced with a more inclusive
rule than `countDescriptionKeyBullets()` in `site/datapageUtils.ts`, which is
what actually drives the threshold. Spot-checking 46 pages in the 3+ bands
against a fresh render found the two agree on 39 of them, and diverge where a
page either nests its bullets (the committed run counted nested `<li>`s as
bullets in their own right; the production function folds them into their
parent) or writes its descriptionKey as prose (counted as one bullet per
paragraph by the committed run, as zero by the production function). On two of
the 46 the disagreement crossed the threshold itself — e.g.
`human-development-index-groups` is 11 by the committed run and 5 by the
production rule.

`measureColumnHeights.mjs` implements the production rule, so re-running it will
report lower counts than the committed file on pages with nested bullets, and
the 6+ band will lose some members. 139 of the 219 pages in that band sit at
exactly 6 or 7 bullets, so they are the ones most exposed to the difference.

This does not touch the height comparisons, which are pure measurements and
independent of how bullets are counted: the 1,225/408 split, the −137px median,
and the 598 pages whose left column is a bare 58px all stand. What it means is
that the exact placement of the crossover deserves a re-sweep with the current
script before the threshold is treated as settled.

## Known bad rows

Three pages — `natural-disasters-deaths`,
`natural-disasters-economic-damages` and `natural-disasters-people-affected` —
have their `descriptionKey` split into one bullet per character, giving them
2,000+ bullets and left columns of 89,000–103,000px. That is a content problem,
not a layout one. Excluding those three, the gap ranges from −402.5px to
+834.2px. They are left in the data file rather than dropped, so the sweep stays
a faithful record of what the site rendered.
