import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockEntrySummaryItem = {
    text?: string
    slug?: string
}

// This block renders via the TableOfContents component, same as the sdg-toc block.
// Because the summary headings can differ from the actual headings in the document,
// we need to serialize the text and slug explicitly, instead of programmatically generating them
// by analyzing the document (like we do for the sdg-toc block)
export type RawBlockEntrySummary = {
    type: "entry-summary"
    value: {
        items?: RawBlockEntrySummaryItem[]
    }
}

export type EnrichedBlockEntrySummaryItem = {
    text: string
    slug: string
}

export type EnrichedBlockEntrySummary = {
    type: "entry-summary"
    items: EnrichedBlockEntrySummaryItem[]
} & EnrichedBlockWithParseErrors
