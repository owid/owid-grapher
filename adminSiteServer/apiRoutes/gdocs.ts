import * as _ from "lodash-es"
import { getCanonicalUrl } from "@ourworldindata/components"
import {
    GdocsContentSource,
    DbInsertUser,
    EnrichedBlockDataCallout,
    JsonError,
    GDOCS_BASE_URL,
    gdocUrlRegex,
    LinkedCallouts,
    PostsGdocsLinksTableName,
    PostsGdocsXImagesTableName,
    PostsGdocsTableName,
    PostsGdocsComponentsTableName,
    PagesIndexRecordsResponse,
    RedirectsTableName,
    OwidGdocType,
} from "@ourworldindata/types"
import {
    checkIsDataInsight,
    checkIsGdocPostExcludingFragments,
    checkShouldDataCalloutRender,
    getEntitiesForProfile,
    makeCalloutGrapherStateKey,
    makeLinkedCalloutKey,
    traverseEnrichedBlock,
    Url,
} from "@ourworldindata/utils"
import { match } from "ts-pattern"
import {
    checkHasChanges,
    getPublishingAction,
    GdocPublishingAction,
    checkIsLightningUpdate,
} from "../../adminSiteClient/gdocsDeploy.js"
import {
    indexIndividualGdocPost,
    removeIndividualGdocPostFromIndex,
    getIndividualGdocRecords,
} from "../../baker/algolia/utils/pages.js"
import { GdocAbout } from "../../db/model/Gdoc/GdocAbout.js"
import { GdocAuthor } from "../../db/model/Gdoc/GdocAuthor.js"
import { getMinimalGdocPostsByIds } from "../../db/model/Gdoc/GdocBase.js"
import { GdocDataInsight } from "../../db/model/Gdoc/GdocDataInsight.js"
import { prepareCalloutTableForUrl } from "../../db/model/Gdoc/dataCallouts.js"
import {
    prepareCalloutTable,
    constructGrapherValuesJsonFromTable,
} from "@ourworldindata/grapher"
import { mapSlugsToIds } from "../../db/model/Chart.js"
import {
    getAllGdocIndexItemsOrderedByUpdatedAt,
    getAndLoadGdocById,
    updateGdocContentOnly,
    createOrLoadGdocById,
    gdocFromJSON,
    setImagesInContentGraph,
    setLinksForGdoc,
    GdocLinkUpdateMode,
    upsertGdoc,
    setTagsForGdoc,
    loadGdocFromGdocBase,
    getGdocBaseObjectById,
} from "../../db/model/Gdoc/GdocFactory.js"
import { GdocHomepage } from "../../db/model/Gdoc/GdocHomepage.js"
import { GdocPost } from "../../db/model/Gdoc/GdocPost.js"
import { enqueueLightningChange } from "./routeUtils.js"
import { triggerStaticBuild } from "../../baker/GrapherBakingUtils.js"
import * as db from "../../db/db.js"
import { Request } from "../authentication.js"
import e from "express"
import { GdocAnnouncement } from "../../db/model/Gdoc/GdocAnnouncement.js"
import { GdocProfile } from "../../db/model/Gdoc/GdocProfile.js"

export async function getAllGdocIndexItems(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    return getAllGdocIndexItemsOrderedByUpdatedAt(trx)
}

export async function getIndividualGdoc(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const id = req.params.id
    const contentSource = req.query.contentSource as
        | GdocsContentSource
        | undefined
    const acceptSuggestions = req.query.acceptSuggestions === "true"

    try {
        // Beware: if contentSource=gdocs this will update images in the DB+S3 even if the gdoc is published
        const gdoc = await getAndLoadGdocById(
            trx,
            id,
            contentSource,
            acceptSuggestions
        )

        if (!gdoc.published && !acceptSuggestions) {
            await updateGdocContentOnly(trx, id, gdoc)
        }

        res.set("Cache-Control", "no-store")
        res.send(gdoc)
    } catch (error) {
        console.error("Error fetching gdoc", error)
        res.status(500).json({
            error: { message: String(error), status: 500 },
        })
    }
}

