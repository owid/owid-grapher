// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import fs from "fs/promises"
import * as _ from "lodash-es"
import { parseArgs } from "node:util"
import { runSentryScript } from "../../serverUtils/sentryTracing.js"
import * as db from "../../db/db.js"
import { getScoredChartIndexRecords } from "../algolia/utils/chartIndexRecords.js"
import { TURBOPUFFER_CHARTS_NAMESPACE } from "@ourworldindata/utils"
import {
    CHARTS_SCHEMA,
    ChartRow,
    getTurbopufferClient,
    toChartRow,
} from "./chartsNamespace.js"

// turbopuffer embeds at most 256 rows per write when an attribute has `embed`
const BATCH_SIZE = 256
const VECTOR_BYTES = 1024 * 4 // bge-m3 vectors are billed as f32 on writes
const WRITE_DOLLARS_PER_GB = 2

const USAGE = `Usage: yarn indexChartsToTurbopuffer [options]

Builds the charts index records (charts, explorer views, multi-dim views; no
featured-metric copies) and writes them to the "${TURBOPUFFER_CHARTS_NAMESPACE}" namespace.

Options:
  --dry-run          Build the rows, print stats and write them to tmp/ without uploading
  --from-file <path> Upload rows from an earlier dry run instead of reading the database
  --batches <n>      Upload only the first n batches and skip deleting stale rows
  --namespace <name> Write to another namespace (default ${TURBOPUFFER_CHARTS_NAMESPACE})
`

function describeRows(rows: ChartRow[]): void {
    const popularity = rows.map((r) => r.popularity).sort((a, b) => a - b)
    const payloadBytes = rows.reduce(
        (sum, r) => sum + Buffer.byteLength(JSON.stringify(r)) + VECTOR_BYTES,
        0
    )
    const lines = {
        rows: rows.length,
        byType: _.countBy(rows, "type"),
        uniqueIds: new Set(rows.map((r) => r.id)).size,
        distinctChartKeys: new Set(rows.map((r) => r.chart_key)).size,
        popularityMin: popularity[0],
        popularityP50: popularity[Math.floor(popularity.length * 0.5)],
        popularityP75: popularity[Math.floor(popularity.length * 0.75)],
        popularityP90: popularity[Math.floor(popularity.length * 0.9)],
        popularityMax: popularity.at(-1),
        maxEntities: Math.max(...rows.map((r) => r.availableEntities.length)),
        estimatedWriteMB: (payloadBytes / 1e6).toFixed(1),
        estimatedWriteDollars: (
            (payloadBytes / 1e9) *
            WRITE_DOLLARS_PER_GB
        ).toFixed(3),
    }
    console.log(JSON.stringify(lines, null, 2))
}

async function buildRows(indexedAt: number): Promise<ChartRow[]> {
    const records = await db.knexReadonlyTransaction(
        (trx) => getScoredChartIndexRecords(trx),
        db.TransactionCloseMode.Close
    )
    return records.map((record) => toChartRow(record, indexedAt))
}

async function uploadRows(
    rows: ChartRow[],
    indexedAt: number,
    namespace: string,
    maxBatches: number | undefined
): Promise<void> {
    // With nothing upserted, the stale-row delete below would empty the namespace
    if (rows.length === 0) throw new Error("No rows to upload")
    const ns = getTurbopufferClient().namespace(namespace)
    const batches = _.chunk(rows, BATCH_SIZE).slice(0, maxBatches)
    const totals = { rows: 0, bytes: 0, embeddingTokens: 0 }
    const started = Date.now()
    for (const [i, batch] of batches.entries()) {
        const response = await ns.write({
            upsert_rows: batch,
            schema: CHARTS_SCHEMA,
            distance_metric: "cosine_distance",
        })
        totals.rows += response.rows_affected
        totals.bytes += response.billing.billable_logical_bytes_written
        totals.embeddingTokens += response.performance?.embedding_tokens ?? 0
        console.log(
            `Batch ${i + 1}/${batches.length}: ${response.rows_affected} rows, ` +
                `${response.billing.billable_logical_bytes_written} billable bytes, ` +
                `${response.performance?.embedding_tokens ?? "?"} embedding tokens, ` +
                `${response.performance?.embedding_ms ?? "?"} ms embedding`
        )
    }

    const complete = maxBatches === undefined
    if (complete) {
        // Like Algolia's replaceAllObjects: drop rows a previous run wrote that this run didn't
        const response = await ns.write({
            delete_by_filter: ["indexed_at", "Lt", indexedAt],
        })
        console.log(`Deleted ${response.rows_affected} stale rows`)
    }

    const seconds = ((Date.now() - started) / 1000).toFixed(0)
    console.log(
        `Upserted ${totals.rows} rows in ${seconds} s: ` +
            `${(totals.bytes / 1e6).toFixed(1)} MB billable ` +
            `(~$${((totals.bytes / 1e9) * WRITE_DOLLARS_PER_GB).toFixed(3)}), ` +
            `${totals.embeddingTokens} embedding tokens`
    )
}

const indexChartsToTurbopuffer = async (): Promise<void> => {
    const { values } = parseArgs({
        options: {
            "dry-run": { type: "boolean", default: false },
            "from-file": { type: "string" },
            batches: { type: "string" },
            namespace: {
                type: "string",
                default: TURBOPUFFER_CHARTS_NAMESPACE,
            },
            help: { type: "boolean", default: false },
        },
    })
    if (values.help) {
        console.log(USAGE)
        return
    }

    let rows: ChartRow[]
    const indexedAt = Date.now()
    if (values["from-file"]) {
        const stored: ChartRow[] = JSON.parse(
            await fs.readFile(values["from-file"], "utf8")
        )
        // Restamp so this run's stale-row cleanup can't delete its own rows
        rows = stored.map((row) => ({ ...row, indexed_at: indexedAt }))
    } else {
        const started = Date.now()
        rows = await buildRows(indexedAt)
        console.log(
            `Built ${rows.length} rows in ${((Date.now() - started) / 1000).toFixed(0)} s`
        )
    }
    describeRows(rows)

    if (values["dry-run"]) {
        const output = `tmp/${values.namespace}.json`
        await fs.mkdir("tmp", { recursive: true })
        await fs.writeFile(output, JSON.stringify(rows))
        console.log(`Wrote ${rows.length} rows to ${output}`)
        return
    }

    const maxBatches = values.batches ? Number(values.batches) : undefined
    await uploadRows(rows, indexedAt, values.namespace, maxBatches)
}

void runSentryScript("indexChartsToTurbopuffer", indexChartsToTurbopuffer)
