import {
    BespokeMetadataSchema,
    BespokeMetadataWithProvenance,
    OwidGdocBaseInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocFeaturedVizContent,
    OwidGdocFeaturedVizInterface,
    excludeNullish,
    fetchJson,
    hasProvenance,
} from "@ourworldindata/utils"
import {
    EnrichedBlockBespokeComponent,
    OwidEnrichedGdocBlock,
} from "@ourworldindata/types"
import { logErrorAndMaybeCaptureInSentry } from "../../../serverUtils/errorLog.js"
import { BESPOKE_COMPONENT_REGISTRY } from "../../../site/bespokeComponentRegistry.js"
import { GdocBase } from "./GdocBase.js"

const METADATA_FETCH_TIMEOUT_MS = 10_000

export class GdocFeaturedViz
    extends GdocBase
    implements OwidGdocFeaturedVizInterface
{
    declare content: OwidGdocFeaturedVizContent
    bespokeMetadata?: BespokeMetadataWithProvenance

    constructor(id?: string) {
        super(id)
    }

    protected override typeSpecificFilenames(): string[] {
        return excludeNullish([this.content["featured-image"]])
    }

    override _getSubclassEnrichedBlocks = (
        gdoc: this
    ): OwidEnrichedGdocBlock[] => {
        if (!gdoc.content.refs?.definitions) return []
        return Object.values(gdoc.content.refs.definitions).flatMap(
            (definition) => definition.content
        )
    }

    override _loadSubclassAttachments = async (): Promise<void> => {
        await this.loadBespokeMetadata()
    }

    // Called from the baker too, which bakes published gdocs without loadState
    loadBespokeMetadata = async (): Promise<void> => {
        const heroBlock = (this.content.body ?? []).find(
            (block): block is EnrichedBlockBespokeComponent =>
                block.type === "bespoke-component"
        )
        if (!heroBlock) return

        const { bundle } = heroBlock
        const metadataUrl = BESPOKE_COMPONENT_REGISTRY[bundle]?.metadataUrl
        if (!metadataUrl) return

        let json: unknown
        try {
            json = await fetchJson<unknown>(metadataUrl, {
                timeoutMs: METADATA_FETCH_TIMEOUT_MS,
            })
        } catch (error) {
            await logErrorAndMaybeCaptureInSentry(
                new Error(
                    `Could not fetch metadata for bespoke component "${bundle}" from ${metadataUrl}, so "${this.slug}" will render without a methods block: ${error}`
                )
            )
            return
        }

        const parsed = BespokeMetadataSchema.safeParse(json)
        if (!parsed.success) {
            await logErrorAndMaybeCaptureInSentry(
                new Error(
                    `Metadata for bespoke component "${bundle}" at ${metadataUrl} does not match BespokeMetadataSchema, so "${this.slug}" will render without a methods block: ${parsed.error.message}`
                )
            )
            return
        }

        if (!hasProvenance(parsed.data)) {
            // z.object strips unknown keys, so a metadata file carrying none
            // of the schema's fields parses to {}.
            if (Object.keys(parsed.data).length > 0) {
                await logErrorAndMaybeCaptureInSentry(
                    new Error(
                        `Metadata for bespoke component "${bundle}" at ${metadataUrl} carries provenance fields but not both a title and origins, so "${this.slug}" will render without a methods block`
                    )
                )
            }
            return
        }

        this.bespokeMetadata = parsed.data
    }

    override _validateSubclass = async (): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []

        // Only top-level bespoke-component blocks count: the page renders the
        // first one on its blue band, and it can't do that for a block nested
        // inside a container.
        const hasBespokeBlock = (this.content.body ?? []).some(
            (block) => block.type === "bespoke-component"
        )

        if (!hasBespokeBlock) {
            errors.push({
                property: "body",
                message:
                    "A featured viz page must contain a {.bespoke-component} block at the top level of its body. Without one the page has no featured viz to show.",
                type: OwidGdocErrorMessageType.Error,
            })
        }

        return errors
    }

    static create(obj: OwidGdocBaseInterface): GdocFeaturedViz {
        const gdoc = new GdocFeaturedViz(undefined)
        Object.assign(gdoc, obj)
        return gdoc
    }
}
