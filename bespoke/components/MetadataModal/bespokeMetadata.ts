import {
    BespokeMetadataSchema,
    shouldRenderBespokeMetadata,
    type BespokeMetadata,
} from "@ourworldindata/types"
import {
    formatAttributionsShortened,
    getAttributionFragmentsFromBespokeMetadata,
} from "@ourworldindata/utils"

/** Read a project's metadata file into the shape the modal renders */
export function parseBespokeMetadata(
    json: unknown
): BespokeMetadata | undefined {
    const parsed = BespokeMetadataSchema.safeParse(json)
    if (!parsed.success) {
        console.warn(
            `Metadata does not match BespokeMetadataSchema, so it will render without a methods and sources modal: ${parsed.error.message}`
        )
        return undefined
    }

    return shouldRenderBespokeMetadata(parsed.data) ? parsed.data : undefined
}

/**
 * The "Data source" line of a bespoke viz, built as a chart footer builds it:
 * the metadata's attribution if present, otherwise one entry per origin
 */
export function getBespokeSourceLine(
    metadata: Pick<BespokeMetadata, "attribution" | "origins">
): string {
    return formatAttributionsShortened(
        getAttributionFragmentsFromBespokeMetadata(metadata)
    )
}
