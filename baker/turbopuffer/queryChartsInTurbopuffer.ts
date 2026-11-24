import { parseArgs } from "node:util"
import type { Row } from "@turbopuffer/turbopuffer"
import {
    DEFAULT_POPULARITY_MIDPOINT,
    isTurbopufferArm,
    queryTurbopufferCharts,
    TURBOPUFFER_ARMS,
    TURBOPUFFER_CHARTS_NAMESPACE,
} from "@ourworldindata/utils"
import { TURBOPUFFER_API_KEY } from "../../settings/serverSettings.js"
import { getTurbopufferClient } from "./chartsNamespace.js"

const DEFAULT_QUERIES = [
    "co2",
    "life expectancy",
    "gdp per capita",
    "poulation", // typo
]

const USAGE = `Usage: yarn queryChartsInTurbopuffer [options] [query ...]

Runs each query through the first-stage arms against "${TURBOPUFFER_CHARTS_NAMESPACE}"
and prints the top hits with turbopuffer's timings and billing.
Default queries: ${DEFAULT_QUERIES.join(", ")}

Options:
  --arms <list>      Comma-separated arms (default ${TURBOPUFFER_ARMS.join(",")})
                     T0 BM25; T1 + popularity; T2 + fuzzy; T3 T1 + vector, RRF
  --midpoint <n>     Saturate midpoint for popularity (default ${DEFAULT_POPULARITY_MIDPOINT})
  --top <n>          Hits to print per arm (default 5)
  --check            Run the post-load checks instead of queries
  --namespace <name> Query another namespace
`

function formatHit(row: Row): string {
    const variant = row.variantName ? ` [${String(row.variantName)}]` : ""
    const dist = typeof row.$dist === "number" ? row.$dist.toFixed(3) : "-"
    return `${String(row.type).padEnd(12)} ${dist.padStart(7)}  ${String(row.title)}${variant}  (${String(row.chart_key)}, popularity ${String(row.popularity)})`
}

async function postLoadChecks(namespace: string): Promise<void> {
    const ns = getTurbopufferClient().namespace(namespace)
    const metadata = await ns.metadata()
    console.log(
        `Rows: ${metadata.approx_row_count}, logical bytes: ${metadata.approx_logical_bytes}, index: ${JSON.stringify(metadata.index)}`
    )
    const count = await ns.query({ aggregate_by: { rows: ["Count"] } })
    const rows = Number(count.aggregations?.rows)
    console.log(`Counted rows: ${rows}`)
    const median = await ns.query({
        rank_by: ["popularity", "asc"],
        offset: Math.floor(rows / 2),
        limit: 1,
        include_attributes: ["popularity"],
    })
    console.log(`Median popularity: ${String(median.rows?.[0]?.popularity)}`)
    const bm25 = await ns.query({
        rank_by: ["title", "BM25", "gdp per capita"],
        limit: 3,
        include_attributes: ["chart_key", "title"],
    })
    console.log("Title BM25 for 'gdp per capita':")
    for (const row of bm25.rows ?? [])
        console.log(`  ${String(row.title)} (${String(row.chart_key)})`)
}

const main = async (): Promise<void> => {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            arms: { type: "string", default: TURBOPUFFER_ARMS.join(",") },
            midpoint: { type: "string" },
            top: { type: "string", default: "5" },
            check: { type: "boolean", default: false },
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
    const namespace = values.namespace
    if (values.check) {
        await postLoadChecks(namespace)
        return
    }

    const arms = values.arms.split(",")
    if (!arms.every(isTurbopufferArm))
        throw new Error(
            `Unknown arm in "${values.arms}"; valid arms: ${TURBOPUFFER_ARMS.join(", ")}`
        )
    const popularityMidpoint = values.midpoint
        ? Number(values.midpoint)
        : undefined
    const queries = positionals.length ? positionals : DEFAULT_QUERIES
    const top = Number(values.top)
    let bytesQueried = 0
    let queriesRun = 0

    for (const query of queries) {
        console.log(`=== ${query}`)
        for (const arm of arms) {
            const started = performance.now()
            const result = await queryTurbopufferCharts(
                TURBOPUFFER_API_KEY,
                { query, arm, popularityMidpoint },
                namespace
            )
            const clientMs = performance.now() - started
            const { performance: perf } = result
            bytesQueried += result.billing.billable_logical_bytes_queried
            queriesRun++
            console.log(
                `  ${arm}: ${result.rows.length} hits, server ${perf.server_total_ms} ms` +
                    (perf.embedding_ms
                        ? `, embedding ${perf.embedding_ms} ms`
                        : "") +
                    `, client ${clientMs.toFixed(0)} ms, cache ${perf.cache_temperature}`
            )
            for (const row of result.rows.slice(0, top))
                console.log(`      ${formatHit(row)}`)
        }
        console.log()
    }
    console.log(
        `${queriesRun} queries, ${(bytesQueried / 1e9).toFixed(2)} GB billable data queried`
    )
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
