import * as _ from "lodash-es"
import * as db from "../../../db/db.js"
import { ALGOLIA_INDEXING } from "../../../settings/serverSettings.js"
import { chunkParagraphs } from "../../chunk.js"
import {
    OwidGdocType,
    type RawPageview,
    OwidGdocPostInterface,
    ARCHIVED_THUMBNAIL_FILENAME,
    DEFAULT_GDOC_FEATURED_IMAGE,
    DbEnrichedImage,
    OwidGdocDataInsightInterface,
    OwidGdocAboutInterface,
    getUniqueNamesFromTagHierarchies,
    spansToUnformattedPlainText,
    EnrichedBlockText,
    Span,
    getEntitiesForProfile,
    articulateEntity,
} from "@ourworldindata/utils"
import { getAlgoliaClient } from "../configureAlgolia.js"
import { PageRecord, OwidGdocProfileInterface } from "@ourworldindata/types"
import { getAnalyticsPageviewsByUrlObj } from "../../../db/model/Pageview.js"
import { PAGES_INDEX } from "../../../site/search/searchUtils.js"
import type { Hit, SearchClient } from "@algolia/client-search"
import { match, P } from "ts-pattern"
import { gdocFromJSON } from "../../../db/model/Gdoc/GdocFactory.js"
import { GdocBase } from "../../../db/model/Gdoc/GdocBase.js"
import {
    BAKED_BASE_URL,
    CLOUDFLARE_IMAGES_URL,
} from "../../../settings/clientSettings.js"
import { logErrorAndMaybeCaptureInSentry } from "../../../serverUtils/errorLog.js"
import {
    getFirstBlockOfType,
    takeConsecutiveBlocksOfType,
} from "../../../site/gdocs/utils.js"
import { getPrefixedGdocPath } from "@ourworldindata/components"
import { enrichedBlocksToIndexableText } from "../../../db/model/Gdoc/enrichedToIndexableText.js"
import {
    GdocProfile,
    instantiateProfileForEntity,
    getSlugForProfileEntity,
} from "../../../db/model/Gdoc/GdocProfile.js"
import {
    prepareCalloutTablesForProfile,
    checkShouldProfileRender,
} from "../../../db/model/Gdoc/dataCallouts.js"

const computePageScore = (record: Omit<PageRecord, "score">): number => {
    const { importance, views_7d } = record
    return importance * 1000 + views_7d
}

const getThumbnailUrl = (
    gdoc:
        | OwidGdocPostInterface
        | OwidGdocDataInsightInterface
        | OwidGdocProfileInterface,
    cloudflareImages: Record<string, DbEnrichedImage>
): string => {
    if (gdoc.content.type === OwidGdocType.DataInsight) {
        const firstImage = getFirstBlockOfType(
            gdoc as OwidGdocDataInsightInterface,
            "image"
        )
        const filename = firstImage?.smallFilename || firstImage?.filename
        return filename && cloudflareImages[filename]
            ? `${CLOUDFLARE_IMAGES_URL}/${cloudflareImages[filename].cloudflareId}/w=608`
            : `${BAKED_BASE_URL}/${DEFAULT_GDOC_FEATURED_IMAGE}`
    }

    if (
        "deprecation-notice" in gdoc.content &&
        gdoc.content["deprecation-notice"]
    ) {
        return `${BAKED_BASE_URL}/${ARCHIVED_THUMBNAIL_FILENAME}`
    }

    if (
        !("featured-image" in gdoc.content) ||
        !gdoc.content["featured-image"]
    ) {
        return `${BAKED_BASE_URL}/${DEFAULT_GDOC_FEATURED_IMAGE}`
    }

    const thumbnailFilename = gdoc.content["featured-image"]
    const cloudflareId = cloudflareImages[thumbnailFilename]?.cloudflareId

    if (!cloudflareId) {
        void logErrorAndMaybeCaptureInSentry(
            new Error(
                `Gdoc ${gdoc.id} has no cloudflare image with filename ${thumbnailFilename}`
            )
        )
        // won't render in the search page
        return ""
    }

    return `${CLOUDFLARE_IMAGES_URL}/${cloudflareId}/w=512`
}

function getExcerptFromGdoc(
    gdoc: OwidGdocPostInterface | OwidGdocDataInsightInterface
): string {
    if (gdoc.content.type === OwidGdocType.DataInsight) {
        return ""
    } else {
        return gdoc.content.excerpt ?? ""
    }
}

