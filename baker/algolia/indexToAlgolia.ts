import * as db from "../../db/db"
import * as wpdb from "../../db/wpdb"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings"
import { chunkParagraphs, htmlToPlaintext } from "../../clientUtils/search"
import { countries } from "../../clientUtils/countries"
import { FormattedPost } from "../../clientUtils/owidTypes"
import { formatPost } from "../../baker/formatWordpressPost"
import { getAlgoliaClient } from "./configureAlgolia"

interface Tag {
    id: number
    name: string
}

const getPostTags = async (postId: number) => {
    return (await db
        .knexTable("post_tags")
        .select("tags.id", "tags.name")
        .where({ post_id: postId })
        .join("tags", "tags.id", "=", "post_tags.tag_id")) as Tag[]
}

const getPostType = (post: FormattedPost, tags: Tag[]) => {
    if (post.slug.startsWith("about/")) return "about"
    if (post.type === "post") {
        if (tags.some((t) => t.name === "Explainers")) return "explainer"
        if (tags.some((t) => t.name === "Short updates and facts"))
            return "fact"
        return "post"
    }

    if (tags.some((t) => t.name === "Entries")) return "entry"

    return "page"
}

const getPagesRecords = async () => {
    const postsApi = await wpdb.getPosts()

    const records = []
    for (const country of countries) {
        records.push({
            objectID: country.slug,
            type: "country",
            slug: country.slug,
            title: country.name,
            content: `All available indicators for ${country.name}.`,
        })
    }

    for (const postApi of postsApi) {
        const rawPost = await wpdb.getFullPost(postApi)

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
                _tags: tags.map((t) => t.name),
                importance: importance,
            })
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

    const records = await getPagesRecords()
    index.replaceAllObjects(records)

    await wpdb.singleton.end()
    await db.closeTypeOrmAndKnexConnections()
}

indexToAlgolia()