export async function getGdocCalloutCoverage(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const id = req.params.id
    const contentSource = req.query.contentSource as
        | GdocsContentSource
        | undefined
    const acceptSuggestions = req.query.acceptSuggestions === "true"

    const base = await getGdocBaseObjectById(trx, id, true)
    if (!base) throw new JsonError(`No Google Doc with id ${id} found`, 404)

    const gdoc = await loadGdocFromGdocBase(
        trx,
        base,
        contentSource,
        acceptSuggestions,
        { loadState: false }
    )

    if (gdoc.content.type !== OwidGdocType.Profile) {
        throw new JsonError("Coverage matrix is only available for profiles")
    }

    // Extract data-callout blocks from the template body
    const dataCalloutBlocks: EnrichedBlockDataCallout[] = []
    for (const node of gdoc.content.body ?? []) {
        traverseEnrichedBlock(node, (b) => {
            if (b.type === "data-callout") {
                dataCalloutBlocks.push(b as EnrichedBlockDataCallout)
            }
        })
    }

    const rows = dataCalloutBlocks.map(({ url }, index) => {
        const rowUrl = Url.fromURL(url).updateQueryParams({
            country: undefined,
        }).fullUrl
        return {
            id: `${rowUrl}#${index}`,
            label: rowUrl,
        }
    })

    const entities = getEntitiesForProfile(
        gdoc.content.scope,
        gdoc.content.exclude
    )
    const coverageByEntity: Record<string, Record<string, boolean>> = {}

    // Pre-fetch slug to ID map for efficiency
    const slugToIdMap = await mapSlugsToIds(trx)

    // Group blocks by chart key to prepare each chart's table once
    const chartKeyToUrl = new Map<string, string>()
    for (const block of dataCalloutBlocks) {
        const chartKey = makeCalloutGrapherStateKey(block.url)
        if (!chartKeyToUrl.has(chartKey)) {
            chartKeyToUrl.set(chartKey, block.url)
        }
    }

    // Prepare tables for each unique chart
    const preparedTablesByChartKey = new Map<
        string,
        ReturnType<typeof prepareCalloutTable>
    >()
    for (const [chartKey, templateUrl] of chartKeyToUrl) {
        const result = await prepareCalloutTableForUrl(
            trx,
            templateUrl,
            slugToIdMap
        )
        if (result) {
            const prepared = prepareCalloutTable(
                result.inputTable,
                result.config
            )
            preparedTablesByChartKey.set(chartKey, prepared)
        }
    }

    // For each entity, check if each block's callout spans can resolve
    for (const entity of entities) {
        const rowCoverage: Record<string, boolean> = {}

        dataCalloutBlocks.forEach((block, index) => {
            const chartKey = makeCalloutGrapherStateKey(block.url)
            const prepared = preparedTablesByChartKey.get(chartKey)

            if (!prepared) {
                rowCoverage[rows[index].id] = false
                return
            }

            // Instantiate the URL with the entity code
            const instantiatedUrl = Url.fromURL(block.url).updateQueryParams({
                country: entity.code,
            }).fullUrl
            const url = Url.fromURL(instantiatedUrl)

            const values = constructGrapherValuesJsonFromTable(
                prepared,
                entity.name,
                url.queryParams.time
            )

            // Build a linkedCallouts entry and check if the block can render
            const linkedCallouts: LinkedCallouts = {
                [makeLinkedCalloutKey(instantiatedUrl)]: {
                    url: instantiatedUrl,
                    values,
                },
            }
            // Use a shallow copy with the instantiated URL so the key lookup matches
            const instantiatedBlock = { ...block, url: instantiatedUrl }
            rowCoverage[rows[index].id] =
                checkShouldDataCalloutRender(
                    instantiatedBlock,
                    linkedCallouts
                )
        })

        coverageByEntity[entity.code] = rowCoverage
    }

    res.send({
        rows,
        entities,
        coverageByEntity,
    })
}

/**
 * Given a chart URL (e.g. /grapher/life-expectancy?country=USA),
 * returns the available callout function strings that can be used
 * in data-callout blocks.
 */