function filterSpansForExcerptLong(span: Span): Span | null {
    // Remove span-subscript and span-superscript spans
    if (
        span.spanType === "span-subscript" ||
        span.spanType === "span-superscript"
    ) {
        return null
    }

    // For spans with children, recursively filter the children
    if ("children" in span && span.children) {
        const filteredChildren = span.children
            .map(filterSpansForExcerptLong)
            .filter((child): child is Span => child !== null)

        return {
            ...span,
            children: filteredChildren,
        }
    }

    // For spans without children, return as-is
    return span
}

function getExcerptLongFromGdoc(
    gdoc: OwidGdocPostInterface | OwidGdocDataInsightInterface
): string[] | undefined {
    if (
        gdoc.content.type !== OwidGdocType.TopicPage &&
        // Most (all?) linear topic pages currently don't have an intro block,
        // but we try to get it just in case.
        gdoc.content.type !== OwidGdocType.LinearTopicPage
    ) {
        return
    }

    let textBlocks: EnrichedBlockText[]
    const topicPageIntroBlock = getFirstBlockOfType(gdoc, "topic-page-intro")
    const maxParagraphs = 3
    if (topicPageIntroBlock) {
        textBlocks = topicPageIntroBlock.content.slice(0, maxParagraphs)
    } else {
        textBlocks = takeConsecutiveBlocksOfType(
            gdoc,
            "text",
            maxParagraphs
        ).filter((block) => {
            if (
                // Filter out blocks whose only child is a link or some other
                // special span to prevent paragraphs such as "See all
                // interactive charts on age structure ↓".
                block.value.length === 1 &&
                [
                    "span-link",
                    "span-bold",
                    "span-italic",
                    "span-underline",
                    "span-subscript",
                    "span-superscript",
                ].includes(block.value[0].spanType)
            ) {
                return false
            }
            return true
        })
    }
    return (
        textBlocks
            .map((block) => {
                const filteredValue = block.value
                    .map(filterSpansForExcerptLong)
                    .filter((span) => span !== null)
                return spansToUnformattedPlainText(filteredValue).trim()
            })
            // Filter out empty blocks and blocks that end with a colon, e.g.
            // "... you can read the following essay:".
            .filter((block) => block.length > 0 && !block.endsWith(":"))
    )
}

/** Remove characters that shouldn't appear in search results but could
 *  affect chunk boundaries (e.g. arrow symbols used in data insights). */
function stripNonSearchableCharacters(content: string): string {
    return content.replaceAll("→", "")
}

/** Build indexable body text with linked-callout resolution and lightweight
 *  cleanup (remove non-searchable symbols), while preserving paragraph breaks. */
export function getPreprocessedIndexableText<
    IndexableGdoc extends
        | OwidGdocPostInterface
        | OwidGdocDataInsightInterface
        | OwidGdocProfileInterface,
>(
    body: IndexableGdoc["content"]["body"] | undefined,
    linkedCallouts: IndexableGdoc["linkedCallouts"]
): string {
    const indexableText = enrichedBlocksToIndexableText(body, {
        linkedCallouts,
    })
    return stripNonSearchableCharacters(indexableText ?? "")
}

/** Collapse paragraph separators so each chunk is a single line of text
 *  suitable for an Algolia record. */
function flattenToSingleLine(chunk: string): string {
    return chunk.replace(/\n+/g, " ")
}

const getPostImportance = (
    gdoc:
        | OwidGdocAboutInterface
        | OwidGdocDataInsightInterface
        | OwidGdocPostInterface
        | OwidGdocProfileInterface
): number => {
    return match(gdoc.content.type)
        .with(OwidGdocType.Article, () =>
            "deprecation-notice" in gdoc.content ? -0.5 : 0
        )
        .with(P.union(OwidGdocType.AboutPage, OwidGdocType.Profile), () => 1)
        .with(
            P.union(OwidGdocType.TopicPage, OwidGdocType.LinearTopicPage),
            () => 3
        )
        .with(P.union(OwidGdocType.Fragment, undefined), () => 0)
        .with(OwidGdocType.DataInsight, () => 0)
        .exhaustive()
}

