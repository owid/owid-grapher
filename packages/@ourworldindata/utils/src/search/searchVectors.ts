// Shared by the script that embeds the search records
// (baker/vectorize/buildSearchEmbeddings.ts) and the search function that
// embeds a query (functions/api/search/vectorCandidates.ts): both sides have
// to use the same model, or the vectors aren't comparable.

/** Workers AI embedding model: multilingual, 1024 dimensions. */
export const SEARCH_EMBEDDING_MODEL = "@cf/baai/bge-m3"

/** The Vectorize namespace of each search index's records. */
export const VECTOR_NAMESPACES = {
    charts: "charts",
    pages: "pages",
} as const
