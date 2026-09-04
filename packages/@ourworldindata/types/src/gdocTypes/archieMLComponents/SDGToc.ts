import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockSDGToc = {
    type: "sdg-toc"
    value?: Record<string, never>
}

/** @see [SDGToc.md](./SDGToc.md) */
export type EnrichedBlockSDGToc = {
    type: "sdg-toc"
    value?: Record<string, never>
} & EnrichedBlockWithParseErrors
