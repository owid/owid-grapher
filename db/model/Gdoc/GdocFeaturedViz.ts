import {
    BespokeMetadata,
    BespokeMetadataSchema,
    OwidGdocBaseInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocFeaturedVizContent,
    OwidGdocFeaturedVizInterface,
    OwidGdocType,
    excludeNullish,
    fetchJson,
    parsePinnedSearches,
    shouldRenderBespokeMetadata,
} from "@ourworldindata/utils"
import {
    parseAcknowledgements,
    parseContributors,
} from "@ourworldindata/gdoc-pipeline"
import {
    EnrichedBlockBespokeComponent,
    OwidEnrichedGdocBlock,
} from "@ourworldindata/types"
import { logErrorAndMaybeCaptureInSentry } from "../../../serverUtils/errorLog.js"
import { BESPOKE_COMPONENT_REGISTRY } from "../../../bespoke/shared/bespokeComponentRegistry.js"
import { resolveBespokeComponentUrls } from "../../../bespoke/shared/bespokeComponentUrls.js"
import { BESPOKE_DATA_URL } from "../../../settings/clientSettings.mjs"
import { GdocBase } from "./GdocBase.js"
import * as db from "../../db.js"

const METADATA_FETCH_TIMEOUT_MS = 10_000

export interface PinnedSearchClash {
    search: string
    slug: string
}

/** The searches this gdoc is pinned for that another published featured viz
 *  is already pinned for, each with that other page's slug. */
export async function getPinnedSearchClashes(
    knex: db.KnexReadonlyTransaction,
    gdoc: { id: string; content: { "pinned-for-searches"?: string[] } }
): Promise<PinnedSearchClash[]> {
    const searches = gdoc.content["pinned-for-searches"] ?? []
    if (searches.length === 0) return []

    const others = await db.knexRaw<{
        slug: string
        pinnedForSearches: string
    }>(
        knex,
        `-- sql
        SELECT
            slug,
            content ->> '$."pinned-for-searches"' AS pinnedForSearches
        FROM posts_gdocs
        WHERE type = ?
        AND published = TRUE
        AND id != ?
        AND content ->> '$."pinned-for-searches"' IS NOT NULL`,
        [OwidGdocType.FeaturedViz, gdoc.id]
    )

    return others.flatMap((other) => {
        const otherSearches = new Set<string>(
            JSON.parse(other.pinnedForSearches)
        )
        return searches
            .filter((search) => otherSearches.has(search))
            .map((search) => ({ search, slug: other.slug }))
    })
}

export function describePinnedSearchClash({
    search,
    slug,
}: PinnedSearchClash): string {
    return `"${search}" is already pinned to the published featured viz "${slug}". A search can show only one featured viz.`
}

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
        const refBlocks = Object.values(
            gdoc.content.refs?.definitions ?? {}
        ).flatMap((definition) => definition.content)
        const acknowledgements = gdoc.content.acknowledgements ?? []
        return [...refBlocks, ...acknowledgements]
    }

    override _enrichSubclassContent = (content: Record<string, any>): void => {
        if (content.contributors !== undefined) {
            const { contributors, contributorRoles } = parseContributors(
                content.contributors
            )
            content.contributors = contributors
            content.contributorRoles = contributorRoles
        }

        if (content.acknowledgements) {
            content.acknowledgements = parseAcknowledgements(
                content.acknowledgements
            )
        }

        if (typeof content["pinned-for-searches"] === "string") {
            content["pinned-for-searches"] = parsePinnedSearches(
                content["pinned-for-searches"]
            )
        }
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

    override _validateSubclass = async (
        knex: db.KnexReadonlyTransaction
    ): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []

        for (const clash of await getPinnedSearchClashes(knex, this)) {
            errors.push({
                property: "pinned-for-searches",
                message: describePinnedSearchClash(clash),
                type: OwidGdocErrorMessageType.Error,
            })
        }

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
