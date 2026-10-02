/**
 * What happened to the preview image of one chart component when syncing chart
 * preview images into a Google Doc.
 */
export type GdocChartPreviewStatus =
    /** The existing image was replaced with a fresh render */
    | "updated"
    /** An image was added above a component that had none */
    | "inserted"
    /** The existing image already shows the current version of the chart */
    | "upToDate"
    /** The component has no image above it and inserting wasn't requested */
    | "missing"
    /** The component doesn't point to a chart we know about */
    | "unresolved"
    /** The image couldn't be rendered or written into the doc */
    | "failed"

export interface GdocChartPreviewItem {
    tabTitle: string
    /** The ArchieML component type, e.g. "chart" */
    componentType: string
    /** What the component points to, e.g. the chart URL */
    target: string
    status: GdocChartPreviewStatus
    message?: string
}

export interface GdocChartPreviewRefreshResult {
    gdocId: string
    dryRun: boolean
    items: GdocChartPreviewItem[]
}
