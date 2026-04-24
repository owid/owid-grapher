import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockSDGToc = {
    type: "sdg-toc"
    value?: Record<string, never>
}

/**
 * Table of contents for the SDG tracker. Legacy block. Undocumented in
 * the author reference.
 *
 * @owid-component sdg-toc
 * @owid-title SDG Table of Contents
 */
export type EnrichedBlockSDGToc = {
    type: "sdg-toc"
    value?: Record<string, never>
} & EnrichedBlockWithParseErrors
