import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockResearchAndWritingLink = {
    url?: string
    authors?: string
    title?: string
    subtitle?: string
    filename?: string
    date?: string
}

export type RawBlockResearchAndWritingRow = {
    heading?: string
    articles?: RawBlockResearchAndWritingLink[]
}

export type RawBlockLatestWork = {
    heading?: string
}

export const RESEARCH_AND_WRITING_VARIANTS = ["featured"] as const
export type ResearchAndWritingVariant =
    (typeof RESEARCH_AND_WRITING_VARIANTS)[number]

export type RawBlockResearchAndWriting = {
    type: "research-and-writing"
    value: {
        heading?: string
        "hide-authors"?: string
        "hide-date"?: string
        variant?: ResearchAndWritingVariant
        // We're migrating these to be arrays, but have to support the old use-case until it's done
        primary?:
            | RawBlockResearchAndWritingLink
            | RawBlockResearchAndWritingLink[]
        secondary?:
            | RawBlockResearchAndWritingLink
            | RawBlockResearchAndWritingLink[]
        more?: RawBlockResearchAndWritingRow
        rows?: RawBlockResearchAndWritingRow[]
        latest?: RawBlockLatestWork
    }
}

export type EnrichedBlockResearchAndWritingLink = {
    value: {
        url: string
        authors?: string[]
        title?: string
        subtitle?: string
        filename?: string
        date?: string
    }
}

export type EnrichedBlockResearchAndWritingRow = {
    heading: string
    articles: EnrichedBlockResearchAndWritingLink[]
}

export type EnrichedBlockLatestWork = {
    heading?: string
    articles?: EnrichedBlockResearchAndWritingLink[]
}

export type EnrichedBlockResearchAndWriting = {
    type: "research-and-writing"
    heading?: string
    "hide-authors": boolean
    "hide-date": boolean
    variant?: ResearchAndWritingVariant
    primary: EnrichedBlockResearchAndWritingLink[]
    secondary: EnrichedBlockResearchAndWritingLink[]
    more?: EnrichedBlockResearchAndWritingRow
    rows: EnrichedBlockResearchAndWritingRow[]
    latest?: EnrichedBlockLatestWork
} & EnrichedBlockWithParseErrors