export async function getCalloutFunctionStrings(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const chartUrl = req.query.url as string | undefined
    if (!chartUrl) {
        throw new JsonError("Missing 'url' query parameter", 400)
    }

    const tableResult = await prepareCalloutTableForUrl(trx, chartUrl)
    if (!tableResult) {
        throw new JsonError(`Could not load chart for URL: ${chartUrl}`, 404)
    }

    const { config, inputTable } = tableResult
    const prepared = prepareCalloutTable(inputTable, config)

    // Get column short names from the prepared table
    const columnSlugs = [
        ...prepared.yColumnSlugs,
        ...(prepared.xColumnSlug ? [prepared.xColumnSlug] : []),
    ]

    const functionStringsByName: Record<string, string[]> = {}

    for (const slug of columnSlugs) {
        const columnInfo = prepared.columns?.[slug]
        if (columnInfo?.shortName) {
            functionStringsByName[columnInfo.name] = [
                `$latestValue(${columnInfo.shortName})`,
                `$latestYear(${columnInfo.shortName})`,
            ]
        }
    }

    res.send({
        url: chartUrl,
        functionStringsByName,
    })
}

/**
 * Handles all four `GdocPublishingAction` cases
 * - SavingDraft (no action)
 * - Publishing (index and bake)
 * - Updating (index and bake (potentially via lightning deploy))
 * - Unpublishing (remove from index and bake)
 */
async function indexAndBakeGdocIfNeccesary(
    trx: db.KnexReadWriteTransaction,
    user: Required<DbInsertUser>,
    prevGdoc:
        | GdocPost
        | GdocDataInsight
        | GdocHomepage
        | GdocAbout
        | GdocAuthor
        | GdocAnnouncement
        | GdocProfile,
    nextGdoc:
        | GdocPost
        | GdocDataInsight
        | GdocHomepage
        | GdocAbout
        | GdocAuthor
        | GdocAnnouncement
        | GdocProfile
) {
    const prevJson = prevGdoc.toJSON()
    const nextJson = nextGdoc.toJSON()
    const hasChanges = checkHasChanges(prevGdoc, nextGdoc)
    const action = getPublishingAction(prevJson, nextJson)
    const isGdocPost = checkIsGdocPostExcludingFragments(nextJson)

    await match(action)
        .with(GdocPublishingAction.SavingDraft, _.noop)
        .with(GdocPublishingAction.Publishing, async () => {
            if (isGdocPost) {
                await indexIndividualGdocPost(
                    nextJson,
                    trx,
                    // If the gdoc is being published for the first time, prevGdoc.slug will be undefined
                    // In that case, we pass nextJson.slug to see if it has any page views (i.e. from WP)
                    prevGdoc.slug || nextJson.slug
                )
            }
            await triggerStaticBuild(user, `${action} ${nextJson.slug}`)
        })
        .with(GdocPublishingAction.Updating, async () => {
            if (isGdocPost) {
                await indexIndividualGdocPost(nextJson, trx, prevGdoc.slug)
            }
            if (checkIsLightningUpdate(prevJson, nextJson, hasChanges)) {
                await enqueueLightningChange(
                    user,
                    `Lightning update ${nextJson.slug}`,
                    nextJson.slug
                )
            } else {
                await triggerStaticBuild(user, `${action} ${nextJson.slug}`)
            }
        })
        .with(GdocPublishingAction.Unpublishing, async () => {
            if (isGdocPost) {
                await removeIndividualGdocPostFromIndex(nextJson)
            }
            await triggerStaticBuild(user, `${action} ${nextJson.slug}`)
        })
        .exhaustive()
}

async function validateSlugCollisionsIfPublishing(
    trx: db.KnexReadonlyTransaction,
    gdoc:
        | GdocPost
        | GdocDataInsight
        | GdocHomepage
        | GdocAbout
        | GdocAuthor
        | GdocAnnouncement
        | GdocProfile
) {
    if (!gdoc.published) return

    const hasSlugCollision = await db.checkIfSlugCollides(trx, gdoc)
    if (hasSlugCollision) {
        throw new JsonError(
            `You are attempting to publish a Google Doc with a slug that already exists: "${gdoc.slug}"`
        )
    }
}

/**
 * Creates a redirect from the old slug to the new slug when a published gdoc's slug changes.
 * Also updates any existing redirects that point to the old slug to point to the new slug instead
 * (to avoid redirect chains).
 */
