#!/usr/bin/env tsx
/**
 * Layer 0, no model involved: does every number printed in /grapher/<slug>.md
 * match the chart's CSV? Parses the two value tables of each chart's markdown
 * and compares each cell with the CSV endpoint of the same view.
 *
 *   yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/checkMarkdownValues.ts
 *   yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/checkMarkdownValues.ts --chart life-expectancy --verbose
 */
import crypto from "crypto"
import fs from "fs"
import path from "path"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import {
    PROD_ORIGIN,
    RESULTS_DIR,
    grapherUrl,
    loadCharts,
    stagingOrigin,
} from "./lib/charts.js"
import { fetchText } from "./lib/http.js"
import { MarkdownTable, parseMarkdownTables } from "./lib/markdownTables.js"
import {
    approxEqual,
    displayedHalfUnit,
    parseFormattedNumber,
    parseUpperBound,
} from "./lib/numbers.js"
import { ChartView, loadView } from "./lib/view.js"

interface Finding {
    chart: string
    table: "selected" | "all-entities"
    kind:
        | "value-differs"
        | "year-differs"
        | "value-without-data"
        | "missing-value"
        | "entity-not-in-csv"
        | "column-unmatched"
        | "csv-column-not-shown"
        | "entities-missing"
        | "csv-parity"
    entity?: string
    column?: string
    year?: number
    shown?: string
    expected?: string
    note?: string
}