async function generateGdocRecords(
    gdocs: (OwidGdocPostInterface | OwidGdocDataInsightInterface)[],
    pageviews: Record<string, RawPageview>,
    cloudflareImagesByFilename: Record<string, DbEnrichedImage>,
    knex: db.KnexReadonlyTransaction
): Promise<PageRecord[]> {
    const topicHierarchiesByChildName =
        await db.getTopicHierarchiesByChildName(knex)

    const records: PageRecord[] = []
    for (const gdoc of gdocs) {
        if (!gdoc.content.body || !gdoc.content.type) {
            await logErrorAndMaybeCaptureInSentry(
                new Error(`Gdoc ${gdoc.id} has no content or type. Skipping.`)
            )
            continue
        }

        // Only rendering the main content - not the page nav, title, byline, etc
        // Keep paragraph separators at this stage for semantic chunking and
        // apply only pre-index cleanup (e.g. remove non-searchable symbols).
        const plaintextContent = getPreprocessedIndexableText(
            gdoc.content.body,
            gdoc.linkedCallouts
        )

        // Chunk first while `\n\n` boundaries still exist. Flattening happens
        // later per chunk to satisfy Algolia's single-line record content.
        const chunks = chunkParagraphs(plaintextContent, 1000)
        let i = 0

        const thumbnailUrl = getThumbnailUrl(gdoc, cloudflareImagesByFilename)

        const originalTagNames = gdoc.tags?.map((t) => t.name) ?? []
        // Some Gdocs don't have topic tags by design (e.g. announcements)
        // so we don't log an error if no tags are found.
        // We want to get the parent topic tags as well as the original tags to
        // simplify client-side search queries when searching through areas.
        const topicTags = getUniqueNamesFromTagHierarchies(
            originalTagNames,
            topicHierarchiesByChildName
        )

        for (const chunk of chunks) {
            const record = {
                objectID: `${gdoc.id}-c${i}`,
                importance: getPostImportance(gdoc),
                type: gdoc.content.type,
                slug: gdoc.slug,
                title: gdoc.content.title || "",
                content: flattenToSingleLine(chunk),
                views_7d:
                    pageviews[getPrefixedGdocPath("", gdoc)]?.views_7d ?? 0,
                excerpt: getExcerptFromGdoc(gdoc),
                excerptLong: getExcerptLongFromGdoc(gdoc),
                date: gdoc.publishedAt!.toISOString(),
                modifiedDate: (
                    gdoc.updatedAt ?? gdoc.publishedAt!
                ).toISOString(),
                tags: [...topicTags],
                authors: gdoc.content.authors,
                thumbnailUrl,
                availableEntities: [],
            }
            const score = computePageScore(record)
            records.push({ ...record, score })
            i += 1
        }
    }
    return records
}

/**
 * Generate Algolia records for a profile template by instantiating it for each entity
 * in its scope and creating chunked records for each instantiated profile.
 */
async function generateProfileRecords(
    profileTemplate: GdocProfile,
    pageviews: Record<string, RawPageview>,
    cloudflareImagesByFilename: Record<string, DbEnrichedImage>,
    knex: db.KnexReadonlyTransaction
): Promise<PageRecord[]> {
    const entities = getEntitiesForProfile(
        profileTemplate.content.scope,
        profileTemplate.content.exclude
    )
    const records: PageRecord[] = []

    const topicHierarchiesByChildName =
        await db.getTopicHierarchiesByChildName(knex)
    const originalTagNames = profileTemplate.tags?.map((t) => t.name) ?? []
    const topicTags = getUniqueNamesFromTagHierarchies(
        originalTagNames,
        topicHierarchiesByChildName
    )

    const preparedTables = await prepareCalloutTablesForProfile(
        knex,
        profileTemplate.content
    )

    for (const entity of entities) {
        const instantiatedProfile = await instantiateProfileForEntity(
            profileTemplate,
            entity,
            { preparedTables }
        )

        // Skip entities whose callouts all have no data (same as in SiteBaker)
        if (!checkShouldProfileRender(instantiatedProfile.content)) {
            continue
        }

        const plaintextContent = getPreprocessedIndexableText(
            instantiatedProfile.content.body,
            instantiatedProfile.linkedCallouts
        )
        const chunks = chunkParagraphs(plaintextContent, 1000)

        const slug = getSlugForProfileEntity(profileTemplate, entity)
        const thumbnailUrl = getThumbnailUrl(
            instantiatedProfile,
            cloudflareImagesByFilename
        )

        for (let i = 0; i < chunks.length; i++) {
            const record = {
                objectID: `${profileTemplate.id}-${entity.code}-c${i}`,
                importance: getPostImportance(profileTemplate),
                type: OwidGdocType.Profile,
                slug,
                title: instantiatedProfile.content.title
                    ? `${instantiatedProfile.content.title} in ${articulateEntity(entity.name)}`
                    : "",
                content: chunks[i],
                views_7d: pageviews[`/${slug}`]?.views_7d ?? 0,
                excerpt: instantiatedProfile.content.excerpt ?? "",
                date: profileTemplate.publishedAt!.toISOString(),
                modifiedDate: (
                    profileTemplate.updatedAt ?? profileTemplate.publishedAt!
                ).toISOString(),
                tags: [...topicTags],
                authors: instantiatedProfile.content.authors,
                thumbnailUrl,
                availableEntities: [entity.name],
            }
            const score = computePageScore(record)
            records.push({ ...record, score })
        }
    }

    return records
}