async function createRedirectForSlugChangeIfNeeded(
    trx: db.KnexReadWriteTransaction,
    prevGdoc: {
        slug: string
        published: boolean
        content: { type?: OwidGdocType }
    },
    nextGdoc: {
        slug: string
        published: boolean
        content: { type?: OwidGdocType }
    }
): Promise<void> {
    // Only create redirects when both prev and next are published and slug has changed
    if (!prevGdoc.published || !nextGdoc.published) return
    if (!prevGdoc.slug || prevGdoc.slug === nextGdoc.slug) return

    const oldPath = getCanonicalUrl("", prevGdoc)
    const newPath = getCanonicalUrl("", nextGdoc)

    if (oldPath === newPath) return

    // Update any existing redirects that point to the old path to point to the new path instead
    // This prevents redirect chains (A -> B -> C becomes A -> C)
    await trx(RedirectsTableName)
        .where("target", oldPath)
        .update({ target: newPath })

    // Delete any self-referential redirects that may have been created by the above update
    // (e.g., when reverting a slug change: a→b updated to a→a)
    await trx(RedirectsTableName).whereRaw("source = target").delete()

    // Delete any existing redirect from the old path (in case we're reverting a previous change)
    await trx(RedirectsTableName).where("source", oldPath).delete()

    // Create the new redirect from old path to new path
    await trx(RedirectsTableName).insert({
        source: oldPath,
        target: newPath,
        code: 301, // Permanent redirect
    })

    console.log(`Created redirect: ${oldPath} -> ${newPath}`)
}

/**
 * Only supports creating a new empty Gdoc or updating an existing one. Does not
 * support creating a new Gdoc from an existing one. Relevant updates will
 * trigger a deploy.
 */
export async function createOrUpdateGdoc(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const { id } = req.params

    if (_.isEmpty(req.body)) {
        return createOrLoadGdocById(trx, id)
    }

    const prevGdoc = await getAndLoadGdocById(trx, id)
    if (!prevGdoc) throw new JsonError(`No Google Doc with id ${id} found`)

    const nextGdoc = gdocFromJSON(req.body)
    await nextGdoc.loadState(trx)

    await validateSlugCollisionsIfPublishing(trx, nextGdoc)

    // Create redirect if slug changed on a published gdoc
    await createRedirectForSlugChangeIfNeeded(trx, prevGdoc, nextGdoc)

    await setImagesInContentGraph(trx, nextGdoc)

    await setLinksForGdoc(
        trx,
        nextGdoc.id,
        nextGdoc.links,
        nextGdoc.published
            ? GdocLinkUpdateMode.DeleteAndInsert
            : GdocLinkUpdateMode.DeleteOnly
    )

    const upserted = await upsertGdoc(trx, nextGdoc)
    await indexAndBakeGdocIfNeccesary(trx, res.locals.user, prevGdoc, nextGdoc)

    return upserted
}

async function validateTombstoneRelatedLinkUrl(
    trx: db.KnexReadonlyTransaction,
    relatedLink?: string
) {
    if (!relatedLink || !relatedLink.startsWith(GDOCS_BASE_URL)) return
    const id = relatedLink.match(gdocUrlRegex)?.[1]
    if (!id) {
        throw new JsonError(`Invalid related link: ${relatedLink}`)
    }
    const [gdoc] = await getMinimalGdocPostsByIds(trx, [id])
    if (!gdoc) {
        throw new JsonError(`Google Doc with ID ${id} not found`)
    }
    if (!gdoc.published) {
        throw new JsonError(`Google Doc with ID ${id} is not published`)
    }
}

