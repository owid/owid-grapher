# Typesense Search Queries

## Overview

Our Typesense setup uses **hybrid search**: a combination of keyword (BM25) and vector (semantic) search. The balance is controlled by the `alpha` parameter:

- `alpha: 0.0` = pure keyword search
- `alpha: 1.0` = pure vector (semantic) search
- `alpha: 0.3` = our default (70% keyword, 30% vector)

The embedding field must be listed in `query_by` for hybrid search to work.

## Collections

| Collection | Index name                  | `query_by` fields                                                                            | Embedding source            |
| ---------- | --------------------------- | -------------------------------------------------------------------------------------------- | --------------------------- |
| Pages      | `pages`                     | `embedding,title,excerpt,tags,authors,content`                                               | `title`, `content`          |
| Charts     | `explorer-views-and-charts` | `embedding,title,slug,variantName,subtitle,tags,availableEntities,originalAvailableEntities` | `title`, `subtitle`, `tags` |

## Query Examples

All examples use the Typesense REST API against a local Typesense instance.

### Keyword-only search

Pure BM25 text matching. No `vector_query` parameter needed — just omit it or don't include `embedding` in `query_by`.

```bash
curl "http://localhost:8108/collections/pages/documents/search" \
  -H "X-TYPESENSE-API-KEY:xyz" \
  --data-urlencode 'q=child mortality' \
  --data-urlencode 'query_by=title,excerpt,tags,authors,content' \
  --data-urlencode 'include_fields=title,slug,type,score' \
  --data-urlencode 'filter_by=type:=article' \
  --data-urlencode 'per_page=10' \
  --data-urlencode 'page=1' \
  -G
```

### Semantic-only search

Set `alpha: 1.0` to rely entirely on vector similarity. The `q` parameter is still required (Typesense embeds it at query time).

```bash
curl "http://localhost:8108/collections/pages/documents/search" \
  -H "X-TYPESENSE-API-KEY:xyz" \
  --data-urlencode 'q=what causes people to die young' \
  --data-urlencode 'query_by=embedding,title,excerpt,tags,authors,content' \
  --data-urlencode 'vector_query=embedding:([], k:100, alpha:1.0)' \
  --data-urlencode 'include_fields=title,slug,type,score' \
  --data-urlencode 'per_page=10' \
  --data-urlencode 'page=1' \
  -G
```

Note: `[]` means "embed the query text automatically using the same model as the field." You can also pass a pre-computed vector: `embedding:([0.12, -0.34, ...], k:100, alpha:1.0)`.

### Hybrid search (default)

Our standard mode. `alpha: 0.3` blends 70% keyword + 30% vector scores.

```bash
curl "http://localhost:8108/collections/explorer-views-and-charts/documents/search" \
  -H "X-TYPESENSE-API-KEY:xyz" \
  --data-urlencode 'q=CO2 emissions per capita' \
  --data-urlencode 'query_by=embedding,title,slug,variantName,subtitle,tags,availableEntities,originalAvailableEntities' \
  --data-urlencode 'vector_query=embedding:([], k:100, alpha:0.3)' \
  --data-urlencode 'include_fields=title,slug,type,score' \
  --data-urlencode 'filter_by=type:=[chart, explorer-view]' \
  --data-urlencode 'group_by=deduplicationId' \
  --data-urlencode 'group_limit=1' \
  --data-urlencode 'per_page=10' \
  --data-urlencode 'page=1' \
  -G
```

### Hybrid search with facet filters

Combine hybrid search with topic and country filters.

```bash
curl "http://localhost:8108/collections/explorer-views-and-charts/documents/search" \
  -H "X-TYPESENSE-API-KEY:xyz" \
  --data-urlencode 'q=poverty' \
  --data-urlencode 'query_by=embedding,title,slug,variantName,subtitle,tags,availableEntities,originalAvailableEntities' \
  --data-urlencode 'vector_query=embedding:([], k:100, alpha:0.3)' \
  --data-urlencode 'include_fields=title,slug,type,score' \
  --data-urlencode 'filter_by=tags:=Economic Growth && availableEntities:=India' \
  --data-urlencode 'group_by=deduplicationId' \
  --data-urlencode 'group_limit=1' \
  --data-urlencode 'per_page=10' \
  --data-urlencode 'page=1' \
  -G
```

### Wildcard query (browse mode)

When there's no user query, use `q=*`. Don't include `vector_query` — there's nothing to embed. Results are sorted by `score` (the `default_sorting_field`).

```bash
curl "http://localhost:8108/collections/pages/documents/search" \
  -H "X-TYPESENSE-API-KEY:xyz" \
  --data-urlencode 'q=*' \
  --data-urlencode 'query_by=embedding,title,excerpt,tags,authors,content' \
  --data-urlencode 'include_fields=title,slug,type,score' \
  --data-urlencode 'filter_by=type:=article && tags:=Climate Change' \
  --data-urlencode 'group_by=slug' \
  --data-urlencode 'group_limit=1' \
  --data-urlencode 'per_page=10' \
  --data-urlencode 'page=1' \
  -G
```

## Key Parameters Reference

| Parameter                                   | Description                                                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `q`                                         | Search query. Use `*` for wildcard (no text matching).                                                          |
| `query_by`                                  | Comma-separated fields to search. Must include `embedding` for hybrid/semantic search.                          |
| `vector_query`                              | `embedding:([], k:N, alpha:A)` — `k` is the number of nearest neighbors, `alpha` is the keyword/vector balance. |
| `filter_by`                                 | Typesense filter expression. Supports `&&`, `\|\|`, `:=` (exact), `:!=` (exclude).                              |
| `group_by`                                  | Field to group/deduplicate on. Charts use `deduplicationId`, pages use `slug`. Must be a facet field.           |
| `group_limit`                               | Max hits per group (typically `1` for deduplication).                                                           |
| `per_page`                                  | Results per page (max 250).                                                                                     |
| `page`                                      | 1-indexed page number.                                                                                          |
| `sort_by`                                   | Override default sort. E.g. `_text_match:desc,score:desc`.                                                      |
| `include_fields`                            | Comma-separated list of fields to return (reduces payload size).                                                |
| `highlight_start_tag` / `highlight_end_tag` | HTML tags to wrap matched terms in highlights.                                                                  |

## Deduplication

Typesense's `group_by` is the equivalent of Algolia's `distinct` + `attributeForDistinct`:

- **Charts**: grouped by `deduplicationId` (preserves the original Algolia `id` field, e.g. `grapher/child-mortality`)
- **Pages**: grouped by `slug` (already a facet field)

When `group_by` is active, the response structure changes from `hits` to `grouped_hits`. Our `mapTypesenseResponse` helper handles both formats.

## Embedding Model

Using OpenAI `text-embedding-3-small` (1536-dim, 8192-token limit) via Typesense's auto-embedding feature. The `OPENAI_API_KEY` server setting is injected into the collection schema at indexing time.
