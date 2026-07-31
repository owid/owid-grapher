import { eng as ENGLISH_STOPWORDS } from "stopword"

// Shared between the site's client-side Typesense queries
// (site/search/queries.ts) and the public /api/search Cloudflare function
// (functions/api/search/searchApi.ts) so the "closest matches" labelling
// behaves identically in both places.
//
// Unlike the old Algolia implementation (searchClosestMatches.ts), which had
// to issue a second, relaxed request when the exact query came back empty,
// Typesense hybrid search already returns partial-keyword and semantic-only
// hits in the primary response. What's left to port is the honesty signal:
// callers label the response `closestMatches: true` whenever none of the
// returned hits keyword-matched every token of the query, so the UI can say
// "showing closest matches" instead of presenting relaxed hits as exact ones.

const STOPWORD_SET = new Set(ENGLISH_STOPWORDS)

/**
 * Number of query tokens Typesense will actually try to match. Queries are
 * sent with `stopwords: "english"`, a server-side stopword set built from the
 * same `stopword` package list (see ensureStopwordsSetExists in
 * baker/typesense/typesenseCacheTable.ts), so tokens on that list never count
 * towards a hit's `tokens_matched` and must not count towards the total
 * either — otherwise "the population of France" would be labelled a closest
 * match even when population charts for France matched perfectly.
 */
export function countMatchableQueryTokens(query: string): number {
    const tokens = query
        .toLowerCase()
        // Quotes are Algolia/Typesense phrase syntax (country names are sent
        // as exact phrases), not part of any token.
        .replace(/["']/g, " ")
        .split(/\s+/)
        .filter(Boolean)
    const matchable = tokens.filter((token) => !STOPWORD_SET.has(token))
    // When every token is a stopword, Typesense skips stopword removal
    // (removing all tokens would match nothing), so they all count again.
    return (matchable.length > 0 ? matchable : tokens).length
}

/** The per-hit match metadata Typesense returns alongside each document. */
export interface TypesenseTextMatchInfo {
    tokens_matched?: number
}

/**
 * True when the hits are hybrid-search "closest matches" rather than exact
 * results: the query has matchable tokens, hits came back, but not even the
 * best hit keyword-matched every token — i.e. everything on the page is a
 * partial keyword match and/or a semantic-only (vector) match.
 *
 * Example: "malaria worldwide" — no chart contains both words, so the keyword
 * arm matches at most "malaria" (tokens_matched: 1 < 2), yet the malaria
 * charts the user wants are all there. The label lets the UI present them as
 * closest matches instead of exact ones.
 */
export function areTypesenseHitsClosestMatches(
    query: string,
    hits: { text_match_info?: TypesenseTextMatchInfo }[]
): boolean {
    const trimmed = query.trim()
    if (!trimmed || trimmed === "*") return false
    if (hits.length === 0) return false

    const totalTokens = countMatchableQueryTokens(trimmed)
    if (totalTokens === 0) return false

    const bestTokensMatched = Math.max(
        ...hits.map((hit) => hit.text_match_info?.tokens_matched ?? 0)
    )
    return bestTokensMatched < totalTokens
}
