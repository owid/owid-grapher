// Round-trip fidelity report for the rich editor's serialization layer.
//
// Reads a JSONL file of published gdoc bodies ({id, slug, type, body} per
// line), converts each body enriched → ProseMirror → enriched, validates the
// intermediate document against the editor schema, and reports pass rates per
// document type. This is the M0 exit criterion check: 100% of data insights
// and ≥95% of all published docs must round-trip.
//
// Usage: yarn tsx --tsconfig tsconfig.tsx.json devTools/richEditor/roundtripReport.ts <bodies.jsonl> [--verbose]

import fs from "fs"
import readline from "readline"
import { getSchema } from "@tiptap/core"
import { Node as PmNode } from "@tiptap/pm/model"
import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { getRichEditorBaseExtensions } from "../../adminShared/richEditor/extensions.js"
import {
    enrichedBlocksToPmDoc,
    pmDocToEnrichedBlocks,
} from "../../adminShared/richEditor/serialization/serialization.js"
import {
    enrichedBodiesMatch,
    normalizedBodyKey,
} from "../../adminShared/richEditor/serialization/normalizeForComparison.js"

interface GdocBodyRecord {
    id: string
    slug: string
    type: string
    body: OwidEnrichedGdocBlock[]
}

interface Failure {
    id: string
    slug: string
    type: string
    stage: "convert" | "schema" | "compare"
    detail: string
}

function firstDifference(a: string, b: string): string {
    const max = Math.min(a.length, b.length)
    for (let i = 0; i < max; i++) {
        if (a[i] !== b[i]) {
            const from = Math.max(0, i - 80)
            return `...${a.slice(from, i + 120)}\n            vs\n...${b.slice(from, i + 120)}`
        }
    }
    return `length differs: ${a.length} vs ${b.length}`
}

async function main(): Promise<void> {
    const [path, ...flags] = process.argv.slice(2)
    if (!path) {
        console.error(
            "Usage: roundtripReport.ts <bodies.jsonl> [--verbose] [--max-failures N]"
        )
        process.exit(1)
    }
    const verbose = flags.includes("--verbose")
    const maxFailuresIdx = flags.indexOf("--max-failures")
    const maxFailures =
        maxFailuresIdx >= 0 ? Number(flags[maxFailuresIdx + 1]) : 10

    const schema = getSchema(getRichEditorBaseExtensions())

    const totals = new Map<string, { total: number; passed: number }>()
    const failures: Failure[] = []

    const rl = readline.createInterface({
        input: fs.createReadStream(path),
        crlfDelay: Infinity,
    })

    for await (const line of rl) {
        if (!line.trim()) continue
        const record = JSON.parse(line) as GdocBodyRecord
        const body = record.body ?? []
        const bucket = totals.get(record.type) ?? { total: 0, passed: 0 }
        bucket.total += 1
        totals.set(record.type, bucket)

        let failure: Failure | undefined
        try {
            const pmDoc = enrichedBlocksToPmDoc(body)
            try {
                PmNode.fromJSON(schema, pmDoc).check()
            } catch (schemaError) {
                failure = {
                    id: record.id,
                    slug: record.slug,
                    type: record.type,
                    stage: "schema",
                    detail: String(schemaError),
                }
            }
            if (!failure) {
                const result = pmDocToEnrichedBlocks(pmDoc)
                if (!enrichedBodiesMatch(body, result)) {
                    failure = {
                        id: record.id,
                        slug: record.slug,
                        type: record.type,
                        stage: "compare",
                        detail: firstDifference(
                            normalizedBodyKey(body),
                            normalizedBodyKey(result)
                        ),
                    }
                }
            }
        } catch (error) {
            failure = {
                id: record.id,
                slug: record.slug,
                type: record.type,
                stage: "convert",
                detail: String(error),
            }
        }

        if (failure) failures.push(failure)
        else bucket.passed += 1
    }

    let grandTotal = 0
    let grandPassed = 0
    console.log("\nRound-trip report (published docs)")
    console.log("----------------------------------")
    const sorted = [...totals.entries()].sort((a, b) => b[1].total - a[1].total)
    for (const [type, { total, passed }] of sorted) {
        grandTotal += total
        grandPassed += passed
        const pct = ((passed / total) * 100).toFixed(1)
        console.log(
            `${type.padEnd(20)} ${String(passed).padStart(5)} / ${String(total).padEnd(5)} ${pct}%`
        )
    }
    const grandPct = ((grandPassed / grandTotal) * 100).toFixed(2)
    console.log("----------------------------------")
    console.log(
        `TOTAL                ${String(grandPassed).padStart(5)} / ${String(grandTotal).padEnd(5)} ${grandPct}%`
    )

    if (failures.length > 0) {
        console.log(`\n${failures.length} failures`)
        const byStage = new Map<string, number>()
        for (const f of failures) {
            byStage.set(f.stage, (byStage.get(f.stage) ?? 0) + 1)
        }
        console.log(
            [...byStage.entries()]
                .map(([stage, n]) => `${stage}: ${n}`)
                .join(", ")
        )
        for (const f of failures.slice(
            0,
            verbose ? failures.length : maxFailures
        )) {
            console.log(
                `\n[${f.stage}] ${f.type} ${f.slug} (${f.id})\n    ${f.detail.split("\n").join("\n    ")}`
            )
        }
    }

    const dataInsights = totals.get("data-insight")
    const diOk = !dataInsights || dataInsights.passed === dataInsights.total
    const overallOk = grandPassed / grandTotal >= 0.95
    console.log(
        `\nExit criteria: data insights 100%: ${diOk ? "PASS" : "FAIL"} · overall ≥95%: ${overallOk ? "PASS" : "FAIL"}`
    )
    process.exit(diOk && overallOk ? 0 : 1)
}

void main()
