# Data page column heights

Measures how tall the two columns of the "What you should know about this
indicator" section end up on data pages, so that layout decisions about that
section can be made against real rendered pages instead of guesses.

`DatapageColumnHeights.json` is the committed output of a full sweep run on
**2026-07-29** at a **1440×900** viewport, with its bullet counts corrected
afterwards (see below). `measureColumnHeights.mjs` regenerates it.

## Running it

```
npx tsx --tsconfig tsconfig.tsx.json \
    devTools/datapageColumnHeights/measureColumnHeights.mjs
```

It goes through `tsx` because it counts bullets by calling the site's own
`countDescriptionKeyBullets()`, which is TypeScript.

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
first. The script also records each page's `descriptionKey` bullet count. That
count is not read off the rendered list: the script pulls the `descriptionKey`
markdown out of the props the page was rendered from (`_OWID_DATAPAGEV2_PROPS`,
or `_OWID_MULTI_DIM_PROPS` on multi-dim pages) and passes it through
`countDescriptionKeyBullets()` from `site/datapageUtils.ts`. That is the
function the card placement in `site/AboutThisData.tsx` actually calls, so the
sweep and the site cannot count differently. Under it, nested bullets belong to
their parent and a `descriptionKey` written as prose has no bullets at all.

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

The single biggest driver is pages with no bullets at all. **799 of the 1,633
(49%) count zero bullets**, and they split into two groups: 598 have an empty
`descriptionKey`, which leaves their left column at exactly **58px** — nothing
but the collapsed producer toggle — and the right column is taller on every one
of them; the other 201 write their `descriptionKey` as prose rather than as a
list, so they have real text in the left column but no bullets, and the right
column is still taller on 190 of them.

The gap grows with bullet count, which makes bullet count a usable switch:

| bullets | pages | left column taller | median gap |
| ------- | ----- | ------------------ | ---------- |
| 0       | 799   | 1%                 | −201px     |
| 1–2     | 237   | 7%                 | −107px     |
| 3–5     | 394   | 47%                | −7px       |
| 6–9     | 191   | 96%                | +190px     |
| 10+     | 12    | 100%               | +567px     |

Per count, with the cumulative figures a threshold is actually read off:

| bullets | pages | left taller | share | pages at ≥ | left taller | share |
| ------- | ----- | ----------- | ----- | ---------- | ----------- | ----- |
| 0       | 799   | 11          | 1%    | 1,633      | 408         | 25%   |
| 1       | 1     | 0           | 0%    | 834        | 397         | 48%   |
| 2       | 236   | 16          | 7%    | 833        | 397         | 48%   |
| 3       | 111   | 20          | 18%   | 597        | 381         | 64%   |
| 4       | 177   | 84          | 47%   | 486        | 361         | 74%   |
| 5       | 106   | 82          | 77%   | 309        | 277         | 90%   |
| 6       | 91    | 88          | 97%   | 203        | 195         | 96%   |
| 7       | 48    | 48          | 100%  | 112        | 107         | 96%   |
| 8       | 39    | 34          | 87%   | 64         | 59          | 92%   |
| 9       | 13    | 13          | 100%  | 25         | 25          | 100%  |
| 10      | 5     | 5           | 100%  | 12         | 12          | 100%  |
| 11      | 1     | 1           | 100%  | 7          | 7           | 100%  |
| 12+     | 6     | 6           | 100%  | 6          | 6           | 100%  |

**At 6 or more bullets the left column is the taller one on 195 of 203 pages
(96%)**, and below that the right column usually is. That crossover is where
`LEFT_COLUMN_TALLER_BULLET_COUNT = 6` in `site/AboutThisData.tsx` comes from: it
places the newsletter card in whichever column is expected to be the shorter
one, so the card fills space that would otherwise be blank.

## Scoring the threshold

That 96% is the accuracy of the rule on the pages it sends the card right, not
its accuracy overall. Scoring every page — a page counts as misplaced when the
card lands in the column that actually turned out taller — puts the cost of a
high threshold on the other side of the cut:

| threshold | card left | card right | misplaced | accuracy | wasted px |
| --------- | --------- | ---------- | --------- | -------- | --------- |
| 3         | 1,036     | 597        | 243       | 85.1%    | 18k       |
| 4         | 1,147     | 486        | 172       | 89.5%    | 12k       |
| 5         | 1,324     | 309        | 163       | 90.0%    | 14k       |
| 6         | 1,430     | 203        | 221       | 86.5%    | 26k       |
| 7         | 1,521     | 112        | 306       | 81.3%    | 42k       |
| 8         | 1,569     | 64         | 354       | 78.3%    | 52k       |

"Wasted px" is the sum of the height differences on the misplaced pages, which
is roughly how much blank space the rule leaves standing.

At 6, only 8 of the 221 misplacements are pages sent right that should have gone
left; the other 213 are pages kept left that the description column outgrows
anyway, and 166 of those sit at 4 or 5 bullets. The five-bullet band is the one
that decides between 5 and 6: it is 77% left-taller, so it belongs above the cut,
while the four-bullet band at 47% is a coin flip either way.

If page content shifts enough that the crossover moves, re-running the sweep is
what should decide the new threshold; the `.summary.json` it writes contains
both tables above.

## The bullet counts in this file were corrected after the run

The `nBullets` column was originally derived from the rendered list markup with
a looser rule than the site's: nested `<li>`s were counted as bullets in their
own right, and a `descriptionKey` written as prose was counted as one bullet per
paragraph. `countDescriptionKeyBullets()`, which is what actually decides the
placement, does neither. Every row was therefore recounted by fetching the
`descriptionKey` markdown baked into each of the 1,633 pages and passing it
through that function, and `measureColumnHeights.mjs` now counts the same way so
a re-run stays consistent.

The recount moved 229 of the 1,633 counts, 228 of them downwards. 201 pages
dropped to zero because their `descriptionKey` is prose rather than a list, and
16 crossed the threshold itself — for instance `human-development-index-groups`
went from 11 to 5, and `terrorist-attacks` from 8 to 2.

As a check, 93 pages spanning every band were compared against the list actually
rendered in the served markup; the recount matched the number of top-level
`<li>`s on 92 of them. The one exception, `long-run-birth-rate`, opens with an
intro line and then indents its bullets, which `parseMarkdownBlocks()` folds into
a single item — the site places its card on that count, so it is the count the
file records.

None of this touches the height comparisons, which are pure measurements and
independent of how bullets are counted: the 1,225/408 split, the −137px median
and the 598 pages whose left column is a bare 58px are unchanged. Nor did it
change the shape of the answer. Scored the same way, the committed counts gave 6
an accuracy of 87.5% against 90.3% for 5, so a threshold of 6 was already off the
best before the recount; the correction moves 6 by about a point and 5 by a
quarter of one. What the old counts hid was not the ranking but the reason for
it, since the 96% headline says nothing about the pages below the cut.

## Known bad rows

Three pages — `natural-disasters-deaths`,
`natural-disasters-economic-damages` and `natural-disasters-people-affected` —
have their `descriptionKey` split into one bullet per character, giving them
2,000+ bullets and left columns of 89,000–103,000px. That is a content problem,
not a layout one. Excluding those three, the gap ranges from −402.5px to
+834.2px. They are left in the data file rather than dropped, so the sweep stays
a faithful record of what the site rendered.
