import { DataPageDataV2 } from "@ourworldindata/types"

/**
 * A comment is attached to a metadata *field*, not to the text that field
 * currently holds. Field identity survives the two things that actually change:
 * someone editing the value (which is usually the point of the comment - "fix
 * this typo" must stay attached after the typo is fixed) and the page being
 * laid out differently.
 *
 * Field values are never sent to the client. A field is located by the marker
 * the rendering component puts on it, so the page never has to be searched for
 * matching text.
 */
export interface CommentField {
    /** Stored in comments.anchor. Stable across edits and redesigns. */
    key: string
    label: string
    /**
     * Chart-level fields are rendered by grapher and located exactly through
     * its data-grapher-part hooks; on a multi-dim they change per view, so
     * there is no server-side value to match against.
     */
    grapherPart?: "title" | "subtitle" | "note"
}

/**
 * A field is only offered when the page actually has a value for it - an empty
 * one is rendered nowhere, so it could never be located. The value itself is
 * not kept.
 */
function textField(
    key: string,
    label: string,
    value: string | number | undefined | null
): CommentField | undefined {
    if (value === undefined || value === null || value === "") return undefined
    return { key, label }
}

/**
 * Chart-level metadata: the title, subtitle and note as the chart shows them.
 * Located through grapher's own markup rather than by value, so multi-dim views
 * - where these change as the reader switches dimensions - work without the
 * server knowing which view is on screen.
 *
 * All three are offered whenever the chart draws them, even when the text is
 * not authored on the chart but inherited (grapher falls back to the
 * indicator's title for a missing title, and to its short description for a
 * missing subtitle). Someone commenting shouldn't have to know which: they see
 * a subtitle, so they can comment on it. Which underlying field a comment
 * concerns is a question for whoever triages it, and is decidable from what the
 * comment already records - see db/docs/comments.yml, `anchor`.
 *
 * Nothing needs to suppress a field the chart has no text for: grapher only
 * marks up the parts it actually draws, so an absent one is simply not found.
 */
export function chartCommentFields(): CommentField[] {
    return [
        { key: "title", label: "Chart title", grapherPart: "title" },
        { key: "subtitle", label: "Chart subtitle", grapherPart: "subtitle" },
        { key: "note", label: "Chart note", grapherPart: "note" },
    ]
}

/**
 * The indicator metadata a data page puts on screen. These describe an
 * indicator, but a comment on one is recorded against the chart or multi-dim
 * view showing it - it says "the unit on this chart is wrong", not "indicator
 * 1234's unit is wrong".
 */
export function indicatorCommentFields(
    datapageData: DataPageDataV2
): CommentField[] {
    const attribution = datapageData.attributions?.join("; ")
    return [
        textField(
            "indicatorTitle",
            "Indicator title",
            datapageData.title?.title
        ),
        textField("titleVariant", "Title variant", datapageData.titleVariant),
        textField(
            "descriptionShort",
            "Short description",
            datapageData.descriptionShort
        ),
        textField(
            "descriptionKey",
            "What you should know",
            datapageData.descriptionKey
        ),
        textField(
            "descriptionFromProducer",
            "Description from producer",
            datapageData.descriptionFromProducer
        ),
        textField(
            "descriptionProcessing",
            "How we process this data",
            datapageData.descriptionProcessing
        ),
        textField("source", "Data source", attribution),
        textField("unit", "Unit", datapageData.unit),
        textField(
            "unitConversionFactor",
            "Unit conversion factor",
            datapageData.unitConversionFactor
        ),
        textField("dateRange", "Date range", datapageData.dateRange),
        textField("lastUpdated", "Last updated", datapageData.lastUpdated),
        textField(
            "nextUpdate",
            "Next expected update",
            datapageData.nextUpdate
        ),
    ].filter((field): field is CommentField => field !== undefined)
}
