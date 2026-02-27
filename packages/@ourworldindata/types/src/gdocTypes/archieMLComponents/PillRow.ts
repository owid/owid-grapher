import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockPillRow = {
    type: "pill-row"
    value: {
        title?: string
        pills?: {
            text?: string
            url?: string
        }[]
    }
}

export type EnrichedBlockPillRow = {
    type: "pill-row"
    title: string
    pills: {
        // optional because when linking to a gdoc we can use that title
        text?: string
        url: string
    }[]
} & EnrichedBlockWithParseErrors