function norm(s: string): string {
    return s
        .toLowerCase()
        .replace(/\(.*?\)/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
}

/** Map a markdown column label to a CSV column, by title or by elimination. */
function matchColumn(view: ChartView, label: string): string | undefined {
    if (view.columns.length === 1) return view.columns[0]
    const n = norm(label)
    for (const c of view.columns) {
        const m = view.meta.columns[c]
        const names = [m?.titleShort, m?.titleLong, c]
            .filter((x): x is string => !!x)
            .map(norm)
        if (names.some((x) => x === n || x.includes(n) || n.includes(x)))
            return c
    }
    return undefined
}

function compare(shown: string, expected: number, relTol = 0.011): boolean {
    const bound = parseUpperBound(shown)
    if (bound !== undefined) return expected >= 0 && expected < bound
    const v = parseFormattedNumber(shown)
    if (v === undefined) return false
    // Printed values are rounded, so allow half a unit of the last digit or 1.1%.
    return approxEqual(v, expected, relTol, displayedHalfUnit(shown) * 1.01)
}

function checkAllEntitiesTable(
    view: ChartView,
    table: MarkdownTable,
    findings: Finding[]
): void {
    const chart = view.spec.key
    const headers = table.headers
    const timeIdx = headers.findIndex((h) => /^(year|time|day)$/i.test(h))
    const valueIdx = headers
        .map((_, i) => i)
        .filter((i) => i > 0 && i !== timeIdx)
    const columnFor = new Map<number, string | undefined>()
    for (const i of valueIdx) {
        const col = matchColumn(view, headers[i])
        columnFor.set(i, col)
        if (!col)
            findings.push({
                chart,
                table: "all-entities",
                kind: "column-unmatched",
                column: headers[i],
            })
    }
    const shownColumns = new Set([...columnFor.values()].filter(Boolean))
    for (const c of view.columns)
        if (!shownColumns.has(c))
            findings.push({
                chart,
                table: "all-entities",
                kind: "csv-column-not-shown",
                column: view.meta.columns[c]?.titleShort ?? c,
            })

    const endYear = view.viewEnd
    const seen = new Set<string>()
    for (const row of table.rows) {
        const entity = row[0]
        seen.add(entity)
        if (!view.full.byEntity.has(entity)) {
            findings.push({
                chart,
                table: "all-entities",
                kind: "entity-not-in-csv",
                entity,
            })
            continue
        }
        const shownYear = timeIdx >= 0 ? Number(row[timeIdx]) : undefined
        for (const i of valueIdx) {
            const col = columnFor.get(i)
            if (!col) continue
            const shown = row[i] ?? ""
            const expected = view.full.latest(entity, col, endYear)
            if (!expected) {
                if (shown)
                    findings.push({
                        chart,
                        table: "all-entities",
                        kind: "value-without-data",
                        entity,
                        column: col,
                        shown,
                    })
                continue
            }
            if (!shown) {
                findings.push({
                    chart,
                    table: "all-entities",
                    kind: "missing-value",
                    entity,
                    column: col,
                    expected: String(expected.value),
                    year: expected.year,
                })
                continue
            }
            if (!compare(shown, expected.value))
                findings.push({
                    chart,
                    table: "all-entities",
                    kind: "value-differs",
                    entity,
                    column: col,
                    shown,
                    expected: String(expected.value),
                    year: expected.year,
                })
            if (
                shownYear !== undefined &&
                Number.isFinite(shownYear) &&
                shownYear !== expected.year
            )
                findings.push({
                    chart,
                    table: "all-entities",
                    kind: "year-differs",
                    entity,
                    column: col,
                    shown: String(shownYear),
                    expected: String(expected.year),
                })
        }
    }
    const missing = view.full
        .entities()
        .filter(
            (e) =>
                !seen.has(e) &&
                view.columns.some((c) => view.full.latest(e, c, endYear))
        )
    if (missing.length > 0)
        findings.push({
            chart,
            table: "all-entities",
            kind: "entities-missing",
            note: `${missing.length} entities with data are not in the table (e.g. ${missing.slice(0, 3).join(", ")})`,
        })
}

function checkSelectedTable(
    view: ChartView,
    table: MarkdownTable,
    findings: Finding[]
): void {
    const chart = view.spec.key
    const label = table.intro.replace(/,\s*in .*$/, "").replace(/\.$/, "")
    const col = matchColumn(view, label)
    if (!col) {
        findings.push({
            chart,
            table: "selected",
            kind: "column-unmatched",
            column: label,
        })
        return
    }
    const years = table.headers.slice(1).map(Number)
    for (const row of table.rows) {
        const entity = row[0]
        if (!view.full.byEntity.has(entity)) {
            findings.push({
                chart,
                table: "selected",
                kind: "entity-not-in-csv",
                entity,
            })
            continue
        }
        years.forEach((headingYear, i) => {
            const cell = row[i + 1] ?? ""
            if (!Number.isFinite(headingYear)) return
            // "34.7 (1870)" means the entity's own first or last value, from that
            // year rather than the heading's; check it against that year.
            const bracket = cell.match(/^(.*?)\s*\((-?\d+)\)$/)
            const shown = bracket ? bracket[1] : cell
            const year = bracket ? Number(bracket[2]) : headingYear
            const expected = view.full.valueAt(entity, col, year)
            if (expected === undefined) {
                if (shown)
                    findings.push({
                        chart,
                        table: "selected",
                        kind: "value-without-data",
                        entity,
                        column: col,
                        year,
                        shown,
                        note: `CSV has no ${year} value; nearest is ${view.full.latest(entity, col, year)?.year ?? view.full.earliest(entity, col)?.year}`,
                    })
                return
            }
            if (!shown) {
                findings.push({
                    chart,
                    table: "selected",
                    kind: "missing-value",
                    entity,
                    column: col,
                    year,
                    expected: String(expected),
                })
                return
            }
            if (!compare(shown, expected))
                findings.push({
                    chart,
                    table: "selected",
                    kind: "value-differs",
                    entity,
                    column: col,
                    year,
                    shown,
                    expected: String(expected),
                })
        })
    }
}

async function main(): Promise<void> {
    const argv = await yargs(hideBin(process.argv))
        .option("chart", { type: "string", describe: "Only this chart key" })
        .option("branch", { type: "string" })
        .option("verbose", { type: "boolean", default: false })
        .parse()

    const charts = loadCharts()
    const branch = argv.branch ?? charts.prBranch
    const specs = charts.charts.filter(
        (c) => !argv.chart || c.key === argv.chart
    )
    fs.mkdirSync(path.join(RESULTS_DIR, "check"), { recursive: true })
    const findings: Finding[] = []
    const summary: Record<string, Record<string, number>> = {}

    for (const spec of specs) {
        const view = await loadView(spec, branch)
        const mdUrl = grapherUrl(
            stagingOrigin(branch),
            view.slug,
            ".md",
            view.params
        )
        const md = await fetchText(mdUrl)
        if (md.status !== 200) {
            console.log(`${spec.key}: ${md.status} from ${mdUrl}`)
            continue
        }
        fs.mkdirSync(path.join(RESULTS_DIR, "check"), { recursive: true })
        fs.writeFileSync(
            path.join(RESULTS_DIR, "check", `${spec.key}.md`),
            md.body
        )

        // Does the staging data match production? Gold for the QA eval comes
        // from staging, the "today" pages from production.
        const prodCsv = await fetchText(
            grapherUrl(PROD_ORIGIN, view.slug, ".csv", view.params, {
                csvType: "full",
                useColumnShortNames: "true",
            })
        )
        const stagingCsv = fs.readFileSync(
            path.join(RESULTS_DIR, "inputs", spec.key, "full.csv"),
            "utf8"
        )
        const md5 = (s: string): string =>
            crypto.createHash("md5").update(s).digest("hex")
        if (prodCsv.status !== 200 || md5(prodCsv.body) !== md5(stagingCsv))
            findings.push({
                chart: spec.key,
                table: "all-entities",
                kind: "csv-parity",
                note:
                    prodCsv.status === 200
                        ? "staging and production CSVs differ"
                        : `production CSV returned ${prodCsv.status}`,
            })

        const before = findings.length
        const tables = parseMarkdownTables(md.body)
        for (const t of tables) {
            if (/^Latest value/i.test(t.heading))
                checkAllEntitiesTable(view, t, findings)
            else if (/^Values shown/i.test(t.heading))
                checkSelectedTable(view, t, findings)
        }
        if (!tables.some((t) => /^Latest value/i.test(t.heading)))
            findings.push({
                chart: spec.key,
                table: "all-entities",
                kind: "entities-missing",
                note: "no per-entity table in the markdown",
            })

        const mine = findings.slice(before)
        const counts: Record<string, number> = {}
        for (const f of mine) counts[f.kind] = (counts[f.kind] ?? 0) + 1
        summary[spec.key] = counts
        const rows =
            tables.find((t) => /^Latest value/i.test(t.heading))?.rows.length ??
            0
        console.log(
            `${spec.key.padEnd(26)} ${String(rows).padStart(4)} rows  ${md.body.length.toString().padStart(6)} chars  ${
                mine.length === 0
                    ? "ok"
                    : Object.entries(counts)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(" ")
            }`
        )
        if (argv.verbose)
            for (const f of mine.slice(0, 15))
                console.log(
                    `    ${f.table}/${f.kind}: ${[f.entity, f.column, f.year, f.shown && `shown=${f.shown}`, f.expected && `expected=${f.expected}`, f.note].filter(Boolean).join("  ")}`
                )
    }

    const out = path.join(RESULTS_DIR, "check", "findings.json")
    fs.writeFileSync(
        out,
        JSON.stringify(
            { branch, checkedAt: new Date().toISOString(), summary, findings },
            null,
            2
        ) + "\n"
    )
    const serious = findings.filter((f) =>
        ["value-differs", "value-without-data", "year-differs"].includes(f.kind)
    )
    console.log(
        `\n${findings.length} findings (${serious.length} value/year mismatches) → ${path.relative(process.cwd(), out)}`
    )
    process.exitCode = serious.length > 0 ? 1 : 0
}

void main()
