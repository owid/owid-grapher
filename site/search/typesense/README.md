# Typesense search

## Overview

Typesense backs `/api/search` and the `/search` data catalog. It is **keyword
search only** (BM25) — there is no `embedding` field, no `vector_query` and no
`alpha` parameter, so indexing needs no embedding provider and a full reindex
takes minutes.

This is a like-for-like replacement of Algolia, so the interesting question when
reading this code is always "what did Algolia do here?". The mapping:

| Algolia                                   | Typesense                                                   |
| ----------------------------------------- | ----------------------------------------------------------- |
| `searchableAttributes` (order = ranking)  | `query_by` + `query_by_weights` (query-time)                |
| `customRanking`                           | `sort_by` after `_text_match(buckets: 8)` (query-time)      |
| `attributeForDistinct` + `distinct: true` | `group_by` + `group_limit: 1`                               |
| `attribute` ranking criterion             | `text_match_type: "max_weight"`                             |
| `facetFilters`                            | `filter_by` with `:=` exact match                           |
| `removeStopWords: ["en"]`                 | a `stopwords` set uploaded server-side, named in each query |
| synonyms                                  | a global synonym set, named in each query                   |
| `removeWordsIfNoResults: "allOptional"`   | `drop_tokens_threshold` (see `typesenseClosestMatches.ts`)  |

The Algolia settings being mirrored live in `baker/algolia/configureAlgolia.ts`;
their Typesense counterparts are split between
`packages/@ourworldindata/utils/src/search/typesenseSearchParams.ts`
(query-time) and `baker/typesense/` (server-side: collection schemas, stopwords,
synonyms).

## Known differences from Algolia

This is not a behaviour-preserving swap. **Typesense counts a query token as
matched regardless of which queried field it hit** — it has no notion of "these
words all came from the title". Everything below follows from that.

Three settings recover most of what Algolia's ranking gave us, all in
`TYPESENSE_RELEVANCE_PARAMS` / `CHARTS_QUERY_BY_WEIGHTS`:

- `text_match_type: "max_weight"` — makes the best-matching field's _weight_ the
  dominant ranking component, so `query_by_weights` behaves like Algolia's
  ordered `searchableAttributes`. The default, `max_score`, demotes weight to a
  minor tie-breaker and loses the "title beats tag" rule entirely.
- `prioritize_num_matching_fields: false` — the default boosts documents that
  match across more fields, which is exactly the scattered cross-field match to
  punish. Algolia has no such rule.
- Low weights (1) on the entity lists rather than removing them from
  `query_by`. See `CHARTS_QUERY_BY_WEIGHTS` — removing them looked defensible
  and measured badly.

What still differs:

- **Multi-word synonyms match as loose token sets, not phrases.** The group
  `["energy consumption", "energy use", …]` means the query "energy consumption"
  can also match "Land **use** per 100 grams of protein" via "use" plus an
  `Energy and Environment` tag. No setting fixes this; the phrase structure
  Algolia preserves is simply not represented.
- **Cross-field matching invents some matches.** "malaria worldwide" matches a
  COVID chart titled "…coverage worldwide" that lists malaria as an entity,
  where Algolia returns nothing. Accepted deliberately — see
  `CHARTS_QUERY_BY_WEIGHTS`.

### Evaluating changes here

Do not tune these settings against a hand-picked query list. Use the
volume-weighted evaluator in the `analytics` repo, which judges results with an
LLM and weights by real search demand:

```sh
uv run python -m experiments.search_demand classify --source real \
  --engine-a https://ourworldindata.org/api/search \
  --engine-b http://staging-site-<branch>/api/search
```

A 16-query top-5 overlap check against Algolia missed a regression affecting
~10% of real search volume, because every query in it was a topic phrase and
none was an entity name. Overlap with Algolia is also the wrong target on its
own: it measures similarity, not quality.

## Collections

| Collection                  | `group_by`        | Notes                                                       |
| --------------------------- | ----------------- | ----------------------------------------------------------- |
| `pages`                     | `path`            | Pages are indexed as several content chunks sharing a path. |
| `explorer-views-and-charts` | `deduplicationId` | Carries Algolia's `id` (`grapher/slug`, `explorer/slug?…`). |

`pages-chronological` (used by `/latest` and the Atom feed) is **not** part of
this setup and still lives in Algolia, as does the site-header autocomplete in
`site/search/Autocomplete.tsx`.

## Where the code lives

- `@ourworldindata/utils/search/typesenseClient.ts` — a `fetch`-based client
  (works in the browser and on Cloudflare Workers; the `typesense` npm package
  does neither well and costs ~25kB in the site bundle).
- `@ourworldindata/utils/search/searchFilterBy.ts` — `filter_by` builders,
  shared so `/api/search` and the site can't drift apart on filters.
- `@ourworldindata/utils/search/typesenseSearchParams.ts` — `query_by`,
  weights, `sort_by`.
- `site/search/queries.ts` — the site's queries.
- `functions/api/search/searchApi.ts` — the public endpoint.
- `baker/typesense/` — the indexers, collection schemas and `configureTypesense`.

## Running it locally

```sh
docker compose -f docker-compose.grapher.yml up typesense   # or `make up.full`
make reindex.typesense
```

`make reindex.typesense` applies stopwords and synonyms, then recreates both
collections and imports the records. Stopwords and synonym sets are global in
Typesense 30, so they survive a reindex and the order doesn't matter.

Requires `TYPESENSE_INDEXING=true` in `.env`.

## Querying by hand

```sh
curl 'http://localhost:8108/collections/explorer-views-and-charts/documents/search' \
  -H 'X-TYPESENSE-API-KEY: xyz' \
  --get \
  --data-urlencode 'q=life expectancy' \
  --data-urlencode 'query_by=title,containerTitle,slug,variantName,subtitle,tags,datasetProducers' \
  --data-urlencode 'query_by_weights=10,9,8,7,3,4,5' \
  --data-urlencode 'sort_by=_text_match(buckets: 8):desc,score:desc,rankTiebreaker:asc' \
  --data-urlencode 'group_by=deduplicationId' \
  --data-urlencode 'group_limit=1' \
  --data-urlencode 'stopwords=english' \
  --data-urlencode 'synonym_sets=owid' \
  --data-urlencode 'prefix=false' \
  --data-urlencode 'drop_tokens_threshold=0' \
  --data-urlencode 'text_match_type=max_weight' \
  --data-urlencode 'prioritize_num_matching_fields=false'
```

A few parameters are easy to get wrong:

| Parameter               | Why it's set the way it is                                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drop_tokens_threshold` | Typesense defaults to `1`, i.e. it silently retries with fewer tokens when a query finds nothing. We set `0` so the explicit "closest matches" fallback stays in charge, matching Algolia's default of requiring every word. |
| `prefix`                | Defaults to `true` (prefix-matches the last word). We set `false`, closer to Algolia's `disablePrefixOnAttributes` behaviour.                                                                                                |
| `_text_match(buckets:)` | Without bucketing, `_text_match` almost never ties and the `sort_by` tie-breakers after it never fire — so `score` would be ignored.                                                                                         |
| `text_match_type`       | Must be `max_weight`. The default ranks on best-field _score_ and demotes field weight to a tie-breaker, which loses Algolia's "a title match beats a tag match" rule entirely.                                              |
| `q=*`                   | Typesense has no empty-query mode; `*` matches everything, which is what a blank Algolia query does.                                                                                                                         |
