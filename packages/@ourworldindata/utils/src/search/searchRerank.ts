// Shared by the site's search page and functions/api/search/rerank-charts.ts —
// see ./README.md.

/**
 * How many pages of the site's charts section the experimental reranker
 * serves. It reorders the hits of all these pages as one pool, so each of
 * them must come from that pool. Later pages go to Algolia directly and start
 * exactly where the pool ends, so no hit is shown twice or skipped.
 */
export const RERANK_PAGES = 3
