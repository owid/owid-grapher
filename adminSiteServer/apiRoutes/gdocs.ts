import { getCanonicalUrl } from "@ourworldindata/components"
import {
    GdocsContentSource,
    JsonError,
    GDOCS_BASE_URL,
    gdocUrlRegex,
    OwidGdocPostInterface,
    PostsGdocsLinksTableName,
    PostsGdocsXImagesTableName,
    PostsGdocsTableName,
    PostsGdocsComponentsTableName,
} from "@ourworldindata/types"
import { checkIsGdocPostExcludingFragments } from "@ourworldindata/utils"
import { isEmpty } from "lodash"
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
} from "../../baker/algolia/utils/pages.js"
import { getMinimalGdocPostsByIds } from "../../db/model/Gdoc/GdocBase.js"
import {
    getAllGdocIndexItemsOrderedByUpdatedAt,
    getAndLoadGdocById,
    updateGdocContentOnly,
    createOrLoadGdocById,
    gdocFromJSON,
    addImagesToContentGraph,
    setLinksForGdoc,
    GdocLinkUpdateMode,
    upsertGdoc,
    getGdocBaseObjectById,
    setTagsForGdoc,
} from "../../db/model/Gdoc/GdocFactory.js"
import { triggerStaticBuild, enqueueLightningChange } from "./routeUtils.js"
import * as db from "../../db/db.js"
import * as lodash from "lodash"
import { Request } from "../authentication.js"
import e from "express"

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

    try {
        // Beware: if contentSource=gdocs this will update images in the DB+S3 even if the gdoc is published
        const gdoc = await getAndLoadGdocById(trx, id, contentSource)

        if (!gdoc.published) {
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

/**
 * Only supports creating a new empty Gdoc or updating an existing one. Does not
 * support creating a new Gdoc from an existing one. Relevant updates will
 * trigger a deploy.
 */
export async function createOrUpdateGdoc(
    req: Request,
    res: e.Response<any, Record<string, any>>
) {
    const { id } = req.params

    if (isEmpty(req.body)) {
        return await db.knexReadWriteTransaction(async (trx) => {
            return await createOrLoadGdocById(trx, id)
        })
    }

    const user = res.locals.user
    let build: "full" | "lightning" | undefined
    let buildMessage = ""

    const nextGdoc = await db.knexReadWriteTransaction(async (trx) => {
        const prevGdoc = await getAndLoadGdocById(trx, id)
        if (!prevGdoc) throw new JsonError(`No Google Doc with id ${id} found`)

        const nextGdoc = gdocFromJSON(req.body)
        await nextGdoc.loadState(trx)

        await addImagesToContentGraph(trx, nextGdoc)

        await setLinksForGdoc(
            trx,
            nextGdoc.id,
            nextGdoc.links,
            nextGdoc.published
                ? GdocLinkUpdateMode.DeleteAndInsert
                : GdocLinkUpdateMode.DeleteOnly
        )

        await upsertGdoc(trx, nextGdoc)

        const prevJson = prevGdoc.toJSON()
        const nextJson = nextGdoc.toJSON()
        const hasChanges = checkHasChanges(prevGdoc, nextGdoc)
        const action = getPublishingAction(prevJson, nextJson)
        const isGdocPost = checkIsGdocPostExcludingFragments(nextJson)

        await match(action)
            .with(GdocPublishingAction.SavingDraft, lodash.noop)
            .with(GdocPublishingAction.Publishing, async () => {
                if (isGdocPost) {
                    await indexIndividualGdocPost(
                        nextJson as OwidGdocPostInterface,
                        trx,
                        // If the gdoc is being published for the first time, prevGdoc.slug will be undefined
                        // In that case, we pass nextJson.slug to see if it has any page views (i.e. from WP)
                        prevGdoc.slug || nextJson.slug
                    )
                }
                build = "full"
                buildMessage = `${action} ${nextJson.slug}`
            })
            .with(GdocPublishingAction.Updating, async () => {
                if (isGdocPost) {
                    await indexIndividualGdocPost(nextJson, trx, prevGdoc.slug)
                }
                if (checkIsLightningUpdate(prevJson, nextJson, hasChanges)) {
                    build = "lightning"
                    buildMessage = `Lightning update ${nextJson.slug}`
                } else {
                    build = "full"
                    buildMessage = `${action} ${nextJson.slug}`
                }
            })
            .with(GdocPublishingAction.Unpublishing, async () => {
                if (isGdocPost) {
                    await removeIndividualGdocPostFromIndex(nextJson)
                }
                build = "full"
                buildMessage = `${action} ${nextJson.slug}`
            })
            .exhaustive()

        return nextGdoc
    })

    // The build must be triggered after the transaction has been committed
    // otherwise the deploy-queue process can get stale data from the DB.
    // https://github.com/owid/owid-grapher/issues/3908
    if (build === "full") {
        await triggerStaticBuild(user, buildMessage)
    } else if (build === "lightning") {
        await enqueueLightningChange(user, buildMessage, nextGdoc.slug)
    }

    return nextGdoc
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

    await trx
        .table("posts")
        .where({ gdocSuccessorId: gdoc.id })
        .update({ gdocSuccessorId: null })

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
