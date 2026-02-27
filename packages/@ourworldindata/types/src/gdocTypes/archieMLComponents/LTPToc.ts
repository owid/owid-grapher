import {
    ArchieMLUnexpectedNonObjectValue,
    EnrichedBlockWithParseErrors,
} from "./generic.js"

export type RawBlockLTPToc = {
    type: "ltp-toc"
    value?:
        | {
              title?: string
          }
        | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockLTPToc = {
    type: "ltp-toc"
    title?: string
} & EnrichedBlockWithParseErrors
