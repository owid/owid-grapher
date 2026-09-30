import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockHtml = {
    type: "html"
    value: string
}

/** @see [Html.md](./Html.md) */
export type EnrichedBlockHtml = {
    type: "html"
    value: string
} & EnrichedBlockWithParseErrors
