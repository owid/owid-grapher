import { Span } from "../Spans.js"
import {
    BlockSize,
    BlockVisibility,
    EnrichedBlockWithParseErrors,
} from "./generic.js"

export type RawBlockImage = {
    type: "image"
    value: {
        filename?: string
        smallFilename?: string
        alt?: string
        caption?: string
        size?: BlockSize
        hasOutline?: string
        visibility?: string
    }
}

export type EnrichedBlockImage = {
    type: "image"
    filename: string
    smallFilename?: string
    alt?: string // optional as we can use the default alt from the file
    caption?: Span[]
    originalWidth?: number
    size: BlockSize
    hasOutline: boolean
    visibility?: BlockVisibility
    // Not a real ArchieML prop - we set this to true for Data Insights, as a way to migrate
    // first generation data insights to only use their small image
    // See https://github.com/owid/owid-grapher/issues/4416
    preferSmallFilename?: boolean
} & EnrichedBlockWithParseErrors
