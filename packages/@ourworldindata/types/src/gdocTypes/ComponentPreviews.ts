/**
 * What happens (or, in a dry run, would happen) to the preview image of one
 * component when syncing preview images into a Google Doc.
 */
export type GdocComponentPreviewStatus =
    /** The existing image was replaced with a fresh render */
    | "updated"
    /** An image was added above a component that had none */
    | "inserted"
    /** The existing image already shows the current version of the chart */
    | "upToDate"
    /**
     * The component's image is below it rather than above, so it's left
     * alone. Moving it above lets it be kept up to date.
     */
    | "imageBelow"
    /** The component doesn't point to a chart we know about */
    | "unresolved"
    /** The image couldn't be rendered or written into the doc */
    | "failed"

/** Why an existing image gets replaced */
export type GdocComponentPreviewUpdateReason =
    /** It's one of our previews, of an older version or a different target */
    | "outdated"
    /** It wasn't inserted by us, e.g. pasted in by hand */
    | "pastedByHand"
    /** It's current, but its frame has a different shape, so it's cropped */
    | "wrongShape"

export interface GdocComponentPreviewItem {
    tabTitle: string
    /** The ArchieML component type, e.g. "chart" */
    componentType: string
    /** What the component points to, e.g. the chart URL */
    target: string
    status: GdocComponentPreviewStatus
    /** Set for "updated" */
    reason?: GdocComponentPreviewUpdateReason
    message?: string
}

export interface GdocComponentPreviewRefreshResult {
    gdocId: string
    dryRun: boolean
    items: GdocComponentPreviewItem[]
}
