import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockHomepageSearch = {
    type: "homepage-search"
    value: Record<string, never>
}

/** @see ./HomepageSearch.md */
export type EnrichedBlockHomepageSearch = {
    type: "homepage-search"
} & EnrichedBlockWithParseErrors
