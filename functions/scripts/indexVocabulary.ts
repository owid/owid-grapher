/**
 * Cloudflare Worker script to index vocabulary keywords into Vectorize.
 *
 * This script:
 * 1. Loads vocabulary data from topic_vocabulary.json
 * 2. Generates embeddings using Workers AI
 * 3. Upserts vectors with metadata to Vectorize
 *
 * Usage:
 *   wrangler dev --remote functions/scripts/indexVocabulary.ts
 *   # or deploy and invoke via HTTP:
 *   wrangler deploy functions/scripts/indexVocabulary.ts --name index-vocabulary
 *   curl "https://index-vocabulary.<subdomain>.workers.dev"
 */

import { Env } from "../_common/env.js"
import vocabularyData from "./topic_vocabulary.json"

interface TopicVocabulary {
    topic_slug: string
    topic_name: string
    keywords: string[]
    stats: {
        num_charts_texts: number
        num_keywords: number
        input_tokens: number
        output_tokens: number
        total_cost_usd: number
    }
}

interface VocabularyData {
    [topicSlug: string]: TopicVocabulary
}

interface KeywordMetadata {
    keyword: string
    topic_slug: string
    topic_name: string
    normalized: string
}

const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5"
const EMBEDDING_BATCH_SIZE = 100

// Load real vocabulary data from JSON file
const VOCABULARY_DATA = vocabularyData as VocabularyData

/**
 * Normalize a keyword for consistent matching
 */
function normalizeKeyword(keyword: string): string {
    return keyword.toLowerCase().trim()
}

/**
 * Generate a unique ID from topic and keyword for use as vector ID
 * Vectorize has a 64-byte limit, so we hash to ensure short IDs
 * Format: {topic_slug_prefix}-{hash}
 */
function generateVectorId(topicSlug: string, keyword: string): string {
    // Generate hash from the full combined string for uniqueness
    const combined = `${topicSlug}::${keyword}`
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
        hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0
    }
    // Convert to positive hex string
    const hashStr = (hash >>> 0).toString(16).padStart(8, "0")

    // Use first 50 chars of topic slug (leaving room for hash and separator)
    // Format: {topic-slug-prefix}-{hash} (max 50 + 1 + 8 = 59 bytes)
    const topicPrefix = topicSlug.slice(0, 50)
    return `${topicPrefix}-${hashStr}`
}

/**
 * Generate embeddings for keywords using Workers AI
 */
async function generateEmbeddings(
    ai: Ai,
    keywords: string[]
): Promise<number[][]> {
    interface EmbeddingResponse {
        data: number[][]
    }

    const response = (await ai.run(EMBEDDING_MODEL, {
        text: keywords,
    })) as EmbeddingResponse

    return response.data
}

/**
 * Upsert keywords to Vectorize with metadata
 */
async function upsertKeywordsToVectorize(
    vectorize: Vectorize,
    keywords: Array<{ keyword: string; topic_slug: string; topic_name: string }>,
    embeddings: number[][]
): Promise<void> {
    const vectors = keywords.map((item, i) => ({
        id: generateVectorId(item.topic_slug, item.keyword),
        values: embeddings[i],
        metadata: {
            keyword: item.keyword,
            topic_slug: item.topic_slug,
            topic_name: item.topic_name,
            normalized: normalizeKeyword(item.keyword),
        },
    }))

    console.log(`Upserting ${vectors.length} vectors. First ID: ${vectors[0]?.id}, embedding length: ${vectors[0]?.values.length}`)

    const result = await vectorize.upsert(vectors)
    console.log(`Upsert result:`, result)
}

/**
 * Main handler for the Cloudflare Worker
 */
async function handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Support topic filter via query param
    const topicFilter = url.searchParams.get("topic") || undefined

    try {
        const startTime = Date.now()

        // Filter vocabulary by topic if specified
        const filteredVocabulary = topicFilter
            ? Object.fromEntries(
                  Object.entries(VOCABULARY_DATA).filter(
                      ([slug]) => slug === topicFilter
                  )
              )
            : VOCABULARY_DATA

        // Flatten vocabulary into keyword-topic pairs
        const keywordPairs: Array<{
            keyword: string
            topic_slug: string
            topic_name: string
        }> = []
        for (const [topicSlug, topicData] of Object.entries(
            filteredVocabulary
        )) {
            for (const keyword of topicData.keywords) {
                keywordPairs.push({
                    keyword,
                    topic_slug: topicSlug,
                    topic_name: topicData.topic_name,
                })
            }
        }

        if (keywordPairs.length === 0) {
            return new Response(
                JSON.stringify({
                    error: `No keywords found${topicFilter ? ` for topic: ${topicFilter}` : ""}`,
                }),
                {
                    status: 404,
                    headers: { "Content-Type": "application/json" },
                }
            )
        }

        console.log(
            `Indexing ${keywordPairs.length} keywords across ${Object.keys(filteredVocabulary).length} topics`
        )

        // Generate embeddings in batches
        const allEmbeddings: number[][] = []

        for (let i = 0; i < keywordPairs.length; i += EMBEDDING_BATCH_SIZE) {
            const batch = keywordPairs.slice(i, i + EMBEDDING_BATCH_SIZE)
            const batchKeywords = batch.map((kp) => kp.keyword)

            console.log(
                `Generating embeddings for batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(keywordPairs.length / EMBEDDING_BATCH_SIZE)}...`
            )

            const batchEmbeddings = await generateEmbeddings(
                env.AI,
                batchKeywords
            )
            allEmbeddings.push(...batchEmbeddings)
        }

        console.log(`Generated ${allEmbeddings.length} embeddings`)

        // Upsert to Vectorize in batches (same as topics indexing)
        for (let i = 0; i < keywordPairs.length; i += EMBEDDING_BATCH_SIZE) {
            const batch = keywordPairs.slice(i, i + EMBEDDING_BATCH_SIZE)
            const batchEmbeddings = allEmbeddings.slice(
                i,
                i + EMBEDDING_BATCH_SIZE
            )

            console.log(
                `Upserting batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(keywordPairs.length / EMBEDDING_BATCH_SIZE)} to Vectorize...`
            )

            await upsertKeywordsToVectorize(
                env.VECTORIZE_VOCABULARY,
                batch,
                batchEmbeddings
            )
        }

        const elapsedTime = Date.now() - startTime

        return new Response(
            JSON.stringify({
                success: true,
                message: `Successfully indexed ${keywordPairs.length} keywords`,
                topics: Object.keys(filteredVocabulary),
                keywords_per_topic: Object.fromEntries(
                    Object.entries(filteredVocabulary).map(
                        ([slug, data]) => [slug, data.keywords.length]
                    )
                ),
                elapsed_ms: elapsedTime,
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        )
    } catch (error) {
        console.error("Error indexing vocabulary:", error)

        return new Response(
            JSON.stringify({
                error: "Failed to index vocabulary",
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
