import { bench, describe } from "vitest"
import {
    ColumnTypeNames,
    OwidColumnDef,
    OwidTableSlugs,
} from "@ourworldindata/types"
import { OwidTable } from "./OwidTable.js"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "./OwidTableSynthesizers.js"

// Table-level transforms are what a chart's `transformTable()` chains together
// on every render. They walk the whole column store, so their cost scales with
// entity count × time range. We build tables once and measure the individual
// transforms; the synthesizer uses a fixed seed so the data is identical run
// to run.

const SEED = 1

/** Reference a value so it isn't flagged as an unused expression (and assert the materialization actually produced data). */
function keep(value: unknown): void {
    if (value === undefined) throw new Error("expected a value")
}

const dataColumnDefs: OwidColumnDef[] = [
    { slug: SampleColumnSlugs.Population, type: ColumnTypeNames.Population },
    { slug: SampleColumnSlugs.GDP, type: ColumnTypeNames.Currency },
    { slug: SampleColumnSlugs.LifeExpectancy, type: ColumnTypeNames.Age },
]

/**
 * Build a plain CSV string (~entityCount × timeSpan rows, 3 numeric columns)
 * the way an ingested dataset arrives, so we can measure the parse-and-type
 * path in isolation from data generation.
 */
function makeCsv(entityCount: number, timeSpan: number): string {
    const header = [
        OwidTableSlugs.EntityName,
        OwidTableSlugs.EntityCode,
        OwidTableSlugs.EntityId,
        OwidTableSlugs.Year,
        SampleColumnSlugs.Population,
        SampleColumnSlugs.GDP,
        SampleColumnSlugs.LifeExpectancy,
    ].join(",")

    const lines: string[] = [header]
    for (let e = 0; e < entityCount; e++) {
        const name = `Country ${e}`
        const code = `C${e}`
        for (let t = 0; t < timeSpan; t++) {
            const year = 1900 + t
            const pop = Math.round(1e7 + Math.sin(e + t) * 1e6)
            const gdp = Math.round(1e9 + Math.cos(e + t) * 1e8)
            const life = (60 + ((e + t) % 30)).toFixed(2)
            lines.push(`${name},${code},${e},${year},${pop},${gdp},${life}`)
        }
    }
    return lines.join("\n")
}

describe("OwidTable construction (CSV parse + type coercion)", () => {
    const smallCsv = makeCsv(50, 60) // 3k rows
    const largeCsv = makeCsv(200, 120) // 24k rows

    // The column store is computed lazily on first access, so we read a column's
    // values to force the parse we want to measure.
    bench("parse 3k rows", () => {
        const table = new OwidTable(smallCsv, dataColumnDefs)
        keep(table.get(SampleColumnSlugs.GDP).values)
    })

    bench("parse 24k rows", () => {
        const table = new OwidTable(largeCsv, dataColumnDefs)
        keep(table.get(SampleColumnSlugs.GDP).values)
    })
})

describe("filterByEntityNames", () => {
    const table = SynthesizeGDPTable(
        { entityCount: 200, timeRange: [1900, 2020] },
        SEED
    )
    // Materialize the base table once so we measure the filter, not the parse.
    keep(table.get(SampleColumnSlugs.GDP).values)
    const half = table.availableEntityNames.slice(
        0,
        Math.floor(table.availableEntityNames.length / 2)
    )

    bench("keep half of 200 entities", () => {
        const filtered = table.filterByEntityNames(half)
        keep(filtered.numRows)
    })
})

describe("interpolateColumnWithTolerance", () => {
    // Punch holes in the data so tolerance interpolation actually has gaps to
    // fill (complete grid → sort → interpolate is the expensive branch).
    const table = SynthesizeGDPTable(
        { entityCount: 100, timeRange: [1900, 2000] },
        SEED
    ).replaceRandomCells(4000, [SampleColumnSlugs.Population], SEED)
    keep(table.get(SampleColumnSlugs.Population).values)

    bench("tolerance 10 over 100 entities × 100 years", () => {
        const interpolated = table.interpolateColumnWithTolerance(
            SampleColumnSlugs.Population,
            { toleranceOverride: 10 }
        )
        keep(interpolated.get(SampleColumnSlugs.Population).values)
    })
})
