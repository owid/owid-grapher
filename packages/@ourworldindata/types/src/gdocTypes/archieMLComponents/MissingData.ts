import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockMissingData = {
    type: "missing-data"
    value?: Record<string, never>
}

/**
 * Placeholder block indicating that data is missing for the current entity.
 * Internal block — not documented for authors.
 *
 * @owid-component missing-data
 * @owid-title Missing Data
 */
export type EnrichedBlockMissingData = {
    type: "missing-data"
    value?: Record<string, never>
} & EnrichedBlockWithParseErrors
