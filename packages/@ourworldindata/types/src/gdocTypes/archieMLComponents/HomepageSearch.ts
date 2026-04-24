import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockHomepageSearch = {
    type: "homepage-search"
    value: Record<string, never>
}

/**
 * A wide section with a site-wide search bar. No props.
 *
 * ## When to use
 * - Only on the homepage (`type: homepage`), near the top.
 *
 * ## When NOT to use
 * - Elsewhere. The site header already exposes search.
 *
 * @owid-component homepage-search
 * @owid-title Homepage Search
 * @example Basic
 * ```archie
 * {.homepage-search}
 * {}
 * ```
 */
export type EnrichedBlockHomepageSearch = {
    type: "homepage-search"
} & EnrichedBlockWithParseErrors
