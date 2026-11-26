// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import fs from "fs/promises"
import * as _ from "lodash-es"
import { parseArgs } from "node:util"
import { runSentryScript } from "../../serverUtils/sentryTracing.js"
import * as db from "../../db/db.js"
import { getScoredChartIndexRecords } from "../algolia/utils/chartIndexRecords.js"
import { getPagesRecords } from "../algolia/utils/pages.js"
import {
    isTurbopufferRegion,
    TURBOPUFFER_INDEXES,
    TURBOPUFFER_REGIONS,
    type TurbopufferIndex,
    type TurbopufferIndexName,
    type TurbopufferRegion,
} from "@ourworldindata/utils"
import type { AttributeSchema } from "@turbopuffer/turbopuffer"
import {
    CHARTS_SCHEMA,
    getTurbopufferClient,
    IndexRow,
    PAGES_SCHEMA,
    toChartRow,
    toPageRow,
} from "./namespaces.js"

// turbopuffer embeds at most 256 rows per write when an attribute has `embed`
const BATCH_SIZE = 256
const VECTOR_BYTES = 1024 * 4 // bge-m3 vectors are billed as f32 on writes
const WRITE_DOLLARS_PER_GB = 2

interface IndexSource {
    index: TurbopufferIndex
    schema: Record<string, AttributeSchema>
    /** Reads the index's records from the database as rows */
    buildRows: (
        trx: db.KnexReadonlyTransaction,
        indexedAt: number
    ) => Promise<IndexRow[]>
}

const INDEXES: Record<TurbopufferIndexName, IndexSource> = {
    // Charts, explorer views and multi-dim views, without featured-metric copies
    charts: {
        index: TURBOPUFFER_INDEXES.charts,
        schema: CHARTS_SCHEMA,
        buildRows: async (trx, indexedAt) =>
            (await getScoredChartIndexRecords(trx)).map((record) =>
                toChartRow(record, indexedAt)
            ),
    },
    // The Algolia pages index's records: one per content chunk of each page
    pages: {
        index: TURBOPUFFER_INDEXES.pages,
        schema: PAGES_SCHEMA,
        buildRows: async (trx, indexedAt) =>
            (await getPagesRecords(trx)).map((record) =>
                toPageRow(record, indexedAt)
            ),
    },
}

const USAGE = `Usage: yarn indexToTurbopuffer --index <charts|pages> [options]

Builds an index's records, the same ones the Algolia index gets, and writes
them to its turbopuffer namespace in every region (${TURBOPUFFER_REGIONS.join(", ")}).

Options:
  --index <name>     charts (charts, explorer views, multi-dim views; no
                     featured-metric copies) or pages (articles, data insights,
                     topic, about and profile pages, one row per content chunk)
  --dry-run          Build the rows, print stats and write them to tmp/ without uploading
  --from-file <path> Upload rows from an earlier dry run instead of reading the database
  --batches <n>      Upload only the first n batches and skip deleting stale rows
  --regions <list>   Comma-separated regions to write (default: all)
  --namespace <name> Write to another namespace
`

const percentile = (sorted: number[], p: number): number | undefined =>
    sorted[Math.floor(sorted.length * p)]

function describeRows(rows: IndexRow[], distinctBy: string): void {
    const popularity = rows.map((r) => r.popularity).sort((a, b) => a - b)
    const payloadBytes = rows.reduce(
        (sum, r) => sum + Buffer.byteLength(JSON.stringify(r)) + VECTOR_BYTES,
        0
    )
    const lines = {
        rows: rows.length,
        byType: _.countBy(rows, "type"),
        uniqueIds: new Set(rows.map((r) => r.id)).size,
        [`distinct ${distinctBy}`]: new Set(
            rows.map((r) => (r as Record<string, unknown>)[distinctBy])
        ).size,
        popularityP50: percentile(popularity, 0.5),
        popularityP75: percentile(popularity, 0.75),
        popularityP90: percentile(popularity, 0.9),
        popularityMax: popularity.at(-1),
        estimatedWriteMBPerRegion: (payloadBytes / 1e6).toFixed(1),
        estimatedWriteDollarsPerRegion: (
            (payloadBytes / 1e9) *
            WRITE_DOLLARS_PER_GB
        ).toFixed(3),
    }
    console.log(JSON.stringify(lines, null, 2))
}