export const getPagesRecords = async (knex: db.KnexReadonlyTransaction) => {
    const pageviews = await getAnalyticsPageviewsByUrlObj(knex)
    const gdocs = (await db
        .getPublishedGdocsWithTags(
            knex,
            [
                OwidGdocType.Article,
                OwidGdocType.LinearTopicPage,
                OwidGdocType.TopicPage,
                OwidGdocType.AboutPage,
                OwidGdocType.DataInsight,
            ],
            { excludeDeprecated: true }
        )
        .then((gdocs) => gdocs.map(gdocFromJSON))) as (
        | OwidGdocPostInterface
        | OwidGdocDataInsightInterface
    )[]

    // Only load linkedCallouts — the sole attachment that affects indexed
    // text (via span-callout resolution in enrichedBlocksToIndexableText).
    // Full loadState is unnecessary here and adds ~90 s of overhead.
    // If a new loadState step ever mutates content.body, update this too
    // (see the corresponding note in GdocBase.loadState).
    for (const gdoc of gdocs) {
        await (gdoc as GdocBase).loadAndClearLinkedCallouts(knex)
    }

    const cloudflareImagesByFilename = await db
        .getCloudflareImages(knex)
        .then((images) => _.keyBy(images, "filename"))

    const gdocsRecords = await generateGdocRecords(
        gdocs,
        pageviews,
        cloudflareImagesByFilename,
        knex
    )

    // Fetch and generate records for profile templates
    const profileTemplates = (await db
        .getPublishedGdocsWithTags(knex, [OwidGdocType.Profile])
        .then((gdocs) => gdocs.map(gdocFromJSON))) as GdocProfile[]

    const profileRecords: PageRecord[] = []
    for (const profileTemplate of profileTemplates) {
        const records = await generateProfileRecords(
            profileTemplate,
            pageviews,
            cloudflareImagesByFilename,
            knex
        )
        profileRecords.push(...records)
    }

    return [...gdocsRecords, ...profileRecords]
}

async function getExistingRecordsForSlug(
    searchClient: SearchClient,
    indexName: string,
    slug: string
): Promise<Hit[]> {
    const settings = await searchClient.getSettings({ indexName })
    // Settings can be specified with a modifier, e.g. `filterOnly(slug)`.
    if (!settings.attributesForFaceting?.some((a) => a.includes("slug"))) {
        await logErrorAndMaybeCaptureInSentry(
            new Error(
                "Attribute 'slug' must be set in the index's attributesForFaceting " +
                    "to get existing records in Algolia."
            )
        )
    }
    const existingRecordsForPost: Hit[] = []
    await searchClient.browseObjects({
        indexName,
        browseParams: {
            attributesToRetrieve: ["objectID"],
            filters: `slug:${slug}`,
        },
        // This is the way you get results from browseObjects for some reason 🤷
        aggregator: (batch) => existingRecordsForPost.push(...batch.hits),
    })
    return existingRecordsForPost
}

