# turbopuffer (spike)

An experimental charts index in [turbopuffer](https://turbopuffer.com), next to the Algolia one in `baker/algolia/`. It exists to test whether turbopuffer's BM25, vector search and managed rerank in one service can replace Algolia plus the topic embedding and rerank steps of `/api/search`. Nothing on the site reads from it.

## What's here

- `indexChartsToTurbopuffer.ts` builds the same records as the Algolia charts index (charts, explorer views, multi-dim views) through `getScoredChartIndexRecords` in `baker/algolia/utils/chartIndexRecords.ts`, which the Algolia indexer also calls, and writes them to the `owid-charts-spike-v1` namespace in `aws-eu-central-1`.
- `queryChartsInTurbopuffer.ts` runs a few queries through the first-stage query shapes (T0–T3 below) and runs post-load checks.
- `chartsNamespace.ts` holds the schema and the record-to-row mapping.
- The query shapes live in `packages/@ourworldindata/utils/src/search/turbopufferCharts.ts`, shared with `/api/search`: `?type=charts&engine=tpuf&arm=T2` answers from this namespace (`arm` defaults to T1; `midpoint` overrides the popularity midpoint) and adds an `engine` object with turbopuffer's server time. It needs `TURBOPUFFER_API_KEY` in the functions' `.dev.vars`.

```bash
# needs TURBOPUFFER_API_KEY in .env; STAGING=<branch> reads that staging server's database
STAGING=master yarn indexChartsToTurbopuffer --dry-run        # rows + stats to tmp/, no upload
yarn indexChartsToTurbopuffer --from-file tmp/owid-charts-spike-v1.json --batches 1
yarn indexChartsToTurbopuffer --from-file tmp/owid-charts-spike-v1.json
yarn queryChartsInTurbopuffer --check
yarn queryChartsInTurbopuffer "co2" "poulation" --arms T1,T2
```

A full run upserts every row (re-embedding it) and then deletes rows an earlier run wrote, like Algolia's `replaceAllObjects`.

## Rows

One row per record, with featured-metric (FM) copies left out: typed searches already exclude them (`isFM:false`), so they matter only for empty-query topic browsing.

`popularity` is the Algolia record score with its scaling floor removed: scores are scaled to 1,000–10,000, so on the raw score the median chart sits at 1,002 and a `Saturate` midpoint can't separate anything. Popularity has median 2, p75 126, p90 198, p99 1,173 and max 9,000 (first load, 2026-11-24).

| Attribute                                            | Index                          | From                                                              |
| ---------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| `id`                                                 |                                | `objectID` (hashed if over 64 bytes)                              |
| `chart_key`                                          | filterable                     | `id`, the grouping key Algolia uses for `distinct`                |
| `type`, `slug`, `queryParams`                        | `type` filterable              | same                                                              |
| `title`, `subtitle`, `variantName`, `containerTitle` | full-text                      | same                                                              |
| `tags`                                               | full-text, filterable          | same                                                              |
| `availableEntities`                                  | filterable                     | same, for the country filter; not searched                        |
| `search_text`                                        | `baai/bge-m3` embedding, fuzzy | title + ". " + the first 300 characters of the subtitle           |
| `popularity`                                         |                                | record score minus the 1000 floor it is scaled to, clamped to ≥ 0 |

## Query shapes

| Arm | Shape                                                                                              |
| --- | -------------------------------------------------------------------------------------------------- |
| T0  | Sum of BM25 over title (×3), subtitle, tags, variantName, containerTitle, last token as prefix     |
| T1  | T0 + 2 × `Saturate(popularity)` (midpoint 126, its p75), restricted to rows matching a query token |
| T2  | T1 + a whole-query `Fuzzy` match on `search_text` (one edit from 6 characters)                     |
| T3  | T1 and an ANN query on `search_text`, fused with RRF                                               |

All arms return one row per `chart_key` (`limit.per`). With FM copies left out, every row has its own `chart_key`, so this is a no-op today; it matters once FM rows come back. The reranked arms (turbopuffer's `rerank_by` models, or our own rerank on a turbopuffer pool) are left to the search evaluator.

## Algolia settings not ported

None of the charts index's settings in `configureAlgolia.ts` were measured, so the spike starts without them and adds one back only if a benchmark query shows it is needed.

| Algolia setting                                                                                                            | Why it exists                                                                    | In turbopuffer                                                              |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `ranking` order (typo, words, exact, attribute, custom, proximity)                                                         | Text match decides; popularity only breaks ties                                  | BM25 sum plus a weighted popularity term (T1)                               |
| `customRanking: desc(score)`                                                                                               | Popular charts first among equal text matches                                    | `Saturate(popularity)` in T1                                                |
| `customRanking: asc(viewTitleIndexWithinExplorer)`                                                                         | Avoid several explorer views with the same title                                 | Not ported; no explorer view is downranked as a near-duplicate today        |
| `customRanking: asc(titleLength)`                                                                                          | Prefer shorter, more general titles                                              | Not ported (BM25 length normalisation does part of it)                      |
| `searchableAttributes` order                                                                                               | Title matches over subtitle and tag matches                                      | Title weight 3                                                              |
| `slug`, `availableEntities`, `datasetProducers` searchable                                                                 | Match slugs, country names and producers in the query                            | Not searched; countries come in as a filter                                 |
| `disableExactOnAttributes`, `disableTypoToleranceOnAttributes`, `disablePrefixOnAttributes` on subtitle, tags and entities | Demote matches only in long or secondary fields; "corn" shouldn't match "corner" | Not ported                                                                  |
| `optionalWords: ["vs"]`                                                                                                    | "x vs y" finds charts without "vs"                                               | Not ported (BM25 doesn't require every word)                                |
| `removeStopWords`, `ignorePlurals`, `alternativesAsExact`                                                                  | Stop words don't block matches; plurals count as exact                           | Defaults (no stemming, no stop-word removal); `stemming` is a tuning option |
| Typo tolerance (Algolia default)                                                                                           | Misspelled queries                                                               | T2's `Fuzzy` (whole query, 6+ characters)                                   |
| Synonyms (`site/search/synonymUtils.ts` and country variant names)                                                         | "USA", "gnp" and similar                                                         | Not ported; the vector query may cover some                                 |
| `distinct` on `id`                                                                                                         | One hit per chart                                                                | `limit.per` on `chart_key`                                                  |
| `unretrievableAttributes: score, views_7d`                                                                                 | Popularity isn't public                                                          | turbopuffer is server-side only; a backend must not return `popularity`     |
| Record shrinking to 20 KB, `processAvailableEntities` ordering                                                             | Algolia's record size limit and synonym quirk                                    | Not needed: turbopuffer limits each array element, not the array            |

## Found on the first load

- **"co2" doesn't match "CO₂".** The tokenizer splits `CO₂` into `co` and `₂`, so the query token `co2` matches no title that writes the subscript. T0's "co2" hits come from other fields, with tied scores, and T1 then ranks them by popularity alone. Algolia covers this with synonyms. Fix candidates: normalise subscripts to digits in the indexed text, or add a synonym-expanded query.
- **Prefix matches score a constant 1.0**, and `last_as_prefix` also lowers the score of exact matches of the last token (`co₂` on titles: 10.99 without it, 6.49 with it).
- **T2's `Fuzzy` term adds a constant 1.0 to every row it matches**, so on a misspelled query ("poulation") the ranking among fuzzy matches is popularity alone, and any row whose `search_text` has a near-token comes in ("GDP per capita" subtitles mention population).
- **Server time on the built index is 8–30 ms for every arm** (warm cache, the four smoke-test queries); embedding the query for T3 adds about 10–15 ms. Fuzzy and BM25 queries take several times longer while the index is still building after a write.
- **Typos** (five queries tried: "poulation", "lfie expectancy", "eletricity", "democrcy", "child mortallity"): T0 and T1 find nothing for a fully misspelled single word; T2 and T3 both return relevant charts, but T2 sometimes puts a popular unrelated chart first ("eletricity" → "CO₂ emissions per capita"), because its fuzzy term scores every match the same.

## Open items

- Facet counts: `/latest` (pages-chronological index) and the tag list in `functions/api/search/searchApi.ts` use Algolia facet counts. Neither is part of the charts spike.
- Pages and data insights are not indexed.
- FM records and empty-query topic browsing need their own design.
- The `engine=tpuf` backend lacks Algolia's closest matches, topic validation, and `availableTabs` and dates on hits; `nbHits` counts only the rows returned (at most 100).
- Highlights and snippets (beta in turbopuffer) are not used.
