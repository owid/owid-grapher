import { Span } from "../Spans.js"
import {
    ArchieMLUnexpectedNonObjectValue,
    EnrichedBlockWithParseErrors,
} from "./generic.js"

export type BlockPositionChoice = "right" | "left"

export type RawBlockAsideValue = {
    position?: string // use BlockPositionChoice in matching Enriched block
    caption?: string
}

export type RawBlockAside = {
    type: "aside"
    value: RawBlockAsideValue | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockAside = {
    type: "aside"
    position?: BlockPositionChoice
    caption: Span[]
} & EnrichedBlockWithParseErrors
