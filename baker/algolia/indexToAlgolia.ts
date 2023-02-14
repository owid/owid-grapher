import * as db from "../../db/db.js"
import * as wpdb from "../../db/wpdb.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { chunkParagraphs } from "../chunk.js"
import { countries, FormattedPost, isEmpty } from "@ourworldindata/utils"
import { formatPost } from "../../baker/formatWordpressPost.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { htmlToText } from "html-to-text"
import { PageRecord, PageType } from "../../site/search/searchTypes.js"
import { Pageview } from "../../db/model/Pageview.js"

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

const getPagesRecords = async () => {
    const postsApi = await wpdb.getPosts()
    const pageviews = await Pageview.viewsByUrlObj()

    const records: PageRecord[] = []
    for (const country of countries) {
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
        records.push({ ...record, score })
    }

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
        const postText = htmlToText(post.html, {
            tables: true,
            ignoreHref: true,
            wordwrap: false,
            uppercaseHeadings: false,
            ignoreImage: true,
        })
        const chunks = chunkParagraphs(postText, 1000)

        const tags = await getPostTags(post.id)
        const postTypeAndImportance = getPostTypeAndImportance(post, tags)

        let i = 0
        for (const c of chunks) {
            const record = {
                objectID: `${rawPost.id}-c${i}`,
                postId: post.id,
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
