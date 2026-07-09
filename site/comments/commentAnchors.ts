export const COMMENT_ANCHOR_ATTRIBUTE = "data-comment-anchor"

/**
 * The parts of a data page staff can anchor comments to. Keys are stored in
 * the comments table (comments.anchor), so treat renames as data migrations.
 * Site components declare where an anchor lives by spreading
 * commentAnchorAttrs() on the element that renders the field.
 */
export const DATA_PAGE_COMMENT_ANCHORS = {
    descriptionShort: "Title and short description",
    source: "Source",
    lastUpdated: "Last updated",
    nextUpdate: "Next expected update",
    dateRange: "Date range",
    unit: "Unit",
    unitConversionFactor: "Unit conversion factor",
    links: "Links",
    descriptionKey: "What you should know about this data",
    sourcesAndProcessing: "Sources and processing",
    faqs: "FAQs",
} as const

export type DataPageCommentAnchor = keyof typeof DATA_PAGE_COMMENT_ANCHORS

export function commentAnchorAttrs(anchor: DataPageCommentAnchor): {
    [COMMENT_ANCHOR_ATTRIBUTE]: string
} {
    return { [COMMENT_ANCHOR_ATTRIBUTE]: anchor }
}
