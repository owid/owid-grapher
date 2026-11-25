import { parseArgs } from "node:util"
import type { Row } from "@turbopuffer/turbopuffer"
import {
    isTurbopufferArm,
    isTurbopufferRegion,
    queryTurbopuffer,
    DEFAULT_TURBOPUFFER_REGION,
    TURBOPUFFER_ARMS,
    TURBOPUFFER_INDEXES,
    TURBOPUFFER_REGIONS,
    type TurbopufferIndex,
    type TurbopufferRegion,
    type TurbopufferIndexName,
} from "@ourworldindata/utils"
import { TURBOPUFFER_API_KEY } from "../../settings/serverSettings.js"
import { getTurbopufferClient } from "./namespaces.js"

const DEFAULT_QUERIES = [
    "co2",
    "life expectancy",
    "gdp per capita",
    "poulation", // typo
]

const USAGE = `Usage: yarn queryTurbopuffer [options] [query ...]

Runs each query through the arms against an index's namespace
and prints the top hits with turbopuffer's timings and billing.
Default queries: ${DEFAULT_QUERIES.join(", ")}

Options:
  --arms <list>      Comma-separated arms (default ${TURBOPUFFER_ARMS.join(",")})
                     T0 BM25; T1 + popularity; T2 + fuzzy; T3 T1 + vector, RRF;
                     T4 T3's candidates reranked by a model
  --index <name>     charts (default) or pages
  --region <region>  ${TURBOPUFFER_REGIONS.join(" or ")} (default ${DEFAULT_TURBOPUFFER_REGION})
  --midpoint <n>     Saturate midpoint for popularity (default: the index's)
  --top <n>          Hits to print per arm (default 5)
  --check            Run the post-load checks instead of queries
  --namespace <name> Query another namespace
`

function formatHit(row: Row, index: TurbopufferIndex): string {
    const variant = row.variantName ? ` [${String(row.variantName)}]` : ""
    const dist = typeof row.$dist === "number" ? row.$dist.toFixed(3) : "-"
    return `${String(row.type).padEnd(12)} ${dist.padStart(7)}  ${String(row.title)}${variant}  (${String(row[index.distinctBy])}, popularity ${String(row.popularity)})`
}

async function postLoadChecks(
    index: TurbopufferIndex,
    region: TurbopufferRegion
): Promise<void> {
    const ns = getTurbopufferClient(region).namespace(index.namespace)
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
        include_attributes: [index.distinctBy, "title"],
    })
    console.log("Title BM25 for 'gdp per capita':")
    for (const row of bm25.rows ?? [])
        console.log(`  ${String(row.title)} (${String(row[index.distinctBy])})`)
}

const main = async (): Promise<void> => {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            arms: { type: "string", default: TURBOPUFFER_ARMS.join(",") },
            midpoint: { type: "string" },
            top: { type: "string", default: "5" },
            check: { type: "boolean", default: false },
            index: { type: "string", default: "charts" },
            region: { type: "string", default: DEFAULT_TURBOPUFFER_REGION },
            namespace: { type: "string" },
            help: { type: "boolean", default: false },
        },
    })
    if (values.help) {
        console.log(USAGE)
        return
    }
    if (!Object.hasOwn(TURBOPUFFER_INDEXES, values.index))
        throw new Error(
            `--index must be one of: ${Object.keys(TURBOPUFFER_INDEXES)}`
        )
    const baseIndex = TURBOPUFFER_INDEXES[values.index as TurbopufferIndexName]
    const index = values.namespace
        ? { ...baseIndex, namespace: values.namespace }
        : baseIndex
    const region = values.region
    if (!isTurbopufferRegion(region))
        throw new Error(`--region must be one of: ${TURBOPUFFER_REGIONS}`)
    if (values.check) {
        await postLoadChecks(index, region)
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
            const result = await queryTurbopuffer(
                TURBOPUFFER_API_KEY,
                index,
                { query, arm, popularityMidpoint },
                region
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
                console.log(`      ${formatHit(row, index)}`)
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
