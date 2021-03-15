import { WP_PostType } from "../clientUtils/owidTypes"
import { once } from "../clientUtils/Util"
import { ENTRIES_CATEGORY_ID, getDocumentsInfo } from "./wpdb"

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

export const getGrapherSlugs = (content: string | null): Set<string> => {
    const slugs = new Set<string>()
    if (!content) return slugs

    const matches = content.matchAll(/\/grapher\/([a-zA-Z0-9-]+)/g)
    for (const match of matches) {
        slugs.add(match[1])
    }
    return slugs
}

export const getContentGraph = once(async () => {
    const orderBy = "orderby:{field:MODIFIED, order:DESC}"
    const entries = await getDocumentsInfo(
        WP_PostType.Page,
        "",
        `categoryId: ${ENTRIES_CATEGORY_ID}, ${orderBy}`
    )
    const posts = await getDocumentsInfo(WP_PostType.Post, "", orderBy)
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
        const grapherSlugs = getGrapherSlugs(document.content)
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
