import { getFullPost, getPosts } from "db/wpdb"
import { once } from "grapher/utils/Util"
import * as cheerio from "cheerio"

const fortune = require("fortune") // Works in web browsers, too.
const MemoryAdapter = require("fortune/lib/adapter/adapters/memory")
const {
    errors: { ConflictError },
} = fortune

const store = fortune(
    {
        post: {
            title: String,
            slug: String,
            data: [Array("chart"), "research"],
        },
        chart: {
            research: [Array("post"), "data"],
        },
    },
    {
        adapter: [
            MemoryAdapter,
            {
                recordsPerType: 2000,
            },
        ],
    }
)

export const getContentGraph = once(async () => {
    const postsApi = await getPosts()
    for (const postApi of postsApi) {
        const post = await getFullPost(postApi)

        // Add posts to the content graph
        try {
            await store.create("post", {
                id: post.id,
                title: post.title,
                slug: post.slug,
            })
        } catch (err) {
            // There shouldn't be any ConflictErrors here as the posts are
            // unique in the list we're iterating on, and the call to generate
            // the graph is memoized.
            throw err
        }

        // Add charts within that post to the content graph
        const $ = cheerio.load(post.content)
        const grapherRegex = /\/grapher\//
        const grapherSlugs = $("iframe")
            .toArray()
            .filter((el) => grapherRegex.test(el.attribs["src"]))
            .map((el) => {
                const matchedGrapherUrl = el.attribs["src"].match(
                    /\/grapher\/([a-zA-Z0-9-]+)/
                )
                return matchedGrapherUrl ? matchedGrapherUrl[1] ?? null : null
            })
            .filter((el) => el !== null)
        for (const slug of grapherSlugs) {
            try {
                await store.create("chart", {
                    id: slug,
                    research: [post.id],
                })
            } catch (err) {
                // ConflictErrors occur when attempting to create a chart that
                // already exists
                if (!(err instanceof ConflictError)) {
                    throw err
                }
                try {
                    await store.update("chart", {
                        id: slug,
                        push: { research: post.id },
                    })
                } catch (err) {
                    // ConflictErrors occur here when a chart <-> post
                    // relationship already exists
                    if (!(err instanceof ConflictError)) {
                        throw err
                    }
                }
            }
        }
    }
    return store
})
