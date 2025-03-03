import * as db from "../../../db/db.js"
import { ALGOLIA_INDEXING } from "../../../settings/serverSettings.js"
import { chunkParagraphs } from "../../chunk.js"
import {
    countries,
    Country,
    FormattedPost,
    isEmpty,
    keyBy,
    OwidGdocType,
    type RawPageview,
    PostRestApi,
    DbPlainTag,
    OwidGdocPostInterface,
    ARCHVED_THUMBNAIL_FILENAME,
    DEFAULT_GDOC_FEATURED_IMAGE,
    DEFAULT_THUMBNAIL_FILENAME,
    DbEnrichedImage,
} from "@ourworldindata/utils"
import { formatPost } from "../../formatWordpressPost.js"
import ReactDOMServer from "react-dom/server.js"
import { getAlgoliaClient } from "../configureAlgolia.js"
import { htmlToText } from "html-to-text"
import {
    PageRecord,
    SearchIndexName,
} from "../../../site/search/searchTypes.js"
import { getAnalyticsPageviewsByUrlObj } from "../../../db/model/Pageview.js"
import { ArticleBlocks } from "../../../site/gdocs/components/ArticleBlocks.js"
import { createElement } from "react"
import {
    getFullPost,
    getPostTags,
    getPostsFromSnapshots,
} from "../../../db/model/Post.js"
import { getIndexName } from "../../../site/search/searchClient.js"
import { ObjectWithObjectID } from "@algolia/client-search"
import { SearchIndex } from "algoliasearch"
import { match, P } from "ts-pattern"
import { gdocFromJSON } from "../../../db/model/Gdoc/GdocFactory.js"
import { formatUrls } from "../../../site/formatting.js"
import { TypeAndImportance } from "./types.js"
import {
    BAKED_BASE_URL,
    CLOUDFLARE_IMAGES_URL,
} from "../../../settings/clientSettings.js"
import { logErrorAndMaybeCaptureInSentry } from "../../../serverUtils/errorLog.js"

const computePageScore = (record: Omit<PageRecord, "score">): number => {
    const { importance, views_7d } = record
    return importance * 1000 + views_7d
}

