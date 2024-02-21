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
    OwidGdocType,
    type RawPageview,
    Tag,
    PostRestApi,
} from "@ourworldindata/utils"
import { formatPost } from "../formatWordpressPost.js"
import ReactDOMServer from "react-dom/server.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { htmlToText } from "html-to-text"
import {
    PageRecord,
    PageType,
    SearchIndexName,
} from "../../site/search/searchTypes.js"
import { Pageview } from "../../db/model/Pageview.js"
import { GdocPost } from "../../db/model/Gdoc/GdocPost.js"
import { ArticleBlocks } from "../../site/gdocs/components/ArticleBlocks.js"
import React from "react"
import {
    getFullPost,
    getPostTags,
    getPostsFromSnapshots,
} from "../../db/model/Post.js"
import { Knex } from "knex"

interface TypeAndImportance {
    type: PageType
    importance: number
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
            documentType: "country-page" as const,
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
    postsApi: PostRestApi[],
    pageviews: Record<string, RawPageview>,
    knex: Knex<any, any[]>
): Promise<PageRecord[]> {
    const getPostTypeAndImportance = (
        post: FormattedPost,
        tags: Pick<Tag, "name">[]
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
        const rawPost = await getFullPost(postApi)
        if (isEmpty(rawPost.content)) {
            // we have some posts that are only placeholders (e.g. for a redirect); don't index these
            console.log(
                `skipping post ${rawPost.slug} in search indexing because it's empty`
            )
            continue
        }

        const post = await formatPost(rawPost, { footnotes: false }, knex)
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
                documentType: "wordpress" as const,
            }
            const score = computeScore(record)
            records.push({ ...record, score })
            i += 1
        }
    }
    return records
}

function generateGdocRecords(
    gdocs: GdocPost[],
    pageviews: Record<string, RawPageview>
): PageRecord[] {
    const getPostTypeAndImportance = (gdoc: GdocPost): TypeAndImportance => {
        switch (gdoc.content.type) {
            case OwidGdocType.TopicPage:
                return { type: "topic", importance: 3 }
            case OwidGdocType.LinearTopicPage:
                return { type: "topic", importance: 3 }
            case OwidGdocType.Fragment:
                // this should not happen because we filter out fragments; but we want to have an exhaustive switch/case so we include it
                return { type: "other", importance: 0 }
            case OwidGdocType.AboutPage:
                return { type: "about", importance: 0 }
            case OwidGdocType.Article:
            case undefined:
                return { type: "article", importance: 0 }
        }
    }

    const records: PageRecord[] = []
    for (const gdoc of gdocs) {
        if (!gdoc.content.body) continue
        // Only rendering the blocks - not the page nav, title, byline, etc
        const renderedPostContent = ReactDOMServer.renderToStaticMarkup(
            <div>
                <ArticleBlocks blocks={gdoc.content.body} />
            </div>
        )
        const chunks = generateChunksFromHtmlText(renderedPostContent)
        const postTypeAndImportance = getPostTypeAndImportance(gdoc)
        let i = 0

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
                modifiedDate: gdoc.updatedAt!.toISOString(),
                tags: gdoc.tags.map((t) => t.name),
                documentType: "gdoc" as const,
                // authors: gdoc.content.byline, // different format
            }
            const score = computeScore(record)
            records.push({ ...record, score })
            i += 1
        }
    }
    return records
}

// Generate records for countries, WP posts (not including posts that have been succeeded by Gdocs equivalents), and Gdocs
const getPagesRecords = async (knex: Knex<any, any[]>) => {
    const pageviews = await Pageview.getViewsByUrlObj()
    const gdocs = await GdocPost.getPublishedGdocs()
    const publishedGdocsBySlug = keyBy(gdocs, "slug")
    // TODO: the knex instance should be handed down as a parameter
    const slugsWithPublishedGdocsSuccessors =
        await db.getSlugsWithPublishedGdocsSuccessors(db.knexInstance())
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
    const gdocsRecords = generateGdocRecords(gdocs, pageviews)

    return [...countryRecords, ...wordpressRecords, ...gdocsRecords]
}

const indexToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return

    const client = getAlgoliaClient()
    if (!client) {
        console.error(`Failed indexing pages (Algolia client not initialized)`)
        return
    }
    const index = client.initIndex(SearchIndexName.Pages)

    await db.getConnection()
    const records = await getPagesRecords(db.knexInstance())

    index.replaceAllObjects(records)

    await wpdb.singleton.end()
    await db.closeTypeOrmAndKnexConnections()
}

process.on("unhandledRejection", (e) => {
    console.error(e)
    process.exit(1)
})

indexToAlgolia()
