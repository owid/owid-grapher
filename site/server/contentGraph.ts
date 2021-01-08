import { ENTRIES_CATEGORY_ID, getDocumentsInfo, WP_PostType } from "db/wpdb"
import { once } from "grapher/utils/Util"
import * as cheerio from "cheerio"

const fortune = require("fortune") // Works in web browsers, too.
const MemoryAdapter = require("fortune/lib/adapter/adapters/memory")
const {
    errors: { ConflictError },
} = fortune

export enum GraphType {
    Document = "document",
    Chart = "chart",
}

const store = fortune(
    {
        [GraphType.Document]: {
            title: String,
            slug: String,
            data: [Array("chart"), "research"],
        },
        [GraphType.Chart]: {
            research: [Array("document"), "data"],
        },
    },
    {
        adapter: [
            MemoryAdapter,
            {
                // see https://github.com/fortunejs/fortune/commit/70593721efae304ff2db40d1b8f9b43295fed79b#diff-ebb028a2d1528eac83ee833036ef6e50bed6fb7b2b7137f59ac1fb567a5e6ec2R25
                recordsPerType: Infinity,
            },
        ],
    }
)

export const getContentGraph = once(async () => {
    const entries = await getDocumentsInfo(
        WP_PostType.Page,
        "",
        `categoryId: ${ENTRIES_CATEGORY_ID}`
    )
    const posts = await getDocumentsInfo(WP_PostType.Post)
    const documents = [...entries, ...posts]
    for (const document of documents) {
        // Add posts and entries to the content graph
        try {
            await store.create(GraphType.Document, {
                id: document.id,
                title: document.title,
                slug: document.slug,
            })
        } catch (err) {
            // There shouldn't be any ConflictErrors here as the posts are
            // unique in the list we're iterating on, and the call to generate
            // the graph is memoized.
            throw err
        }

        // Add charts within that post to the content graph
        const $ = cheerio.load(document.content || "")
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
                await store.create(GraphType.Chart, {
                    id: slug,
                    research: [document.id],
                })
            } catch (err) {
                // ConflictErrors occur when attempting to create a chart that
                // already exists
                if (!(err instanceof ConflictError)) {
                    throw err
                }
                try {
                    await store.update(GraphType.Chart, {
                        id: slug,
                        push: { research: document.id },
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
