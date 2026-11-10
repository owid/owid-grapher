// Experimental: embeds the search records for the vector candidates of
// /api/search (functions/api/search/vectorCandidates.ts).
//
// It builds the same records the Algolia indexers do, embeds each with
// Workers AI and writes one NDJSON file per index, in the format
// `vectorize insert` reads. A vector's id is the record's Algolia objectID, so
// the search function can fetch a vector hit from Algolia.
//
//   yarn tsx --tsconfig tsconfig.tsx.json baker/vectorize/buildSearchEmbeddings.ts
//   cf vectorize upsert <index> --file tmp/search-embeddings-charts.ndjson
//   cf vectorize upsert <index> --file tmp/search-embeddings-pages.ndjson
//
// Embedding needs CLOUDFLARE_ACCOUNT_ID and a CLOUDFLARE_API_TOKEN that can
// run Workers AI; writing to the index needs Vectorize Write, which the
// dev and staging tokens deliberately lack.

import fs from "fs/promises"
import * as db from "../../db/db.js"
import {
    SEARCH_EMBEDDING_MODEL,
    VECTOR_NAMESPACES,
} from "@ourworldindata/utils"
import { getExplorerViewRecords } from "../algolia/utils/explorerViews.js"
import { getChartsRecords } from "../algolia/utils/charts.js"
import { getMultiDimViewRecords } from "../algolia/utils/mdimViews.js"
import { createBaseIndexingContext } from "../algolia/utils/context.js"
import { getPagesRecords } from "../algolia/utils/pages.js"

/** Records per Workers AI call */
const BATCH_SIZE = 50
/** Calls in flight at once */
const CONCURRENCY = 4
/** Vectorize's limit on a vector id */
const MAX_ID_BYTES = 64
/** Enough of a passage to say what it is about; the model reads ~8k tokens */
const MAX_TEXT_LENGTH = 4000

interface Embeddable {
    id: string
    type: string
    text: string
}

const joinText = (parts: (string | undefined)[]): string =>
    parts
        .filter((part) => part?.trim())
        .join("\n")
        .slice(0, MAX_TEXT_LENGTH)

async function embed(texts: string[]): Promise<number[][]> {
    const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN)
        throw new Error("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN")
    const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${SEARCH_EMBEDDING_MODEL}`
    for (let attempt = 1; ; attempt++) {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: texts }),
        })
        if (response.ok) {
            const json = (await response.json()) as {
                result: { data: number[][] }
            }
            return json.result.data
        }
        if (attempt === 5)
            throw new Error(
                `Workers AI answered ${response.status}: ${await response.text()}`
            )
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000))
    }
}

async function writeEmbeddings(
    namespace: string,
    records: Embeddable[]
): Promise<void> {
    const usable = records.filter((record) => {
        const fits = Buffer.byteLength(record.id) <= MAX_ID_BYTES
        if (!fits) console.warn(`Skipping ${record.id}: id too long`)
        return fits && record.text
    })
    const batches: Embeddable[][] = []
    for (let i = 0; i < usable.length; i += BATCH_SIZE)
        batches.push(usable.slice(i, i + BATCH_SIZE))

    const lines: string[] = []
    let next = 0
    const worker = async (): Promise<void> => {
        while (next < batches.length) {
            const batch = batches[next++]
            const vectors = await embed(batch.map((record) => record.text))
            batch.forEach((record, i) =>
                lines.push(
                    JSON.stringify({
                        id: record.id,
                        namespace,
                        // 5 decimals is past the model's own precision
                        values: vectors[i].map((v) => Number(v.toFixed(5))),
                        metadata: { type: record.type },
                    })
                )
            )
            if (next % 20 === 0)
                console.log(`${namespace}: ${lines.length}/${usable.length}`)
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))

    const path = `tmp/search-embeddings-${namespace}.ndjson`
    await fs.mkdir("tmp", { recursive: true })
    await fs.writeFile(path, lines.join("\n") + "\n")
    console.log(`Wrote ${lines.length} vectors to ${path}`)
}

const buildSearchEmbeddings = async (): Promise<void> => {
    const { charts, pages } = await db.knexReadonlyTransaction(async (trx) => {
        const baseContext = await createBaseIndexingContext(trx)
        const charts = [
            ...(await getExplorerViewRecords(trx, {
                skipGrapherViews: true,
                baseContext,
            })),
            ...(await getMultiDimViewRecords(trx, { baseContext })),
            ...(await getChartsRecords(trx, { baseContext })),
        ]
        const pages = await getPagesRecords(trx)
        return { charts, pages }
    }, db.TransactionCloseMode.Close)

    await writeEmbeddings(
        VECTOR_NAMESPACES.charts,
        charts.map((record) => ({
            id: record.objectID,
            type: record.type,
            text: joinText([
                record.title,
                record.variantName,
                record.subtitle,
                record.tags?.join(", "),
            ]),
        }))
    )
    await writeEmbeddings(
        VECTOR_NAMESPACES.pages,
        pages.map((record) => ({
            id: record.objectID,
            type: record.type,
            text: joinText([record.title, record.content]),
        }))
    )
}

void buildSearchEmbeddings().then(() => process.exit(0))
