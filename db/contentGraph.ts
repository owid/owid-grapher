import {
    ChartRecord,
    DocumentNode,
    GraphDocumentType,
    GraphType,
    WP_PostType,
} from "../clientUtils/owidTypes"
import { once, isEmpty } from "../clientUtils/Util"
import { queryMysql } from "./db"
import { ENTRIES_CATEGORY_ID, getDocumentsInfo } from "./wpdb"

const fortune = require("fortune") // Works in web browsers, too.
const MemoryAdapter = require("fortune/lib/adapter/adapters/memory")
const {
    errors: { ConflictError },
} = fortune

export const WPPostTypeToGraphDocumentType = {
    [WP_PostType.Page]: GraphDocumentType.Topic,
    [WP_PostType.Post]: GraphDocumentType.Article,
}

export const getChartsRecords = async (): Promise<ChartRecord[]> => {
    const allCharts = await queryMysql(`
        SELECT id, config->>"$.slug" AS slug, config->>"$.title" AS title, config->>"$.topicIds" as parentTopics
        FROM charts
        WHERE publishedAt IS NOT NULL
        AND is_indexable IS TRUE
    `)

    const records: ChartRecord[] = []
    for (const c of allCharts) {
        records.push({
            id: c.id,
            slug: c.slug,
            title: c.title,
            type: GraphType.Chart,
            parentTopics: JSON.parse(c.parentTopics) ?? [],
        })
    }

    return records
}

export const getGrapherSlugs = (content: string | null): Set<string> => {
    const slugs = new Set<string>()
    if (!content) return slugs

    const matches = content.matchAll(/\/grapher\/([a-zA-Z0-9-]+)/g)
    for (const match of matches) {
        slugs.add(match[1])
    }
    return slugs
}

const throwAllButConflictError = (err: unknown): void => {
    if (!(err instanceof ConflictError)) {
        throw err
    }
}

export const addDocumentsToGraph = async (
    documents: DocumentNode[],
    graph: any
): Promise<void> => {
    for (const document of documents) {
        // Create the parent topics first (add records with the only available
        // referential information - id - then update the records when going
        // through the parent topic as a document)
        if (document.parentTopics) {
            for (const parentTopic of document.parentTopics) {
                try {
                    await graph.create(GraphType.Document, {
                        id: parentTopic,
                    })
                } catch (err) {
                    // If the document has already being added as a parent topic of
                    // another document, a ConflictError will be raised. Any other
                    // error will be thrown.
                    throwAllButConflictError(err)
                }
            }
        }

        // Add posts and entries to the content graph
        try {
            // Warning: this mutates document (removes keys that are not listed
            // in the graph / graph schema)
            await graph.create(GraphType.Document, document)
        } catch (err) {
            // If the document has already been added as a parent, a
            // ConflictError will be raised.
            throwAllButConflictError(err)

            const { id, ...rest } = document
            await graph.update(GraphType.Document, {
                id,
                replace: {
                    ...rest,
                },
            })
        }
    }
}

const addChartsToGraph = async (
    allCharts: ChartRecord[],
    graph: any
): Promise<void> => {
    for (const chart of allCharts) {
        try {
            await graph.create(GraphType.Chart, chart)
        } catch (err) {
            throw err
        }
    }
}

const addEmbeddedChartsToGraph = async (
    documents: DocumentNode[],
    graph: any
): Promise<void> => {
    for (const document of documents) {
        // Add embedded charts within that post to the content graph
        const grapherSlugs = getGrapherSlugs(document.content)

        for (const slug of grapherSlugs) {
            const id = (
                await graph.find(GraphType.Chart, null, {
                    fields: { id: true },
                    match: { slug },
                })
            ).payload.records?.[0]?.id

            if (!id) continue // chart only embedded, not queried. Should only happen during dev, when building partial graph.
            try {
                await graph.update(GraphType.Chart, {
                    id,
                    push: { embeddedIn: document.id },
                })
            } catch (err) {
                // ConflictErrors occur here when a chart <-> post
                // relationship already exists
                throwAllButConflictError(err)
            }
        }
    }
}

export const removeUnpublishedDocuments = async (graph: any): Promise<void> => {
    const ids = (
        await graph.find(GraphType.Document, null, {
            fields: { id: true },
            match: { title: null },
        })
    ).payload.records?.map((record: { id: number }) => record.id)

    if (isEmpty(ids)) return
    await graph.delete(GraphType.Document, ids)
}

export const fortuneRecordTypes = {
    [GraphType.Document]: {
        title: String,
        slug: String,
        type: String,
        content: String,
        image: String,
        parentTopics: [Array(GraphType.Document), "childrenTopics"],
        childrenTopics: [Array(GraphType.Document), "parentTopics"],
        embeddedCharts: [Array(GraphType.Chart), "embeddedIn"],
        charts: [Array(GraphType.Chart), "parentTopics"],
    },
    [GraphType.Chart]: {
        title: String,
        slug: String,
        type: String,
        embeddedIn: [Array(GraphType.Document), "embeddedCharts"],
        parentTopics: [Array(GraphType.Document), "charts"],
    },
}

export const getContentGraph = once(async () => {
    const graph = fortune(fortuneRecordTypes, {
        adapter: [
            MemoryAdapter,
            {
                // see https://github.com/fortunejs/fortune/commit/70593721efae304ff2db40d1b8f9b43295fed79b#diff-ebb028a2d1528eac83ee833036ef6e50bed6fb7b2b7137f59ac1fb567a5e6ec2R25
                recordsPerType: Infinity,
            },
        ],
    })

    // Add documents (topics, articles)
    const orderBy = "orderby:{field:MODIFIED, order:DESC}"
    const entries = await getDocumentsInfo(
        WP_PostType.Page,
        "",
        `categoryId: ${ENTRIES_CATEGORY_ID}, ${orderBy}`
    )
    const posts = await getDocumentsInfo(WP_PostType.Post, "", orderBy)
    const documents = [...entries, ...posts]
    await addDocumentsToGraph(documents, graph)

    // Add all public charts
    const allCharts = await getChartsRecords()
    await addChartsToGraph(allCharts, graph)

    // Add all embedded charts
    await addEmbeddedChartsToGraph(documents, graph)

    // Unpublished topics might be referenced as a parent. As a result, only the
    // referential information (id) is present.
    await removeUnpublishedDocuments(graph)

    return graph
})

const main = async (): Promise<void> => {
    const graph = await getContentGraph()
}

if (require.main === module) main()