async function uploadRows(
    schema: Record<string, AttributeSchema>,
    rows: IndexRow[],
    indexedAt: number,
    namespace: string,
    region: TurbopufferRegion,
    maxBatches: number | undefined
): Promise<void> {
    // With nothing upserted, the stale-row delete below would empty the namespace
    if (rows.length === 0) throw new Error("No rows to upload")
    const ns = getTurbopufferClient(region).namespace(namespace)
    const batches = _.chunk(rows, BATCH_SIZE).slice(0, maxBatches)
    const totals = { rows: 0, bytes: 0, embeddingTokens: 0 }
    const started = Date.now()
    for (const [i, batch] of batches.entries()) {
        const response = await ns.write({
            upsert_rows: batch,
            schema,
            distance_metric: "cosine_distance",
        })
        totals.rows += response.rows_affected
        totals.bytes += response.billing.billable_logical_bytes_written
        totals.embeddingTokens += response.performance?.embedding_tokens ?? 0
        console.log(
            `${region} batch ${i + 1}/${batches.length}: ${response.rows_affected} rows, ` +
                `${response.billing.billable_logical_bytes_written} billable bytes, ` +
                `${response.performance?.embedding_tokens ?? "?"} embedding tokens`
        )
    }

    const complete = maxBatches === undefined
    if (complete) {
        // Like Algolia's replaceAllObjects: drop rows a previous run wrote that this run didn't
        const response = await ns.write({
            delete_by_filter: ["indexed_at", "Lt", indexedAt],
        })
        console.log(`${region}: deleted ${response.rows_affected} stale rows`)
    }

    const seconds = ((Date.now() - started) / 1000).toFixed(0)
    console.log(
        `${region}: upserted ${totals.rows} rows to ${namespace} in ${seconds} s: ` +
            `${(totals.bytes / 1e6).toFixed(1)} MB billable ` +
            `(~$${((totals.bytes / 1e9) * WRITE_DOLLARS_PER_GB).toFixed(3)}), ` +
            `${totals.embeddingTokens} embedding tokens`
    )
}

const indexToTurbopuffer = async (): Promise<void> => {
    const { values } = parseArgs({
        options: {
            index: { type: "string" },
            "dry-run": { type: "boolean", default: false },
            "from-file": { type: "string" },
            batches: { type: "string" },
            regions: { type: "string", default: TURBOPUFFER_REGIONS.join(",") },
            namespace: { type: "string" },
            help: { type: "boolean", default: false },
        },
    })
    if (values.help) {
        console.log(USAGE)
        return
    }
    if (!values.index || !Object.hasOwn(INDEXES, values.index))
        throw new Error(`--index must be one of: ${Object.keys(INDEXES)}`)
    const source = INDEXES[values.index as TurbopufferIndexName]
    const namespace = values.namespace ?? source.index.namespace
    const regions = values.regions.split(",")
    if (!regions.every(isTurbopufferRegion))
        throw new Error(
            `Unknown region in "${values.regions}"; valid regions: ${TURBOPUFFER_REGIONS.join(", ")}`
        )

    let rows: IndexRow[]
    const indexedAt = Date.now()
    if (values["from-file"]) {
        const stored: IndexRow[] = JSON.parse(
            await fs.readFile(values["from-file"], "utf8")
        )
        // Restamp so this run's stale-row cleanup can't delete its own rows
        rows = stored.map((row) => ({ ...row, indexed_at: indexedAt }))
    } else {
        const started = Date.now()
        rows = await db.knexReadonlyTransaction(
            (trx) => source.buildRows(trx, indexedAt),
            db.TransactionCloseMode.Close
        )
        console.log(
            `Built ${rows.length} rows in ${((Date.now() - started) / 1000).toFixed(0)} s`
        )
    }
    describeRows(rows, source.index.distinctBy)

    if (values["dry-run"]) {
        const output = `tmp/${namespace}.json`
        await fs.mkdir("tmp", { recursive: true })
        await fs.writeFile(output, JSON.stringify(rows))
        console.log(`Wrote ${rows.length} rows to ${output}`)
        return
    }

    const maxBatches = values.batches ? Number(values.batches) : undefined
    for (const region of regions)
        await uploadRows(
            source.schema,
            rows,
            indexedAt,
            namespace,
            region,
            maxBatches
        )
}

void runSentryScript("indexToTurbopuffer", indexToTurbopuffer)
