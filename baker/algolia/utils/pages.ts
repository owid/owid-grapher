import * as _ from "lodash-es"
import * as db from "../../../db/db.js"
import { ALGOLIA_INDEXING } from "../../../settings/serverSettings.js"
import { chunkParagraphs } from "../../chunk.js"
import {
    countries,
    Country,
    OwidGdocType,
    type RawPageview,
    OwidGdocPostInterface,
    ARCHVED_THUMBNAIL_FILENAME,
    DEFAULT_GDOC_FEATURED_IMAGE,
    DEFAULT_THUMBNAIL_FILENAME,
    DbEnrichedImage,
    OwidGdocDataInsightInterface,
    OwidGdocAboutInterface,
    getUniqueNamesFromTagHierarchies,
} from "@ourworldindata/utils"
import { getAlgoliaClient } from "../configureAlgolia.js"
import {
    PageRecord,
    SearchIndexName,
    WordpressPageType,
} from "../../../site/search/searchTypes.js"
import { getAnalyticsPageviewsByUrlObj } from "../../../db/model/Pageview.js"
import { getIndexName } from "../../../site/search/searchClient.js"
import type { ObjectWithObjectID } from "@algolia/client-search"
import { SearchIndex } from "algoliasearch"
import { match, P } from "ts-pattern"
import { gdocFromJSON } from "../../../db/model/Gdoc/GdocFactory.js"
import {
    BAKED_BASE_URL,
    CLOUDFLARE_IMAGES_URL,
} from "../../../settings/clientSettings.js"
import { logErrorAndMaybeCaptureInSentry } from "../../../serverUtils/errorLog.js"
import { getFirstBlockOfType } from "../../../site/gdocs/utils.js"
import {
    getPrefixedGdocPath,
    MarkdownTextWrap,
} from "@ourworldindata/components"
import { stripCustomMarkdownComponents } from "../../../db/model/Gdoc/enrichedToMarkdown.js"

const computePageScore = (record: Omit<PageRecord, "score">): number => {
    const { importance, views_7d } = record
    return importance * 1000 + views_7d
}

function generateCountryRecords(
    countries: Country[],
    pageviews: Record<string, RawPageview>
): PageRecord[] {
    return countries.map((country) => {
        const record = {
            objectID: country.slug,
            type: WordpressPageType.Country,
            importance: -1,
            slug: `country/${country.slug}`,
            title: country.name,
            content: `All available indicators for ${country.name}.`,
            views_7d: pageviews[`/country/${country.slug}`]?.views_7d ?? 0,
            documentType: "country-page" as const,
            thumbnailUrl: `/${DEFAULT_THUMBNAIL_FILENAME}`,
        }
        const score = computePageScore(record)
        return { ...record, score }
    })
}

