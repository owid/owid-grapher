import { Span } from "../Spans.js"
import { BlockVisibility, EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockVideo = {
    type: "video"
    value: {
        url?: string
        caption?: string
        shouldLoop?: string
        shouldAutoplay?: string
        filename?: string
        visibility?: string
    }
}

export type EnrichedBlockVideo = {
    type: "video"
    url: string
    shouldLoop: boolean
    shouldAutoplay: boolean
    filename: string
    caption?: Span[]
    visibility?: BlockVisibility
} & EnrichedBlockWithParseErrors
