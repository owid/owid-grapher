#!/usr/bin/env tsx
/**
 * Generate the question set for the document-QA eval from the charts in
 * charts.json. Every gold answer is derived from the chart's CSV and metadata
 * endpoints, never from the markdown under test, and the sampling is seeded so
 * re-running on unchanged data reproduces the same cases.
 *
 *   yarn tsx --tsconfig tsconfig.tsx.json devTools/agentEvals/buildCases.ts
 */
import fs from "fs"
import path from "path"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { EVALS_DIR, loadCharts, prodPageUrl } from "./lib/charts.js"
import { Random, hashString } from "./lib/random.js"
import { ChartView, loadView, sourceNames } from "./lib/view.js"

export type CaseType =
    | "point-latest"
    | "point-selected"
    | "point-start"
    | "change"
    | "rank-max"
    | "rank-min"
    | "unanswerable-early"
    | "unanswerable-late"
    | "meta-unit"
    | "meta-source"

export interface Gold {
    kind: "number" | "entity" | "none" | "unit" | "sources"
    number?: number
    relTol?: number
    absTol?: number
    /** Accepted entity names (ties, or two defensible readings of "latest"). */
    entities?: string[]
    unitTokens?: string[]
    sources?: string[]
}

export interface EvalCase {
    id: string
    chart: string
    url: string
    type: CaseType
    question: string
    gold: Gold
    tags: string[]
    meta: Record<string, unknown>
}

const REL_TOL = 0.01

function describeYear(year: number): string {
    return year < 0 ? `the year ${year} (${-year} BCE)` : String(year)
}

function indicator(
    view: ChartView,
    column: string,
    { article = true } = {}
): string {
    const title = view.meta.columns[column]?.titleShort ?? column
    if (view.columns.length > 1) return `"${title}"`
    return article ? `the ${lowerFirst(title)}` : lowerFirst(title)
}

/**
 * Values far below the column's typical magnitude print as "0" or "<0.01" on
 * the page, so no reader could recover them; exact zeros are fine.
 */
function isRepresentable(
    view: ChartView,
    column: string,
    year: number,
    value: number
): boolean {
    if (value === 0) return true
    const magnitudes = view.full
        .countries()
        .map((e) => view.full.valueAt(e, column, year))
        .filter((v): v is number => v !== undefined && v !== 0)
        .map(Math.abs)
        .sort((a, b) => a - b)
    const median = magnitudes[Math.floor(magnitudes.length / 2)] ?? 0
    return Math.abs(value) >= 0.01 * median
}

function lowerFirst(s: string): string {
    // Keep acronyms ("GDP per capita") intact.
    return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s
}

function unitHint(view: ChartView, column: string): string {
    const unit = view.meta.columns[column]?.unit?.trim()
    return unit ? ` Give the number in ${unit}.` : ""
}

function pointQuestion(
    view: ChartView,
    column: string,
    entity: string,
    year: number
): string {
    return (
        `According to this chart, what was ${indicator(view, column)} for ${entity} in ${describeYear(year)}?` +
        unitHint(view, column)
    )
}

function numberGold(value: number, absTol = 0): Gold {
    return { kind: "number", number: value, relTol: REL_TOL, absTol }
}

function unitTokens(unit: string, shortUnit: string): string[] {
    const tokens = unit
        .toLowerCase()
        .split(/[^a-z0-9$%]+/)
        .filter((t) => t.length >= 3 || t === "$" || t === "%")
    if (shortUnit.trim()) tokens.push(shortUnit.trim().toLowerCase())
    return [...new Set(tokens)]
}

