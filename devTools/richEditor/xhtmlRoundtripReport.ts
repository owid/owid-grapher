// Round-trip fidelity report for the semantic XHTML codec used by the rich
// editor's AI assistant (db/model/Gdoc/enrichedToXhtml.ts + xhtmlToEnriched.ts).
//
// Reads a JSONL file of published gdoc bodies ({id, slug, type, body} per
// line), converts each body enriched → XHTML → enriched (through the real
// raw→enriched validators), and reports pass rates per document type. This is
// the M4a exit criterion check: the agent reads and writes documents as this
// XHTML, so every published block shape must survive the trip.
//
// Usage: yarn tsx --tsconfig tsconfig.tsx.json devTools/richEditor/xhtmlRoundtripReport.ts <bodies.jsonl> [--verbose]

import fs from "fs"
import readline from "readline"
import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { enrichedBlocksToXhtml } from "../../db/model/Gdoc/enrichedToXhtml.js"
import { xhtmlToEnrichedBlocks } from "../../db/model/Gdoc/xhtmlToEnriched.js"
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
    stage: "serialize" | "parse" | "compare"
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
            "Usage: xhtmlRoundtripReport.ts <bodies.jsonl> [--verbose] [--max-failures N]"
        )
        process.exit(1)
    }
    const verbose = flags.includes("--verbose")
    const maxFailuresIdx = flags.indexOf("--max-failures")
    const maxFailures =
        maxFailuresIdx >= 0 ? Number(flags[maxFailuresIdx + 1]) : 20

    const totals = new Map<string, { total: number; passed: number }>()
    const failures: Failure[] = []

    const rl = readline.createInterface({
        input: fs.createReadStream(path),
        crlfDelay: Infinity,
    })
    for await (const line of rl) {
        if (!line.trim()) continue
        const record = JSON.parse(line) as GdocBodyRecord
        const bucket = totals.get(record.type) ?? { total: 0, passed: 0 }
        bucket.total++
        totals.set(record.type, bucket)

        let xhtml: string
        try {
            xhtml = enrichedBlocksToXhtml(record.body)
        } catch (err) {
            failures.push({
                id: record.id,
                slug: record.slug,
                type: record.type,
                stage: "serialize",
                detail: err instanceof Error ? err.message : String(err),
            })
            continue
        }

        let roundTripped: OwidEnrichedGdocBlock[]
        try {
            roundTripped = xhtmlToEnrichedBlocks(xhtml)
        } catch (err) {
            failures.push({
                id: record.id,
                slug: record.slug,
                type: record.type,
                stage: "parse",
                detail: err instanceof Error ? err.message : String(err),
            })
            continue
        }

        if (!enrichedBodiesMatch(record.body, roundTripped)) {
            failures.push({
                id: record.id,
                slug: record.slug,
                type: record.type,
                stage: "compare",
                detail: firstDifference(
                    normalizedBodyKey(record.body),
                    normalizedBodyKey(roundTripped)
                ),
            })
            continue
        }
        bucket.passed++
    }

    let total = 0
    let passed = 0
    console.log("XHTML round-trip report (enriched → xhtml → enriched)\n")
    const types = [...totals.entries()].sort((a, b) => b[1].total - a[1].total)
    for (const [type, bucket] of types) {
        total += bucket.total
        passed += bucket.passed
        const pct = ((bucket.passed / bucket.total) * 100).toFixed(1)
        console.log(
            `${type.padEnd(24)} ${bucket.passed}/${bucket.total} (${pct}%)`
        )
    }
    console.log(
        `\nTOTAL ${passed}/${total} (${((passed / total) * 100).toFixed(2)}%)`
    )

    if (failures.length > 0) {
        console.log(`\n${failures.length} failures:`)
        const byStage = new Map<string, number>()
        for (const f of failures)
            byStage.set(f.stage, (byStage.get(f.stage) ?? 0) + 1)
        for (const [stage, n] of byStage) console.log(`  ${stage}: ${n}`)
        for (const f of failures.slice(0, maxFailures)) {
            console.log(`\n- ${f.slug} (${f.type}, ${f.stage})`)
            if (verbose) console.log(`  ${f.detail}`)
            else console.log(`  ${f.detail.split("\n")[0]?.slice(0, 200)}`)
        }
        process.exit(1)
    }
}

void main()