/**
 * Index a single Gdoc post to Algolia
 * If it's a new post, new records will be created.
 * If it's an existing post:
 * - existing records will be overwritten if the new post gets chunked into the same number of records (i.e. they're approx. the same length)
 * - otherwise the old records will be deleted and new ones will be created
 * To delete old records, we need to know the slug of the post before it was updated.
 * - We can't search by objectID because it's not a queryable field
 * - We can't filter by objectID because filters require exact matches and we can't know the objectIDs beforehand
 *   - They're of the form `${gdoc.id}-c${chunkNumber}` but we don't know how many chunks exist
 */
export async function indexIndividualGdocPost(
    gdoc: OwidGdocPostInterface,
    knex: db.KnexReadonlyTransaction,
    indexedSlug: string
) {
    if (!ALGOLIA_INDEXING) return
    const isScheduled = gdoc.publishedAt
        ? gdoc.publishedAt.getTime() > Date.now()
        : false

    if (isScheduled) {
        console.log(
            `Not indexing Gdoc post ${gdoc.id} because it's scheduled for publishing`
        )
        return
    }

    if (typeof gdoc.slug === "undefined") {
        console.error(`Failed indexing gdoc post ${gdoc.id} (No slug)`)
        return
    }

    const client = getAlgoliaClient()
    if (!client) {
        console.error(
            `Failed indexing gdoc post (Algolia client not initialized)`
        )
        return
    }
    const indexName = PAGES_INDEX

    const existingRecordsForPost: Hit[] = await getExistingRecordsForSlug(
        client,
        indexName,
        indexedSlug
    )

    if (
        "deprecation-notice" in gdoc.content &&
        gdoc.content["deprecation-notice"]
    ) {
        console.log(
            `Not indexing Gdoc post ${gdoc.id} because it's deprecated. Removing any existing records.`
        )
        if (existingRecordsForPost.length) {
            await client.deleteObjects({
                indexName,
                objectIDs: existingRecordsForPost.map((r) => r.objectID),
            })
        }
        return
    }

    const records = await getIndividualGdocRecords(gdoc, knex)

    try {
        if (
            existingRecordsForPost.length &&
            existingRecordsForPost.length !== records.length
        ) {
            // If the number of chunks has changed, we need to delete the old records first
            console.log(
                "Deleting Algolia index records for Gdoc post",
                indexedSlug
            )
            await client.deleteObjects({
                indexName,
                objectIDs: existingRecordsForPost.map((r) => r.objectID),
            })
        }
        console.log("Updating Algolia index for Gdoc post", gdoc.slug)
        // If the number of records hasn't changed, the records' objectIDs will be the same
        // so this will safely overwrite them or create new ones
        await client.saveObjects({
            indexName,
            objects: records as Array<Record<string, any>>,
        })
        console.log("Updated Algolia index for Gdoc post", gdoc.slug)
    } catch (e) {
        console.error("Error indexing Gdoc post to Algolia: ", e)
    }
}

/**
 * Get Algolia records for a single gdoc
 */
export async function getIndividualGdocRecords(
    gdoc: OwidGdocPostInterface | OwidGdocDataInsightInterface,
    knex: db.KnexReadonlyTransaction,
    indexedSlug?: string
) {
    const pageviews = await getAnalyticsPageviewsByUrlObj(knex)
    const cloudflareImagesByFilename = await db
        .getCloudflareImages(knex)
        .then((images) => _.keyBy(images, "filename"))

    // Use indexedSlug if provided (for slug changes), otherwise use gdoc.slug
    const existingPageviews = pageviews[`/${indexedSlug ?? gdoc.slug}`]
    const pageviewsForGdoc = {
        [gdoc.slug]: existingPageviews || {
            views_7d: 0,
            views_14d: 0,
            views_365d: 0,
            day: new Date(),
            url: gdoc.slug,
        },
    }

    return generateGdocRecords(
        [gdoc],
        pageviewsForGdoc,
        cloudflareImagesByFilename,
        knex
    )
}

export async function removeIndividualGdocPostFromIndex(
    gdoc: OwidGdocPostInterface
) {
    if (!ALGOLIA_INDEXING) return
    const client = getAlgoliaClient()
    if (!client) {
        console.error(
            `Failed indexing gdoc post (Algolia client not initialized)`
        )
        return
    }
    const indexName = PAGES_INDEX
    const existingRecordsForPost: Hit[] = await getExistingRecordsForSlug(
        client,
        indexName,
        gdoc.slug
    )

    try {
        console.log("Removing Gdoc post from Algolia index", gdoc.slug)
        await client.deleteObjects({
            indexName,
            objectIDs: existingRecordsForPost.map((r) => r.objectID),
        })
        console.log("Removed Gdoc post from Algolia index", gdoc.slug)
    } catch (e) {
        console.error("Error removing Gdoc post from Algolia index: ", e)
    }
}

