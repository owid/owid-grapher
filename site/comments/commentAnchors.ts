export const COMMENT_ANCHOR_ATTRIBUTE = "data-comment-anchor"

/**
 * The parts of a data page staff can anchor comments to. Values are stored in
 * the comments table (comments.anchor), so treat renames as data migrations.
 * Site components declare where an anchor lives by spreading
 * commentAnchorAttrs() on the element that renders the field.
 *
 * This module is imported by public data page components, so it must stay
 * tiny: human-readable labels live in anchorLabels.ts, which is only pulled
 * into the lazily loaded comments UI.
 */
export type DataPageCommentAnchor =
    | "descriptionShort"
    | "source"
    | "lastUpdated"
    | "nextUpdate"
    | "dateRange"
    | "unit"
    | "unitConversionFactor"
    | "links"
    | "descriptionKey"
    | "sourcesAndProcessing"
    | "faqs"

export function commentAnchorAttrs(anchor: DataPageCommentAnchor): {
    [COMMENT_ANCHOR_ATTRIBUTE]: string
} {
    return { [COMMENT_ANCHOR_ATTRIBUTE]: anchor }
}