const getThumbnailUrl = (
    gdoc: OwidGdocPostInterface | OwidGdocDataInsightInterface,
    cloudflareImages: Record<string, DbEnrichedImage>
): string => {
    if (gdoc.content.type === OwidGdocType.DataInsight) {
        const firstImage = getFirstBlockOfType(gdoc, "image")
        const filename = firstImage?.smallFilename || firstImage?.filename
        return filename && cloudflareImages[filename]
            ? `${CLOUDFLARE_IMAGES_URL}/${cloudflareImages[filename].cloudflareId}/w=512`
            : `${BAKED_BASE_URL}/${DEFAULT_GDOC_FEATURED_IMAGE}`
    }

    if (gdoc.content["deprecation-notice"]) {
        return `${BAKED_BASE_URL}/${ARCHVED_THUMBNAIL_FILENAME}`
    }

    if (!gdoc.content["featured-image"]) {
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

function formatGdocMarkdown(content: string): string {
    const simplifiedMarkdown = stripCustomMarkdownComponents(content)
    // We still have some markdown gore that MarkdownTextWrap can't handle. Easier to just remove all asterisks.
    const withoutAsterisks = simplifiedMarkdown.replaceAll("*", "")
    const withoutMarkdown = new MarkdownTextWrap({
        text: withoutAsterisks,
        fontSize: 12,
    }).plaintext
    const withoutNewlines = withoutMarkdown.replaceAll("\n", " ")

    // Doing this after removing markdown links because otherwise we need to handle
    // - [word](link).1
    // - [word.](link)1
    // - word.1
    const withoutFootnotes = withoutNewlines.replaceAll(
        /([A-Za-z]\.)\d{1,2}/g,
        "$1"
    )
    // This is used in many data insights but shouldn't be shown in search results
    const withoutArrow = withoutFootnotes.replaceAll("→", "")
    return withoutArrow
}

async function generateGdocRecords(
    gdocs: (OwidGdocPostInterface | OwidGdocDataInsightInterface)[],
    pageviews: Record<string, RawPageview>,
    cloudflareImagesByFilename: Record<string, DbEnrichedImage>,
    knex: db.KnexReadonlyTransaction
): Promise<PageRecord[]> {
    const getPostImportance = (
        gdoc:
            | OwidGdocAboutInterface
            | OwidGdocDataInsightInterface
            | OwidGdocPostInterface
    ): number => {
        return match(gdoc.content.type)
            .with(OwidGdocType.Article, () =>
                "deprecation-notice" in gdoc.content ? -0.5 : 0
            )
            .with(OwidGdocType.AboutPage, () => 1)
            .with(
                P.union(OwidGdocType.TopicPage, OwidGdocType.LinearTopicPage),
                () => 3
            )
            .with(P.union(OwidGdocType.Fragment, undefined), () => 0)
            .with(OwidGdocType.DataInsight, () => 0)
            .exhaustive()
    }

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

        // Only rendering the blocks - not the page nav, title, byline, etc
        const plaintextContent = gdoc.markdown
            ? formatGdocMarkdown(gdoc.markdown)
            : ""

        const chunks = chunkParagraphs(plaintextContent, 1000)
        let i = 0

        const thumbnailUrl = getThumbnailUrl(gdoc, cloudflareImagesByFilename)

        const originalTagNames = gdoc.tags?.map((t) => t.name) ?? []
        // Some Gdocs don't have topic tags by design (e.g. announcements)
        // so we don't log an error if no tags are found.
        // We want to get the parent topic tags as well as the original tags to
        // simplify client-side search queries when searching through areas.
        const topicTags = new Set<string>(
            originalTagNames.flatMap((tagName) =>
                getUniqueNamesFromTagHierarchies(
                    topicHierarchiesByChildName[tagName] ?? [] // in case the gdoc has a non-topic tag
                )
            )
        )

        for (const chunk of chunks) {
            const record = {
                objectID: `${gdoc.id}-c${i}`,
                importance: getPostImportance(gdoc),
                type: gdoc.content.type,
                slug: gdoc.slug,
                title: gdoc.content.title || "",
                content: chunk,
                views_7d:
                    pageviews[getPrefixedGdocPath("", gdoc)]?.views_7d ?? 0,
                excerpt: getExcerptFromGdoc(gdoc),
                date: gdoc.publishedAt!.toISOString(),
                modifiedDate: (
                    gdoc.updatedAt ?? gdoc.publishedAt!
                ).toISOString(),
                tags: [...topicTags],
                documentType: "gdoc" as const,
                authors: gdoc.content.authors,
                thumbnailUrl,
            }
            const score = computePageScore(record)
            records.push({ ...record, score })
            i += 1
        }
    }
    return records
}

// Generate records for countries, WP posts (not including posts that have been succeeded by Gdocs equivalents), and Gdocs
export const getPagesRecords = async (knex: db.KnexReadonlyTransaction) => {
    const pageviews = await getAnalyticsPageviewsByUrlObj(knex)
    const gdocs = (await db
        .getPublishedGdocsWithTags(knex, [
            OwidGdocType.Article,
            OwidGdocType.LinearTopicPage,
            OwidGdocType.TopicPage,
            OwidGdocType.AboutPage,
            OwidGdocType.DataInsight,
        ])
        .then((gdocs) => gdocs.map(gdocFromJSON))) as (
        | OwidGdocPostInterface
        | OwidGdocDataInsightInterface
    )[]

    const countryRecords = generateCountryRecords(countries, pageviews)
    const cloudflareImagesByFilename = await db
        .getCloudflareImages(knex)
        .then((images) => _.keyBy(images, "filename"))

    const gdocsRecords = await generateGdocRecords(
        gdocs,
        pageviews,
        cloudflareImagesByFilename,
        knex
    )

    return [...countryRecords, ...gdocsRecords]
}

async function getExistingRecordsForSlug(
    index: SearchIndex,
    slug: string
): Promise<ObjectWithObjectID[]> {
    const settings = await index.getSettings()
    // Settings can be specified with a modifier, e.g. `filterOnly(slug)`.
    if (!settings.attributesForFaceting?.some((a) => a.includes("slug"))) {
        await logErrorAndMaybeCaptureInSentry(
            new Error(
                "Attribute 'slug' must be set in the index's attributesForFaceting " +
                    "to get existing records in Algolia."
            )
        )
    }
    const existingRecordsForPost: ObjectWithObjectID[] = []
    await index.browseObjects({
        filters: `slug:${slug}`,
        attributesToRetrieve: ["objectID"],
        // This is the way you get results from browseObjects for some reason 🤷
        batch: (batch) => existingRecordsForPost.push(...batch),
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
    const index = client.initIndex(getIndexName(SearchIndexName.Pages))
    const pageviews = await getAnalyticsPageviewsByUrlObj(knex)
    const cloudflareImagesByFilename = await db
        .getCloudflareImages(knex)
        .then((images) => _.keyBy(images, "filename"))
    const existingPageviews = pageviews[`/${indexedSlug}`]
    const pageviewsForGdoc = {
        [gdoc.slug]: existingPageviews || {
            views_7d: 0,
            views_14d: 0,
            views_365d: 0,
            day: new Date(),
            url: gdoc.slug,
        },
    }

    const records = await generateGdocRecords(
        [gdoc],
        pageviewsForGdoc,
        cloudflareImagesByFilename,
        knex
    )

    const existingRecordsForPost: ObjectWithObjectID[] =
        await getExistingRecordsForSlug(index, indexedSlug)

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
            await index.deleteObjects(
                existingRecordsForPost.map((r) => r.objectID)
            )
        }
        console.log("Updating Algolia index for Gdoc post", gdoc.slug)
        // If the number of records hasn't changed, the records' objectIDs will be the same
        // so this will safely overwrite them or create new ones
        await index.saveObjects(records)
        console.log("Updated Algolia index for Gdoc post", gdoc.slug)
    } catch (e) {
        console.error("Error indexing Gdoc post to Algolia: ", e)
    }
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
    const index = client.initIndex(getIndexName(SearchIndexName.Pages))
    const existingRecordsForPost: ObjectWithObjectID[] =
        await getExistingRecordsForSlug(index, gdoc.slug)

    try {
        console.log("Removing Gdoc post from Algolia index", gdoc.slug)
        await index.deleteObjects(existingRecordsForPost.map((r) => r.objectID))
        console.log("Removed Gdoc post from Algolia index", gdoc.slug)
    } catch (e) {
        console.error("Error removing Gdoc post from Algolia index: ", e)
    }
}