/**
 * Get existing Algolia records for a profile template by browsing objects
 * and filtering by objectID prefix.
 */
async function getExistingRecordsForProfileTemplate(
    searchClient: SearchClient,
    indexName: string,
    templateId: string
): Promise<Hit[]> {
    const existingRecords: Hit[] = []
    await searchClient.browseObjects({
        indexName,
        browseParams: {
            attributesToRetrieve: ["objectID"],
            filters: `type:${OwidGdocType.Profile}`,
        },
        aggregator: (batch) => {
            // Filter by objectID prefix to get only records for this template
            const matchingRecords = batch.hits.filter((hit) =>
                hit.objectID.startsWith(`${templateId}-`)
            )
            existingRecords.push(...matchingRecords)
        },
    })
    return existingRecords
}

/**
 * Index a profile template to Algolia by instantiating it for each entity
 * in its scope. This replaces all existing records for the template.
 */
export async function indexIndividualProfile(
    profileTemplate: GdocProfile,
    knex: db.KnexReadonlyTransaction
) {
    if (!ALGOLIA_INDEXING) return

    const isScheduled = profileTemplate.publishedAt
        ? profileTemplate.publishedAt.getTime() > Date.now()
        : false

    if (isScheduled) {
        console.log(
            `Not indexing profile ${profileTemplate.id} because it's scheduled for publishing`
        )
        return
    }

    if (typeof profileTemplate.slug === "undefined") {
        console.error(`Failed indexing profile ${profileTemplate.id} (No slug)`)
        return
    }

    const client = getAlgoliaClient()
    if (!client) {
        console.error(
            `Failed indexing profile (Algolia client not initialized)`
        )
        return
    }
    const indexName = PAGES_INDEX

    const existingRecords = await getExistingRecordsForProfileTemplate(
        client,
        indexName,
        profileTemplate.id
    )

    if (existingRecords.length > 0) {
        console.log(
            `Deleting ${existingRecords.length} existing Algolia records for profile template`,
            profileTemplate.slug
        )
        await client.deleteObjects({
            indexName,
            objectIDs: existingRecords.map((r) => r.objectID),
        })
    }

    // Generate new records for all entities in scope
    const pageviews = await getAnalyticsPageviewsByUrlObj(knex)
    const cloudflareImagesByFilename = await db
        .getCloudflareImages(knex)
        .then((images) => _.keyBy(images, "filename"))

    const records = await generateProfileRecords(
        profileTemplate,
        pageviews,
        cloudflareImagesByFilename,
        knex
    )

    try {
        console.log(
            `Updating Algolia index for profile template ${profileTemplate.slug} (${records.length} records)`
        )
        await client.saveObjects({
            indexName,
            objects: records as Array<Record<string, any>>,
        })
        console.log(
            `Updated Algolia index for profile template ${profileTemplate.slug}`
        )
    } catch (e) {
        console.error("Error indexing profile to Algolia: ", e)
    }
}

/**
 * Remove all Algolia records for a profile template.
 */
export async function removeIndividualProfileFromIndex(
    profileTemplate: GdocProfile
) {
    if (!ALGOLIA_INDEXING) return

    const client = getAlgoliaClient()
    if (!client) {
        console.error(
            `Failed removing profile from index (Algolia client not initialized)`
        )
        return
    }

    const existingRecords = await getExistingRecordsForProfileTemplate(
        client,
        PAGES_INDEX,
        profileTemplate.id
    )

    if (existingRecords.length === 0) {
        console.log(
            `No existing records found for profile template ${profileTemplate.slug}`
        )
        return
    }

    try {
        console.log(
            `Removing ${existingRecords.length} records for profile template from Algolia index`,
            profileTemplate.slug
        )
        await client.deleteObjects({
            indexName: PAGES_INDEX,
            objectIDs: existingRecords.map((r) => r.objectID),
        })
        console.log(
            `Removed profile template from Algolia index`,
            profileTemplate.slug
        )
    } catch (e) {
        console.error("Error removing profile template from Algolia index: ", e)
    }
}