export async function deleteGdoc(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const { id } = req.params

    const gdoc = await getGdocBaseObjectById(trx, id, false)
    if (!gdoc) throw new JsonError(`No Google Doc with id ${id} found`)

    const gdocSlug = getCanonicalUrl("", gdoc)
    const { tombstone } = req.body

    if (tombstone) {
        await validateTombstoneRelatedLinkUrl(trx, tombstone.relatedLinkUrl)
        const slug = gdocSlug.replace("/", "")
        const { relatedLinkThumbnail } = tombstone
        if (relatedLinkThumbnail) {
            const thumbnailExists = await db.checkIsImageInDB(
                trx,
                relatedLinkThumbnail
            )
            if (!thumbnailExists) {
                throw new JsonError(
                    `Image with filename "${relatedLinkThumbnail}" not found`
                )
            }
        }
        await trx
            .table("posts_gdocs_tombstones")
            .insert({ ...tombstone, gdocId: id, slug })
        await trx
            .table("redirects")
            .insert({ source: gdocSlug, target: `/deleted${gdocSlug}` })
    }

    await trx.table(PostsGdocsLinksTableName).where({ sourceId: id }).delete()
    await trx.table(PostsGdocsXImagesTableName).where({ gdocId: id }).delete()
    await trx.table(PostsGdocsTableName).where({ id }).delete()
    await trx
        .table(PostsGdocsComponentsTableName)
        .where({ gdocId: id })
        .delete()
    if (gdoc.published && checkIsGdocPostExcludingFragments(gdoc)) {
        await removeIndividualGdocPostFromIndex(gdoc)
    }
    if (gdoc.published) {
        if (!tombstone && gdocSlug && gdocSlug !== "/") {
            // Assets have TTL of one week in Cloudflare. Add a redirect to make sure
            // the page is no longer accessible.
            // https://developers.cloudflare.com/pages/configuration/serving-pages/#asset-retention
            console.log(`Creating redirect for "${gdocSlug}" to "/"`)
            await db.knexRawInsert(
                trx,
                `INSERT INTO redirects (source, target, ttl)
                VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 8 DAY))`,
                [gdocSlug, "/"]
            )
        }
        await triggerStaticBuild(res.locals.user, `Deleting ${gdocSlug}`)
    }
    return {}
}

export async function setGdocTags(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const { gdocId } = req.params
    const { tagIds } = req.body
    const tagIdsAsObjects: { id: number }[] = tagIds.map((id: number) => ({
        id: id,
    }))

    await setTagsForGdoc(trx, gdocId, tagIdsAsObjects)

    return { success: true }
}

/**
 * Generate a preview of Algolia index records for a gdoc.
 * Returns the records that would be created when indexing this gdoc.
 */
export async function getPreviewGdocIndexRecords(
    _req: Request,
    res: e.Response<PagesIndexRecordsResponse, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
): Promise<PagesIndexRecordsResponse> {
    const { id } = _req.params
    const contentSource = _req.query.contentSource as
        | GdocsContentSource
        | undefined

    try {
        const gdoc = await getAndLoadGdocById(trx, id, contentSource, false)

        if (!gdoc) {
            throw new JsonError(`No Google Doc with id ${id} found`)
        }

        const gdocJson = gdoc.toJSON()

        // Provide fallback dates to avoid issues in record generation, where
        // dates are expected
        const fallbackDate = gdocJson.publishedAt ?? new Date()
        gdocJson.publishedAt = fallbackDate
        gdocJson.updatedAt ??= fallbackDate

        res.set("Cache-Control", "no-store")

        // Only generate records for posts (excluding fragments)
        if (
            !checkIsGdocPostExcludingFragments(gdocJson) &&
            !checkIsDataInsight(gdocJson)
        ) {
            const payload: PagesIndexRecordsResponse = {
                records: [],
                count: 0,
                message: `Gdoc type "${gdocJson.content.type}" is not indexed in Algolia`,
            }
            return payload
        }

        if (
            "deprecation-notice" in gdocJson.content &&
            gdocJson.content["deprecation-notice"]
        ) {
            const payload: PagesIndexRecordsResponse = {
                records: [],
                count: 0,
                message:
                    "Gdoc is deprecated (has deprecation-notice) and will not be indexed in Algolia",
            }
            return payload
        }

        const records = await getIndividualGdocRecords(gdocJson, trx)

        const payload: PagesIndexRecordsResponse = {
            records,
            count: records.length,
        }

        return payload
    } catch (error) {
        console.error("Error generating gdoc index records", error)
        if (error instanceof Error) throw error
        throw new Error(String(error))
    }
}

/**
 * Get slugs of all published topic pages (topic-page, linear-topic-page).
 * Used by the tag editor to determine if a tag's slug matches a published gdoc.
 */
export async function getPublishedGdocTopicSlugs(
    _req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
): Promise<{ slugs: string[] }> {
    const rows = await db.knexRaw<{ slug: string }>(
        trx,
        `-- sql
        SELECT slug FROM posts_gdocs
        WHERE published = TRUE
        AND type IN ('topic-page', 'linear-topic-page')
        AND slug IS NOT NULL
        `
    )
    return { slugs: rows.map((r) => r.slug) }
}
