import type { OwidEnrichedGdocBlock } from "../ArchieMlComponents.js"
export type ArchieMLUnexpectedNonObjectValue = string

export type ParseError = {
    message: string
    isWarning?: boolean
}

export type EnrichedBlockWithParseErrors = {
    parseErrors: ParseError[]
}

export enum BlockSize {
    Narrow = "narrow",
    Wide = "wide",
    Widest = "widest",
}

export function checkIsBlockSize(size: unknown): size is BlockSize {
    if (typeof size !== "string") return false
    return Object.values(BlockSize).includes(size as any)
}

export const blockVisibilitys = ["desktop", "mobile"] as const

export type BlockVisibility = (typeof blockVisibilitys)[number]

export const blockAlignments = ["left", "center", "right"] as const

export type BlockAlignment = (typeof blockAlignments)[number]

/* This can either be a link to a gdoc/grapher/explorer or external URL */
export type RawHybridLink = {
    url?: string
    title?: string
    subtitle?: string
}

/* This can either be a link to a gdoc/grapher/explorer or external URL */
export type EnrichedHybridLink = {
    url: string
    title?: string
    subtitle?: string
    thumbnail?: string
    type: "hybrid-link"
}

export type Ref = {
    id: string
    // Can be -1
    index: number
    content: OwidEnrichedGdocBlock[]
    parseErrors: ParseError[]
}

export type RefDictionary = {
    [refId: string]: Ref
}