function generateCountryRecords(
    countries: Country[],
    pageviews: Record<string, RawPageview>
): PageRecord[] {
    return countries.map((country) => {
        const postTypeAndImportance: TypeAndImportance = {
            type: "country",
            importance: -1,
        }
        const record = {
            objectID: country.slug,
            ...postTypeAndImportance,
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

function generateChunksFromHtmlText(htmlString: string) {
    const renderedPostText = htmlToText(htmlString, {
        tables: true,
        wordwrap: false,
        selectors: [
            // Ignore links, we only care about the text
            { selector: "a", options: { ignoreHref: true } },

            // Don't uppercase headings and table headers
            ...["h1", "h2", "h3", "h4", "h5", "h6"].map((headingTag) => ({
                selector: headingTag,
                options: { uppercase: false },
            })),
            { selector: "table", options: { uppercaseHeaderCells: false } },

            // Skip all images
            { selector: "img", format: "skip" },
        ],
    })
    return chunkParagraphs(renderedPostText, 1000)
}

async function generateWordpressRecords(
    postsApi: PostRestApi[],
    pageviews: Record<string, RawPageview>,
    knex: db.KnexReadonlyTransaction
): Promise<PageRecord[]> {
    const getPostTypeAndImportance = (
        post: FormattedPost,
        tags: Pick<DbPlainTag, "name">[]
    ): TypeAndImportance => {
        if (post.slug.startsWith("about/") || post.slug === "about")
            return { type: "about", importance: 1 }
        if (post.slug.match(/\bfaqs?\b/i)) return { type: "faq", importance: 1 }
        if (post.type === "post") return { type: "article", importance: 0 }
        if (tags.some((t) => t.name === "Entries"))
            return { type: "topic", importance: 3 }

        return { type: "other", importance: 0 }
    }

    const records: PageRecord[] = []

    for (const postApi of postsApi) {
        const rawPost = await getFullPost(knex, postApi)
        if (isEmpty(rawPost.content)) {
            // we have some posts that are only placeholders (e.g. for a redirect); don't index these
            console.log(
                `skipping post ${rawPost.slug} in search indexing because it's empty`
            )
            continue
        }

        const post = await formatPost(rawPost, { footnotes: false }, knex)
        const chunks = generateChunksFromHtmlText(post.html)
        const tags = await getPostTags(knex, post.id)
        const postTypeAndImportance = getPostTypeAndImportance(post, tags)

        let i = 0
        for (const c of chunks) {
            const record = {
                objectID: `${rawPost.id}-c${i}`,
                ...postTypeAndImportance,
                slug: post.path,
                title: post.title,
                excerpt: post.excerpt,
                authors: post.authors,
                date: post.date.toISOString(),
                modifiedDate: post.modifiedDate.toISOString(),
                content: c,
                tags: tags.map((t) => t.name),
                thumbnailUrl: formatUrls(
                    post.thumbnailUrl ?? `/${DEFAULT_THUMBNAIL_FILENAME}`
                ),
                views_7d: pageviews[`/${post.path}`]?.views_7d ?? 0,
                documentType: "wordpress" as const,
            }
            const score = computePageScore(record)
            records.push({ ...record, score })
            i += 1
        }
    }
    return records
}

const getThumbnailUrl = (
    gdoc: OwidGdocPostInterface,
    cloudflareImages: Record<string, DbEnrichedImage>
): string => {
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

function generateGdocRecords(
    gdocs: OwidGdocPostInterface[],
    pageviews: Record<string, RawPageview>,
    cloudflareImagesByFilename: Record<string, DbEnrichedImage>
): PageRecord[] {
    const getPostTypeAndImportance = (
        gdoc: OwidGdocPostInterface
    ): TypeAndImportance => {
        return match(gdoc.content.type)
            .with(OwidGdocType.Article, () => ({
                type: "article" as const,
                importance: "deprecation-notice" in gdoc.content ? -0.5 : 0,
            }))
            .with(OwidGdocType.AboutPage, () => ({
                type: "about" as const,
                importance: 1,
            }))
            .with(
                P.union(OwidGdocType.TopicPage, OwidGdocType.LinearTopicPage),
                () => ({
                    type: "topic" as const,
                    importance: 3,
                })
            )
            .with(P.union(OwidGdocType.Fragment, undefined), () => ({
                type: "other" as const,
                importance: 0,
            }))
            .exhaustive()
    }

    const records: PageRecord[] = []
    for (const gdoc of gdocs) {
        if (!gdoc.content.body) continue
        // Only rendering the blocks - not the page nav, title, byline, etc
        const renderedPostContent = ReactDOMServer.renderToStaticMarkup(
            createElement(
                "div",
                null,
                createElement(ArticleBlocks, {
                    blocks: gdoc.content.body,
                })
            )
        )
        const chunks = generateChunksFromHtmlText(renderedPostContent)
        const postTypeAndImportance = getPostTypeAndImportance(gdoc)
        let i = 0

        const thumbnailUrl = getThumbnailUrl(gdoc, cloudflareImagesByFilename)

        for (const chunk of chunks) {
            const record = {
                objectID: `${gdoc.id}-c${i}`,
                ...postTypeAndImportance,
                slug: gdoc.slug,
                title: gdoc.content.title || "",
                content: chunk,
                views_7d: pageviews[`/${gdoc.slug}`]?.views_7d ?? 0,
                excerpt: gdoc.content.excerpt,
                date: gdoc.publishedAt!.toISOString(),
                modifiedDate: (
                    gdoc.updatedAt ?? gdoc.publishedAt!
                ).toISOString(),
                tags: gdoc.tags?.map((t) => t.name),
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
    const gdocs = await db
        .getPublishedGdocPostsWithTags(knex)
        .then((gdocs) => gdocs.map(gdocFromJSON) as OwidGdocPostInterface[])

    const publishedGdocsBySlug = keyBy(gdocs, "slug")
    const slugsWithPublishedGdocsSuccessors =
        await db.getSlugsWithPublishedGdocsSuccessors(knex)
    const postsApi = await getPostsFromSnapshots(knex, undefined, (post) => {
        // Two things can happen here:
        // 1. There's a published Gdoc with the same slug
        // 2. This post has a Gdoc successor (which might have a different slug)
        // In either case, we don't want to index this WP post
        return !(
            publishedGdocsBySlug[post.slug] ||
            slugsWithPublishedGdocsSuccessors.has(post.slug)
        )
    })

    const countryRecords = generateCountryRecords(countries, pageviews)
    const wordpressRecords = await generateWordpressRecords(
        postsApi,
        pageviews,
        knex
    )
    const cloudflareImagesByFilename = await db
        .getCloudflareImages(knex)
        .then((images) => keyBy(images, "filename"))

    const gdocsRecords = generateGdocRecords(
        gdocs,
        pageviews,
        cloudflareImagesByFilename
    )

    return [...countryRecords, ...wordpressRecords, ...gdocsRecords]
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
        .then((images) => keyBy(images, "filename"))
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
    const records = generateGdocRecords(
        [gdoc],
        pageviewsForGdoc,
        cloudflareImagesByFilename
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
