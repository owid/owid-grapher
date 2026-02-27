import { BlockSize, EnrichedBlockWithParseErrors } from "./generic.js"
import { Span } from "../Spans.js"

export type RawBlockStaticViz = {
    type: "static-viz"
    value: {
        name?: string
        size?: BlockSize
        hasOutline?: string
        caption?: string
    }
}

export type EnrichedBlockStaticViz = {
    type: "static-viz"
    name: string
    size: BlockSize
    hasOutline: boolean
    caption?: Span[]
} & EnrichedBlockWithParseErrors
