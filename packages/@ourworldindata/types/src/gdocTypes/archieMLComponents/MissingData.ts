import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockMissingData = {
    type: "missing-data"
    value?: Record<string, never>
}

/** @see ./MissingData.md */
export type EnrichedBlockMissingData = {
    type: "missing-data"
    value?: Record<string, never>
} & EnrichedBlockWithParseErrors
