/**
 * Cloudflare Worker script to index topics into Vectorize.
 *
 * This script:
 * 1. Fetches topics from Datasette (public MySQL read-only API)
 * 2. Generates embeddings using Workers AI
 * 3. Upserts vectors with metadata to Vectorize
 *
 * Usage:
 *   wrangler dev --remote functions/scripts/indexTopics.ts
 *   # or deploy and invoke via HTTP:
 *   wrangler deploy functions/scripts/indexTopics.ts --name index-topics
 *   curl "https://index-topics.<subdomain>.workers.dev"
 *   curl "https://index-topics.<subdomain>.workers.dev?slug=climate-change"
 */

import { Env } from "../_common/env.js"

interface TopicData {
    id: number
    name: string
    slug: string
    excerpt: string | null
    markdown: string | null
}

interface DatasetteResponse {
    ok: boolean
    rows: Array<[number, string, string, string | null, string | null]>
    error?: string | null
}

const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5"
const EMBEDDING_BATCH_SIZE = 100
const DATASETTE_URL = "https://datasette-public.owid.io/owid.json"

/**
 * Build the SQL query to fetch topics from Datasette.
 * Matches the logic in db.getTopicsForAISearch()
 * Note: Datasette uses DuckDB, so we use DuckDB JSON syntax (->>) instead of MySQL's JSON_UNQUOTE(JSON_EXTRACT())
 */
function buildTopicsQuery(slugFilter?: string): string {
    const baseQuery = `
        SELECT
            t.id,
            t.name,
            t.slug,
            p.content->>'$.excerpt' AS excerpt,
            p.markdown
        FROM tags t
        JOIN posts_gdocs p ON t.slug = p.slug
        WHERE
            t.slug IS NOT NULL
            AND p.published = 1
            AND p.type IN ('topic-page', 'linear-topic-page')
    `

    if (slugFilter) {
        return `${baseQuery} AND t.slug = '${slugFilter}' ORDER BY t.name ASC`
    }

    return `${baseQuery} ORDER BY t.name ASC`
}

/**
 * Fetch topics from Datasette API
 */
async function fetchTopicsFromDatasette(
    slugFilter?: string
): Promise<TopicData[]> {
    const sql = buildTopicsQuery(slugFilter)
    const url = `${DATASETTE_URL}?sql=${encodeURIComponent(sql)}`

    console.log("Fetching topics from Datasette...")
    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(
            `Datasette request failed: ${response.status} ${response.statusText}`
        )
    }

    const data = (await response.json()) as DatasetteResponse

    // Check for Datasette-level errors
    if (!data.ok || data.error) {
        throw new Error(
            `Datasette query error: ${data.error || "Unknown error"}`
        )
    }

    // Map rows to TopicData objects
    return data.rows.map(([id, name, slug, excerpt, markdown]) => ({
        id,
        name,
        slug,
        excerpt,
        markdown,
    }))
}

/**
 * Generate embeddings for texts using Workers AI.
 * Supports batch processing.
 */
async function generateEmbeddings(
    ai: Ai,
    texts: string[]
): Promise<number[][]> {
    interface EmbeddingResponse {
        data: number[][]
    }

    const response = (await ai.run(EMBEDDING_MODEL, {
        text: texts,
    })) as EmbeddingResponse

    return response.data
}

/**
 * Upsert vectors to Vectorize with metadata
 */
async function upsertTopicsToVectorize(
    vectorize: Vectorize,
    topics: TopicData[],
    embeddings: number[][]
): Promise<void> {
    const vectors = topics.map((topic, i) => ({
        id: topic.slug, // Use slug as vector ID for easy lookup
        values: embeddings[i],
        metadata: {
            id: topic.id,
            name: topic.name,
            slug: topic.slug,
            excerpt: topic.excerpt || "",
        },
    }))

    await vectorize.upsert(vectors)
}

/**
 * Main handler for the Cloudflare Worker
 */
async function handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Support slug filter via query param
    const slugFilter = url.searchParams.get("slug") || undefined

    try {
        const startTime = Date.now()

        // Step 1: Fetch topics from Datasette
        const topics = await fetchTopicsFromDatasette(slugFilter)

        if (topics.length === 0) {
            return new Response(
                JSON.stringify({
                    error: `No topics found${slugFilter ? ` with slug: ${slugFilter}` : ""}`,
                }),
                {
                    status: 404,
                    headers: { "Content-Type": "application/json" },
                }
            )
        }

        console.log(`Fetched ${topics.length} topics from Datasette`)

        // Step 2: Generate embeddings in batches
        const allEmbeddings: number[][] = []

        for (let i = 0; i < topics.length; i += EMBEDDING_BATCH_SIZE) {
            const batch = topics.slice(i, i + EMBEDDING_BATCH_SIZE)
            const batchTexts = batch.map((t) => t.name)

            console.log(
                `Generating embeddings for batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(topics.length / EMBEDDING_BATCH_SIZE)}...`
            )

            const batchEmbeddings = await generateEmbeddings(env.AI, batchTexts)
            allEmbeddings.push(...batchEmbeddings)
        }

        console.log(`Generated ${allEmbeddings.length} embeddings`)

        // Step 3: Upsert to Vectorize in batches
        for (let i = 0; i < topics.length; i += EMBEDDING_BATCH_SIZE) {
            const batch = topics.slice(i, i + EMBEDDING_BATCH_SIZE)
            const batchEmbeddings = allEmbeddings.slice(
                i,
                i + EMBEDDING_BATCH_SIZE
            )

            console.log(
                `Upserting batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(topics.length / EMBEDDING_BATCH_SIZE)} to Vectorize...`
            )

            await upsertTopicsToVectorize(
                env.VECTORIZE_TOPICS,
                batch,
                batchEmbeddings
            )
        }

        const elapsedTime = Date.now() - startTime

        return new Response(
            JSON.stringify({
                success: true,
                message: `Successfully indexed ${topics.length} topics`,
                topics: topics.map((t) => ({ id: t.id, slug: t.slug })),
                elapsed_ms: elapsedTime,
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        )
    } catch (error) {
        console.error("Error indexing topics:", error)

        return new Response(
            JSON.stringify({
                error: "Failed to index topics",
                details: error instanceof Error ? error.message : String(error),
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        )
    }
}

// Export as ES module worker
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        return handleRequest(request, env)
    },
}
