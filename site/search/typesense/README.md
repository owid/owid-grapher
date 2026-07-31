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
| `customRanking`                           | `sort_by` after `_text_match(buckets: 3)` (query-time)      |
| `attributeForDistinct` + `distinct: true` | `group_by` + `group_limit: 1`                               |
| `facetFilters`                            | `filter_by` with `:=` exact match                           |
| `removeStopWords: ["en"]`                 | a `stopwords` set uploaded server-side, named in each query |
| synonyms                                  | per-collection synonyms, reapplied after every reindex      |
| `removeWordsIfNoResults: "allOptional"`   | `drop_tokens_threshold` (see `typesenseClosestMatches.ts`)  |

The Algolia settings being mirrored live in `baker/algolia/configureAlgolia.ts`;
their Typesense counterparts are split between
`packages/@ourworldindata/utils/src/search/typesenseSearchParams.ts`
(query-time) and `baker/typesense/` (server-side: collection schemas, stopwords,
synonyms).

## Known differences from Algolia

This is not a behaviour-preserving swap. On a 12-query spot check, the top 5
chart results overlapped Algolia's by roughly half. The differences trace back
to one structural gap and its consequences:

**Typesense counts a query token as matched regardless of which queried field it
hit, and has no equivalent of Algolia's `exact` / `attribute` ranking criteria.**
Algolia ranks a literal match in a high-priority attribute above a
synonym-substituted match in a low-priority one, before popularity is
considered. Typesense scores both as "2 of 2 tokens matched" and then lets the
`score` tie-breaker decide, so a popular but loosely-related chart wins.

Two knock-on effects, both real and both observed:

- **Multi-word synonyms match as loose token sets, not phrases.** The group
  `["energy consumption", "energy use", …]` means the query "energy consumption"
  also matches "Land **use** per 100 grams of protein" — "use" from the title,
  "energy" from its `Energy and Environment` tag. Algolia returns energy charts.
  Similarly `["per capita", "per person"]` combined with the `gdp` group pushes
  "Energy use per person vs. GDP per capita" above the literal "GDP per capita".
- **Cross-field matching invents matches.** This is why `availableEntities` is
  excluded from `query_by` (see `typesenseSearchParams.ts`): with it, "malaria
  worldwide" matched a COVID chart titled "…coverage worldwide" that happens to
  list malaria as an entity.

Turning synonyms off does not help overall (it scored the same on the spot
check) — it trades these bad matches for missing the abbreviation queries
synonyms exist to serve. Closing the gap properly needs either query-side
reranking or a change in how synonyms are expressed, neither of which is in
this change.

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

`make reindex.typesense` recreates both collections, imports the records, and
then applies stopwords and synonyms. That order matters: synonyms are stored
per collection, so recreating a collection drops them.

Requires `TYPESENSE_INDEXING=true` in `.env`.

## Querying by hand

```sh
curl 'http://localhost:8108/collections/explorer-views-and-charts/documents/search' \
  -H 'X-TYPESENSE-API-KEY: xyz' \
  --get \
  --data-urlencode 'q=life expectancy' \
  --data-urlencode 'query_by=title,containerTitle,slug,variantName,subtitle,tags,availableEntities,originalAvailableEntities,datasetProducers' \
  --data-urlencode 'query_by_weights=10,9,8,7,3,4,2,2,5' \
  --data-urlencode 'sort_by=_text_match(buckets: 3):desc,score:desc,rankTiebreaker:asc' \
  --data-urlencode 'group_by=deduplicationId' \
  --data-urlencode 'group_limit=1' \
  --data-urlencode 'stopwords=english' \
  --data-urlencode 'prefix=false' \
  --data-urlencode 'drop_tokens_threshold=0'
```

A few parameters are easy to get wrong:

| Parameter               | Why it's set the way it is                                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drop_tokens_threshold` | Typesense defaults to `1`, i.e. it silently retries with fewer tokens when a query finds nothing. We set `0` so the explicit "closest matches" fallback stays in charge, matching Algolia's default of requiring every word. |
| `prefix`                | Defaults to `true` (prefix-matches the last word). We set `false`, closer to Algolia's `disablePrefixOnAttributes` behaviour.                                                                                                |
| `_text_match(buckets:)` | Without bucketing, `_text_match` almost never ties and the `sort_by` tie-breakers after it never fire — so `score` would be ignored.                                                                                         |
| `q=*`                   | Typesense has no empty-query mode; `*` matches everything, which is what a blank Algolia query does.                                                                                                                         |
