import * as path from "node:path"
import { OpenAI } from "openai"
import * as db from "../../db/db.js"
import {
    getCandidatePool,
    getSourcePage,
} from "../../db/model/RelatedContent/candidates.js"
import {
    loadEmbeddingsCache,
    writeEmbeddingsCache,
    EmbeddingsCache,
} from "../../db/model/RelatedContent/embeddings.js"
import { DEFAULT_CONFIG } from "../../db/model/RelatedContent/config.js"
import { BASE_DIR, OPENAI_API_KEY } from "../../settings/serverSettings.js"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"

const EMBEDDINGS_PATH = path.join(BASE_DIR, "site/embeddingsCache.json")

const EXPERIMENT_CHART_IDS = [
    488, 230, 486, 5826, 373, 4659, 225, 297, 64, 586, 2028, 2994, 390, 319,
]

const BATCH_SIZE = 100

interface EmbeddingInput {
    url: string
    text: string
}

const getGdocText = async (
    knex: db.KnexReadonlyTransaction,
    slug: string
): Promise<string | null> => {
    const row = await db.knexRawFirst<{
        title: string | null
        subtitle: string | null
        excerpt: string | null
    }>(
        knex,
        `-- sql
        SELECT
            content ->> '$.title' AS title,
            content ->> '$.subtitle' AS subtitle,
            content ->> '$.excerpt' AS excerpt
        FROM posts_gdocs
        WHERE slug = ? AND published = 1
        LIMIT 1
        `,
        [slug]
    )
    if (!row) return null
    return [row.title, row.subtitle, row.excerpt].filter(Boolean).join(". ")
}

const getGrapherText = async (
    knex: db.KnexReadonlyTransaction,
    slug: string
): Promise<string | null> => {
    const row = await db.knexRawFirst<{
        title: string | null
        subtitle: string | null
        note: string | null
    }>(
        knex,
        `-- sql
        SELECT
            cc.full ->> '$.title' AS title,
            cc.full ->> '$.subtitle' AS subtitle,
            cc.full ->> '$.note' AS note
        FROM chart_configs cc
        JOIN charts c ON c.configId = cc.id
        WHERE cc.slug = ? AND c.publishedAt IS NOT NULL
        LIMIT 1
        `,
        [slug]
    )
    if (!row) return null
    return [row.title, row.subtitle, row.note].filter(Boolean).join(". ")
}

const buildText = async (
    knex: db.KnexReadonlyTransaction,
    url: string,
    fallbackTitle: string
): Promise<string> => {
    const u = new URL(url)
    const parts = u.pathname.split("/").filter(Boolean)
    let text: string | null = null
    if (parts[0] === "grapher" && parts[1]) {
        text = await getGrapherText(knex, parts[1])
    } else if (parts[0] === "data-insights" && parts[1]) {
        text = await getGdocText(knex, parts[1])
    } else if (parts[0]) {
        text = await getGdocText(knex, parts[parts.length - 1])
    }
    return text ?? fallbackTitle
}

const collectInputs = async (
    knex: db.KnexReadonlyTransaction
): Promise<EmbeddingInput[]> => {
    const seen = new Map<string, string>()
    for (const chartId of EXPERIMENT_CHART_IDS) {
        const source = await getSourcePage(knex, chartId)
        seen.set(source.url, source.title)
        const pool = await getCandidatePool(knex, source)
        for (const cand of pool) {
            if (!seen.has(cand.url)) seen.set(cand.url, cand.title)
        }
    }
    const inputs: EmbeddingInput[] = []
    for (const [url, fallbackTitle] of seen.entries()) {
        const text = await buildText(knex, url, fallbackTitle)
        if (text.trim().length === 0) continue
        inputs.push({ url, text })
    }
    return inputs
}

const embedBatch = async (
    openai: OpenAI,
    model: string,
    inputs: EmbeddingInput[]
): Promise<Map<string, number[]>> => {
    const result = await openai.embeddings.create({
        model,
        input: inputs.map((i) => i.text),
    })
    const out = new Map<string, number[]>()
    result.data.forEach((d, i) => {
        out.set(inputs[i].url, d.embedding)
    })
    return out
}

const main = async (): Promise<void> => {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured")
    if (!BAKED_BASE_URL) throw new Error("BAKED_BASE_URL is not configured")

    const force = process.argv.includes("--force")
    const cache: EmbeddingsCache = force
        ? new Map()
        : loadEmbeddingsCache(EMBEDDINGS_PATH)

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

    await db.knexReadonlyTransaction(async (knex) => {
        const inputs = await collectInputs(knex)
        const todo = inputs.filter((i) => !cache.has(i.url))
        console.log(
            `Total candidates: ${inputs.length}; need embedding: ${todo.length}; cached: ${inputs.length - todo.length}`
        )
        if (todo.length === 0) return

        let embedded = 0
        for (let i = 0; i < todo.length; i += BATCH_SIZE) {
            const batch = todo.slice(i, i + BATCH_SIZE)
            const out = await embedBatch(
                openai,
                DEFAULT_CONFIG.embeddingModel,
                batch
            )
            for (const [url, vec] of out.entries()) cache.set(url, vec)
            embedded += batch.length
            console.log(`Embedded ${embedded}/${todo.length}`)
        }

        writeEmbeddingsCache(EMBEDDINGS_PATH, cache)
        console.log(`Wrote ${cache.size} embeddings to ${EMBEDDINGS_PATH}`)
    }, db.TransactionCloseMode.Close)
}

void main().catch((err) => {
    console.error(err)
    process.exitCode = 1
})
