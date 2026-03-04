# AI Search API

Search endpoints powered by [Cloudflare AI Search](https://developers.cloudflare.com/ai-search/) (semantic search over R2-stored markdown documents) and Gemini (agentic chart recommendation).

All endpoints are `GET` requests and return JSON. CORS is enabled (`Access-Control-Allow-Origin: *`).

## Endpoints

### `GET /api/ai-search/charts`

Semantic chart/explorer/multiDim search using Cloudflare AI Search with combined scoring (AI relevance + featured metric rank + pageviews).

| Param         | Type   | Default      | Description                                                    |
| ------------- | ------ | ------------ | -------------------------------------------------------------- |
| `q`           | string | _(required)_ | Search query                                                   |
| `page`        | int    | `0`          | Page number (only page 0 currently supported)                  |
| `hitsPerPage` | int    | `20`         | Results per page (max 100)                                     |
| `type`        | string | _(all)_      | Filter by type: `chart`, `explorer`, `mdim` (comma-separated)  |
| `verbose`     | bool   | `false`      | Include `availableEntities` in response                        |
| `rerank`      | bool   | `false`      | Enable BGE reranker model                                      |
| `rewrite`     | bool   | `false`      | Enable query rewriting for better retrieval                    |
| `llmRerank`   | bool   | `false`      | Enable LLM-based reranking and filtering                       |
| `llmModel`    | string | `small`      | LLM reranking model: `small` (Llama 8B) or `large` (Llama 70B) |
| `countries`   | string | —            | Country filter (accepted but not yet implemented)              |
| `topics`      | string | —            | Topic filter (accepted but not yet implemented)                |

### `GET /api/ai-search/articles`

Semantic search over articles, about pages, topic pages, and data insights using Cloudflare AI Search.

| Param         | Type   | Default         | Description                                                                        |
| ------------- | ------ | --------------- | ---------------------------------------------------------------------------------- |
| `q`           | string | _(required)_    | Search query                                                                       |
| `page`        | int    | `0`             | Page number                                                                        |
| `hitsPerPage` | int    | `10`            | Results per page (max 100)                                                         |
| `type`        | string | `article,about` | Content type filter: `article`, `about`, `topic`, `data-insight` (comma-separated) |

The response format varies based on the `type` parameter:

- `article`/`about` — returns `ArticleHit[]` with content snippets
- `topic` — returns `TopicPageHit[]` with excerpts
- `data-insight` — returns `DataInsightHit[]` with thumbnails

### `GET /api/ai-search/agent`

Agentic chart recommendation using Gemini with AI SDK tool calling. The LLM searches for charts (via Algolia keyword search or Cloudflare semantic search) and selects the most relevant ones.

| Param         | Type   | Default      | Description                                                      |
| ------------- | ------ | ------------ | ---------------------------------------------------------------- |
| `q`           | string | _(required)_ | Search query                                                     |
| `hitsPerPage` | int    | `5`          | Max recommendations (max 10)                                     |
| `model`       | string | `gemini`     | Gemini model alias (see below)                                   |
| `search`      | string | `keyword`    | Search backend: `keyword` (Algolia) or `semantic` (CF AI Search) |
| `type`        | string | `all`        | Filter: `chart`, `explorer`, `mdim`, `all`                       |
| `verbose`     | bool   | `false`      | Include all chart fields in response                             |
| `debug`       | bool   | `false`      | Include debug info (LLM steps, token usage, cost estimate)       |

**Model aliases:**

| Alias              | Resolves to              |
| ------------------ | ------------------------ |
| `gemini` (default) | `gemini-2.5-flash-lite`  |
| `gemini-lite`      | `gemini-2.5-flash-lite`  |
| `gemini-2.5-flash` | `gemini-2.5-flash`       |
| `gemini-3-flash`   | `gemini-3-flash-preview` |

## Parameter naming

All endpoints use `page`/`hitsPerPage` for pagination and `type` for content type filtering, consistent with the existing `/api/search` (Algolia) endpoint.
