import * as db from "../../db/db.js"
import * as wpdb from "../../db/wpdb.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { chunkParagraphs } from "../chunk.js"
import {
    countries,
    Country,
    FormattedPost,
    isEmpty,
    keyBy,
    type RawPageview,
} from "@ourworldindata/utils"
import { formatPost } from "../../baker/formatWordpressPost.js"
import ReactDOMServer from "react-dom/server.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { htmlToText } from "html-to-text"
import { PageRecord, PageType } from "../../site/search/searchTypes.js"
import { Pageview } from "../../db/model/Pageview.js"
import { Gdoc } from "../../db/model/Gdoc/Gdoc.js"
import ArticleBlock from "../../site/gdocs/ArticleBlock.js"
import React from "react"
import { logErrorAndMaybeSendToSlack } from "../../serverUtils/slackLog.js"

interface Tag {
    id: number
    name: string
}

interface TypeAndImportance {
    type: PageType
    importance: number
}

const getPostTags = async (postId: number) => {
    return (await db
        .knexTable("post_tags")
        .select("tags.id", "tags.name")
        .where({ post_id: postId })
        .join("tags", "tags.id", "=", "post_tags.tag_id")) as Tag[]
}

const getPostTypeAndImportance = (
    post: FormattedPost,
    tags: Tag[]
): TypeAndImportance => {
    if (post.slug.startsWith("about/") || post.slug === "about")
        return { type: "about", importance: 1 }
    if (post.slug.match(/\bfaqs?\b/i)) return { type: "faq", importance: 1 }
    if (post.type === "post") return { type: "article", importance: 0 }
    if (tags.some((t) => t.name === "Entries"))
        return { type: "topic", importance: 3 }

    return { type: "other", importance: 0 }
}

const computeScore = (record: Omit<PageRecord, "score">): number => {
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
        }
        const score = computeScore(record)
        return { ...record, score }
    })
}

function generateChunksFromHtmlText(htmlString: string) {
    const renderedPostText = htmlToText(htmlString, {
        tables: true,
        ignoreHref: true,
        wordwrap: false,
        uppercaseHeadings: false,
        ignoreImage: true,
    })
    return chunkParagraphs(renderedPostText, 1000)
}

async function generateWordpressRecords(
    postsApi: wpdb.PostAPI[],
    pageviews: Record<string, RawPageview>
): Promise<PageRecord[]> {
    const records: PageRecord[] = []

    for (const postApi of postsApi) {
        const rawPost = await wpdb.getFullPost(postApi)
        if (isEmpty(rawPost.content)) {
            // we have some posts that are only placeholders (e.g. for a redirect); don't index these
            console.log(
                `skipping post ${rawPost.slug} in search indexing because it's empty`
            )
            continue
        }

        const post = await formatPost(rawPost, { footnotes: false })
        const chunks = generateChunksFromHtmlText(post.html)
        const tags = await getPostTags(post.id)
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
                views_7d: pageviews[`/${post.path}`]?.views_7d ?? 0,
            }
            const score = computeScore(record)
            records.push({ ...record, score })
            i += 1
        }
    }
    return records
}

function generateGdocRecords(
    gdocs: Gdoc[],
    pageviews: Record<string, RawPageview>
): PageRecord[] {
    const records: PageRecord[] = []
    for (const gdoc of gdocs) {
        // Only rendering the blocks - not the page nav, title, byline, etc
        const renderedPostContent = ReactDOMServer.renderToStaticMarkup(
            React.createElement(
                "div",
                {},
                gdoc.content.body?.map((block) => ArticleBlock({ b: block }))
            )
        )
        const chunks = generateChunksFromHtmlText(renderedPostContent)
        let i = 0

        for (const chunk of chunks) {
            const record = {
                objectID: `${gdoc.id}-c${i}`,
                type: "article" as const, // Gdocs can only be articles for now
                importance: 0, // Gdocs can only be articles for now
                slug: gdoc.slug,
                title: gdoc.content.title || "",
                content: chunk,
                views_7d: pageviews[`/${gdoc.slug}`]?.views_7d ?? 0,
                excerpt: gdoc.content.excerpt,
                date: gdoc.publishedAt!.toISOString(),
                modifiedDate: gdoc.updatedAt!.toISOString(),
                // authors: gdoc.content.byline, // different format
                // tags: string[] // not supported
            }
            const score = computeScore(record)
            records.push({ ...record, score })
            i += 1
        }
    }
    return records
}

// Generate records for countries, WP posts (not including posts that have been succeeded by Gdocs equivalents), and Gdocs
const getPagesRecords = async () => {
    const pageviews = await Pageview.getViewsByUrlObj()
    const gdocs = await Gdoc.getPublishedGdocs()
    const publishedGdocsBySlug = keyBy(gdocs, "slug")
    const postsApi = await wpdb
        .getPosts()
        .then((posts) =>
            posts.filter((post) => !publishedGdocsBySlug[`/${post.slug}`])
        )

    let countryRecords: PageRecord[] = []
    let wordpressRecords: PageRecord[] = []
    let gdocsRecords: PageRecord[] = []
    try {
        countryRecords = generateCountryRecords(countries, pageviews)
    } catch (e) {
        logErrorAndMaybeSendToSlack(
            `Error generating country records for Algolia sync: ${e}`
        )
    }
    try {
        wordpressRecords = await generateWordpressRecords(postsApi, pageviews)
    } catch (e) {
        logErrorAndMaybeSendToSlack(
            `Error generating wordpress records for Algolia sync: ${e}`
        )
    }
    try {
        gdocsRecords = generateGdocRecords(gdocs, pageviews)
    } catch (e) {
        logErrorAndMaybeSendToSlack(
            `Error generating gdocs records for Algolia sync: ${e}`
        )
    }

    return [...countryRecords, ...wordpressRecords, ...gdocsRecords]
}

const indexToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return

    const client = getAlgoliaClient()
    if (!client) {
        console.error(`Failed indexing pages (Algolia client not initialized)`)
        return
    }
    const index = client.initIndex("pages")

    await db.getConnection()
    const records = await getPagesRecords()

    index.replaceAllObjects(records)

    await wpdb.singleton.end()
    await db.closeTypeOrmAndKnexConnections()
}

indexToAlgolia()
