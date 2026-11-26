# turbopuffer (spike)

Experimental charts and pages indexes in [turbopuffer](https://turbopuffer.com), next to the Algolia ones in `baker/algolia/`. They exist to test whether turbopuffer's BM25, vector search and managed rerank in one service can replace Algolia plus the topic embedding and rerank steps of `/api/search`. Nothing on the site reads from them.

## What's here

- `indexToTurbopuffer.ts --index charts` builds the same records as the Algolia charts index (charts, explorer views, multi-dim views) through `getScoredChartIndexRecords` in `baker/algolia/utils/chartIndexRecords.ts`, which the Algolia indexer also calls, and writes them to the `owid-charts-spike-v2` namespace (v1, the first load without stemming and with a shorter `search_text`, is kept in Frankfurt as a baseline).
- `indexToTurbopuffer.ts --index pages` does the same for the Algolia pages index's records (`getPagesRecords` in `baker/algolia/utils/pages.ts`: articles, data insights, topic, about and profile pages, one record per 1,000-character content chunk) and the `owid-pages-spike-v1` namespace.
- `queryTurbopuffer.ts` runs a few queries through the query shapes (T0–T4 below) and runs post-load checks.
- `namespaces.ts` holds the schemas and the record-to-row mappings.
- The query shapes live in `packages/@ourworldindata/utils/src/search/turbopuffer.ts`, shared with `/api/search`: `?type=charts&engine=tpuf&arm=T2` and `?type=pages&engine=tpuf&arm=T4` answer from these namespaces and add an `engine` object with the region and turbopuffer's server time. `arm` defaults to T1; `midpoint` overrides the popularity midpoint; `synonyms=1`, `fuzzy=1` and `pool=<n>` switch on the query tuning below; `model` picks T4's rerank model, and `rsyn=1` and `popw=<w>` tune its rerank; `region` overrides the region. It needs `TURBOPUFFER_API_KEY` in the functions' `.dev.vars`.

```bash
# needs TURBOPUFFER_API_KEY in .env; STAGING=<branch> reads that staging server's database
STAGING=master yarn indexToTurbopuffer --index pages --dry-run   # rows + stats to tmp/, no upload
yarn indexToTurbopuffer --index pages --from-file tmp/owid-pages-spike-v1.json --batches 1 --regions aws-eu-central-1
yarn indexToTurbopuffer --index pages --from-file tmp/owid-pages-spike-v1.json   # every region
yarn queryTurbopuffer --index pages --check
yarn queryTurbopuffer --index charts --region aws-us-east-1 "co2" "poulation" --arms T1,T2
```

A full run upserts every row (re-embedding it) and then deletes rows an earlier run wrote, like Algolia's `replaceAllObjects`, in each region in turn.

## Regions

Each namespace exists in Frankfurt (`aws-eu-central-1`) and N. Virginia (`aws-us-east-1`); turbopuffer has no cross-region replication, so the indexer writes both. `/api/search` queries N. Virginia for readers Cloudflare places in North or South America (`request.cf.continent`) and Frankfurt for everyone else. Both regions serve `baai/bge-m3`, zerank-2 and the Voyage rerank models. A second region doubles the storage and write cost (cents per full run) but not the query cost, since each search goes to one region.

## Rows

One row per record, with featured-metric (FM) copies left out: typed searches already exclude them (`isFM:false`), so they matter only for empty-query topic browsing.

`popularity` is the Algolia record score with its scaling floor removed: scores are scaled to 1,000–10,000, so on the raw score the median chart sits at 1,002 and a `Saturate` midpoint can't separate anything. Popularity has median 2, p75 126, p90 198, p99 1,173 and max 9,000 (first load, 2026-11-24).

| Attribute                                            | Index                          | From                                                                                                                         |
| ---------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                 |                                | `objectID` (hashed if over 64 bytes)                                                                                         |
| `chart_key`                                          | filterable                     | `id`, the grouping key Algolia uses for `distinct`                                                                           |
| `type`, `slug`, `queryParams`                        | `type` filterable              | same                                                                                                                         |
| `title`, `subtitle`, `variantName`, `containerTitle` | full-text, stemmed             | same                                                                                                                         |
| `tags`                                               | full-text, stemmed, filterable | same                                                                                                                         |
| `availableEntities`                                  | filterable                     | same, for the country filter; not searched                                                                                   |
| `search_text`                                        | `baai/bge-m3` embedding, fuzzy | title (variant), container title, the first 300 characters of the subtitle, and tags; also the text T4's rerank model scores |
| `popularity`                                         |                                | record score minus the 1000 floor it is scaled to, clamped to ≥ 0                                                            |

### Pages

One row per record of the Algolia pages index (a page's content chunk), 18,302 rows for 2,014 pages on 2026-11-25, 10,169 of them profile pages instantiated per country. `path` groups a page's chunks, like Algolia's `distinct` on `path` (a data insight and an article can share a slug). `title`, `excerpt`, `content` and `tags` are full-text and stemmed, `authors` full-text. `search_text` is the title, excerpt and chunk, embedded with `baai/bge-m3` and scored by T4's rerank model. `popularity` is the record score (1,000 × importance + 7-day views), with p75 241 for articles and 42 for data insights; the index reuses the charts' midpoint, 126, between the two.

The two halves of T3 and T4 can return different chunks of one page, so hybrid queries fetch every candidate and keep each page's first row after the fusion or rerank, before cutting the page.

## Query shapes

| Arm | Shape                                                                                              |
| --- | -------------------------------------------------------------------------------------------------- |
| T0  | Sum of BM25 over title (×3), subtitle, tags, variantName, containerTitle, last token as prefix     |
| T1  | T0 + 2 × `Saturate(popularity)` (midpoint 126, its p75), restricted to rows matching a query token |
| T2  | T1 + a whole-query `Fuzzy` match on `search_text` (one edit from 6 characters)                     |
| T3  | T1 and an ANN query on `search_text`, fused with RRF                                               |
| T4  | T3's two queries, their candidates scored by a rerank model on `search_text` instead of RRF        |

Each arm runs as one call to turbopuffer, which embeds the query, runs the sub-queries and fuses or reranks them. The tuning switches apply to every arm's text query:

- `synonyms=1` expands the query with the synonyms from `synonyms.ts` (in `@ourworldindata/utils`, the list Algolia's index also gets): their words are matched and scored like the query's, without the prefix match.
- `fuzzy=1` adds T2's whole-query fuzzy match. Pages run without it: matching the whole query against 1,000-character chunks added 150–350 ms of server time, and typo queries ("poverity", "vacines", "life expectency", "renewable enrgy") returned the same top results without it, since the vector half finds them.
- `pool=<n>` is how many rows each T3/T4 sub-query contributes (default: the page size plus one). The rerank needs a pool deeper than the page.
- `model` is T4's rerank model: `zeroentropy/zerank-2` (default), `voyage/rerank-3` or `voyage/rerank-3-lite`, the ones turbopuffer serves in both our regions.
- `rsyn=1` gives T4's rerank model the query with its synonyms in parentheses ("pib (gdp, gross domestic product, …)").
- `popw=<w>` adds `w` times the row's saturated popularity (the text half's `Saturate` term, 0–1) to the rerank model's score, re-sorting every reranked candidate before the page is cut. Rerank scores of relevant charts sit within a few hundredths of each other on broad queries ("energy": 0.666–0.685), so 0.05 lets popularity break those near-ties without overriding a clearer relevance gap.

All arms return one row per `chart_key` (`limit.per`). With FM copies left out, every row has its own `chart_key`, so this is a no-op today; it matters once FM rows come back. The reranked arms (turbopuffer's `rerank_by` models, or our own rerank on a turbopuffer pool) are left to the search evaluator.

## Algolia settings not ported

None of the charts index's settings in `configureAlgolia.ts` were measured, so the spike starts without them and adds one back only if a benchmark query shows it is needed.

| Algolia setting                                                                                                            | Why it exists                                                                    | In turbopuffer                                                            |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `ranking` order (typo, words, exact, attribute, custom, proximity)                                                         | Text match decides; popularity only breaks ties                                  | BM25 sum plus a weighted popularity term (T1)                             |
| `customRanking: desc(score)`                                                                                               | Popular charts first among equal text matches                                    | `Saturate(popularity)` in T1                                              |
| `customRanking: asc(viewTitleIndexWithinExplorer)`                                                                         | Avoid several explorer views with the same title                                 | Not ported; no explorer view is downranked as a near-duplicate today      |
| `customRanking: asc(titleLength)`                                                                                          | Prefer shorter, more general titles                                              | Not ported (BM25 length normalisation does part of it)                    |
| `searchableAttributes` order                                                                                               | Title matches over subtitle and tag matches                                      | Title weight 3                                                            |
| `slug`, `availableEntities`, `datasetProducers` searchable                                                                 | Match slugs, country names and producers in the query                            | Not searched; countries come in as a filter                               |
| `disableExactOnAttributes`, `disableTypoToleranceOnAttributes`, `disablePrefixOnAttributes` on subtitle, tags and entities | Demote matches only in long or secondary fields; "corn" shouldn't match "corner" | Not ported                                                                |
| `optionalWords: ["vs"]`                                                                                                    | "x vs y" finds charts without "vs"                                               | Not ported (BM25 doesn't require every word)                              |
| `removeStopWords`, `ignorePlurals`, `alternativesAsExact`                                                                  | Stop words don't block matches; plurals count as exact                           | Stemming on every full-text field (v2); stop words are removed by default |
| Typo tolerance (Algolia default)                                                                                           | Misspelled queries                                                               | `fuzzy=1`, T2's `Fuzzy` (whole query, 6+ characters)                      |
| Synonyms (`synonyms.ts` and country variant names)                                                                         | "USA", "gnp" and similar                                                         | `synonyms=1`, as query expansion                                          |
| `distinct` on `id`                                                                                                         | One hit per chart                                                                | `limit.per` on `chart_key`                                                |
| `unretrievableAttributes: score, views_7d`                                                                                 | Popularity isn't public                                                          | turbopuffer is server-side only; a backend must not return `popularity`   |
| Record shrinking to 20 KB, `processAvailableEntities` ordering                                                             | Algolia's record size limit and synonym quirk                                    | Not needed: turbopuffer limits each array element, not the array          |

## Found on the first load

- **"co2" doesn't match "CO₂".** The tokenizer splits `CO₂` into `co` and `₂`, so the query token `co2` matches no title that writes the subscript. T0's "co2" hits come from other fields, with tied scores, and T1 then ranks them by popularity alone. Algolia covers this with synonyms. Fix candidates: normalise subscripts to digits in the indexed text, or add a synonym-expanded query.
- **Prefix matches score a constant 1.0**, and `last_as_prefix` also lowers the score of exact matches of the last token (`co₂` on titles: 10.99 without it, 6.49 with it).
- **T2's `Fuzzy` term adds a constant 1.0 to every row it matches**, so on a misspelled query ("poulation") the ranking among fuzzy matches is popularity alone, and any row whose `search_text` has a near-token comes in ("GDP per capita" subtitles mention population).
- **Server time on the built index is 8–30 ms for every arm** (warm cache, the four smoke-test queries); embedding the query for T3 adds about 10–15 ms. Fuzzy and BM25 queries take several times longer while the index is still building after a write.
- **Typos** (five queries tried: "poulation", "lfie expectancy", "eletricity", "democrcy", "child mortallity"): T0 and T1 find nothing for a fully misspelled single word; T2 and T3 both return relevant charts, but T2 sometimes puts a popular unrelated chart first ("eletricity" → "CO₂ emissions per capita"), because its fuzzy term scores every match the same.

## Tuning and rerank results

The search evaluator (`experiments/search_demand` in the analytics repo, 300 real queries sampled by volume, Haiku judge) compared each variant with production in the same run. A query counts as served when its best result, discounted by rank, scores at least 1.5 of 3. The judge sees both engines' results in one prompt, so production's own score moves by about ±2 points between runs; the difference within a run is the number to read. The 95% intervals come from resampling queries.

| Variant (2026-11-25)                           | Served | vs production        | Breaks | Round trip p50 |
| ---------------------------------------------- | ------ | -------------------- | ------ | -------------- |
| T3                                             | 69.1%  | +2.3 (−5.0, +8.8)    | 11.1%  | 62 ms          |
| T3, `synonyms=1&fuzzy=1&pool=100`              | 73.3%  | +4.3 (−0.6, +9.1)    | 7.6%   | 60 ms          |
| same on v2 (stemming, richer `search_text`)    | 74.2%  | +5.9 (+0.9, +11.2)   | 8.3%   | 77 ms          |
| T4, zerank-2, `pool=50`                        | 81.3%  | +13.5 (+8.4, +18.7)  | 5.1%   | 198 ms         |
| T4, voyage/rerank-3, `pool=50`                 | 82.9%  | +15.6 (+9.7, +21.4)  | 4.3%   | 289 ms         |
| Algolia + `clef-flash` rerank + topics (#7869) | 82.7%  | +13.9 (+10.2, +18.1) | 0.3%   | 298 ms         |

"Breaks" is the share of volume production serves and the variant doesn't. Synonyms did most of the first-stage gain ("defense" → military, "college" → tertiary, "rni"). Pool depth alone changed nothing. The round trips run from a laptop through a local `wrangler pages dev` (turbopuffer) or the rerank PR's staging server (`clef-flash`), so they rank the variants rather than predict production.

The variants were tuned on those 300 queries, so the two reranked ones were also run on a 600-query sample: on its ~250 queries outside the tuning set, T4 (Voyage) served 81.5% against production's 59.8% (+21.7, interval +16.2 to +27.3, breaks 2.0%), and `clef-flash` 78.6% against 63.1% (+15.5, breaks 0.8%).

Judged head to head in one run on the 600 queries, T4 (Voyage) served 84.1% and `clef-flash` 80.2% (+3.8, interval 0.0 to +7.5; on the held-out queries +5.1, interval +0.8 to +9.8). Round trips were similar: p50 288 ms for T4, 256 ms for `clef-flash`.

- **Where T4 loses**, the rerank model's score replaces everything else: broad one-word queries ("energy", "agriculture", "economy") get narrower charts instead of the popular broad ones, since popularity no longer counts, and abbreviations ("rni", "pib", "sdg 7") lose because the model scores the bare query against `search_text` without the synonyms that brought the right charts into the pool. `clef-flash` reorders Algolia's own hits, so it almost never loses what production finds.
- **A T4 call** takes about 200 ms of server time, nearly all of it the rerank, and bills about 4,700 rerank tokens (≈ $0.0002 with voyage/rerank-3, half with zerank-2) plus 2.56 GB queried (two sub-queries at the 1.28 GB minimum each). The rerank dominates: about $240 per million searches with voyage/rerank-3 and $120 with zerank-2, against about $3 for the queried bytes at turbopuffer's listed ≤ $1 per PB.
- **turbopuffer rate-limits model reranking** to 2,500 candidate documents per second per organization and model (burst 10,000); T4 sends up to 100 per search, so about 25 searches per second.

### Follow-ups on T4's losses

Three ideas against the two loss patterns above, each judged head to head against T4 (Voyage, `pool=50`) on the 600-query sample. The patterns were read off these same queries, so none of it is held out.

| Variant against T4                                                 | T4    | Variant | Difference (95% CI) | Fixes | Breaks | Round trip p50 |
| ------------------------------------------------------------------ | ----- | ------- | ------------------- | ----- | ------ | -------------- |
| `rsyn=1`                                                           | 83.0% | 83.5%   | +0.5 (−0.9, +1.9)   | 2.0%  | 1.5%   | 297 ms         |
| `rsyn=1&popw=0.05`                                                 | 83.2% | 85.0%   | +1.8 (−0.8, +4.8)   | 3.9%  | 2.2%   | 314 ms         |
| `clef-flash` over T3's top 30 (#7869's rerank; not on this branch) | 85.0% | 84.7%   | −0.4 (−4.1, +2.7)   | 4.9%  | 5.3%   | 264 ms         |

- **None beats T4 by more than the noise.** Synonyms in the rerank query fix the abbreviations they were aimed at ("pib", "bip", "gdp in ch") and lose about as many others. The popularity blend adds the broad queries ("energy", "economy") and loses others ("income", "deforestation"); its +1.8 rests on a tuned constant.
- **`clef-flash` over turbopuffer's candidates trades rather than adds:** it wins broad and odd queries ("economy", "population by country", "sdg 7") and loses short and foreign-language ones that T4's model gets ("sugar", "rni", "sur corea", "produit interieur brut"). It matches T4 with one model call fewer, at Workers AI's price instead of the rerank tokens.

## Final comparison with production

T4 with zerank-2 on every section, against production Algolia on fresh volume-weighted samples (2026-11-25). Charts use `synonyms=1&fuzzy=1&pool=50`, pages `synonyms=1&pool=20` with the site's page types (`article`, `about-page`) or `data-insight`.

| Section       | Queries | Production | T4    | Difference (95% CI)  | Breaks | Fixes | NDCG@5        |
| ------------- | ------- | ---------- | ----- | -------------------- | ------ | ----- | ------------- |
| Charts        | 539     | 67.2%      | 82.0% | +14.8 (+10.9, +19.0) | 4.6%   | 19.4% | 0.801 → 0.933 |
| Articles      | 318     | 44.9%      | 63.1% | +18.2 (+11.6, +25.1) | 6.1%   | 24.3% | 0.779 → 0.901 |
| Data insights | 318     | 45.6%      | 60.7% | +15.2 (+10.2, +20.5) | 4.1%   | 19.3% | 0.715 → 0.926 |

- **Losses:** abbreviations and other languages ("pib", "rni", "bip"), broad one-word queries ("population pyramid", "weather"), articles found at rank 2 instead of 1 ("literacy rate", "life expectancy"), and author queries, since the rerank text has no authors.
- **Latency** from a laptop in Europe to Frankfurt, median: production (Algolia, called directly) 63–65 ms; T4 through the function 224 ms for charts, 277 ms for articles, 238 ms for data insights, of which 186–265 ms is turbopuffer's server time. A results page queries its sections in parallel, so it waits for the slowest. From America, Frankfurt adds roughly 60–80 ms.
- **Cost** at ~7,700 searches/day: the three reranks bill ~16,500 tokens per search, ≈ $96/month with zerank-2; queries ≈ $2; a full reindex of both namespaces is $0.40 per region (≤ $12/month if daily). About $100–115/month in one region, which covers the $16 plan minimum.

## Open items

- **Cost gate before production:** `pool`, `model` and `arm` come from the request, so with the key in production anyone could make each search cost more (`pool=200`, voyage on pages). Fix them server-side, or keep `engine=tpuf` off production.
- `--namespace` on the indexer deletes rows the run didn't write, so pointing it at another index's namespace would empty that namespace.
- Peak search rate against the rerank rate limit (2,500 candidates per second per model; a search page sends up to ~180 across its three sections, so about 14 searches per second).
- Facet counts: `/latest` (pages-chronological index) and the tag list in `functions/api/search/searchApi.ts` use Algolia facet counts. Neither is part of the charts spike.
- Topic-page recommendations (`type=topics`), profiles and featured-viz pins still read Algolia; the pages namespace holds their records but no backend queries them.
- FM records and empty-query topic browsing need their own design.
- The `engine=tpuf` backend lacks Algolia's closest matches, topic validation, and `availableTabs` and dates on hits; `nbHits` counts only the rows returned (at most 100).
- Highlights and snippets (beta in turbopuffer) are not used.