function buildCasesForView(view: ChartView): EvalCase[] {
    const rng = new Random(hashString(view.spec.key))
    const cases: EvalCase[] = []
    const url = prodPageUrl(view.spec)
    const { full, selection, viewStart, viewEnd } = view
    const counters = new Map<CaseType, number>()

    const add = (
        type: CaseType,
        question: string,
        gold: Gold,
        meta: Record<string, unknown>
    ): void => {
        const n = (counters.get(type) ?? 0) + 1
        counters.set(type, n)
        cases.push({
            id: `${view.spec.key}/${type}-${n}`,
            chart: view.spec.key,
            url,
            type,
            question,
            gold,
            tags: [type, view.spec.key],
            meta,
        })
    }

    if (view.columns.length === 0 || viewEnd === undefined) return cases
    const randomColumn = (): string => rng.pick(view.columns)!
    const usedEntities = new Set<string>()

    // point-latest: two countries at their own latest year at or before the view's end.
    {
        const column = randomColumn()
        const candidates = full.countries().filter((e) => {
            const obs = full.latest(e, column, viewEnd)
            return (
                obs !== undefined &&
                isRepresentable(view, column, obs.year, obs.value)
            )
        })
        for (const entity of rng.sample(candidates, 2)) {
            const obs = full.latest(entity, column, viewEnd)!
            usedEntities.add(entity)
            add(
                "point-latest",
                pointQuestion(view, column, entity, obs.year),
                numberGold(obs.value),
                { column, entity, year: obs.year }
            )
        }
    }

    // point-selected: a default-selected entity at the view's end year.
    {
        const column = randomColumn()
        const candidates = selection.filter(
            (e) => full.valueAt(e, column, viewEnd) !== undefined
        )
        const entity = rng.pick(
            candidates.length > 1 ? candidates.slice(1) : candidates
        )
        if (entity) {
            usedEntities.add(entity)
            add(
                "point-selected",
                pointQuestion(view, column, entity, viewEnd),
                numberGold(full.valueAt(entity, column, viewEnd)!),
                { column, entity, year: viewEnd }
            )
        }
    }

    // point-start and change: the first selected entity across the view's time range.
    if (viewStart !== undefined && viewStart !== viewEnd) {
        const column = randomColumn()
        const entity = selection.find(
            (e) =>
                full.valueAt(e, column, viewStart) !== undefined &&
                full.valueAt(e, column, viewEnd) !== undefined
        )
        if (entity) {
            const v0 = full.valueAt(entity, column, viewStart)!
            const v1 = full.valueAt(entity, column, viewEnd)!
            add(
                "point-start",
                pointQuestion(view, column, entity, viewStart),
                numberGold(v0),
                { column, entity, year: viewStart }
            )
            add(
                "change",
                `According to this chart, by how much did ${indicator(view, column)} for ${entity} change between ${describeYear(viewStart)} and ${describeYear(viewEnd)}? Give the absolute change (end value minus start value)${unitHint(view, column).replace(" Give the number", ",")}`,
                numberGold(
                    v1 - v0,
                    0.005 * Math.max(Math.abs(v0), Math.abs(v1))
                ),
                { column, entity, from: viewStart, to: viewEnd, v0, v1 }
            )
        }
    }

    // rank-max / rank-min among countries.
    {
        const column = randomColumn()
        const atEnd = full
            .countries()
            .map((e) => ({
                entity: e,
                value: full.valueAt(e, column, viewEnd),
            }))
            .filter(
                (r): r is { entity: string; value: number } =>
                    r.value !== undefined
            )
        const latest = full
            .countries()
            .map((e) => ({ entity: e, obs: full.latest(e, column, viewEnd) }))
            .filter((r) => r.obs !== undefined)
            .map((r) => ({ entity: r.entity, value: r.obs!.value }))
        const pool = atEnd.length >= 10 ? atEnd : latest
        for (const [type, sign] of [
            ["rank-max", 1],
            ["rank-min", -1],
        ] as const) {
            const best = (
                rows: { entity: string; value: number }[]
            ): string[] => {
                if (rows.length === 0) return []
                const extreme = Math.max(...rows.map((r) => sign * r.value))
                return rows
                    .filter((r) => sign * r.value === extreme)
                    .map((r) => r.entity)
            }
            const entities = [...new Set([...best(pool), ...best(latest)])]
            if (entities.length === 0 || entities.length > 5) continue
            const word = sign > 0 ? "highest" : "lowest"
            add(
                type,
                `According to this chart, which country had the ${word} ${indicator(view, column, { article: false })} in ${describeYear(viewEnd)}? Consider countries only, not regions, income groups or the world as a whole.`,
                { kind: "entity", entities },
                {
                    column,
                    year: viewEnd,
                    pool: atEnd.length >= 10 ? "at-end" : "latest",
                }
            )
        }
    }

    // unanswerable-early: an entity with no value at the view's start year.
    if (viewStart !== undefined && viewStart !== viewEnd) {
        const column = randomColumn()
        const fromSelection = selection.filter(
            (e) =>
                full.valueAt(e, column, viewStart) === undefined &&
                full.latest(e, column, viewEnd) !== undefined
        )
        const fromCountries = full
            .countries()
            .filter(
                (e) =>
                    !usedEntities.has(e) &&
                    full.valueAt(e, column, viewStart) === undefined &&
                    full.latest(e, column, viewEnd) !== undefined
            )
        const entity = rng.pick(fromSelection) ?? rng.pick(fromCountries)
        if (entity) {
            add(
                "unanswerable-early",
                pointQuestion(view, column, entity, viewStart),
                { kind: "none" },
                {
                    column,
                    entity,
                    year: viewStart,
                    firstYear: full.earliest(entity, column)?.year,
                    selected: selection.includes(entity),
                }
            )
        }
    }

    // unanswerable-late: a country whose data stops before the view's end year.
    {
        const column = randomColumn()
        const stale = full.countries().filter((e) => {
            const obs = full.latest(e, column, viewEnd)
            return (
                obs !== undefined && obs.year < viewEnd && !usedEntities.has(e)
            )
        })
        const entity = rng.pick(stale)
        if (entity) {
            add(
                "unanswerable-late",
                pointQuestion(view, column, entity, viewEnd),
                { kind: "none" },
                {
                    column,
                    entity,
                    year: viewEnd,
                    lastYear: full.latest(entity, column, viewEnd)?.year,
                }
            )
        } else {
            const any = rng.pick(
                full.countries().filter((e) => !usedEntities.has(e))
            )
            if (any && full.maxYear(column) === viewEnd) {
                add(
                    "unanswerable-late",
                    pointQuestion(view, column, any, viewEnd + 1),
                    { kind: "none" },
                    { column, entity: any, year: viewEnd + 1 }
                )
            }
        }
    }

    // meta-unit
    {
        const column = randomColumn()
        const col = view.meta.columns[column]
        const tokens = unitTokens(col?.unit ?? "", col?.shortUnit ?? "")
        if (tokens.length > 0) {
            add(
                "meta-unit",
                `What unit is ${indicator(view, column)} measured in on this page?`,
                { kind: "unit", unitTokens: tokens },
                { column, unit: col.unit, shortUnit: col.shortUnit }
            )
        }
    }

    // meta-source
    {
        const sources = sourceNames(view)
        if (sources.length > 0) {
            add(
                "meta-source",
                "Which organisations or researchers produced the data shown in this chart? Name the original data providers.",
                { kind: "sources", sources },
                { sources }
            )
        }
    }

    return cases
}

async function main(): Promise<void> {
    const argv = await yargs(hideBin(process.argv))
        .option("out", {
            type: "string",
            default: path.join(EVALS_DIR, "cases.json"),
        })
        .option("branch", {
            type: "string",
            describe:
                "PR branch whose staging server serves the data endpoints",
        })
        .parse()

    const charts = loadCharts()
    const branch = argv.branch ?? charts.prBranch
    const all: EvalCase[] = []
    for (const spec of charts.charts) {
        const view = await loadView(spec, branch)
        const cases = buildCasesForView(view)
        console.log(
            `${spec.key}: ${cases.length} cases (columns=${view.columns.length}, selection=${view.selection.length}, ${view.viewStart}..${view.viewEnd})`
        )
        all.push(...cases)
    }
    fs.writeFileSync(argv.out, JSON.stringify(all, null, 2) + "\n")
    console.log(
        `\nWrote ${all.length} cases to ${path.relative(process.cwd(), argv.out)}`
    )
}

void main()
