import { BundleReference, JsonError } from "@ourworldindata/types"

/**
 * A query param of the bespoke preview: whether the request has it at all
 * (even empty), and its value when it is a single string.
 */
export interface PreviewQueryParam {
    given: boolean
    value: string | undefined
}

/** The block a bespoke preview renders, and the title of its page. */
export interface BespokePreviewBlock {
    title: string
    archie: string
}

/**
 * Pick the registry block a bespoke preview renders: the default block of a
 * variant (?variant=<name>) or one of the bundle's docs.md examples
 * (?example=<index>). Exactly one of the two must be given; anything else
 * is a 404. The ArchieML always comes from `bundles` — nothing from the
 * request ends up in the block.
 */
export function selectBespokePreviewBlock(
    bundles: BundleReference[],
    bundleId: string,
    variantParam: PreviewQueryParam,
    exampleParam: PreviewQueryParam
): BespokePreviewBlock {
    const bundle = bundles.find((bundle) => bundle.id === bundleId)
    if (!bundle) throw new JsonError(`No such bundle: "${bundleId}"`, 404)
    if (variantParam.given === exampleParam.given)
        throw new JsonError(
            `Give exactly one of "variant" and "example" for bundle "${bundleId}"`,
            404
        )

    if (exampleParam.given) {
        // Checked as digits first: Number("") is 0, so "?example=" would
        // otherwise preview example 0.
        const raw = exampleParam.value
        const index = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : -1
        const example = index >= 0 ? bundle.examples[index] : undefined
        if (!example)
            throw new JsonError(
                `Bundle "${bundleId}" has no example at index "${raw ?? ""}"`,
                404
            )
        return {
            title: `${bundle.id} #${index + 1}`,
            archie: example.archie,
        }
    }

    const variantName = variantParam.value
    if (!variantName)
        throw new JsonError(`No variant given for bundle "${bundleId}"`, 404)
    const variant = bundle.variants.find(
        (variant) => variant.name === variantName
    )
    if (!variant)
        throw new JsonError(
            `No such variant of bundle "${bundleId}": "${variantName}"`,
            404
        )
    return { title: `${bundle.id} ${variant.name}`, archie: variant.archie }
}
