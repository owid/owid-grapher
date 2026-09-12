import {
    BespokeMetadataSchema,
    shouldRenderBespokeMetadata,
    type BespokeMetadata,
} from "@ourworldindata/types"

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
