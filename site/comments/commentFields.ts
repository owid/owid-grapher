import { DataPageDataV2, GrapherInterface } from "@ourworldindata/types"

/**
 * A comment is attached to a metadata *field*, not to the text that field
 * currently holds. Field identity survives the two things that actually change:
 * someone editing the value (which is usually the point of the comment - "fix
 * this typo" must stay attached after the typo is fixed) and the page being
 * laid out differently.
 *
 * Values travel alongside only so the overlay can find where to put a pin. They
 * are never used to identify a comment.
 */
export interface CommentField {
    /** Stored in comments.anchor. Stable across edits and redesigns. */
    key: string
    label: string
    /** Current value, used to locate the field on the page. May be absent. */
    value?: string
    /**
     * Chart-level fields are rendered by grapher and located exactly through
     * its data-grapher-part hooks; on a multi-dim they change per view, so
     * there is no server-side value to match against.
     */
    grapherPart?: "title" | "subtitle" | "note"
    /** Index into CommentPageContext.targets */
    targetIndex: number
}

function textField(
    key: string,
    label: string,
    value: string | number | undefined | null,
    targetIndex: number
): CommentField | undefined {
    if (value === undefined || value === null || value === "") return undefined
    return { key, label, value: String(value), targetIndex }
}

/**
 * Chart-level metadata: what the chart editor controls. Located through
 * grapher's own markup rather than by value, so multi-dim views - where these
 * change as the reader switches dimensions - work without the server knowing
 * which view is on screen.
 */
export function chartCommentFields(targetIndex: number): CommentField[] {
    return [
        { key: "title", label: "Chart title", grapherPart: "title", targetIndex },
        {
            key: "subtitle",
            label: "Chart subtitle",
            grapherPart: "subtitle",
            targetIndex,
        },
        { key: "note", label: "Chart note", grapherPart: "note", targetIndex },
    ]
}

/** Indicator metadata, as shown on a data page */
export function indicatorCommentFields(
    datapageData: DataPageDataV2,
    targetIndex: number
): CommentField[] {
    const attribution = datapageData.attributions?.join("; ")
    return [
        textField("indicatorTitle", "Indicator title", datapageData.title?.title, targetIndex),
        textField("titleVariant", "Title variant", datapageData.titleVariant, targetIndex),
        textField("attributionShort", "Attribution (short)", datapageData.attributionShort, targetIndex),
        textField("descriptionShort", "Short description", datapageData.descriptionShort, targetIndex),
        textField("descriptionKey", "What you should know", datapageData.descriptionKey, targetIndex),
        textField("descriptionFromProducer", "Description from producer", datapageData.descriptionFromProducer, targetIndex),
        textField("descriptionProcessing", "How we process this data", datapageData.descriptionProcessing, targetIndex),
        textField("source", "Data source", attribution, targetIndex),
        textField("unit", "Unit", datapageData.unit, targetIndex),
        textField("unitConversionFactor", "Unit conversion factor", datapageData.unitConversionFactor, targetIndex),
        textField("dateRange", "Date range", datapageData.dateRange, targetIndex),
        textField("lastUpdated", "Last updated", datapageData.lastUpdated, targetIndex),
        textField("nextUpdate", "Next expected update", datapageData.nextUpdate, targetIndex),
    ].filter((field): field is CommentField => field !== undefined)
}

/** Chart-level fields taken from a grapher config, for pages without a data page */
export function chartFieldsFromConfig(
    grapher: GrapherInterface | undefined,
    targetIndex: number
): CommentField[] {
    if (!grapher) return []
    return chartCommentFields(targetIndex).filter((field) => {
        if (field.grapherPart === "title") return !!grapher.title
        if (field.grapherPart === "subtitle") return !!grapher.subtitle
        if (field.grapherPart === "note") return !!grapher.note
        return true
    })
}
