import algoliasearch from "algoliasearch"

import * as db from "db/db"
import * as wpdb from "db/wpdb"
import { ALGOLIA_ID } from "settings"
import { ALGOLIA_SECRET_KEY } from "serverSettings"
import { formatPost, FormattedPost } from "site/server/formatting"
import { chunkParagraphs } from "utils/search"
import { htmlToPlaintext } from "utils/string"
import { countries } from "utils/countries"

interface Tag {
    id: number
    name: string
}

async function getPostTags(postId: number) {
    return (await db
        .table("post_tags")
        .select("tags.id", "tags.name")
        .where({ post_id: postId })
        .join("tags", "tags.id", "=", "post_tags.tag_id")) as Tag[]
}

function getPostType(post: FormattedPost, tags: Tag[]) {
    if (post.slug.startsWith("about/")) {
        return "about"
    } else if (post.type === "post") {
        if (tags.some(t => t.name === "Explainers")) return "explainer"
        else if (tags.some(t => t.name === "Short updates and facts"))
            return "fact"
        else return "post"
    } else {
        if (tags.some(t => t.name === "Entries")) {
            return "entry"
        } else {
            return "page"
        }
    }
}

async function indexToAlgolia() {
    const client = algoliasearch(ALGOLIA_ID, ALGOLIA_SECRET_KEY)
    const finalIndex = await client.initIndex("pages")
    const tmpIndex = await client.initIndex("pages_tmp")

    // Copy to a temporary index which we will then update
    // This is so we can do idempotent reindexing
    await client.copyIndex(finalIndex.indexName, tmpIndex.indexName, [
        "settings",
        "synonyms",
        "rules"
    ])

    const postsApi = await wpdb.getPosts()

    const records = []

    for (const country of countries) {
        records.push({
            objectID: country.slug,
            type: "country",
            slug: country.slug,
            title: country.name,
            content: `All available indicators for ${country.name}.`
        })
    }

    for (const postApi of postsApi) {
        const rawPost = await wpdb.getFullPost(postApi)

        // Index the content of blog posts as entry sections (BPES) within the context
        // of the embedding entry, and not the blog post. In other words,
        // searching for BPES content will show up in the SERP under an entry
        // block.
        if (wpdb.isPostEmbedded(rawPost)) {
            continue
        }

        const post = await formatPost(rawPost, { footnotes: false })
        const postText = htmlToPlaintext(post.html)
        const chunks = chunkParagraphs(postText, 1000)

        const tags = await getPostTags(post.id)
        const postType = getPostType(post, tags)

        let importance = 0
        if (postType === "entry") importance = 3
        else if (postType === "explainer") importance = 2
        else if (postType === "fact") importance = 1

        let i = 0
        for (const c of chunks) {
            records.push({
                objectID: `${rawPost.id}-c${i}`,
                postId: post.id,
                type: postType,
                slug: post.path,
                title: post.title,
                excerpt: post.excerpt,
                authors: post.authors,
                date: post.date,
                modifiedDate: post.modifiedDate,
                content: c,
                _tags: tags.map(t => t.name),
                importance: importance
            })
            i += 1
        }
    }

    for (let i = 0; i < records.length; i += 1000) {
        await tmpIndex.saveObjects(records.slice(i, i + 1000))
    }
    await client.moveIndex(tmpIndex.indexName, finalIndex.indexName)

    await wpdb.end()
    await db.end()
}

indexToAlgolia()
