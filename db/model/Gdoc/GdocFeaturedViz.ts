import {
    BespokeMetadata,
    BespokeMetadataSchema,
    OwidGdocBaseInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocFeaturedVizContent,
    OwidGdocFeaturedVizInterface,
    excludeNullish,
    fetchJson,
    shouldRenderBespokeMetadata,
} from "@ourworldindata/utils"
import {
    EnrichedBlockBespokeComponent,
    OwidEnrichedGdocBlock,
} from "@ourworldindata/types"
import { logErrorAndMaybeCaptureInSentry } from "../../../serverUtils/errorLog.js"
import { BESPOKE_COMPONENT_REGISTRY } from "../../../bespoke/shared/bespokeComponentRegistry.js"
import { resolveBespokeComponentUrls } from "../../../bespoke/shared/bespokeComponentUrls.js"
import {
    BESPOKE_BASE_URL,
    BESPOKE_DATA_URL,
} from "../../../settings/clientSettings.mjs"
import { GdocBase } from "./GdocBase.js"

const METADATA_FETCH_TIMEOUT_MS = 10_000

export class GdocFeaturedViz
    extends GdocBase
    implements OwidGdocFeaturedVizInterface
{
    declare content: OwidGdocFeaturedVizContent
    bespokeMetadata?: BespokeMetadata

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
        const definition = BESPOKE_COMPONENT_REGISTRY[bundle]
        if (!definition) return

        const { metadataUrl } = resolveBespokeComponentUrls(definition, {
            scriptBaseUrl: BESPOKE_BASE_URL,
            dataBaseUrl: BESPOKE_DATA_URL,
        })

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
        if (!parsed.success || !shouldRenderBespokeMetadata(parsed.data)) return

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
